from math import ceil
from decimal import Decimal
from typing import Any
from typing import Literal

from fastapi import APIRouter, Depends, Query
from prisma import Prisma

from app.database import get_db
from app.schemas import (
    AnalyzeOut,
    LivePairsOut,
    MatrixCellOut,
    MatrixRowOut,
    PairOut,
    RecommendationOut,
    SnapshotCreate,
    SnapshotMatrixOut,
    SnapshotMetaOut,
    SnapshotSavedOut,
)
from app.services.mexc import MexcClient

router = APIRouter(prefix="/api", tags=["markets"])


def _kind(value: str) -> str:
    return value.upper().strip()


def _pair_to_out(pair: Any) -> PairOut:
    return PairOut(
        symbol=pair.symbol,
        base_asset=pair.baseAsset,
        quote_asset=pair.quoteAsset,
        last_price=pair.lastPrice,
        price_change=pair.priceChange,
        price_change_percent=pair.priceChangePercent,
        high_price=pair.highPrice,
        low_price=pair.lowPrice,
        volume=pair.volume,
        quote_volume=pair.quoteVolume,
    )


def _pair_create_data(pair: PairOut, snapshot_id: int) -> dict[str, Any]:
    return {
        "snapshotId": snapshot_id,
        "symbol": pair.symbol,
        "baseAsset": pair.base_asset,
        "quoteAsset": pair.quote_asset,
        "lastPrice": pair.last_price,
        "priceChange": pair.price_change,
        "priceChangePercent": pair.price_change_percent,
        "highPrice": pair.high_price,
        "lowPrice": pair.low_price,
        "volume": pair.volume,
        "quoteVolume": pair.quote_volume,
    }


def _chunks(items: list[dict[str, Any]], size: int = 500) -> list[list[dict[str, Any]]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/kinds")
async def list_kinds() -> dict[str, list[str]]:
    return {"kinds": await MexcClient().get_kinds()}


@router.get("/pairs/live", response_model=LivePairsOut)
async def live_pairs(
    kind: str = Query("USDT", min_length=2, max_length=20),
    limit: int = Query(5000, ge=1, le=10000),
) -> LivePairsOut:
    normalized_kind = _kind(kind)
    read_at, pairs = await MexcClient().get_live_pairs(normalized_kind)
    return LivePairsOut(
        kind=normalized_kind,
        read_at=read_at,
        count=len(pairs[:limit]),
        pairs=pairs[:limit],
    )


@router.post("/snapshots", response_model=SnapshotSavedOut)
async def save_snapshot(payload: SnapshotCreate, db: Prisma = Depends(get_db)) -> SnapshotSavedOut:
    normalized_kind = _kind(payload.kind)
    read_at, pairs = await MexcClient().get_live_pairs(normalized_kind)

    snapshot = await db.marketsnapshot.create(
        data={"kind": normalized_kind, "source": "mexc_spot", "capturedAt": read_at}
    )
    pair_rows = [_pair_create_data(pair, snapshot.id) for pair in pairs]
    for chunk in _chunks(pair_rows):
        await db.pairtick.create_many(data=chunk)

    return SnapshotSavedOut(
        id=snapshot.id,
        kind=snapshot.kind,
        source=snapshot.source,
        captured_at=snapshot.capturedAt,
        pair_count=len(pair_rows),
    )


@router.get("/snapshots", response_model=list[SnapshotMetaOut])
async def list_snapshots(
    kind: str = Query("USDT", min_length=2, max_length=20),
    limit: int = Query(20, ge=1, le=100),
    db: Prisma = Depends(get_db),
) -> list[SnapshotMetaOut]:
    normalized_kind = _kind(kind)
    snapshots = await db.marketsnapshot.find_many(
        where={"kind": normalized_kind},
        order={"capturedAt": "desc"},
        take=limit,
        include={"pairs": True},
    )
    return [
        SnapshotMetaOut(
            id=snapshot.id,
            kind=snapshot.kind,
            source=snapshot.source,
            captured_at=snapshot.capturedAt,
            pair_count=len(snapshot.pairs or []),
        )
        for snapshot in snapshots
    ]


@router.get("/snapshots/matrix", response_model=SnapshotMatrixOut)
async def snapshot_matrix(
    kind: str = Query("USDT", min_length=2, max_length=20),
    limit: int = Query(6, ge=1, le=24),
    metric: Literal["price", "change_percent", "volume"] = "change_percent",
    db: Prisma = Depends(get_db),
) -> SnapshotMatrixOut:
    normalized_kind = _kind(kind)
    snapshots = await db.marketsnapshot.find_many(
        where={"kind": normalized_kind},
        order={"capturedAt": "desc"},
        take=limit,
        include={"pairs": True},
    )
    snapshots = list(reversed(snapshots))

    rows_by_symbol: dict[str, MatrixRowOut] = {}
    timestamp_keys = [snapshot.capturedAt.isoformat() for snapshot in snapshots]
    for snapshot in snapshots:
        timestamp_key = snapshot.capturedAt.isoformat()
        for pair in snapshot.pairs or []:
            if pair.symbol not in rows_by_symbol:
                rows_by_symbol[pair.symbol] = MatrixRowOut(
                    symbol=pair.symbol,
                    base_asset=pair.baseAsset,
                    quote_asset=pair.quoteAsset,
                    cells={},
                )
            rows_by_symbol[pair.symbol].cells[timestamp_key] = MatrixCellOut(
                snapshot_id=snapshot.id,
                captured_at=snapshot.capturedAt,
                last_price=pair.lastPrice,
                price_change_percent=pair.priceChangePercent,
                volume=pair.volume,
            )

    def latest_change(row: MatrixRowOut) -> Decimal:
        if not row.cells:
            return Decimal("-999999")
        latest_cell = row.cells[max(row.cells.keys())]
        return latest_cell.price_change_percent or Decimal("-999999")

    rows = sorted(rows_by_symbol.values(), key=latest_change, reverse=True)
    return SnapshotMatrixOut(
        kind=normalized_kind,
        metric=metric,
        timestamps=timestamp_keys,
        rows=rows,
    )


@router.get("/analyze", response_model=AnalyzeOut)
async def analyze(
    kind: str = Query("USDT", min_length=2, max_length=20),
    threshold: Decimal = Query(Decimal("10")),
    target_ratio: Decimal = Query(Decimal("80"), ge=Decimal("1"), le=Decimal("100")),
    db: Prisma = Depends(get_db),
) -> AnalyzeOut:
    normalized_kind = _kind(kind)
    snapshots = await db.marketsnapshot.find_many(
        where={"kind": normalized_kind},
        order={"capturedAt": "desc"},
        take=2,
        include={"pairs": True},
    )
    if not snapshots:
        return AnalyzeOut(
            kind=normalized_kind,
            threshold=threshold,
            target_ratio=target_ratio,
            target_threshold=None,
            snapshot_id=None,
            captured_at=None,
            total_pairs=0,
            count=0,
            qualified_ratio=Decimal("0"),
            recommendations=[],
        )

    latest = snapshots[0]
    previous_by_symbol = {}
    if len(snapshots) > 1:
        previous_by_symbol = {pair.symbol: pair for pair in snapshots[1].pairs or []}

    latest_pairs = latest.pairs or []
    sorted_changes = sorted(
        [pair.priceChangePercent for pair in latest_pairs if pair.priceChangePercent is not None],
        reverse=True,
    )
    target_threshold = None
    if sorted_changes:
        target_index = max(
            0,
            min(
                len(sorted_changes) - 1,
                ceil(len(sorted_changes) * (target_ratio / Decimal("100"))) - 1,
            ),
        )
        target_threshold = sorted_changes[target_index]

    recommendations: list[RecommendationOut] = []
    for pair in latest_pairs:
        if pair.priceChangePercent is None or pair.priceChangePercent < threshold:
            continue
        previous = previous_by_symbol.get(pair.symbol)
        previous_change = previous.priceChangePercent if previous else None
        delta = (
            pair.priceChangePercent - previous_change
            if previous_change is not None
            else None
        )
        recommendations.append(
            RecommendationOut(
                snapshot_id=latest.id,
                captured_at=latest.capturedAt,
                previous_change_percent=previous_change,
                change_percent_delta=delta,
                **_pair_to_out(pair).model_dump(),
            )
        )

    recommendations.sort(
        key=lambda pair: pair.price_change_percent or Decimal("-999999"),
        reverse=True,
    )
    total_pairs = len(latest_pairs)
    qualified_ratio = (
        Decimal(len(recommendations)) * Decimal("100") / Decimal(total_pairs)
        if total_pairs
        else Decimal("0")
    )
    return AnalyzeOut(
        kind=normalized_kind,
        threshold=threshold,
        target_ratio=target_ratio,
        target_threshold=target_threshold,
        snapshot_id=latest.id,
        captured_at=latest.capturedAt,
        total_pairs=total_pairs,
        count=len(recommendations),
        qualified_ratio=qualified_ratio,
        recommendations=recommendations,
    )


@router.get("/pairs/{symbol}/klines")
async def klines(
    symbol: str,
    interval: str = Query("1h", pattern="^(1m|5m|15m|30m|60m|1h|4h|1d|1W|1M)$"),
    limit: int = Query(300, ge=1, le=1000),
) -> dict[str, list]:
    return {"klines": await MexcClient().get_klines(symbol, interval=interval, limit=limit)}
