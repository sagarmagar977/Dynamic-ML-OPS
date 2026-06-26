import os
import sys
import json

# Ensure project root is in python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.supabase_client import supabase, SUPABASE_URL, key

def migrate():
    is_dummy = (supabase.__class__.__name__ == "DummyClient" or 
                not SUPABASE_URL or 
                "YOUR_SUPABASE_URL" in SUPABASE_URL or
                not key or 
                "YOUR_ANON_KEY" in key)
                
    if is_dummy:
        print("Error: Supabase is not configured yet. Please update project/backend/.env first with your actual database URL and key.")
        return

    base_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.join(base_dir, "models")
    
    if not os.path.exists(models_dir):
        print(f"No local models folder found at {models_dir}")
        return

    print("Starting migration of local models to Supabase...")
    
    migrated_count = 0
    for model_id in os.listdir(models_dir):
        if model_id.startswith("backup_") or model_id.startswith("temp_"):
            continue
            
        model_path = os.path.join(models_dir, model_id)
        if os.path.isdir(model_path):
            joblib_path = os.path.join(model_path, "model.joblib")
            metadata_path = os.path.join(model_path, "metadata.json")
            
            if not os.path.exists(joblib_path) or not os.path.exists(metadata_path):
                print(f"Skipping {model_id} (missing model.joblib or metadata.json)")
                continue
                
            print(f"\nMigrating model: {model_id}...")
            
            # 1. Load local metadata json file
            try:
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    meta_json = json.load(f)
            except Exception as e:
                print(f"  ✗ Failed to read metadata for {model_id}: {e}")
                continue
                
            # 2. Insert or upsert metadata to public.models table
            try:
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
                    "colab_link": meta_json.get("colab_link")
                }
                
                supabase.from_("models").upsert(model_record).execute()
                print(f"  ✓ Metadata upserted to 'models' table")
            except Exception as e:
                print(f"  ✗ Failed to upsert metadata: {e}")
                continue
                
            # 3. Read files and upload to 'models' storage bucket
            try:
                with open(joblib_path, "rb") as f:
                    model_bytes = f.read()
                with open(metadata_path, "rb") as f:
                    meta_bytes = f.read()
                    
                # Clean up existing files in storage to avoid duplicates or access errors
                try:
                    supabase.storage.from_("models").remove([f"{model_id}/model.joblib", f"{model_id}/metadata.json"])
                except Exception:
                    pass
                    
                supabase.storage.from_("models").upload(f"{model_id}/model.joblib", model_bytes)
                supabase.storage.from_("models").upload(f"{model_id}/metadata.json", meta_bytes)
                print(f"  ✓ model.joblib and metadata.json uploaded to 'models' bucket")
                migrated_count += 1
            except Exception as e:
                print(f"  ✗ Storage upload failed: {e}. Please ensure the public bucket 'models' is created in Supabase.")
                
    print(f"\nMigration finished. Successfully migrated {migrated_count} models.")

if __name__ == "__main__":
    migrate()
