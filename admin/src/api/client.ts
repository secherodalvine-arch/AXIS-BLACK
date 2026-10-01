import axios from 'axios';
import { useAdminStore } from '@/store';

const API_ROOT = (import.meta.env.VITE_API_URL as string | undefined ?? '').replace(/\/+$/, '');
const BASE_URL = API_ROOT ? `${API_ROOT}/api/admin` : '/api/admin';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 45_000,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = useAdminStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401) {
      const onAuthPage = ['/login', '/register'].some((p) =>
        window.location.pathname.startsWith(p)
      );
      if (!onAuthPage) {
        useAdminStore.getState().logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
