import api from "./api";

export const getSugarcaneFarms = async () => {
  const response = await api.get("/sugarcane");
  return response.data;
};

export const getSugarcaneFarmById = async (id) => {
  const response = await api.get(
    `/sugarcane/${id}`
  );
  return response.data;
};

export const createSugarcaneFarm = async (data) => {
  const response = await api.post(
    "/sugarcane",
    data
  );
  return response.data;
};

export const updateSugarcaneFarm = async (
  id,
  data
) => {
  const response = await api.put(
    `/sugarcane/${id}`,
    data
  );
  return response.data;
};

export const deleteSugarcaneFarm = async (id) => {
  const response = await api.delete(
    `/sugarcane/${id}`
  );
  return response.data;
};