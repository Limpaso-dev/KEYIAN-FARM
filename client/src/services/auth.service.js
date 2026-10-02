import api from "./api";

export const loginUser = async (credentials) => {
  const response = await api.post("/auth/login", credentials);

  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get("/auth/me");

  return response.data;
};

export const verifyUserEmail = async (verificationData) => {
  const response = await api.post("/auth/verify-email", verificationData);
  return response.data;
};

export const requestVerificationCode = async (email) => {
  const response = await api.post("/auth/resend-verification", { email });
  return response.data;
};

export const logoutUser = () => {
  localStorage.removeItem("keiyian_token");
  localStorage.removeItem("keiyian_user");
};