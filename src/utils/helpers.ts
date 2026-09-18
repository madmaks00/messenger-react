import { AttachmentType, LastMessageType } from '../types/enums';
import { IMessage } from '../types/models';

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
    // Перегрузка 1: передан объект IMessage
    if (typeof rawMessageOrMessageObj === 'object' && rawMessageOrMessageObj !== null) {
      const msg = rawMessageOrMessageObj as IMessage;
      const currentUserId = (lastAttachmentTypeOrCurrentUserId as number) || 0;
      const groupFlag = Boolean(lastMessageSenderIdOrIsGroup);
      const channelFlag = Boolean(currentUserIdOrIsChannel);

      if (msg.isDeletedForMe) {
        return ['Message was deleted', LastMessageType.Deleted];
      }

      if (msg.text && msg.text.trim().length > 0) {
        const prefix = groupFlag && !channelFlag && msg.senderId !== currentUserId
          ? `${msg.senderName || 'User'}: `
          : '';
        return [`${prefix}${msg.text}`, LastMessageType.Text];
      }

      if (msg.attachments && msg.attachments.length > 0) {
        const first = msg.attachments[0];
        const type = first.type;
        switch (type) {
          case AttachmentType.Photo: return ['📷 Photo', LastMessageType.Photo];
          case AttachmentType.Video: return ['🎥 Video', LastMessageType.Video];
          case AttachmentType.Audio: return ['🎵 Music', LastMessageType.Audio];
          case AttachmentType.Voice: return ['🎤 Voice message', LastMessageType.Voice];
          default: return ['📄 Document', LastMessageType.Document];
        }
      }

      return ['Message', LastMessageType.None];
    }

    // Перегрузка 2: переданы сырые параметры (из строки таблицы)
    const rawText = (rawMessageOrMessageObj as string) || '';
    const attType = lastAttachmentTypeOrCurrentUserId as AttachmentType | null;
    const isDeleted = Boolean(isLastMessageDeletedForMe);

    if (isDeleted) {
      return ['Message was deleted', LastMessageType.Deleted];
    }

    if (isLastAttachmentGif) {
      return ['GIF', LastMessageType.Gif];
    }

    if (attType !== null && attType !== undefined) {
      switch (attType) {
        case AttachmentType.Photo: return ['📷 Photo', LastMessageType.Photo];
        case AttachmentType.Video: return ['🎥 Video', LastMessageType.Video];
        case AttachmentType.Audio: return ['🎵 Music', LastMessageType.Audio];
        case AttachmentType.Voice: return ['🎤 Voice message', LastMessageType.Voice];
        case AttachmentType.Document: return ['📄 Document', LastMessageType.Document];
      }
    }

    if (rawText && rawText.trim().length > 0) {
      return [rawText, LastMessageType.Text];
    }

    return ['', LastMessageType.None];
  }
}

export class UrlHelper {
  public static normalize(url: string | null | undefined, serverUrl: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }
    const cleanServer = serverUrl.replace(/\/+$/, '');
    const cleanPath = url.replace(/^\/+/, '');
    return `${cleanServer}/${cleanPath}`;
  }
}