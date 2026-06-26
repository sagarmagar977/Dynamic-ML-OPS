from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api import models, model_info, predict, predict_batch, agent

app = FastAPI(title="OmniPredictor Terminal")

# CORS middleware - adjust origins as needed for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
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