import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { userSession } from './userSession';
import { eventBus } from './eventBus';

const SERVER_URL = 'https://localhost:7214';
const DEVICE_ID_KEY = 'messenger_browser_device_id';
const browserDeviceId = localStorage.getItem(DEVICE_ID_KEY) || crypto.randomUUID();
localStorage.setItem(DEVICE_ID_KEY, browserDeviceId);

export const apiClient: AxiosInstance = axios.create({
  baseURL: SERVER_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Device-Name': 'MessengerReact-Web',
    'X-Device-Id': browserDeviceId,
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if ((config as any).__initiatingUserId === undefined) (config as any).__initiatingUserId = userSession.userId;
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
  async (error) => {
    const config = error.config;
    if (error.response?.status === 429 && config && !String(config.url || '').toLowerCase().includes('api/auth/') &&
        config.__initiatingUserId === userSession.userId && (config.__rateRetries || 0) < 3) {
      config.__rateRetries = (config.__rateRetries || 0) + 1;
      const retryAfter = Number(error.response.headers?.['retry-after']);
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(10000, retryAfter * 1000) : 400 * 2 ** (config.__rateRetries - 1);
      await new Promise(resolve => setTimeout(resolve, delay + Math.floor(Math.random() * 150)));
      if (config.__initiatingUserId === userSession.userId) return apiClient.request(config);
    }
    const currentToken = userSession.token || localStorage.getItem('jwt_token');
    if (error.response?.status === 401 && config && !String(config.url || '').toLowerCase().includes('api/auth/') &&
        !String(config.url || '').toLowerCase().includes('api/test/secret') &&
        config.__initiatingUserId === userSession.userId && config.headers?.Authorization === `Bearer ${currentToken}`) {
      userSession.clear();
      localStorage.removeItem('jwt_token');
      eventBus.emit('AuthFailedMessage', undefined);
    }
    return Promise.reject(error);
  }
);

export const BASE_SERVER_URL = SERVER_URL;
