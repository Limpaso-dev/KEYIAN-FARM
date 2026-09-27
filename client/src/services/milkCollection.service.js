import api from "./api";

export const getMilkCollections = async () => {
  const response = await api.get("/milk-collection");
  return response.data;
};

export const getMilkCollectionById = async (id) => {
  const response = await api.get(`/milk-collection/${id}`);
  return response.data;
};

export const createMilkCollection = async (collectionData) => {
  const response = await api.post(
    "/milk-collection",
    collectionData
  );

  return response.data;
};

export const updateMilkCollection = async (
  id,
  collectionData
) => {
  const response = await api.put(
    `/milk-collection/${id}`,
    collectionData
  );

  return response.data;
};

export const deleteMilkCollection = async (id) => {
  const response = await api.delete(
    `/milk-collection/${id}`
  );

  return response.data;
};