from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from backend.utils.model_loader import ModelManager
from backend.utils.preprocessing import validate_assets
import os
import json
import shutil
from typing import Optional

router = APIRouter()

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

@router.get("/", response_model=dict)
def list_models():
    """List all available models in the repository storage."""
    model_manager = ModelManager()
    models_list = []
    
    if not os.path.exists(MODELS_DIR):
        return {"models": []}
        
    for model_id in os.listdir(MODELS_DIR):
        model_path = os.path.join(MODELS_DIR, model_id)
        if os.path.isdir(model_path):
            metadata_path = os.path.join(model_path, "metadata.json")
            if os.path.exists(metadata_path):
                try:
                    with open(metadata_path, 'r', encoding='utf-8') as f:
                        metadata = json.load(f)
                    
                    models_list.append({
                        "id": model_id,
                        "name": metadata.get("model_name", model_id),
                        "algorithm_variant": metadata.get("algorithm_variant", "Unknown"),
                        "task_type": metadata.get("task_type", "unknown"),
                        "features": metadata.get("features", []),
                        "n_features_in_": metadata.get("n_features_in_", len(metadata.get("features", []))),
                        "target_name": metadata.get("target_name", "target"),
                        "metrics": metadata.get("metrics", {}),
                        "classes": metadata.get("classes", []),
                        "active": model_manager.active_model_id == model_id
                    })
                except Exception:
                    # Skip invalid metadata
                    continue
    
    return {"models": models_list}

@router.post("/{model_id}/activate", response_model=dict)
def activate_model(model_id: str):
    """Activate a model (hot-swap in volatile execution memory)."""
    model_manager = ModelManager()
    model_path = os.path.join(MODELS_DIR, model_id, "model.joblib")
    
    if not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail=f"Model {model_id} binary not found")
    
    try:
        model_manager.activate_model(model_id)
        return {"status": "success", "active_model": model_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{model_id}", response_model=dict)
def delete_model(model_id: str):
    """Delete a model and wipe its folders from disk (must not be active)."""
    model_manager = ModelManager()
    if model_id == model_manager.active_model_id:
        raise HTTPException(status_code=400, detail="Cannot delete the currently active model. Please activate another model first.")
    
    model_path = os.path.join(MODELS_DIR, model_id)
    if not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
    
    try:
        # Physical wipe of files from storage as per PRD Section 3.4
        shutil.rmtree(model_path)
        model_manager.delete_model_from_cache(model_id)
        return {"status": "success", "deleted_model": model_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/deploy", response_model=dict)
async def deploy_model(
    model_id: str = Form(...),
    model_file: UploadFile = File(...),
    metadata_file: UploadFile = File(...)
):
    """Deploy/upload a new dual model asset pair (model.joblib & metadata.json)."""
    # Create isolated folder hash/id
    temp_id = f"temp_{model_id}"
    temp_dir = os.path.join(MODELS_DIR, temp_id)
    os.makedirs(temp_dir, exist_ok=True)
    
    temp_model_path = os.path.join(temp_dir, "model.joblib")
    temp_meta_path = os.path.join(temp_dir, "metadata.json")
    
    try:
        # Save temp files
        with open(temp_model_path, "wb") as f:
            f.write(await model_file.read())
            
        # Read and parse metadata as UTF-8
        meta_content = await metadata_file.read()
        meta_json = json.loads(meta_content.decode("utf-8"))
        
        with open(temp_meta_path, "w", encoding="utf-8") as f:
            json.dump(meta_json, f, indent=2)
            
        # Validate assets compatibility
        validate_assets(temp_model_path, temp_meta_path)
        
        # Move to actual storage folder
        final_dir = os.path.join(MODELS_DIR, model_id)
        if os.path.exists(final_dir):
            shutil.rmtree(final_dir)
        os.makedirs(final_dir, exist_ok=True)
        
        shutil.move(temp_model_path, os.path.join(final_dir, "model.joblib"))
        shutil.move(temp_meta_path, os.path.join(final_dir, "metadata.json"))
        
        return {"status": "success", "model_id": model_id}
        
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=f"Validation failed: {str(val_err)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deployment failed: {str(e)}")
    finally:
        # Clean up temp dir if exists
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

@router.post("/{model_id}/edit", response_model=dict)
async def edit_model(
    model_id: str,
    model_file: Optional[UploadFile] = File(None),
    metadata_file: Optional[UploadFile] = File(None)
):
    """Edit/overwrite parts of an existing model. Triggers soft reload if active."""
    model_dir = os.path.join(MODELS_DIR, model_id)
    if not os.path.exists(model_dir):
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
        
    joblib_path = os.path.join(model_dir, "model.joblib")
    metadata_path = os.path.join(model_dir, "metadata.json")
    
    # Backup files for rollback
    backup_dir = os.path.join(MODELS_DIR, f"backup_{model_id}")
    os.makedirs(backup_dir, exist_ok=True)
    shutil.copy2(joblib_path, os.path.join(backup_dir, "model.joblib"))
    shutil.copy2(metadata_path, os.path.join(backup_dir, "metadata.json"))
    
    try:
        # Perform replacements
        if model_file is not None:
            with open(joblib_path, "wb") as f:
                f.write(await model_file.read())
                
        if metadata_file is not None:
            meta_content = await metadata_file.read()
            meta_json = json.loads(meta_content.decode("utf-8"))
            with open(metadata_path, "w", encoding="utf-8") as f:
                json.dump(meta_json, f, indent=2)
                
        # Validate current unified files
        validate_assets(joblib_path, metadata_path)
        
        # Clear backup
        shutil.rmtree(backup_dir)
        
        # Soft reload if active in memory as per PRD Section 3.4
        model_manager = ModelManager()
        if model_manager.active_model_id == model_id:
            model_manager.activate_model(model_id)
            
        return {"status": "success", "model_id": model_id, "reloaded": model_manager.active_model_id == model_id}
        
    except ValueError as val_err:
        # Rollback
        shutil.copy2(os.path.join(backup_dir, "model.joblib"), joblib_path)
        shutil.copy2(os.path.join(backup_dir, "metadata.json"), metadata_path)
        shutil.rmtree(backup_dir)
        raise HTTPException(status_code=400, detail=f"Edit Validation failed: {str(val_err)}. Changes rolled back.")
    except Exception as e:
        # Rollback
        shutil.copy2(os.path.join(backup_dir, "model.joblib"), joblib_path)
        shutil.copy2(os.path.join(backup_dir, "metadata.json"), metadata_path)
        shutil.rmtree(backup_dir)
        raise HTTPException(status_code=500, detail=f"Edit failed: {str(e)}. Changes rolled back.")

@router.post("/{model_id}/class-image/{class_name}", response_model=dict)
async def upload_class_image(model_id: str, class_name: str, file: UploadFile = File(...)):
    """Upload custom identification image token for a class target category key."""
    model_dir = os.path.join(MODELS_DIR, model_id)
    if not os.path.exists(model_dir):
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
        
    # Standardize image save path
    image_filename = f"class_{class_name}.png"
    image_path = os.path.join(model_dir, image_filename)
    
    try:
        with open(image_path, "wb") as f:
            f.write(await file.read())
        return {"status": "success", "image_name": image_filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")

@router.post("/unload", response_model=dict)
def deactivate_active_model():
    """Clear active memory context (unload current active model)."""
    model_manager = ModelManager()
    model_manager.active_model_id = None
    return {"status": "success", "message": "Model unloaded from active memory."}

@router.get("/{model_id}/class-image/{class_name}")
def get_class_image(model_id: str, class_name: str):
    """Serve custom identification image token for a class target category key."""
    model_dir = os.path.join(MODELS_DIR, model_id)
    image_path = os.path.join(model_dir, f"class_{class_name}.png")
    
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image token for class not found")
        
    return FileResponse(image_path, media_type="image/png")