import { BASE_SERVER_URL } from './apiClient';
import { UrlHelper } from '../utils/helpers';

const CACHE_NAME = 'messenger-media-cache-v1';

class MediaCacheService {
  private inMemoryUrlMap = new Map<string, string>();

  // Записывает бинарный файл в CacheStorage под полным серверным адресом бэкенда
  public async cacheMediaFile(serverUrl: string, file: File | Blob): Promise<void> {
    if (!serverUrl || serverUrl.startsWith('blob:') || !('caches' in window)) return;

    const normalizedUrl = UrlHelper.normalize(serverUrl, BASE_SERVER_URL);

    try {
      const cache = await caches.open(CACHE_NAME);
      const response = new Response(file, {
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'Content-Length': file.size.toString(),
        },
      });
      await cache.put(normalizedUrl, response);

      // Сохраняем локальный blob в оперативной памяти для моментального отображения за 0 мс
      const localUrl = URL.createObjectURL(file);
      this.inMemoryUrlMap.set(normalizedUrl, localUrl);
      this.inMemoryUrlMap.set(serverUrl, localUrl);
    } catch (e) {
      console.warn('[MediaCache] Ошибка сохранения файла в кэш:', e);
    }
  }

  // Сначала ищет в локальном кэше браузера, и только если нет — скачивает с бэкенда
  public async getCachedMediaUrl(serverUrl: string): Promise<string> {
    if (!serverUrl) return '';
    if (serverUrl.startsWith('blob:') || serverUrl.startsWith('data:')) {
      return serverUrl;
    }

    const normalizedUrl = UrlHelper.normalize(serverUrl, BASE_SERVER_URL);

    if (this.inMemoryUrlMap.has(normalizedUrl)) {
      return this.inMemoryUrlMap.get(normalizedUrl)!;
    }
    if (this.inMemoryUrlMap.has(serverUrl)) {
      return this.inMemoryUrlMap.get(serverUrl)!;
    }

    try {
      if ('caches' in window) {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = (await cache.match(normalizedUrl)) || (await cache.match(serverUrl));

        if (cachedResponse) {
          const blob = await cachedResponse.blob();
          const localUrl = URL.createObjectURL(blob);
          this.inMemoryUrlMap.set(normalizedUrl, localUrl);
          this.inMemoryUrlMap.set(serverUrl, localUrl);
          return localUrl;
        }

        // Если файла еще нет в кэше — скачиваем с ASP.NET Core бэкенда (порт 7214) и кэшируем
        const networkResponse = await fetch(normalizedUrl);
        if (networkResponse.ok) {
          const clone = networkResponse.clone();
          await cache.put(normalizedUrl, clone);
          const blob = await networkResponse.blob();
          const localUrl = URL.createObjectURL(blob);
          this.inMemoryUrlMap.set(normalizedUrl, localUrl);
          this.inMemoryUrlMap.set(serverUrl, localUrl);
          return localUrl;
        }
      }
    } catch (err) {
      console.warn('[MediaCache] Ошибка загрузки медиа из кэша/сети:', err);
    }

    return normalizedUrl;
  }
}

export const mediaCacheService = new MediaCacheService();