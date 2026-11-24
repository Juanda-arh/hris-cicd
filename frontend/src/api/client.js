import axios from 'axios';
import { getToken, clearToken } from '../utils/tokenStorage';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Rutas donde un 401 significa "credenciales incorrectas", no "sesión vencida"
const AUTH_PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/verify-otp',
  '/api/auth/change-password',
];

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const url = error.config?.url || '';
    const isAuthAttempt = AUTH_PUBLIC_PATHS.some((p) => url.includes(p));

    if (status === 401 && !isAuthAttempt) {
      clearToken();
      window.location.assign('/login');
    } else if (status === 403 && data?.requiresPasswordChange) {
      window.location.assign('/change-password');
    }

    return Promise.reject(error);
  }
);

export default client;