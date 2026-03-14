"""
PrithviNet - Industries API
Endpoints for tracking industry pollution compliance.
Access: industry_user+ (compliance APIs)
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Industry
from schemas import IndustryOut
from dependencies import require_industry

router = APIRouter(tags=["Industries"])


@router.get("/industries", response_model=list[IndustryOut])
async def list_industries(
    min_compliance: float | None = Query(default=None, ge=0, le=100),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_industry),
):
    """
    List all registered industries.
    Requires industry_user, regional_officer, or admin role.
    """
    stmt = select(Industry).order_by(Industry.compliance_score.asc())

    if min_compliance is not None:
        stmt = stmt.where(Industry.compliance_score <= min_compliance)

    result = await db.execute(stmt)
    return result.scalars().all()
