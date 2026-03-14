"""
PrithviNet - Pollution Data API
Endpoints for querying pollution readings, submitting sensor data,
and generating heatmap payloads.

Access matrix:
  /pollution-data  → citizen+   (public monitoring)
  /sensor-data     → NO AUTH    (IoT simulator posts — machine-to-machine)
  /heatmap-data    → citizen+   (public monitoring)
  /risk-score      → officer+   (regional analytics)
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import PollutionReading, MonitoringStation
from schemas import SensorDataIn, PollutionReadingOut, HeatmapPoint, RiskScoreOut
from services.alert_engine import check_and_create_alerts
from services.risk_engine import calculate_risk_score
from dependencies import require_citizen, require_officer

router = APIRouter(tags=["Pollution"])


@router.get("/pollution-data", response_model=list[PollutionReadingOut])
async def get_pollution_data(
    station_id: int | None = None,
    limit: int = Query(default=50, le=500),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_citizen),
):
    """Fetch recent pollution readings, optionally for a specific station."""
    stmt = (
        select(PollutionReading)
        .order_by(PollutionReading.timestamp.desc())
        .limit(limit)
    )
    if station_id is not None:
        stmt = stmt.where(PollutionReading.station_id == station_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/sensor-data", response_model=PollutionReadingOut)
async def ingest_sensor_data(
    payload: SensorDataIn,
    db: AsyncSession = Depends(get_db),
):
    """
    Receive a sensor reading from the IoT simulator.
    No auth required — this is a machine-to-machine endpoint.
    """
    reading = PollutionReading(**payload.model_dump())
    db.add(reading)
    await db.flush()
    await db.refresh(reading)

    # Run alert engine on the new reading
    await check_and_create_alerts(db, payload.station_id, payload.model_dump())

    await db.commit()
    await db.refresh(reading)
    return reading


@router.get("/heatmap-data", response_model=list[HeatmapPoint])
async def get_heatmap_data(
    pollutant: str = Query(default="pm25"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_citizen),
):
    """
    Return the latest reading per station formatted for a map heatmap layer.
    """
    valid_pollutants = {
        "pm25", "pm10", "co2", "no2", "ph", "turbidity",
        "dissolved_oxygen", "noise_level",
    }
    if pollutant not in valid_pollutants:
        pollutant = "pm25"

    latest_sq = (
        select(
            PollutionReading.station_id,
            func.max(PollutionReading.id).label("max_id"),
        )
        .group_by(PollutionReading.station_id)
        .subquery()
    )

    stmt = (
        select(MonitoringStation, PollutionReading)
        .join(latest_sq, MonitoringStation.id == latest_sq.c.station_id)
        .join(PollutionReading, PollutionReading.id == latest_sq.c.max_id)
    )

    result = await db.execute(stmt)
    rows = result.all()

    points = []
    for station, reading in rows:
        points.append(HeatmapPoint(
            latitude=station.latitude,
            longitude=station.longitude,
            intensity=getattr(reading, pollutant, 0),
            pollutant=pollutant,
        ))
    return points


@router.get("/risk-score", response_model=list[RiskScoreOut])
async def get_risk_scores(
    station_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_officer),
):
    """Calculate environmental risk scores. Requires regional_officer+."""
    latest_sq = (
        select(
            PollutionReading.station_id,
            func.max(PollutionReading.id).label("max_id"),
        )
        .group_by(PollutionReading.station_id)
        .subquery()
    )

    stmt = (
        select(MonitoringStation, PollutionReading)
        .join(latest_sq, MonitoringStation.id == latest_sq.c.station_id)
        .join(PollutionReading, PollutionReading.id == latest_sq.c.max_id)
    )

    if station_id is not None:
        stmt = stmt.where(MonitoringStation.id == station_id)

    result = await db.execute(stmt)
    rows = result.all()

    scores = []
    for station, reading in rows:
        reading_dict = {
            "pm25": reading.pm25, "pm10": reading.pm10,
            "co2": reading.co2, "no2": reading.no2,
            "ph": reading.ph, "turbidity": reading.turbidity,
            "dissolved_oxygen": reading.dissolved_oxygen,
            "noise_level": reading.noise_level,
        }
        risk = calculate_risk_score(reading_dict)
        scores.append(RiskScoreOut(
            station_id=station.id,
            station_name=station.name,
            **risk,
        ))
    return scores
