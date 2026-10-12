import { normalizeAvatarUrl } from './helpers';

/** SignalR JSON uses base64; MessagePack delivers a byte array. */
export function normalizeCallAvatar(value: unknown): string | null {
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    if (/^(data:image\/|https?:\/\/|blob:)/i.test(text)) return text;
    if (/^(\/9j\/|iVBORw|R0lGOD|UklGR)/.test(text)) {
      const mime = text.startsWith('iVBORw') ? 'png' : text.startsWith('R0lGOD') ? 'gif' : text.startsWith('UklGR') ? 'webp' : 'jpeg';
      return `data:image/${mime};base64,${text}`;
    }
    return normalizeAvatarUrl(text);
  }
  let bytes: Uint8Array | null = null;
  if (ArrayBuffer.isView(value)) bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
  else if (Array.isArray(value) && value.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) bytes = new Uint8Array(value);
  if (!bytes?.length) return null;
  const mime = bytes[0] === 137 && bytes[1] === 80 ? 'png'
    : bytes[0] === 71 && bytes[1] === 73 ? 'gif'
    : bytes[0] === 82 && bytes[1] === 73 ? 'webp' : 'jpeg';
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return `data:image/${mime};base64,${btoa(binary)}`;
}
