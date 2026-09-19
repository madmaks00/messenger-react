class UserSessionService {
  private _userId: number = 0;
  private _token: string | null = null;

  constructor() {
    // Восстанавливаем сохраненную сессию при старте
    const saved = localStorage.getItem('user_session_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this._userId = data.userId || 0;
        this._token = data.token || null;
      } catch {}
    }
  }

  get userId(): number {
    return this._userId;
  }

  get token(): string | null {
    return this._token;
  }

  get isAuthenticated(): boolean {
    return this._userId > 0 && Boolean(this._token);
  }

  setSession(userId: number, token: string | null) {
    this._userId = userId;
    this._token = token;
    localStorage.setItem('user_session_data', JSON.stringify({ userId, token }));
  }

  clear() {
    this._userId = 0;
    this._token = null;
    localStorage.removeItem('user_session_data');
  }
}

export const userSession = new UserSessionService();