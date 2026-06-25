// frontend/src/components/ModelManager.jsx
import React, { useState } from "react";
import Dropzone from "./Dropzone";
import ManagementModal from "./ManagementModal";
import { deployModel, deleteModel, activateModel, uploadClassImage } from "../services/api";

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

  const handleDeploy = async (e) => {
    e.preventDefault();
    if (!newModelId || !modelFile || !metadataFile) {
      setUploadError("Please provide Model ID and select both files.");
      return;
    }

    setUploadLoading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      await deployModel(newModelId.trim(), modelFile, metadataFile);
      setUploadSuccess(true);
      setNewModelId("");
      setModelFile(null);
      setMetadataFile(null);
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
        <h3 className="text-xs text-amber-500 font-bold uppercase tracking-wider border-b border-zinc-900 pb-2">
          [Dual-Asset Registry Pipeline]
        </h3>

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
              label="Select metadata.json"
              accept=".json"
              selectedFile={metadataFile}
              onFileSelect={setMetadataFile}
            />
          </div>

          <button
            type="submit"
            disabled={uploadLoading || !newModelId || !modelFile || !metadataFile}
            className="w-full bg-amber-500 hover:bg-amber-600 text-black uppercase font-bold py-2 font-mono text-xs tracking-widest transition rounded disabled:opacity-50"
          >
            {uploadLoading ? "[MOUNTING CHANNELS...]" : "MOUNT NEW ARTIFACTS"}
          </button>
        </form>
      </div>

      {/* Models Inventory Ledger Grid */}
      <div className="border border-zinc-900 bg-zinc-950 p-5 rounded space-y-4">
        <h3 className="text-xs text-amber-500 font-bold uppercase tracking-wider border-b border-zinc-900 pb-2">
          [Registry Ledger Data Grid]
        </h3>

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
                models.map((model) => (
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
                ))
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