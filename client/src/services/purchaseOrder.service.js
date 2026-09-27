import api from "./api";

export const getPurchaseOrders = async () => {
  const response = await api.get("/procurement/purchase-orders");
  return response.data;
};

export const getPurchaseOrderById = async (id) => {
  const response = await api.get(
    `/procurement/purchase-orders/${id}`
  );
  return response.data;
};

export const createPurchaseOrder = async (purchaseOrderData) => {
  const response = await api.post(
    "/procurement/purchase-orders",
    purchaseOrderData
  );
  return response.data;
};

export const updatePurchaseOrder = async (
  id,
  purchaseOrderData
) => {
  const response = await api.put(
    `/procurement/purchase-orders/${id}`,
    purchaseOrderData
  );
  return response.data;
};

export const deletePurchaseOrder = async (id) => {
  const response = await api.delete(
    `/procurement/purchase-orders/${id}`
  );
  return response.data;
};