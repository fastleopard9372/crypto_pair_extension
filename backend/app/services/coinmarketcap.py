from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.config import get_settings
from app.schemas import (
    VolatilityEventOut,
    VolatilityPointOut,
    VolatilityScanOut,
    VolatilityTokenOut,
)


def _decimal(value: Any) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _datetime(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _months_between(start: datetime, end: datetime) -> Decimal:
    return Decimal((end - start).days) / Decimal("30.4375")


def _chunks(items: list[int], size: int) -> list[list[int]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


class CoinMarketCapClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        if not self.settings.coinmarketcap_api_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Set COINMARKETCAP_API_KEY in backend/.env to use the volatility screener.",
            )

        url = f"{self.settings.coinmarketcap_base_url.rstrip('/')}{path}"
        headers = {"X-CMC_PRO_API_KEY": self.settings.coinmarketcap_api_key}
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=headers, params=params)
                response.raise_for_status()
                body = response.json()
        except httpx.HTTPStatusError as exc:
            detail = f"CoinMarketCap returned {exc.response.status_code} for {path}"
            try:
                error = exc.response.json().get("status", {}).get("error_message")
            except ValueError:
                error = None
            if error:
                detail = f"{detail}: {error}"
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Could not reach CoinMarketCap: {exc}",
            ) from exc

        status_payload = body.get("status") if isinstance(body, dict) else None
        if isinstance(status_payload, dict) and status_payload.get("error_code"):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=status_payload.get("error_message") or "CoinMarketCap returned an error.",
            )
        return body.get("data", body) if isinstance(body, dict) else body

    async def get_latest_listings(self, limit: int, quote: str) -> list[dict[str, Any]]:
        data = await self._get(
            "/v1/cryptocurrency/listings/latest",
            params={
                "start": 1,
                "limit": limit,
                "convert": quote,
                "sort": "market_cap",
                "sort_dir": "desc",
                "aux": (
                    "num_market_pairs,cmc_rank,date_added,tags,platform,max_supply,"
                    "circulating_supply,total_supply,volume_24h_reported,volume_7d,"
                    "volume_30d,is_market_cap_included_in_calc"
                ),
            },
        )
        return data if isinstance(data, list) else []

    async def get_daily_history(
        self,
        ids: list[int],
        quote: str,
        time_start: datetime,
        time_end: datetime,
    ) -> dict[int, list[VolatilityPointOut]]:
        histories: dict[int, list[VolatilityPointOut]] = {}
        for batch in _chunks(ids, 50):
            data = await self._get(
                "/v3/cryptocurrency/quotes/historical",
                params={
                    "id": ",".join(str(item) for item in batch),
                    "convert": quote,
                    "time_start": time_start.isoformat().replace("+00:00", "Z"),
                    "time_end": time_end.isoformat().replace("+00:00", "Z"),
                    "interval": "daily",
                },
            )
            histories.update(self._parse_history_payload(data, quote))
        return histories

    def _parse_history_payload(self, data: Any, quote: str) -> dict[int, list[VolatilityPointOut]]:
        items: list[Any]
        if isinstance(data, dict):
            if "quotes" in data:
                items = [data]
            else:
                items = list(data.values())
        elif isinstance(data, list):
            items = data
        else:
            items = []

        histories: dict[int, list[VolatilityPointOut]] = {}
        for item in items:
            if not isinstance(item, dict):
                continue
            token_id = item.get("id")
            quotes = item.get("quotes") or []
            points: list[VolatilityPointOut] = []
            for quote_row in quotes:
                if not isinstance(quote_row, dict):
                    continue
                timestamp = _datetime(quote_row.get("timestamp"))
                quote_payload = quote_row.get("quote", {}).get(quote)
                if quote_payload is None:
                    quote_payload = quote_row.get("quote", {}).get(quote.upper())
                price = _decimal(quote_payload.get("price") if isinstance(quote_payload, dict) else None)
                if timestamp and price is not None and price > 0:
                    points.append(VolatilityPointOut(timestamp=timestamp, price=price))
            if token_id is not None:
                histories[int(token_id)] = sorted(points, key=lambda point: point.timestamp)
        return histories

    async def scan_volatility(
        self,
        threshold_percent: Decimal,
        min_probability_percent: Decimal,
        window_days: int,
        lookback_days: int,
        min_age_months: Decimal,
        limit: int,
        quote: str,
    ) -> VolatilityScanOut:
        now = datetime.now(timezone.utc)
        quote = quote.upper().strip()
        listings = await self.get_latest_listings(limit=limit, quote=quote)
        candidates = []
        for listing in listings:
            added_at = _datetime(listing.get("date_added"))
            if added_at is None:
                continue
            age_months = _months_between(added_at, now)
            if age_months >= min_age_months:
                candidates.append((listing, age_months))

        time_start = now - timedelta(days=lookback_days + window_days + 1)
        histories = await self.get_daily_history(
            ids=[int(item["id"]) for item, _ in candidates],
            quote=quote,
            time_start=time_start,
            time_end=now,
        )

        tokens: list[VolatilityTokenOut] = []
        for listing, age_months in candidates:
            token_id = int(listing["id"])
            points = histories.get(token_id, [])
            result = self._evaluate_listing(
                listing=listing,
                points=points,
                quote=quote,
                age_months=age_months,
                threshold_percent=threshold_percent,
                min_probability_percent=min_probability_percent,
                window_days=window_days,
                lookback_days=lookback_days,
            )
            if result:
                tokens.append(result)

        tokens.sort(
            key=lambda token: (token.probability_percent, token.max_abs_change_percent),
            reverse=True,
        )
        return VolatilityScanOut(
            quote=quote,
            lookback_days=lookback_days,
            window_days=window_days,
            threshold_percent=threshold_percent,
            min_probability_percent=min_probability_percent,
            min_age_months=min_age_months,
            checked_count=len(listings),
            candidate_count=len(candidates),
            count=len(tokens),
            tokens=tokens,
        )

    def _evaluate_listing(
        self,
        listing: dict[str, Any],
        points: list[VolatilityPointOut],
        quote: str,
        age_months: Decimal,
        threshold_percent: Decimal,
        min_probability_percent: Decimal,
        window_days: int,
        lookback_days: int,
    ) -> VolatilityTokenOut | None:
        if len(points) <= window_days:
            return None

        cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)
        events: list[VolatilityEventOut] = []
        max_abs_change = Decimal("0")
        period_count = 0
        hit_count = 0
        for index in range(0, len(points) - window_days):
            start = points[index]
            end = points[index + window_days]
            if end.timestamp < cutoff:
                continue
            if start.price <= 0:
                continue
            change = (end.price - start.price) * Decimal("100") / start.price
            abs_change = abs(change)
            max_abs_change = max(max_abs_change, abs_change)
            period_count += 1
            if abs_change >= threshold_percent:
                hit_count += 1
                events.append(
                    VolatilityEventOut(
                        start_at=start.timestamp,
                        end_at=end.timestamp,
                        start_price=start.price,
                        end_price=end.price,
                        change_percent=change,
                    )
                )

        if period_count == 0:
            return None
        probability = Decimal(hit_count) * Decimal("100") / Decimal(period_count)
        if probability < min_probability_percent:
            return None

        quote_payload = listing.get("quote", {}).get(quote, {})
        return VolatilityTokenOut(
            id=int(listing["id"]),
            name=str(listing.get("name", "")),
            symbol=str(listing.get("symbol", "")),
            slug=str(listing.get("slug", "")),
            cmc_rank=listing.get("cmc_rank"),
            date_added=_datetime(listing.get("date_added")),
            age_months=age_months,
            price=_decimal(quote_payload.get("price")),
            market_cap=_decimal(quote_payload.get("market_cap")),
            volume_24h=_decimal(quote_payload.get("volume_24h")),
            percent_change_24h=_decimal(quote_payload.get("percent_change_24h")),
            threshold_percent=threshold_percent,
            probability_percent=probability,
            hit_count=hit_count,
            period_count=period_count,
            max_abs_change_percent=max_abs_change,
            window_days=window_days,
            points=points[-(lookback_days + window_days + 1) :],
            events=events,
        )
