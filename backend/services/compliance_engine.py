"""
PrithviNet - Industry Compliance Engine

PRIMARY SOURCE: WAQI (World Air Quality Index) — aqicn.org
  Real ground-level measurements from physical CPCB monitoring stations across India.
  Each station is at a precise GPS location, so different cities/districts give
  genuinely different readings unlike coarse atmospheric models.
  Free token: https://aqicn.org/data-platform/token/
  Set WAQI_TOKEN in backend/.env (default "demo" works for testing).

FALLBACK SOURCE: Open-Meteo Air Quality API (ECMWF CAMS global model)
  Used when no WAQI station is reachable or the API fails.
  Resolution: ~0.4° (~44 km grid) — nearby facilities in the same city may share readings.

Compliance formula (CPCB NAAQS 2009 + WHO 2021 guidelines):
  PM2.5 (CPCB annual: 40 μg/m³ | WHO 2021: 15 μg/m³)
  PM10  (CPCB annual: 60 μg/m³)
  SO2   (CPCB 24h:   80 μg/m³)
  NO2   (CPCB 24h:   80 μg/m³)
  AQI   overall index
"""

import asyncio
import logging
import os
import time
from typing import Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = logging.getLogger(__name__)

WAQI_TOKEN = os.getenv("WAQI_TOKEN", "demo")

# ── Real GPS coordinates for each seeded industry ──────────────────────────
INDUSTRY_COORDS: dict[str, tuple[float, float]] = {
    "Maruti Suzuki Manesar":   (28.3527, 76.9340),
    "HPCL Mumbai Refinery":    (19.0447, 72.9063),
    "HAL Aerospace Bangalore": (12.9489, 77.6735),
    "Hyundai Motor Chennai":   (12.7277, 79.9808),
    "CESC Budge Budge Plant":  (22.4742, 88.1676),
    "Bhilai Steel Plant":      (21.2091, 81.4277),
}

# ── Region centre coordinates — fallback for user-registered industries ─────
REGION_COORDS: dict[str, tuple[float, float]] = {
    "Delhi":     (28.6139, 77.2090),
    "Mumbai":    (19.0760, 72.8777),
    "Bangalore": (12.9716, 77.5946),
    "Chennai":   (13.0827, 80.2707),
    "Kolkata":   (22.5726, 88.3639),
    "Raipur":    (21.2514, 81.6296),
}

# ── Simple in-memory result cache (avoids duplicate API calls) ───────────────
# Key: "lat2dp,lng2dp" (rounded to 2 decimal places ≈ 1.1 km)
# Value: (result_dict, unix_timestamp)
_result_cache: dict[str, tuple[dict, float]] = {}
CACHE_TTL = 1800  # 30 minutes


def _cache_key(lat: float, lng: float) -> str:
    return f"{round(lat, 2)},{round(lng, 2)}"


def _compute_score(pm25: float, pm10: float, so2: float, no2: float, aqi: float) -> float:
    """
    Compute environmental compliance score (0–100).
    Deductions against CPCB NAAQS 2009 and WHO 2021 guidelines.
    """
    score = 100.0

    if pm25 > 60:   score -= 25
    elif pm25 > 40: score -= 18
    elif pm25 > 25: score -= 10
    elif pm25 > 15: score -= 4

    if pm10 > 150:  score -= 15
    elif pm10 > 100: score -= 10
    elif pm10 > 60: score -= 5

    if so2 > 80:    score -= 22
    elif so2 > 40:  score -= 14
    elif so2 > 20:  score -= 7

    if no2 > 80:    score -= 14
    elif no2 > 40:  score -= 7
    elif no2 > 20:  score -= 3

    if aqi > 200:   score -= 10
    elif aqi > 150: score -= 5

    return round(max(0.0, min(100.0, score)), 1)


async def _fetch_waqi(name: str, lat: float, lng: float) -> Optional[dict]:
    """
    Fetch real-time air quality from the nearest CPCB/WAQI monitoring station.

    WAQI (World Air Quality Index) aggregates data from physical ground sensors
    including CPCB's continuous ambient air quality monitoring stations (CAAQMS)
    across India. Each station is at a distinct precise location.

    Free token: https://aqicn.org/data-platform/token/
    """
    url = f"https://api.waqi.info/feed/geo:{lat};{lng}/"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params={"token": WAQI_TOKEN})
            resp.raise_for_status()
            data = resp.json()

        if data.get("status") != "ok":
            logger.debug("WAQI returned status=%s for %s", data.get("status"), name)
            return None

        d = data["data"]
        iaqi = d.get("iaqi", {})

        pm25 = float(iaqi.get("pm25", {}).get("v", 0) or 0)
        pm10 = float(iaqi.get("pm10", {}).get("v", 0) or 0)
        so2  = float(iaqi.get("so2",  {}).get("v", 0) or 0)
        no2  = float(iaqi.get("no2",  {}).get("v", 0) or 0)
        aqi  = float(d.get("aqi", 0) or 0)

        station = d.get("city", {}).get("name", "unknown station")
        score = _compute_score(pm25, pm10, so2, no2, aqi)

        return {
            "pm25": pm25, "pm10": pm10, "so2": so2, "no2": no2, "eaqi": aqi,
            "compliance_score": score,
            "source": f"WAQI/CPCB — {station}",
        }
    except Exception as exc:
        logger.warning("WAQI fetch failed for %s: %s", name, exc)
        return None


async def _fetch_openmeteo(name: str, lat: float, lng: float) -> Optional[dict]:
    """
    Fallback: open-meteo CAMS global model (~44 km grid resolution).
    Used when no WAQI station is reachable.
    """
    url = "https://air-quality-api.open-meteo.com/v1/air-quality"
    params = {
        "latitude":  lat,
        "longitude": lng,
        "current":   "pm2_5,pm10,sulphur_dioxide,nitrogen_dioxide,european_aqi",
        "timezone":  "auto",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        c = data.get("current", {})
        pm25 = float(c.get("pm2_5",           0) or 0)
        pm10 = float(c.get("pm10",            0) or 0)
        so2  = float(c.get("sulphur_dioxide", 0) or 0)
        no2  = float(c.get("nitrogen_dioxide",0) or 0)
        eaqi = float(c.get("european_aqi",    0) or 0)

        score = _compute_score(pm25, pm10, so2, no2, eaqi)
        return {
            "pm25": pm25, "pm10": pm10, "so2": so2, "no2": no2, "eaqi": eaqi,
            "compliance_score": score,
            "source": "Open-Meteo CAMS (fallback — ~44 km grid)",
        }
    except Exception as exc:
        logger.warning("Open-Meteo fetch failed for %s: %s", name, exc)
        return None


async def fetch_compliance_for_industry(
    name: str,
    latitude: float,
    longitude: float,
) -> Optional[dict]:
    """
    Fetch real-time air quality and compute compliance score.

    Strategy:
      1. Check in-memory cache (30 min TTL, 1.1 km grid)
      2. Try WAQI — real CPCB station data (most precise)
      3. Fall back to Open-Meteo CAMS model if WAQI unavailable
    """
    key = _cache_key(latitude, longitude)

    # Serve from cache if fresh
    if key in _result_cache:
        cached, ts = _result_cache[key]
        if time.time() - ts < CACHE_TTL:
            return {**cached, "source": cached["source"] + " (cached)"}

    result = await _fetch_waqi(name, latitude, longitude)
    if not result:
        result = await _fetch_openmeteo(name, latitude, longitude)

    if result:
        _result_cache[key] = (result, time.time())

    return result


async def update_all_compliance_scores(db: AsyncSession) -> None:
    """
    Update compliance_score for every industry that has valid coordinates.
    Called on startup and every 30 minutes.
    """
    from models import Industry  # local import to avoid circular
    result = await db.execute(select(Industry))
    industries = result.scalars().all()

    updated = 0
    for ind in industries:
        if ind.latitude == 0.0 and ind.longitude == 0.0:
            continue
        data = await fetch_compliance_for_industry(ind.name, ind.latitude, ind.longitude)
        if data:
            ind.compliance_score = data["compliance_score"]
            logger.info(
                "Compliance updated: %s → %.1f (PM2.5=%.1f, src=%s)",
                ind.name, data["compliance_score"], data["pm25"], data["source"],
            )
            updated += 1

    await db.commit()
    logger.info("compliance_engine: updated %d industries.", updated)


async def run_periodic_compliance_updater(interval_seconds: int = 1800) -> None:
    """Background task: updates all industry compliance scores every 30 minutes."""
    from database import async_session  # local import
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            async with async_session() as db:
                await update_all_compliance_scores(db)
        except Exception as exc:
            logger.error("compliance_engine: periodic update failed: %s", exc)
