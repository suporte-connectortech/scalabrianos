import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const api = axios.create({
  baseURL: API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL,
});

export const getFileUrl = (path: string | null) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:') || path.startsWith('data:')) {
    return path;
  }
  
  // Use the full API_URL (which includes /api) to ensure the proxy handles it correctly
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  if (baseUrl && path.startsWith(baseUrl)) {
    return path;
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Convert PUT and DELETE to POST for production server firewall compatibility
  const method = config.method?.toLowerCase();
  if (method === 'put' || method === 'delete') {
    config.headers['X-HTTP-Method-Override'] = method.toUpperCase();
    config.method = 'post';
  }
  
  return config;
});

export default api;
