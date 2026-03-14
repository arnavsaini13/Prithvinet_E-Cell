"""
PrithviNet - Industry Warnings Routes

POST /officer/warnings             — regional officer issues a warning to an industry
GET  /industry/warnings            — industry user views their warnings
PATCH /industry/warnings/{id}/read — industry user marks a warning as read
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Industry, IndustryWarning, User
from schemas import IndustryWarningCreate, IndustryWarningOut
from dependencies import require_officer, require_industry_user

router = APIRouter(tags=["Warnings"])


@router.post("/officer/warnings", response_model=IndustryWarningOut, status_code=status.HTTP_201_CREATED)
async def issue_warning(
    payload: IndustryWarningCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_officer),
):
    """Regional officer issues a formal warning to an industry in their region."""
    # Verify the industry exists
    result = await db.execute(select(Industry).where(Industry.id == payload.industry_id))
    industry = result.scalar_one_or_none()
    if industry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Industry not found")

    # Officers can only warn industries in their own region
    if current_user.role == "regional_officer" and current_user.region:
        if industry.region != current_user.region:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This industry is in region '{industry.region}', not your region '{current_user.region}'",
            )

    severity = payload.severity.lower()
    if severity not in ("low", "medium", "high", "critical"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="severity must be low/medium/high/critical")

    warning = IndustryWarning(
        industry_id=payload.industry_id,
        officer_name=current_user.name,
        message=payload.message,
        severity=severity,
    )
    db.add(warning)
    await db.commit()
    await db.refresh(warning)
    return warning


@router.get("/industry/warnings", response_model=list[IndustryWarningOut])
async def get_my_warnings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_industry_user),
):
    """Industry user retrieves all warnings issued to their registered facility."""
    if not current_user.industry_name:
        return []

    # Find the Industry record linked to this user
    result = await db.execute(
        select(Industry).where(
            Industry.name == current_user.industry_name,
            Industry.region == (current_user.region or ""),
        )
    )
    industry = result.scalar_one_or_none()
    if industry is None:
        return []

    result = await db.execute(
        select(IndustryWarning)
        .where(IndustryWarning.industry_id == industry.id)
        .order_by(IndustryWarning.is_read.asc(), IndustryWarning.created_at.desc())
    )
    return result.scalars().all()


@router.patch("/industry/warnings/{warning_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_warning_read(
    warning_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_industry_user),
):
    """Industry user marks a specific warning as read."""
    result = await db.execute(select(IndustryWarning).where(IndustryWarning.id == warning_id))
    warning = result.scalar_one_or_none()
    if warning is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warning not found")

    # Ensure the warning belongs to this user's industry
    ind_result = await db.execute(
        select(Industry).where(
            Industry.id == warning.industry_id,
            Industry.name == current_user.industry_name,
        )
    )
    if ind_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your warning")

    warning.is_read = True
    await db.commit()
