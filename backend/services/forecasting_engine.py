"""
PrithviNet - Forecasting Engine
================================
Air pollutants (PM2.5, PM10, CO2, NO2):
  SOURCE: Open-Meteo Air Quality API hourly forecast — REAL data, no API key required.
  URL: https://air-quality-api.open-meteo.com/v1/air-quality
  Coverage: Up to 72 hours ahead, 1-hour resolution.

Water/noise metrics (pH, turbidity, dissolved_oxygen, noise_level):
  SOURCE: Linear extrapolation from recent DB readings.
  NOTE: No free real-time water/noise API is available for Indian stations.
"""

import random
from datetime import datetime, timedelta, timezone

import httpx

# Maps our internal pollutant names → Open-Meteo parameter names
_OPENMETEO_KEY = {
    "pm25":    "pm2_5",
    "pm10":    "pm10",
    "co2":     "carbon_dioxide",
    "no2":     "nitrogen_dioxide",
    "so2":     "sulphur_dioxide",
    "ozone":   "ozone",
    "methane": "methane",
    "dust":    "dust",
    "aod":     "aerosol_optical_depth",
}


async def fetch_openmeteo_forecast(
    latitude: float,
    longitude: float,
    pollutant: str,
    steps: int,
) -> list[dict] | None:
    """
    Fetch real hourly air quality forecast from Open-Meteo Air Quality API.

    SOURCE : https://air-quality-api.open-meteo.com/v1/air-quality
    METHOD : Free, no API key, based on CAMS global atmospheric model (ECMWF)
    RETURNS: List of {timestamp, predicted_value, lower_bound, upper_bound} dicts,
             or None if the pollutant is not an air metric (falls back to linear).

    Confidence bounds are estimated as ±10 % of predicted value (Open-Meteo does
    not publish explicit uncertainty intervals for AQ forecasts).
    """
    om_key = _OPENMETEO_KEY.get(pollutant)
    if om_key is None:
        return None  # water/noise — handled by _linear_forecast below

    url = "https://air-quality-api.open-meteo.com/v1/air-quality"
    params = {
        "latitude":     latitude,
        "longitude":    longitude,
        "hourly":       om_key,
        "forecast_days": 3,   # 72 h of hourly data
        "timezone":     "auto",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.RequestError, httpx.HTTPStatusError) as exc:
        print(f"  [Forecast] Open-Meteo error ({latitude},{longitude}): {exc}")
        return None

    hourly = data.get("hourly", {})
    times  = hourly.get("time", [])
    values = hourly.get(om_key, [])

    if not times or not values:
        return None

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    points: list[dict] = []

    for ts_str, val in zip(times, values):
        if val is None:
            continue
        ts = datetime.fromisoformat(ts_str)
        if ts <= now:
            continue
        margin = max(float(val) * 0.10, 1.0)
        points.append({
            "timestamp":       ts.isoformat(),
            "predicted_value": round(float(val), 2),
            "lower_bound":     round(max(0.0, float(val) - margin), 2),
            "upper_bound":     round(float(val) + margin, 2),
        })
        if len(points) >= steps:
            break

    return points or None


# ---------------------------------------------------------------------------
# Fallback: linear regression — used only for water/noise metrics
# ---------------------------------------------------------------------------

def _linear_forecast(
    recent_readings: list[dict],
    pollutant: str,
    station_id: int,
    steps: int = 12,
    interval_seconds: int = 3600,
) -> dict:
    """
    Least-squares linear extrapolation on recent DB readings.

    SOURCE : Local PostgreSQL database (readings originally from Open-Meteo for
             air metrics; algorithmically estimated for water/noise).
    NOTE   : Used only for pH, turbidity, dissolved_oxygen, noise_level because
             no free real-time water/noise API exists for Indian stations.
    """
    values = [r.get(pollutant, 0) for r in recent_readings if r.get(pollutant) is not None]

    if len(values) < 2:
        base = values[0] if values else 0.0
        return _flat_forecast(station_id, pollutant, base, steps, interval_seconds)

    n = len(values)
    x_mean = (n - 1) / 2
    y_mean = sum(values) / n
    numerator   = sum((i - x_mean) * (v - y_mean) for i, v in enumerate(values))
    denominator = sum((i - x_mean) ** 2 for i in range(n))
    slope = numerator / denominator if denominator else 0.0

    last_value = values[-1]
    now = datetime.utcnow()
    points = []
    for step in range(1, steps + 1):
        t = now + timedelta(seconds=interval_seconds * step)
        predicted = max(0, last_value + slope * step + random.gauss(0, max(abs(last_value) * 0.05, 0.5)))
        margin    = max(abs(predicted) * 0.12, 1.0)
        points.append({
            "timestamp":       t.isoformat(),
            "predicted_value": round(predicted, 2),
            "lower_bound":     round(max(0, predicted - margin), 2),
            "upper_bound":     round(predicted + margin, 2),
        })
    return {"station_id": station_id, "pollutant": pollutant, "forecast": points}


def _flat_forecast(station_id, pollutant, base, steps, interval_seconds):
    now = datetime.utcnow()
    points = []
    for step in range(1, steps + 1):
        t   = now + timedelta(seconds=interval_seconds * step)
        val = max(0, base + random.gauss(0, max(base * 0.03, 0.3)))
        margin = max(base * 0.1, 1.0)
        points.append({
            "timestamp":       t.isoformat(),
            "predicted_value": round(val, 2),
            "lower_bound":     round(max(0, val - margin), 2),
            "upper_bound":     round(val + margin, 2),
        })
    return {"station_id": station_id, "pollutant": pollutant, "forecast": points}
