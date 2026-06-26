import os
import joblib
import json
from typing import Optional, Dict, Any

class ModelManager:
    _instance: Optional['ModelManager'] = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(ModelManager, cls).__new__(cls)
            cls._instance.active_model_id = None
            cls._instance.models = {}  # Cache of loaded models: model_id -> {"binary": model, "metadata": metadata}
        return cls._instance

    def load_model(self, model_id: str) -> Dict[str, Any]:
        """Loads a model's joblib binary and its metadata.json if not already cached."""
        if model_id in self.models:
            return self.models[model_id]
            
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        model_dir = os.path.join(base_dir, "models", model_id)
        
        joblib_path = os.path.join(model_dir, "model.joblib")
        metadata_path = os.path.join(model_dir, "metadata.json")
        
        # Check if files exist locally. If they do not, try downloading from Supabase Storage
        if not os.path.exists(joblib_path) or not os.path.exists(metadata_path):
            from backend.supabase_client import supabase, SUPABASE_URL, key
            is_dummy = (supabase.__class__.__name__ == "DummyClient" or 
                        not SUPABASE_URL or 
                        "YOUR_SUPABASE_URL" in SUPABASE_URL or
                        not key or 
                        "YOUR_ANON_KEY" in key)
            
            if not is_dummy:
                os.makedirs(model_dir, exist_ok=True)
                if not os.path.exists(joblib_path):
                    try:
                        res = supabase.storage.from_("models").download(f"{model_id}/model.joblib")
                        if res:
                            with open(joblib_path, "wb") as f:
                                f.write(res)
                    except Exception as e:
                        print(f"Failed to download model.joblib from Supabase Storage: {e}")
                
                if not os.path.exists(metadata_path):
                    try:
                        res = supabase.storage.from_("models").download(f"{model_id}/metadata.json")
                        if res:
                            with open(metadata_path, "wb") as f:
                                f.write(res)
                    except Exception as e:
                        print(f"Failed to download metadata.json from Supabase Storage: {e}")

        if not os.path.exists(joblib_path):
            raise FileNotFoundError(f"Model file {joblib_path} does not exist.")
        if not os.path.exists(metadata_path):
            raise FileNotFoundError(f"Metadata file {metadata_path} does not exist.")
            
        # Read metadata using UTF-8 encoding
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
            
        binary = joblib.load(joblib_path)
        
        self.models[model_id] = {
            "binary": binary,
            "metadata": metadata
        }
        return self.models[model_id]

    def activate_model(self, model_id: str) -> Dict[str, Any]:
        """Loads the model and sets it as active, flushing other cache models to trigger garbage collection."""
        if self.active_model_id and self.active_model_id != model_id:
            # Flushes memory path as per PRD Section 2.1
            if self.active_model_id in self.models:
                del self.models[self.active_model_id]
                
        model_data = self.load_model(model_id)
        self.active_model_id = model_id
        return model_data

    def get_active_model(self) -> Optional[Dict[str, Any]]:
        """Returns the loaded data for the currently active model."""
        if not self.active_model_id:
            return None
        return self.load_model(self.active_model_id)

    def delete_model_from_cache(self, model_id: str):
        """Removes a model's reference from cache."""
        if model_id in self.models:
            del self.models[model_id]
        if self.active_model_id == model_id:
            self.active_model_id = None