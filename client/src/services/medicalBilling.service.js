import api from "./api";

export const getMedicalBills = async () => (await api.get("/medical/bills")).data;
export const getMedicalPaymentAccounts = async () => (await api.get("/medical/payment-accounts")).data;
export const getBillableMedicalVisits = async () => (await api.get("/medical/billable-visits")).data;
export const createMedicalBill = async (payload) => (await api.post("/medical/bills", payload)).data;
export const recordMedicalBillPayment = async (id, payload) => (await api.post(`/medical/bills/${id}/payments`, payload)).data;
