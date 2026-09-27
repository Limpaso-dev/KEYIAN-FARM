import api from "./api";

export const createCustomer = async (data) => {
  const response = await api.post("/sales/customers", data);
  return response.data;
};

export const getCustomers = async () => {
  const response = await api.get("/sales/customers");
  return response.data;
};

export const getCustomerById = async (id) => {
  const response = await api.get(`/sales/customers/${id}`);
  return response.data;
};

export const updateCustomer = async (id, data) => {
  const response = await api.put(`/sales/customers/${id}`, data);
  return response.data;
};

export const deleteCustomer = async (id) => {
  const response = await api.delete(`/sales/customers/${id}`);
  return response.data;
};