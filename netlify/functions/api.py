import sys
import os

# Make backend importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

from main import app
from mangum import Mangum

# lifespan="auto" runs startup (init_db, seed_data, migrations) on cold start
handler = Mangum(app, lifespan="auto")
