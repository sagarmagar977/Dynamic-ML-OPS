from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api import models, model_info, predict, predict_batch, agent

app = FastAPI(title="OmniPredictor")

import os

# CORS middleware - allow all origins to prevent CORS blocks in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(models.router, prefix="/models", tags=["models"])
app.include_router(model_info.router, prefix="/models", tags=["model-info"])
app.include_router(predict.router, prefix="/predict", tags=["predict"])
app.include_router(predict_batch.router, prefix="/predict-batch", tags=["predict-batch"])
app.include_router(agent.router, prefix="/agent", tags=["agent"])
from backend.api.routes import supabase
app.include_router(supabase.router, prefix="/supabase", tags=["supabase"])

@app.get("/")
def read_root():
    return {"message": "OmniPredictor Terminal API is running"}



@app.on_event("startup")
async def preload_models():
    """Pre-download all models from Supabase on server boot."""
    from backend.utils.model_loader import ModelManager
    from backend.supabase_client import supabase, SUPABASE_URL, key
    import json, os

    is_dummy = (not SUPABASE_URL or "YOUR_SUPABASE_URL" in SUPABASE_URL)
    if is_dummy:
        return

    try:
        resp = supabase.from_("models").select("id").execute()
        manager = ModelManager()
        for row in resp.data:
            try:
                manager.load_model(row["id"])
                print(f"✅ Pre-loaded: {row['id']}")
            except Exception as e:
                print(f"⚠️ Could not pre-load {row['id']}: {e}")
    except Exception as e:
        print(f"⚠️ Startup pre-load skipped: {e}")
