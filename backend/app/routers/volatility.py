from decimal import Decimal

from fastapi import APIRouter, Query

from app.schemas import VolatilityScanOut
from app.services.coinmarketcap import CoinMarketCapClient


router = APIRouter(prefix="/api/volatility", tags=["volatility"])


@router.get("/coinmarketcap", response_model=VolatilityScanOut)
async def scan_coinmarketcap_volatility(
    threshold_percent: Decimal = Query(Decimal("10"), ge=Decimal("0")),
    min_probability_percent: Decimal = Query(Decimal("40"), ge=Decimal("0"), le=Decimal("100")),
    window_days: int = Query(1, ge=1, le=2),
    lookback_days: int = Query(30, ge=7, le=60),
    min_age_months: Decimal = Query(Decimal("3"), ge=Decimal("0")),
    limit: int = Query(200, ge=1, le=1000),
    quote: str = Query("USD", min_length=2, max_length=10),
) -> VolatilityScanOut:
    return await CoinMarketCapClient().scan_volatility(
        threshold_percent=abs(threshold_percent),
        min_probability_percent=min_probability_percent,
        window_days=window_days,
        lookback_days=lookback_days,
        min_age_months=min_age_months,
        limit=limit,
        quote=quote,
    )
