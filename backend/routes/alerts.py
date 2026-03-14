"""
PrithviNet - Alerts API
Endpoints for querying environmental alerts.
Access: regional_officer+ (compliance monitoring)
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Alert
from schemas import AlertOut
from dependencies import require_officer

router = APIRouter(tags=["Alerts"])


@router.get("/alerts", response_model=list[AlertOut])
async def list_alerts(
    station_id: int | None = None,
    severity: str | None = None,
    limit: int = Query(default=50, le=500),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_officer),
):
    """
    Fetch recent alerts, optionally filtered by station and severity.
    Requires regional_officer or admin role.
    """
    stmt = select(Alert).order_by(Alert.timestamp.desc()).limit(limit)

    if station_id is not None:
        stmt = stmt.where(Alert.station_id == station_id)
    if severity is not None:
        stmt = stmt.where(Alert.severity == severity)

    result = await db.execute(stmt)
    return result.scalars().all()
