from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.config import get_settings
from app.schemas import PairOut


COMMON_KINDS = ["USDT", "USDC", "BTC", "ETH"]


def _decimal(value: Any) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _percent(value: Any) -> Decimal | None:
    parsed = _decimal(value)
    return parsed * Decimal("100") if parsed is not None else None


class MexcClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        url = f"{self.settings.mexc_base_url.rstrip('/')}{path}"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"MEXC returned {exc.response.status_code} for {path}",
            ) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Could not reach MEXC: {exc}",
            ) from exc

    async def get_kinds(self) -> list[str]:
        exchange_info = await self._get("/api/v3/exchangeInfo")
        symbols = exchange_info.get("symbols", [])
        kinds = sorted(
            {
                item.get("quoteAsset")
                for item in symbols
                if item.get("quoteAsset") and item.get("status", "ENABLED") != "DISABLED"
            }
        )
        priority = [kind for kind in COMMON_KINDS if kind in kinds]
        return priority + [kind for kind in kinds if kind not in priority]

    async def get_live_pairs(self, kind: str) -> tuple[datetime, list[PairOut]]:
        normalized_kind = kind.upper().strip()
        exchange_info = await self._get("/api/v3/exchangeInfo")
        ticker_rows = await self._get("/api/v3/ticker/24hr")

        symbol_assets = {
            item["symbol"]: {
                "base_asset": item.get("baseAsset", ""),
                "quote_asset": item.get("quoteAsset", ""),
            }
            for item in exchange_info.get("symbols", [])
            if item.get("symbol") and item.get("quoteAsset") == normalized_kind
        }
        tickers = ticker_rows if isinstance(ticker_rows, list) else [ticker_rows]

        pairs: list[PairOut] = []
        for ticker in tickers:
            symbol = ticker.get("symbol")
            assets = symbol_assets.get(symbol)
            if not symbol or not assets:
                continue
            pairs.append(
                PairOut(
                    symbol=symbol,
                    base_asset=assets["base_asset"],
                    quote_asset=assets["quote_asset"],
                    last_price=_decimal(ticker.get("lastPrice")),
                    price_change=_decimal(ticker.get("priceChange")),
                    price_change_percent=_percent(ticker.get("priceChangePercent")),
                    high_price=_decimal(ticker.get("highPrice")),
                    low_price=_decimal(ticker.get("lowPrice")),
                    volume=_decimal(ticker.get("volume")),
                    quote_volume=_decimal(ticker.get("quoteVolume")),
                )
            )

        pairs.sort(key=lambda pair: pair.price_change_percent or Decimal("-999999"), reverse=True)
        return datetime.now(timezone.utc), pairs

    async def get_klines(self, symbol: str, interval: str = "1h", limit: int = 300) -> list[Any]:
        return await self._get(
            "/api/v3/klines",
            params={"symbol": symbol.upper(), "interval": interval, "limit": limit},
        )
