"""
PrithviNet - Stations API
CRUD and listing endpoints for monitoring stations.
Access: All authenticated users (citizen+)
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import MonitoringStation
from schemas import StationOut
from dependencies import require_citizen

router = APIRouter(tags=["Stations"])


@router.get("/stations", response_model=list[StationOut])
async def list_stations(
    region: str | None = None,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_citizen),
):
    """Return all monitoring stations, optionally filtered by region."""
    stmt = select(MonitoringStation)
    if region:
        stmt = stmt.where(MonitoringStation.region == region)
    result = await db.execute(stmt)
    return result.scalars().all()
