import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { userSession } from './userSession';
import { eventBus } from './eventBus';

const SERVER_URL = 'https://localhost:7214';

export const apiClient: AxiosInstance = axios.create({
  baseURL: SERVER_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Device-Name': 'MessengerReact-Web',
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // 🟢 Берём токен из памяти ИЛИ из localStorage
  const token = userSession.token || localStorage.getItem('jwt_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      userSession.clear();
      localStorage.removeItem('jwt_token');
      eventBus.emit('AuthFailedMessage', undefined);
    }
    return Promise.reject(error);
  }
);

export const BASE_SERVER_URL = SERVER_URL;