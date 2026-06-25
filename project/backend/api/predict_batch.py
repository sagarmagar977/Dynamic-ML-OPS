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
        
        expected_features = metadata.get("n_features_in_", len(metadata.get("features", [])))
        
        processed_rows = []
        for idx, row in enumerate(input_data.features):
            if len(row) != expected_features:
                raise HTTPException(
                    status_code=400,
                    detail=f"Row {idx} mismatch: Expected {expected_features} features, got {len(row)}."
                )
            try:
                numeric_row = [float(x) for x in row]
                processed_rows.append(numeric_row)
            except ValueError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Row {idx} casting failed: values must be numeric. Details: {str(e)}"
                )
                
        input_array = np.array(processed_rows)
        predictions = model.predict(input_array).tolist()
        
        result = {
            "status": "success",
            "predictions": predictions,
            "model_id": model_manager.active_model_id
        }
        
        if metadata.get("task_type") == "classification" and hasattr(model, "predict_proba"):
            result["probabilities"] = model.predict_proba(input_array).tolist()
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
        expected_features = metadata.get("n_features_in_", len(metadata.get("features", [])))
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
        
        for idx, row in enumerate(data_rows):
            if not row or all(x.strip() == "" for x in row):
                continue
                
            sub_row = row[:expected_features]
            if len(sub_row) < expected_features:
                sub_row += ["0.0"] * (expected_features - len(sub_row))
                
            try:
                numeric_row = [float(x) for x in sub_row]
                numeric_data.append(numeric_row)
                valid_rows_indices.append(idx)
            except ValueError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"CSV row {idx + data_rows_start + 1} parse error: all features must be numeric. Details: {str(e)}"
                )
                
        if not numeric_data:
            raise HTTPException(status_code=400, detail="No valid data rows found in CSV.")
            
        input_array = np.array(numeric_data)
        predictions = model.predict(input_array)
        
        output_header = list(header)
        target_name = metadata.get("target_name", "prediction")
        output_header.append(target_name)
        
        classes = []
        probabilities = None
        if task_type == "classification":
            output_header.append("prediction_label")
            if hasattr(model, "predict_proba"):
                probabilities = model.predict_proba(input_array)
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