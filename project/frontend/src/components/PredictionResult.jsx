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
    <div className="border border-zinc-800 bg-zinc-950 p-5 rounded space-y-4 text-left">
      <div className="border-b border-zinc-900 pb-2">
        <h3 className="text-xs text-zinc-500 uppercase tracking-widest font-semibold font-mono">
          [Inference Matrix Output]
        </h3>
      </div>

      {task_type === "classification" ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-green-500/30 bg-green-950/10 rounded">
            <div>
              <span className="text-[10px] text-green-500/70 uppercase tracking-widest font-mono font-bold block mb-1">
                Target: {target_name}
              </span>
              <h2 className="text-2xl font-extrabold text-green-400 uppercase tracking-wider terminal-glow-green">
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
                <span className="text-zinc-700 font-mono text-[10px] uppercase font-bold text-center p-1">
                  [No Token]
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
              <div className="space-y-2 border border-zinc-900 p-3 rounded bg-black/40">
                {Object.entries(probabilities).map(([cls, prob]) => {
                  const percent = (prob * 100).toFixed(2);
                  const isWinner = cls === prediction_label || String(cls) === String(prediction);
                  return (
                    <div key={cls} className="space-y-1 font-mono text-xs">
                      <div className="flex justify-between text-[11px]">
                        <span className={isWinner ? "text-green-400 font-bold" : "text-zinc-400"}>
                          {cls} {isWinner && "[WINNER]"}
                        </span>
                        <span className={isWinner ? "text-green-400" : "text-zinc-500"}>
                          {percent}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-zinc-900 rounded overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${isWinner ? "bg-green-500" : "bg-amber-600/40"}`}
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
        <div className="p-5 border border-amber-500/30 bg-amber-950/10 rounded">
          <span className="text-[10px] text-amber-500/70 uppercase tracking-widest font-mono font-bold block mb-1">
            Predicted Objective: {target_name}
          </span>
          <h2 className="text-3xl font-extrabold text-amber-400 uppercase tracking-wider terminal-glow font-mono">
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