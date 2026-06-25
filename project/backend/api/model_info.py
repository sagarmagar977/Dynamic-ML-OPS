from fastapi import APIRouter, HTTPException
import json
import os

router = APIRouter()

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")

@router.get("/{model_id}", response_model=dict)
@router.get("/{model_id}/info", response_model=dict)
def get_model_info(model_id: str):
    """Get metadata for a specific model (supports both raw path and /info fallback)."""
    metadata_path = os.path.join(MODELS_DIR, model_id, "metadata.json")
    
    if not os.path.exists(metadata_path):
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found or metadata missing")
    
    try:
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        return metadata
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read metadata: {str(e)}")