import { BASE_SERVER_URL } from '../services/apiClient';

interface LRUEntry {
  key: string;
  url: string;
}

export class ImageHelper {
  private static readonly MAX_MEMORY_CACHE_ITEMS = 150;
  private static readonly memoryCache = new Map<string, string>();
  private static readonly inFlightTasks = new Map<string, Promise<string>>();

  /**
   * Нормализация URL медиафайла (эквивалент NormalizeMediaUrl в C#)
   */
  public static normalizeMediaUrl(url: string | null | undefined): string {
    if (!url || typeof url !== 'string') return '';
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('blob:') ||
      url.startsWith('data:')
    ) {
      return url;
    }

    const baseServer = (BASE_SERVER_URL || 'https://localhost:7214').replace(/\/+$/, '');
    const cleanPath = url.replace(/^\/+/, '');
    return `${baseServer}/${cleanPath}`;
  }

  /**
   * Загрузка изображения с дедупликацией параллельных запросов и LRU-кэшированием
   */
  public static async loadImageAsync(rawUrl: string, decodeWidth: number = 0): Promise<string> {
    const resolvedUrl = this.normalizeMediaUrl(rawUrl);
    if (!resolvedUrl) return '';

    const cacheKey = `${resolvedUrl}_w${decodeWidth}`;

    // 1. Проверяем память
    if (this.memoryCache.has(cacheKey)) {
      const cached = this.memoryCache.get(cacheKey)!;
      // Обновляем позицию в LRU
      this.memoryCache.delete(cacheKey);
      this.memoryCache.set(cacheKey, cached);
      return cached;
    }

    // 2. Дедупликация (если этот URL уже скачивается другим баблом/аватаркой)
    if (this.inFlightTasks.has(cacheKey)) {
      return this.inFlightTasks.get(cacheKey)!;
    }

    const loadPromise = new Promise<string>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = resolvedUrl;

      img.onload = () => {
        this.addToCache(cacheKey, resolvedUrl);
        this.inFlightTasks.delete(cacheKey);
        resolve(resolvedUrl);
      };

      img.onerror = () => {
        this.inFlightTasks.delete(cacheKey);
        resolve(resolvedUrl);
      };
    });

    this.inFlightTasks.set(cacheKey, loadPromise);
    return loadPromise;
  }

  private static addToCache(key: string, url: string): void {
    if (this.memoryCache.has(key)) {
      this.memoryCache.delete(key);
    } else if (this.memoryCache.size >= this.MAX_MEMORY_CACHE_ITEMS) {
      // Удаляем самый старый элемент
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }
    this.memoryCache.set(key, url);
  }
}