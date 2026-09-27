import api from "./api";

export const getPayroll = async () => {
  const response = await api.get("/hr/payroll");
  return response.data;
};

export const getPayrollById = async (id) => {
  const response = await api.get(`/hr/payroll/${id}`);
  return response.data;
};

export const createPayroll = async (payrollData) => {
  const response = await api.post(
    "/hr/payroll",
    payrollData
  );
  return response.data;
};

export const updatePayroll = async (
  id,
  payrollData
) => {
  const response = await api.put(
    `/hr/payroll/${id}`,
    payrollData
  );
  return response.data;
};

export const deletePayroll = async (id) => {
  const response = await api.delete(
    `/hr/payroll/${id}`
  );
  return response.data;
};