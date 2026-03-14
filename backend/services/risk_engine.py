"""
PrithviNet - Risk Scoring Engine
Calculates composite environmental risk scores from the latest sensor readings.
Each sub-index is normalized to 0-100, combined into an overall risk score.
"""


def calculate_risk_score(reading: dict) -> dict:
    """
    Compute air quality, water quality, noise indices and an overall risk score.
    Returns a dict with index values and a human-readable risk level.
    """
    aqi = _air_quality_index(reading)
    wqi = _water_quality_index(reading)
    noise_idx = _noise_index(reading)

    # Weighted composite: air 50%, water 30%, noise 20%
    overall = round(aqi * 0.50 + wqi * 0.30 + noise_idx * 0.20, 1)

    return {
        "air_quality_index": aqi,
        "water_quality_index": wqi,
        "noise_index": noise_idx,
        "overall_risk": overall,
        "risk_level": _risk_level(overall),
    }


# ---------- Sub-index calculations ----------

def _air_quality_index(r: dict) -> float:
    """Normalize air pollutants to a 0-100 scale and average them."""
    pm25_score = min(r.get("pm25", 0) / 250.0 * 100, 100)
    pm10_score = min(r.get("pm10", 0) / 430.0 * 100, 100)
    co2_score = min(r.get("co2", 0) / 5000.0 * 100, 100)
    no2_score = min(r.get("no2", 0) / 400.0 * 100, 100)
    return round((pm25_score + pm10_score + co2_score + no2_score) / 4, 1)


def _water_quality_index(r: dict) -> float:
    """Normalize water quality parameters to 0-100."""
    ph_deviation = abs(r.get("ph", 7.0) - 7.0)
    ph_score = min(ph_deviation / 5.0 * 100, 100)

    turbidity_score = min(r.get("turbidity", 0) / 50.0 * 100, 100)

    # Lower dissolved oxygen is worse
    do_val = r.get("dissolved_oxygen", 8.0)
    do_score = max(0, min((8.0 - do_val) / 8.0 * 100, 100))

    return round((ph_score + turbidity_score + do_score) / 3, 1)


def _noise_index(r: dict) -> float:
    """Normalize noise level to 0-100."""
    return round(min(r.get("noise_level", 0) / 100.0 * 100, 100), 1)


def _risk_level(score: float) -> str:
    if score < 25:
        return "low"
    if score < 50:
        return "moderate"
    if score < 75:
        return "high"
    return "critical"
