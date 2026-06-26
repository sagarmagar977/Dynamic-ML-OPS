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

export const deployModel = async (modelId, modelFile, metadataFile, colabLink) => {
  const formData = new FormData();
  formData.append("model_id", modelId);
  formData.append("model_file", modelFile);
  if (metadataFile) {
    formData.append("metadata_file", metadataFile);
  }
  if (colabLink) {
    formData.append("colab_link", colabLink);
  }
  
  const { data } = await axios.post(`${API_BASE}/models/deploy`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
};

export const editModel = async (modelId, modelFile, metadataFile, modelName, colabLink) => {
  const formData = new FormData();
  if (modelFile) formData.append("model_file", modelFile);
  if (metadataFile) formData.append("metadata_file", metadataFile);
  if (modelName) formData.append("model_name", modelName);
  if (colabLink !== undefined && colabLink !== null) {
    formData.append("colab_link", colabLink);
  }
  
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

export const inspectModel = async (modelFile) => {
  const formData = new FormData();
  formData.append("model_file", modelFile);
  const { data } = await axios.post(`${API_BASE}/models/inspect`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
};

export const sendAgentMessage = async (message, history, modelId) => {
  const { data } = await axios.post(
    `${API_BASE}/agent/chat`,
    { message, history, model_id: modelId }
  );
  return data;
};

// Supabase DB Operations via Backend Proxy
export const fetchSupabaseStatus = async () => {
  const { data } = await axios.get(`${API_BASE}/supabase/status`);
  return data;
};

export const fetchSupabaseItems = async () => {
  const { data } = await axios.get(`${API_BASE}/supabase/items`);
  return data;
};

export const createSupabaseItem = async (name) => {
  const { data } = await axios.post(`${API_BASE}/supabase/items`, { name });
  return data;
};

export const updateSupabaseItem = async (itemId, name) => {
  const { data } = await axios.put(`${API_BASE}/supabase/items/${itemId}`, { name });
  return data;
};

export const deleteSupabaseItem = async (itemId) => {
  const { data } = await axios.delete(`${API_BASE}/supabase/items/${itemId}`);
  return data;
};