import { IMessageLayoutModel } from '../types/layout';
import { IMessage, IAttachment } from '../types/models';
import { AttachmentType } from '../types/enums';
import { MediaFormatHelper } from './mediaFormatHelper';

export class AsyncChatLayoutEngine {
  public static calculateMediaDimensionsFromPixels(
    origWidth: number,
    origHeight: number
  ): { width: number; height: number } {
    if (origWidth <= 0 || origHeight <= 0) return { width: 340.0, height: 240.0 };

    const aspectRatio = origWidth / origHeight;
    const maxWidth = 380.0;
    const maxHeight = 340.0;
    const minWidth = 160.0;
    const minHeight = 120.0;

    let targetWidth: number;
    let targetHeight: number;

    if (aspectRatio >= 1.0) {
      targetWidth = Math.min(Math.max(origWidth, minWidth), maxWidth);
      targetHeight = targetWidth / aspectRatio;
      if (targetHeight > maxHeight) {
        targetHeight = maxHeight;
        targetWidth = targetHeight * aspectRatio;
      }
    } else {
      targetHeight = Math.min(Math.max(origHeight, minHeight), maxHeight);
      targetWidth = targetHeight * aspectRatio;
      if (targetWidth > maxWidth) {
        targetWidth = maxWidth;
        targetHeight = targetWidth / aspectRatio;
      }
    }

    return { width: Math.round(targetWidth), height: Math.round(targetHeight) };
  }

  public static calculateAlbumDimensions(mediaCount: number): { width: number; height: number } {
    if (mediaCount <= 0) return { width: 0, height: 0 };
    if (mediaCount === 1) return { width: 420.0, height: 280.0 };
    if (mediaCount === 2) return { width: 460.0, height: 240.0 };
    if (mediaCount === 3) return { width: 460.0, height: 360.0 };
    return { width: 460.0, height: 460.0 };
  }

  public static createLayoutModels(
    messages: IMessage[],
    currentUserId: number,
    isGroupChat: boolean,
    isChannelChat: boolean,
    channelTitle: string = 'Channel'
  ): IMessageLayoutModel[] {
    const curId = Number(currentUserId);

    return messages.map((m) => {
      const mediaAttachments: IAttachment[] = [];
      const voiceAttachments: IAttachment[] = [];
      const audioAttachments: IAttachment[] = [];
      const documentAttachments: IAttachment[] = [];

      (m.attachments || []).forEach((att) => {
        if (!att) return;
        const isVoice = att.type === AttachmentType.Voice;
        const isAudio = !isVoice && (att.type === AttachmentType.Audio || MediaFormatHelper.isAudioExtension(att.fileName || ''));
        const isMedia = !isVoice && !isAudio && (att.type === AttachmentType.Photo || att.type === AttachmentType.Video || MediaFormatHelper.isPhotoExtension(att.fileName || '') || MediaFormatHelper.isVideoExtension(att.fileName || ''));

        if (isVoice) voiceAttachments.push(att);
        else if (isAudio) audioAttachments.push(att);
        else if (isMedia) mediaAttachments.push(att);
        else documentAttachments.push(att);
      });

      const isCall = Boolean(m.isCallMessage || (m.text && m.text.startsWith('CALL:')));
      const isMediaOnly = mediaAttachments.length > 0 && !m.text && documentAttachments.length === 0 && audioAttachments.length === 0;

      // 🟢 Строгая проверка принадлежности сообщения текущему пользователю
      const isMy = Boolean(m.isMyMessage) || (curId > 0 && Number(m.senderId) === curId);

      return {
        id: m.id || 0,
        serverId: m.serverId || 0,
        senderId: m.senderId,
        senderName: isChannelChat ? channelTitle : m.senderName || 'User',
        senderAvatar: m.senderAvatar || null,
        text: m.text || '',
        timestamp: m.timestamp,
        isMyMessage: isMy,
        isGroupMessage: isGroupChat && !isChannelChat,
        isChannel: isChannelChat,
        isRead: m.isRead,
        isSentToServer: m.isSentToServer,
        isEdited: Boolean(m.editedAt) && !m.isDeletedForMe && !m.isDeleted,
        isPinned: m.isPinned,
        viewsCount: m.viewsCount && m.viewsCount > 0 ? m.viewsCount : 1,
        isDeletedForMe: m.isDeletedForMe,
        isSelected: false,
        isForwarded: Boolean(m.forwardedFromName),
        forwardedFromUserId: m.forwardedFromUserId || 0,
        forwardedFromName: m.forwardedFromName || '',
        forwardedFromAvatar: m.forwardedFromAvatar || null,
        repliedMessages: m.repliedMessages || [],
        previewMedia: mediaAttachments,
        audios: audioAttachments,
        voices: voiceAttachments,
        documents: documentAttachments,
        isAlbum: mediaAttachments.length > 1,
        mediaCount: mediaAttachments.length,
        isCallMessage: isCall,
        callTitle: m.callTitle || 'Call',
        callArrowKind: m.callArrowKind || 'Phone',
        callArrowColor: m.callArrowColor || '#22C55E',
        callTimeAndDuration: m.callTimeAndDuration || '',
        isMediaOnly,
        hasAudio: mediaAttachments.some((a) => a.hasAudio),
        isSilentVideo: mediaAttachments.length === 1 && Boolean(mediaAttachments[0].isSilentVideo),
        yOffset: 0,
        totalHeight: 0,
        mediaWidth: 340,
        mediaHeight: 240,
        sourceMessage: m,
      };
    });
  }

  public static calculateLayout(
    messages: IMessageLayoutModel[],
    containerWidth: number = 600
  ): { items: IMessageLayoutModel[]; totalHeight: number } {
    // 🟢 Коэффициент масштабирования дисплея (125% = 1.25, 100% = 1.0)
    const dpi = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const snap = (v: number) => Math.round(v * dpi) / dpi;

    let currentY = snap(15.0);
    const maxBubbleWidth = Math.min(containerWidth * 0.75, 500.0);

    // 🟢 Строго 2.0px, привязанные к физическим пикселям матрицы
    const gap = snap(1.0);

    for (const msg of messages) {
      msg.yOffset = snap(currentY);
      let bubbleHeight = 0;

      if (msg.isCallMessage) {
        bubbleHeight = snap(54.0);
        if (msg.isForwarded && !msg.isDeletedForMe) bubbleHeight += snap(45.0);
      } else if (msg.isDeletedForMe) {
        bubbleHeight = snap(34.0);
      } else if (msg.voices && msg.voices.length === 1) {
        bubbleHeight = snap(52.0);
      } else {
        const hasMedia = msg.previewMedia && msg.previewMedia.length > 0;
        const hasDocs = msg.documents && msg.documents.length > 0;
        const hasAudios = msg.audios && msg.audios.length > 0;
        const hasText = Boolean(msg.text && msg.text.trim().length > 0);

        // 19.0px под отступы (7px top + 12px bottom)
        const textGridPaddingAndMargin = hasText ? 19.0 : 0.0;
        let textContentHeight = 0.0;

        if (hasText) {
          const availableTextWidth = maxBubbleWidth - (msg.isMyMessage ? 85 : 65);
          const charsPerLine = Math.max(10, Math.floor(availableTextWidth / 8.5));
          const estimatedLines = Math.max(1, Math.ceil(msg.text.length / charsPerLine));
          textContentHeight = estimatedLines * 20.0;
        }

        bubbleHeight = snap(textGridPaddingAndMargin + textContentHeight);

        if (hasMedia) {
          let mediaTextGap = hasText ? 5.0 : 0.0;
          if (msg.previewMedia.length === 1) {
            const first = msg.previewMedia[0];
            const dims = this.calculateMediaDimensionsFromPixels(first.width || 340, first.height || 240);
            msg.mediaWidth = dims.width;
            msg.mediaHeight = dims.height;
            bubbleHeight += snap(dims.height + mediaTextGap);
          } else {
            const dims = this.calculateAlbumDimensions(msg.previewMedia.length);
            msg.mediaWidth = dims.width;
            msg.mediaHeight = dims.height;
            bubbleHeight += snap(dims.height + mediaTextGap);
          }
        }

        if (hasDocs) bubbleHeight += snap(msg.documents.length * 52.0);
        if (hasAudios) {
          const count = msg.audios.length;
          bubbleHeight += snap(count === 1 ? 55.0 : count === 2 ? 101.0 : count === 3 ? 146.5 : 192.0);
        }
        if (msg.repliedMessages && msg.repliedMessages.length > 0) {
          bubbleHeight += snap(msg.repliedMessages.length * 36.0 + 8.0);
        }
        if (msg.isForwarded && !msg.isDeletedForMe) {
          bubbleHeight += snap(24.0);
        }
        if (!msg.isMyMessage && (msg.isGroupMessage || msg.isChannel) && !msg.isForwarded && !msg.isDeletedForMe) {
          bubbleHeight += snap(22.0);
        }
      }

      // msg.totalHeight всегда строго равен bubbleHeight + gap
      msg.totalHeight = snap(bubbleHeight + gap);
      currentY = snap(currentY + msg.totalHeight);
    }

    const last = messages[messages.length - 1];
    const totalHeight = last ? snap(last.yOffset + last.totalHeight + 82.0) : 0;

    return { items: messages, totalHeight };
  }
}