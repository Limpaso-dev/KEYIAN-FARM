import api from "./api";

export const getPatients = async () => {
  const response = await api.get("/medical/patients");
  return response.data;
};

export const getPatientById = async (id) => {
  const response = await api.get(`/medical/patients/${id}`);
  return response.data;
};

export const createPatient = async (patientData) => {
  const response = await api.post(
    "/medical/patients",
    patientData
  );
  return response.data;
};

export const updatePatient = async (id, patientData) => {
  const response = await api.put(
    `/medical/patients/${id}`,
    patientData
  );
  return response.data;
};

export const deletePatient = async (id) => {
  const response = await api.delete(
    `/medical/patients/${id}`
  );
  return response.data;
};