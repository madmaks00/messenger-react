import { AttachmentType } from '../types/enums';

const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.heic', '.gif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.webm', '.3gp']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma', '.opus']);

function getExtension(pathOrName: string): string {
  if (!pathOrName) return '';
  const idx = pathOrName.lastIndexOf('.');
  return idx !== -1 ? pathOrName.substring(idx).toLowerCase() : '';
}

export class MediaFormatHelper {
  public static isPhotoExtension(path: string): boolean {
    return PHOTO_EXTENSIONS.has(getExtension(path));
  }

  public static isVideoExtension(path: string): boolean {
    return VIDEO_EXTENSIONS.has(getExtension(path));
  }

  public static isAudioExtension(path: string): boolean {
    return AUDIO_EXTENSIONS.has(getExtension(path));
  }

  public static detectType(fileName: string): AttachmentType {
    if (!fileName) return AttachmentType.Document;
    if (fileName.toLowerCase().endsWith('.gif')) return AttachmentType.Video;
    if (this.isPhotoExtension(fileName)) return AttachmentType.Photo;
    if (this.isVideoExtension(fileName)) return AttachmentType.Video;
    if (this.isAudioExtension(fileName)) return AttachmentType.Audio;
    return AttachmentType.Document;
  }

  /**
   * Генерация JPEG-миниатюры для видео через HTML5 Video + Canvas
   * (аналог FFmpegVideoDecoder в C#)
   */
  public static async generateVideoThumbnail(
    videoSource: string | File | Blob,
    targetWidth: number = 480,
    targetHeight: number = 360
  ): Promise<Blob | null> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      const url = typeof videoSource === 'string' ? videoSource : URL.createObjectURL(videoSource);
      video.src = url;

      const cleanUp = () => {
        if (typeof videoSource !== 'string') {
          URL.revokeObjectURL(url);
        }
        video.remove();
      };

      video.onloadeddata = () => {
        video.currentTime = Math.min(1.0, video.duration / 2 || 0.1);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          const scale = Math.min(targetWidth / video.videoWidth, targetHeight / video.videoHeight, 1.0);
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
              (blob) => {
                cleanUp();
                resolve(blob);
              },
              'image/jpeg',
              0.85
            );
          } else {
            cleanUp();
            resolve(null);
          }
        } catch {
          cleanUp();
          resolve(null);
        }
      };

      video.onerror = () => {
        cleanUp();
        resolve(null);
      };
    });
  }

  /**
   * Получение размеров изображения (width, height)
   */
  public static async getImageDimensions(source: string | Blob): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = typeof source === 'string' ? source : URL.createObjectURL(source);
      img.src = url;

      img.onload = () => {
        if (typeof source !== 'string') URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };

      img.onerror = () => {
        if (typeof source !== 'string') URL.revokeObjectURL(url);
        resolve({ width: 0, height: 0 });
      };
    });
  }

  /**
   * Получение метаданных видео (длительность, ширина, высота, звук)
   */
  public static async getVideoInfo(
    source: string | Blob
  ): Promise<{ width: number; height: number; duration: number; hasAudio: boolean }> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.muted = true;
      const url = typeof source === 'string' ? source : URL.createObjectURL(source);
      video.src = url;

      video.onloadedmetadata = () => {
        const hasAudio =
          (video as any).mozHasAudio ||
          Boolean((video as any).webkitAudioDecodedByteCount) ||
          Boolean((video as any).audioTracks?.length);

        const info = {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration || 0,
          hasAudio,
        };

        if (typeof source !== 'string') URL.revokeObjectURL(url);
        video.remove();
        resolve(info);
      };

      video.onerror = () => {
        if (typeof source !== 'string') URL.revokeObjectURL(url);
        video.remove();
        resolve({ width: 0, height: 0, duration: 0, hasAudio: false });
      };
    });
  }
}

export class AudioMetadataHelper {
  /**
   * Быстрое чтение длительности WAV-файла напрямую из бинарного RIFF/WAVE заголовка
   * (точный эквивалент GetWavDurationFast из C# BinaryPrimitives.ReadInt32LittleEndian)
   */
  public static getWavDurationFast(buffer: ArrayBuffer): number | null {
    try {
      if (buffer.byteLength < 44) return null;
      const view = new DataView(buffer);

      // Проверка сигнатуры 'RIFF' и 'WAVE'
      const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
      const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
      if (riff !== 'RIFF' || wave !== 'WAVE') return null;

      // ByteRate находится со смещения 28 (32-bit Little Endian)
      const byteRate = view.getInt32(28, true);
      if (byteRate > 0) {
        const dataLength = buffer.byteLength - 44;
        const seconds = dataLength / byteRate;
        return seconds > 0 ? seconds : null;
      }
    } catch {
      // Игнорируем ошибки парсинга
    }
    return null;
  }

  /**
   * Извлечение имени исполнителя и трека из имени файла
   * (эквивалент ParseArtistAndTitleFromName)
   */
  public static parseArtistAndTitle(fileName: string): { artist: string; title: string } {
    let rawName = fileName;
    const lastDot = rawName.lastIndexOf('.');
    if (lastDot > 0) rawName = rawName.substring(0, lastDot);

    const splitters = [' - ', ' – ', ' — '];
    for (const sp of splitters) {
      if (rawName.includes(sp)) {
        const parts = rawName.split(sp).map((s) => s.trim());
        if (parts.length >= 2 && parts[0] && parts[1]) {
          return { artist: parts[0], title: parts[1] };
        }
      }
    }

    return { artist: 'Unknown', title: rawName };
  }

  public static formatDuration(totalSeconds: number): string {
    if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '00:00';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');

    if (hours > 0) {
      const hh = hours.toString().padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
  }
}