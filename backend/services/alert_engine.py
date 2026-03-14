"""
PrithviNet - Alert Engine
Checks incoming sensor readings against pollution thresholds
and generates alerts when limits are breached.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from models import Alert

# WHO / regulatory thresholds for each pollutant
THRESHOLDS = {
    "pm25": [
        {"limit": 35.0, "severity": "low"},
        {"limit": 75.0, "severity": "medium"},
        {"limit": 150.0, "severity": "high"},
        {"limit": 250.0, "severity": "critical"},
    ],
    "pm10": [
        {"limit": 50.0, "severity": "low"},
        {"limit": 100.0, "severity": "medium"},
        {"limit": 250.0, "severity": "high"},
        {"limit": 430.0, "severity": "critical"},
    ],
    "co2": [
        {"limit": 800.0, "severity": "low"},
        {"limit": 1200.0, "severity": "medium"},
        {"limit": 2000.0, "severity": "high"},
        {"limit": 5000.0, "severity": "critical"},
    ],
    "no2": [
        {"limit": 40.0, "severity": "low"},
        {"limit": 80.0, "severity": "medium"},
        {"limit": 180.0, "severity": "high"},
        {"limit": 400.0, "severity": "critical"},
    ],
    "ph": [
        # pH outside 6.5-8.5 is problematic; handled with distance from neutral
        {"limit": 1.5, "severity": "low"},     # |pH - 7| thresholds
        {"limit": 2.5, "severity": "medium"},
        {"limit": 3.5, "severity": "high"},
        {"limit": 5.0, "severity": "critical"},
    ],
    "turbidity": [
        {"limit": 5.0, "severity": "low"},
        {"limit": 10.0, "severity": "medium"},
        {"limit": 25.0, "severity": "high"},
        {"limit": 50.0, "severity": "critical"},
    ],
    "dissolved_oxygen": [
        # Low DO is dangerous; thresholds are inverted (below limit triggers)
        {"limit": 6.0, "severity": "low"},
        {"limit": 4.0, "severity": "medium"},
        {"limit": 2.0, "severity": "high"},
        {"limit": 1.0, "severity": "critical"},
    ],
    "noise_level": [
        {"limit": 65.0, "severity": "low"},
        {"limit": 75.0, "severity": "medium"},
        {"limit": 85.0, "severity": "high"},
        {"limit": 100.0, "severity": "critical"},
    ],
}


async def check_and_create_alerts(
    db: AsyncSession, station_id: int, reading_data: dict
) -> list[Alert]:
    """Evaluate a reading against thresholds and persist any alerts."""
    generated_alerts: list[Alert] = []

    for pollutant, levels in THRESHOLDS.items():
        value = reading_data.get(pollutant)
        if value is None:
            continue

        severity = _determine_severity(pollutant, value, levels)
        if severity is None:
            continue

        alert = Alert(
            station_id=station_id,
            pollutant=pollutant,
            value=value,
            severity=severity,
        )
        db.add(alert)
        generated_alerts.append(alert)

    if generated_alerts:
        await db.flush()

    return generated_alerts


def _determine_severity(pollutant: str, value: float, levels: list[dict]) -> str | None:
    """Return the highest matched severity or None if within safe limits."""
    if pollutant == "ph":
        value = abs(value - 7.0)  # distance from neutral

    if pollutant == "dissolved_oxygen":
        # Lower DO is worse — check if value falls BELOW threshold
        matched = None
        for level in levels:
            if value < level["limit"]:
                matched = level["severity"]
        return matched

    # Standard pollutants: higher value is worse
    matched = None
    for level in levels:
        if value >= level["limit"]:
            matched = level["severity"]
    return matched
