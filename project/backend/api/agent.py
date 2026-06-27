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
    role: str  # "user" or "model"
    text: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    model_id: Optional[str] = None

@router.post("/chat", response_model=dict)
async def chat_with_agent(
    request: ChatRequest,
    x_openrouter_key: Optional[str] = Header(None)
):
    """Chat endpoint that uses OpenRouter (free model) to intelligently decide actions (predict, list, activate) and generate responses."""
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="OpenRouter API Key is missing on the server. Please configure OPENROUTER_API_KEY in the backend environment."
        )

    # 1. Retrieve Active Model Context
    model_manager = ModelManager()
    active_model_id = model_manager.active_model_id
    active_model_data = model_manager.get_active_model()

    system_instruction = (
        "You are **OmniPredictor ML Expert** — a senior machine learning engineer and data scientist who lives inside this ML registry app. "
        "You are brilliant, warm, casual, and love teaching ML with analogies and real intuition. You talk like a knowledgeable friend, not a robot.\n\n"

        "## YOUR PERSONALITY & TONE\n"
        "- Be warm, casual, and human. Mirror the user's energy. If they say 'heyy!' you say 'Heyyyy!! What's up?'\n"
        "- Use emojis naturally (not excessively). A 👋, 🧠, 📊, ✅, 🔥 here and there.\n"
        "- Keep answers SHORT and TO THE POINT. No unnecessary padding or verbose explanations.\n"
        "- Explain things clearly but concisely — get to the answer fast, then add a quick analogy only if it genuinely helps.\n"
        "- Use markdown only when it adds clarity: bold key terms, bullet lists for multi-part answers, code blocks for code. Skip headers for simple replies.\n"
        "- Be technically precise AND brief at the same time. Think: smart friend texting you the answer, not a textbook.\n\n"

        "## YOUR SCOPE (STRICTLY ENFORCED)\n"
        "You ONLY answer questions about:\n"
        "1. The **currently active ML model** and all its metadata (features, metrics, algorithm, task type, classes, target)\n"
        "2. **ML/Data Science concepts** directly related to the active model (e.g. how does Random Forest work, what is accuracy, explain confusion matrix)\n"
        "3. **Training code** — if the user asks how to build/train a model like the active one, give them Python scikit-learn code\n"
        "4. **Confusion matrix** — explain the formula, what TP/TN/FP/FN mean, how to read it, and how to interpret results\n"
        "5. **Predictions** — run inference when given feature values\n"
        "6. **Model registry actions** — list models, activate a model\n\n"
        "You do NOT answer: general knowledge, coding unrelated to ML, math problems, trivia, or anything outside ML scope.\n"
        "If asked something out of scope, warmly decline: \"Haha I wish I could help with that! But I'm your ML expert — I only live in the world of models and data. Ask me something about your active model! 😄\"\n\n"

        "## CONFUSION MATRIX — ALWAYS EXPLAIN FULLY IF ASKED\n"
        "When asked about confusion matrix, ALWAYS include:\n"
        "- What TP, TN, FP, FN mean with an analogy (e.g. medical test analogy)\n"
        "- The full matrix layout\n"
        "- Formulas: Accuracy = (TP+TN)/(TP+TN+FP+FN), Precision = TP/(TP+FP), Recall = TP/(TP+FN), F1 = 2*(P*R)/(P+R)\n"
        "- How to interpret: high FP = model is too aggressive, high FN = model is missing cases, etc.\n\n"

        "## TRAINING CODE — ALWAYS GIVE IF ASKED\n"
        "If the user asks 'how do I train a model like this' or 'give me the code', give them a full, working Python/sklearn code block. \n"
        "Tailor it to the active model's algorithm, task type, and feature count.\n\n"

        "## AVAILABLE ACTIONS (choose exactly one per response)\n"
        "- **'predict'**: User gives numeric values to predict. Parse them into `prediction_features` (list of floats).\n"
        "- **'activate'**: User wants to activate a model. Put the model ID in `activate_model_id`.\n"
        "- **'list_models'**: User wants to see all models in the registry.\n"
        "- **'chat'**: Everything else — explanations, greetings, questions, code, formulas.\n\n"

        "## OUTPUT FORMAT (CRITICAL)\n"
        "Respond ONLY with a valid JSON object — no markdown wrapper around the JSON itself, just raw JSON.\n"
        "But the `reply` field content MUST be rich markdown (use headers, bold, lists, code blocks freely inside the reply string).\n"
        "Required fields: action (string), reply (string with markdown).\n"
        "Optional: prediction_features (array of numbers), activate_model_id (string).\n"
        "Example: {\"action\": \"chat\", \"reply\": \"## Hey there!\\n\\nGreat question! **Random Forest** works like this...\"}"
    )

    if active_model_data:
        meta = active_model_data.get("metadata", {})
        feat_names = meta.get("features", [])
        formatted_features = [f.get('name') if isinstance(f, dict) else f for f in feat_names]
        system_instruction += (
            f"\n## ACTIVE MODEL CONTEXT\n"
            f"The user is working with this specific ML model. Use this data to answer all questions:\n"
            f"- **Model ID**: `{active_model_id}`\n"
            f"- **Name**: {meta.get('model_name', active_model_id)}\n"
            f"- **Algorithm**: {meta.get('algorithm_variant', 'unknown')}\n"
            f"- **Task Type**: {meta.get('task_type', 'unknown')} (classification or regression)\n"
            f"- **Target Variable**: `{meta.get('target_name', 'target')}`\n"
            f"- **Performance Metrics**: {json.dumps(meta.get('metrics', {}))}\n"
            f"- **Number of Input Features**: {meta.get('n_features_in_', len(feat_names))}\n"
            f"- **Feature Names (in order)**: {', '.join(formatted_features)}\n"
            f"- **Classes** (if classification): {', '.join(meta.get('classes', []))}\n\n"
            "## BEHAVIOR INSTRUCTIONS\n"
            "1. **Predictions**: When the user gives numbers or asks to predict, set action='predict' and extract all floats into prediction_features.\n"
            "2. **Model Questions**: Answer anything about the active model's algorithm, metrics, features, classes, target — fully and technically but with analogies.\n"
            "3. **Training Code**: If asked how to train/build this kind of model, generate a full Python sklearn code block tailored to this model's algorithm and task.\n"
            "4. **Out of Scope**: If the question has NOTHING to do with ML or this model, warmly decline as per your personality instructions above.\n"
            "5. **Greeting Mirror**: If user says hi/hello/hey, respond warmly and enthusiastically, confirm the active model, and invite them to ask anything.\n"
        )
    else:
        system_instruction += (
            "\n## NO ACTIVE MODEL\n"
            "There is no active model loaded right now.\n"
            "If the user greets you, greet back warmly but let them know they need to activate a model first.\n"
            "For any ML question, politely say: 'Looks like no model is active yet! 🙈 Head over to the Model Registry and activate one first, then I can tell you everything about it.'\n"
            "For out-of-scope questions, warmly decline as per your personality instructions.\n"
        )

    # 2. Build OpenAI-compatible messages (system + history + current message)
    messages = [
        {"role": "system", "content": system_instruction}
    ]

    # Load history (convert "model" role → "assistant" for OpenAI format)
    for msg in request.history:
        role = "assistant" if msg.role == "model" else "user"
        messages.append({"role": role, "content": msg.text})

    # Add current user message
    messages.append({"role": "user", "content": request.message})

    # 3. Call OpenRouter API (OpenAI-compatible endpoint)
    openrouter_url = "https://openrouter.ai/api/v1/chat/completions"

    def extract_json_from_text(text: str) -> dict:
        """
        Robustly extract a JSON object from model output.
        Handles: raw JSON, markdown code fences (```json...```), mixed text.
        Falls back gracefully if nothing parseable is found.
        """
        if not text:
            return {"action": "chat", "reply": "Hmm, I got an empty response. Try again! 🔄"}

        # 1. Strip markdown code fences: ```json ... ``` or ``` ... ```
        import re
        fence_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text, re.IGNORECASE)
        if fence_match:
            text = fence_match.group(1).strip()

        # 2. Try direct parse first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # 3. Find the outermost { ... } block
        start = text.find('{')
        if start != -1:
            depth = 0
            for i, ch in enumerate(text[start:], start):
                if ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(text[start:i+1])
                        except json.JSONDecodeError:
                            break

        # 4. Nothing worked — return the raw text as a chat reply
        return {"action": "chat", "reply": text.strip() or "Oops, something went wrong parsing my response. Try rephrasing! 😅"}

    payload = {
        "model": "openrouter/free",
        "messages": messages,
        # NOTE: Not all free models support response_format; we rely on prompt + extractor instead
        "temperature": 0.2,
        "max_tokens": 1500,
    }

    try:
        req = urllib.request.Request(
            openrouter_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "http://localhost:5173",
                "X-Title": "OmniPredictor AI Agent",
            },
            method="POST"
        )
        with urllib.request.urlopen(req) as res:
            res_json = json.loads(res.read().decode("utf-8"))
            candidate_text = res_json["choices"][0]["message"]["content"]
            agent_decision = extract_json_from_text(candidate_text)
    except urllib.error.HTTPError as he:
        err_msg = he.read().decode("utf-8")
        try:
            err_json = json.loads(err_msg)
            message = err_json.get("error", {}).get("message", "HTTP Error calling OpenRouter API")
        except Exception:
            message = f"HTTP Error calling OpenRouter API: {he.reason}"
        raise HTTPException(status_code=400, detail=message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenRouter agent connection failure: {str(e)}")

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
