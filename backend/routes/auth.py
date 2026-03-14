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
    else:
        # Only admins can create other admins
        if payload.role.value == "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can assign the admin role.",
            )
        assigned_role = payload.role.value

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=assigned_role,
        region=payload.region,
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

    token = create_access_token(data={"sub": user.email, "role": user.role})
    return TokenOut(access_token=token, role=user.role)


# ──────────────────────────────────────────────
# GET /users/me
# ──────────────────────────────────────────────

@router.get("/users/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return current_user
