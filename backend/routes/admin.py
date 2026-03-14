"""
PrithviNet - Admin Routes
GET  /admin/pending-users      — list pending regional officer registrations
POST /admin/users/{id}/approve — approve a pending user
POST /admin/users/{id}/reject  — reject (delete) a pending user

All routes require admin JWT.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, Industry
from schemas import PendingUserOut
from dependencies import get_current_user
from services.compliance_engine import INDUSTRY_COORDS, REGION_COORDS

router = APIRouter(prefix="/admin", tags=["Admin"])


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


@router.get("/pending-users", response_model=list[PendingUserOut])
async def list_pending_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(_require_admin),
):
    """Return all users with is_approved=False (pending regional officers)."""
    result = await db.execute(
        select(User).where(User.is_approved == False)  # noqa: E712
    )
    return result.scalars().all()


@router.post("/users/{user_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
async def approve_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(_require_admin),
):
    """Approve a pending user — allows them to log in.
    For industry_user accounts, also creates an Industry record so their
    facility appears in regional officers' IndustrialView.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_approved = True

    # If this is an industry user, register their facility in the industries table
    if user.role == "industry_user" and user.industry_name:
        existing = await db.execute(
            select(Industry).where(Industry.name == user.industry_name)
        )
        if existing.scalar_one_or_none() is None:
            # Use known coords if available, fall back to region center
            coords = INDUSTRY_COORDS.get(user.industry_name) or REGION_COORDS.get(user.region or "", (21.0, 78.0))
            lat, lng = coords
            industry = Industry(
                name=user.industry_name,
                location=user.industry_location or "",
                region=user.region or "",
                compliance_score=75.0,
                latitude=lat,
                longitude=lng,
            )
            db.add(industry)

    await db.commit()


@router.post("/users/{user_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
async def reject_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(_require_admin),
):
    """Reject and delete a pending regional officer registration."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await db.delete(user)
    await db.commit()
