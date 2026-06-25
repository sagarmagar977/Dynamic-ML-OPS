// frontend/src/components/PerformanceCharts.jsx
import React from "react";

const PerformanceCharts = ({ schema }) => {
  if (!schema || !schema.task_type) {
    return (
      <div className="text-zinc-600 font-mono text-center py-10">
        [ACTIVATE A MODEL TO GENERATE PERFORMANCE console CHARTS]
      </div>
    );
  }

  const taskType = schema.task_type;
  const chartData = schema.chart_data || {};

  // Renders Classification components
  const renderClassification = () => {
    const cm = chartData.confusion_matrix || [];
    const fi = chartData.feature_importances || {};
    const classes = schema.classes || ["0", "1", "2"];

    // Find max value in confusion matrix for scaling intensity
    const maxCM = cm.length ? Math.max(...cm.flat()) : 1;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
        {/* Confusion Matrix Grid */}
        <div className="border border-zinc-900 bg-zinc-950 p-4 rounded space-y-3">
          <h3 className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
            [Interactive Confusion Matrix Map]
          </h3>
          
          <div className="flex flex-col items-center py-4">
            <div className="grid grid-cols-4 gap-1 w-64 text-center font-mono text-[9px]">
              {/* Header Empty Corner */}
              <div></div>
              {classes.map((cls) => (
                <div key={`header-${cls}`} className="text-amber-500 font-bold uppercase truncate max-w-[60px]" title={cls}>
                  {cls}
                </div>
              ))}

              {/* Rows */}
              {classes.map((actualCls, rowIdx) => (
                <React.Fragment key={`row-${actualCls}`}>
                  {/* Left Label Header */}
                  <div className="text-amber-500 font-bold uppercase flex items-center justify-end pr-2 truncate max-w-[60px]" title={actualCls}>
                    {actualCls}
                  </div>
                  {classes.map((predCls, colIdx) => {
                    const val = cm[rowIdx]?.[colIdx] !== undefined ? cm[rowIdx][colIdx] : 0;
                    // Calculate background opacity based on relative value density
                    const intensity = val / maxCM;
                    const isDiagonal = rowIdx === colIdx;
                    
                    return (
                      <div
                        key={`cell-${rowIdx}-${colIdx}`}
                        className="h-14 border border-zinc-900 flex flex-col items-center justify-center relative group rounded transition"
                        style={{
                          backgroundColor: isDiagonal
                            ? `rgba(0, 255, 0, ${0.1 + intensity * 0.7})`
                            : `rgba(255, 0, 0, ${intensity * 0.6})`,
                        }}
                      >
                        <span className="text-xs font-bold text-white font-mono">
                          {val}
                        </span>
                        
                        {/* Hover Tooltip */}
                        <div className="hidden group-hover:block absolute bottom-full bg-black border border-zinc-700 text-[8px] text-zinc-400 p-2 rounded whitespace-nowrap z-10 pointer-events-none">
                          Act: {actualCls} / Pred: {predCls} <br/> Count: {val}
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            
            <div className="flex justify-between w-64 text-[8px] text-zinc-500 uppercase mt-4 font-mono">
              <span>← Actual labels</span>
              <span>Predicted labels ↑</span>
            </div>
          </div>
        </div>

        {/* Feature Importance Rank Bars */}
        <div className="border border-zinc-900 bg-zinc-950 p-4 rounded space-y-3">
          <h3 className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
            [Feature Importance Weights Deck]
          </h3>
          
          <div className="space-y-4 py-3">
            {Object.entries(fi)
              .sort((a, b) => b[1] - a[1])
              .map(([name, weight]) => {
                const percent = (weight * 100).toFixed(1);
                return (
                  <div key={name} className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-zinc-300 font-semibold">{name}</span>
                      <span className="text-amber-500">{percent}%</span>
                    </div>
                    <div className="w-full h-3 bg-zinc-900 border border-zinc-800 rounded overflow-hidden">
                      <div
                        className="h-full bg-amber-500/80 transition-all duration-700"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    );
  };

  // Renders Regression components
  const renderRegression = () => {
    const scatter = chartData.scatter_data || [];
    const residual = chartData.residual_data || [];

    if (!scatter.length) {
      return (
        <div className="text-zinc-600 font-mono text-center py-10">
          [NO HISTORICAL TEST GRAPH SET FOUND]
        </div>
      );
    }

    // Determine scale bounds
    const actuals = scatter.map((d) => d[0]);
    const predicts = scatter.map((d) => d[1]);
    const minVal = Math.min(...actuals, ...predicts) * 0.9;
    const maxVal = Math.max(...actuals, ...predicts) * 1.1;

    const residuals = residual.map((d) => d[1]);
    const maxRes = Math.max(...residuals.map(Math.abs)) * 1.2 || 1;

    // Helper to map values to SVG viewboxes
    const mapCoords = (val, min, max, svgSize) => {
      const scale = (val - min) / (max - min);
      return scale * (svgSize - 40) + 20; // 20px padding margins
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
        {/* Predicted vs Actual Scatter Plot */}
        <div className="border border-zinc-900 bg-zinc-950 p-4 rounded space-y-3">
          <h3 className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
            [Predicted vs. Actual Target Scatter]
          </h3>
          
          <div className="relative pt-2">
            <svg viewBox="0 0 300 220" className="w-full bg-black rounded border border-zinc-900">
              {/* Diagonal baseline (y = x) */}
              <line
                x1={mapCoords(minVal, minVal, maxVal, 300)}
                y1={220 - mapCoords(minVal, minVal, maxVal, 220)}
                x2={mapCoords(maxVal, minVal, maxVal, 300)}
                y2={220 - mapCoords(maxVal, minVal, maxVal, 220)}
                stroke="#FF9F00"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.4"
              />

              {/* Data points */}
              {scatter.map(([act, pred], idx) => {
                const cx = mapCoords(act, minVal, maxVal, 300);
                const cy = 220 - mapCoords(pred, minVal, maxVal, 220);
                return (
                  <circle
                    key={idx}
                    cx={cx}
                    cy={cy}
                    r="3.5"
                    fill="rgba(255, 159, 0, 0.75)"
                    stroke="#FF9F00"
                    strokeWidth="0.5"
                    className="hover:r-5 transition duration-200 cursor-pointer"
                  >
                    <title>Actual: {act.toFixed(2)}, Predicted: {pred.toFixed(2)}</title>
                  </circle>
                );
              })}

              {/* Axis Label details */}
              <text x="250" y="210" fill="#666" fontSize="6" fontFamily="monospace">ACTUAL</text>
              <text x="10" y="25" fill="#666" fontSize="6" fontFamily="monospace" transform="rotate(-90 10 25)">PREDICTED</text>
            </svg>
          </div>
        </div>

        {/* Residual Deviation Error Charts */}
        <div className="border border-zinc-900 bg-zinc-950 p-4 rounded space-y-3">
          <h3 className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
            [Residual Errors Plot]
          </h3>
          
          <div className="relative pt-2">
            <svg viewBox="0 0 300 220" className="w-full bg-black rounded border border-zinc-900">
              {/* Zero error baseline */}
              <line
                x1="20"
                y1="110"
                x2="280"
                y2="110"
                stroke="#FF0000"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.5"
              />

              {/* Residual data points */}
              {residual.map(([act, res], idx) => {
                const cx = mapCoords(act, minVal, maxVal, 300);
                // Map residuals relative to center y=110
                const cy = 110 - (res / maxRes) * 90;
                return (
                  <circle
                    key={idx}
                    cx={cx}
                    cy={cy}
                    r="3.5"
                    fill="rgba(255, 0, 0, 0.6)"
                    stroke="#FF0000"
                    strokeWidth="0.5"
                    className="hover:r-5 transition duration-200 cursor-pointer"
                  >
                    <title>Actual: {act.toFixed(2)}, Residual: {res.toFixed(2)}</title>
                  </circle>
                );
              })}

              <text x="250" y="210" fill="#666" fontSize="6" fontFamily="monospace">ACTUAL</text>
              <text x="10" y="25" fill="#666" fontSize="6" fontFamily="monospace" transform="rotate(-90 10 25)">RESIDUAL ERROR</text>
            </svg>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-zinc-900 pb-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-amber-500">
          [System Analytics Diagnostics Console]
        </h2>
      </div>

      {taskType === "classification" ? renderClassification() : renderRegression()}
    </div>
  );
};

export default PerformanceCharts;