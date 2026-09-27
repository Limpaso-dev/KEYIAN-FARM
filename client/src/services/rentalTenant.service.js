import api from "./api";

export const getTenants = async () => {
  const response = await api.get("/rentals/tenants");
  return response.data;
};

export const getTenantById = async (id) => {
  const response = await api.get(`/rentals/tenants/${id}`);
  return response.data;
};

export const createTenant = async (tenantData) => {
  const response = await api.post(
    "/rentals/tenants",
    tenantData
  );
  return response.data;
};

export const updateTenant = async (id, tenantData) => {
  const response = await api.put(
    `/rentals/tenants/${id}`,
    tenantData
  );
  return response.data;
};

export const deleteTenant = async (id) => {
  const response = await api.delete(
    `/rentals/tenants/${id}`
  );
  return response.data;
};