import api from "./api";

export const getMedicalVisits = async () => {
  const response = await api.get("/medical/visits");
  return response.data;
};

export const getMedicalVisitById = async (id) => {
  const response = await api.get(
    `/medical/visits/${id}`
  );
  return response.data;
};

export const createMedicalVisit = async (visitData) => {
  const response = await api.post(
    "/medical/visits",
    visitData
  );
  return response.data;
};

export const updateMedicalVisit = async (
  id,
  visitData
) => {
  const response = await api.put(
    `/medical/visits/${id}`,
    visitData
  );
  return response.data;
};

export const deleteMedicalVisit = async (id) => {
  const response = await api.delete(
    `/medical/visits/${id}`
  );
  return response.data;
};