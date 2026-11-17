import axios from "axios";
import { forgetToken, getToken } from "./session";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      forgetToken();
      window.dispatchEvent(new Event("keiyian:unauthorized"));
    }
    if (status === 428) window.dispatchEvent(new Event("keiyian:password-change"));
    return Promise.reject(error);
  },
);

/** Unwrap `{ success, data }` responses. */
export const get = async (path, params) => (await api.get(path, { params })).data.data;
export const post = async (path, body) => (await api.post(path, body)).data;
export const put = async (path, body) => (await api.put(path, body)).data;
export const del = async (path) => (await api.delete(path)).data;

/** The message to show for a failed request. */
export const errorMessage = (error, fallback = "Something went wrong. Please try again.") =>
  error?.response?.data?.message || (error?.request && !error?.response ? "Cannot reach the server. Check your connection." : null) || error?.message || fallback;

/** Download a file (CSV/PDF) from an authenticated endpoint. */
export const download = async (path, params, fallbackName) => {
  const response = await api.get(path, { params, responseType: "blob" });
  const disposition = response.headers["content-disposition"] || "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] || fallbackName;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Open a file (a PDF) from an authenticated endpoint in a new tab. The tab is
 * opened at the click, before the file arrives, so the browser does not
 * block it; where no tab can be opened the file is saved instead.
 */
export const openFile = async (path, fallbackName) => {
  const tab = window.open("", "_blank");
  try {
    const response = await api.get(path, { responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    if (tab) {
      tab.location.href = url;
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = fallbackName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    // Long enough for the tab's viewer to save or print it.
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
  } catch (error) {
    tab?.close();
    throw error;
  }
};

export default api;
