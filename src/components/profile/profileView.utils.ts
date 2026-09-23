import { AttachmentType, Gender, PrivacyVisibility } from '../../types/enums';
import {
  IAttachment,
  IMessage,
  ISharedMediaGroup,
  ISharedMessageGroup,
  IUser,
} from '../../types/models';

// =========================================================================
// 1. БЕЗОПАСНАЯ НОРМАЛИЗАЦИЯ ИЗОБРАЖЕНИЙ (ФИКС ОШИБКИ 431)
// =========================================================================

export function normalizeImageSrc(src?: string | null): string {
  if (!src || typeof src !== 'string') return '';
  const trimmed = src.trim();
  if (!trimmed) return '';

  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  if (
    trimmed.startsWith('iVBORw0KGgo') ||
    trimmed.startsWith('/9j/') ||
    trimmed.startsWith('R0lGOD') ||
    trimmed.startsWith('UklGR') ||
    trimmed.length > 100
  ) {
    let mime = 'image/png';
    if (trimmed.startsWith('/9j/')) mime = 'image/jpeg';
    else if (trimmed.startsWith('R0lGOD')) mime = 'image/gif';
    else if (trimmed.startsWith('UklGR')) mime = 'image/webp';
    return `data:${mime};base64,${trimmed}`;
  }

  return trimmed;
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
// 3. ФОРМАТИРОВАНИЕ ДАТ И ТЕЛЕФОНА (PhoneNumberFormatConverter & Helpers)
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
// 4. ФИЛЬТРАЦИЯ И ГРУППИРОВКА ОБЩИХ МЕДИА (OtherProfileViewModel.cs)
// =========================================================================

export function isGifAttachment(a: IAttachment): boolean {
  if (!a) return false;
  if (a.fileSizeStr === 'GIF') return true;
  if (a.fileName && a.fileName.toLowerCase().endsWith('.gif')) return true;
  if (a.type === AttachmentType.Video && !a.hasAudio) return true;
  return false;
}

export function matchesSharedCategory(a: IAttachment, category: string): boolean {
  switch (category) {
    case 'Photos':
      return a.type === AttachmentType.Photo && !isGifAttachment(a);
    case 'Videos':
      return a.type === AttachmentType.Video && !isGifAttachment(a);
    case 'GIFs':
      return isGifAttachment(a);
    case 'Audios':
      return a.type === AttachmentType.Audio;
    case 'Voice':
      return a.type === AttachmentType.Voice;
    default:
      return a.type === AttachmentType.Document;
  }
}

export function groupAttachmentsByMonth(
  attachments: IAttachment[],
  currentUserId: number,
  myName: string,
  targetName: string
): ISharedMediaGroup[] {
  const groupsMap = new Map<string, { date: Date; items: IAttachment[] }>();

  for (const att of attachments) {
    const rawTime = (att as any).message?.timestamp || att.url || Date.now();
    const date = new Date(rawTime);
    const validDate = isNaN(date.getTime()) ? new Date() : date;
    const groupKey = `${validDate.getFullYear()}-${validDate.getMonth()}`;

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, { date: validDate, items: [] });
    }

    if ((att as any).message) {
      (att as any).message.isMyMessage = (att as any).message.senderId === currentUserId;
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
  const groupsMap = new Map<string, { date: Date; items: IMessage[] }>();

  for (const rawMsg of messages) {
    const isMyMessage = rawMsg.senderId === currentUserId;
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
// 5. ВАЛИДАЦИЯ ПРОФИЛЯ (1:1 User.cs -> ValidateForEditProfile())
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
// 6. НАДЁЖНЫЙ ПАРСИНГ ПРИВАТНОСТИ
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
// 7. РЕАЛЬНЫЙ ОПРОС ОБОРУДОВАНИЯ СИСТЕМЫ (WebRTC MediaDevices API)
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

    // Если браузер скрыл лейблы до запроса разрешений, кратковременно запрашиваем доступ
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
        } catch {
          // Игнорируем отказ пользователя
        }
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