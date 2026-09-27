import api from "./api";

export const getProperties = async () => {
  const response = await api.get("/rentals/properties");
  return response.data;
};

export const getPropertyById = async (id) => {
  const response = await api.get(`/rentals/properties/${id}`);
  return response.data;
};

export const createProperty = async (propertyData) => {
  const response = await api.post(
    "/rentals/properties",
    propertyData
  );
  return response.data;
};

export const updateProperty = async (id, propertyData) => {
  const response = await api.put(
    `/rentals/properties/${id}`,
    propertyData
  );
  return response.data;
};

export const deleteProperty = async (id) => {
  const response = await api.delete(
    `/rentals/properties/${id}`
  );
  return response.data;
};