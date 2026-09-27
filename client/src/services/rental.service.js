import api from "./api";

export const getRentalSummary = async () => {
  const response = await api.get("/rentals/summary");
  return response.data;
};