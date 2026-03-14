"""
PrithviNet - Authentication & RBAC Dependencies
FastAPI dependencies for JWT verification and role-based access control.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User
from services.auth_service import decode_access_token

# ---------------------------------------------------------------------------
# Bearer token extractor
# ---------------------------------------------------------------------------

bearer_scheme = HTTPBearer()

# ---------------------------------------------------------------------------
# Core dependency: extract and validate the current user from JWT
# ---------------------------------------------------------------------------


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Decode the JWT from the Authorization header, look up the user,
    and return the ORM object.  Raises 401 on any failure.
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email: str | None = payload.get("sub")
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


# ---------------------------------------------------------------------------
# Role-based access factories
# ---------------------------------------------------------------------------

def require_roles(*allowed_roles: str):
    """
    Returns a FastAPI dependency that permits only users whose role
    is in the allowed list.

    Usage in a route:
        @router.get("/admin-only", dependencies=[Depends(require_roles("admin"))])

    Or inject the user:
        async def endpoint(user: User = Depends(require_roles("admin", "regional_officer"))):
    """

    async def _role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not authorized. Required: {', '.join(allowed_roles)}",
            )
        return current_user

    return _role_checker


# ---------------------------------------------------------------------------
# Convenience shortcuts for each role tier
# ---------------------------------------------------------------------------

# Admin — full access
require_admin = require_roles("admin")

# Regional Officer — regional analytics + everything below
require_officer = require_roles("admin", "regional_officer")

# Industry User — compliance data + public
require_industry = require_roles("admin", "regional_officer", "industry_user")

# Industry User only — for endpoints exclusive to the industry_user role
require_industry_user = require_roles("industry_user")

# Citizen — public monitoring (any authenticated user)
require_citizen = require_roles("admin", "regional_officer", "industry_user", "citizen")
