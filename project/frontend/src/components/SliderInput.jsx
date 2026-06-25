// frontend/src/components/SliderInput.jsx
import React from "react";

const SliderInput = ({ name, label, min, max, step, value, onChange }) => {
  const handleInputChange = (e) => {
    let val = e.target.value;
    if (val === "") {
      onChange(name, "");
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChange(name, num);
    }
  };

  const handleSliderChange = (e) => {
    onChange(name, parseFloat(e.target.value));
  };

  const currentValue = value !== undefined && value !== "" ? value : (min + max) / 2;

  return (
    <div className="flex flex-col space-y-1 py-2 border-b border-zinc-900">
      <div className="flex justify-between items-center">
        <label className="text-zinc-400 text-xs uppercase font-semibold tracking-wider">
          {label || name}
        </label>
        <span className="text-zinc-500 text-[10px]">
          [Min: {min} / Max: {max}]
        </span>
      </div>
      
      <div className="flex items-center space-x-4">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={handleSliderChange}
          className="flex-1 accent-amber-500 cursor-pointer"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value !== undefined ? value : ""}
          onChange={handleInputChange}
          className="w-20 bg-black text-amber-500 border border-zinc-800 text-xs px-2 py-1 text-center font-mono rounded focus:border-amber-500 focus:outline-none"
        />
      </div>
    </div>
  );
};

export default SliderInput;
