import api from "./api";

export const getMedicalSummary = async () => {
  const response = await api.get("/medical/summary");
  return response.data;
};