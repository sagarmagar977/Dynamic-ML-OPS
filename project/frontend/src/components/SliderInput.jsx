// frontend/src/components/SliderInput.jsx
import React from "react";

const SliderInput = ({ name, label, min, max, step, value, onChange }) => {
  const handleInputChange = (e) => {
    let val = e.target.value;
    if (val === "") {
      onChange(name, "");
      return;
    }
    const num = Math.round(parseFloat(val));
    if (!isNaN(num)) {
      onChange(name, num);
    }
  };

  const handleSliderChange = (e) => {
    onChange(name, Math.round(parseFloat(e.target.value)));
  };

  const roundedMin = Math.round(min);
  const roundedMax = Math.round(max);
  const currentValue = value !== undefined && value !== "" ? Math.round(value) : Math.round((min + max) / 2);

  return (
    <div className="flex flex-col space-y-1 py-2 border-b border-[var(--border-color)]">
      <div className="flex justify-between items-center">
        <label className="text-zinc-400 text-xs uppercase font-semibold tracking-wider">
          {label || name}
        </label>
        <span className="text-zinc-500 text-[10px]">
          [Min: {roundedMin} / Max: {roundedMax}]
        </span>
      </div>
      
      <div className="flex items-center space-x-4">
        <input
          type="range"
          min={roundedMin}
          max={roundedMax}
          step={1}
          value={currentValue}
          onChange={handleSliderChange}
          className="flex-1 accent-[var(--accent-color)] cursor-pointer"
        />
        <input
          type="number"
          min={roundedMin}
          max={roundedMax}
          step={1}
          value={value !== undefined ? Math.round(value) : ""}
          onChange={handleInputChange}
          className="w-20 bg-[var(--panel-bg)] text-[var(--text-color)] border border-[var(--border-color)] text-xs px-2 py-1 text-center font-mono rounded focus:border-[var(--accent-color)] focus:outline-none"
        />
      </div>
    </div>
  );
};

export default SliderInput;
