import { IMessage } from '../types/models';
import { AttachmentType, LastMessageType } from '../types/enums';

export const CALL_SECRET_PREFIX = '\u200B\u200B\u200B_CALL:';

export class MessagePreviewHelper {
  public static formatPreview(
    rawText: string | null | undefined,
    attachmentType: AttachmentType | null | undefined,
    senderId: number | null | undefined,
    currentUserId: number,
    isDeletedForMe: boolean,
    isGroup: boolean = false,
    isChannel: boolean = false,
    isGif: boolean = false
  ): [string, LastMessageType] {
    if (isDeletedForMe) {
      return ['This message was deleted', LastMessageType.Deleted];
    }

    if (
      rawText &&
      (rawText.startsWith(CALL_SECRET_PREFIX) ||
        rawText.startsWith('_CALL:') ||
        rawText.toLowerCase().includes('_call:'))
    ) {
      const cleanText = rawText.replace(/\u200B/g, '');
      const parts = cleanText.split(':');
      const status = parts.length > 1 ? parts[1].toUpperCase() : '';
      const isMy = senderId === currentUserId;
      const isMissedOrCanceled = status === 'CANCELED' || status === 'MISSED' || status === 'DECLINED';

      let callTitle = 'Call';
      if (isMy && isMissedOrCanceled) callTitle = 'Canceled call';
      else if (isMy && !isMissedOrCanceled) callTitle = 'Outgoing call';
      else if (!isMy && isMissedOrCanceled) callTitle = 'Missed call';
      else callTitle = 'Incoming call';

      return [callTitle, LastMessageType.Call];
    }

    if (isGif) {
      const displayText = rawText && rawText.trim().length > 0 ? rawText : 'GIF';
      return [displayText, LastMessageType.Gif];
    }

    if (attachmentType !== null && attachmentType !== undefined) {
      let defaultLabel = 'Document';
      let lastType = LastMessageType.Document;

      switch (attachmentType) {
        case AttachmentType.Voice:
          defaultLabel = 'Voice message';
          lastType = LastMessageType.Voice;
          break;
        case AttachmentType.Photo:
          defaultLabel = 'Photo';
          lastType = LastMessageType.Photo;
          break;
        case AttachmentType.Video:
          defaultLabel = 'Video';
          lastType = LastMessageType.Video;
          break;
        case AttachmentType.Audio:
          defaultLabel = 'Music';
          lastType = LastMessageType.Audio;
          break;
        default:
          defaultLabel = 'Document';
          lastType = LastMessageType.Document;
          break;
      }

      const displayText = rawText && rawText.trim().length > 0 ? rawText : defaultLabel;
      return [displayText, lastType];
    }

    if (rawText && rawText.trim().length > 0) {
      return [rawText, LastMessageType.Text];
    }

    if (isChannel) return ['Channel created', LastMessageType.Text];
    if (isGroup) return ['Group created', LastMessageType.Text];

    return ['', LastMessageType.None];
  }

  public static formatPreviewFromMessage(
    msg: IMessage | null | undefined,
    currentUserId: number,
    isGroup: boolean = false,
    isChannel: boolean = false
  ): [string, LastMessageType] {
    if (!msg) {
      if (isChannel) return ['Channel created', LastMessageType.Text];
      if (isGroup) return ['Group created', LastMessageType.Text];
      return ['', LastMessageType.None];
    }

    const firstAtt = msg.attachments && msg.attachments.length > 0 ? msg.attachments[0] : null;
    const firstType = firstAtt ? firstAtt.type : null;

    const isGif = Boolean(
      firstAtt &&
        (firstAtt.fileSizeStr === 'GIF' ||
          (firstAtt.type === AttachmentType.Video && !firstAtt.hasAudio) ||
          (firstAtt.fileName && firstAtt.fileName.toLowerCase().endsWith('.gif')))
    );

    return this.formatPreview(
      msg.text,
      firstType,
      msg.senderId,
      currentUserId,
      Boolean(msg.isDeletedForMe),
      isGroup,
      isChannel,
      isGif
    );
  }
}