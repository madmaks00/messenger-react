import { IAttachment } from '../types/models';
import { AttachmentType } from '../types/enums';
import { AudioMetadataHelper } from '../types/audio.types';

export class AudioConverterHelper {
  public static isSameAttachment(
    a: IAttachment | null | undefined,
    b: IAttachment | null | undefined
  ): boolean {
    if (!a || !b) return false;
    if (a === b) return true;

    const isVoiceA = a.type === AttachmentType.Voice || (a.fileName && a.fileName.toLowerCase().startsWith('voice_'));
    const isVoiceB = b.type === AttachmentType.Voice || (b.fileName && b.fileName.toLowerCase().startsWith('voice_'));
    if (isVoiceA !== isVoiceB) return false;

    const urlA = (a.url || a.localImagePath || '').toLowerCase().trim();
    const urlB = (b.url || b.localImagePath || '').toLowerCase().trim();
    if (urlA.length > 0 && urlB.length > 0) {
      return urlA === urlB;
    }

    if (a.fileHash && b.fileHash && a.fileHash === b.fileHash) {
      return true;
    }

    if (a.messageId && b.messageId && a.messageId === b.messageId && a.id && b.id && a.id === b.id) {
      return true;
    }

    const nameA = (a.fileName || '').toLowerCase().trim();
    const nameB = (b.fileName || '').toLowerCase().trim();
    if (nameA.length > 0 && nameB.length > 0 && nameA === nameB) {
      if (a.fileSizeBytes && b.fileSizeBytes && a.fileSizeBytes === b.fileSizeBytes) {
        return true;
      }
      if (a.durationSeconds && b.durationSeconds && Math.abs(a.durationSeconds - b.durationSeconds) < 0.5) {
        return true;
      }
    }

    return false;
  }
}

// 🟢 Вывод длительности + размера файла в формате Telegram (например, "03:09, 47.29 MB")
export function getAudioSubtitle(att: IAttachment, overrideDurationSeconds?: number): string {
  if (!att) return '00:00';

  const durSec =
    overrideDurationSeconds && overrideDurationSeconds > 0
      ? overrideDurationSeconds
      : att.durationSeconds && att.durationSeconds > 0
      ? att.durationSeconds
      : 0;

  if (durSec > 0) {
    const durStr = AudioMetadataHelper.formatDuration(durSec);
    if (att.fileSizeStr && !att.fileSizeStr.includes(':')) {
      return `${durStr}, ${att.fileSizeStr}`;
    }
    return durStr;
  }

  if (att.fileSizeStr) {
    return att.fileSizeStr;
  }

  return '00:00';
}