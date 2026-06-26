// frontend/src/components/AgentChat.jsx
import React, { useState, useEffect, useRef } from "react";
import { sendAgentMessage, deployModel } from "../services/api";

const AgentChat = ({ activeModelId, onRefresh, onActivate, handleDeRegisterActiveModel }) => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("GEMINI_API_KEY") || "");
  const [messages, setMessages] = useState([
    {
      id: "init",
      role: "model",
      text: "OmniPredictor AI Agent online. Load a model or describe feature values (e.g. '5.1, 3.5, 1.4, 0.2') to execute predictions automatically. You can also drag & drop model files below to mount them.",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);

  // File Upload states
  const [modelFile, setModelFile] = useState(null);
  const [metadataFile, setMetadataFile] = useState(null);
  const [deployId, setDeployId] = useState("");
  const [deploying, setDeploying] = useState(false);

  const chatEndRef = useRef(null);

  useEffect(() => {
    // Scroll to bottom on new messages
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSaveKey = (e) => {
    const key = e.target.value;
    setApiKey(key);
    localStorage.setItem("GEMINI_API_KEY", key);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    if (!apiKey) {
      alert("Please configure your Gemini API Key in the top settings bar.");
      return;
    }

    const userText = inputValue;
    setInputValue("");

    // Add user message to state
    const userMsg = { id: Date.now().toString(), role: "user", text: userText };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Map message history to format expected by backend: List[ChatMessage]
      // filter out system initialization and limit to last 15 messages to conserve tokens
      const formattedHistory = messages
        .filter((m) => m.id !== "init")
        .slice(-15)
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const response = await sendAgentMessage(userText, formattedHistory, activeModelId, apiKey);

      // Add agent reply message to state
      const agentMsg = {
        id: (Date.now() + 1).toString(),
        role: "model",
        text: response.reply,
        action: response.action,
        outcome: response.outcome,
      };

      setMessages((prev) => [...prev, agentMsg]);

      // If agent activated a model, sync app state
      if (response.action === "activate" && response.outcome?.activation_success) {
        onActivate(response.outcome.activated_model_id);
      }
      
      // If any registry operations occurred, refresh grid
      if (response.action === "list_models" || response.action === "activate") {
        onRefresh();
      }

    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "model",
          text: `[AGENT FAULT]: ${err.response?.data?.detail || err.message || "Failed to communicate with AI Agent."}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleChatDeploy = async (e) => {
    e.preventDefault();
    if (!deployId.trim() || !modelFile) {
      alert("Please provide a Model Identity Code and select at least a model.joblib file.");
      return;
    }

    setDeploying(true);
    const modelId = deployId.trim();

    try {
      await deployModel(modelId, modelFile, metadataFile);
      
      // Add success log message
      const sysMsg = {
        id: Date.now().toString(),
        role: "user",
        text: `[System Action]: Mounted and registered model '${modelId}' via Chat Console.`,
      };
      setMessages((prev) => [...prev, sysMsg]);

      // Trigger automatic prompt to AI explaining the newly deployed model
      setLoading(true);
      const response = await sendAgentMessage(
        `I just mounted model '${modelId}'. Can you check if it is loaded and explain its classes and parameters to me?`,
        [...messages, sysMsg].filter((m) => m.id !== "init").slice(-15).map(m => ({ role: m.role, text: m.text })),
        activeModelId,
        apiKey
      );

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "model",
          text: response.reply,
          action: response.action,
          outcome: response.outcome,
        },
      ]);

      // Reset file upload form
      setModelFile(null);
      setMetadataFile(null);
      setDeployId("");
      onRefresh();
    } catch (err) {
      alert("Deployment failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setDeploying(false);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4 text-left h-full min-h-0 flex-1">
      {/* Top API Key Config Bar */}
      <div className="flex flex-col bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded space-y-2">
        <div className="flex flex-wrap justify-between items-center text-xs font-mono gap-1 select-none">
          <span className="text-[var(--accent-color)] font-bold">🤖</span>
          <span className="text-zinc-500">Active ID: {activeModelId || "NONE"}</span>
        </div>
        <div className="flex items-center space-x-2 w-full">
          <span className="text-[10px] text-zinc-500 font-mono font-semibold uppercase shrink-0">API KEY:</span>
          <input
            type="password"
            placeholder="AI-key (stored locally)..."
            value={apiKey}
            onChange={handleSaveKey}
            className="bg-[var(--panel-bg)] text-[var(--text-color)] border border-[var(--border-color)] text-xs px-2 py-1 font-mono rounded focus:border-[var(--accent-color)] focus:outline-none flex-1 min-w-0"
          />
        </div>
      </div>

      {/* Main Chat Stream Container */}
      <div className="flex-1 bg-[var(--panel-bg)] border border-[var(--border-color)] rounded p-4 overflow-y-auto flex flex-col space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const isSystem = msg.text.startsWith("[System Action]");
          
          if (isSystem) {
            return (
              <div key={msg.id} className="text-center py-1">
                <span className="text-[10px] font-mono text-[var(--text-color)]/70 bg-[var(--bg-color)] px-3 py-1 rounded border border-[var(--border-color)]/60 uppercase">
                  {msg.text}
                </span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? "items-end text-right" : "items-start text-left"}`}
            >
              <span className="text-[9px] font-mono text-zinc-650 mb-1 uppercase">
                {isUser ? "Operator" : "AI Agent"}
              </span>
              <div
                className={`p-3 rounded text-xs font-mono max-w-xl leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? "bg-[var(--accent-color)] text-[var(--btn-text)] font-bold"
                    : "bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)]"
                }`}
              >
                {msg.text}

                {/* Inline Action/Prediction Card rendering */}
                {msg.outcome?.prediction_result && (
                  <div className="mt-3 p-3 bg-[var(--panel-bg)] border border-[var(--border-color)] rounded space-y-2 text-left text-[var(--text-color)]/80">
                    <div className="text-[10px] text-[var(--accent-color)] font-bold uppercase tracking-wider border-b border-[var(--border-color)]/40 pb-1">
                      INFERENCE RESULT ENGINE
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-zinc-500 uppercase">Predicted Label:</span>
                        <div className="text-[var(--text-color)] font-bold text-xs uppercase">
                          {msg.outcome.prediction_result.prediction_label || String(msg.outcome.prediction_result.prediction)}
                        </div>
                      </div>
                      <div>
                        <span className="text-zinc-500 uppercase">Target Variable:</span>
                        <div className="text-[var(--text-color)] uppercase">
                          {msg.outcome.prediction_result.target_name}
                        </div>
                      </div>
                    </div>

                    {msg.outcome.prediction_result.probabilities && (
                      <div className="border-t border-[var(--border-color)]/40 pt-2 space-y-1.5">
                        <span className="text-[9px] text-zinc-500 uppercase block font-semibold">
                          🤖 Confidence Distribution:
                        </span>
                        {Object.entries(msg.outcome.prediction_result.probabilities).map(([cls, prob]) => (
                          <div key={cls} className="space-y-0.5">
                            <div className="flex justify-between text-[9px] font-mono">
                              <span className="text-zinc-500 font-bold">{cls}</span>
                              <span className="text-[var(--accent-color)]">{(prob * 100).toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-[var(--bg-color)] h-1.5 rounded border border-[var(--border-color)] overflow-hidden">
                              <div
                                className="bg-[var(--accent-color)] h-full rounded"
                                style={{ width: `${prob * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex items-center space-x-1.5">
            <span className={`h-2.5 w-2.5 rounded-full border border-black/35 shadow-inner transition-all duration-300 ${activeModelId ? 'bg-green-500 shadow-green-500/50' : 'bg-red-500 shadow-red-500/50 animate-pulse'}`}></span>
            <div className="bg-[var(--bg-color)] border border-[var(--border-color)] text-zinc-500 px-3 py-2 rounded text-xs font-mono">
              COMMUNICATION STREAM TUNING...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Deploy attachment panel toggled via local files */}
      <div className="bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded space-y-3 font-mono text-xs">
        <div className="flex justify-between items-center text-zinc-500 border-b border-[var(--border-color)] pb-1.5">
          <span className="text-[10px] uppercase font-bold text-zinc-400">📁 Chat Deployment Channel</span>
          {(modelFile || metadataFile) && (
            <button
              onClick={() => {
                setModelFile(null);
                setMetadataFile(null);
              }}
              className="text-red-500 hover:text-red-400 hover:bg-red-500/10 text-[9px] uppercase border border-red-500/20 px-2 py-0.5 rounded transition"
            >
              Clear files
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center justify-center border border-dashed border-[var(--border-color)] hover:border-[var(--accent-color)]/50 bg-[var(--panel-bg)] p-2 rounded cursor-pointer select-none text-[10px] text-zinc-500 hover:text-[var(--accent-color)] transition">
            {modelFile ? `✓ model.joblib (${(modelFile.size / 1024).toFixed(1)} KB)` : "Choose weight (model.joblib)"}
            <input
              type="file"
              accept=".joblib"
              onChange={(e) => setModelFile(e.target.files[0])}
              className="hidden"
            />
          </label>

          <label className="flex items-center justify-center border border-dashed border-[var(--border-color)] hover:border-[var(--accent-color)]/50 bg-[var(--panel-bg)] p-2 rounded cursor-pointer select-none text-[10px] text-zinc-500 hover:text-[var(--accent-color)] transition">
            {metadataFile ? `✓ metadata.json (${(metadataFile.size / 1024).toFixed(1)} KB)` : "Choose schema (metadata.json) - optional"}
            <input
              type="file"
              accept=".json"
              onChange={(e) => setMetadataFile(e.target.files[0])}
              className="hidden"
            />
          </label>
        </div>

        {modelFile && (
          <form onSubmit={handleChatDeploy} className="flex flex-col space-y-2 border-t border-[var(--border-color)] pt-2.5">
            <input
              type="text"
              placeholder="Deploy identity code (e.g. iris_classifier)..."
              value={deployId}
              onChange={(e) => setDeployId(e.target.value)}
              className="bg-[var(--panel-bg)] text-[var(--text-color)] border border-[var(--border-color)] text-xs px-2 py-1.5 font-mono rounded flex-1 min-w-0 focus:border-[var(--accent-color)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={deploying}
              className="bg-[var(--accent-color)] hover:opacity-90 text-[var(--btn-text)] px-4 py-1.5 rounded uppercase font-bold text-xs tracking-wider transition"
            >
              {deploying ? "Mounting..." : "Deploy via Chat"}
            </button>
            {activeModelId && (
                <button
                  onClick={handleDeRegisterActiveModel}
                  disabled={loading}
                  className="w-full bg-red-100 text-red-700 border border-red-500 hover:bg-yellow-500 hover:text-white uppercase font-bold text-xs py-3 tracking-wider transition rounded"
                >
                  De-Register Active Model
                </button>
            )}
          </form>
        )}
      </div>

      {/* Bottom Text Prompt Input box */}
      <form onSubmit={handleSendMessage} className="flex space-x-2">
        <input
          type="text"
          placeholder={apiKey ? "Type message or features list (e.g. '5.1, 3.5, 1.4, 0.2')..." : "Please configure your Gemini API Key above first."}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={!apiKey || loading}
          className="bg-[var(--panel-bg)] text-[var(--text-color)] border border-[var(--border-color)] text-xs p-3 font-mono rounded flex-1 min-w-0 focus:border-[var(--accent-color)] focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!apiKey || loading || !inputValue.trim()}
          className="bg-[var(--accent-color)] hover:opacity-90 disabled:bg-[var(--border-color)] disabled:text-zinc-500 text-[var(--btn-text)] px-6 uppercase font-bold text-xs tracking-wider transition rounded font-mono"
        >
          SEND
        </button>
      </form>
    </div>
  );
};

export default AgentChat;
