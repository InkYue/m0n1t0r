import axios from "axios";
import { getApiBaseUrl } from "../utils/settings";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const data = response.data;
    if (data && typeof data.code === "number" && data.code !== 0) {
      return Promise.reject(new Error(data.body || `Error code: ${data.code}`));
    }
    return response;
  },
  (error) => Promise.reject(error)
);

export default apiClient;
