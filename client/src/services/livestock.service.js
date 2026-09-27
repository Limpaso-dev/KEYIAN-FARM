import api from "./api";

export const getLivestock = async () => {
  const response = await api.get("/livestock");
  return response.data;
};

export const getLivestockById = async (id) => {
  const response = await api.get(`/livestock/${id}`);
  return response.data;
};

export const createLivestock = async (livestockData) => {
  const response = await api.post("/livestock", livestockData);
  return response.data;
};

export const updateLivestock = async (id, livestockData) => {
  const response = await api.put(
    `/livestock/${id}`,
    livestockData
  );
  return response.data;
};

export const deleteLivestock = async (id) => {
  const response = await api.delete(`/livestock/${id}`);
  return response.data;
};