import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  withCredentials: true,
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
