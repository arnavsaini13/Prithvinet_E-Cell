"""
PrithviNet - Database Configuration
PostgreSQL connection setup using SQLAlchemy async engine.
"""

import os
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:Arnav%40132006@localhost:5432/prithvinet"
)

# Convert postgres:// or postgresql:// to the asyncpg driver scheme
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# asyncpg does not accept sslmode/channel_binding as URL params — strip them
# and pass ssl via connect_args instead
_parsed = urlparse(DATABASE_URL)
_params = parse_qs(_parsed.query, keep_blank_values=True)
_ssl_required = _params.pop("sslmode", [""])[0] == "require"
_params.pop("channel_binding", None)
DATABASE_URL = urlunparse(_parsed._replace(query=urlencode({k: v[0] for k, v in _params.items()})))

connect_args = {"ssl": "require"} if _ssl_required else {}

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True, connect_args=connect_args)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency that yields a database session."""
    async with async_session() as session:
        yield session


async def init_db():
    """Create all tables on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
