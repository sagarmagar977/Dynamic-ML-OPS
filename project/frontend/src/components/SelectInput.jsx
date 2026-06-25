// frontend/src/components/SelectInput.jsx
import React from "react";

const SelectInput = ({ name, label, options, value, onChange }) => {
  const handleChange = (e) => {
    const val = e.target.value;
    // Attempt parsing numerical values if possible
    const num = parseFloat(val);
    onChange(name, !isNaN(num) && String(num) === val ? num : val);
  };

  // Convert array of strings to array of label/value objects if necessary
  const parsedOptions = (options || []).map((opt) => {
    if (typeof opt === "object" && opt !== null) {
      return opt;
    }
    return { label: String(opt), value: opt };
  });

  return (
    <div className="flex flex-col space-y-1 py-2 border-b border-zinc-900">
      <label className="text-zinc-400 text-xs uppercase font-semibold tracking-wider text-left">
        {label || name}
      </label>
      <select
        value={value !== undefined ? value : ""}
        onChange={handleChange}
        className="w-full bg-black text-amber-500 border border-zinc-800 text-xs px-2 py-2 font-mono rounded cursor-pointer focus:border-amber-500 focus:outline-none"
      >
        <option value="" disabled>-- SELECT AN OPTION --</option>
        {parsedOptions.map((opt, i) => (
          <option key={i} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SelectInput;
