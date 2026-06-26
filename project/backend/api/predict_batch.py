from fastapi import APIRouter, HTTPException, UploadFile, File, Response
from pydantic import BaseModel
from typing import List, Any
from backend.utils.model_loader import ModelManager
import numpy as np
import csv
import io

router = APIRouter()

class BatchPredictionInput(BaseModel):
    features: List[List[Any]]

@router.post("/", response_model=dict)
def predict_batch(input_data: BatchPredictionInput):
    """Make batch predictions with JSON inputs."""
    model_manager = ModelManager()
    model_data = model_manager.get_active_model()
    
    if not model_data:
        raise HTTPException(status_code=400, detail="No model active. Please activate a model first.")
        
    try:
        model = model_data["binary"]
        metadata = model_data["metadata"]
        
        # Validate expected features count dynamically
        expected_features = metadata.get("n_features_in_")
        if not expected_features:
            features_config = metadata.get("features", [])
            if isinstance(features_config, list):
                expected_features = len(features_config)
        if not expected_features and hasattr(model, "n_features_in_"):
            expected_features = model.n_features_in_
        if not expected_features and len(input_data.features) > 0:
            expected_features = len(input_data.features[0])
            
        features_config = metadata.get("features", []) if isinstance(metadata.get("features"), list) else []
        
        processed_rows = []
        for idx, row in enumerate(input_data.features):
            if len(row) != expected_features:
                raise HTTPException(
                    status_code=400,
                    detail=f"Row {idx} mismatch: Expected {expected_features} features, got {len(row)}."
                )
            processed_row = []
            for i, val in enumerate(row):
                feat_type = "continuous"
                if i < len(features_config):
                    f_item = features_config[i]
                    if isinstance(f_item, dict):
                        feat_type = f_item.get("type", "continuous")
                        
                if feat_type in ("numerical", "continuous"):
                    try:
                        processed_row.append(float(val))
                    except (ValueError, TypeError):
                        processed_row.append(str(val))
                else:
                    processed_row.append(str(val))
            processed_rows.append(processed_row)
                 
        input_array = np.array(processed_rows, dtype=object)
        import pandas as pd
        
        feature_names = []
        for f in features_config:
            if isinstance(f, dict):
                feature_names.append(f.get("name") or "")
            elif isinstance(f, str):
                feature_names.append(f)
                
        # If metadata doesn't have valid feature names, try scikit-learn model attributes
        if len(feature_names) != expected_features or not all(feature_names):
            if hasattr(model, "feature_names_in_"):
                feature_names = [str(n) for n in model.feature_names_in_]
            elif hasattr(model, "steps"):
                for name, step in model.steps:
                    if hasattr(step, "feature_names_in_"):
                        feature_names = [str(n) for n in step.feature_names_in_]
                        break
                        
        # Fallback to string index if feature names still mismatched
        if len(feature_names) != expected_features:
            feature_names = [str(i) for i in range(expected_features)]
            
        input_df = pd.DataFrame(input_array, columns=feature_names)
        predictions = model.predict(input_df).tolist()
        
        result = {
            "status": "success",
            "predictions": predictions,
            "model_id": model_manager.active_model_id
        }
        
        if metadata.get("task_type") == "classification" and hasattr(model, "predict_proba"):
            result["probabilities"] = model.predict_proba(input_df).tolist()
            result["classes"] = [str(c) for c in model.classes_]
            
        return result
        
    except HTTPException as he:
        raise he
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Batch inference engine error: {str(e)}")

@router.post("/csv")
async def predict_batch_csv(file: UploadFile = File(...)):
    """Make batch predictions from uploaded CSV, returning a transformed CSV with predictions."""
    model_manager = ModelManager()
    model_data = model_manager.get_active_model()
    
    if not model_data:
        raise HTTPException(status_code=400, detail="No model active. Please activate a model first.")
        
    try:
        model = model_data["binary"]
        metadata = model_data["metadata"]
        expected_features = metadata.get("n_features_in_")
        if not expected_features:
            features_config = metadata.get("features", [])
            if isinstance(features_config, list):
                expected_features = len(features_config)
        if not expected_features and hasattr(model, "n_features_in_"):
            expected_features = model.n_features_in_
        if not expected_features:
            # Fallback to the length of columns in first data row
            expected_features = len(first_row)
            
        task_type = metadata.get("task_type", "unknown")
        
        content = await file.read()
        csv_text = content.decode("utf-8")
        
        reader = csv.reader(io.StringIO(csv_text))
        rows = list(reader)
        
        if not rows:
            raise HTTPException(status_code=400, detail="Uploaded CSV file is empty.")
            
        # Determine if header exists
        first_row = rows[0]
        has_header = False
        
        for val in first_row:
            try:
                float(val)
            except ValueError:
                has_header = True
                break
                
        header = []
        data_rows_start = 0
        
        if has_header:
            header = first_row
            data_rows_start = 1
        else:
            header = [f"feature_{i}" for i in range(expected_features)]
            
        data_rows = rows[data_rows_start:]
        
        numeric_data = []
        valid_rows_indices = []
        features_config = metadata.get("features", []) if isinstance(metadata.get("features"), list) else []
        
        for idx, row in enumerate(data_rows):
            if not row or all(x.strip() == "" for x in row):
                continue
                
            sub_row = row[:expected_features]
            if len(sub_row) < expected_features:
                sub_row += ["0.0"] * (expected_features - len(sub_row))
                
            processed_row = []
            for i, val in enumerate(sub_row):
                feat_type = "continuous"
                if i < len(features_config):
                    f_item = features_config[i]
                    if isinstance(f_item, dict):
                        feat_type = f_item.get("type", "continuous")
                        
                if feat_type in ("numerical", "continuous"):
                    try:
                        processed_row.append(float(val))
                    except (ValueError, TypeError):
                        processed_row.append(str(val))
                else:
                    processed_row.append(str(val))
                         
            numeric_data.append(processed_row)
            valid_rows_indices.append(idx)
                 
        if not numeric_data:
            raise HTTPException(status_code=400, detail="No valid data rows found in CSV.")
            
        input_array = np.array(numeric_data, dtype=object)
        import pandas as pd
        
        feature_names = []
        for f in features_config:
            if isinstance(f, dict):
                feature_names.append(f.get("name") or "")
            elif isinstance(f, str):
                feature_names.append(f)
                
        # If metadata doesn't have valid feature names, try scikit-learn model attributes
        if len(feature_names) != expected_features or not all(feature_names):
            if hasattr(model, "feature_names_in_"):
                feature_names = [str(n) for n in model.feature_names_in_]
            elif hasattr(model, "steps"):
                for name, step in model.steps:
                    if hasattr(step, "feature_names_in_"):
                        feature_names = [str(n) for n in step.feature_names_in_]
                        break
                        
        # Fallback to string index if feature names still mismatched
        if len(feature_names) != expected_features:
            feature_names = [str(i) for i in range(expected_features)]
            
        input_df = pd.DataFrame(input_array, columns=feature_names)
        predictions = model.predict(input_df)
        
        output_header = list(header)
        target_name = metadata.get("target_name", "prediction")
        output_header.append(target_name)
        
        classes = []
        probabilities = None
        if task_type == "classification":
            output_header.append("prediction_label")
            if hasattr(model, "predict_proba"):
                probabilities = model.predict_proba(input_df)
                classes = [str(c) for c in model.classes_]
                for cls in classes:
                    output_header.append(f"probability_{cls}")
                    
        output_rows = [output_header]
        meta_classes = metadata.get("classes", [])
        
        predict_idx = 0
        for idx, row in enumerate(data_rows):
            if not row or all(x.strip() == "" for x in row):
                continue
                
            pred_val = predictions[predict_idx]
            new_row = list(row)
            new_row.append(str(pred_val))
            
            if task_type == "classification":
                label = str(pred_val)
                if isinstance(pred_val, (int, np.integer)) and pred_val < len(meta_classes):
                    label = meta_classes[pred_val]
                new_row.append(label)
                
                if probabilities is not None:
                    row_probs = probabilities[predict_idx]
                    for prob in row_probs:
                        new_row.append(f"{prob:.4f}")
                        
            output_rows.append(new_row)
            predict_idx += 1
            
        output_stream = io.StringIO()
        writer = csv.writer(output_stream)
        writer.writerows(output_rows)
        
        response_data = output_stream.getvalue().encode("utf-8")
        
        return Response(
            content=response_data,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=predictions_{file.filename}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSV batch inference runtime error: {str(e)}")