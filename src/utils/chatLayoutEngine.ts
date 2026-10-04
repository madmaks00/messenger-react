import { IMessageLayoutModel } from '../types/layout';
import { IMessage, IAttachment } from '../types/models';
import { AttachmentType } from '../types/enums';
import { MediaFormatHelper } from './mediaFormatHelper';
import { mediaDimensionsCache } from './mediaDimensionsCache';

function formatWpfCallDuration(seconds: number): string {
  if (seconds <= 0) return '';
  if (seconds === 1) return '1 second';
  if (seconds < 60) return `${seconds} seconds`;
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (rem === 0) return mins === 1 ? '1 minute' : `${mins} minutes`;
  return `${mins} min ${rem} sec`;
}

let measureCanvasCtx: CanvasRenderingContext2D | null = null;

function getCanvasContext(): CanvasRenderingContext2D {
  if (!measureCanvasCtx) {
    const canvas = document.createElement('canvas');
    measureCanvasCtx = canvas.getContext('2d');
  }
  return measureCanvasCtx!;
}

function calculateFormattedTextLineCount(text: string, maxTextWidth: number): number {
  if (!text || text.length === 0) return 0;

  const paragraphs = text.split(/\r\n|\r|\n/);
  let totalLines = 0;

  const ctx = getCanvasContext();
  ctx.font = '15px "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif';

  for (const para of paragraphs) {
    if (para.length === 0) {
      totalLines += 1;
      continue;
    }

    const paraWidth = ctx.measureText(para).width;
    if (paraWidth <= maxTextWidth) {
      totalLines += 1;
      continue;
    }

    const words = para.split(' ');
    let currentLineWidth = 0;
    let paraLines = 1;
    const spaceWidth = ctx.measureText(' ').width;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordWidth = ctx.measureText(word).width;

      if (wordWidth > maxTextWidth) {
        for (let c = 0; c < word.length; c++) {
          const charWidth = ctx.measureText(word[c]).width;
          if (currentLineWidth + charWidth > maxTextWidth) {
            paraLines += 1;
            currentLineWidth = charWidth;
          } else {
            currentLineWidth += charWidth;
          }
        }
        if (i < words.length - 1) {
          currentLineWidth += spaceWidth;
        }
        continue;
      }

      if (currentLineWidth + wordWidth > maxTextWidth) {
        paraLines += 1;
        currentLineWidth = wordWidth + spaceWidth;
      } else {
        currentLineWidth += wordWidth + spaceWidth;
      }
    }

    totalLines += paraLines;
  }

  return Math.max(1, totalLines);
}

export class AsyncChatLayoutEngine {
  public static calculateMediaDimensionsFromPixels(
    origWidth: number,
    origHeight: number
  ): { width: number; height: number } {
    if (origWidth <= 0 || origHeight <= 0) {
      return { width: 340.0, height: 240.0 };
    }

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

    const finalW = Math.round(targetWidth);
    const finalH = Math.round(targetHeight);

    return { width: finalW, height: finalH };
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
        const isAudio =
          !isVoice &&
          (att.type === AttachmentType.Audio || MediaFormatHelper.isAudioExtension(att.fileName || ''));
        const isMedia =
          !isVoice &&
          !isAudio &&
          (att.type === AttachmentType.Photo ||
            att.type === AttachmentType.Video ||
            MediaFormatHelper.isPhotoExtension(att.fileName || '') ||
            MediaFormatHelper.isVideoExtension(att.fileName || ''));

        if (isVoice) voiceAttachments.push(att);
        else if (isAudio) audioAttachments.push(att);
        else if (isMedia) mediaAttachments.push(att);
        else documentAttachments.push(att);
      });

      const isMy = Boolean(m.isMyMessage) || (curId > 0 && Number(m.senderId) === curId);

      const rawText = String(m.text || '');
      const isCall = Boolean(
        m.isCallMessage || rawText.includes('_CALL:') || rawText.includes('CALL:')
      );

      let callTitle = 'Call';
      let callTimeAndDuration = '';
      let callArrowKind: 'in' | 'out' | 'missed' = isMy ? 'out' : 'in';
      let callArrowColor = '#4CAF50';

      if (isCall) {
        const callIdx = rawText.indexOf('CALL:');
        const clean = callIdx !== -1 ? rawText.slice(callIdx) : rawText;
        const parts = clean.split(':');
        const status = (parts[1] || '').toUpperCase();
        const durationSec = parseInt(parts[2] || '0', 10);

        const isMissed = status === 'CANCELED' || status === 'MISSED' || status === 'DECLINED';

        if (isMissed) {
          callTitle = isMy ? 'Cancelled call' : 'Missed call';
          callArrowKind = 'missed';
          callArrowColor = '#FF4B4B';
        } else {
          callTitle = isMy ? 'Outgoing call' : 'Incoming call';
          callArrowKind = isMy ? 'out' : 'in';
          callArrowColor = '#4CAF50';
        }

        const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const durStr = formatWpfCallDuration(durationSec);
        callTimeAndDuration = durStr ? `${timeStr}, ${durStr}` : timeStr;
      }

      const isMediaOnly =
        mediaAttachments.length > 0 && !m.text && documentAttachments.length === 0 && audioAttachments.length === 0;

      let initialMediaWidth = 340.0;
      let initialMediaHeight = 240.0;

      if (mediaAttachments.length === 1) {
        const first = mediaAttachments[0];
        const cached = mediaDimensionsCache.get(first.url) || mediaDimensionsCache.get(first.fileName);
        const w = Number(first.width || 0) > 0 ? Number(first.width) : (cached?.width || 0);
        const h = Number(first.height || 0) > 0 ? Number(first.height) : (cached?.height || 0);

        if (w > 0 && h > 0) {
          const dims = this.calculateMediaDimensionsFromPixels(w, h);
          initialMediaWidth = dims.width;
          initialMediaHeight = dims.height;
        }
      } else if (mediaAttachments.length > 1) {
        const dims = this.calculateAlbumDimensions(mediaAttachments.length);
        initialMediaWidth = dims.width;
        initialMediaHeight = dims.height;
      }

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
        isSelected: Boolean(m.isSelected),
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
        callTitle,
        callArrowKind,
        callArrowColor,
        callTimeAndDuration,
        isMediaOnly,
        hasAudio: mediaAttachments.some((a) => a.hasAudio),
        isSilentVideo: mediaAttachments.length === 1 && Boolean(mediaAttachments[0].isSilentVideo),
        yOffset: 0,
        totalHeight: 0,
        mediaWidth: initialMediaWidth,
        mediaHeight: initialMediaHeight,
        sourceMessage: m,
      };
    });
  }

  public static calculateLayout(
    messages: IMessageLayoutModel[],
    containerWidth: number = 600
  ): { items: IMessageLayoutModel[]; totalHeight: number } {
    const dpi = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const snap = (v: number) => Math.round(v * dpi) / dpi;

    let currentY = snap(15.0);
    const maxBubbleWidth = Math.min(containerWidth * 0.75, 500.0);
    const gap = snap(2.0);

    for (const msg of messages) {
      msg.yOffset = snap(currentY);
      let bubbleHeight = 0;

      if (msg.isCallMessage) {
        bubbleHeight = snap(61.0);
        if (msg.isForwarded && !msg.isDeletedForMe) bubbleHeight += snap(45.0);
      } else if (msg.isDeletedForMe) {
        bubbleHeight = snap(38.0);
      } else if (msg.voices && msg.voices.length === 1) {
        bubbleHeight = snap(53.5);
      } else {
        const hasMedia = msg.previewMedia && msg.previewMedia.length > 0;
        const hasDocs = msg.documents && msg.documents.length > 0;
        const hasAudios = msg.audios && msg.audios.length > 0;
        const hasText = Boolean(msg.text && msg.text.trim().length > 0);
        let totalMediaCount = 0;

        if (hasMedia) {
          totalMediaCount = msg.previewMedia.length;
          if (msg.sourceMessage?.attachments) {
            const attCount = msg.sourceMessage.attachments.filter(
              (a) => a.type === AttachmentType.Photo || a.type === AttachmentType.Video
            ).length;
            if (attCount > totalMediaCount) totalMediaCount = attCount;
          }
        }

        const textGridPaddingAndMargin = hasText ? 19.0 : 0.0;
        let textContentHeight = 0.0;

        if (hasText) {
          const maxTextWidth = maxBubbleWidth - 30.0;
          const lineCount = calculateFormattedTextLineCount(msg.text, maxTextWidth);
          textContentHeight = lineCount * 20.0;
        }

        bubbleHeight = textGridPaddingAndMargin + textContentHeight;

        if (hasMedia) {
          if (totalMediaCount > 4) {
            const extraCount = totalMediaCount - 3;
            const itemsForGrid = msg.previewMedia.slice(0, 4);

            for (let i = 0; i < itemsForGrid.length; i++) {
              (itemsForGrid[i] as any).showMoreOverlay = false;
              (itemsForGrid[i] as any).moreCountOverlay = '';
            }

            if (itemsForGrid.length > 3) {
              (itemsForGrid[3] as any).showMoreOverlay = true;
              (itemsForGrid[3] as any).moreCountOverlay = `+${extraCount}`;
            }

            msg.previewMedia = itemsForGrid;
          }

          let mediaTextGap = 0.0;
          if (hasText) {
            if (msg.isMyMessage) {
              mediaTextGap = msg.isForwarded ? 5.0 : -1.0;
            } else {
              mediaTextGap = msg.isForwarded ? 5.0 : 5.5;
            }
          }

          if (msg.previewMedia.length === 1) {
            const first = msg.previewMedia[0];
            const cached = mediaDimensionsCache.get(first.url) || mediaDimensionsCache.get(first.fileName);
            const origW = Number(first.width || 0) > 0 ? Number(first.width) : (cached?.width || 0);
            const origH = Number(first.height || 0) > 0 ? Number(first.height) : (cached?.height || 0);

            const dims = this.calculateMediaDimensionsFromPixels(
              origW > 0 ? origW : 340,
              origH > 0 ? origH : 240
            );

            msg.mediaWidth = dims.width;
            msg.mediaHeight = dims.height;
            bubbleHeight += dims.height + mediaTextGap;
          } else {
            const dims = this.calculateAlbumDimensions(msg.previewMedia.length);
            msg.mediaWidth = dims.width;
            msg.mediaHeight = dims.height;
            bubbleHeight += dims.height + mediaTextGap;
          }
        }

        if (hasDocs) {
          bubbleHeight += (msg.documents.length * 163.0 + 20.0) / 3.0;
        }

        if (hasAudios) {
          const count = msg.audios.length;
          bubbleHeight +=
            count === 1
              ? 55.0
              : count === 2
              ? 101.0
              : count === 3
              ? 146.5
              : count === 4
              ? 192.0
              : 192.0 + (count - 4) * 45.56;
        }

        if (!msg.isMyMessage && msg.isGroupMessage && hasMedia && (hasDocs || hasAudios)) {
          bubbleHeight += 0.5;
        }

        if (!msg.isForwarded && !msg.isDeletedForMe && (msg.isChannel || (!msg.isMyMessage && msg.isGroupMessage))) {
          if ((hasDocs || hasAudios) && !hasMedia && !hasText) bubbleHeight += 31.0;
          else if (hasMedia && !hasText) bubbleHeight += totalMediaCount >= 4 ? 32.0 : 31.0;
          else bubbleHeight += 23.5;
        }

        if (msg.isForwarded && !msg.isDeletedForMe) {
          if (hasMedia && (hasDocs || hasAudios)) bubbleHeight += 39.0;
          else if (hasMedia && !hasText && !hasDocs && !hasAudios) bubbleHeight += 44.5;
          else bubbleHeight += 38.0;
        }

        if (msg.repliedMessages && msg.repliedMessages.length > 0) {
          bubbleHeight += msg.repliedMessages.length * 44.0 + 6.5;
        }

        bubbleHeight = snap(bubbleHeight);
      }

      msg.totalHeight = snap(bubbleHeight + gap);
      currentY = snap(currentY + msg.totalHeight);
    }

    const last = messages[messages.length - 1];
    const totalHeight = last ? snap(last.yOffset + last.totalHeight + 82.0) : 0;

    return { items: messages, totalHeight };
  }
}