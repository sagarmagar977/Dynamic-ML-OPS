from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Any
from backend.utils.model_loader import ModelManager
import numpy as np

router = APIRouter()

class PredictionInput(BaseModel):
    features: List[Any]

@router.post("/", response_model=dict)
def predict(input_data: PredictionInput):
    """Make a single prediction with the active model."""
    model_manager = ModelManager()
    model_data = model_manager.get_active_model()
    
    if not model_data:
        raise HTTPException(status_code=400, detail="No model active. Please activate a model first.")
        
    try:
        model = model_data["binary"]
        metadata = model_data["metadata"]
        
        # Validate feature counts
        expected_features = metadata.get("n_features_in_", len(metadata.get("features", [])))
        if len(input_data.features) != expected_features:
            raise HTTPException(
                status_code=400,
                detail=f"Feature count mismatch: Expected {expected_features} features, got {len(input_data.features)}"
            )
            
        # Cast inputs to float
        try:
            numeric_features = [float(x) for x in input_data.features]
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Feature casting error: All inputs must be numeric. Details: {str(e)}"
            )
            
        input_array = np.array(numeric_features).reshape(1, -1)
        
        # Predict
        prediction = model.predict(input_array)
        pred_list = prediction.tolist()
        task_type = metadata.get("task_type", "unknown")
        
        result = {
            "status": "success",
            "prediction": pred_list[0] if len(pred_list) > 0 else None,
            "model_id": model_manager.active_model_id,
            "task_type": task_type,
            "target_name": metadata.get("target_name", "target")
        }
        
        # Add probability distribution if classification
        if task_type == "classification" and hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(input_array)[0].tolist()
            classes = [str(c) for c in model.classes_]
            
            prob_matrix = {cls: prob for cls, prob in zip(classes, probabilities)}
            result["probabilities"] = prob_matrix
            result["classes"] = classes
            
            # Map index/value to label
            raw_pred = pred_list[0]
            meta_classes = metadata.get("classes", [])
            
            # If Iris dataset classes are 0, 1, 2, they map to Iris-setosa etc
            if isinstance(raw_pred, (int, np.integer)) and raw_pred < len(meta_classes):
                result["prediction_label"] = meta_classes[raw_pred]
            else:
                result["prediction_label"] = str(raw_pred)
                
        return result
        
    except HTTPException as he:
        raise he
    except Exception as e:
        # Runtime fault protection as per PRD Section 4.2
        raise HTTPException(status_code=500, detail=f"Inference Engine runtime error: {str(e)}")