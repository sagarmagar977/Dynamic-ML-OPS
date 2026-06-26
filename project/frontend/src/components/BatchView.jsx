// frontend/src/components/BatchView.jsx
import React, { useState } from "react";
import { predictBatchCsv } from "../services/api";

const BatchView = () => {
  const [csvFile, setCsvFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.endsWith(".csv")) {
      setCsvFile(files[0]);
      setError(null);
      setSuccess(false);
    } else {
      setError("Please drop a valid .csv file.");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith(".csv")) {
      setCsvFile(file);
      setError(null);
      setSuccess(false);
    } else if (file) {
      setError("Selected file is not a valid CSV.");
    }
  };

  const handleExecute = async () => {
    if (!csvFile) {
      setError("No CSV file selected. Please select or drop a file first.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const blob = await predictBatchCsv(csvFile);

      // Download response stream
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `inferred_${csvFile.name}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);

      setSuccess(true);
      setCsvFile(null); // Reset uploader
    } catch (err) {
      setError("Batch execution failed. Ensure headers match the feature dimensions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="border-b border-zinc-950 pb-2">
        <h2 className="text-md font-bold uppercase tracking-wider text-[var(--accent-color)]">
          Batch Ingestion Workspace
        </h2>
        <p className="text-zinc-500 text-[10px] uppercase font-mono mt-1">
          Perform mass records processing via flat-file streaming
        </p>
      </div>

      {error && (
        <div className="border border-red-500 bg-red-950/20 text-red-500 font-mono text-xs p-3 rounded">
          [ENGINE ERROR]: {error}
        </div>
      )}

      {success && (
        <div className="border border-green-500 bg-green-950/20 text-green-500 font-mono text-xs p-3 rounded">
          [SUCCESS]: Batch inference complete. Initiating transformed file download...
        </div>
      )}

      {/* CSV Ingestion Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="border-2 border-dashed border-zinc-800 hover:border-[var(--accent-color)] bg-zinc-950/40 p-8 rounded text-center transition cursor-pointer relative"
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <div className="space-y-2">
          <span className="text-2xl text-zinc-600 block">⎗</span>
          <p className="text-zinc-400 font-mono text-xs uppercase font-bold">
            {csvFile ? `[MOUNTED: ${csvFile.name}]` : "SELECT TARGET CSV FILE - CLICK TO MOUNT TARGET CSV SOURCE"}
          </p>
          <span className="text-[10px] text-zinc-600 uppercase font-mono block">
            {csvFile ? `(${Math.round(csvFile.size / 1024)} KB) - DRAG/DROP ANOTHER FILE TO SWAP` : "Drag and drop standard comma-delimited sheets"}
          </span>
        </div>
      </div>

      {/* Execution Controller */}
      <button
        onClick={handleExecute}
        disabled={loading || !csvFile}
        className="w-full bg-[var(--btn-bg)] text-[var(--btn-text)] font-extrabold uppercase py-4 transition text-xs tracking-widest font-mono rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "STREAMING INFERENCE CHANNELS..." : "EXECUTE BATCH INFERENCE & DOWNLOAD"}
      </button>
    </div>
  );
};

export default BatchView;
