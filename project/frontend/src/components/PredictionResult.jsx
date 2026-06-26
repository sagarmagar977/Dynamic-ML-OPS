// frontend/src/components/PredictionResult.jsx
import React, { useState, useEffect } from "react";
import { getClassImageUrl } from "../services/api";

const PredictionResult = ({ result }) => {
  const [imageError, setImageError] = useState(false);
  
  // Reset image error state whenever prediction results change
  useEffect(() => {
    setImageError(false);
  }, [result]);

  if (!result || result.status !== "success") return null;

  const { prediction, prediction_label, task_type, target_name, model_id, probabilities } = result;

  return (
    <div className="border border-[var(--border-color)] bg-[var(--panel-bg)] p-5 rounded space-y-4 text-left">
      <div className="border-b border-[var(--border-color)] pb-2">
        <h3 className="text-xs text-zinc-500 uppercase tracking-widest font-semibold font-mono">
          Inference Matrix Output
        </h3>
      </div>

      {task_type === "classification" ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10 rounded">
            <div>
              <span className="text-[10px] text-[var(--accent-color)]/70 uppercase tracking-widest font-mono font-bold block mb-1">
                Target: {target_name}
              </span>
              <h2 className="text-2xl font-extrabold text-[var(--accent-color)] uppercase tracking-wider terminal-glow">
                {prediction_label || String(prediction)}
              </h2>
              <span className="text-[10px] text-zinc-500 font-mono block mt-1">
                Raw Value Class ID: {prediction}
              </span>
            </div>

            {/* Custom Category Token Image */}
            <div className="w-16 h-16 border border-zinc-800 bg-black flex items-center justify-center rounded overflow-hidden">
              {!imageError ? (
                <img
                  src={getClassImageUrl(model_id, prediction_label || String(prediction))}
                  alt={prediction_label}
                  onError={() => setImageError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-zinc-750 font-mono text-[10px] uppercase font-bold text-center p-1">
                  No Token
                </span>
              )}
            </div>
          </div>

          {/* Probability Distribution Gauges */}
          {probabilities && (
            <div className="space-y-2">
              <h4 className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                Probability Distribution Map
              </h4>
              <div className="space-y-2 border border-[var(--border-color)] p-3 rounded bg-[var(--panel-bg)]/40">
                {Object.entries(probabilities).map(([cls, prob]) => {
                  const percent = (prob * 100).toFixed(2);
                  const isWinner = cls === prediction_label || String(cls) === String(prediction);
                  return (
                    <div key={cls} className="space-y-1 font-mono text-xs">
                      <div className="flex justify-between text-[11px]">
                        <span className={isWinner ? "text-[var(--accent-color)] font-bold" : "text-zinc-400 dark:text-zinc-500"}>
                          {cls} {isWinner && <span className="ml-1 text-[8px] bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20 px-1 py-0.5 rounded uppercase font-extrabold font-mono inline-block align-middle">WINNER</span>}
                        </span>
                        <span className={isWinner ? "text-[var(--accent-color)] font-bold" : "text-zinc-500"}>
                          {percent}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[var(--border-color)]/30 rounded overflow-hidden">
                        <div
                          className="h-full transition-all duration-500 bg-[var(--accent-color)]"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Regression Mode Layout */
        <div className="p-5 border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10 rounded">
          <span className="text-[10px] text-[var(--accent-color)]/70 uppercase tracking-widest font-mono font-bold block mb-1">
            Predicted Objective: {target_name}
          </span>
          <h2 className="text-3xl font-extrabold text-[var(--accent-color)] uppercase tracking-wider terminal-glow font-mono">
            {typeof prediction === "number"
              ? prediction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
              : String(prediction)}
          </h2>
          <span className="text-[10px] text-zinc-500 font-mono block mt-2 uppercase">
            Stateless scalar target prediction block
          </span>
        </div>
      )}
    </div>
  );
};

export default PredictionResult;