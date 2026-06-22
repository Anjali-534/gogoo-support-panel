import axios from "axios";

const BASE = process.env.NEXT_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

export const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("support_admin_token") || localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
