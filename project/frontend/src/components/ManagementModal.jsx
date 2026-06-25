// frontend/src/components/ManagementModal.jsx
import React, { useState } from "react";
import { editModel } from "../services/api";

const ManagementModal = ({ model, onClose, onSaveSuccess }) => {
  const [modelFile, setModelFile] = useState(null);
  const [metadataFile, setMetadataFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!modelFile && !metadataFile) {
      setError("Please select at least one file to upload (model.joblib or metadata.json).");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const resp = await editModel(model.id, modelFile, metadataFile);
      setSuccess(true);
      setTimeout(() => {
        onSaveSuccess(model.id, resp.reloaded);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update model artifacts.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-zinc-950 border border-amber-500 rounded p-6 shadow-2xl shadow-amber-500/10">
        <div className="flex justify-between items-center border-b border-zinc-900 pb-3 mb-4">
          <h3 className="text-md font-bold tracking-wider text-amber-500 uppercase">
            [Artifact Overwrite Panel]
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-xs font-mono"
          >
            [X]
          </button>
        </div>

        <p className="text-zinc-400 text-xs mb-4 font-mono">
          Target Model: <span className="text-white font-bold">{model.name} ({model.id})</span>
        </p>

        {error && (
          <div className="border border-red-500 bg-red-950/20 text-red-500 text-xs p-3 font-mono rounded mb-4">
            [ERROR]: {error}
          </div>
        )}

        {success && (
          <div className="border border-green-500 bg-green-950/20 text-green-500 text-xs p-3 font-mono rounded mb-4">
            [SUCCESS]: Model updated. Trimming volatile memory references...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-[10px] text-zinc-500 uppercase font-semibold">
              Weights Binary File
            </label>
            <div className="flex justify-between items-center text-xs font-mono bg-black text-zinc-400 border border-zinc-900 p-2 rounded">
              <span className="text-zinc-300 font-bold">model.joblib</span>
              <label className="bg-zinc-900 hover:bg-zinc-800 text-amber-500 text-[10px] uppercase px-3 py-1 rounded cursor-pointer select-none font-bold">
                [REPLACE]
                <input
                  type="file"
                  accept=".joblib"
                  onChange={(e) => setModelFile(e.target.files[0])}
                  className="hidden"
                />
              </label>
            </div>
            {modelFile && (
              <div className="text-[10px] text-green-500 font-mono mt-1">
                ✓ Ready to replace with: {modelFile.name}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] text-zinc-500 uppercase font-semibold">
              Metadata Schema JSON
            </label>
            <div className="flex justify-between items-center text-xs font-mono bg-black text-zinc-400 border border-zinc-900 p-2 rounded">
              <span className="text-zinc-300 font-bold">metadata.json</span>
              <label className="bg-zinc-900 hover:bg-zinc-800 text-amber-500 text-[10px] uppercase px-3 py-1 rounded cursor-pointer select-none font-bold">
                [REPLACE]
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => setMetadataFile(e.target.files[0])}
                  className="hidden"
                />
              </label>
            </div>
            {metadataFile && (
              <div className="text-[10px] text-green-500 font-mono mt-1">
                ✓ Ready to replace with: {metadataFile.name}
              </div>
            )}
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="flex-1 border border-zinc-800 text-zinc-400 uppercase text-xs py-2 hover:bg-zinc-900 hover:text-white transition font-mono rounded"
            >
              [Cancel]
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-amber-500 text-black uppercase font-bold text-xs py-2 hover:bg-amber-600 transition font-mono rounded disabled:opacity-50"
            >
              {loading ? "[Uploading...]" : "[Apply Changes]"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManagementModal;
