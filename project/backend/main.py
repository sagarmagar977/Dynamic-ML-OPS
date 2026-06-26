from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api import models, model_info, predict, predict_batch, agent

app = FastAPI(title="OmniPredictor")

import os

# CORS middleware - read allowed origins from environment
frontend_url = os.environ.get("FRONTEND_URL")
if frontend_url:
    origins = [o.strip() for o in frontend_url.split(",")]
    # Include localhost for local frontend dev convenience
    origins.extend(["http://localhost:5173", "http://localhost:3000"])
else:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True if frontend_url else False,  # Credentials must not be True when wildcard "*" is used
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