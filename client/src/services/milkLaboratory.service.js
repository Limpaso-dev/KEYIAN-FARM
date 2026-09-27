import api from "./api";

export const getMilkTests = async () => {
  const response = await api.get("/milk-laboratory");
  return response.data;
};

export const getMilkTestById = async (id) => {
  const response = await api.get(`/milk-laboratory/${id}`);
  return response.data;
};

export const createMilkTest = async (testData) => {
  const response = await api.post(
    "/milk-laboratory",
    testData
  );
  return response.data;
};

export const updateMilkTest = async (id, testData) => {
  const response = await api.put(
    `/milk-laboratory/${id}`,
    testData
  );
  return response.data;
};

export const deleteMilkTest = async (id) => {
  const response = await api.delete(
    `/milk-laboratory/${id}`
  );
  return response.data;
};