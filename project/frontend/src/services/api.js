// frontend/src/services/api.js
import axios from "axios";

const API_BASE = "/api"; // Mapped through Vite proxy to http://localhost:8000

export const fetchModels = async () => {
  const { data } = await axios.get(`${API_BASE}/models`);
  return data.models; // Returns list of model objects
};

export const fetchModelInfo = async (modelId) => {
  const { data } = await axios.get(`${API_BASE}/models/${modelId}/info`);
  return data; // Returns model metadata
};

export const activateModel = async (modelId) => {
  const { data } = await axios.post(`${API_BASE}/models/${modelId}/activate`);
  return data;
};

export const deleteModel = async (modelId) => {
  const { data } = await axios.delete(`${API_BASE}/models/${modelId}`);
  return data;
};

export const unloadModel = async () => {
  const { data } = await axios.post(`${API_BASE}/models/unload`);
  return data;
};

export const deployModel = async (modelId, modelFile, metadataFile) => {
  const formData = new FormData();
  formData.append("model_id", modelId);
  formData.append("model_file", modelFile);
  formData.append("metadata_file", metadataFile);
  
  const { data } = await axios.post(`${API_BASE}/models/deploy`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
};

export const editModel = async (modelId, modelFile, metadataFile) => {
  const formData = new FormData();
  if (modelFile) formData.append("model_file", modelFile);
  if (metadataFile) formData.append("metadata_file", metadataFile);
  
  const { data } = await axios.post(`${API_BASE}/models/${modelId}/edit`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
};

export const uploadClassImage = async (modelId, className, imageFile) => {
  const formData = new FormData();
  formData.append("file", imageFile);
  
  const { data } = await axios.post(
    `${API_BASE}/models/${modelId}/class-image/${className}`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return data;
};

export const getClassImageUrl = (modelId, className) => {
  return `${API_BASE}/models/${modelId}/class-image/${className}?t=${new Date().getTime()}`;
};

export const predict = async (payload) => {
  const { data } = await axios.post(`${API_BASE}/predict`, payload);
  return data;
};

export const predictBatchCsv = async (csvFile) => {
  const formData = new FormData();
  formData.append("file", csvFile);
  
  const { data } = await axios.post(`${API_BASE}/predict-batch/csv`, formData, {
    responseType: "blob", // To handle CSV download streaming response as per PRD Section 2.3
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data; // returns blob
};