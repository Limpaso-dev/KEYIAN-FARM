import api from "./api";

export const getAccounts = async () => {
  const response = await api.get("/finance/accounts");
  return response.data;
};

export const getAccountById = async (id) => {
  const response = await api.get(
    `/finance/accounts/${id}`
  );

  return response.data;
};

export const createAccount = async (accountData) => {
  const response = await api.post(
    "/finance/accounts",
    accountData
  );

  return response.data;
};

export const updateAccount = async (
  id,
  accountData
) => {
  const response = await api.put(
    `/finance/accounts/${id}`,
    accountData
  );

  return response.data;
};

export const deleteAccount = async (id) => {
  const response = await api.delete(
    `/finance/accounts/${id}`
  );

  return response.data;
};