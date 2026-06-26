// frontend/src/components/Dropzone.jsx
import React, { useRef, useState } from "react";

const Dropzone = ({ label, accept, selectedFile, onFileSelect }) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      // Basic check for file type
      if (accept && !file.name.endsWith(accept)) {
        alert(`Invalid file type. Please select a ${accept} file.`);
        return;
      }
      onFileSelect(file);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    inputRef.current.click();
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      className={`border border-dashed p-4 rounded text-center transition flex flex-col justify-center items-center h-28 cursor-pointer relative ${
        dragActive ? "border-[var(--accent-color)] bg-[var(--accent-color)]/10" : "border-zinc-800 hover:border-zinc-600 bg-zinc-950/20"
      }`}
      onClick={onButtonClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />

      <span className="text-zinc-600 font-mono text-xs block mb-1">⎋</span>
      <p className="text-[10px] uppercase font-bold text-zinc-400 font-mono tracking-wider">
        {selectedFile ? `[MOUNTED: ${selectedFile.name}]` : label}
      </p>
      <span className="text-[8px] text-zinc-600 uppercase font-mono block mt-1">
        {selectedFile ? `(${Math.round(selectedFile.size / 1024)} KB) - CLICK TO SWAP` : `DRAG & DROP ${accept} ATTACHMENT`}
      </span>
    </div>
  );
};

export default Dropzone;
