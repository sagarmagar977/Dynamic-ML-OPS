// frontend/src/App.jsx
import React, { useState, useEffect } from "react";
import { fetchModels, fetchModelInfo, activateModel, deleteModel, unloadModel, predict } from "./services/api";
import ModelManager from "./components/ModelManager";
import PredictionForm from "./components/PredictionForm";
import PredictionResult from "./components/PredictionResult";
import PerformanceCharts from "./components/PerformanceCharts";
import BatchView from "./components/BatchView";
import AgentChat from "./components/AgentChat";

function App() {
  const [activeTab, setActiveTab] = useState("inference");
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "theme-terminal");
  const [models, setModels] = useState([]);
  const [activeModelId, setActiveModelId] = useState(null);
  const [activeSchema, setActiveSchema] = useState(null);
  const [predictionResult, setPredictionResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSize, setChatSize] = useState("medium");
  const [statsOpen, setStatsOpen] = useState(false);

  useEffect(() => {
    document.body.className = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Load models on startup
  useEffect(() => {
    loadModelsList();
  }, []);

  const loadModelsList = async () => {
    try {
      const list = await fetchModels();
      setModels(list);

      // Auto-activate the first active model in the list, if any
      const activeItem = list.find((m) => m.active);
      if (activeItem) {
        setActiveModelId(activeItem.id);
        const meta = await fetchModelInfo(activeItem.id);
        setActiveSchema(meta);
      }
    } catch (err) {
      setError("Failed to fetch models from storage repository.");
    }
  };

  const handleActivateModel = async (id) => {
    setPredictionResult(null);
    if (!id) {
      setActiveModelId(null);
      setActiveSchema(null);
      loadModelsList();
      return;
    }
    try {
      setActiveModelId(id);
      const meta = await fetchModelInfo(id);
      setActiveSchema(meta);
      loadModelsList(); // refresh active flag in grid
    } catch (err) {
      alert("Failed to load model details.");
    }
  };

  const handleDeRegisterActiveModel = async () => {
    if (!activeModelId) return;
    if (confirm(`CAUTION: Are you sure you want to completely de-register and wipe the active model [${activeModelId}]?`)) {
      try {
        setLoading(true);
        // Step 1: Unload/clear context from memory
        await unloadModel();

        // Step 2: Delete folder from disk
        await deleteModel(activeModelId);

        // Reset states
        setActiveModelId(null);
        setActiveSchema(null);
        setPredictionResult(null);

        // Reload list
        await loadModelsList();
        alert("Active model successfully de-registered and wiped from disk.");
      } catch (err) {
        alert("De-registration failed: " + (err.response?.data?.detail || err.message));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeactivateActiveModel = async () => {
    if (!activeModelId) return;
    try {
      setLoading(true);
      await unloadModel();
      setActiveModelId(null);
      setActiveSchema(null);
      setPredictionResult(null);
      await loadModelsList();
    } catch (err) {
      alert("Deactivation failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePredict = async (features) => {
    setLoading(true);
    setPredictionResult(null);
    try {
      const resp = await predict({ features });
      setPredictionResult(resp);
    } catch (err) {
      alert("Inference calculation failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Quick stats computed helper
  const getStats = () => {
    if (!activeSchema) return null;
    const { model_name, algorithm_variant, target_name, metrics, task_type } = activeSchema;
    return {
      name: model_name || activeModelId,
      pipeline: algorithm_variant || "Custom Pipeline",
      target: target_name || "target",
      metrics: metrics || {},
      task_type: task_type || "unknown"
    };
  };

  const stats = getStats();


  // Helper to render active tab views
  const renderTabContent = () => {
    switch (activeTab) {
      case "inference":
        return (
          <div className={`grid grid-cols-1 ${chatOpen ? "gap-6" : "lg:grid-cols-12 gap-6"} items-start h-full min-h-0`}>
            <div className={`${chatOpen ? "w-full" : "lg:col-span-7"} border border-[var(--border-color)] bg-[var(--panel-bg)]/40 p-5 rounded`}>
              <PredictionForm schema={activeSchema} onPredict={handlePredict} chatOpen={chatOpen} />
            </div>
            <div className={`${chatOpen ? "w-full" : "lg:col-span-5"}`}>
              <PredictionResult result={predictionResult} />
            </div>
          </div>
        );
      case "ai assistant":
        return (
          <div className="max-w-4xl mx-auto py-2">
            <AgentChat
              activeModelId={activeModelId}
              onRefresh={loadModelsList}
              onActivate={handleActivateModel}
              handleDeRegisterActiveModel={handleDeRegisterActiveModel}
            />
          </div>
        );
      case "performance charts":
        return <PerformanceCharts schema={activeSchema} />;
      case "batch":
        return (
          <div className="max-w-xl mx-auto py-4">
            <BatchView />
          </div>
        );
      case "deploy":
        return (
          <ModelManager
            models={models}
            activeModelId={activeModelId}
            onRefresh={loadModelsList}
            onActivate={handleActivateModel}
          />
        );
      default:
        return null;
    }
  };

  // Chat Sidebar markup
  const renderChatSidebar = () => {
    if (!chatOpen) return null;
    return (
      <aside className={`border-[var(--border-color)] bg-[var(--panel-bg)] text-[var(--text-color)] flex flex-col h-full min-h-0 shrink-0 z-50 absolute md:relative inset-y-0 right-0 border-l shadow-2xl md:shadow-none ${chatSize === "small" ? "w-full md:w-72" : chatSize === "large" ? "w-full md:w-[45%]" : "w-full md:w-[360px]"
        }`}>
        <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center bg-black/10 shrink-0 select-none">
          <span className="text-xs text-[var(--accent-color)] font-bold uppercase tracking-widest">🤖 AI CHAT CONSOLE</span>
          <div className="flex items-center space-x-2">
            <div className="flex border border-[var(--border-color)] rounded overflow-hidden">
              {["small", "medium", "large"].map((sz) => (
                <button
                  key={sz}
                  onClick={() => setChatSize(sz)}
                  className={`px-1.5 py-0.5 text-[8px] uppercase font-bold transition-all ${chatSize === sz ? "bg-[var(--accent-color)] text-[var(--btn-text)] font-black" : "text-zinc-500 hover:text-[var(--text-color)]"
                    }`}
                >
                  {sz[0]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="text-zinc-500 hover:text-[var(--text-color)] hover:bg-[var(--border-color)]/20 text-xs font-mono px-2 py-0.5 border border-[var(--border-color)] rounded transition-all"
            >
              X
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <AgentChat
            activeModelId={activeModelId}
            onRefresh={loadModelsList}
            onActivate={handleActivateModel}
            handleDeRegisterActiveModel={handleDeRegisterActiveModel}
          />
        </div>
      </aside>
    );
  };

  return (
    <div className={`h-screen overflow-hidden flex flex-col ${theme === "theme-dashboard" ? "font-sans" : "font-mono"} text-[var(--text-color)] bg-[var(--bg-color)]`}>
      {/* Top Header Banner */}
      <header className="border-b border-[var(--border-color)] bg-[var(--panel-bg)] p-4 flex flex-col md:flex-row justify-between items-center px-4 md:px-6 shrink-0 select-none gap-3 md:gap-4">
        <div className="flex items-center space-x-3">
          <span className="text-[var(--accent-color)] text-lg">⌬</span>
          <h1 className="text-lg font-black uppercase tracking-widest text-[var(--accent-color)]">
            {theme === "theme-cyberos" ? "OmniPredictor" : "OmniPredictor "}
          </h1>
        </div>
        <div className="flex items-center border border-[var(--border-color)] bg-[var(--panel-bg)]/50 rounded-md p-1 px-3.5 space-x-3.5 shadow-sm">
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={`chatbit-icon text-xl flex items-center justify-center p-0.5 ${chatOpen ? 'active' : 'text-zinc-500'}`}
            title="Toggle AI Chat Console"
          >
            🤖
          </button>
          <div className="w-px h-4 bg-[var(--border-color)]/60" />
          <button
            onClick={() => setStatsOpen(!statsOpen)}
            className={`text-[9px] border px-2 py-0.5 rounded font-bold uppercase transition md:hidden ${
              statsOpen
                ? "border-[var(--accent-color)] text-[var(--accent-color)] bg-[var(--panel-bg)]"
                : "border-[var(--border-color)] text-zinc-500 hover:text-[var(--text-color)]"
            }`}
            title="Toggle Stats Panel"
          >
            📊 Stats
          </button>
          <div className="w-px h-4 bg-[var(--border-color)]/60 md:hidden" />
          <div className="w-px h-4 bg-[var(--border-color)]/60 hidden md:block" />
          <div className="flex items-center space-x-2 text-[10px] text-zinc-500 font-mono">
            <span className="font-bold uppercase tracking-wider">THEME:</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="bg-transparent text-[var(--accent-color)] border-0 text-[10px] px-1 py-0.5 focus:outline-none cursor-pointer uppercase font-black tracking-wide"
            >
              <option value="theme-cyberos" className="bg-[#121214] text-[#e07700]">CYBER OS</option>
              <option value="theme-terminal" className="bg-[#1a1a1e] text-[#e08c00]">TERMINAL</option>
              <option value="theme-dashboard" className="bg-[#1e1e20] text-[#e2e8f0]">DASHBOARD</option>
            </select>
          </div>
          <div className="w-px h-4 bg-[var(--border-color)]/60" />
          <div className="flex items-center" title={activeModelId ? "Active Pipeline Loaded" : "No Active Pipeline"}>
            <span className={`h-2.5 w-2.5 rounded-full border border-black/35 shadow-inner transition-all duration-300 ${activeModelId ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
          </div>
        </div>
      </header>

      {/* Main Content Body Layout */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 min-w-0 overflow-y-auto md:overflow-hidden">
        {/* If CyberOS, show navigation sidebar. Otherwise show standard stats panel sidebar */}
        {theme === "theme-cyberos" && (
          <aside className="hidden md:flex w-full md:w-64 border-b md:border-b-0 md:border-r border-double border-[var(--border-color)] bg-[var(--panel-bg)]/60 p-4 md:p-5 flex-col justify-between shrink-0 select-none text-left overflow-y-auto md:max-h-none max-h-[300px]">
            <div className="space-y-6">
              <div className="pb-2 border-b border-[var(--border-color)]">
                <div className="text-[var(--text-color)] text-sm font-black tracking-widest uppercase">
                  Workspace Portal
                </div>
              </div>

              <nav className="flex flex-col space-y-2 text-xs uppercase font-bold">
                {[
                  { name: "inference", tab: "inference" },
                  { name: "performance charts", tab: "performance charts" },
                  { name: "batch", tab: "batch" },
                  { name: "deploy", tab: "deploy" }
                ].map((opt) => {
                  const isActive = activeTab === opt.tab;
                  return (
                    <button
                      key={opt.tab}
                      onClick={() => {
                        setActiveTab(opt.tab);
                      }}
                      className={`px-3 py-2 text-left rounded border transition-all ${isActive
                        ? "border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10 text-white font-extrabold"
                        : "border-[var(--border-color)]/50 bg-[var(--panel-bg)]/20 text-zinc-500 hover:text-[var(--text-color)] hover:border-[var(--border-color)]"
                        }`}
                    >
                      {opt.name}
                    </button>
                  );
                })}
              </nav>

              <div className="border-t border-[var(--border-color)]/60 pt-4">
                {stats ? (
                  <div className="space-y-4 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                        IDENT
                      </span>
                      <span className="text-[var(--text-color)] font-bold tracking-wide break-all block">
                        {stats.name}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                        PIPELINE
                      </span>
                      <span className="text-[var(--text-color)]/95 break-words block text-[11px]">
                        {stats.pipeline}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                        TARGET
                      </span>
                      <span className="text-[var(--accent-color)] font-bold block uppercase">
                        {stats.target}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                        Metrics Report
                      </span>
                      <div className="flex border border-[var(--border-color)] bg-black/40 divide-x divide-[var(--border-color)] rounded overflow-hidden shadow-sm">
                        {Object.entries(stats.metrics).slice(0, 2).map(([key, val]) => (
                          <div key={key} className="flex-1 p-2.5 text-center">
                            <span className="text-[8px] text-zinc-500 block uppercase font-bold truncate">
                              {key.replace("_", " ")}
                            </span>
                            <span className="text-xs font-black text-[var(--accent-color)] block mt-0.5">
                              {stats.task_type === "classification"
                                ? `${(val * 100).toFixed(0)}%`
                                : val.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-zinc-600 text-[11px] py-4 text-center">
                    NO ACTIVE PIPELINE LOADED INTO INFERENCE REGISTERS
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 mt-6">
              {activeModelId && (
                <button
                  onClick={handleDeactivateActiveModel}
                  disabled={loading}
                  className="w-full border border-red-500/40 bg-red-950/15 hover:bg-red-900 hover:text-white text-red-500 uppercase font-bold text-xs py-3 tracking-wider transition rounded"
                >
                  Deactivate Model
                </button>
              )}
              <div className="text-[9px] text-zinc-600 border-t border-[var(--border-color)] pt-3">
                CyberOS v1.0.8 <br />
                © ALL REGISTERED ACCOUNTS
              </div>
            </div>
          </aside>
        )}

        {/* Collapsible Stats Panel sidebar for standard themes OR on mobile under CyberOS */}
        <aside className={`${
          theme === "theme-cyberos" ? "md:hidden" : ""
        } ${
          statsOpen ? "flex" : "hidden md:flex"
        } w-full md:w-64 border-b md:border-b-0 md:border-r border-[var(--border-color)] bg-[var(--panel-bg)]/60 p-4 md:p-5 flex-col justify-between shrink-0 select-none text-left overflow-y-auto md:max-h-none max-h-[300px]`}>
          <div className="space-y-6">
            <div className="border-b border-[var(--border-color)] pb-2">
              <h3 className="text-xs text-zinc-500 uppercase tracking-widest font-bold">
                System Stats Panel
              </h3>
            </div>

            {stats ? (
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                    IDENT
                  </span>
                  <span className="text-[var(--text-color)] font-bold tracking-wide break-all block">
                    {stats.name}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                    PIPELINE
                  </span>
                  <span className="text-[var(--text-color)]/95 break-words block text-[11px]">
                    {stats.pipeline}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                    TARGET
                  </span>
                  <span className="text-[var(--accent-color)] font-bold block uppercase">
                    {stats.target}
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                    Metrics Report
                  </span>
                  <div className="flex border border-[var(--border-color)] bg-[var(--panel-bg)]/40 divide-x divide-[var(--border-color)] rounded overflow-hidden shadow-sm">
                    {Object.entries(stats.metrics).slice(0, 2).map(([key, val]) => (
                      <div key={key} className="flex-1 p-2.5 text-center">
                        <span className="text-[8px] text-zinc-500 block uppercase font-bold truncate">
                          {key.replace("_", " ")}
                        </span>
                        <span className="text-xs font-black text-[var(--accent-color)] block mt-0.5">
                          {stats.task_type === "classification"
                            ? `${(val * 100).toFixed(0)}%`
                            : val.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-zinc-600 text-[11px] py-4 text-center">
                NO ACTIVE PIPELINE LOADED INTO INFERENCE REGISTERS
              </div>
            )}
          </div>

          {activeModelId && (
            <button
              onClick={handleDeactivateActiveModel}
              disabled={loading}
              className="w-full mt-6 border border-red-500/40 bg-red-950/15 hover:bg-red-900 hover:text-white text-red-500 uppercase font-bold text-xs py-3 tracking-wider transition rounded"
            >
              Deactivate Model
            </button>
          )}
        </aside>

        {/* Content area and sliding chat sidebar */}
        <div className="flex-1 flex flex-row min-h-0 min-w-0 overflow-hidden relative">
          <main className="flex-1 bg-[var(--bg-color)] p-6 flex flex-col space-y-6 min-w-0 min-h-0">
            {/* Tab Navigation Menu */}
            <div className={`border-b border-[var(--border-color)] pb-px space-x-1 uppercase text-[10px] sm:text-xs select-none shrink-0 w-full overflow-hidden ${
              theme === "theme-cyberos" ? "flex md:hidden" : "flex"
            }`}>
              {["inference", "performance charts", "batch", "deploy"].map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 sm:flex-initial text-center px-1.5 sm:px-4 py-2 font-bold whitespace-nowrap rounded-t tape-tab-btn ${
                      isActive
                        ? "active text-[var(--accent-color)]"
                        : "text-zinc-500 hover:text-[var(--text-color)] bg-[var(--panel-bg)]/20"
                    }`}
                  >
                    {tab === "performance charts" ? (
                      <span>
                        <span className="hidden sm:inline">performance </span>charts
                      </span>
                    ) : tab}
                  </button>
                );
              })}
            </div>

            {/* Tab Views content area */}
            <div className={`flex-1 bg-[var(--panel-bg)]/20 border border-[var(--border-color)] p-6 rounded min-w-0 flex flex-col min-h-0 overflow-y-auto ${theme === "theme-cyberos" ? "cyberos-double-border bg-black" : ""}`}>
              {renderTabContent()}
            </div>

            {/* Retro cyberspace bottom footer bar */}
            {theme === "theme-cyberos" && (
              <footer className="cyberos-double-border bg-black p-2.5 rounded text-[10px] text-zinc-500 flex justify-between items-center px-4 select-none uppercase font-mono">
                <div className="flex space-x-4">

                </div>
                <span className="text-[var(--accent-color)] font-bold">@__4093__</span>
              </footer>
            )}
          </main>

          {renderChatSidebar()}
        </div>
      </div>
    </div>
  );
}

export default App;