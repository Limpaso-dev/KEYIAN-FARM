import api from "./api";

export const getTransactions = async () => {
  const response = await api.get(
    "/finance/transactions"
  );

  return response.data;
};

export const getTransactionById = async (id) => {
  const response = await api.get(
    `/finance/transactions/${id}`
  );

  return response.data;
};

export const createTransaction = async (
  transactionData
) => {
  const response = await api.post(
    "/finance/transactions",
    transactionData
  );

  return response.data;
};

export const updateTransaction = async (
  id,
  transactionData
) => {
  const response = await api.put(
    `/finance/transactions/${id}`,
    transactionData
  );

  return response.data;
};

export const deleteTransaction = async (id) => {
  const response = await api.delete(
    `/finance/transactions/${id}`
  );

  return response.data;
};