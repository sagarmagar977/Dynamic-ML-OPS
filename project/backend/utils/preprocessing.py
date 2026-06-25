import joblib
import json

def validate_assets(joblib_file_path: str, metadata_file_path: str):
    """Raise an exception if the model joblib binary and metadata JSON are incompatible."""
    try:
        # Load metadata
        with open(metadata_file_path, "r", encoding="utf-8") as f:
            schema = json.load(f)
    except Exception as e:
        raise ValueError(f"Failed to load or parse metadata JSON: {str(e)}")

    try:
        # Load model binary
        model = joblib.load(joblib_file_path)
    except Exception as e:
        raise ValueError(f"Failed to load joblib binary model file: {str(e)}")

    # Check feature counts
    expected_features = schema.get("n_features_in_")
    if expected_features is None:
        expected_features = len(schema.get("features", []))

    actual_features = getattr(model, "n_features_in_", None)
    
    if actual_features is not None and actual_features != expected_features:
        raise ValueError(f"Feature count mismatch: model expects {actual_features} features, but schema defines {expected_features}.")

    # Check task type and model class capabilities
    task_type = schema.get("task_type")
    if not task_type:
        raise ValueError("Task type ('classification' or 'regression') must be defined in metadata schema.")

    if task_type == "classification":
        if not hasattr(model, "classes_"):
            raise ValueError("Model is declared as 'classification' but does not have a classes_ attribute.")
        
        schema_classes = schema.get("classes", [])
        model_classes = list(model.classes_)
        str_schema_classes = [str(c) for c in schema_classes]
        str_model_classes = [str(c) for c in model_classes]
        
        if len(str_schema_classes) != len(str_model_classes):
            raise ValueError(f"Class count mismatch: metadata lists {len(str_schema_classes)} classes, but model has {len(str_model_classes)} classes.")
            
    elif task_type == "regression":
        if hasattr(model, "classes_"):
            raise ValueError("Model has classes_ attribute but is declared as 'regression'.")
    else:
        raise ValueError(f"Unknown task_type: {task_type}. Must be 'classification' or 'regression'.")

    return True