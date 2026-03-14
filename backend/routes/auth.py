"""
PrithviNet - Authentication Routes
POST /auth/register  — create a new user
POST /auth/login     — authenticate and receive JWT
GET  /users/me       — return the current authenticated user
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User
from schemas import UserRegisterIn, UserLoginIn, TokenOut, UserOut
from services.auth_service import hash_password, verify_password, create_access_token
from services.groq_verify import verify_industry_coords
from dependencies import get_current_user

router = APIRouter(tags=["Authentication"])


# ──────────────────────────────────────────────
# POST /auth/register
# ──────────────────────────────────────────────

@router.post("/auth/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserRegisterIn,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new user account with a hashed password.
    The very first user registered is automatically promoted to admin.
    Only existing admins can register new admin or regional_officer accounts.
    """
    # Check for duplicate email
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    # Check if this is the first user — auto-promote to admin
    count_result = await db.execute(select(func.count(User.id)))
    user_count = count_result.scalar()

    if user_count == 0:
        assigned_role = "admin"
        approved = True
    else:
        # Only admins can create other admins
        if payload.role.value == "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can assign the admin role.",
            )
        assigned_role = payload.role.value
        # Regional officers and industry users require admin approval; all others auto-approved
        approved = assigned_role not in ("regional_officer", "industry_user")

    # For industry users: verify coordinates via Groq before creating the account
    if assigned_role == "industry_user" and payload.latitude is not None:
        ok, reason = await verify_industry_coords(
            name=payload.industry_name or payload.name,
            location=payload.industry_location or "",
            region=payload.region or "",
            lat=payload.latitude,
            lng=payload.longitude,
            height=payload.height_above_sea_level or 0.0,
        )
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Location verification failed: {reason}",
            )

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=assigned_role,
        region=payload.region,
        industry_name=payload.industry_name,
        industry_location=payload.industry_location,
        latitude=payload.latitude,
        longitude=payload.longitude,
        height_above_sea_level=payload.height_above_sea_level,
        is_approved=approved,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


# ──────────────────────────────────────────────
# POST /auth/login
# ──────────────────────────────────────────────

@router.post("/auth/login", response_model=TokenOut)
async def login(
    payload: UserLoginIn,
    db: AsyncSession = Depends(get_db),
):
    """Verify credentials and return a JWT access token."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="pending_approval",
        )

    token = create_access_token(data={"sub": user.email, "role": user.role})
    return TokenOut(access_token=token, role=user.role)


# ──────────────────────────────────────────────
# GET /users/me
# ──────────────────────────────────────────────

@router.get("/users/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return current_user
