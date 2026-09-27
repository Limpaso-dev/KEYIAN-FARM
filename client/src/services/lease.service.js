import api from "./api";

export const getLeases = async () => {
  const response = await api.get("/rentals/leases");
  return response.data;
};

export const getLeaseById = async (id) => {
  const response = await api.get(`/rentals/leases/${id}`);
  return response.data;
};

export const createLease = async (leaseData) => {
  const response = await api.post(
    "/rentals/leases",
    leaseData
  );
  return response.data;
};

export const updateLease = async (id, leaseData) => {
  const response = await api.put(
    `/rentals/leases/${id}`,
    leaseData
  );
  return response.data;
};

export const deleteLease = async (id) => {
  const response = await api.delete(
    `/rentals/leases/${id}`
  );
  return response.data;
};