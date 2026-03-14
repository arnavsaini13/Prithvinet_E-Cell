"""
PrithviNet - Main Application Entry Point
FastAPI server with CORS, database init, seed data, auth, and route registration.
"""

import asyncio
import sys
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

# Ensure backend root is on the import path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import init_db, async_session
from models import MonitoringStation, Industry

from routes.auth import router as auth_router
from routes.stations import router as stations_router
from routes.pollution import router as pollution_router
from routes.alerts import router as alerts_router
from routes.forecast import router as forecast_router
from routes.industries import router as industries_router
from services.real_data_fetcher import backfill_historical_data, run_periodic_fetcher
from services.compliance_engine import update_all_compliance_scores, run_periodic_compliance_updater


# ──────────────────────────────────────────────
# Seed data: stations and industries
# ──────────────────────────────────────────────
SEED_STATIONS = [
    {"name": "Delhi Central Station", "latitude": 28.6139, "longitude": 77.2090, "region": "Delhi"},
    {"name": "Mumbai Coastal Station", "latitude": 19.0760, "longitude": 72.8777, "region": "Mumbai"},
    {"name": "Bangalore Tech Park", "latitude": 12.9716, "longitude": 77.5946, "region": "Bangalore"},
    {"name": "Chennai Industrial Zone", "latitude": 13.0827, "longitude": 80.2707, "region": "Chennai"},
    {"name": "Kolkata River Station", "latitude": 22.5726, "longitude": 88.3639, "region": "Kolkata"},
    {"name": "Raipur Industrial Station", "latitude": 21.2514, "longitude": 81.6296, "region": "Raipur"},
]

SEED_INDUSTRIES = [
    {"name": "Tata Steel Works", "location": "Jamshedpur, Jharkhand", "compliance_score": 82.5},
    {"name": "Reliance Refinery", "location": "Jamnagar, Gujarat", "compliance_score": 71.0},
    {"name": "Hindalco Aluminium", "location": "Renukoot, UP", "compliance_score": 65.3},
    {"name": "Vedanta Smelter", "location": "Tuticorin, TN", "compliance_score": 48.9},
    {"name": "ACC Cement Plant", "location": "Wadi, Karnataka", "compliance_score": 90.2},
    {"name": "NTPC Thermal Power", "location": "Singrauli, MP", "compliance_score": 55.7},
]


async def seed_data():
    """Insert seed stations and industries, adding any missing ones."""
    async with async_session() as db:
        # Seed stations — insert any that don't exist yet (by name)
        result = await db.execute(select(MonitoringStation))
        existing_names = {s.name for s in result.scalars().all()}
        new_stations = [s for s in SEED_STATIONS if s["name"] not in existing_names]
        if new_stations:
            for s in new_stations:
                db.add(MonitoringStation(**s))
            await db.commit()
            print(f"  Seeded {len(new_stations)} new monitoring station(s): {[s['name'] for s in new_stations]}")
        else:
            print(f"  All {len(SEED_STATIONS)} monitoring stations already exist.")

        # Seed industries
        result = await db.execute(select(Industry).limit(1))
        if result.scalar_one_or_none() is None:
            for ind in SEED_INDUSTRIES:
                db.add(Industry(**ind))
            await db.commit()
            print(f"  Seeded {len(SEED_INDUSTRIES)} industries.")


# ──────────────────────────────────────────────
# Application lifespan
# ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run setup on startup, cleanup on shutdown."""
    print("Initializing database...")
    await init_db()
    await seed_data()

    # Historical backfill from Open-Meteo (once, idempotent)
    try:
        await backfill_historical_data()
    except Exception as e:
        print(f"  WARNING: Historical backfill failed: {e}")
        print("  The app will continue without historical data.")

    # Start periodic real-data fetcher as background task
    fetcher_task = asyncio.create_task(run_periodic_fetcher())

    # Compute real compliance scores from Open-Meteo on startup
    try:
        async with async_session() as db:
            await update_all_compliance_scores(db)
    except Exception as e:
        print(f"  WARNING: Compliance score update failed: {e}")

    # Start periodic compliance score updater (every 30 min)
    compliance_task = asyncio.create_task(run_periodic_compliance_updater())

    print("PrithviNet backend is ready.")
    yield

    # Cancel background tasks on shutdown
    fetcher_task.cancel()
    compliance_task.cancel()
    for task in (fetcher_task, compliance_task):
        try:
            await task
        except asyncio.CancelledError:
            pass
    print("Shutting down PrithviNet backend.")


# ──────────────────────────────────────────────
# FastAPI app creation
# ──────────────────────────────────────────────
app = FastAPI(
    title="PrithviNet API",
    description="AI-powered environmental monitoring platform backend with JWT auth & RBAC",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow React dev server on localhost:3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",  # Vite dev server
        "http://localhost:5174",  # Vite fallback port
        "http://localhost:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(auth_router)
app.include_router(stations_router)
app.include_router(pollution_router)
app.include_router(alerts_router)
app.include_router(forecast_router)
app.include_router(industries_router)


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "PrithviNet API", "version": "2.0.0"}
