"""
PrithviNet - Real Data Fetcher
================================
Replaces the IoT sensor simulator with real air quality data from
the Open-Meteo Air Quality API (free, no API key required).

Air quality (PM2.5, PM10, CO2, NO2): REAL data from Open-Meteo
Water quality (pH, turbidity, dissolved_oxygen) & noise: Estimated
from air pollution severity + per-station environmental profiles.

Features:
  - Historical backfill: 7 days of hourly data on startup (~840 rows)
  - Periodic fetch: latest readings every 15 minutes
  - Alert engine integration: thresholds checked on each new reading
  - Idempotent backfill: skips if data already exists
  - Graceful error handling for network failures
"""

import asyncio
import math
import random
from datetime import datetime

import httpx

# ---------------------------------------------------------------------------
# Station profiles — coordinates + water/noise baselines for estimation
# (Baselines reused from the original sensor_simulator.py)
# ---------------------------------------------------------------------------

STATIONS = [
    {
        "id": 1,
        "name": "Delhi Central",
        "latitude": 28.6139,
        "longitude": 77.2090,
        "profile": "heavy_urban",
        "water_baselines": {
            "ph": (6.8, 7.4),
            "turbidity": (2.0, 5.0),
            "dissolved_oxygen": (5.5, 7.0),
        },
        "noise_baselines": (55, 75),
        "acid_sensitivity": 1.0,
    },
    {
        "id": 2,
        "name": "Mumbai Coastal",
        "latitude": 19.0760,
        "longitude": 72.8777,
        "profile": "coastal",
        "water_baselines": {
            "ph": (7.5, 8.2),
            "turbidity": (1.0, 3.0),
            "dissolved_oxygen": (7.0, 9.0),
        },
        "noise_baselines": (40, 60),
        "acid_sensitivity": 0.5,
    },
    {
        "id": 3,
        "name": "Bangalore Tech",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "profile": "suburban",
        "water_baselines": {
            "ph": (6.9, 7.5),
            "turbidity": (0.8, 2.5),
            "dissolved_oxygen": (7.0, 8.5),
        },
        "noise_baselines": (35, 55),
        "acid_sensitivity": 0.6,
    },
    {
        "id": 4,
        "name": "Chennai Industrial",
        "latitude": 13.0827,
        "longitude": 80.2707,
        "profile": "industrial",
        "water_baselines": {
            "ph": (5.8, 7.0),
            "turbidity": (3.0, 8.0),
            "dissolved_oxygen": (4.5, 6.5),
        },
        "noise_baselines": (60, 82),
        "acid_sensitivity": 1.4,
    },
    {
        "id": 5,
        "name": "Kolkata River",
        "latitude": 22.5726,
        "longitude": 88.3639,
        "profile": "riverine",
        "water_baselines": {
            "ph": (6.5, 7.6),
            "turbidity": (4.0, 10.0),
            "dissolved_oxygen": (5.0, 7.5),
        },
        "noise_baselines": (45, 65),
        "acid_sensitivity": 0.9,
    },
    {
        "id": 6,
        "name": "Raipur Industrial",
        "latitude": 21.2514,
        "longitude": 81.6296,
        "profile": "industrial",
        "water_baselines": {
            "ph": (5.9, 7.1),
            "turbidity": (3.5, 9.0),
            "dissolved_oxygen": (4.0, 6.0),
        },
        "noise_baselines": (58, 80),
        "acid_sensitivity": 1.3,
    },
]

FETCH_INTERVAL_SECONDS = 15 * 60  # 15 minutes


# ---------------------------------------------------------------------------
# Open-Meteo API client
# ---------------------------------------------------------------------------

async def fetch_open_meteo_air_quality(
    client: httpx.AsyncClient,
    latitude: float,
    longitude: float,
    past_days: int = 0,
    forecast_days: int = 0,
    current: bool = False,
) -> dict | None:
    """
    Fetch air quality data from Open-Meteo.
    If current=True, fetches the latest reading.
    If past_days/forecast_days > 0, fetches hourly history/forecast.
    Returns raw JSON dict or None on failure.
    """
    url = "https://air-quality-api.open-meteo.com/v1/air-quality"
    params: dict = {
        "latitude": latitude,
        "longitude": longitude,
        "timezone": "auto",
    }
    if current:
        params["current"] = "pm10,pm2_5,carbon_dioxide,nitrogen_dioxide"
    else:
        params["hourly"] = "pm10,pm2_5,carbon_dioxide,nitrogen_dioxide"
        params["past_days"] = past_days
        params["forecast_days"] = forecast_days

    try:
        resp = await client.get(url, params=params, timeout=15.0)
        resp.raise_for_status()
        return resp.json()
    except (httpx.RequestError, httpx.HTTPStatusError) as e:
        print(f"  [RealDataFetcher] Open-Meteo error for ({latitude},{longitude}): {e}")
        return None


# ---------------------------------------------------------------------------
# Water quality & noise estimation from real air data
# ---------------------------------------------------------------------------

def _time_of_day_factor(hour: int) -> float:
    """Returns 0.7-1.35 multiplier. Peaks at 08:00 and 18:00, lowest ~03:00."""
    morning = math.exp(-0.5 * ((hour - 8) / 2.5) ** 2)
    evening = math.exp(-0.5 * ((hour - 18) / 2.5) ** 2)
    return min(0.7 + 0.6 * max(morning, evening), 1.35)


def _air_pollution_severity(pm25: float, pm10: float, co2: float, no2: float) -> float:
    """Returns 0-1 severity score based on how bad the air quality is."""
    pm25_s = min(pm25 / 250.0, 1.0)
    pm10_s = min(pm10 / 430.0, 1.0)
    co2_s = min(co2 / 2000.0, 1.0)
    no2_s = min(no2 / 180.0, 1.0)
    return pm25_s * 0.4 + pm10_s * 0.3 + no2_s * 0.2 + co2_s * 0.1


def estimate_water_and_noise(
    station: dict,
    pm25: float, pm10: float, co2: float, no2: float,
    hour: int | None = None,
) -> dict:
    """
    Derive water quality + noise from real air data and station profile.
    Higher air pollution severity -> worse water and higher noise.
    """
    severity = _air_pollution_severity(pm25, pm10, co2, no2)
    wb = station["water_baselines"]

    # --- pH: midpoint shifted down by severity * acid_sensitivity ---
    ph_low, ph_high = wb["ph"]
    base_ph = (ph_low + ph_high) / 2
    acid_shift = severity * 1.5 * station["acid_sensitivity"]
    ph = base_ph - acid_shift + random.gauss(0, 0.1)
    ph = max(2.0, min(12.0, round(ph, 2)))

    # --- Turbidity: interpolated by severity, boosted for industrial/riverine ---
    turb_low, turb_high = wb["turbidity"]
    turbidity = turb_low + (turb_high - turb_low) * (0.3 + 0.7 * severity)
    if station["profile"] in ("industrial", "riverine"):
        turbidity *= 1.0 + severity * 0.5
    turbidity += random.gauss(0, turbidity * 0.05)
    turbidity = max(0.1, round(turbidity, 2))

    # --- Dissolved Oxygen: inversely correlated with severity ---
    do_low, do_high = wb["dissolved_oxygen"]
    dissolved_oxygen = do_high - (do_high - do_low) * severity
    dissolved_oxygen += random.gauss(0, 0.2)
    dissolved_oxygen = max(0.5, round(dissolved_oxygen, 2))

    # --- Noise: interpolated by severity + time-of-day modulation ---
    noise_low, noise_high = station["noise_baselines"]
    noise = noise_low + (noise_high - noise_low) * (0.3 + 0.7 * severity)
    if hour is not None:
        noise *= _time_of_day_factor(hour)
    noise += random.gauss(0, noise * 0.03)
    noise = max(20.0, round(noise, 2))

    return {
        "ph": ph,
        "turbidity": turbidity,
        "dissolved_oxygen": dissolved_oxygen,
        "noise_level": noise,
    }


# ---------------------------------------------------------------------------
# Historical backfill (runs once at startup)
# ---------------------------------------------------------------------------

async def backfill_historical_data():
    """
    Fetch 7 days of hourly historical air quality from Open-Meteo
    and insert into pollution_readings with proper past timestamps.
    Idempotent: skips if >100 readings already exist.
    """
    from database import async_session
    from models import PollutionReading
    from sqlalchemy import select

    async with async_session() as db:
        # Check which stations already have data
        from sqlalchemy import distinct
        result = await db.execute(
            select(distinct(PollutionReading.station_id))
        )
        existing_station_ids = {row[0] for row in result.all()}
        stations_to_backfill = [s for s in STATIONS if s["id"] not in existing_station_ids]

        if not stations_to_backfill:
            print(f"  [Backfill] All {len(STATIONS)} stations already have data, skipping.")
            return

        print(f"  [Backfill] Starting 7-day historical backfill for {len(stations_to_backfill)} station(s)...")
        async with httpx.AsyncClient() as client:
            total_inserted = 0

            for station in stations_to_backfill:
                data = await fetch_open_meteo_air_quality(
                    client,
                    station["latitude"],
                    station["longitude"],
                    past_days=7,
                    forecast_days=0,
                )
                if data is None or "hourly" not in data:
                    print(f"  [Backfill] No data for {station['name']}, skipping.")
                    continue

                hourly = data["hourly"]
                times = hourly.get("time", [])
                pm25_arr = hourly.get("pm2_5", [])
                pm10_arr = hourly.get("pm10", [])
                co2_arr = hourly.get("carbon_dioxide", [])
                no2_arr = hourly.get("nitrogen_dioxide", [])

                readings = []
                for i, time_str in enumerate(times):
                    ts = datetime.fromisoformat(time_str)

                    pm25 = pm25_arr[i] if i < len(pm25_arr) and pm25_arr[i] is not None else 0.0
                    pm10 = pm10_arr[i] if i < len(pm10_arr) and pm10_arr[i] is not None else 0.0
                    co2 = co2_arr[i] if i < len(co2_arr) and co2_arr[i] is not None else 400.0
                    no2 = no2_arr[i] if i < len(no2_arr) and no2_arr[i] is not None else 0.0

                    estimates = estimate_water_and_noise(
                        station, pm25, pm10, co2, no2, hour=ts.hour
                    )

                    readings.append(PollutionReading(
                        station_id=station["id"],
                        pm25=round(pm25, 2),
                        pm10=round(pm10, 2),
                        co2=round(co2, 2),
                        no2=round(no2, 2),
                        ph=estimates["ph"],
                        turbidity=estimates["turbidity"],
                        dissolved_oxygen=estimates["dissolved_oxygen"],
                        noise_level=estimates["noise_level"],
                        timestamp=ts,
                    ))

                db.add_all(readings)
                total_inserted += len(readings)
                print(f"  [Backfill] {station['name']}: {len(readings)} hourly readings queued.")

            await db.commit()
            print(f"  [Backfill] Complete. Inserted {total_inserted} total readings.")


# ---------------------------------------------------------------------------
# Periodic fetch (runs every 15 minutes)
# ---------------------------------------------------------------------------

async def fetch_and_ingest_current_readings():
    """
    Fetch the latest air quality from Open-Meteo for all stations,
    estimate water/noise, insert into DB, and run alert engine.
    """
    from database import async_session
    from models import PollutionReading
    from services.alert_engine import check_and_create_alerts

    async with httpx.AsyncClient() as client:
        async with async_session() as db:
            ingested = 0
            for station in STATIONS:
                data = await fetch_open_meteo_air_quality(
                    client,
                    station["latitude"],
                    station["longitude"],
                    current=True,
                )
                if data is None or "current" not in data:
                    print(f"  [Fetcher] No current data for {station['name']}, skipping.")
                    continue

                current = data["current"]
                pm25 = current.get("pm2_5") or 0.0
                pm10 = current.get("pm10") or 0.0
                co2 = current.get("carbon_dioxide") or 400.0
                no2 = current.get("nitrogen_dioxide") or 0.0

                now_hour = datetime.now().hour
                estimates = estimate_water_and_noise(
                    station, pm25, pm10, co2, no2, hour=now_hour
                )

                reading = PollutionReading(
                    station_id=station["id"],
                    pm25=round(pm25, 2),
                    pm10=round(pm10, 2),
                    co2=round(co2, 2),
                    no2=round(no2, 2),
                    ph=estimates["ph"],
                    turbidity=estimates["turbidity"],
                    dissolved_oxygen=estimates["dissolved_oxygen"],
                    noise_level=estimates["noise_level"],
                )
                db.add(reading)
                await db.flush()
                await db.refresh(reading)

                reading_dict = {
                    "pm25": reading.pm25, "pm10": reading.pm10,
                    "co2": reading.co2, "no2": reading.no2,
                    "ph": reading.ph, "turbidity": reading.turbidity,
                    "dissolved_oxygen": reading.dissolved_oxygen,
                    "noise_level": reading.noise_level,
                }
                await check_and_create_alerts(db, station["id"], reading_dict)
                ingested += 1

            await db.commit()
            print(f"  [Fetcher] Ingested current readings for {ingested}/{len(STATIONS)} stations.")


async def run_periodic_fetcher():
    """Background task: fetch real data every 15 minutes."""
    print(f"  [Fetcher] Periodic fetcher started (interval: {FETCH_INTERVAL_SECONDS}s).")
    # Fetch immediately on startup, then every interval
    try:
        await fetch_and_ingest_current_readings()
    except Exception as e:
        print(f"  [Fetcher] Initial fetch error: {e}")

    while True:
        await asyncio.sleep(FETCH_INTERVAL_SECONDS)
        try:
            await fetch_and_ingest_current_readings()
        except Exception as e:
            print(f"  [Fetcher] Periodic fetch error: {e}")
