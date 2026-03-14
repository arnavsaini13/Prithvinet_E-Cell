"""
PrithviNet - Forecast API
Endpoint for AI-based short-term pollution forecasting.
Access: regional_officer+ (regional analytics)
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import PollutionReading
from schemas import ForecastOut
from services.forecasting_engine import generate_forecast
from dependencies import require_officer

router = APIRouter(tags=["Forecast"])


@router.get("/forecast", response_model=ForecastOut)
async def get_forecast(
    station_id: int = Query(...),
    pollutant: str = Query(default="pm25"),
    steps: int = Query(default=12, le=48),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_officer),
):
    """
    Generate a short-term forecast for the given station and pollutant.
    Requires regional_officer or admin role.
    """
    valid_pollutants = {
        "pm25", "pm10", "co2", "no2", "ph", "turbidity",
        "dissolved_oxygen", "noise_level",
    }
    if pollutant not in valid_pollutants:
        pollutant = "pm25"

    stmt = (
        select(PollutionReading)
        .where(PollutionReading.station_id == station_id)
        .order_by(PollutionReading.timestamp.desc())
        .limit(30)
    )
    result = await db.execute(stmt)
    readings = result.scalars().all()

    reading_dicts = [
        {
            "pm25": r.pm25, "pm10": r.pm10, "co2": r.co2, "no2": r.no2,
            "ph": r.ph, "turbidity": r.turbidity,
            "dissolved_oxygen": r.dissolved_oxygen, "noise_level": r.noise_level,
            "timestamp": r.timestamp.isoformat(),
        }
        for r in reversed(readings)
    ]

    forecast_data = generate_forecast(
        recent_readings=reading_dicts,
        pollutant=pollutant,
        station_id=station_id,
        steps=steps,
    )
    return ForecastOut(**forecast_data)
