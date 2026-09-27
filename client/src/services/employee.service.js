import api from "./api";

export const getEmployees = async () => {
  const response = await api.get("/hr/employees");
  return response.data;
};

export const getEmployeeById = async (id) => {
  const response = await api.get(`/hr/employees/${id}`);
  return response.data;
};

export const createEmployee = async (employeeData) => {
  const response = await api.post(
    "/hr/employees",
    employeeData
  );
  return response.data;
};

export const updateEmployee = async (
  id,
  employeeData
) => {
  const response = await api.put(
    `/hr/employees/${id}`,
    employeeData
  );
  return response.data;
};

export const deleteEmployee = async (id) => {
  const response = await api.delete(
    `/hr/employees/${id}`
  );
  return response.data;
};