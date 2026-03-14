"""
PrithviNet — Regional Officer Routes
GET /regional/ai-alerts  — Gemini AI analysis for the officer's region
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import MonitoringStation, PollutionReading, User
from dependencies import get_current_user
from services.risk_engine import calculate_risk_score
from services.gemini_service import generate_environmental_alerts

router = APIRouter(prefix="/regional", tags=["Regional"])


def _require_officer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("admin", "regional_officer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Regional officer access required",
        )
    return current_user


@router.get("/ai-alerts")
async def get_ai_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_officer),
):
    """
    Fetch the latest sensor reading for the officer's region,
    compute risk scores, and call Gemini to generate actionable alerts.
    """
    region = current_user.region
    if not region:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account has no region assigned. Contact an admin.",
        )

    # 1. Find the monitoring station for this region
    stmt = select(MonitoringStation).where(MonitoringStation.region == region).limit(1)
    result = await db.execute(stmt)
    station = result.scalar_one_or_none()
    if station is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No monitoring station found for region: {region}",
        )

    # 2. Fetch the most recent pollution reading for that station
    reading_stmt = (
        select(PollutionReading)
        .where(PollutionReading.station_id == station.id)
        .order_by(PollutionReading.timestamp.desc())
        .limit(1)
    )
    reading_result = await db.execute(reading_stmt)
    reading = reading_result.scalar_one_or_none()
    if reading is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pollution readings available for this region yet.",
        )

    # 3. Calculate risk scores
    reading_dict = {
        "pm25": reading.pm25,
        "pm10": reading.pm10,
        "co2": reading.co2,
        "no2": reading.no2,
        "ph": reading.ph,
        "turbidity": reading.turbidity,
        "dissolved_oxygen": reading.dissolved_oxygen,
        "noise_level": reading.noise_level,
    }
    risk = calculate_risk_score(reading_dict)

    # 4. Build full data payload for Gemini
    station_data = {
        **reading_dict,
        "overall_risk": risk["overall_risk"],
        "risk_level": risk["risk_level"],
    }

    # 5. Call AI analysis
    try:
        alerts = await generate_environmental_alerts(region, station.name, station_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except Exception as e:
        err_str = str(e)
        if "429" in err_str or "rate_limit" in err_str.lower() or "quota" in err_str.lower():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI API rate limit reached. Groq free tier allows 30 requests/minute. Please wait a moment and try again.",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI analysis error: {err_str}",
        )

    return alerts
