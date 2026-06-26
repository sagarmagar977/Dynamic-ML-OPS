// frontend/src/components/GameBoyConsole.jsx
import React, { useState, useEffect, useRef } from "react";
import { getClassImageUrl, sendAgentMessage } from "../services/api";

const GameBoyConsole = ({
  models,
  activeModelId,
  activeSchema,
  predictionResult,
  loading,
  error,
  handleActivateModel,
  handlePredict,
  loadModelsList,
  handleDeRegisterActiveModel,
  theme,
  setTheme
}) => {
  // Screens: 'menu', 'inference', 'models', 'charts', 'chat'
  const [activeScreen, setActiveScreen] = useState("menu");
  const [selectedFeatureIndex, setSelectedFeatureIndex] = useState(0);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [formData, setFormData] = useState({});
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { role: "model", text: "GEMINI AGENT SYSTEM ONLINE. PRESS START FOR HELP." }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  // New batch screen states
  const [gbCsvFile, setGbCsvFile] = useState(null);
  const [gbBatchLoading, setGbBatchLoading] = useState(false);
  const [gbBatchSuccess, setGbBatchSuccess] = useState(false);
  const [gbBatchError, setGbBatchError] = useState(null);

  // New deploy screen states
  const [gbModelFile, setGbModelFile] = useState(null);
  const [gbMetadataFile, setGbMetadataFile] = useState(null);
  const [gbDeployId, setGbDeployId] = useState("");
  const [gbDeploying, setGbDeploying] = useState(false);
  const [gbDeploySuccess, setGbDeploySuccess] = useState(false);
  const [gbDeployError, setGbDeployError] = useState(null);

  // Refs for virtual screen scrolling and inputs
  const chatEndRef = useRef(null);
  const activeItemRef = useRef(null);
  const chatScrollRef = useRef(null);
  const gbFileInputRef = useRef(null);
  const gbWeightsInputRef = useRef(null);
  const gbSchemaInputRef = useRef(null);

  // Helper to execute batch inside GameBoy Console
  const handleGbExecuteBatch = async () => {
    if (!gbCsvFile) {
      setGbBatchError("NO FILE");
      return;
    }
    setGbBatchLoading(true);
    setGbBatchError(null);
    setGbBatchSuccess(false);
    try {
      const { predictBatchCsv } = await import("../services/api");
      const blob = await predictBatchCsv(gbCsvFile);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `inferred_${gbCsvFile.name}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      setGbBatchSuccess(true);
      setGbCsvFile(null);
    } catch (err) {
      setGbBatchError("FAILED");
    } finally {
      setGbBatchLoading(false);
    }
  };

  // Helper to execute deploy inside GameBoy Console
  const handleGbDeploy = async () => {
    if (!gbDeployId.trim() || !gbModelFile) {
      setGbDeployError("MISSING FILES");
      return;
    }
    setGbDeploying(true);
    setGbDeployError(null);
    setGbDeploySuccess(false);
    try {
      const { deployModel } = await import("../services/api");
      await deployModel(gbDeployId.trim(), gbModelFile, gbMetadataFile);
      setGbDeploySuccess(true);
      setGbModelFile(null);
      setGbMetadataFile(null);
      setGbDeployId("");
      loadModelsList();
    } catch (err) {
      setGbDeployError(err.response?.data?.detail || err.message || "FAILED");
    } finally {
      setGbDeploying(false);
    }
  };

  // Helper to normalize feature parameters
  const getFieldParams = (field) => {
    const isString = typeof field === "string";
    const name = isString ? field : field.name;
    const label = isString ? field : (field.label || field.name);
    const type = isString ? "continuous" : (field.type || "continuous");
    const min = isString ? 0 : (field.min !== undefined ? field.min : 0);
    const max = isString ? 10 : (field.max !== undefined ? field.max : 10);
    const step = isString ? 0.1 : (field.step !== undefined ? field.step : 0.1);
    
    let defaultValue = 5;
    if (type === "continuous") {
      defaultValue = isString 
        ? 5 
        : (field.default !== undefined ? field.default : (min + max) / 2);
    } else {
      defaultValue = isString ? "" : (field.default !== undefined ? field.default : "");
    }

    return { name, label, type, min, max, step, defaultValue };
  };

  // Initialize form data on schema changes
  useEffect(() => {
    if (!activeSchema || !activeSchema.features) return;
    const initialData = {};
    activeSchema.features.forEach((field) => {
      const params = getFieldParams(field);
      initialData[params.name] = params.defaultValue;
    });
    setFormData(initialData);
    setSelectedFeatureIndex(0);
  }, [activeSchema]);

  // Keep chat scrolled
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  // Auto scroll highlighted item in small viewports
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedFeatureIndex, selectedModelIndex, activeScreen]);

  // Map keyboard controls to Game Boy console
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prevent page scrolling on arrow/space keys when in Game Boy screen
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.key) && !e.target.closest("input, select, textarea")) {
        e.preventDefault();
      }

      if (e.target.closest("input, select, textarea")) return;

      switch (e.key.toLowerCase()) {
        case "arrowup":
          handleDpadPress("up");
          break;
        case "arrowdown":
          handleDpadPress("down");
          break;
        case "arrowleft":
          handleDpadPress("left");
          break;
        case "arrowright":
          handleDpadPress("right");
          break;
        case "enter":
        case "a":
        case "z":
          handleActionBtn("A");
          break;
        case "escape":
        case "backspace":
        case "b":
        case "x":
          handleActionBtn("B");
          break;
        case "space":
        case "c":
          handleMenuBtn("select");
          break;
        case "s":
        case "i":
        case "tab":
          handleMenuBtn("start");
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeScreen, selectedFeatureIndex, selectedModelIndex, formData, activeSchema, models, gbCsvFile, gbModelFile, gbMetadataFile, gbDeployId]);

  // Handle D-pad directional clicks
  const handleDpadPress = (direction) => {
    if (activeScreen === "menu") {
      // 5 menu options: inference, charts, batch, deploy, chat
      if (direction === "up" || direction === "left") {
        setSelectedFeatureIndex((prev) => (prev - 1 + 5) % 5);
      } else {
        setSelectedFeatureIndex((prev) => (prev + 1) % 5);
      }
    } else if (activeScreen === "inference") {
      if (!activeSchema || !activeSchema.features) return;
      const featuresCount = activeSchema.features.length;

      if (direction === "up") {
        setSelectedFeatureIndex((prev) => (prev - 1 + featuresCount) % featuresCount);
      } else if (direction === "down") {
        setSelectedFeatureIndex((prev) => (prev + 1) % featuresCount);
      } else if (direction === "left" || direction === "right") {
        // Adjust threshold value (5-step increment)
        const currentField = activeSchema.features[selectedFeatureIndex];
        if (!currentField) return;

        const params = getFieldParams(currentField);
        const currentValue = formData[params.name] !== undefined ? formData[params.name] : params.defaultValue;

        if (params.type === "continuous") {
          const jump = (params.max - params.min) / 5;
          let newVal = direction === "left" ? currentValue - jump : currentValue + jump;
          newVal = Math.max(params.min, Math.min(params.max, newVal));
          newVal = Math.round(newVal * 100) / 100;
          setFormData((prev) => ({ ...prev, [params.name]: newVal }));
        } else {
          // Cycling select options
          const options = currentField.options || [];
          if (options.length > 0) {
            let optIdx = options.indexOf(currentValue);
            if (direction === "left") {
              optIdx = (optIdx - 1 + options.length) % options.length;
            } else {
              optIdx = (optIdx + 1) % options.length;
            }
            setFormData((prev) => ({ ...prev, [params.name]: options[optIdx] }));
          }
        }
      }
    } else if (activeScreen === "models") {
      if (models.length === 0) return;
      if (direction === "up") {
        setSelectedModelIndex((prev) => (prev - 1 + models.length) % models.length);
      } else if (direction === "down") {
        setSelectedModelIndex((prev) => (prev + 1) % models.length);
      }
    } else if (activeScreen === "charts") {
      if (activeSchema && activeSchema.chart_data?.feature_importances) {
        const count = Object.keys(activeSchema.chart_data.feature_importances).length;
        if (count > 0) {
          if (direction === "up") {
            setSelectedFeatureIndex((prev) => (prev - 1 + count) % count);
          } else if (direction === "down") {
            setSelectedFeatureIndex((prev) => (prev + 1) % count);
          }
        }
      }
    } else if (activeScreen === "batch") {
      if (direction === "up") {
        setSelectedFeatureIndex((prev) => (prev - 1 + 3) % 3);
      } else if (direction === "down") {
        setSelectedFeatureIndex((prev) => (prev + 1) % 3);
      }
    } else if (activeScreen === "deploy") {
      if (direction === "up") {
        setSelectedFeatureIndex((prev) => (prev - 1 + 5) % 5);
      } else if (direction === "down") {
        setSelectedFeatureIndex((prev) => (prev + 1) % 5);
      }
    } else if (activeScreen === "chat") {
      if (chatScrollRef.current) {
        if (direction === "up") {
          chatScrollRef.current.scrollTop -= 25;
        } else if (direction === "down") {
          chatScrollRef.current.scrollTop += 25;
        }
      }
    }
  };

  // Handle Select/Start clicks
  const handleMenuBtn = (btn) => {
    if (btn === "select") {
      // Direct shortcut to Models Inventory screen
      setActiveScreen("models");
      setSelectedModelIndex(0);
    } else if (btn === "start") {
      if (activeScreen === "models") {
        // Start/activate model using START button
        const selectedModel = models[selectedModelIndex];
        if (selectedModel) {
          handleActivateModel(selectedModel.id);
          setActiveScreen("menu");
        }
      } else if (activeScreen !== "menu") {
        // Return to home screen when in normal screens
        setActiveScreen("menu");
        setSelectedFeatureIndex(0);
      } else {
        // Toggle raw details modal
        setShowInfo((prev) => !prev);
      }
    }
  };

  // Handle A/B action buttons
  const handleActionBtn = (btn) => {
    if (btn === "B") {
      // B goes back to main menu
      if (activeScreen !== "menu") {
        setActiveScreen("menu");
        setSelectedFeatureIndex(0);
      } else {
        // Reset form values if on menu
        if (activeSchema && activeSchema.features) {
          const resetData = {};
          activeSchema.features.forEach((field) => {
            const params = getFieldParams(field);
            resetData[params.name] = params.defaultValue;
          });
          setFormData(resetData);
        }
      }
    } else if (btn === "A") {
      if (activeScreen === "menu") {
        // Navigate to menu selection: inference, charts, batch, deploy, chat
        const menuFlow = ["inference", "charts", "batch", "deploy", "chat"];
        setActiveScreen(menuFlow[selectedFeatureIndex % 5]);
        setSelectedFeatureIndex(0);
      } else if (activeScreen === "inference") {
        // Run single prediction
        if (!activeSchema || !activeSchema.features) return;
        const orderedValues = activeSchema.features.map((field) => {
          const params = getFieldParams(field);
          const val = formData[params.name];
          return val !== undefined && val !== "" ? val : 0.0;
        });
        handlePredict(orderedValues);
      } else if (activeScreen === "models") {
        // Activate selected model directory
        const selectedModel = models[selectedModelIndex];
        if (selectedModel) {
          handleActivateModel(selectedModel.id);
          setActiveScreen("menu");
        }
      } else if (activeScreen === "batch") {
        if (selectedFeatureIndex % 3 === 0) {
          gbFileInputRef.current?.click();
        } else if (selectedFeatureIndex % 3 === 1) {
          handleGbExecuteBatch();
        } else if (selectedFeatureIndex % 3 === 2) {
          setGbCsvFile(null);
          setGbBatchSuccess(false);
          setGbBatchError(null);
        }
      } else if (activeScreen === "deploy") {
        if (selectedFeatureIndex % 5 === 0) {
          gbWeightsInputRef.current?.click();
        } else if (selectedFeatureIndex % 5 === 1) {
          gbSchemaInputRef.current?.click();
        } else if (selectedFeatureIndex % 5 === 3) {
          handleGbDeploy();
        } else if (selectedFeatureIndex % 5 === 4) {
          setGbModelFile(null);
          setGbMetadataFile(null);
          setGbDeployId("");
          setGbDeployError(null);
          setGbDeploySuccess(false);
        }
      }
    }
  };

  // Handle Chat form submit
  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const key = localStorage.getItem("GEMINI_API_KEY") || "";
    if (!key) {
      alert("Please configure your Gemini API Key in the settings dialog (Press START).");
      return;
    }

    const text = chatInput;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text }]);
    setChatLoading(true);

    try {
      const history = chatMessages.slice(-10).map((m) => ({ role: m.role, text: m.text }));
      const response = await sendAgentMessage(text, history, activeModelId, key);
      
      setChatMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: response.reply,
          prediction: response.outcome?.prediction_result
        }
      ]);
      
      if (response.action === "activate" && response.outcome?.activation_success) {
        handleActivateModel(response.outcome.activated_model_id);
      }
      
      loadModelsList();
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: "model", text: `FAULT: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Helper to render segment bars for feature values
  const renderValueBar = (val, params) => {
    if (params.type !== "continuous") {
      return <span className="font-bold text-[10px] uppercase">[{val}]</span>;
    }
    const totalRange = params.max - params.min;
    const progress = totalRange > 0 ? (val - params.min) / totalRange : 0.5;
    const filledSegments = Math.round(progress * 5); // 5 block granularity
    const blocks = [];
    for (let i = 1; i <= 5; i++) {
      blocks.push(i <= filledSegments ? "■" : "□");
    }
    return (
      <span className="font-mono tracking-tighter text-[10px]">
        {blocks.join("")} ({val})
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#181124] py-6 px-4 overflow-y-auto select-none font-mono">
      
      {/* Top Header Options for layout swapping */}
      <div className="w-full max-w-[360px] flex justify-between items-center mb-4 text-[10px] text-zinc-500 font-mono">
        <span>GBA EMULATION ONLINE</span>
        <div className="flex space-x-2">
          <span>THEME:</span>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="bg-black text-[#c8d3a5] border border-zinc-800 text-[10px] px-1 py-0.5 rounded focus:outline-none"
          >
            <option value="theme-gameboy">GAME BOY</option>
            <option value="theme-cyberos">CYBER OS</option>
            <option value="theme-terminal">TERMINAL</option>
            <option value="theme-dashboard">DASHBOARD</option>
          </select>
        </div>
      </div>

      {/* Main GBA SP Outer Shell Grid */}
      <div className="w-full max-w-[360px] bg-[#3d2c67] border-4 border-[#22173d] rounded-2xl shadow-2xl flex flex-col p-4 relative overflow-hidden">
        
        {/* Subtle plastic overlay line */}
        <div className="absolute inset-x-0 top-0 h-1 bg-white/10 z-20"></div>

        {/* Top Shell Speaker/LED hinge indicator */}
        <div className="flex justify-between items-center mb-2 px-1">
          <div className="flex space-x-1.5 items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-black/60 shadow"></span>
            <span className="h-1.5 w-1.5 rounded-full bg-black/60 shadow"></span>
          </div>
          {/* Status Power light */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[7px] text-white/50 uppercase tracking-widest font-bold font-sans">Power</span>
            <span className={`h-2.5 w-2.5 rounded-full border border-black/35 shadow-inner transition-all duration-300 ${activeModelId ? 'bg-green-500 shadow-green-500/50' : 'bg-red-500 shadow-red-500/50 animate-pulse'}`}></span>
          </div>
        </div>

        {/* Top Half: Dark gray Screen Bezel */}
        <div className="bg-[#1f1a29] border-4 border-[#120f18] rounded-lg p-3 flex flex-col h-[230px] shadow-inner relative">
          
          {/* Screen Scanlines layer */}
          <div className="gba-scanlines"></div>

          {/* Actual LCD display */}
          <div className="flex-1 gba-lcd-screen p-2 rounded flex flex-col min-h-0 text-[11px] font-bold overflow-hidden leading-tight">
            
            {/* Screen Header banner */}
            <div className="border-b border-[#1a230a] pb-1 mb-1 flex justify-between items-center text-[9px] uppercase tracking-wider">
              <span>Power On</span>
              <span>Bat. Full</span>
            </div>

            {/* SCREEN VIEWPORT STATE MACHINE */}
            <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
              {activeScreen === "menu" && (
                <div className="flex-1 flex flex-col justify-center space-y-1">
                  <div className="text-center font-extrabold uppercase border-b border-dashed border-[#1a230a] pb-1 mb-1">
                    MODEL CONSOLE
                  </div>
                  {["RUN INFERENCE", "PERFORMANCE CHARTS", "BATCH INFERENCE", "DEPLOY REGISTRY", "CHAT CONSOLE"].map((opt, idx) => {
                    const isSelected = selectedFeatureIndex % 5 === idx;
                    return (
                      <div
                        key={opt}
                        ref={isSelected ? activeItemRef : null}
                        className={`flex items-center space-x-1.5 p-0.5 rounded ${isSelected ? 'bg-[#1a230a]/10' : ''}`}
                      >
                        <span>{isSelected ? "▶" : " "}</span>
                        <span className="uppercase">{opt}</span>
                      </div>
                    );
                  })}
                  <div className="text-[7px] text-center pt-2 opacity-85 uppercase border-t border-dashed border-[#1a230a] mt-1 shrink-0">
                    SELECT: Models | START: Help | A: Enter
                  </div>
                </div>
              )}

              {activeScreen === "inference" && (
                <div className="flex-1 flex flex-col min-h-0 justify-between">
                  <div className="text-center uppercase font-black tracking-wide border-b border-[#1a230a] pb-0.5 mb-1 text-[9px]">
                    INFERENCE PARAMETERS
                  </div>
                  {activeSchema && activeSchema.features ? (
                    <div className="flex-1 space-y-0.5 overflow-y-auto pr-0.5 min-h-0">
                      {activeSchema.features.map((field, idx) => {
                        const params = getFieldParams(field);
                        const isSelected = selectedFeatureIndex === idx;
                        const val = formData[params.name] !== undefined ? formData[params.name] : params.defaultValue;
                        return (
                          <div
                            key={params.name}
                            ref={isSelected ? activeItemRef : null}
                            className={`flex flex-col p-0.5 rounded ${isSelected ? 'bg-[#1a230a]/15 border border-[#1a230a]/30' : ''}`}
                          >
                            <div className="flex justify-between items-center text-[9px]">
                              <span className="truncate max-w-[120px] uppercase">
                                {isSelected ? "▶" : " "} {params.label}
                              </span>
                              {renderValueBar(val, params)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center text-[10px] uppercase py-4">
                      NO MODEL ACTIVE. LOAD VIA DEPLOY TAB
                    </div>
                  )}

                  {/* Inference prediction results box */}
                  <div className="border-t border-[#1a230a] pt-1 mt-1 text-[9px] min-h-[42px] flex flex-col justify-center shrink-0">
                    {loading ? (
                      <span className="animate-pulse uppercase text-center font-bold">RUNNING INFERENCE...</span>
                    ) : predictionResult ? (
                      <div className="flex flex-col justify-center">
                         <span className="uppercase text-center font-black bg-[#1a230a]/10">
                           RESULT: {predictionResult.prediction_label || String(predictionResult.prediction)}
                         </span>
                         {predictionResult.probabilities && (
                           <span className="text-[8px] text-center uppercase opacity-85 truncate mt-0.5">
                             Confidence: {Math.max(...Object.values(predictionResult.probabilities).map(p => p * 100)).toFixed(1)}%
                           </span>
                         )}
                      </div>
                    ) : (
                      <span className="text-center opacity-75 uppercase text-[8px]">DPAD: Adjust | A: Run | START: Menu</span>
                    )}
                  </div>
                </div>
              )}

              {activeScreen === "models" && (
                <div className="flex-1 flex flex-col min-h-0 justify-between">
                  <div className="text-center uppercase font-black border-b border-[#1a230a] pb-0.5 mb-1 text-[9px] shrink-0">
                    MODELS INVENTORY
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 min-h-0 pr-0.5">
                    {models.length === 0 ? (
                      <div className="text-center py-4 uppercase">No models found.</div>
                    ) : (
                      models.map((m, idx) => {
                        const isSelected = selectedModelIndex === idx;
                        return (
                          <div
                            key={m.id}
                            ref={isSelected ? activeItemRef : null}
                            className={`p-1 border rounded text-[9px] ${
                              isSelected ? 'bg-[#1a230a]/15 border-[#1a230a]' : 'border-transparent'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="truncate max-w-[140px] uppercase font-bold">
                                {isSelected ? "▶" : " "} {m.name}
                              </span>
                              <span className={`text-[7px] tracking-tighter uppercase font-mono px-1 rounded border ${m.active ? 'bg-[#1a230a]/20 border-[#1a230a] text-[#1a230a]' : 'border-[#1a230a]/10 opacity-60'}`}>
                                {m.active ? "ON" : "COLD"}
                              </span>
                            </div>
                            {isSelected && (
                              <div className="text-[7px] text-[#1a230a]/75 uppercase truncate mt-0.5">
                                Type: {m.task_type} | ID: {m.id}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="border-t border-[#1a230a] pt-1 mt-1 text-[8px] text-center opacity-85 uppercase shrink-0">
                    DPAD: Scroll | START / A: Start Model
                  </div>
                </div>
              )}

              {activeScreen === "charts" && (
                <div className="flex-1 flex flex-col min-h-0 justify-between">
                  <div className="text-center uppercase font-black border-b border-[#1a230a] pb-0.5 mb-1 text-[9px] shrink-0">
                    DIAGNOSTICS BAR
                  </div>
                  {activeSchema && activeSchema.chart_data?.feature_importances ? (
                    <div className="flex-1 overflow-y-auto space-y-1 py-1 pr-0.5 min-h-0">
                      {Object.entries(activeSchema.chart_data.feature_importances).map(([k, v], idx) => {
                        const blocks = Math.round(v * 8);
                        const bars = "■".repeat(blocks) + "□".repeat(8 - blocks);
                        const isSelected = selectedFeatureIndex === idx;
                        return (
                          <div
                            key={k}
                            ref={isSelected ? activeItemRef : null}
                            className={`flex justify-between text-[9px] uppercase font-bold p-0.5 rounded ${isSelected ? 'bg-[#1a230a]/10' : ''}`}
                          >
                            <span className="truncate max-w-[110px]">{k}</span>
                            <span className="font-mono tracking-tighter">{bars} ({(v * 100).toFixed(0)}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center text-[10px] uppercase py-4">
                      NO DIAGNOSTIC CHART FOUND
                    </div>
                  )}
                  <div className="border-t border-[#1a230a] pt-0.5 text-[8px] text-center opacity-85 uppercase shrink-0">
                    DPAD: Scroll | START: Menu
                  </div>
                </div>
              )}

              {activeScreen === "batch" && (
                <div className="flex-1 flex flex-col min-h-0 justify-between">
                  <div className="text-center uppercase font-black border-b border-[#1a230a] pb-0.5 mb-1 text-[9px] shrink-0">
                    BATCH WORKSPACE
                  </div>
                  
                  <div className="flex-1 flex flex-col space-y-1.5 my-1 overflow-y-auto pr-0.5 min-h-0 text-[9px]">
                    <input
                      type="file"
                      accept=".csv"
                      ref={gbFileInputRef}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file && file.name.endsWith(".csv")) {
                          setGbCsvFile(file);
                          setGbBatchError(null);
                          setGbBatchSuccess(false);
                        }
                      }}
                      className="hidden"
                    />

                    {/* SELECT CSV DATA SHEET */}
                    <div
                      ref={selectedFeatureIndex % 3 === 0 ? activeItemRef : null}
                      onClick={() => gbFileInputRef.current?.click()}
                      className={`p-1 border rounded cursor-pointer ${selectedFeatureIndex % 3 === 0 ? 'bg-[#1a230a]/15 border-[#1a230a]' : 'border-transparent'}`}
                    >
                      <span className="font-bold">▶ SELECT CSV DATA SHEET</span>
                      <div className="text-[7px] opacity-75 truncate mt-0.5">
                        MOUNTED: {gbCsvFile ? gbCsvFile.name : "NONE (CLICK TO CHOOSE)"}
                      </div>
                    </div>

                    {/* RUN BATCH OPTION */}
                    <div
                      ref={selectedFeatureIndex % 3 === 1 ? activeItemRef : null}
                      onClick={handleGbExecuteBatch}
                      className={`p-1 border rounded cursor-pointer ${gbBatchLoading ? 'animate-pulse' : ''} ${selectedFeatureIndex % 3 === 1 ? 'bg-[#1a230a]/15 border-[#1a230a]' : 'border-transparent'}`}
                    >
                      <span className="font-bold">▶ RUN INFERENCE PIPELINE</span>
                      <div className="text-[7px] opacity-75 mt-0.5">
                        STATUS: {gbBatchLoading ? "RUNNING..." : gbBatchSuccess ? "SUCCESS & DOWNLOADED!" : gbBatchError ? `ERROR: ${gbBatchError}` : "STANDBY"}
                      </div>
                    </div>

                    {/* RESET OPTION */}
                    <div
                      ref={selectedFeatureIndex % 3 === 2 ? activeItemRef : null}
                      onClick={() => {
                        setGbCsvFile(null);
                        setGbBatchSuccess(false);
                        setGbBatchError(null);
                      }}
                      className={`p-1 border rounded cursor-pointer ${selectedFeatureIndex % 3 === 2 ? 'bg-[#1a230a]/15 border-[#1a230a]' : 'border-transparent'}`}
                    >
                      <span className="font-bold">▶ RESET WORKSPACE</span>
                    </div>
                  </div>

                  <div className="border-t border-[#1a230a] pt-1 mt-1 text-[8px] text-center opacity-85 uppercase shrink-0">
                    DPAD: Cycle Options | A: Select | START: Menu
                  </div>
                </div>
              )}

              {activeScreen === "deploy" && (
                <div className="flex-1 flex flex-col min-h-0 justify-between">
                  <div className="text-center uppercase font-black border-b border-[#1a230a] pb-0.5 mb-1 text-[9px] shrink-0">
                    DEPLOY REGISTRY MODULES
                  </div>

                  <div className="flex-1 flex flex-col space-y-1.5 my-1 overflow-y-auto pr-0.5 min-h-0 text-[9px]">
                    <input
                      type="file"
                      accept=".joblib"
                      ref={gbWeightsInputRef}
                      onChange={(e) => setGbModelFile(e.target.files[0])}
                      className="hidden"
                    />
                    <input
                      type="file"
                      accept=".json"
                      ref={gbSchemaInputRef}
                      onChange={(e) => setGbMetadataFile(e.target.files[0])}
                      className="hidden"
                    />

                    {/* WEIGHTS FILE */}
                    <div
                      ref={selectedFeatureIndex % 5 === 0 ? activeItemRef : null}
                      onClick={() => gbWeightsInputRef.current?.click()}
                      className={`p-1 border rounded cursor-pointer ${selectedFeatureIndex % 5 === 0 ? 'bg-[#1a230a]/15 border-[#1a230a]' : 'border-transparent'}`}
                    >
                      <span className="font-bold">▶ CHOOSE WEIGHTS (.JOBLIB)</span>
                      <div className="text-[7px] opacity-75 truncate mt-0.5">
                        FILE: {gbModelFile ? gbModelFile.name : "NONE (CLICK TO CHOOSE)"}
                      </div>
                    </div>

                    {/* SCHEMA FILE */}
                    <div
                      ref={selectedFeatureIndex % 5 === 1 ? activeItemRef : null}
                      onClick={() => gbSchemaInputRef.current?.click()}
                      className={`p-1 border rounded cursor-pointer ${selectedFeatureIndex % 5 === 1 ? 'bg-[#1a230a]/15 border-[#1a230a]' : 'border-transparent'}`}
                    >
                      <span className="font-bold">▶ CHOOSE SCHEMA (.JSON)</span>
                      <div className="text-[7px] opacity-75 truncate mt-0.5">
                        FILE: {gbMetadataFile ? gbMetadataFile.name : "NONE (OPTIONAL)"}
                      </div>
                    </div>

                    {/* IDENTITY CODE */}
                    <div
                      ref={selectedFeatureIndex % 5 === 2 ? activeItemRef : null}
                      className={`p-1 border rounded ${selectedFeatureIndex % 5 === 2 ? 'bg-[#1a230a]/15 border-[#1a230a]' : 'border-transparent'}`}
                    >
                      <span className="font-bold">▶ IDENTITY CODE:</span>
                      <input
                        type="text"
                        placeholder="E.g. iris_classifier..."
                        value={gbDeployId}
                        onChange={(e) => setGbDeployId(e.target.value)}
                        className="w-full mt-0.5 px-1 py-0.5 text-[8px] bg-transparent border border-[#1a230a]/40 text-[#1a230a] focus:outline-none"
                      />
                    </div>

                    {/* DEPLOY BUTTON */}
                    <div
                      ref={selectedFeatureIndex % 5 === 3 ? activeItemRef : null}
                      onClick={handleGbDeploy}
                      className={`p-1 border rounded cursor-pointer ${gbDeploying ? 'animate-pulse' : ''} ${selectedFeatureIndex % 5 === 3 ? 'bg-[#1a230a]/15 border-[#1a230a]' : 'border-transparent'}`}
                    >
                      <span className="font-bold">▶ MOUNT & REGISTER MODULE</span>
                      <div className="text-[7px] opacity-75 mt-0.5 truncate">
                        STATUS: {gbDeploying ? "DEPLOYING..." : gbDeploySuccess ? "DEPLOY SUCCESS!" : gbDeployError ? `ERROR: ${gbDeployError}` : "STANDBY"}
                      </div>
                    </div>

                    {/* RESET OPTIONS */}
                    <div
                      ref={selectedFeatureIndex % 5 === 4 ? activeItemRef : null}
                      onClick={() => {
                        setGbModelFile(null);
                        setGbMetadataFile(null);
                        setGbDeployId("");
                        setGbDeployError(null);
                        setGbDeploySuccess(false);
                      }}
                      className={`p-1 border rounded cursor-pointer ${selectedFeatureIndex % 5 === 4 ? 'bg-[#1a230a]/15 border-[#1a230a]' : 'border-transparent'}`}
                    >
                      <span className="font-bold">▶ RESET INPUTS</span>
                    </div>
                  </div>

                  <div className="border-t border-[#1a230a] pt-1 mt-1 text-[8px] text-center opacity-85 uppercase shrink-0">
                    DPAD: Cycle | A: Select | START: Menu
                  </div>
                </div>
              )}

              {activeScreen === "chat" && (
                <div className="flex-1 flex flex-col min-h-0 justify-between">
                  <div className="text-center uppercase font-black border-b border-[#1a230a] pb-0.5 mb-1 text-[9px] shrink-0">
                    GEMINI CHAT TERMINAL
                  </div>
                  <div
                    ref={chatScrollRef}
                    className="flex-1 overflow-y-auto space-y-1 pr-1 text-[9px] min-h-0 leading-tight my-1"
                  >
                    {chatMessages.map((msg, i) => (
                      <div key={i} className="flex flex-col">
                        <span className="text-[7px] opacity-75 uppercase">
                          {msg.role === "user" ? "Operator" : "Agent"}
                        </span>
                        <span className="whitespace-pre-wrap">{msg.text}</span>
                        {msg.prediction && (
                          <div className="border border-[#1a230a]/40 bg-[#1a230a]/5 p-1 my-0.5 rounded text-[7px] uppercase font-bold">
                            PREDICT: {msg.prediction.prediction_label || msg.prediction.prediction}
                          </div>
                        )}
                      </div>
                    ))}
                    {chatLoading && <span className="animate-pulse">TYPING...</span>}
                    <div ref={chatEndRef} />
                  </div>
                  
                  {/* Small inline input box for emulator compatibility */}
                  <form onSubmit={sendChatMessage} className="border-t border-[#1a230a] pt-1 mt-1 flex space-x-1 shrink-0">
                    <input
                      type="text"
                      placeholder="Type query to AI..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 px-1 py-0.5 text-[8px] rounded border focus:outline-none"
                    />
                    <button type="submit" className="px-1.5 py-0.5 text-[8px] uppercase font-bold border rounded bg-[#1a230a]/5">
                      SEND
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* System Title stamp */}
        <div className="text-center my-3">
          <div className="text-white/80 text-[11px] font-black tracking-[0.2em] uppercase font-sans flex items-center justify-center space-x-1">
            <span>GAME BOY</span>
            <span className="text-[8px] font-medium tracking-normal text-white/50 lowercase italic">advance</span>
            <span className="text-[9px] font-black tracking-normal text-red-500">SP</span>
          </div>
        </div>

        {/* Lower Half: Controls Housing Panel */}
        <div className="bg-[#312152]/40 rounded-xl p-4 flex flex-col space-y-5 border border-white/5 shadow-inner">
          
          {/* Main Controls row: D-pad on Left, A/B on Right */}
          <div className="flex justify-between items-center px-2">
            
            {/* D-Pad Cross controls */}
            <div className="flex items-center justify-center p-2">
              <div className="gba-dpad-container">
                {/* Horizontal Bar */}
                <div className="absolute top-[32px] left-0 w-24 h-8 gba-dpad-cross"></div>
                {/* Vertical Bar */}
                <div className="absolute top-0 left-[32px] w-8 h-24 gba-dpad-cross"></div>
                {/* Center Circle cap */}
                <div className="absolute top-[32px] left-[32px] w-8 h-8 bg-[#252427] z-10 flex items-center justify-center">
                  <span className="h-2 w-2 rounded-full bg-[#1b1a1c] opacity-60"></span>
                </div>

                {/* Invisible clickable triggers for virtual control */}
                <button
                  type="button"
                  onClick={() => handleDpadPress("up")}
                  className="absolute top-0 left-[32px] w-8 h-8 z-20 cursor-pointer active:bg-white/5 rounded-t"
                  title="DPAD Up"
                ></button>
                <button
                  type="button"
                  onClick={() => handleDpadPress("down")}
                  className="absolute bottom-0 left-[32px] w-8 h-8 z-20 cursor-pointer active:bg-white/5 rounded-b"
                  title="DPAD Down"
                ></button>
                <button
                  type="button"
                  onClick={() => handleDpadPress("left")}
                  className="absolute top-[32px] left-0 w-8 h-8 z-20 cursor-pointer active:bg-white/5 rounded-l"
                  title="DPAD Left (Decrease value by 20%)"
                ></button>
                <button
                  type="button"
                  onClick={() => handleDpadPress("right")}
                  className="absolute top-[32px] right-0 w-8 h-8 z-20 cursor-pointer active:bg-white/5 rounded-r"
                  title="DPAD Right (Increase value by 20%)"
                ></button>
              </div>
            </div>

            {/* A/B Action buttons on angled housing panel */}
            <div className="flex items-center space-x-3 transform rotate-[-12deg] mr-2">
              {/* B Button */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => handleActionBtn("B")}
                  className="gba-btn-round flex items-center justify-center"
                  title="B Button (Back/Reset)"
                >
                  <span className="text-white/60 font-black text-sm uppercase italic font-sans">B</span>
                </button>
              </div>
              {/* A Button */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => handleActionBtn("A")}
                  className="gba-btn-round flex items-center justify-center"
                  title="A Button (Predict/Select)"
                >
                  <span className="text-white/60 font-black text-sm uppercase italic font-sans">A</span>
                </button>
              </div>
            </div>
          </div>

          {/* Speaker grille holes (Centered) */}
          <div className="flex justify-center">
            <div className="grid grid-cols-3 gap-2 w-14">
              {[...Array(9)].map((_, i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-black/60 shadow-inner"></span>
              ))}
            </div>
          </div>

          {/* Start/Select button group */}
          <div className="flex justify-center space-x-12 px-4 pb-2">
            <div className="flex flex-col items-center">
              <div className="h-6 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => handleMenuBtn("select")}
                  className="gba-btn-pill cursor-pointer"
                  title="SELECT Button (Open Models screen)"
                ></button>
              </div>
              <span className="text-[6px] text-white/50 uppercase tracking-tighter font-extrabold mt-1">SELECT (MODELS)</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-6 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => handleMenuBtn("start")}
                  className="gba-btn-pill cursor-pointer"
                  title="START Button (Activate model / Return home)"
                ></button>
              </div>
              <span className="text-[6px] text-white/50 uppercase tracking-tighter font-extrabold mt-1">START (HOME/RUN)</span>
            </div>
          </div>
        </div>

        {/* Fun Decals/Stickers: Gengar icons mimicking reference images */}
        <div className="absolute -bottom-1.5 -left-1 w-14 h-14 bg-contain bg-no-repeat opacity-20 pointer-events-none" style={{ backgroundImage: "url('https://img.pokemondb.net/sprites/black-white/anim/normal/gengar.gif')" }}></div>
        <div className="absolute bottom-2 right-2 w-10 h-10 bg-contain bg-no-repeat opacity-30 pointer-events-none" style={{ backgroundImage: "url('https://img.pokemondb.net/sprites/diamond-pearl/normal/gengar.png')" }}></div>
      </div>

      {/* Details/Info overlay (START modal) */}
      {showInfo && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-mono">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-lg p-5 space-y-4 text-left">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
              <h4 className="text-xs text-amber-500 font-bold uppercase tracking-wider">
                [SYSTEM REGISTRY REGISTERS]
              </h4>
              <button
                onClick={() => setShowInfo(false)}
                className="text-zinc-500 hover:text-white hover:bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-0.5 rounded transition uppercase"
              >
                CLOSE
              </button>
            </div>

            <div className="space-y-3 text-[11px] text-zinc-400">
              <div>
                <span className="text-zinc-600 block text-[9px] uppercase font-bold">Loaded Model Ident</span>
                <span className="text-white font-mono font-bold block break-all">
                  {activeModelId || "NO ACTIVE MODEL DIRECTORY MOUNTED"}
                </span>
              </div>

              {activeSchema ? (
                <div className="space-y-2 border border-zinc-900 bg-black p-3 rounded">
                  <div>
                    <span className="text-zinc-600 block text-[8px] uppercase">Model Name</span>
                    <span className="text-amber-500 font-bold">{activeSchema.model_name || "Unknown"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-600 block text-[8px] uppercase">Task Type</span>
                    <span className="text-white font-bold uppercase">{activeSchema.task_type}</span>
                  </div>
                  <div>
                    <span className="text-zinc-600 block text-[8px] uppercase">Target Variable Name</span>
                    <span className="text-white font-bold uppercase">{activeSchema.target_name}</span>
                  </div>
                  {activeSchema.metrics && (
                    <div>
                      <span className="text-zinc-600 block text-[8px] uppercase mb-1">Baseline Metrics</span>
                      <div className="flex border border-zinc-900 bg-zinc-950 divide-x divide-zinc-900 rounded overflow-hidden text-[9px]">
                        {Object.entries(activeSchema.metrics).map(([k, v]) => (
                          <div key={k} className="flex-1 p-1.5 text-center">
                            <span className="text-zinc-650 block text-[8px] truncate">{k.replace("_", " ").toUpperCase()}</span>
                            <span className="text-white font-bold">{(v * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-zinc-600 italic py-2 text-center">
                  [No metadata registers available]
                </div>
              )}

              {/* Gemini context key input */}
              <div className="border-t border-zinc-900 pt-3 space-y-1">
                <span className="text-zinc-600 block text-[9px] uppercase font-bold">GEMINI API KEY</span>
                <input
                  type="password"
                  placeholder="Paste your Gemini key here..."
                  value={localStorage.getItem("GEMINI_API_KEY") || ""}
                  onChange={(e) => {
                    localStorage.setItem("GEMINI_API_KEY", e.target.value);
                    // trigger component state sync
                    setChatInput((prev) => prev); 
                  }}
                  className="bg-black text-amber-500 border border-zinc-900 text-xs px-2 py-1.5 rounded focus:border-amber-500 focus:outline-none w-full"
                />
                <span className="text-[8px] text-zinc-600 block leading-tight">
                  Stored securely in local storage. Key required for retro chatbot console operations.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameBoyConsole;
