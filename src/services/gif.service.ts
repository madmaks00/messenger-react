import { apiClient, BASE_SERVER_URL } from './apiClient';
import { getLocalDatabase } from '../db/localDb';
import { userSession } from './userSession';
import { UrlHelper } from '../utils/helpers';
import { ISavedGif } from '../types/models';

export function getCanonicalGifFilename(url: string | null | undefined): string {
  if (!url) return '';
  const clean = url.split('?')[0].split('#')[0].toLowerCase().trim();
  return clean.split('/').pop() || clean;
}

export interface IGifService {
  getSavedGifsAsync(): Promise<ISavedGif[]>;
  syncGifsWithServerAsync(): Promise<ISavedGif[]>;
  saveGifLocallyAsync(gif: Partial<ISavedGif>): Promise<void>;
  saveGifAsync(gif: { url: string; thumbnailUrl?: string; width?: number; height?: number }): Promise<void>;
}

export class GifService implements IGifService {
  public async getSavedGifsAsync(): Promise<ISavedGif[]> {
    const userId = Number(userSession.userId || 0);
    if (userId <= 0) return [];

    try {
      const db = getLocalDatabase(userId);
      const localGifs = await db.savedGifs.toArray();

      // Фильтруем битые/временные blob: ссылки
      const validGifs = localGifs.filter((g) => g.url && !g.url.startsWith('blob:') && g.url.trim().length > 0);

      // Сортировка по убыванию даты добавления (1 в 1 с OrderByDescending(g => g.SavedAt))
      validGifs.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

      const seenFilenames = new Set<string>();
      const seenUrls = new Set<string>();
      const deduplicated: ISavedGif[] = [];

      for (const g of validGifs) {
        const norm = UrlHelper.normalize(g.url, BASE_SERVER_URL);
        const fname = getCanonicalGifFilename(norm);

        if (seenUrls.has(norm) || (fname && seenFilenames.has(fname))) {
          if (g.id) {
            db.savedGifs.delete(g.id).catch(() => {});
          }
          continue;
        }

        seenUrls.add(norm);
        if (fname) seenFilenames.add(fname);

        deduplicated.push({
          ...g,
          url: norm,
          thumbnailUrl: g.thumbnailUrl ? UrlHelper.normalize(g.thumbnailUrl, BASE_SERVER_URL) : norm,
        });
      }

      return deduplicated;
    } catch (ex) {
      console.error('[GifService ERROR] Ошибка чтения сохраненных GIF из локальной БД:', ex);
      return [];
    }
  }

  // 🟢 Строго 1 в 1 с SyncGifsWithServerAsync в C# GifService.cs: ТОЛЬКО GET api/Gifs
  public async syncGifsWithServerAsync(): Promise<ISavedGif[]> {
    const userId = Number(userSession.userId || 0);
    if (userId <= 0) return await this.getSavedGifsAsync();

    try {
      const res = await apiClient.get<any[]>('api/Gifs');
      const serverGifs = res.data;

      if (serverGifs && serverGifs.length > 0) {
        const db = getLocalDatabase(userId);
        const existingList = await db.savedGifs.toArray();
        const existingFilenames = new Set(existingList.map((g) => getCanonicalGifFilename(g.url)));
        const existingUrls = new Set(existingList.map((g) => UrlHelper.normalize(g.url, BASE_SERVER_URL)));

        for (const sg of serverGifs) {
          if (!sg.url || sg.url.startsWith('blob:')) continue;
          const normUrl = UrlHelper.normalize(sg.url, BASE_SERVER_URL);
          const fname = getCanonicalGifFilename(normUrl);

          if (!existingUrls.has(normUrl) && !existingFilenames.has(fname)) {
            existingUrls.add(normUrl);
            if (fname) existingFilenames.add(fname);

            await db.savedGifs.add({
              serverId: sg.id || sg.serverId || 0,
              url: normUrl,
              thumbnailUrl: sg.thumbnailUrl ? UrlHelper.normalize(sg.thumbnailUrl, BASE_SERVER_URL) : normUrl,
              width: Number(sg.width || 320),
              height: Number(sg.height || 240),
              savedAt: sg.savedAt ? new Date(sg.savedAt).toISOString() : new Date().toISOString(),
            });
          }
        }
      }
    } catch (ex) {
      console.warn('[GifService ERROR] Ошибка синхронизации GIF с сервером:', ex);
    }

    return await this.getSavedGifsAsync();
  }

  public async saveGifLocallyAsync(gif: Partial<ISavedGif>): Promise<void> {
    const userId = Number(userSession.userId || 0);
    if (!gif.url || gif.url.startsWith('blob:') || gif.url.trim().length === 0 || userId <= 0) return;

    try {
      const db = getLocalDatabase(userId);
      const normUrl = UrlHelper.normalize(gif.url, BASE_SERVER_URL);
      const targetFilename = getCanonicalGifFilename(normUrl);

      const existingList = await db.savedGifs.toArray();
      const duplicate = existingList.find((g) => {
        if (!g.url) return false;
        const existNorm = UrlHelper.normalize(g.url, BASE_SERVER_URL);
        return (
          g.url === normUrl ||
          existNorm === normUrl ||
          (targetFilename && getCanonicalGifFilename(g.url) === targetFilename)
        );
      });

      if (!duplicate) {
        await db.savedGifs.add({
          serverId: gif.serverId || 0,
          url: normUrl,
          thumbnailUrl: gif.thumbnailUrl && !gif.thumbnailUrl.startsWith('blob:')
            ? UrlHelper.normalize(gif.thumbnailUrl, BASE_SERVER_URL)
            : normUrl,
          width: Number(gif.width || 320),
          height: Number(gif.height || 240),
          savedAt: gif.savedAt || new Date().toISOString(),
        });
      }
    } catch (ex) {
      console.error('[GifService ERROR] Ошибка локального сохранения GIF:', ex);
    }
  }

  // 🟢 Локальное сохранение отправленной GIF (сервер сам сохраняет её в БД при отправке через сокет)
  public async saveGifAsync(gif: { url: string; thumbnailUrl?: string; width?: number; height?: number }): Promise<void> {
    if (!gif.url || gif.url.startsWith('blob:')) return;

    const normUrl = UrlHelper.normalize(gif.url, BASE_SERVER_URL);
    const normThumb = gif.thumbnailUrl && !gif.thumbnailUrl.startsWith('blob:')
      ? UrlHelper.normalize(gif.thumbnailUrl, BASE_SERVER_URL)
      : normUrl;

    await this.saveGifLocallyAsync({
      url: normUrl,
      thumbnailUrl: normThumb,
      width: gif.width || 320,
      height: gif.height || 240,
      savedAt: new Date().toISOString(),
    });
  }
}

export const gifService = new GifService();