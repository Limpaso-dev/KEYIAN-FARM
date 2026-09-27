import api from "./api";

export const getMilkValueAdditions = async () => {
  const response = await api.get(
    "/milk-value-addition"
  );

  return response.data;
};

export const getMilkValueAdditionById = async (id) => {
  const response = await api.get(
    `/milk-value-addition/${id}`
  );

  return response.data;
};

export const createMilkValueAddition = async (
  data
) => {
  const response = await api.post(
    "/milk-value-addition",
    data
  );

  return response.data;
};

export const updateMilkValueAddition = async (
  id,
  data
) => {
  const response = await api.put(
    `/milk-value-addition/${id}`,
    data
  );

  return response.data;
};

export const deleteMilkValueAddition = async (id) => {
  const response = await api.delete(
    `/milk-value-addition/${id}`
  );

  return response.data;
};