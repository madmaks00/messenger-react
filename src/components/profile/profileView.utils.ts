import { AttachmentType, PrivacyVisibility } from '../../types/enums';
import {
  IAttachment,
  IMessage,
  ISharedMediaGroup,
  ISharedMessageGroup,
  IUser,
} from '../../types/models';
import { BASE_SERVER_URL } from '../../services/apiClient';

// =========================================================================
// 1. БЕЗОПАСНАЯ НОРМАЛИЗАЦИЯ ИЗОБРАЖЕНИЙ (1:1 C# ImageHelper.NormalizeMediaUrl)
// =========================================================================

export function normalizeImageSrc(src?: string | null): string {
  if (!src || typeof src !== 'string') return '';
  let trimmed = src.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return '';

  trimmed = trimmed.replace(/\\/g, '/');

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (
    trimmed.startsWith('iVBORw0KGgo') ||
    trimmed.startsWith('/9j/') ||
    trimmed.startsWith('R0lGOD') ||
    trimmed.startsWith('UklGR') ||
    trimmed.length > 200
  ) {
    let mime = 'image/png';
    if (trimmed.startsWith('/9j/')) mime = 'image/jpeg';
    else if (trimmed.startsWith('R0lGOD')) mime = 'image/gif';
    else if (trimmed.startsWith('UklGR')) mime = 'image/webp';
    return `data:${mime};base64,${trimmed}`;
  }

  const baseServer = (BASE_SERVER_URL || 'https://localhost:7214').replace(/\/+$/, '');
  const cleanPath = trimmed.replace(/^\/+/, '');
  return `${baseServer}/${cleanPath}`;
}

// =========================================================================
// 2. АВАТАР И ИНИЦИАЛЫ (1:1 AvatarColorConverter.cs & FirstLetterConverter.cs)
// =========================================================================

const AVATAR_COLORS: readonly string[] = [
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
];

export function getAvatarColor(id: number | string | undefined | null): string {
  const numId = typeof id === 'number' ? id : parseInt(String(id || 0), 10) || 0;
  const index = Math.abs(numId) % 10;
  return AVATAR_COLORS[index];
}

export function getFirstLetter(value: string | undefined | null): string {
  if (!value || !value.trim()) {
    return '?';
  }
  return value.trim().charAt(0).toUpperCase();
}

// =========================================================================
// 3. ФОРМАТИРОВАНИЕ ДАТ И ТЕЛЕФОНА (1:1 PhoneNumberFormatConverter.cs)
// =========================================================================

export function formatPhoneNumber(phone: string | undefined | null): string {
  if (!phone || !phone.trim()) {
    return '';
  }
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+') && digits.length >= 10 && digits.length <= 15) {
    if (digits.length === 11 && digits.startsWith('7')) {
      return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
    }
    if (digits.length === 12 && digits.startsWith('380')) {
      return `+380 (${digits.slice(3, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10, 12)}`;
    }
    return `+${digits.slice(0, digits.length - 10)} (${digits.slice(-10, -7)}) ${digits.slice(-7, -4)}-${digits.slice(-4, -2)}-${digits.slice(-2)}`;
  }
  return trimmed;
}

export function formatDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return 'Not set';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return 'Not set';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

export function formatDateTime(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

const MONTH_NAMES: readonly string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function getGroupTitle(date: Date): string {
  const currentYear = new Date().getFullYear();
  const monthName = MONTH_NAMES[date.getMonth()];
  return date.getFullYear() === currentYear ? monthName : `${monthName} ${date.getFullYear()}`;
}

// =========================================================================
// 4. СТРОГИЙ РЕЗОЛВЕР ТИПОВ ВЛОЖЕНИЙ (1:1 C# WPF PrepareMessageMedia & MatchesCategory)
// В C# WPF: Photo = 0, Video = 1, Audio = 2, Document = 3, Voice = 4
// =========================================================================

export function resolveAttachmentType(a: IAttachment): AttachmentType {
  const typeVal = a.type as any;
  const fileName = (a.fileName || a.url || '').toLowerCase();
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';

  // 1. Голосовое сообщение: строгая детекция (Voice = 4)
  if (
    typeVal === AttachmentType.Voice ||
    typeVal === 4 ||
    typeVal === 'Voice' ||
    fileName.startsWith('voice_') ||
    (Boolean(a.waveform) && String(a.waveform).trim().length > 0)
  ) {
    return AttachmentType.Voice;
  }

  // 2. Видеоролик по расширению (ВИДЕО НИ ПРИ КАКИХ УСЛОВИЯХ НЕ МОЖЕТ БЫТЬ PHOTO)
  if (['.mp4', '.mov', '.avi', '.mkv', '.wmv'].includes(ext)) {
    return AttachmentType.Video;
  }

  // 3. Фото по расширению
  if (['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'].includes(ext)) {
    return AttachmentType.Photo;
  }

  // 4. Музыка по расширению
  if (['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma', '.opus'].includes(ext)) {
    return AttachmentType.Audio;
  }

  // 5. По числовому или строковому enum
  if (typeVal === AttachmentType.Photo || typeVal === 0 || typeVal === 'Photo') {
    return AttachmentType.Photo;
  }
  if (typeVal === AttachmentType.Video || typeVal === 1 || typeVal === 'Video') {
    return AttachmentType.Video;
  }
  if (typeVal === AttachmentType.Audio || typeVal === 2 || typeVal === 'Audio') {
    return AttachmentType.Audio;
  }
  if (typeVal === AttachmentType.Document || typeVal === 3 || typeVal === 'Document') {
    return AttachmentType.Document;
  }

  return AttachmentType.Document;
}

export function isGifAttachment(a: IAttachment): boolean {
  if (!a) return false;
  if (a.fileSizeStr === 'GIF') return true;

  const fileName = (a.fileName || '').toLowerCase();
  const url = (a.url || '').toLowerCase();
  if (fileName.endsWith('.gif') || url.endsWith('.gif')) return true;

  if (Boolean((a as any).isSilentVideo)) return true;

  const resolved = resolveAttachmentType(a);
  if (resolved === AttachmentType.Video && a.hasAudio === false) {
    return true;
  }

  return false;
}

export function matchesSharedCategory(a: IAttachment, category: string): boolean {
  if (!a) return false;
  const resolved = resolveAttachmentType(a);
  const isGif = isGifAttachment(a);

  switch (category) {
    case 'Photos':
      // 1:1 C#: a.Type == AttachmentType.Photo && !IsGif(a)
      return resolved === AttachmentType.Photo && !isGif;

    case 'Videos':
      // 1:1 C#: a.Type == AttachmentType.Video && !IsGif(a) (Обычные видео со звуком)
      return resolved === AttachmentType.Video && !isGif;

    case 'GIFs':
      // 1:1 C#: IsGif(a) (Все GIF и беззвучные ролики)
      return isGif;

    case 'Audios':
      // 1:1 C#: a.Type == AttachmentType.Audio (Голосовые исключены на уровне resolveAttachmentType)
      return resolved === AttachmentType.Audio;

    case 'Voice':
      // 1:1 C#: a.Type == AttachmentType.Voice
      return resolved === AttachmentType.Voice;

    case 'Documents':
      return resolved === AttachmentType.Document;

    default:
      return false;
  }
}

export function groupAttachmentsByMonth(
  attachments: IAttachment[],
  currentUserId: number,
  myName: string,
  targetName: string
): ISharedMediaGroup[] {
  // Сортировка от новых к старым (1:1 C# OrderByDescending(m => m.Timestamp))
  const sortedAttachments = [...attachments].sort((a, b) => {
    const timeA = new Date((a as any).message?.timestamp || (a as any).timestamp || 0).getTime();
    const timeB = new Date((b as any).message?.timestamp || (b as any).timestamp || 0).getTime();
    return timeB - timeA;
  });

  const groupsMap = new Map<string, { date: Date; items: IAttachment[] }>();

  for (const att of sortedAttachments) {
    const rawTime = (att as any).message?.timestamp || (att as any).timestamp || Date.now();
    const date = new Date(rawTime);
    const validDate = isNaN(date.getTime()) ? new Date() : date;
    const groupKey = `${validDate.getFullYear()}-${validDate.getMonth()}`;

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, { date: validDate, items: [] });
    }

    if ((att as any).message) {
      (att as any).message.isMyMessage = Number((att as any).message.senderId) === Number(currentUserId);
      (att as any).message.senderName = (att as any).message.isMyMessage ? myName : targetName;
    }

    groupsMap.get(groupKey)!.items.push({
      ...att,
      isSelected: Boolean(att.isSelected),
    });
  }

  const sortedKeys = Array.from(groupsMap.keys()).sort((a, b) => {
    const [yearA, monthA] = a.split('-').map(Number);
    const [yearB, monthB] = b.split('-').map(Number);
    if (yearA !== yearB) return yearB - yearA;
    return monthB - monthA;
  });

  return sortedKeys.map((key) => {
    const group = groupsMap.get(key)!;
    return {
      title: getGroupTitle(group.date),
      items: group.items,
    };
  });
}

export function groupMessagesByMonth(
  messages: IMessage[],
  currentUserId: number,
  myName: string,
  targetName: string
): ISharedMessageGroup[] {
  // Сортировка от новых к старым (1:1 C# OrderByDescending(m => m.Timestamp))
  const sortedMessages = [...messages].sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    return timeB - timeA;
  });

  const groupsMap = new Map<string, { date: Date; items: IMessage[] }>();

  for (const rawMsg of sortedMessages) {
    const isMyMessage = Number(rawMsg.senderId) === Number(currentUserId);
    const msg: IMessage = {
      ...rawMsg,
      isMyMessage,
      senderName: isMyMessage ? myName : targetName,
      isSelected: Boolean(rawMsg.isSelected),
    };

    const date = new Date(msg.timestamp);
    const validDate = isNaN(date.getTime()) ? new Date() : date;
    const groupKey = `${validDate.getFullYear()}-${validDate.getMonth()}`;

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, { date: validDate, items: [] });
    }

    groupsMap.get(groupKey)!.items.push(msg);
  }

  const sortedKeys = Array.from(groupsMap.keys()).sort((a, b) => {
    const [yearA, monthA] = a.split('-').map(Number);
    const [yearB, monthB] = b.split('-').map(Number);
    if (yearA !== yearB) return yearB - yearA;
    return monthB - monthA;
  });

  return sortedKeys.map((key) => {
    const group = groupsMap.get(key)!;
    return {
      title: getGroupTitle(group.date),
      items: group.items,
    };
  });
}

// =========================================================================
// 5. ВАЛИДАЦИЯ ПРОФИЛЯ (1:1 C# User.cs -> ValidateForEditProfile())
// =========================================================================

export class UserValidator {
  public static validateForEditProfile(user: Partial<IUser>): Record<string, string> {
    const errors: Record<string, string> = {};

    if (user.firstName && !/^[\p{L}\p{M}\s\-]*$/u.test(user.firstName)) {
      errors.firstName = 'First name must contain only letters';
    }

    if (user.lastName && !/^[\p{L}\p{M}\s\-]*$/u.test(user.lastName)) {
      errors.lastName = 'Last name must contain only letters';
    }

    if (!user.nickName || user.nickName.trim().length === 0) {
      errors.nickName = 'Nickname is required';
    } else if (user.nickName.length > 24) {
      errors.nickName = 'Nickname must be no more than 24 characters';
    }

    if (!user.username || user.username.trim().length === 0) {
      errors.username = 'Username is required';
    } else if (user.username.length < 3) {
      errors.username = 'Username must be at least 3 characters long';
    } else if (user.username.length > 16) {
      errors.username = 'Username must be no more than 16 characters';
    } else if (!/^(?=.*[a-zA-Z_])[a-zA-Z0-9_]*$/.test(user.username)) {
      errors.username = "Username must contain at least one letter or '_' and use only English letters/digits";
    }

    if (user.description && user.description.length > 160) {
      errors.description = 'Description must be no more than 160 characters';
    }

    if (user.phone && user.phone.trim().length > 0 && !/^(\+\d{9,14})?$/.test(user.phone.trim())) {
      errors.phone = "Phone must start with '+' and be 10-15 digits long";
    }

    if (!user.email || user.email.trim().length === 0) {
      errors.email = 'Email is required';
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user.email)) {
      errors.email = 'Invalid email format (e.g., user@mail.com)';
    }

    if (user.birthday) {
      const bDate = new Date(user.birthday);
      if (!isNaN(bDate.getTime())) {
        if (bDate > new Date()) {
          errors.birthday = 'Birthday cannot be in the future';
        } else if (bDate < new Date(1900, 0, 1)) {
          errors.birthday = 'Date is too old';
        }
      }
    }

    return errors;
  }
}

// =========================================================================
// 6. ПАРСИНГ ПРИВАТНОСТИ
// =========================================================================

export function parsePrivacyVisibility(val: any): PrivacyVisibility {
  if (val === undefined || val === null) return PrivacyVisibility.Everybody;

  if (typeof val === 'number') {
    if (isNaN(val)) return PrivacyVisibility.Everybody;
    if (val === 1) return PrivacyVisibility.MyContacts;
    if (val === 2) return PrivacyVisibility.Nobody;
    return PrivacyVisibility.Everybody;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    const num = parseInt(trimmed, 10);
    if (!isNaN(num)) {
      if (num === 1) return PrivacyVisibility.MyContacts;
      if (num === 2) return PrivacyVisibility.Nobody;
      return PrivacyVisibility.Everybody;
    }

    const lower = trimmed.toLowerCase();
    if (lower.startsWith('mycontact')) return PrivacyVisibility.MyContacts;
    if (lower === 'nobody') return PrivacyVisibility.Nobody;
    return PrivacyVisibility.Everybody;
  }

  return PrivacyVisibility.Everybody;
}

// =========================================================================
// 7. ОПРОС ОБОРУДОВАНИЯ СИСТЕМЫ (WebRTC MediaDevices API)
// =========================================================================

export interface MediaDeviceList {
  cameras: string[];
  microphones: string[];
  speakers: string[];
}

export async function getHardwareDevices(): Promise<MediaDeviceList> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return {
      cameras: ['Default Camera'],
      microphones: ['Default Microphone'],
      speakers: ['Default Speakers'],
    };
  }

  try {
    let devices = await navigator.mediaDevices.enumerateDevices();

    const hasLabels = devices.some((d) => d.label && d.label.trim().length > 0);
    if (!hasLabels && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        stream.getTracks().forEach((track) => track.stop());
        devices = await navigator.mediaDevices.enumerateDevices();
      } catch {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStream.getTracks().forEach((track) => track.stop());
          devices = await navigator.mediaDevices.enumerateDevices();
        } catch {}
      }
    }

    const cameras: string[] = [];
    const microphones: string[] = [];
    const speakers: string[] = [];

    let camIdx = 1;
    let micIdx = 1;
    let spkIdx = 1;

    for (const d of devices) {
      if (d.kind === 'videoinput') {
        const name = d.label && d.label.trim() ? d.label : `Camera ${camIdx++}`;
        if (!cameras.includes(name)) cameras.push(name);
      } else if (d.kind === 'audioinput') {
        const name = d.label && d.label.trim() ? d.label : `Microphone ${micIdx++}`;
        if (!microphones.includes(name)) microphones.push(name);
      } else if (d.kind === 'audiooutput') {
        const name = d.label && d.label.trim() ? d.label : `Speaker ${spkIdx++}`;
        if (!speakers.includes(name)) speakers.push(name);
      }
    }

    return {
      cameras: cameras.length > 0 ? cameras : ['Default Camera'],
      microphones: microphones.length > 0 ? microphones : ['Default Microphone'],
      speakers: speakers.length > 0 ? speakers : ['Default Speakers', 'Headphones'],
    };
  } catch (err) {
    console.warn('[Hardware] Ошибка опроса реальных устройств:', err);
    return {
      cameras: ['Default Camera'],
      microphones: ['Default Microphone'],
      speakers: ['Default Speakers'],
    };
  }
}