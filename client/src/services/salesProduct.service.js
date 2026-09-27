import api from "./api";

export const createProduct = async (data) => {
  const response = await api.post("/sales/products", data);
  return response.data;
};

export const getProducts = async () => {
  const response = await api.get("/sales/products");
  return response.data;
};

export const getProductById = async (id) => {
  const response = await api.get(`/sales/products/${id}`);
  return response.data;
};

export const updateProduct = async (id, data) => {
  const response = await api.put(`/sales/products/${id}`, data);
  return response.data;
};

export const deleteProduct = async (id) => {
  const response = await api.delete(`/sales/products/${id}`);
  return response.data;
};