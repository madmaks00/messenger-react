export interface MediaDimensions {
  width: number;
  height: number;
}

class MediaDimensionsCache {
  private cache = new Map<string, MediaDimensions>();

  public get(key?: string | null): MediaDimensions | null {
    if (!key) return null;
    const cleanKey = key.trim();
    return this.cache.get(cleanKey) || null;
  }

  public set(key?: string | null, dims?: MediaDimensions | null): void {
    if (!key || !dims || dims.width <= 0 || dims.height <= 0) return;
    const cleanKey = key.trim();
    this.cache.set(cleanKey, dims);
  }
}

export const mediaDimensionsCache = new MediaDimensionsCache();