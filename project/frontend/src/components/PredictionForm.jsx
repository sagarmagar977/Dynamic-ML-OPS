// frontend/src/components/PredictionForm.jsx
import React, { useState, useEffect } from "react";
import SliderInput from "./SliderInput";
import SelectInput from "./SelectInput";

const PredictionForm = ({ schema, onPredict }) => {
  const [formData, setFormData] = useState({});

  // Initialize form with defaults on schema change
  useEffect(() => {
    if (!schema || !schema.features) return;
    const initialData = {};
    schema.features.forEach((field) => {
      initialData[field.name] =
        field.default !== undefined
          ? field.default
          : field.type === "continuous"
          ? (field.min + field.max) / 2
          : "";
    });
    setFormData(initialData);
  }, [schema]);

  const handleFieldChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleClear = () => {
    if (!schema || !schema.features) return;
    const initialData = {};
    schema.features.forEach((field) => {
      initialData[field.name] =
        field.type === "continuous" ? (field.min + field.max) / 2 : "";
    });
    setFormData(initialData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!schema || !schema.features) return;

    // Ordered list of features according to schema features index order
    const orderedFeatures = schema.features.map((field) => {
      const val = formData[field.name];
      return val !== undefined && val !== "" ? val : 0.0;
    });

    onPredict(orderedFeatures);
  };

  if (!schema || !schema.features) {
    return (
      <div className="text-zinc-500 font-mono text-center py-10">
        [NO MODEL ACTIVE. ACTIVATE A MODEL VIA THE DEPLOY TAB FIRST]
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-amber-500">
          [Feature Parameter Deck]
        </h3>
        <button
          type="button"
          onClick={handleClear}
          className="text-zinc-500 hover:text-amber-500 font-mono text-[10px] uppercase transition"
        >
          [Reset Deck]
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 max-h-[350px] overflow-y-auto pr-2">
        {schema.features.map((field) => {
          if (field.type === "continuous") {
            return (
              <SliderInput
                key={field.name}
                name={field.name}
                label={field.label}
                min={field.min}
                max={field.max}
                step={field.step}
                value={formData[field.name]}
                onChange={handleFieldChange}
              />
            );
          } else {
            return (
              <SelectInput
                key={field.name}
                name={field.name}
                label={field.label}
                options={field.options}
                value={formData[field.name]}
                onChange={handleFieldChange}
              />
            );
          }
        })}
      </div>

      <button
        type="submit"
        className="w-full bg-amber-500 hover:bg-amber-600 text-black uppercase font-bold py-3 transition text-sm tracking-wider font-mono rounded"
      >
        [EXECUTE SINGLE INFERENCE CALCULATOR]
      </button>
    </form>
  );
};

export default PredictionForm;