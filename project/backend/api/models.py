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
    
    # Try getting from Supabase first if connected
    from backend.supabase_client import supabase, SUPABASE_URL, key
    is_dummy = (supabase.__class__.__name__ == "DummyClient" or 
                not SUPABASE_URL or 
                "YOUR_SUPABASE_URL" in SUPABASE_URL or
                not key or 
                "YOUR_ANON_KEY" in key)
    
    if not is_dummy:
        try:
            resp = supabase.from_("models").select("*").execute()
            if hasattr(resp, "error") and resp.error:
                raise Exception(resp.error.message)
            
            models_list = []
            from datetime import datetime
            def to_epoch(dt_str):
                if not dt_str:
                    return 0.0
                try:
                    clean_str = dt_str.replace("Z", "+00:00")
                    return datetime.fromisoformat(clean_str).timestamp()
                except Exception:
                    return 0.0
                    
            for row in resp.data:
                models_list.append({
                    "id": row["id"],
                    "name": row.get("name") or row["id"],
                    "algorithm_variant": row.get("algorithm_variant") or "Unknown",
                    "task_type": row.get("task_type") or "unknown",
                    "features": row.get("features") or [],
                    "n_features_in_": row.get("n_features_in_", 0),
                    "target_name": row.get("target_name") or "target",
                    "metrics": row.get("metrics") or {},
                    "classes": row.get("classes") or [],
                    "colab_link": row.get("colab_link"),
                    "active": model_manager.active_model_id == row["id"],
                    "created_at": to_epoch(row.get("created_at")),
                    "modified_at": to_epoch(row.get("modified_at"))
                })
            return {"models": models_list}
        except Exception as e:
            print(f"Supabase models list failed: {e}. Falling back to disk storage.")

    # Fallback to local files scanning
    models_list = []
    if not os.path.exists(MODELS_DIR):
        return {"models": []}
        
    for model_id in os.listdir(MODELS_DIR):
        if model_id.startswith("backup_") or model_id.startswith("temp_"):
            continue
        model_path = os.path.join(MODELS_DIR, model_id)
        if os.path.isdir(model_path):
            metadata_path = os.path.join(model_path, "metadata.json")
            if os.path.exists(metadata_path):
                try:
                    with open(metadata_path, 'r', encoding='utf-8') as f:
                        metadata = json.load(f)

                    joblib_path = os.path.join(model_path, "model.joblib")
                    created_time = os.path.getctime(model_path)
                    modified_time = os.path.getmtime(joblib_path) if os.path.exists(joblib_path) else created_time

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
                        "colab_link": metadata.get("colab_link"),
                        "active": model_manager.active_model_id == model_id,
                        "created_at": created_time,
                        "modified_at": modified_time
                    })
                except Exception:
                    continue
    
    return {"models": models_list}

@router.post("/{model_id}/activate", response_model=dict)
def activate_model(model_id: str):
    """Activate a model (hot-swap in volatile execution memory)."""
    model_manager = ModelManager()
    
    # Trigger model caching download if it is in Supabase but not local
    try:
        model_manager.load_model(model_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Model {model_id} initialization failed: {str(e)}")
        
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
    
    # Remove from Supabase if connected
    from backend.supabase_client import supabase, SUPABASE_URL, key
    is_dummy = (supabase.__class__.__name__ == "DummyClient" or 
                not SUPABASE_URL or 
                "YOUR_SUPABASE_URL" in SUPABASE_URL or
                not key or 
                "YOUR_ANON_KEY" in key)
    
    if not is_dummy:
        try:
            supabase.from_("models").delete().eq("id", model_id).execute()
        except Exception as e:
            print(f"Supabase DB delete failed: {e}")
            
        try:
            supabase.storage.from_("models").remove([f"{model_id}/model.joblib", f"{model_id}/metadata.json"])
        except Exception as e:
            print(f"Supabase Storage files delete warning: {e}")

    model_path = os.path.join(MODELS_DIR, model_id)
    if not os.path.exists(model_path):
        # If it was in Supabase, we already deleted it there. Let's return success if it's missing locally too.
        model_manager.delete_model_from_cache(model_id)
        return {"status": "success", "deleted_model": model_id}
    
    try:
        shutil.rmtree(model_path)
        model_manager.delete_model_from_cache(model_id)
        return {"status": "success", "deleted_model": model_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/deploy", response_model=dict)
async def deploy_model(
    model_id: str = Form(...),
    model_file: UploadFile = File(...),
    metadata_file: Optional[UploadFile] = File(None),
    colab_link: Optional[str] = Form(None)
):
    """Deploy/upload a new dual model asset pair (model.joblib & metadata.json)."""
    temp_id = f"temp_{model_id}"
    temp_dir = os.path.join(MODELS_DIR, temp_id)
    os.makedirs(temp_dir, exist_ok=True)
    
    temp_model_path = os.path.join(temp_dir, "model.joblib")
    temp_meta_path = os.path.join(temp_dir, "metadata.json")
    
    try:
        with open(temp_model_path, "wb") as f:
            f.write(await model_file.read())
            
        if metadata_file is not None:
            meta_content = await metadata_file.read()
            meta_json = json.loads(meta_content.decode("utf-8"))
        else:
            meta_json = {}
        
        # Inject Google Colab link into metadata
        meta_json["colab_link"] = colab_link if colab_link != "" else None
        
        with open(temp_meta_path, "w", encoding="utf-8") as f:
            json.dump(meta_json, f, indent=2)
            
        validate_assets(temp_model_path, temp_meta_path)
        
        final_dir = os.path.join(MODELS_DIR, model_id)
        if os.path.exists(final_dir):
            shutil.rmtree(final_dir)
        os.makedirs(final_dir, exist_ok=True)
        
        shutil.move(temp_model_path, os.path.join(final_dir, "model.joblib"))
        shutil.move(temp_meta_path, os.path.join(final_dir, "metadata.json"))
        
        # Sync to Supabase if connected
        from backend.supabase_client import supabase, SUPABASE_URL, key
        is_dummy = (supabase.__class__.__name__ == "DummyClient" or 
                    not SUPABASE_URL or 
                    "YOUR_SUPABASE_URL" in SUPABASE_URL or
                    not key or 
                    "YOUR_ANON_KEY" in key)
        
        if not is_dummy:
            try:
                # 1. Sync metadata to Supabase public.models table
                model_record = {
                    "id": model_id,
                    "name": meta_json.get("model_name") or model_id,
                    "algorithm_variant": meta_json.get("algorithm_variant") or "Unknown",
                    "task_type": meta_json.get("task_type") or "unknown",
                    "features": meta_json.get("features") or [],
                    "n_features_in_": meta_json.get("n_features_in_") or len(meta_json.get("features") or []),
                    "target_name": meta_json.get("target_name") or "target",
                    "metrics": meta_json.get("metrics") or {},
                    "classes": meta_json.get("classes") or [],
                    "colab_link": colab_link if colab_link != "" else None
                }
                supabase.from_("models").upsert(model_record).execute()
            except Exception as e:
                print(f"Supabase DB metadata deployment sync warning: {e}")
                
            try:
                # 2. Upload files to Supabase Storage models bucket
                with open(os.path.join(final_dir, "model.joblib"), "rb") as f:
                    model_bytes = f.read()
                with open(os.path.join(final_dir, "metadata.json"), "rb") as f:
                    meta_bytes = f.read()
                    
                # Pre-clean storage files to enable overwrite
                try:
                    supabase.storage.from_("models").remove([f"{model_id}/model.joblib", f"{model_id}/metadata.json"])
                except Exception:
                    pass
                    
                supabase.storage.from_("models").upload(f"{model_id}/model.joblib", model_bytes)
                supabase.storage.from_("models").upload(f"{model_id}/metadata.json", meta_bytes)
            except Exception as e:
                print(f"Supabase Storage file upload warning: {e}")
        
        return {"status": "success", "model_id": model_id}
        
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=f"Validation failed: {str(val_err)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deployment failed: {str(e)}")
    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

@router.post("/{model_id}/edit", response_model=dict)
async def edit_model(
    model_id: str,
    model_file: Optional[UploadFile] = File(None),
    metadata_file: Optional[UploadFile] = File(None),
    model_name: Optional[str] = Form(None),
    colab_link: Optional[str] = Form(None)
):
    """Edit/overwrite parts of an existing model. Triggers soft reload if active."""
    model_dir = os.path.join(MODELS_DIR, model_id)
    
    # Try downloading missing files from Supabase to construct cache locally if editing a Supabase-only model
    if not os.path.exists(model_dir):
        from backend.utils.model_loader import ModelManager as LoaderClass
        try:
            LoaderClass().load_model(model_id)
        except Exception:
            pass
            
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
        # Perform replacements locally first
        if model_file is not None:
            with open(joblib_path, "wb") as f:
                f.write(await model_file.read())
                
        if metadata_file is not None:
            meta_content = await metadata_file.read()
            meta_json = json.loads(meta_content.decode("utf-8"))
        else:
            with open(metadata_path, 'r', encoding='utf-8') as f:
                meta_json = json.load(f)
                
        if model_name is not None:
            meta_json["model_name"] = model_name
        if colab_link is not None:
            meta_json["colab_link"] = colab_link if colab_link != "" else None
            
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(meta_json, f, indent=2)
            
        validate_assets(joblib_path, metadata_path)
        
        # Clear backup
        shutil.rmtree(backup_dir)
        
        # Sync updates to Supabase if connected
        from backend.supabase_client import supabase, SUPABASE_URL, key
        is_dummy = (supabase.__class__.__name__ == "DummyClient" or 
                    not SUPABASE_URL or 
                    "YOUR_SUPABASE_URL" in SUPABASE_URL or
                    not key or 
                    "YOUR_ANON_KEY" in key)
        
        if not is_dummy:
            try:
                from datetime import datetime
                db_update = {
                    "name": meta_json.get("model_name") or model_id,
                    "colab_link": meta_json.get("colab_link"),
                    "algorithm_variant": meta_json.get("algorithm_variant") or "Unknown",
                    "task_type": meta_json.get("task_type") or "unknown",
                    "features": meta_json.get("features") or [],
                    "n_features_in_": meta_json.get("n_features_in_") or len(meta_json.get("features") or []),
                    "target_name": meta_json.get("target_name") or "target",
                    "metrics": meta_json.get("metrics") or {},
                    "classes": meta_json.get("classes") or [],
                    "modified_at": datetime.utcnow().isoformat()
                }
                supabase.from_("models").update(db_update).eq("id", model_id).execute()
            except Exception as e:
                print(f"Supabase DB edit sync warning: {e}")
                
            try:
                # Update files in Storage
                with open(joblib_path, "rb") as f:
                    model_bytes = f.read()
                with open(metadata_path, "rb") as f:
                    meta_bytes = f.read()
                    
                try:
                    supabase.storage.from_("models").remove([f"{model_id}/model.joblib", f"{model_id}/metadata.json"])
                except Exception:
                    pass
                    
                supabase.storage.from_("models").upload(f"{model_id}/model.joblib", model_bytes)
                supabase.storage.from_("models").upload(f"{model_id}/metadata.json", meta_bytes)
            except Exception as e:
                print(f"Supabase Storage edit sync warning: {e}")
        
        # Soft reload if active in memory
        model_manager = ModelManager()
        if model_id in model_manager.models:
            del model_manager.models[model_id]
        if model_manager.active_model_id == model_id:
            model_manager.activate_model(model_id)
            
        return {"status": "success", "model_id": model_id, "reloaded": model_manager.active_model_id == model_id}
        
    except ValueError as val_err:
        shutil.copy2(os.path.join(backup_dir, "model.joblib"), joblib_path)
        shutil.copy2(os.path.join(backup_dir, "metadata.json"), metadata_path)
        shutil.rmtree(backup_dir)
        raise HTTPException(status_code=400, detail=f"Edit Validation failed: {str(val_err)}. Changes rolled back.")
    except Exception as e:
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

@router.post("/inspect", response_model=dict)
async def inspect_model(model_file: UploadFile = File(...)):
    """
    Inspect a joblib model file. Returns task type, classes, and version compatibility info.
    - If sklearn versions mismatch but model still loads: returns a version_warning with exact pip command.
    - If model cannot load at all: returns structured 400 with exact pip install command to fix it.
    """
    import tempfile
    import joblib
    import warnings
    import re
    import sklearn
    import numpy
    import pandas

    SERVER_SKLEARN  = sklearn.__version__
    SERVER_NUMPY    = numpy.__version__
    SERVER_PANDAS   = pandas.__version__

    # This server is pinned to Google Colab's default environment.
    # Users who train in standard Colab (without upgrading packages) are always compatible.
    PIP_FIX_CMD = (
        f"# These are Google Colab's default versions — matches this server exactly.\n"
        f"# Run this ONLY if you upgraded packages in Colab. Otherwise just use Colab as-is.\n"
        f"!pip install scikit-learn=={SERVER_SKLEARN} "
        f"numpy=={SERVER_NUMPY} "
        f"pandas=={SERVER_PANDAS} --quiet"
    )

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".joblib") as tmp:
            tmp.write(await model_file.read())
            temp_path = tmp.name

        model = None
        raw_warnings = []

        try:
            with warnings.catch_warnings(record=True) as caught:
                warnings.simplefilter("always")
                model = joblib.load(temp_path)
                raw_warnings = [str(w.message) for w in caught]
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

        if model is None:
            raise ValueError("Model file loaded as None — file may be empty or corrupt.")

        # --- Parse version mismatch from sklearn's InconsistentVersionWarning ---
        # sklearn warning text: "Trying to unpickle estimator X from version Y when using version Z."
        model_sklearn_version = None
        version_warning = None

        for msg in raw_warnings:
            match = re.search(
                r"from version (\S+) when using version (\S+)", msg
            )
            if match:
                model_sklearn_version = match.group(1)
                server_ver            = match.group(2)
                version_warning = {
                    "severity": "warning",
                    "model_sklearn_version": model_sklearn_version,
                    "server_sklearn_version": server_ver,
                    "message": (
                        f"Your model was trained with scikit-learn {model_sklearn_version}, "
                        f"but this server runs scikit-learn {server_ver}. "
                        f"The model loaded successfully, but results may differ slightly."
                    ),
                    "fix_command": PIP_FIX_CMD,
                }
                break

        # --- Build response ---
        model_classes = getattr(model, "classes_", None)
        base = {
            "server_sklearn_version":  SERVER_SKLEARN,
            "server_numpy_version":    SERVER_NUMPY,
            "server_pandas_version":   SERVER_PANDAS,
            "model_sklearn_version":   model_sklearn_version,
            "version_warning":         version_warning,
        }

        if model_classes is not None:
            return {**base, "task_type": "classification", "classes": [str(c) for c in model_classes]}
        else:
            return {**base, "task_type": "regression"}

    except Exception as e:
        error_str = str(e)

        # Try to extract the model's sklearn version from the exception message
        model_ver_in_error = None
        match = re.search(r"from version (\S+) when using version (\S+)", error_str)
        if match:
            model_ver_in_error = match.group(1)

        version_detail = ""
        if model_ver_in_error:
            version_detail = (
                f" Your model was saved with scikit-learn {model_ver_in_error}. "
                f"This server runs scikit-learn {SERVER_SKLEARN}."
            )

        raise HTTPException(
            status_code=400,
            detail={
                "error": "version_mismatch" if model_ver_in_error else "load_failed",
                "message": f"Failed to load model file.{version_detail}",
                "model_sklearn_version": model_ver_in_error,
                "server_sklearn_version": SERVER_SKLEARN,
                "server_numpy_version":   SERVER_NUMPY,
                "server_pandas_version":  SERVER_PANDAS,
                "fix_command": PIP_FIX_CMD,
                "raw_error": error_str,
            }
        )