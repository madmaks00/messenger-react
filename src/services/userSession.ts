export interface IUserSession {
  readonly userId: number;
  readonly token: string | null;
  readonly isAuthenticated: boolean;
  getSnapshot(): { userId: number; token: string | null };
  setSession(userId: number, token?: string | null): void;
  clear(): void;
}

interface SessionData {
  userId: number;
  token: string | null;
}

const STORAGE_KEY = 'messenger_user_session';

export class UserSession implements IUserSession {
  private _data: SessionData = { userId: 0, token: null };

  constructor() {
    this.loadFromStorage();
  }

  public get userId(): number {
    return this._data.userId;
  }

  public get token(): string | null {
    return this._data.token;
  }

  // Аналог: _data is { UserId: > 0, Token.Length: > 0 }
  public get isAuthenticated(): boolean {
    return this._data.userId > 0 && Boolean(this._data.token && this._data.token.length > 0);
  }

  public getSnapshot(): { userId: number; token: string | null } {
    return { ...this._data };
  }

  public setSession(userId: number, token?: string | null): void {
    this._data = {
      userId,
      token: token ?? null,
    };
    this.saveToStorage();
  }

  public clear(): void {
    this._data = { userId: 0, token: null };
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('[UserSession] Ошибка очистки localStorage:', err);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    } catch (err) {
      console.error('[UserSession] Ошибка сохранения сессии в localStorage:', err);
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.userId === 'number') {
          this._data = {
            userId: parsed.userId,
            token: parsed.token ?? null,
          };
        }
      }
    } catch (err) {
      console.error('[UserSession] Ошибка загрузки сессии из localStorage:', err);
    }
  }
}

// Экземпляр-синглтон, который импортируется в хранилища и сервисы
export const userSession = new UserSession();