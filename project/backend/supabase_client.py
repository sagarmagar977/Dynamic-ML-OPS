"""Supabase client utility for FastAPI backend.

Loads environment variables from .env and creates a singleton Supabase client.
"""
import os
from supabase import create_client, Client

# Manual .env loader to support local development and script execution
def load_env():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(base_dir, ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    os.environ[k] = v

load_env()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Prefer service role key for server‑side operations, fallback to anon key
key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY

if not SUPABASE_URL or not key:
    # Fallback dummy client when Supabase credentials are missing
    class DummyClient:
        def __init__(self):
            pass
        def __getattr__(self, name):
            async def dummy(*args, **kwargs):
                return None
            return dummy
    supabase = DummyClient()
else:
    supabase = create_client(SUPABASE_URL, key)
