// frontend/src/components/AgentChat.jsx
import React, { useState, useEffect, useRef } from "react";
import { sendAgentMessage } from "../services/api";

const AgentChat = ({ activeModelId, onRefresh, onActivate }) => {
  const [messages, setMessages] = useState([
    {
      id: "init",
      role: "model",
      text: "OmniPredictor AI Agent online. I am restricted to only answering questions directly related to the currently active model and its metadata.",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savedChats, setSavedChats] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("agent_saved_chats")) || [];
    } catch {
      return [];
    }
  });

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    // Scroll to bottom on new messages
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Save chats helper
  const saveCurrentChatToHistory = () => {
    // Only save if there are user messages
    const hasUserMessages = messages.some((m) => m.role === "user");
    if (!hasUserMessages) return;

    const chatSessionId = messages.find(m => m.role === "user")?.id || Date.now().toString();

    // Check if it already exists to overwrite/update, otherwise prepend
    const updatedChats = [...savedChats];
    const existingIndex = updatedChats.findIndex(c => c.id === chatSessionId);

    const firstUserMsg = messages.find(m => m.role === "user")?.text || "Chat Session";
    const truncatedTitle = firstUserMsg.length > 25 ? firstUserMsg.substring(0, 25) + "..." : firstUserMsg;

    const newChatSession = {
      id: chatSessionId,
      title: truncatedTitle,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      activeModelId: activeModelId,
      messages: messages
    };

    if (existingIndex > -1) {
      updatedChats[existingIndex] = newChatSession;
    } else {
      updatedChats.unshift(newChatSession);
    }

    setSavedChats(updatedChats);
    localStorage.setItem("agent_saved_chats", JSON.stringify(updatedChats));
  };

  const handleNewChat = () => {
    saveCurrentChatToHistory();
    setMessages([
      {
        id: "init_" + Date.now(),
        role: "model",
        text: "OmniPredictor AI Agent online. I am restricted to only answering questions directly related to the currently active model and its metadata.",
      },
    ]);
  };

  const handleLoadChat = (chat) => {
    setMessages(chat.messages);
    setShowHistory(false);
  };

  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear all chat history?")) {
      setSavedChats([]);
      localStorage.removeItem("agent_saved_chats");
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputValue.trim() || loading) return;

    const userText = inputValue;
    setInputValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Add user message to state
    const userMsg = { id: Date.now().toString(), role: "user", text: userText };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      // Map message history to format expected by backend: List[ChatMessage]
      const formattedHistory = updatedMessages
        .filter((m) => !m.id.toString().startsWith("init"))
        .slice(-15)
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const response = await sendAgentMessage(userText, formattedHistory, activeModelId);

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

  // Auto expand textarea height on input
  const handleTextareaChange = (e) => {
    setInputValue(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col text-left h-full min-h-0 flex-1 relative font-mono">
      {/* Top Header Bar */}
      <div className="flex justify-between items-center bg-[var(--panel-bg)] border border-[var(--border-color)] p-3 rounded-t select-none border-b-0 shrink-0">
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-[var(--accent-color)] font-bold">🤖</span>
          <span className="text-[var(--text-color)] font-bold uppercase tracking-wider">
            Active Model: <span className="text-[var(--accent-color)]">{activeModelId || "None"}</span>
          </span>
        </div>

        {/* Toolbar: New Chat (+) and History (Clock icon) */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleNewChat}
            className="p-1 px-2 text-xs font-bold rounded border border-[var(--border-color)] text-[var(--text-color)] bg-[var(--bg-color)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-all cursor-pointer"
            title="New Chat"
          >
            ＋
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-1 px-2 text-xs font-bold rounded border text-[var(--text-color)] transition-all cursor-pointer ${showHistory
              ? "border-[var(--accent-color)] text-[var(--accent-color)] bg-[var(--bg-color)]"
              : "border-[var(--border-color)] bg-[var(--bg-color)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)]"
              }`}
            title="Chat History"
          >
             History
          </button>
        </div>
      </div>

      {/* History Panel Dropdown */}
      {showHistory && (
        <div className="absolute top-[45px] right-3 z-10 w-64 bg-[var(--panel-bg)] border border-[var(--border-color)] rounded shadow-lg p-2 max-h-60 overflow-y-auto flex flex-col space-y-1">
          <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-1 mb-1 text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
            <span>Previous Conversations</span>
            {savedChats.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-red-500 hover:underline text-[9px] cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>
          {savedChats.length === 0 ? (
            <div className="text-[10px] text-zinc-500 py-3 text-center">No history sessions saved.</div>
          ) : (
            savedChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => handleLoadChat(chat)}
                className="w-full text-left p-2 rounded text-[10px] text-[var(--text-color)] hover:bg-[var(--bg-color)] hover:text-[var(--accent-color)] transition-all truncate block cursor-pointer border border-transparent hover:border-[var(--border-color)]"
              >
                <div className="flex justify-between items-center">
                  <span className="truncate flex-1 font-semibold">{chat.title}</span>
                  <span className="text-[8px] text-zinc-500 ml-2 shrink-0">{chat.timestamp}</span>
                </div>
                {chat.activeModelId && (
                  <div className="text-[8px] text-zinc-500 italic mt-0.5">Model: {chat.activeModelId}</div>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {/* Main Chat Stream Container */}
      <div className="flex-1 bg-[var(--panel-bg)] border border-[var(--border-color)] p-4 overflow-y-auto flex flex-col space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? "items-end text-right" : "items-start text-left"}`}
            >
              <span className="text-[9px] font-mono text-zinc-550 mb-1 uppercase tracking-wider">
                {isUser ? "Operator" : "AI Agent"}
              </span>
              <div
                className={`p-3 rounded text-xs font-mono max-w-xl leading-relaxed whitespace-pre-wrap ${isUser
                  ? "bg-[var(--accent-color)] text-[var(--btn-text)] font-bold shadow-sm"
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
                          {msg.outcome.prediction_result.prediction_label ?? String(msg.outcome.prediction_result.prediction)}
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

      {/* Bottom Expandable Textarea Input box */}
      <form onSubmit={handleSendMessage} className="flex items-end space-x-2 mt-2 bg-[var(--panel-bg)] border border-[var(--border-color)] p-2 rounded-b border-t-0 shrink-0">
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Ask to chatbot"
          value={inputValue}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="bg-[var(--bg-color)] text-[var(--text-color)] border border-[var(--border-color)] text-xs p-2.5 font-mono rounded flex-1 min-w-0 resize-none focus:border-[var(--accent-color)] focus:outline-none disabled:opacity-50 overflow-y-auto max-h-32"
          style={{ height: "auto" }}
        />
        <button
          type="submit"
          disabled={loading || !inputValue.trim()}
          className="bg-[var(--accent-color)] hover:opacity-90 disabled:bg-[var(--border-color)] disabled:text-zinc-500 text-[var(--btn-text)] px-4 py-2.5 uppercase font-bold text-xs tracking-wider transition rounded font-mono cursor-pointer shrink-0"
        >
          SEND
        </button>
      </form>
    </div>
  );
};

export default AgentChat;
