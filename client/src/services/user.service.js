import api from "./api";

export const getUsers = async () => {
  const response = await api.get("/auth/users");
  return response.data;
};

export const createUser = async (userData) => {
  const response = await api.post("/auth/users", userData);
  return response.data;
};

export const updateUser = async (id, userData) => {
  const response = await api.put(`/auth/users/${id}`, userData);
  return response.data;
};

export const resendUserVerification = async (id) => {
  const response = await api.post(`/auth/users/${id}/resend-verification`);
  return response.data;
};