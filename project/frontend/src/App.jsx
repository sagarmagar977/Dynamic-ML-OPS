// frontend/src/App.jsx
import React, { useState, useEffect } from "react";
import { fetchModels, fetchModelInfo, activateModel, deleteModel, unloadModel, predict } from "./services/api";
import ModelManager from "./components/ModelManager";
import PredictionForm from "./components/PredictionForm";
import PredictionResult from "./components/PredictionResult";
import PerformanceCharts from "./components/PerformanceCharts";
import BatchView from "./components/BatchView";

function App() {
  const [activeTab, setActiveTab] = useState("inference");
  const [models, setModels] = useState([]);
  const [activeModelId, setActiveModelId] = useState(null);
  const [activeSchema, setActiveSchema] = useState(null);
  const [predictionResult, setPredictionResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <div className="min-h-screen bg-black flex flex-col font-mono text-amber-500">
      {/* Top Header Banner */}
      <header className="border-b border-zinc-900 bg-zinc-950 p-4 flex justify-between items-center px-6">
        <div className="flex items-center space-x-3">
          <span className="text-amber-500 text-lg">⌬</span>
          <h1 className="text-lg font-black uppercase tracking-widest text-white">
            OmniPredictor Terminal
          </h1>
        </div>
        <div className="flex items-center space-x-2 text-[10px] uppercase font-bold px-3 py-1 border border-green-500 text-green-400 bg-green-950/20 rounded animate-pulse">
          <span className="h-2 w-2 bg-green-500 rounded-full"></span>
          <span>System Engine Online</span>
        </div>
      </header>

      {/* Main Framework Layout Grid */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Persistent left 25% Sidebar panel */}
        <aside className="w-full md:w-1/4 border-r border-zinc-900 bg-zinc-950/60 p-5 flex flex-col justify-between space-y-6">
          <div className="space-y-6 text-left">
            <div className="border-b border-zinc-900 pb-2">
              <h3 className="text-xs text-zinc-500 uppercase tracking-widest font-bold">
                [System Stats Panel]
              </h3>
            </div>

            {stats ? (
              <div className="space-y-4 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                    IDENT
                  </span>
                  <span className="text-white font-bold tracking-wide break-all block">
                    {stats.name}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                    PIPELINE
                  </span>
                  <span className="text-amber-500/95 break-words block text-[11px]">
                    {stats.pipeline}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                    TARGET
                  </span>
                  <span className="text-amber-600 font-bold block uppercase">
                    {stats.target}
                  </span>
                </div>

                {/* Metrics Report KPIs */}
                <div className="space-y-2">
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                    Metrics Report
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(stats.metrics).slice(0, 2).map(([key, val]) => (
                      <div key={key} className="border border-zinc-900 bg-black p-3 text-center rounded">
                        <span className="text-[8px] text-zinc-500 block uppercase font-bold truncate">
                          {key.replace("_", " ")}
                        </span>
                        <span className="text-sm font-black text-white block mt-1">
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
              <div className="text-zinc-600 font-mono text-[11px] py-4 text-center">
                [NO ACTIVE PIPELINE LOADED INTO INFERENCE REGISTERS]
              </div>
            )}
          </div>

          {/* Quick-Wipe De-Register Trigger */}
          {activeModelId && (
            <button
              onClick={handleDeRegisterActiveModel}
              disabled={loading}
              className="w-full border border-red-500/40 bg-red-950/15 hover:bg-red-900 hover:text-white text-red-500 uppercase font-bold text-xs py-3 tracking-wider transition rounded font-mono"
            >
              [De-Register Active Model]
            </button>
          )}
        </aside>

        {/* Main Dynamic Viewport Workspace */}
        <main className="flex-1 bg-black p-6 flex flex-col space-y-6 min-w-0">
          {/* Tab Navigation Menu */}
          <div className="flex border-b border-zinc-900 pb-px space-x-1 uppercase font-mono text-xs overflow-x-auto">
            {["inference", "performance charts", "batch", "deploy"].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 border-t border-x rounded-t transition-all font-bold whitespace-nowrap ${
                    isActive
                      ? "border-zinc-900 bg-zinc-950 text-white border-b-black"
                      : "border-transparent text-zinc-500 hover:text-amber-500"
                  }`}
                >
                  [{tab}]
                </button>
              );
            })}
          </div>

          {/* Tab Views content area */}
          <div className="flex-1 bg-zinc-950/20 border border-zinc-900 p-6 rounded min-w-0 overflow-y-auto">
            {activeTab === "inference" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 border border-zinc-900 bg-zinc-950/40 p-5 rounded">
                  <PredictionForm schema={activeSchema} onPredict={handlePredict} />
                </div>
                <div className="lg:col-span-5">
                  <PredictionResult result={predictionResult} />
                </div>
              </div>
            )}

            {activeTab === "performance charts" && (
              <PerformanceCharts schema={activeSchema} />
            )}

            {activeTab === "batch" && (
              <div className="max-w-xl mx-auto py-4">
                <BatchView />
              </div>
            )}

            {activeTab === "deploy" && (
              <ModelManager
                models={models}
                activeModelId={activeModelId}
                onRefresh={loadModelsList}
                onActivate={handleActivateModel}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;