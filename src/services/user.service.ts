import { apiClient } from './apiClient';
import { IUser, IUserSearchResult, IMessage } from '../types/models';
import { DeviceSessionDto, PrivacySettingsDto, ResolvedEntityResponseDto, ResolvedEntityResult } from '../types/dtos';

export interface IUserService {
  searchUsersAsync(query: string): Promise<IUserSearchResult[]>;
  getUserProfileByUsernameAsync(username: string): Promise<IUser | null>;
  getUserProfileAsync(userId: number): Promise<IUser | null>;
  resolveUsernameAsync(username: string): Promise<ResolvedEntityResult | null>;
  toggleBlockUserAsync(targetUserId: number): Promise<boolean | null>;
  getPrivacySettingsAsync(): Promise<PrivacySettingsDto | null>;
  savePrivacySettingsAsync(settings: PrivacySettingsDto): Promise<boolean>;
  getBlacklistAsync(): Promise<IUser[] | null>;
  getDevicesAsync(): Promise<DeviceSessionDto[] | null>;
  terminateDeviceSessionAsync(deviceId: number): Promise<boolean>;
  terminateOtherSessionsAsync(): Promise<boolean>;
  verifyPasswordAsync(password: string): Promise<boolean>;
  changePasswordAsync(newPassword: string): Promise<boolean>;
  updateProfileAsync(editUser: IUser): Promise<IUser | null>;
  getBlockStatusAsync(targetUserId: number): Promise<{ blockedByMe: boolean; blockedByThem: boolean } | null>;
  getCachedUserName(userId: number, fallback?: string): string;
  getCachedUserAvatar(userId: number): string | null;
  enrichMessagesWithSendersAsync(messages: IMessage[], currentUserId: number): Promise<void>;
  enrichForwardedMessagesAsync(messages: IMessage[], currentUserId: number, currentChatAvatarPath?: string | null, currentChatId?: number | null): Promise<void>;
  cacheUserProfile(user: IUser): void;
  invalidateUserCache(userId: number): void;
  clearUserCache(): void;
}

export class UserService implements IUserService {
  // Централизованный кэш профилей (аналог ConcurrentDictionary<int, User> в C#)
  private readonly userCache = new Map<number, IUser>();

  public async searchUsersAsync(query: string): Promise<IUserSearchResult[]> {
    if (!query || query.trim().length < 3) return [];

    try {
      const response = await apiClient.get<IUserSearchResult[]>(
        `api/User/search?query=${encodeURIComponent(query)}`
      );
      return response.data || [];
    } catch (ex) {
      console.error('[UserService ERROR] Ошибка поиска пользователей:', ex);
      return [];
    }
  }

  public cacheUserProfile(user: IUser): void {
    if (user && user.id > 0) {
      this.userCache.set(user.id, user);
    }
  }

  public async getUserProfileByUsernameAsync(username: string): Promise<IUser | null> {
    try {
      const clean = username.replace(/^@/, '');
      const response = await apiClient.get<IUser>(`api/User/by-username/${clean}`);
      const user = response.data;
      if (user && user.id > 0) {
        this.cacheUserProfile(user);
        return user;
      }
    } catch (ex) {
      console.error(`[UserService ERROR] Ошибка получения профиля @${username}:`, ex);
    }
    return null;
  }

  public async getUserProfileAsync(userId: number): Promise<IUser | null> {
    if (userId <= 0) return null;

    if (this.userCache.has(userId)) {
      return this.userCache.get(userId)!;
    }

    try {
      const response = await apiClient.get<IUser>(`api/User/${userId}`);
      const user = response.data;
      if (user) {
        this.cacheUserProfile(user);
        return user;
      }
    } catch (ex) {
      console.error(`[UserService ERROR] Ошибка получения профиля ID ${userId}:`, ex);
    }
    return null;
  }

  public getCachedUserName(userId: number, fallback: string = 'User'): string {
    const u = this.userCache.get(userId);
    if (u) {
      return u.nickName || u.username || fallback;
    }
    return `${fallback} ${userId}`;
  }

  public getCachedUserAvatar(userId: number): string | null {
    const u = this.userCache.get(userId);
    return u?.avatarPath || u?.avatar || null;
  }

  public async enrichMessagesWithSendersAsync(messages: IMessage[], currentUserId: number): Promise<void> {
    const unknownIds = Array.from(
      new Set(
        messages
          .filter((m) => Boolean(m.groupId) && m.senderId !== currentUserId && !this.userCache.has(m.senderId))
          .map((m) => m.senderId)
      )
    );

    if (unknownIds.length > 0) {
      await Promise.all(unknownIds.map((id) => this.getUserProfileAsync(id)));
    }

    for (const m of messages) {
      if (m.groupId && m.senderId !== currentUserId) {
        const u = this.userCache.get(m.senderId);
        if (u) {
          m.senderName = u.nickName || u.username;
          m.senderAvatar = u.avatarPath || u.avatar || null;
        } else {
          m.senderName = `User ${m.senderId}`;
        }
      }
    }
  }

  public async enrichForwardedMessagesAsync(
    messages: IMessage[],
    currentUserId: number,
    currentChatAvatarPath?: string | null,
    currentChatId?: number | null
  ): Promise<void> {
    const unknownIds = Array.from(
      new Set(
        messages
          .filter(
            (m) =>
              Boolean(m.forwardedFromName) &&
              Boolean(m.forwardedFromUserId) &&
              m.forwardedFromUserId !== currentUserId &&
              (!currentChatAvatarPath || m.forwardedFromUserId !== currentChatId) &&
              !this.userCache.has(m.forwardedFromUserId!)
          )
          .map((m) => m.forwardedFromUserId!)
      )
    );

    if (unknownIds.length > 0) {
      await Promise.all(unknownIds.map((id) => this.getUserProfileAsync(id)));
    }

    for (const m of messages) {
      if (m.forwardedFromName && m.forwardedFromUserId) {
        const fId = m.forwardedFromUserId;
        if (fId === currentUserId) {
          const me = this.userCache.get(currentUserId);
          m.forwardedFromAvatar = me?.avatarPath || me?.avatar || null;
        } else if (currentChatId && fId === currentChatId && currentChatAvatarPath) {
          m.forwardedFromAvatar = currentChatAvatarPath;
        } else {
          const u = this.userCache.get(fId);
          if (u) {
            m.forwardedFromAvatar = u.avatarPath || u.avatar || null;
          }
        }
      }
    }
  }

  public invalidateUserCache(userId: number): void {
    this.userCache.delete(userId);
  }

  public clearUserCache(): void {
    this.userCache.clear();
  }

  public async resolveUsernameAsync(username: string): Promise<ResolvedEntityResult | null> {
    try {
      const response = await apiClient.get<ResolvedEntityResponseDto>(
        `api/User/resolve/${encodeURIComponent(username)}`
      );
      const res = response.data;
      if (!res) return null;

      return {
        type: res.type,
        id: res.data.id,
        username: res.data.username,
        nickName: res.data.nickName,
        avatar: res.data.avatar,
        isGroup: res.data.isGroup,
        isChannel: res.data.isChannel,
        adminId: res.data.adminId,
      };
    } catch (ex) {
      console.error(`[UserService ERROR] Сбой резолва @${username}:`, ex);
      return null;
    }
  }

  public async toggleBlockUserAsync(targetUserId: number): Promise<boolean | null> {
    try {
      const response = await apiClient.post(`api/User/toggle-block/${targetUserId}`);
      if (response.status >= 200 && response.status < 300) {
        if (typeof response.data === 'boolean') return response.data;
        if (typeof response.data === 'object' && response.data !== null) {
          for (const key of Object.keys(response.data)) {
            if (typeof response.data[key] === 'boolean') return response.data[key];
          }
        }
        return true;
      }
    } catch (ex) {
      console.error(`[UserService ERROR] Сбой блокировки ID ${targetUserId}:`, ex);
    }
    return null;
  }

  public async getBlockStatusAsync(
    targetUserId: number
  ): Promise<{ blockedByMe: boolean; blockedByThem: boolean } | null> {
    try {
      const response = await apiClient.get<{ blockedByMe: boolean; blockedByThem: boolean }>(
        `api/User/block-status/${targetUserId}`
      );
      return response.data;
    } catch (ex) {
      console.error(`[UserService ERROR] Сбой запроса статуса блокировки ID ${targetUserId}:`, ex);
      return null;
    }
  }

  public async getPrivacySettingsAsync(): Promise<PrivacySettingsDto | null> {
    try {
      const response = await apiClient.get<PrivacySettingsDto>('api/User/privacy');
      return response.data;
    } catch (ex) {
      console.error('[UserService ERROR] Сбой получения настроек приватности:', ex);
      return null;
    }
  }

  public async savePrivacySettingsAsync(settings: PrivacySettingsDto): Promise<boolean> {
    try {
      const response = await apiClient.post('api/User/privacy', settings);
      return response.status >= 200 && response.status < 300;
    } catch (ex) {
      console.error('[UserService ERROR] Сбой сохранения настроек приватности:', ex);
      return false;
    }
  }

  public async getBlacklistAsync(): Promise<IUser[] | null> {
    try {
      const response = await apiClient.get<IUser[]>('api/User/blacklist');
      return response.data;
    } catch (ex) {
      console.error('[UserService ERROR] Сбой загрузки черного списка:', ex);
      return null;
    }
  }

  public async getDevicesAsync(): Promise<DeviceSessionDto[] | null> {
    try {
      const response = await apiClient.get<DeviceSessionDto[]>('api/User/devices');
      return response.data;
    } catch (ex) {
      console.error('[UserService ERROR] Сбой загрузки сессий:', ex);
      return null;
    }
  }

  public async terminateDeviceSessionAsync(deviceId: number): Promise<boolean> {
    try {
      const response = await apiClient.delete(`api/User/devices/${deviceId}`);
      return response.status >= 200 && response.status < 300;
    } catch (ex) {
      console.error(`[UserService ERROR] Сбой завершения сессии ${deviceId}:`, ex);
      return false;
    }
  }

  public async terminateOtherSessionsAsync(): Promise<boolean> {
    try {
      const response = await apiClient.delete('api/User/devices/terminate-others');
      return response.status >= 200 && response.status < 300;
    } catch (ex) {
      console.error('[UserService ERROR] Сбой завершения остальных сессий:', ex);
      return false;
    }
  }

  public async verifyPasswordAsync(password: string): Promise<boolean> {
    try {
      const response = await apiClient.post('api/User/verify-password', { password });
      return response.status >= 200 && response.status < 300;
    } catch (ex) {
      console.error('[UserService ERROR] Сбой проверки пароля:', ex);
      return false;
    }
  }

  public async changePasswordAsync(newPassword: string): Promise<boolean> {
    try {
      const response = await apiClient.post('api/User/change-password', { newPassword });
      return response.status >= 200 && response.status < 300;
    } catch (ex) {
      console.error('[UserService ERROR] Сбой смены пароля:', ex);
      return false;
    }
  }

  public async updateProfileAsync(editUser: IUser): Promise<IUser | null> {
    try {
      const response = await apiClient.put<IUser>('api/User/update', editUser);
      const updated = response.data || editUser;
      this.cacheUserProfile(updated);
      return updated;
    } catch (ex) {
      console.error('[UserService ERROR] Сбой обновления профиля:', ex);
      return null;
    }
  }
}

export const userService = new UserService();