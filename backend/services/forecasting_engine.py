"""
PrithviNet - Forecasting Engine
Generates short-term pollution forecasts using recent reading trends.
Uses simple linear extrapolation with noise for a hackathon demo.
A production system would swap this for an LSTM or Prophet model.
"""

import random
from datetime import datetime, timedelta


def generate_forecast(
    recent_readings: list[dict],
    pollutant: str,
    station_id: int,
    steps: int = 12,
    interval_seconds: int = 60,
) -> dict:
    """
    Produce a forecast for the next `steps` intervals based on recent data.

    Parameters
    ----------
    recent_readings : list of dicts with at least `pollutant` and `timestamp` keys.
    pollutant       : which field to forecast (e.g. "pm25").
    station_id      : station identifier for the response envelope.
    steps           : number of future data points.
    interval_seconds: seconds between each predicted point.
    """
    values = [r.get(pollutant, 0) for r in recent_readings if r.get(pollutant) is not None]

    if len(values) < 2:
        # Not enough data — return flat forecast at last known value
        base = values[0] if values else 0.0
        return _flat_forecast(station_id, pollutant, base, steps, interval_seconds)

    # Simple trend: slope of last N points via least squares
    n = len(values)
    x_mean = (n - 1) / 2
    y_mean = sum(values) / n
    numerator = sum((i - x_mean) * (v - y_mean) for i, v in enumerate(values))
    denominator = sum((i - x_mean) ** 2 for i in range(n))
    slope = numerator / denominator if denominator != 0 else 0.0

    last_value = values[-1]
    now = datetime.utcnow()

    forecast_points = []
    for step in range(1, steps + 1):
        t = now + timedelta(seconds=interval_seconds * step)
        predicted = last_value + slope * step
        # Add small random noise for realism
        noise = random.gauss(0, max(abs(predicted) * 0.05, 0.5))
        predicted = max(0, predicted + noise)
        margin = max(abs(predicted) * 0.12, 1.0)

        forecast_points.append({
            "timestamp": t.isoformat(),
            "predicted_value": round(predicted, 2),
            "lower_bound": round(max(0, predicted - margin), 2),
            "upper_bound": round(predicted + margin, 2),
        })

    return {
        "station_id": station_id,
        "pollutant": pollutant,
        "forecast": forecast_points,
    }


def _flat_forecast(station_id, pollutant, base, steps, interval_seconds):
    now = datetime.utcnow()
    points = []
    for step in range(1, steps + 1):
        t = now + timedelta(seconds=interval_seconds * step)
        noise = random.gauss(0, max(base * 0.03, 0.3))
        val = max(0, base + noise)
        margin = max(base * 0.1, 1.0)
        points.append({
            "timestamp": t.isoformat(),
            "predicted_value": round(val, 2),
            "lower_bound": round(max(0, val - margin), 2),
            "upper_bound": round(val + margin, 2),
        })
    return {"station_id": station_id, "pollutant": pollutant, "forecast": points}
