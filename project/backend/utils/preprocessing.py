import joblib
import json
import os

def validate_assets(joblib_file_path: str, metadata_file_path: str):
    """Raise an exception if the model joblib binary and metadata JSON are incompatible.
    Automatically infers and updates missing/alternative metadata keys.
    """
    schema = {}
    if os.path.exists(metadata_file_path) and os.path.getsize(metadata_file_path) > 0:
        try:
            with open(metadata_file_path, "r", encoding="utf-8") as f:
                schema = json.load(f)
        except Exception as e:
            # If metadata file exists but is invalid JSON, we start with empty and overwrite it
            schema = {}

    try:
        # Load model binary
        model = joblib.load(joblib_file_path)
    except Exception as e:
        raise ValueError(f"Failed to load joblib binary model file: {str(e)}")

    # 1. Search for custom feature names in schema
    features_list = []
    for key in ["features", "feature_names", "columns", "feature_list"]:
        val = schema.get(key)
        if isinstance(val, list):
            features_list = val
            break

    # 2. Search for custom class/target names in schema
    classes_list = []
    for key in ["classes", "target_names", "labels", "class_names"]:
        val = schema.get(key)
        if isinstance(val, list):
            classes_list = val
            break

    # 3. Search for task type in schema
    task_type = None
    for key in ["task_type", "type"]:
        val = schema.get(key)
        if val in ["classification", "regression"]:
            task_type = val
            break

    # 4. Introspect model properties
    actual_features_count = getattr(model, "n_features_in_", None)
    model_classes = getattr(model, "classes_", None)
    
    # 5. Infer task type if not defined
    if not task_type:
        if model_classes is not None:
            task_type = "classification"
        else:
            task_type = "regression"

    # 6. Resolve classes if task_type is classification
    if task_type == "classification":
        model_classes_list = list(model_classes) if model_classes is not None else []
        model_classes_str = [str(c) for c in model_classes_list]
        
        if not classes_list:
            classes_list = model_classes_str
        elif len(classes_list) != len(model_classes_str):
            raise ValueError(
                f"Class count mismatch: metadata lists {len(classes_list)} classes, "
                f"but model has {len(model_classes_str)} classes."
            )
    else:
        classes_list = []

    # 7. Resolve feature count
    inferred_features_count = actual_features_count
    if inferred_features_count is None:
        if features_list:
            inferred_features_count = len(features_list)
        else:
            inferred_features_count = schema.get("n_features_in_", 0)

    # 8. Resolve feature names
    if not features_list:
        if hasattr(model, "feature_names_in_"):
            features_list = list(model.feature_names_in_)
        elif inferred_features_count > 0:
            features_list = [f"feature_{i+1}" for i in range(inferred_features_count)]
        else:
            features_list = []

    # Final count validation
    if inferred_features_count > 0 and len(features_list) != inferred_features_count:
        raise ValueError(
            f"Feature count mismatch: expected {inferred_features_count} features, "
            f"but found {len(features_list)} feature names."
        )

    # 9. Standardize/Update schema dict
    schema["task_type"] = task_type
    schema["n_features_in_"] = inferred_features_count
    schema["features"] = features_list
    if task_type == "classification":
        schema["classes"] = classes_list
    else:
        schema.pop("classes", None)

    # Ensure model details/defaults are present
    if "model_name" not in schema:
        schema["model_name"] = type(model).__name__

    # Save the normalized schema back to the metadata JSON file
    try:
        with open(metadata_file_path, "w", encoding="utf-8") as f:
            json.dump(schema, f, indent=2)
    except Exception as e:
        raise ValueError(f"Failed to write normalized metadata: {str(e)}")

    return True