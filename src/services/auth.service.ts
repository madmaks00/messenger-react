import { apiClient } from './apiClient';
import { userSession } from './userSession';
import { AuthResult, AuthResponseDto } from '../types/dtos';
import { IUser } from '../types/models';

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
      console.error('[AuthService ERROR] Ошибка при входе:', ex);
      const errMsg = ex.response?.data?.message || ex.response?.data || ex.message || 'Ошибка авторизации';
      return { isSuccess: false, message: String(errMsg) };
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
      return { isSuccess: false, message: String(response.data) };
    } catch (ex: any) {
      console.error('[HTTP_AUTH ERROR] Исключение при запросе кода:', ex);
      const err = ex.response?.data || ex.message || 'Не удалось отправить проверочный код';
      return { isSuccess: false, message: String(err) };
    }
  }

  public async registerAsync(user: Partial<IUser>, verificationCode: string): Promise<AuthResult> {
    try {
      const payload = {
        username: user.username,
        password: user.password,
        email: user.email,
        verificationCode,
        nickName: user.nickName,
        firstName: user.firstName,
        lastName: user.lastName,
        description: user.description,
        phone: user.phone,
        avatar: user.avatar,
        gender: user.gender,
        birthday: user.birthday,
      };

      console.info(`[HTTP_AUTH] POST api/Auth/register для User='${user.username}', Email='${user.email}'`);
      const response = await apiClient.post<AuthResponseDto>('api/Auth/register', payload);

      return this.handleAuthResponse(response.data);
    } catch (ex: any) {
      console.error('[HTTP_AUTH ERROR] Исключение при вызове register:', ex);
      const err = ex.response?.data?.message || ex.response?.data || ex.message || 'Ошибка регистрации';
      return { isSuccess: false, message: String(err) };
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
    } catch (ex) {
      console.error('[AuthService ERROR] Сбой проверки валидности токена:', ex);
      return false;
    }
  }

  public logout(): void {
    console.info('[AuthService] Выход из сессии, очистка токена и состояния.');
    userSession.clear();
  }
}

export const authService = new AuthService();