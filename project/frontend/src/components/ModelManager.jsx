// frontend/src/components/ModelManager.jsx
import React, { useState, useEffect } from "react";
import Dropzone from "./Dropzone";
import ManagementModal from "./ManagementModal";
import { deployModel, deleteModel, activateModel, uploadClassImage, inspectModel } from "../services/api";

const ModelManager = ({ models, activeModelId, onRefresh, onActivate }) => {
  const [newModelId, setNewModelId] = useState("");
  const [modelFile, setModelFile] = useState(null);
  const [metadataFile, setMetadataFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Class Image Upload state
  const [selectedClassModelId, setSelectedClassModelId] = useState(null);
  const [selectedClassName, setSelectedClassName] = useState("");
  const [classImageFile, setClassImageFile] = useState(null);
  const [classUploadLoading, setClassUploadLoading] = useState(false);

  // Lifecycle Menu state
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Edit Modal state
  const [editingModel, setEditingModel] = useState(null);

  // Helper Snippet visibility state
  const [showHelper, setShowHelper] = useState(false);

  // Inspection & Class Image Upload states
  const [inspectedData, setInspectedData] = useState(null);
  const [wantClassImages, setWantClassImages] = useState(false);
  const [classImages, setClassImages] = useState({});
  const [inspectLoading, setInspectLoading] = useState(false);
  const [metaClassNames, setMetaClassNames] = useState([]);
  const [sortBy, setSortBy] = useState("newest");
  const [autoActivate, setAutoActivate] = useState(false);

  // Local metadata reader to extract friendly class names
  useEffect(() => {
    if (!metadataFile) {
      setMetaClassNames([]);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        let foundClasses = [];
        for (const key of ["classes", "target_names", "labels", "class_names"]) {
          if (Array.isArray(json[key])) {
            foundClasses = json[key];
            break;
          }
        }
        setMetaClassNames(foundClasses);
      } catch (err) {
        console.error("Failed to parse metadata file locally:", err);
      }
    };
    reader.readAsText(metadataFile);
  }, [metadataFile]);

  useEffect(() => {
    const runInspect = async () => {
      if (!modelFile) {
        setInspectedData(null);
        setWantClassImages(false);
        setClassImages({});
        return;
      }
      setInspectLoading(true);
      setUploadError(null);
      try {
        const result = await inspectModel(modelFile);
        setInspectedData(result);
      } catch (err) {
        console.error("Model inspection failed:", err);
        setUploadError("Could not inspect model file. Please ensure it is a valid joblib file.");
        setInspectedData(null);
      } finally {
        setInspectLoading(false);
      }
    };
    runInspect();
  }, [modelFile]);

  const handleDeploy = async (e) => {
    e.preventDefault();
    if (!newModelId || !modelFile) {
      setUploadError("Please provide Model ID and select a model file.");
      return;
    }

    setUploadLoading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      // 1. Deploy/Mount model first
      const modelIdTrimmed = newModelId.trim();
      await deployModel(modelIdTrimmed, modelFile, metadataFile);

      // 2. If classification and user checked to add images, upload them using mapped class name
      if (inspectedData?.task_type === "classification" && wantClassImages) {
        for (let idx = 0; idx < inspectedData.classes.length; idx++) {
          const rawClassName = inspectedData.classes[idx];
          const friendlyName = metaClassNames[idx] || rawClassName;
          const imageFile = classImages[rawClassName];
          if (imageFile) {
            await uploadClassImage(modelIdTrimmed, friendlyName, imageFile);
          }
        }
      }

      // 3. Auto-activate model if selected
      if (autoActivate) {
        await activateModel(modelIdTrimmed);
        onActivate(modelIdTrimmed);
      }

      setUploadSuccess(true);
      setNewModelId("");
      setModelFile(null);
      setMetadataFile(null);
      setInspectedData(null);
      setWantClassImages(false);
      setClassImages({});
      setMetaClassNames([]);
      setAutoActivate(false);
      onRefresh();
    } catch (err) {
      setUploadError(err.response?.data?.detail || "Model deployment failed.");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleActivate = async (id) => {
    try {
      await activateModel(id);
      onActivate(id);
      setActiveMenuId(null);
    } catch (err) {
      alert("Activation failed: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (confirm(`Are you sure you want to completely de-register and delete ${id}?`)) {
      try {
        await deleteModel(id);
        onRefresh();
        setActiveMenuId(null);
      } catch (err) {
        alert("Deletion failed: " + (err.response?.data?.detail || err.message));
      }
    }
  };

  const handleClassImageUpload = async (e) => {
    e.preventDefault();
    if (!selectedClassModelId || !selectedClassName || !classImageFile) return;

    setClassUploadLoading(true);
    try {
      await uploadClassImage(selectedClassModelId, selectedClassName, classImageFile);
      alert(`Successfully uploaded token for class [${selectedClassName}]`);
      setSelectedClassModelId(null);
      setSelectedClassName("");
      setClassImageFile(null);
      onRefresh(); // refresh schema
    } catch (err) {
      alert("Class image upload failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setClassUploadLoading(false);
    }
  };

  return (
    <div className="space-y-8 text-left">
      {/* Upload/Deploy Box */}
      <div className="border border-zinc-900 bg-zinc-950 p-5 rounded space-y-4">
        <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
          <h3 className="text-xs text-amber-500 font-bold uppercase tracking-wider">
            [Dual-Asset Registry Pipeline]
          </h3>
          <button
            type="button"
            onClick={() => setShowHelper(!showHelper)}
            className="text-[10px] text-zinc-500 hover:text-amber-500 font-mono transition uppercase font-semibold border border-zinc-800 hover:border-amber-500 px-2 py-0.5 rounded"
          >
            {showHelper ? "[HIDE PYTHON HELP]" : "[SHOW PYTHON HELP]"}
          </button>
        </div>

        {showHelper && (
          <div className="border border-zinc-800 bg-black/60 p-4 rounded font-mono text-[11px] text-zinc-400 space-y-3">
            <div className="text-amber-500 font-semibold">[HOW TO PREPARE ARTIFACTS FOR DEPLOYMENT]</div>
            <p>Run this code in your Jupyter or Colab notebook to generate perfectly compatible assets:</p>
            <pre className="bg-zinc-950 p-3 rounded text-zinc-300 overflow-x-auto text-[10px] border border-zinc-900 leading-relaxed">
              {`# 1. Export your trained model
import joblib
joblib.dump(model, "model.joblib")

# 2. Export metadata (optional - missing values are auto-inferred)
import json
from datetime import datetime

metadata = {
    "model_name": "RandomForestClassifier",
    "trained_at": datetime.utcnow().isoformat(),
    "feature_names": list(feature_names),  # Will automatically map to input sliders
    "classes": list(model.classes_),       # Optional for classification models
    "task_type": "classification"          # "classification" or "regression"
}

with open("metadata.json", "w") as f:
    json.dump(metadata, f, indent=4)
`}
            </pre>
            <p className="text-zinc-500 text-[10px]">
              * Note: The backend automatically normalizes different name conventions (like <code className="text-zinc-400">feature_names</code>, <code className="text-zinc-400">columns</code>, or <code className="text-zinc-400">features</code>) and falls back to generating placeholders if omitted.
            </p>
          </div>
        )}

        {uploadError && (
          <div className="border border-red-500 bg-red-950/20 text-red-500 font-mono text-xs p-3 rounded">
            [DEPLOY ERROR]: {uploadError}
          </div>
        )}

        {uploadSuccess && (
          <div className="border border-green-500 bg-green-950/20 text-green-500 font-mono text-xs p-3 rounded">
            [SUCCESS]: Model mounted into static workspace directories.
          </div>
        )}

        <form onSubmit={handleDeploy} className="space-y-4">
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] text-zinc-500 uppercase font-semibold">
              Assign Model Identity Code
            </label>
            <input
              type="text"
              placeholder="e.g. iris_classifier_v3"
              value={newModelId}
              onChange={(e) => setNewModelId(e.target.value)}
              className="bg-black text-amber-500 border border-zinc-900 text-xs px-3 py-2 font-mono rounded focus:border-amber-500 focus:outline-none w-full"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Dropzone
              label="Select model.joblib"
              accept=".joblib"
              selectedFile={modelFile}
              onFileSelect={setModelFile}
            />
            <Dropzone
              label="Select metadata.json (optional)"
              accept=".json"
              selectedFile={metadataFile}
              onFileSelect={setMetadataFile}
            />
          </div>

          {inspectLoading && (
            <div className="text-[10px] text-zinc-500 font-mono animate-pulse">
              [ANALYZING MODEL BINARY INTEGRITY...]
            </div>
          )}

          {inspectedData && (
            <div className="border border-zinc-900 bg-black/40 p-3 rounded space-y-3">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono uppercase bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-amber-500 font-semibold">
                  Task Type: {inspectedData.task_type}
                </span>
                {inspectedData.task_type === "classification" && (
                  <span className="text-[10px] font-mono text-zinc-500">
                    ({inspectedData.classes.length} classes detected)
                  </span>
                )}
              </div>

              {inspectedData.task_type === "classification" && (
                <div className="space-y-3">
                  <label className="flex items-center space-x-2 cursor-pointer text-xs font-mono text-zinc-400 select-none">
                    <input
                      type="checkbox"
                      checked={wantClassImages}
                      onChange={(e) => setWantClassImages(e.target.checked)}
                      className="accent-amber-500 bg-black border border-zinc-900"
                    />
                    <span>Associate custom token images with target classes?</span>
                  </label>

                  {wantClassImages && (
                    <div className="border-t border-zinc-900 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {inspectedData.classes.map((cls, idx) => {
                        const friendlyName = metaClassNames[idx] || cls;
                        const displayName = metaClassNames[idx] ? `${metaClassNames[idx]} (${cls})` : cls;
                        return (
                          <div key={cls} className="flex flex-col space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase font-semibold">
                              Image token for: <strong className="text-zinc-300 font-mono">{displayName}</strong>
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setClassImages((prev) => ({ ...prev, [cls]: file }));
                                }
                              }}
                              className="bg-black text-zinc-400 border border-zinc-900 text-[10px] p-1 font-mono rounded file:bg-zinc-900 file:text-amber-500 file:border-none file:text-[9px] file:uppercase file:font-semibold file:px-2 file:py-1 file:mr-2 file:rounded file:cursor-pointer"
                            />
                            {classImages[cls] && (
                              <span className="text-[9px] text-green-500 font-mono">
                                ✓ Selected: {classImages[cls].name}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center space-x-2 pb-1 pt-2">
            <input
              type="checkbox"
              id="autoActivate"
              checked={autoActivate}
              onChange={(e) => setAutoActivate(e.target.checked)}
              className="accent-amber-500 bg-black border border-zinc-900 cursor-pointer"
            />
            <label htmlFor="autoActivate" className="text-[10px] text-zinc-400 font-mono select-none cursor-pointer uppercase font-semibold">
              Activate model automatically upon deployment?
            </label>
          </div>

          <button
            type="submit"
            disabled={uploadLoading || !newModelId || !modelFile}
            className="w-full bg-amber-500 hover:bg-amber-600 text-black uppercase font-bold py-2 font-mono text-xs tracking-widest transition rounded disabled:opacity-50"
          >
            {uploadLoading ? "[MOUNTING CHANNELS...]" : "MOUNT NEW ARTIFACTS"}
          </button>
        </form>
      </div>

      {/* Models Inventory Ledger Grid */}
      <div className="border border-zinc-900 bg-zinc-950 p-5 rounded space-y-4">
        <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
          <h3 className="text-xs text-amber-500 font-bold uppercase tracking-wider">
            [ARTIFACTS]
          </h3>
          <div className="flex items-center space-x-2 text-[10px] text-zinc-500 font-mono">
            <span>SORT:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-black text-amber-500 border border-zinc-800 text-[10px] px-2 py-0.5 rounded focus:outline-none focus:border-amber-500"
            >
              <option value="newest">NEWEST FIRST</option>
              <option value="oldest">OLDEST FIRST</option>
              <option value="modified">LATEST MODIFIED</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse text-zinc-400">
            <thead>
              <tr className="border-b border-zinc-900 text-zinc-500 text-left">
                <th className="py-2 px-2 uppercase text-[10px]">Model Identity / Algorithm</th>
                <th className="py-2 px-2 uppercase text-[10px]">Task Allocation</th>
                <th className="py-2 px-2 uppercase text-[10px]">Baseline metrics</th>
                <th className="py-2 px-2 uppercase text-[10px]">Active Status</th>
                <th className="py-2 px-2 uppercase text-[10px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {models.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-zinc-600">
                    [NO SANDBOXED MODEL DIRECTORIES DISCOVERED]
                  </td>
                </tr>
              ) : (
                (() => {
                  const sortedModels = [...models].sort((a, b) => {
                    if (sortBy === "newest") return (b.created_at || 0) - (a.created_at || 0);
                    if (sortBy === "oldest") return (a.created_at || 0) - (b.created_at || 0);
                    if (sortBy === "modified") return (b.modified_at || 0) - (a.modified_at || 0);
                    return 0;
                  });
                  return sortedModels.map((model) => (
                    <tr key={model.id} className="border-b border-zinc-900/60 hover:bg-zinc-900/10">
                      <td className="py-3 px-2">
                        <div className="text-white font-bold">{model.name}</div>
                        <div className="text-[10px] text-zinc-500">{model.id} | {model.algorithm_variant}</div>
                      </td>
                      <td className="py-3 px-2 uppercase text-amber-600 font-bold">
                        {model.task_type}
                      </td>
                      <td className="py-3 px-2">
                        {Object.entries(model.metrics || {}).map(([m, val]) => (
                          <div key={m} className="text-[10px] whitespace-nowrap">
                            {m.toUpperCase()}: {(val * 100).toFixed(1)}%
                          </div>
                        ))}
                      </td>
                      <td className="py-3 px-2">
                        {model.active ? (
                          <span className="inline-block px-2 py-0.5 border border-green-500 text-green-500 bg-green-950/20 text-[9px] uppercase font-bold rounded animate-pulse">
                            [ONLINE]
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 border border-zinc-800 text-zinc-600 bg-zinc-950 text-[9px] uppercase font-bold rounded">
                            [COLD]
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right relative">
                        <div className="flex items-center justify-end space-x-2">
                          {/* Class Image Trigger */}
                          {model.classes && model.classes.length > 0 && (
                            <button
                              onClick={() => {
                                setSelectedClassModelId(model.id);
                                setSelectedClassName(model.classes[0]);
                              }}
                              className="border border-zinc-800 hover:border-amber-500/50 text-[9px] text-zinc-500 hover:text-amber-500 px-2 py-0.5 rounded font-mono uppercase"
                            >
                              [Visual Token]
                            </button>
                          )}

                          <button
                            onClick={() => setActiveMenuId(activeMenuId === model.id ? null : model.id)}
                            className="text-zinc-500 hover:text-white p-1 font-mono text-sm"
                          >
                            ⋮
                          </button>
                        </div>

                        {/* 3-Dot Action Menu Context Dropdown */}
                        {activeMenuId === model.id && (
                          <div className="absolute right-2 mt-1 w-32 bg-zinc-950 border border-zinc-800 rounded shadow-xl z-20 text-left py-1 font-mono text-[10px] uppercase">
                            <button
                              onClick={() => handleActivate(model.id)}
                              className="w-full text-left px-3 py-1.5 hover:bg-zinc-900 text-green-500 font-bold block"
                            >
                              [ACTIVATE]
                            </button>
                            <button
                              onClick={() => setEditingModel(model)}
                              className="w-full text-left px-3 py-1.5 hover:bg-zinc-900 text-amber-500 block"
                            >
                              [EDIT]
                            </button>
                            <button
                              onClick={() => handleDelete(model.id)}
                              disabled={model.active}
                              className="w-full text-left px-3 py-1.5 hover:bg-zinc-900 text-red-500 disabled:opacity-30 block"
                            >
                              [DELETE]
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ));
                })()
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual Token Custom Image Uploader Modal Overlay */}
      {selectedClassModelId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-zinc-950 border border-amber-500 rounded p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
              <h4 className="text-xs text-amber-500 font-bold uppercase tracking-wider">
                [Upload Category Token]
              </h4>
              <button
                onClick={() => setSelectedClassModelId(null)}
                className="text-zinc-500 font-mono text-xs"
              >
                [X]
              </button>
            </div>

            <form onSubmit={handleClassImageUpload} className="space-y-4 text-left">
              <div className="space-y-1 font-mono text-xs">
                <label className="text-zinc-500 block">Class Category Target</label>
                <select
                  value={selectedClassName}
                  onChange={(e) => setSelectedClassName(e.target.value)}
                  className="bg-black text-amber-500 border border-zinc-900 w-full p-2 text-xs font-mono rounded"
                >
                  {models
                    .find((m) => m.id === selectedClassModelId)
                    ?.classes.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 uppercase font-semibold block">
                  Select Visual Image File (.png)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setClassImageFile(e.target.files[0])}
                  className="w-full text-xs font-mono bg-black text-zinc-400 border border-zinc-900 p-2 rounded"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedClassModelId(null)}
                  className="flex-1 border border-zinc-800 text-zinc-400 py-1.5 uppercase text-xs font-mono rounded hover:bg-zinc-900"
                >
                  [Cancel]
                </button>
                <button
                  type="submit"
                  disabled={classUploadLoading || !classImageFile}
                  className="flex-1 bg-amber-500 text-black font-bold py-1.5 uppercase text-xs font-mono rounded hover:bg-amber-600 disabled:opacity-50"
                >
                  {classUploadLoading ? "[Uploading...]" : "[Upload Token]"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Overlay Modal */}
      {editingModel && (
        <ManagementModal
          model={editingModel}
          onClose={() => setEditingModel(null)}
          onSaveSuccess={(modelId, reloaded) => {
            onRefresh();
            if (reloaded) {
              onActivate(modelId);
            }
          }}
        />
      )}
    </div>
  );
};

export default ModelManager;