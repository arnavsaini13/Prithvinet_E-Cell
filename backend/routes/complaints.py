"""
PrithviNet - Citizen Complaints API
Endpoints for citizens to report anti-environmental activities
(illegal tree felling, dumping, etc.) with photo + text evidence.
Access: any authenticated user (citizen+)
"""

import base64

from fastapi import APIRouter, Depends, Form, UploadFile, File, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Complaint
from schemas import ComplaintOut
from dependencies import get_current_user, require_citizen

router = APIRouter(tags=["Complaints"])


@router.post("/complaints", response_model=ComplaintOut, status_code=201)
async def submit_complaint(
    title: str = Form(...),
    description: str = Form(...),
    location: str | None = Form(default=None),
    photo: UploadFile | None = File(default=None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_citizen),
):
    """
    Submit an environmental violation complaint.
    Accepts title, description, optional location string, and optional photo.
    The photo is stored as base64 in the database.
    """
    photo_data = None
    photo_filename = None
    if photo and photo.filename:
        content_type = photo.content_type or ""
        if not content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file must be an image (jpeg, png, etc.)",
            )
        content = await photo.read()
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Photo must be smaller than 5 MB",
            )
        photo_data = base64.b64encode(content).decode("utf-8")
        photo_filename = photo.filename

    complaint = Complaint(
        user_id=current_user.id,
        title=title,
        description=description,
        location=location,
        photo_data=photo_data,
        photo_filename=photo_filename,
    )
    db.add(complaint)
    await db.commit()
    await db.refresh(complaint)
    return complaint


@router.get("/complaints", response_model=list[ComplaintOut])
async def list_complaints(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    List complaints.
    Citizens see only their own; admin / regional_officer see all.
    """
    if current_user.role == "citizen":
        stmt = (
            select(Complaint)
            .where(Complaint.user_id == current_user.id)
            .order_by(Complaint.created_at.desc())
        )
    else:
        stmt = select(Complaint).order_by(Complaint.created_at.desc())

    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/complaints/{complaint_id}/status", response_model=ComplaintOut)
async def update_complaint_status(
    complaint_id: int,
    status: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Update complaint status (admin / regional_officer only).
    Valid statuses: pending, under_review, resolved.
    """
    from fastapi import HTTPException
    if current_user.role not in ("admin", "regional_officer"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    result = await db.execute(select(Complaint).where(Complaint.id == complaint_id))
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    valid_statuses = {"pending", "under_review", "resolved"}
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    complaint.status = status
    await db.commit()
    await db.refresh(complaint)
    return complaint
