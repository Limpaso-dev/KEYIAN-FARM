import api from "./api";

export const createSalePayment = async (data) => {
  const response = await api.post("/sales/payments", data);
  return response.data;
};

export const getSalePayments = async () => {
  const response = await api.get("/sales/payments");
  return response.data;
};

export const getPaymentsBySale = async (saleId) => {
  const response = await api.get(
    `/sales/payments/sale/${saleId}`
  );

  return response.data;
};

export const deleteSalePayment = async (id) => {
  const response = await api.delete(
    `/sales/payments/${id}`
  );

  return response.data;
};