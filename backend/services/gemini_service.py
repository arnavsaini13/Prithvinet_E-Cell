"""
PrithviNet — AI Analysis Service (Groq)
Generates environmental alerts for a region based on live sensor data.
"""

import os
import json
import re

# Load .env if present (for local development)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


async def generate_environmental_alerts(region: str, station_name: str, station_data: dict) -> list[dict]:
    """
    Build a prompt from real sensor readings and return structured AI alerts via Groq.

    station_data keys expected:
      pm25, pm10, co2, no2, ph, turbidity, dissolved_oxygen,
      noise_level, overall_risk, risk_level
    """
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not configured in backend/.env")

    from groq import Groq  # lazy import

    client = Groq(api_key=GROQ_API_KEY)

    prompt = f"""You are an expert environmental monitoring AI for the {region} region in India.
The monitoring station is: {station_name}.

LIVE SENSOR READINGS (right now):
- Air Quality:
    PM2.5 = {station_data.get('pm25', 'N/A')} µg/m3  (WHO safe limit: 15 µg/m3)
    PM10  = {station_data.get('pm10', 'N/A')} µg/m3  (WHO safe limit: 45 µg/m3)
    CO2   = {station_data.get('co2', 'N/A')} ppm     (safe: <1000 ppm)
    NO2   = {station_data.get('no2', 'N/A')} µg/m3   (WHO safe limit: 25 µg/m3)
- Water Quality:
    pH              = {station_data.get('ph', 'N/A')}      (safe: 6.5-8.5)
    Turbidity       = {station_data.get('turbidity', 'N/A')} NTU (safe: <4 NTU)
    Dissolved O2    = {station_data.get('dissolved_oxygen', 'N/A')} mg/L (safe: >6 mg/L)
- Noise Level: {station_data.get('noise_level', 'N/A')} dB  (safe: <55 dB day / <45 dB night)
- Overall Risk Score: {station_data.get('overall_risk', 'N/A')}/100  ({station_data.get('risk_level', 'N/A')})

Based on these readings, generate 4-5 specific, actionable environmental alerts for the regional environmental officer. Each alert must reference actual values from the data above.

Respond ONLY with a valid JSON array, no markdown, no code fences, no extra text:
[
  {{
    "title": "Short specific alert title (max 8 words)",
    "description": "2-3 sentences explaining what the data shows and why it is concerning, referencing actual values.",
    "severity": "low|medium|high|critical",
    "category": "air_quality|water_quality|noise|industrial|general",
    "recommendation": "One specific concrete action the officer should take immediately."
  }}
]"""

    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=1500,
    )

    text = (completion.choices[0].message.content or "").strip()

    # Strip markdown code fences if model adds them
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    # Extract JSON array
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        return json.loads(match.group())

    return []
