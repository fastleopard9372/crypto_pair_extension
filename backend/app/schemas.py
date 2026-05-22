from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PairOut(BaseModel):
    symbol: str
    base_asset: str
    quote_asset: str
    last_price: Decimal | None = None
    price_change: Decimal | None = None
    price_change_percent: Decimal | None = None
    high_price: Decimal | None = None
    low_price: Decimal | None = None
    volume: Decimal | None = None
    quote_volume: Decimal | None = None

    model_config = ConfigDict(from_attributes=True)


class LivePairsOut(BaseModel):
    kind: str
    source: str = "mexc_spot"
    read_at: datetime
    count: int
    pairs: list[PairOut]


class SnapshotCreate(BaseModel):
    kind: str = Field(min_length=2, max_length=20)


class SnapshotMetaOut(BaseModel):
    id: int
    kind: str
    source: str
    captured_at: datetime
    pair_count: int


class SnapshotSavedOut(BaseModel):
    id: int
    kind: str
    source: str
    captured_at: datetime
    pair_count: int


class SnapshotDeletedOut(BaseModel):
    deleted: bool
    id: int
    captured_at: datetime | None = None
    pair_count: int = 0


class MatrixCellOut(BaseModel):
    snapshot_id: int
    captured_at: datetime
    last_price: Decimal | None
    price_change_percent: Decimal | None
    volume: Decimal | None


class MatrixRowOut(BaseModel):
    symbol: str
    base_asset: str
    quote_asset: str
    cells: dict[str, MatrixCellOut]


class SnapshotMatrixOut(BaseModel):
    kind: str
    metric: Literal["price", "change_percent", "volume"]
    timestamps: list[str]
    rows: list[MatrixRowOut]


class RecommendationOut(PairOut):
    snapshot_id: int
    captured_at: datetime
    previous_change_percent: Decimal | None = None
    change_percent_delta: Decimal | None = None


class AnalyzeOut(BaseModel):
    kind: str
    threshold: Decimal
    target_ratio: Decimal
    target_threshold: Decimal | None
    snapshot_id: int | None
    captured_at: datetime | None
    total_pairs: int
    count: int
    qualified_ratio: Decimal
    recommendations: list[RecommendationOut]


class FavoritePairCreate(BaseModel):
    kind: str = Field(min_length=2, max_length=20)
    symbol: str = Field(min_length=2, max_length=40)
    base_asset: str = Field(min_length=1, max_length=30)
    quote_asset: str = Field(min_length=1, max_length=30)


class FavoritePairOut(BaseModel):
    id: int
    kind: str
    symbol: str
    base_asset: str
    quote_asset: str
    created_at: datetime
