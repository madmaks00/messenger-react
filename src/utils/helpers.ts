import { AttachmentType, LastMessageType } from '../types/enums';
import { IMessage } from '../types/models';
import { BASE_SERVER_URL } from '../services/apiClient';

export const AVATAR_COLORS = [
  '#E91E63',
  '#9C27B0',
  '#673AB7',
  '#3F51B5',
  '#2196F3',
  '#00BCD4',
  '#009688',
  '#4CAF50',
  '#FF9800',
  '#795548',
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

export function normalizeAvatarUrl(url?: string | null): string | null {
  if (!url) return null;
  return UrlHelper.normalize(url);
}

// 🟢 1 В 1 С WPF ChatSubtitleConverter.cs
export function formatChatSubtitle(chatOrUser: {
  isGroup?: boolean;
  isOnline?: boolean;
  lastSeen?: string | Date | null;
  nickName?: string;
  username?: string | null;
} | null | undefined): string {
  if (!chatOrUser) return '';
  if (chatOrUser.isGroup) return ''; // Группам этот статус не пишем

  // 1. Онлайн проверяется в первую очередь
  if (chatOrUser.isOnline) {
    return 'online';
  }

  const rawLastSeen = chatOrUser.lastSeen;
  if (!rawLastSeen) {
    return 'last seen a long time ago';
  }

  // 2. Корректное приведение к локальному времени из UTC (как в C# DateTime.SpecifyKind(Utc).ToLocalTime())
  let lastSeenLocal: Date;
  if (typeof rawLastSeen === 'string') {
    let s = rawLastSeen.trim();
    if (!s.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(s)) {
      s += 'Z'; // Unspecified считаем как UTC с сервера
    }
    lastSeenLocal = new Date(s);
  } else {
    lastSeenLocal = new Date(rawLastSeen);
  }

  if (isNaN(lastSeenLocal.getTime()) || lastSeenLocal.getFullYear() < 1900) {
    return 'last seen a long time ago';
  }

  const now = new Date();
  const diffSeconds = (now.getTime() - lastSeenLocal.getTime()) / 1000;
  const diffMinutes = diffSeconds / 60;

  // 3. Защита от рассинхрона часов (серверные часы спешат на пару секунд/минут)
  if (diffSeconds < 0 && diffSeconds > -180) {
    return 'last seen just now';
  }

  if (diffSeconds >= 0 && diffSeconds < 60) {
    return 'last seen just now';
  }

  if (diffMinutes >= 1 && diffMinutes < 60) {
    return `last seen ${Math.floor(diffMinutes)}m ago`;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const timeStr = `${pad(lastSeenLocal.getHours())}:${pad(lastSeenLocal.getMinutes())}`;

  // Сегодня
  const isToday =
    lastSeenLocal.getDate() === now.getDate() &&
    lastSeenLocal.getMonth() === now.getMonth() &&
    lastSeenLocal.getFullYear() === now.getFullYear();

  if (isToday) {
    return `last seen today at ${timeStr}`;
  }

  // Вчера
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    lastSeenLocal.getDate() === yesterday.getDate() &&
    lastSeenLocal.getMonth() === yesterday.getMonth() &&
    lastSeenLocal.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return `last seen yesterday at ${timeStr}`;
  }

  const day = pad(lastSeenLocal.getDate());
  const month = pad(lastSeenLocal.getMonth() + 1);

  if (lastSeenLocal.getFullYear() === now.getFullYear()) {
    return `last seen ${day}.${month} at ${timeStr}`;
  }

  return `last seen ${day}.${month}.${lastSeenLocal.getFullYear()}`;
}