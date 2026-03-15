import sys
import os

# Make the backend package importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from main import app  # noqa: E402  — FastAPI app
from mangum import Mangum  # noqa: E402  — AWS/Vercel ASGI adapter

# Vercel invokes this handler for every HTTP request routed here
handler = Mangum(app, lifespan="auto")
