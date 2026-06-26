import os
from fastapi import APIRouter, HTTPException
from backend.supabase_client import supabase
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class Item(BaseModel):
    id: Optional[int] = None
    name: str
    created_at: Optional[str] = None

@router.get("/status")
async def get_status():
    from backend.supabase_client import SUPABASE_URL, key
    is_dummy = (supabase.__class__.__name__ == "DummyClient" or 
                not SUPABASE_URL or 
                "YOUR_SUPABASE_URL" in SUPABASE_URL or
                not key or 
                "YOUR_ANON_KEY" in key)
    
    if is_dummy:
        return {
            "connected": False,
            "url": None,
            "using_fallback": True,
            "table_exists": False,
            "error": "Missing or placeholder Supabase credentials in .env file"
        }
    
    # Try querying the table to check if it exists and works
    table_exists = False
    db_error = None
    try:
        # Simple test query to items table
        supabase.from_("items").select("id").limit(1).execute()
        table_exists = True
    except Exception as e:
        db_error = str(e)
        
    return {
        "connected": True,
        "url": SUPABASE_URL,
        "using_fallback": False,
        "table_exists": table_exists,
        "error": db_error
    }

@router.get("/items", response_model=list[Item])
async def list_items():
    try:
        resp = supabase.from_("items").select("*").execute()
        if hasattr(resp, 'error') and resp.error:
            raise HTTPException(status_code=500, detail=resp.error.message)
        # Ensure we return data or empty list
        return resp.data if resp.data else []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/items", response_model=Item)
async def create_item(item: Item):
    try:
        # Exclude None to allow database-level defaults (like serial id and default created_at)
        insert_data = item.dict(exclude_none=True)
        resp = supabase.from_("items").insert(insert_data).execute()
        if hasattr(resp, 'error') and resp.error:
            raise HTTPException(status_code=500, detail=resp.error.message)
        if not resp.data or len(resp.data) == 0:
            raise HTTPException(status_code=500, detail="Failed to insert item - no data returned")
        return resp.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/items/{item_id}", response_model=Item)
async def update_item(item_id: int, item: Item):
    try:
        # Update name or other fields, exclude None
        update_data = item.dict(exclude_none=True)
        # Prevent overwriting id
        if "id" in update_data:
            del update_data["id"]
            
        resp = (
            supabase.from_("items")
            .update(update_data)
            .eq("id", item_id)
            .execute()
        )
        if hasattr(resp, 'error') and resp.error:
            raise HTTPException(status_code=500, detail=resp.error.message)
        if not resp.data or len(resp.data) == 0:
            raise HTTPException(status_code=404, detail="Item not found or update failed")
        return resp.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/items/{item_id}")
async def delete_item(item_id: int):
    try:
        resp = supabase.from_("items").delete().eq("id", item_id).execute()
        if hasattr(resp, 'error') and resp.error:
            raise HTTPException(status_code=500, detail=resp.error.message)
        return {"status": "deleted", "id": item_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

