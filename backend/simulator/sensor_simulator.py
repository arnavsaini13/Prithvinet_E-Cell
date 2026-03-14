"""
PrithviNet - IoT Sensor Simulator
===================================
Simulates 5 environmental monitoring stations streaming realistic data
to the backend every 10 seconds via POST /sensor-data.

Features:
  - Per-station regional profiles (industrial vs coastal vs urban)
  - Time-of-day drift (pollution rises in rush hours, falls at night)
  - Gradual spike buildup and decay (not instant jumps)
  - Correlated pollutants (PM2.5 spike also raises PM10, CO2, etc.)
  - Retry logic for backend connectivity
  - Rich console dashboard showing live readings

Run standalone:
    python sensor_simulator.py
"""

import asyncio
import math
import random
import time
from datetime import datetime

import httpx

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

API_BASE = "http://localhost:8000"
INTERVAL_SECONDS = 10
MAX_RETRIES = 5
RETRY_DELAY = 3

# ---------------------------------------------------------------------------
# Station profiles — each station has a unique environmental character
# ---------------------------------------------------------------------------

STATIONS = [
    {
        "id": 1,
        "name": "Delhi Central",
        "profile": "heavy_urban",
        "baselines": {
            "pm25": (25, 55),   "pm10": (40, 80),
            "co2": (450, 700),  "no2": (30, 60),
            "ph": (6.8, 7.4),   "turbidity": (2.0, 5.0),
            "dissolved_oxygen": (5.5, 7.0), "noise_level": (55, 75),
        },
        "spike_chance": 0.10,
    },
    {
        "id": 2,
        "name": "Mumbai Coastal",
        "profile": "coastal",
        "baselines": {
            "pm25": (10, 25),   "pm10": (18, 40),
            "co2": (370, 500),  "no2": (12, 30),
            "ph": (7.5, 8.2),   "turbidity": (1.0, 3.0),
            "dissolved_oxygen": (7.0, 9.0), "noise_level": (40, 60),
        },
        "spike_chance": 0.06,
    },
    {
        "id": 3,
        "name": "Bangalore Tech",
        "profile": "suburban",
        "baselines": {
            "pm25": (8, 20),    "pm10": (15, 35),
            "co2": (350, 480),  "no2": (10, 25),
            "ph": (6.9, 7.5),   "turbidity": (0.8, 2.5),
            "dissolved_oxygen": (7.0, 8.5), "noise_level": (35, 55),
        },
        "spike_chance": 0.05,
    },
    {
        "id": 4,
        "name": "Chennai Industrial",
        "profile": "industrial",
        "baselines": {
            "pm25": (30, 65),   "pm10": (50, 100),
            "co2": (500, 800),  "no2": (35, 70),
            "ph": (5.8, 7.0),   "turbidity": (3.0, 8.0),
            "dissolved_oxygen": (4.5, 6.5), "noise_level": (60, 82),
        },
        "spike_chance": 0.12,
    },
    {
        "id": 5,
        "name": "Kolkata River",
        "profile": "riverine",
        "baselines": {
            "pm25": (15, 35),   "pm10": (25, 55),
            "co2": (380, 550),  "no2": (18, 40),
            "ph": (6.5, 7.6),   "turbidity": (4.0, 10.0),
            "dissolved_oxygen": (5.0, 7.5), "noise_level": (45, 65),
        },
        "spike_chance": 0.08,
    },
]

# Spike duration range (number of cycles a spike lasts)
SPIKE_DURATION = (3, 8)

# ---------------------------------------------------------------------------
# Per-station state: tracks ongoing spikes with gradual rise/fall
# ---------------------------------------------------------------------------

station_state: dict[int, dict] = {}


def _init_state():
    """Initialize per-station spike tracking."""
    for s in STATIONS:
        station_state[s["id"]] = {
            "spike_active": False,
            "spike_cycle": 0,
            "spike_total": 0,
            "spike_intensity": 0.0,
            "prev_values": {},  # smoothing with previous reading
        }


# ---------------------------------------------------------------------------
# Time-of-day multiplier — simulates rush-hour and nighttime patterns
# ---------------------------------------------------------------------------

def _time_of_day_factor() -> float:
    """
    Returns a multiplier between 0.7 (night) and 1.3 (rush hour).
    Peaks at 08:00 and 18:00, lowest at 03:00.
    """
    hour = datetime.now().hour + datetime.now().minute / 60.0
    # Two peaks: morning rush (8h) and evening rush (18h)
    morning = math.exp(-0.5 * ((hour - 8) / 2.5) ** 2)
    evening = math.exp(-0.5 * ((hour - 18) / 2.5) ** 2)
    base = 0.7 + 0.6 * max(morning, evening)
    return min(base, 1.35)


# ---------------------------------------------------------------------------
# Reading generation
# ---------------------------------------------------------------------------

AIR_PARAMS = ("pm25", "pm10", "co2", "no2", "noise_level")
WATER_PARAMS = ("ph", "turbidity", "dissolved_oxygen")


def _generate_reading(station: dict) -> dict:
    """
    Generate a single sensor reading with:
      - per-station baselines
      - time-of-day drift
      - gradual spike buildup / decay
      - smoothing with previous value
    """
    sid = station["id"]
    state = station_state[sid]
    baselines = station["baselines"]
    tod_factor = _time_of_day_factor()

    # --- Spike state machine ---
    if state["spike_active"]:
        state["spike_cycle"] += 1
        # Spike intensity follows a bell curve over its duration
        progress = state["spike_cycle"] / state["spike_total"]
        state["spike_intensity"] = math.sin(progress * math.pi)  # 0 → 1 → 0
        if state["spike_cycle"] >= state["spike_total"]:
            state["spike_active"] = False
            state["spike_cycle"] = 0
    else:
        state["spike_intensity"] = 0.0
        # Roll for new spike
        if random.random() < station["spike_chance"]:
            state["spike_active"] = True
            state["spike_cycle"] = 0
            state["spike_total"] = random.randint(*SPIKE_DURATION)

    spike_str = state["spike_intensity"]

    data = {"station_id": sid}

    for param, (low, high) in baselines.items():
        base_value = random.uniform(low, high)

        # Apply time-of-day factor to air/noise pollutants
        if param in AIR_PARAMS:
            base_value *= tod_factor

        # Apply spike: air/noise params spike up, water params degrade
        if spike_str > 0:
            if param in ("pm25", "pm10", "co2", "no2", "noise_level"):
                base_value += spike_str * (high - low) * random.uniform(2.5, 5.0)
            elif param == "ph":
                base_value += spike_str * random.choice([-1, 1]) * random.uniform(1.5, 3.0)
            elif param == "turbidity":
                base_value += spike_str * high * random.uniform(2.0, 6.0)
            elif param == "dissolved_oxygen":
                base_value -= spike_str * (high - low) * random.uniform(1.5, 3.0)
                base_value = max(0.5, base_value)  # DO can't go below ~0

        # Smooth with previous value (70% new, 30% old) for realistic drift
        prev = state["prev_values"].get(param)
        if prev is not None:
            base_value = base_value * 0.7 + prev * 0.3

        # Small sensor jitter (±2%)
        jitter = random.gauss(0, base_value * 0.02)
        final_value = max(0, base_value + jitter)

        # Clamp pH to physical range
        if param == "ph":
            final_value = max(2.0, min(12.0, final_value))

        data[param] = round(final_value, 2)
        state["prev_values"][param] = final_value

    return data


def _is_spike(reading: dict, station: dict) -> bool:
    """Check if any air pollutant exceeds 2x its baseline max."""
    baselines = station["baselines"]
    return any(
        reading.get(k, 0) > baselines[k][1] * 2
        for k in AIR_PARAMS if k in baselines
    )


# ---------------------------------------------------------------------------
# Console dashboard
# ---------------------------------------------------------------------------

HEADER = (
    f"{'Station':<22} {'PM2.5':>7} {'PM10':>7} {'CO2':>7} {'NO2':>7}"
    f" {'pH':>6} {'Turb':>6} {'DO':>6} {'Noise':>6} {'Status':>10}"
)
SEP = "-" * len(HEADER)


def _format_row(reading: dict, station: dict) -> str:
    spike = _is_spike(reading, station)
    status = "!! SPIKE" if spike else "OK"
    return (
        f"{station['name']:<22} "
        f"{reading['pm25']:>7.1f} {reading['pm10']:>7.1f} "
        f"{reading['co2']:>7.0f} {reading['no2']:>7.1f} "
        f"{reading['ph']:>6.1f} {reading['turbidity']:>6.1f} "
        f"{reading['dissolved_oxygen']:>6.1f} {reading['noise_level']:>6.1f} "
        f"{status:>10}"
    )


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

async def run_simulator():
    _init_state()

    print("=" * 64)
    print("  PrithviNet IoT Sensor Simulator")
    print("=" * 64)
    print(f"  Target API   : {API_BASE}/sensor-data")
    print(f"  Stations     : {len(STATIONS)}")
    print(f"  Interval     : {INTERVAL_SECONDS}s")
    print(f"  Time-of-day  : drift enabled")
    print(f"  Spike model  : gradual buildup / decay")
    print("=" * 64)

    # Wait for backend to become available
    async with httpx.AsyncClient(timeout=10) as client:
        connected = False
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                r = await client.get(f"{API_BASE}/")
                if r.status_code == 200:
                    print(f"\n  Backend connected (attempt {attempt})\n")
                    connected = True
                    break
            except httpx.RequestError:
                pass
            print(f"  Waiting for backend... (attempt {attempt}/{MAX_RETRIES})")
            await asyncio.sleep(RETRY_DELAY)

        if not connected:
            print("\n  ERROR: Could not connect to backend. Is it running?")
            print(f"  Expected at: {API_BASE}")
            return

        # Main streaming loop
        cycle = 0
        total_sent = 0
        total_spikes = 0

        while True:
            cycle += 1
            ts = datetime.now().strftime("%H:%M:%S")
            tod = _time_of_day_factor()

            print(f"\n  Cycle {cycle} | {ts} | ToD factor: {tod:.2f}")
            print(f"  {SEP}")
            print(f"  {HEADER}")
            print(f"  {SEP}")

            for station in STATIONS:
                reading = _generate_reading(station)
                spike = _is_spike(reading, station)

                try:
                    resp = await client.post(
                        f"{API_BASE}/sensor-data", json=reading
                    )
                    if resp.status_code == 200:
                        total_sent += 1
                        if spike:
                            total_spikes += 1
                        print(f"  {_format_row(reading, station)}")
                    else:
                        print(f"  {station['name']:<22} HTTP {resp.status_code}")
                except httpx.RequestError as e:
                    print(f"  {station['name']:<22} CONN ERROR: {e}")

            print(f"  {SEP}")
            print(f"  Total sent: {total_sent} | Spikes detected: {total_spikes}")

            await asyncio.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    try:
        asyncio.run(run_simulator())
    except KeyboardInterrupt:
        print("\n\n  Simulator stopped by user.")
