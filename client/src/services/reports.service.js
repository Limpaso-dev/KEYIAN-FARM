import api from "./api";

export const getFarmersReport = async (params = {}) => {
  const response = await api.get("/reports/farmers", { params });
  return response.data;
};

export const getSalesReport = async (params = {}) => {
  const response = await api.get("/reports/sales", { params });
  return response.data;
};

export const downloadFarmersReportPdf = async (params = {}) => {
  const response = await api.get("/reports/farmers/pdf", {
    params,
    responseType: "blob",
  });
  return response.data;
};

export const downloadSalesReportPdf = async (params = {}) => {
  const response = await api.get("/reports/sales/pdf", {
    params,
    responseType: "blob",
  });
  return response.data;
};