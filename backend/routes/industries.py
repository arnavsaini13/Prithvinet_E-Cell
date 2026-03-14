"""
PrithviNet - Industries API
Endpoints for tracking industry pollution compliance.
Access: industry_user+ (compliance APIs)
"""

import asyncio

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Industry
from schemas import IndustryOut, EnrichedIndustryOut
from dependencies import require_industry
from services.compliance_engine import INDUSTRY_COORDS, fetch_compliance_for_industry

router = APIRouter(tags=["Industries"])


@router.get("/industries", response_model=list[IndustryOut])
async def list_industries(
    min_compliance: float | None = Query(default=None, ge=0, le=100),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_industry),
):
    """
    List all registered industries with their latest compliance score.
    Requires industry_user, regional_officer, or admin role.
    """
    stmt = select(Industry).order_by(Industry.compliance_score.asc())

    if min_compliance is not None:
        stmt = stmt.where(Industry.compliance_score <= min_compliance)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/industries/enriched", response_model=list[EnrichedIndustryOut])
async def list_industries_enriched(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_industry),
):
    """
    List all industries enriched with LIVE air quality metrics fetched in real-time
    from Open-Meteo Air Quality API (ECMWF CAMS model — free, no API key).

    Returns PM2.5, PM10, SO2, NO2, European AQI, and compliance score at each
    industry's actual geographic location.

    SOURCE: air-quality-api.open-meteo.com
    """
    result = await db.execute(select(Industry))
    industries = result.scalars().all()

    async def enrich(ind: Industry) -> dict | None:
        coords = INDUSTRY_COORDS.get(ind.name)
        if not coords:
            return None
        lat, lng = coords
        data = await fetch_compliance_for_industry(ind.name, lat, lng)
        if not data:
            # Fallback: return stored score with zeros for live metrics
            data = {
                "pm25": 0, "pm10": 0, "so2": 0, "no2": 0, "eaqi": 0,
                "compliance_score": ind.compliance_score,
                "source": "Stored (live fetch unavailable)",
            }
        return {
            "id":               ind.id,
            "name":             ind.name,
            "location":         ind.location,
            "latitude":         lat,
            "longitude":        lng,
            "compliance_score": data["compliance_score"],
            "pm25":             data["pm25"],
            "pm10":             data["pm10"],
            "so2":              data["so2"],
            "no2":              data["no2"],
            "eaqi":             data["eaqi"],
            "source":           data["source"],
        }

    results = await asyncio.gather(*[enrich(ind) for ind in industries])
    enriched = [r for r in results if r is not None]
    # Sort: lowest compliance first (most concerning at top)
    enriched.sort(key=lambda x: x["compliance_score"])
    return enriched
