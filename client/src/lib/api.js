import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
});

export const TOKEN_KEY = "keiyian_token";

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY);
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

export default api;
