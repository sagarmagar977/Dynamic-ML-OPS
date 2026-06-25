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