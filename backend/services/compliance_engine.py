"""
PrithviNet - Industry Compliance Engine

Computes environmental compliance scores for each registered industry by
fetching REAL current air quality at that industry's geographic coordinates
from the Open-Meteo Air Quality API (ECMWF CAMS model — free, no API key).

Compliance formula is based on CPCB NAAQS 2009 limits and WHO 2021 guidelines:
  - PM2.5 (CPCB annual: 40 μg/m³  |  WHO 2021: 15 μg/m³)
  - PM10  (CPCB annual: 60 μg/m³)
  - SO2   (CPCB 24h:   80 μg/m³)
  - NO2   (CPCB 24h:   80 μg/m³)
  - EU AQI overall index

Score starts at 100 and deductions are applied for each exceedance.
"""

import asyncio
import logging
from typing import Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = logging.getLogger(__name__)

# ── Real GPS coordinates for each seeded industry ──────────────────────────
# Source: verified plant/facility locations via public records
INDUSTRY_COORDS: dict[str, tuple[float, float]] = {
    "Maruti Suzuki Manesar":   (28.3527, 76.9340),   # Manesar, Haryana (Delhi region)
    "HPCL Mumbai Refinery":    (19.0447, 72.9063),   # Chembur, Mumbai
    "HAL Aerospace Bangalore": (12.9489, 77.6735),   # HAL Area, Bangalore
    "Hyundai Motor Chennai":   (12.7277, 79.9808),   # Sriperumbudur, Chennai
    "CESC Budge Budge Plant":  (22.4742, 88.1676),   # Budge Budge, Kolkata
    "Bhilai Steel Plant":      (21.2091, 81.4277),   # Bhilai, Chhattisgarh (Raipur region)
}

# ── Region center coordinates — fallback for user-registered industries ─────
REGION_COORDS: dict[str, tuple[float, float]] = {
    "Delhi":     (28.6139, 77.2090),
    "Mumbai":    (19.0760, 72.8777),
    "Bangalore": (12.9716, 77.5946),
    "Chennai":   (13.0827, 80.2707),
    "Kolkata":   (22.5726, 88.3639),
    "Raipur":    (21.2514, 81.6296),
}


def _compute_score(pm25: float, pm10: float, so2: float, no2: float, eaqi: float) -> float:
    """
    Compute an environmental compliance score (0–100) from real pollutant levels.

    Deductions are tiered against CPCB NAAQS 2009 limits and WHO 2021 guidelines:
      PM2.5: WHO 15 / CPCB 40  |  PM10: CPCB 60  |  SO2: CPCB 80  |  NO2: CPCB 80
    """
    score = 100.0

    # PM2.5 — WHO 2021 annual guideline 15 μg/m³, CPCB 40 μg/m³
    if pm25 > 60:
        score -= 25
    elif pm25 > 40:
        score -= 18
    elif pm25 > 25:
        score -= 10
    elif pm25 > 15:
        score -= 4

    # PM10 — CPCB 60 μg/m³
    if pm10 > 150:
        score -= 15
    elif pm10 > 100:
        score -= 10
    elif pm10 > 60:
        score -= 5

    # SO2 — CPCB 24h 80 μg/m³; industrial areas have higher SO2
    if so2 > 80:
        score -= 22
    elif so2 > 40:
        score -= 14
    elif so2 > 20:
        score -= 7

    # NO2 — CPCB annual 40 μg/m³
    if no2 > 80:
        score -= 14
    elif no2 > 40:
        score -= 7
    elif no2 > 20:
        score -= 3

    # European AQI as overall indicator
    if eaqi > 200:
        score -= 10
    elif eaqi > 150:
        score -= 5

    return round(max(0.0, min(100.0, score)), 1)


async def fetch_compliance_for_industry(
    name: str,
    latitude: float,
    longitude: float,
) -> Optional[dict]:
    """
    Fetch real-time air quality at the given coordinates from Open-Meteo
    and compute an environmental compliance score.

    Returns:
        dict with keys: pm25, pm10, so2, no2, eaqi, compliance_score, source
        or None if the fetch fails.

    SOURCE: https://air-quality-api.open-meteo.com (ECMWF CAMS — free, no key)
    """
    url = "https://air-quality-api.open-meteo.com/v1/air-quality"
    params = {
        "latitude":  latitude,
        "longitude": longitude,
        "current":   "pm2_5,pm10,sulphur_dioxide,nitrogen_dioxide,european_aqi",
        "timezone":  "auto",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        c = data.get("current", {})
        pm25 = float(c.get("pm2_5",             0) or 0)
        pm10 = float(c.get("pm10",              0) or 0)
        so2  = float(c.get("sulphur_dioxide",   0) or 0)
        no2  = float(c.get("nitrogen_dioxide",  0) or 0)
        eaqi = float(c.get("european_aqi",      0) or 0)

        score = _compute_score(pm25, pm10, so2, no2, eaqi)
        return {
            "pm25":             pm25,
            "pm10":             pm10,
            "so2":              so2,
            "no2":              no2,
            "eaqi":             eaqi,
            "compliance_score": score,
            "source":           "Open-Meteo Air Quality API (ECMWF CAMS)",
        }
    except Exception as exc:
        logger.warning("compliance_engine: failed to fetch AQ for %s: %s", name, exc)
        return None


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
                "Compliance updated: %s → %.1f (PM2.5=%.1f SO2=%.1f)",
                ind.name, data["compliance_score"], data["pm25"], data["so2"],
            )
            updated += 1

    await db.commit()
    logger.info("compliance_engine: updated %d industries.", updated)


async def run_periodic_compliance_updater(interval_seconds: int = 1800) -> None:
    """
    Background task: updates all industry compliance scores every 30 minutes.
    """
    from database import async_session  # local import
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            async with async_session() as db:
                await update_all_compliance_scores(db)
        except Exception as exc:
            logger.error("compliance_engine: periodic update failed: %s", exc)
