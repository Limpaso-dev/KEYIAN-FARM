import api from "./api";

export const getRentPayments = async () => {
  const response = await api.get("/rentals/payments");
  return response.data;
};

export const getRentPaymentById = async (id) => {
  const response = await api.get(
    `/rentals/payments/${id}`
  );
  return response.data;
};

export const createRentPayment = async (paymentData) => {
  const response = await api.post(
    "/rentals/payments",
    paymentData
  );
  return response.data;
};

export const updateRentPayment = async (
  id,
  paymentData
) => {
  const response = await api.put(
    `/rentals/payments/${id}`,
    paymentData
  );
  return response.data;
};

export const deleteRentPayment = async (id) => {
  const response = await api.delete(
    `/rentals/payments/${id}`
  );
  return response.data;
};