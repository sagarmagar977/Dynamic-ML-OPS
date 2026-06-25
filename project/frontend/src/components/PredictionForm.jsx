// frontend/src/components/PredictionForm.jsx
import React, { useState, useEffect } from "react";
import SliderInput from "./SliderInput";
import SelectInput from "./SelectInput";

const PredictionForm = ({ schema, onPredict }) => {
  const [formData, setFormData] = useState({});

  // Helper function to normalize field parameters
  const getFieldParams = (field) => {
    const isString = typeof field === "string";
    const name = isString ? field : field.name;
    const label = isString ? field : (field.label || field.name);
    const type = isString ? "continuous" : (field.type || "continuous");
    const min = isString ? 0 : (field.min !== undefined ? field.min : 0);
    const max = isString ? 10 : (field.max !== undefined ? field.max : 10);
    const step = isString ? 0.1 : (field.step !== undefined ? field.step : 0.1);
    
    let defaultValue = "";
    if (type === "continuous") {
      defaultValue = isString 
        ? 5 
        : (field.default !== undefined ? field.default : (min + max) / 2);
    } else {
      defaultValue = isString ? "" : (field.default !== undefined ? field.default : "");
    }

    return { name, label, type, min, max, step, defaultValue };
  };

  // Initialize form with defaults on schema change
  useEffect(() => {
    if (!schema || !schema.features) return;
    const initialData = {};
    schema.features.forEach((field) => {
      const params = getFieldParams(field);
      initialData[params.name] = params.defaultValue;
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
      const params = getFieldParams(field);
      initialData[params.name] = params.defaultValue;
    });
    setFormData(initialData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!schema || !schema.features) return;

    // Ordered list of features according to schema features index order
    const orderedFeatures = schema.features.map((field) => {
      const params = getFieldParams(field);
      const val = formData[params.name];
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
          const params = getFieldParams(field);
          if (params.type === "continuous") {
            return (
              <SliderInput
                key={params.name}
                name={params.name}
                label={params.label}
                min={params.min}
                max={params.max}
                step={params.step}
                value={formData[params.name]}
                onChange={handleFieldChange}
              />
            );
          } else {
            return (
              <SelectInput
                key={params.name}
                name={params.name}
                label={params.label}
                options={field.options || []}
                value={formData[params.name]}
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