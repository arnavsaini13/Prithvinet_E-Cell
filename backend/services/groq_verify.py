"""
PrithviNet - Groq Coordinate Verification Service

Uses Groq LLM (llama-3.1-8b-instant) to verify that submitted industry
coordinates (latitude, longitude, elevation) are a plausible real-world
location in India for the stated industry name and location.

Returns (True, reason) if valid, (False, reason) if implausible.
Falls back to (True, "skipped") if the key is missing or the API fails.
"""

import asyncio
import logging
import os

logger = logging.getLogger(__name__)

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


def _call_groq(name: str, location: str, region: str, lat: float, lng: float, height: float) -> tuple[bool, str]:
    """Synchronous Groq call — intended to be run in a thread."""
    if not GROQ_API_KEY:
        logger.warning("groq_verify: GROQ_API_KEY not set, skipping verification")
        return True, "Skipped — API key not configured"

    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a geographic fact-checker for Indian industrial facility registration. "
                        "You verify whether submitted GPS coordinates are a plausible real-world location "
                        "in India for the stated industry. Be lenient for approximate coordinates."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f'Is latitude={lat:.4f}, longitude={lng:.4f}, elevation={height:.1f}m '
                        f'a plausible real location in India for an industry named "{name}" '
                        f'in {location}, {region} region? '
                        f'Reply with exactly VALID or INVALID followed by one short sentence reason. Nothing else.'
                    ),
                },
            ],
            temperature=0,
            max_tokens=80,
        )

        text = response.choices[0].message.content.strip()
        is_valid = text.upper().startswith("VALID")
        # Extract the reason (everything after VALID/INVALID)
        parts = text.split(None, 1)
        reason = parts[1] if len(parts) > 1 else text
        return is_valid, reason

    except Exception as exc:
        logger.warning("groq_verify: API call failed: %s — skipping verification", exc)
        return True, f"Skipped — verification unavailable ({type(exc).__name__})"


async def verify_industry_coords(
    name: str,
    location: str,
    region: str,
    lat: float,
    lng: float,
    height: float,
) -> tuple[bool, str]:
    """
    Async wrapper — runs the synchronous Groq call in a thread pool
    so it doesn't block the FastAPI event loop.

    Returns:
        (True, reason)  — coordinates are plausible, proceed with registration
        (False, reason) — coordinates rejected, surface reason to client
    """
    return await asyncio.to_thread(_call_groq, name, location, region, lat, lng, height)
