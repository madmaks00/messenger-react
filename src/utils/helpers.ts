import { AttachmentType, LastMessageType } from '../types/enums';
import { IMessage } from '../types/models';
import { BASE_SERVER_URL } from '../services/apiClient';

// ================= 1. ЦВЕТОВАЯ ПАЛИТРА ИЗ AvatarColorConverter.cs =================
export const AVATAR_COLORS = [
  '#E91E63', // 0 - Розовый
  '#9C27B0', // 1 - Фиолетовый
  '#673AB7', // 2 - Глубокий фиолетовый
  '#3F51B5', // 3 - Индиго
  '#2196F3', // 4 - Синий
  '#00BCD4', // 5 - Голубой
  '#009688', // 6 - Морская волна
  '#4CAF50', // 7 - Зеленый
  '#FF9800', // 8 - Оранжевый
  '#795548', // 9 - Коричневый
] as const;

export function getAvatarColor(id: number | string | null | undefined): string {
  let numericId = 0;
  if (typeof id === 'number') {
    numericId = id;
  } else if (id !== null && id !== undefined) {
    const parsed = parseInt(String(id), 10);
    if (!isNaN(parsed)) numericId = parsed;
  }
  const index = Math.abs(numericId) % 10;
  return AVATAR_COLORS[index];
}

// ================= 2. ФОРМАТТЕР ПРЕВЬЮ СООБЩЕНИЙ =================
export class MessagePreviewHelper {
  public static formatPreview(
    rawMessageOrMessageObj: string | null | undefined | IMessage,
    lastAttachmentTypeOrCurrentUserId?: AttachmentType | null | number,
    lastMessageSenderIdOrIsGroup?: number | null | boolean,
    currentUserIdOrIsChannel?: number | boolean,
    isLastMessageDeletedForMe?: boolean,
    isGroup?: boolean,
    isChannel?: boolean,
    isLastAttachmentGif?: boolean
  ): [string, LastMessageType] {
    if (typeof rawMessageOrMessageObj === 'object' && rawMessageOrMessageObj !== null) {
      const msg = rawMessageOrMessageObj as IMessage;
      const currentUserId = typeof lastAttachmentTypeOrCurrentUserId === 'number' ? lastAttachmentTypeOrCurrentUserId : 0;
      const groupFlag = Boolean(lastMessageSenderIdOrIsGroup);
      const channelFlag = Boolean(currentUserIdOrIsChannel);

      if (msg.isDeletedForMe || msg.isDeleted) {
        return ['This message was deleted', LastMessageType.Deleted];
      }

      if (msg.attachments && msg.attachments.length > 0) {
        const first = msg.attachments[0];
        const type = String(first.type).toLowerCase();

        if ((first as any).isGif || type === 'gif') {
          return ['GIF', LastMessageType.Gif];
        }
        if (type === 'photo' || first.type === AttachmentType.Photo) return ['Photo', LastMessageType.Photo];
        if (type === 'video' || first.type === AttachmentType.Video) return ['Video', LastMessageType.Video];
        if (type === 'voice' || first.type === AttachmentType.Voice) return ['Voice message', LastMessageType.Voice];
        if (type === 'audio' || first.type === AttachmentType.Audio) return ['Music', LastMessageType.Audio];
        return [first.fileName || 'Document', LastMessageType.Document];
      }

      if (msg.text && msg.text.trim().length > 0) {
        const cleanText = this.toSingleLine(msg.text);
        const isMe = msg.senderId === currentUserId;

        if (groupFlag && !channelFlag) {
          const sender = isMe ? 'You' : (msg.senderName || 'User');
          return [`${sender}: ${cleanText}`, LastMessageType.Text];
        }

        return [cleanText, LastMessageType.Text];
      }

      return ['', LastMessageType.None];
    }

    const rawText = typeof rawMessageOrMessageObj === 'string' ? rawMessageOrMessageObj : '';
    const attType = lastAttachmentTypeOrCurrentUserId as AttachmentType | null | undefined;
    const isDeleted = Boolean(isLastMessageDeletedForMe);

    if (isDeleted) {
      return ['This message was deleted', LastMessageType.Deleted];
    }

    if (isLastAttachmentGif) {
      return ['GIF', LastMessageType.Gif];
    }

    if (attType !== null && attType !== undefined) {
      const typeStr = String(attType).toLowerCase();
      if (typeStr === 'photo' || attType === AttachmentType.Photo) return ['Photo', LastMessageType.Photo];
      if (typeStr === 'video' || attType === AttachmentType.Video) return ['Video', LastMessageType.Video];
      if (typeStr === 'voice' || attType === AttachmentType.Voice) return ['Voice message', LastMessageType.Voice];
      if (typeStr === 'audio' || attType === AttachmentType.Audio) return ['Music', LastMessageType.Audio];
      if (typeStr === 'document' || attType === AttachmentType.Document) return ['Document', LastMessageType.Document];
    }

    if (rawText && rawText.trim().length > 0) {
      return [this.toSingleLine(rawText), LastMessageType.Text];
    }

    return ['', LastMessageType.None];
  }

  public static toSingleLine(text: string | null | undefined): string {
    if (!text) return '';
    return text.replace(/[\r\n]+/g, ' ').trim();
  }
}

// ================= 3. НОРМАЛИЗАТОР URL =================
export class UrlHelper {
  public static normalize(url: string | null | undefined, serverUrl: string = BASE_SERVER_URL): string {
    if (!url) return '';

    if (url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    if (
      url.startsWith('/9j/') ||
      url.startsWith('iVBOR') ||
      url.startsWith('R0lGOD') ||
      url.startsWith('PHN2Zy') ||
      url.length > 200
    ) {
      return `data:image/jpeg;base64,${url}`;
    }

    const cleanServer = serverUrl.replace(/\/+$/, '');
    const cleanPath = url.replace(/^\/+/, '');
    return `${cleanServer}/${cleanPath}`;
  }
}

// 🟢 Экспортируем функцию напрямую
export function normalizeAvatarUrl(url?: string | null): string | null {
  if (!url) return null;
  return UrlHelper.normalize(url);
}