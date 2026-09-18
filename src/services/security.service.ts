// Хелпер вычисления SHA-256 через нативный браузерный Web Crypto API
async function computeSha256(data: string): Promise<string> {
  const buffer = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const PASSCODE_HASH_KEY = 'app_passcode_hash';

export class SecurityService {
  public static isPasscodeSet(): boolean {
    return Boolean(localStorage.getItem(PASSCODE_HASH_KEY));
  }

  public static async setPasscode(passcode: string | null): Promise<void> {
    if (!passcode) {
      localStorage.removeItem(PASSCODE_HASH_KEY);
    } else {
      const hash = await computeSha256(passcode);
      localStorage.setItem(PASSCODE_HASH_KEY, hash);
    }
  }

  public static async verifyPasscode(passcode: string): Promise<boolean> {
    if (!passcode) return false;
    const storedHash = localStorage.getItem(PASSCODE_HASH_KEY);
    if (!storedHash) return false;

    const inputHash = await computeSha256(passcode);
    return inputHash === storedHash;
  }
}