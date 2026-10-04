import { BASE_SERVER_URL } from './apiClient';
import { UrlHelper } from '../utils/helpers';

const CACHE_NAME = 'messenger-media-cache-v1';

class MediaCacheService {
  private inMemoryUrlMap = new Map<string, string>();
  private failedCorsUrls = new Set<string>(); // Запоминаем URL с CORS-ошибками, чтобы не долбить сеть впустую

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

      const localUrl = URL.createObjectURL(file);
      this.inMemoryUrlMap.set(normalizedUrl, localUrl);
      this.inMemoryUrlMap.set(serverUrl, localUrl);
    } catch (e) {
      console.warn('[MediaCache] Ошибка сохранения файла в кэш:', e);
    }
  }

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

    // Если бэкенд блокирует CORS для этого URL — отдаем напрямую для тега <img> (он не требует CORS)
    if (this.failedCorsUrls.has(normalizedUrl)) {
      return normalizedUrl;
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

        // Пытаемся закэшировать с бэкенда
        const networkResponse = await fetch(normalizedUrl, { mode: 'cors' });
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
    } catch {
      // 🟢 Если бэкенд выбросил CORS TypeError — помечаем URL и отдаем напрямую для <img> без спама в консоль
      this.failedCorsUrls.add(normalizedUrl);
    }

    return normalizedUrl;
  }
}

export const mediaCacheService = new MediaCacheService();