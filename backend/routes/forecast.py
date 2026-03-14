"""
PrithviNet - Forecast API
=========================
Air pollutants (pm25, pm10, co2, no2):
  Real 72-hour hourly forecast from Open-Meteo Air Quality API (ECMWF/CAMS model).
  SOURCE: https://air-quality-api.open-meteo.com  — free, no API key required.

Water / noise (ph, turbidity, dissolved_oxygen, noise_level):
  Linear extrapolation from recent DB readings (no free real-time API available).
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import MonitoringStation, PollutionReading
from schemas import ForecastOut
from services.forecasting_engine import fetch_openmeteo_forecast, _linear_forecast
from dependencies import require_officer

router = APIRouter(tags=["Forecast"])

_VALID_POLLUTANTS = {
    "pm25", "pm10", "co2", "no2", "so2", "ozone", "methane", "dust",
    "ph", "turbidity", "dissolved_oxygen", "noise_level",
}


@router.get("/forecast", response_model=ForecastOut)
async def get_forecast(
    station_id: int = Query(...),
    pollutant: str  = Query(default="pm25"),
    steps:     int  = Query(default=12, le=48),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_officer),
):
    """
    Return a short-term forecast for the given station and pollutant.

    pm25 / pm10 / co2 / no2 / so2 / ozone / methane / dust  →  real Open-Meteo Air Quality forecast (ECMWF CAMS)
    ph / turbidity / dissolved_oxygen / noise_level  →  linear extrapolation from DB

    Requires regional_officer or admin role.
    """
    if pollutant not in _VALID_POLLUTANTS:
        pollutant = "pm25"

    # ── Air pollutants: real Open-Meteo forecast ─────────────────────────────
    if pollutant in ("pm25", "pm10", "co2", "no2", "so2", "ozone", "methane", "dust", "aod"):
        station = await db.get(MonitoringStation, station_id)
        if station:
            points = await fetch_openmeteo_forecast(
                station.latitude, station.longitude, pollutant, steps
            )
            if points:
                return ForecastOut(
                    station_id=station_id,
                    pollutant=pollutant,
                    forecast=points,
                )

    # ── Water / noise: linear regression fallback ────────────────────────────
    stmt = (
        select(PollutionReading)
        .where(PollutionReading.station_id == station_id)
        .order_by(PollutionReading.timestamp.desc())
        .limit(30)
    )
    result   = await db.execute(stmt)
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

    forecast_data = _linear_forecast(
        recent_readings=reading_dicts,
        pollutant=pollutant,
        station_id=station_id,
        steps=steps,
    )
    return ForecastOut(**forecast_data)
