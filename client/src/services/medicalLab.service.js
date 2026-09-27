import api from "./api";

export const getMedicalLabResults = async () => {
  const response = await api.get(
    "/medical/lab-results"
  );
  return response.data;
};

export const getMedicalLabResultById = async (id) => {
  const response = await api.get(
    `/medical/lab-results/${id}`
  );
  return response.data;
};

export const createMedicalLabResult = async (
  labData
) => {
  const response = await api.post(
    "/medical/lab-results",
    labData
  );
  return response.data;
};

export const updateMedicalLabResult = async (
  id,
  labData
) => {
  const response = await api.put(
    `/medical/lab-results/${id}`,
    labData
  );
  return response.data;
};

export const deleteMedicalLabResult = async (id) => {
  const response = await api.delete(
    `/medical/lab-results/${id}`
  );
  return response.data;
};