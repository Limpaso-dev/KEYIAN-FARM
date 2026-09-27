import api from "./api";

export const getInventory = async () => {
  const response = await api.get("/inventory");
  return response.data;
};

export const getInventoryById = async (id) => {
  const response = await api.get(`/inventory/${id}`);
  return response.data;
};

export const createInventory = async (inventoryData) => {
  const response = await api.post(
    "/inventory",
    inventoryData
  );

  return response.data;
};

export const updateInventory = async (
  id,
  inventoryData
) => {
  const response = await api.put(
    `/inventory/${id}`,
    inventoryData
  );

  return response.data;
};

export const deleteInventory = async (id) => {
  const response = await api.delete(
    `/inventory/${id}`
  );

  return response.data;
};