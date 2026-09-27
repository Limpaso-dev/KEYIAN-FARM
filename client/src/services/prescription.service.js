import api from "./api";

export const getPrescriptions = async () => {
  const response = await api.get(
    "/medical/prescriptions"
  );
  return response.data;
};

export const getPrescriptionById = async (id) => {
  const response = await api.get(
    `/medical/prescriptions/${id}`
  );
  return response.data;
};

export const createPrescription = async (
  prescriptionData
) => {
  const response = await api.post(
    "/medical/prescriptions",
    prescriptionData
  );
  return response.data;
};

export const updatePrescription = async (
  id,
  prescriptionData
) => {
  const response = await api.put(
    `/medical/prescriptions/${id}`,
    prescriptionData
  );
  return response.data;
};

export const deletePrescription = async (id) => {
  const response = await api.delete(
    `/medical/prescriptions/${id}`
  );
  return response.data;
};