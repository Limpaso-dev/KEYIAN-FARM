import api from "./api";

export const getTeaFarms = async () => {
  const response = await api.get("/tea");
  return response.data;
};

export const getTeaFarmById = async (id) => {
  const response = await api.get(`/tea/${id}`);
  return response.data;
};

export const createTeaFarm = async (data) => {
  const response = await api.post("/tea", data);
  return response.data;
};

export const updateTeaFarm = async (id, data) => {
  const response = await api.put(`/tea/${id}`, data);
  return response.data;
};

export const deleteTeaFarm = async (id) => {
  const response = await api.delete(`/tea/${id}`);
  return response.data;
};