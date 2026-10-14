import { IAttachment, IMessage } from './models';
import { normalizeAvatarUrl } from '../utils/helpers';

export interface IAudioTrackModel {
  attachment: IAttachment;
  messageId: number;
  chatId: number;
  noteId?: number;
  noteIconKind?: string;
  noteIconColor?: string;
  chatName: string;
  chatAvatar: string | null;
  isGroup: boolean;
  isChannel: boolean;
  title: string;
  artist: string;
  durationStr: string;
  durationSeconds: number;
  coverArt: string | null;
  isPlaying: boolean;
}

export interface PlayPlaylistMessage {
  tracks: IAudioTrackModel[];
  selectedTrack: IAudioTrackModel;
}

export class AudioMetadataHelper {
  public static parseArtistAndTitleFromName(rawName: string): { artist: string; title: string } {
    let artist = 'Unknown';
    let title = rawName;

    const splitters = [' - ', ' – ', ' — '];
    for (const sp of splitters) {
      if (rawName.includes(sp)) {
        const parts = rawName.split(sp).map((p) => p.trim());
        if (parts.length >= 2 && parts[0].length > 0 && parts[1].length > 0) {
          artist = parts[0];
          title = parts[1];
          break;
        }
      }
    }

    return { artist, title };
  }

  public static formatDuration(seconds: number): string {
    if (!isFinite(seconds) || isNaN(seconds) || seconds <= 0) return '00:00';
    const totalSec = Math.floor(seconds);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    if (hrs >= 1) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  public static parseId3CoverArt(buffer: ArrayBuffer): string | null {
    try {
      const bytes = new Uint8Array(buffer);
      if (bytes.length < 10) return null;
      if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return null;

      const version = bytes[3];
      const tagSize =
        ((bytes[6] & 0x7f) << 21) |
        ((bytes[7] & 0x7f) << 14) |
        ((bytes[8] & 0x7f) << 7) |
        (bytes[9] & 0x7f);

      const end = Math.min(bytes.length, 10 + tagSize);
      let offset = 10;

      const flags = bytes[5];
      if (flags & 0x40) {
        if (offset + 4 > end) return null;
        const extSize = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
        offset += version === 4 ? extSize : extSize + 4;
      }

      while (offset + 10 < end) {
        if (bytes[offset] === 0) break;
        const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);

        let frameSize = 0;
        if (version === 4) {
          frameSize =
            ((bytes[offset + 4] & 0x7f) << 21) |
            ((bytes[offset + 5] & 0x7f) << 14) |
            ((bytes[offset + 6] & 0x7f) << 7) |
            (bytes[offset + 7] & 0x7f);
        } else {
          frameSize = (bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7];
        }

        offset += 10;
        if (frameSize <= 0 || offset + frameSize > end) break;

        if (frameId === 'APIC') {
          const encoding = bytes[offset];
          let p = offset + 1;

          let mimeType = '';
          while (p < offset + frameSize && bytes[p] !== 0) {
            mimeType += String.fromCharCode(bytes[p]);
            p++;
          }
          p++;

          p++;

          if (encoding === 0 || encoding === 3) {
            while (p < offset + frameSize && bytes[p] !== 0) p++;
            p++;
          } else {
            while (p + 1 < offset + frameSize && !(bytes[p] === 0 && bytes[p + 1] === 0)) p++;
            p += 2;
          }

          const imgBytes = bytes.subarray(p, offset + frameSize);
          if (imgBytes.length > 0) {
            const blob = new Blob([imgBytes], { type: mimeType || 'image/jpeg' });
            return URL.createObjectURL(blob);
          }
        }

        offset += frameSize;
      }
    } catch (err) {
      console.warn('[AudioMetadataHelper] ID3 parsing error:', err);
    }
    return null;
  }

  public static async extractCoverArtFromFile(file: File): Promise<string | null> {
    try {
      const slice = file.slice(0, Math.min(file.size, 3 * 1024 * 1024));
      const buffer = await slice.arrayBuffer();
      return AudioMetadataHelper.parseId3CoverArt(buffer);
    } catch {
      return null;
    }
  }

  public static createAudioTrackFromAttachment(
    att: IAttachment,
    message: IMessage | null,
    chatName: string,
    chatAvatar: string | null,
    isGroup: boolean,
    isChannel: boolean
  ): IAudioTrackModel {
    const rawFileName = att.fileName || 'Audio';
    const baseName = rawFileName.replace(/\.[^/.]+$/, '');
    const { artist, title } = AudioMetadataHelper.parseArtistAndTitleFromName(baseName);

    const durationSeconds = att.durationSeconds || 0;
    const durationStr = durationSeconds > 0 ? AudioMetadataHelper.formatDuration(durationSeconds) : '00:00';

    const chatId = isGroup
      ? (message?.groupId || 0)
      : (message?.isMyMessage ? (message?.receiverId || 0) : (message?.senderId || 0));

    // 🟢 В личных сообщениях аватарка трека — это аватарка собеседника (chatAvatar), а НЕ моя!
    let targetAvatar = chatAvatar;
    if (!targetAvatar && message) {
      if (!message.isMyMessage && message.senderAvatar) {
        targetAvatar = message.senderAvatar;
      } else if (message.forwardedFromAvatar) {
        targetAvatar = message.forwardedFromAvatar;
      }
    }

    const resolvedAvatar = normalizeAvatarUrl(targetAvatar);
    const resolvedCover = att.thumbnailUrl || (att as any).displayImageUrl || (att as any).coverArt || null;

    return {
      attachment: att,
      messageId: message ? (Number(message.serverId) > 0 ? Number(message.serverId) : Number(message.id || 0)) : 0,
      chatId: Number(chatId || 0),
      chatName: chatName || 'Chat',
      chatAvatar: resolvedAvatar,
      isGroup,
      isChannel,
      title: title || baseName,
      artist: artist || 'Unknown',
      coverArt: resolvedCover,
      durationSeconds,
      durationStr,
      isPlaying: false,
    };
  }
}