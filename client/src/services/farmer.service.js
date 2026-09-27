import api from "./api";

export const getFarmers = async () => {
  const response = await api.get("/farmers");
  return response.data;
};

export const getFarmerById = async (id) => {
  const response = await api.get(`/farmers/${id}`);
  return response.data;
};

export const createFarmer = async (farmerData) => {
  const response = await api.post("/farmers", farmerData);
  return response.data;
};

export const updateFarmer = async (id, farmerData) => {
  const response = await api.put(`/farmers/${id}`, farmerData);
  return response.data;
};

export const deleteFarmer = async (id) => {
  const response = await api.delete(`/farmers/${id}`);
  return response.data;
};