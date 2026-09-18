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

// Перехватчик для автоматической подстановки токена (аналог BearerTokenHandler в C#)
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = userSession.token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Перехватчик ошибок: если токен протух (401), уведомляем систему
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      userSession.clear();
      eventBus.emit('AuthFailedMessage', undefined);
    }
    return Promise.reject(error);
  }
);

export const BASE_SERVER_URL = SERVER_URL;