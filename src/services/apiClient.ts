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
  const token = userSession.token || localStorage.getItem('jwt_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // 🟢 КРИТИЧЕСКИ ВАЖНО: Если отправляется FormData, удаляем дефолтный 'application/json',
  // чтобы браузер сам сгенерировал multipart/form-data с правильным boundary для ASP.NET Core [FromForm]
  if (config.data instanceof FormData && config.headers) {
    if (typeof (config.headers as any).delete === 'function') {
      (config.headers as any).delete('Content-Type');
    }
    delete (config.headers as any)['Content-Type'];
    delete (config.headers as any)['content-type'];
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