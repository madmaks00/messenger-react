import { apiClient } from './apiClient';
import { userSession } from './userSession';
import { AuthResult, AuthResponseDto } from '../types/dtos';
import { IUser } from '../types/models';
import { createRegistrationPayload, getAuthErrorMessage } from './auth-contract';

export interface IAuthService {
  loginAsync(username: string, password: string): Promise<AuthResult>;
  requestVerificationCodeAsync(email: string, username: string): Promise<{ isSuccess: boolean; message: string }>;
  registerAsync(user: Partial<IUser>, verificationCode: string): Promise<AuthResult>;
  logoutAsync(): Promise<boolean>;
  validateTokenAsync(): Promise<boolean>;
  logout(): void;
}

export class AuthService implements IAuthService {
  public async loginAsync(username: string, password: string): Promise<AuthResult> {
    try {
      console.info(`=== ВХОД ДЛЯ '${username}' ===`);
      const payload = { username, password };
      const response = await apiClient.post<AuthResponseDto>('api/Auth/login', payload);

      return this.handleAuthResponse(response.data);
    } catch (ex: any) {
      return { isSuccess: false, message: getAuthErrorMessage(ex, 'Ошибка авторизации') };
    }
  }

  public async requestVerificationCodeAsync(
    email: string,
    username: string
  ): Promise<{ isSuccess: boolean; message: string }> {
    try {
      console.info(`[HTTP_AUTH] POST api/Auth/send-verification-code (Email: ${email}, User: ${username})`);
      const payload = { email, username };
      const response = await apiClient.post('api/Auth/send-verification-code', payload);

      if (response.status >= 200 && response.status < 300) {
        return { isSuccess: true, message: '' };
      }
      return { isSuccess: false, message: getAuthErrorMessage(response.data, 'Не удалось отправить проверочный код') };
    } catch (ex: any) {
      return { isSuccess: false, message: getAuthErrorMessage(ex, 'Не удалось отправить проверочный код') };
    }
  }

  public async registerAsync(user: Partial<IUser>, verificationCode: string): Promise<AuthResult> {
    try {
      const payload = createRegistrationPayload(user, verificationCode);

      console.info(`[HTTP_AUTH] POST api/Auth/register для User='${user.username}', Email='${user.email}'`);
      const response = await apiClient.post<AuthResponseDto>('api/Auth/register', payload);

      return this.handleAuthResponse(response.data);
    } catch (ex: any) {
      return { isSuccess: false, message: getAuthErrorMessage(ex, 'Ошибка регистрации') };
    }
  }

  private handleAuthResponse(authDto: AuthResponseDto): AuthResult {
    if (!authDto?.user || !authDto.token) {
      console.error('[AuthService] Неполный ответ AuthResponseDto.');
      return { isSuccess: false, message: 'Ошибка данных пользователя' };
    }

    authDto.user.token = authDto.token;
    console.info(`[AuthService] Успешная авторизация. User ID: ${authDto.user.id}`);

    return {
      isSuccess: true,
      token: authDto.token,
      user: authDto.user,
    };
  }

  public async logoutAsync(): Promise<boolean> {
    try {
      const response = await apiClient.post('api/User/logout');
      return response.status >= 200 && response.status < 300;
    } catch (ex) {
      console.error('[AuthService ERROR] Сбой запроса logout на сервере:', ex);
      return false;
    }
  }

  public async validateTokenAsync(): Promise<boolean> {
    try {
      const response = await apiClient.get('api/Test/secret');
      return response.status >= 200 && response.status < 300;
    } catch (ex: any) {
      const status = ex.response?.status;
      if (status === 401 || status === 403) return false;
      throw ex;
    }
  }

  public logout(): void {
    console.info('[AuthService] Выход из сессии, очистка токена и состояния.');
    userSession.clear();
  }
}

export const authService = new AuthService();