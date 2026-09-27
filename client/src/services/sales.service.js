import api from "./api";

export const createSale = async (data) => {
  const response = await api.post("/sales", data);
  return response.data;
};

export const getSales = async () => {
  const response = await api.get("/sales");
  return response.data;
};

export const getSaleById = async (id) => {
  const response = await api.get(`/sales/${id}`);
  return response.data;
};

export const updateSale = async (id, data) => {
  const response = await api.put(`/sales/${id}`, data);
  return response.data;
};

export const deleteSale = async (id) => {
  const response = await api.delete(`/sales/${id}`);
  return response.data;
};

export const getSalesSummary = async () => {
  const response = await api.get("/sales/summary");
  return response.data;
};