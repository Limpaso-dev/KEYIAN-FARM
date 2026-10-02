import api from "./api";

export const receivePurchaseOrder = async (id, payload) => (await api.post(`/inventory/receiving/purchase-orders/${id}`, payload)).data;
export const getPurchaseOrdersForReceiving = async () => (await api.get("/inventory/receiving/purchase-orders")).data;
export const getGoodsReceipts = async () => (await api.get("/inventory/goods-receipts")).data;
export const getSupplierInvoices = async () => (await api.get("/procurement/supplier-invoices")).data;
export const submitSupplierInvoice = async (payload) => (await api.post("/procurement/supplier-invoices", payload)).data;
export const getFinanceSupplierInvoices = async () => (await api.get("/finance/supplier-invoices")).data;
export const getSupplierPayments = async () => (await api.get("/finance/supplier-payments")).data;
export const requestSupplierPayment = async (payload) => (await api.post("/finance/supplier-payments", payload)).data;
