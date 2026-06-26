from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import urllib.request
import urllib.error
import json
import os

from backend.api.predict import predict, PredictionInput
from backend.api.models import list_models, activate_model
from backend.utils.model_loader import ModelManager

router = APIRouter()

class ChatMessage(BaseModel):
    role: str # "user" or "model"
    text: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    model_id: Optional[str] = None

@router.post("/chat", response_model=dict)
async def chat_with_agent(
    request: ChatRequest,
    x_gemini_key: Optional[str] = Header(None)
):
    """Chat endpoint that uses Gemini to intelligently decide actions (predict, list, activate) and generate responses."""
    api_key = x_gemini_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="Gemini API Key is missing. Please configure GEMINI_API_KEY in the environment or supply it in settings."
        )

    # 1. Retrieve Active Model Context
    model_manager = ModelManager()
    active_model_id = model_manager.active_model_id
    active_model_data = model_manager.get_active_model()

    system_instruction = (
        "You are 'OmniPredictor AI Agent', a premium agentic assistant running in a machine learning registry workspace.\n"
        "You have tool-calling powers. You must choose an action and construct a response.\n\n"
        "AVAILABLE ACTIONS:\n"
        "- 'predict': Select this if the user inputs numeric values or asks to predict/inference values. You must parse the input into a flat list of float numbers under 'prediction_features'.\n"
        "- 'activate': Select this if the user asks to activate a model by ID. Put the model ID in 'activate_model_id'.\n"
        "- 'list_models': Select this if the user asks to list, show, or ledger all models.\n"
        "- 'chat': Default chat fallback for discussions, explanations, or inquiries.\n\n"
        "WEBAPP CONTROL INSTRUCTION:\n"
        "When the user requests you to change state, list, or activate a model, inform them that you are taking control of the webapp to perform this action. The UI will automatically update based on your command.\n"
    )

    if active_model_data:
        meta = active_model_data.get("metadata", {})
        feat_names = meta.get("features", [])
        system_instruction += (
            f"ACTIVE MODEL CONTEXT:\n"
            f"- Model ID: {active_model_id}\n"
            f"- Name: {meta.get('model_name', active_model_id)}\n"
            f"- Task Type: {meta.get('task_type', 'unknown')}\n"
            f"- Expected Features Count: {meta.get('n_features_in_', len(feat_names))}\n"
            f"- Feature Names (in order): {', '.join(feat_names)}\n"
            f"- Classes (if classification): {', '.join(meta.get('classes', []))}\n\n"
            "INSTRUCTIONS:\n"
            "1. When the user asks to predict or provides a sequence of numbers (e.g. '5.1, 3.5, 1.4, 0.2' or describes feature values), set action='predict' and extract the floats in 'prediction_features' exactly matching the expected feature count and order.\n"
            "2. When explaining prediction outcomes, explain exactly WHY this result occurred. Analyze the input features supplied by the user (e.g., 'because your feature X is high and feature Y is low, which correlates to this output class based on training correlations'). Keep explanation highly analytical and specific to the features.\n"
        )
    else:
        system_instruction += (
            "NO MODEL IS CURRENTLY ACTIVE.\n"
            "Politely inform the user they can upload a model (.joblib + metadata.json) or activate one from the list.\n"
        )

    # 2. Format history & prompt for Gemini API
    # Gemini API expects format: [{"role": "user"|"model", "parts": [{"text": "..."}]}]
    contents = []
    
    # We pass the system instruction as a user message at the very beginning to keep context
    contents.append({
        "role": "user",
        "parts": [{"text": f"[System Instructions]:\n{system_instruction}"}]
    })
    contents.append({
        "role": "model",
        "parts": [{"text": "Acknowledge workspace context. Ready to assist."}]
    })

    # Load history
    for msg in request.history:
        contents.append({
            "role": "user" if msg.role == "user" else "model",
            "parts": [{"text": msg.text}]
        })

    # Add current user message
    contents.append({
        "role": "user",
        "parts": [{"text": request.message}]
    })

    # Gemini REST Endpoint
    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"

    # Structured Output schema
    payload = {
        "contents": contents,
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                  "action": {
                    "type": "STRING",
                    "enum": ["chat", "predict", "activate", "list_models"]
                  },
                  "prediction_features": {
                    "type": "ARRAY",
                    "items": { "type": "NUMBER" }
                  },
                  "activate_model_id": {
                    "type": "STRING"
                  },
                  "reply": {
                    "type": "STRING"
                  }
                },
                "required": ["action", "reply"]
            }
        }
    }

    # 3. Request Gemini API
    try:
        req = urllib.request.Request(
            gemini_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req) as res:
            res_json = json.loads(res.read().decode("utf-8"))
            candidate_text = res_json["candidates"][0]["content"]["parts"][0]["text"]
            agent_decision = json.loads(candidate_text)
    except urllib.error.HTTPError as he:
        err_msg = he.read().decode("utf-8")
        try:
            err_json = json.loads(err_msg)
            message = err_json.get("error", {}).get("message", "HTTP Error calling Gemini API")
        except Exception:
            message = f"HTTP Error calling Gemini API: {he.reason}"
        raise HTTPException(status_code=400, detail=message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini agent connection failure: {str(e)}")

    # 4. Process Agent Actions / Tool Calls
    action = agent_decision.get("action", "chat")
    reply = agent_decision.get("reply", "")
    outcome = {}

    try:
        if action == "predict":
            features = agent_decision.get("prediction_features", [])
            if not features:
                raise ValueError("No feature list parsed by agent for prediction.")
            
            # Execute prediction
            pred_response = predict(PredictionInput(features=features))
            outcome["prediction_result"] = pred_response
            outcome["prediction_features"] = features
            
        elif action == "activate":
            target_id = agent_decision.get("activate_model_id", "")
            if not target_id:
                raise ValueError("No model ID specified for activation.")
            
            activate_model(target_id)
            outcome["activation_success"] = True
            outcome["activated_model_id"] = target_id
            
        elif action == "list_models":
            models_data = list_models()
            outcome["models"] = models_data.get("models", [])
            
    except Exception as tool_err:
        # Fallback to chat type report on tool error
        action = "chat"
        reply = f"I tried to run the '{action}' action, but encountered an error: {str(tool_err)}"

    return {
        "reply": reply,
        "action": action,
        "outcome": outcome
    }
