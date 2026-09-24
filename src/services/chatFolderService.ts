import { apiClient } from './apiClient';
import { IChatFolder } from '../types/models';
import { ChatFolderCreateDto, ChatFolderOrderDto } from '../types/dtos';

export interface IChatFolderService {
  getFoldersAsync(): Promise<IChatFolder[] | null>;
  saveFoldersOrderAsync(orderPayload: ChatFolderOrderDto[]): Promise<boolean>;
  createFolderAsync(dto: ChatFolderCreateDto): Promise<IChatFolder | null>;
  updateFolderAsync(folderId: number, dto: ChatFolderCreateDto): Promise<IChatFolder | null>;
  deleteFolderAsync(folderId: number): Promise<boolean>;
  toggleChatInFolderAsync(
    folderId: number,
    targetUserId?: number | null,
    targetGroupId?: number | null
  ): Promise<boolean | null>;
}

export class ChatFolderService implements IChatFolderService {
  public async getFoldersAsync(): Promise<IChatFolder[] | null> {
    try {
      const response = await apiClient.get<IChatFolder[]>('api/ChatFolders');
      if (response.status === 200 && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('[ChatFolderService ERROR] Сбой загрузки папок чатов:', error);
      return null;
    }
  }

  public async saveFoldersOrderAsync(orderPayload: ChatFolderOrderDto[]): Promise<boolean> {
    try {
      const response = await apiClient.put('api/ChatFolders/order', orderPayload);
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      console.error('[ChatFolderService ERROR] Сбой сохранения порядка папок:', error);
      return false;
    }
  }

  public async createFolderAsync(dto: ChatFolderCreateDto): Promise<IChatFolder | null> {
    try {
      const response = await apiClient.post<IChatFolder>('api/ChatFolders', dto);
      if (response.status >= 200 && response.status < 300 && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('[ChatFolderService ERROR] Сбой создания папки чатов:', error);
      return null;
    }
  }

  public async updateFolderAsync(folderId: number, dto: ChatFolderCreateDto): Promise<IChatFolder | null> {
    try {
      const response = await apiClient.put<IChatFolder>(`api/ChatFolders/${folderId}`, dto);
      if (response.status >= 200 && response.status < 300 && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error(`[ChatFolderService ERROR] Сбой обновления папки ${folderId}:`, error);
      return null;
    }
  }

  public async deleteFolderAsync(folderId: number): Promise<boolean> {
    try {
      const response = await apiClient.delete(`api/ChatFolders/${folderId}`);
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      console.error(`[ChatFolderService ERROR] Сбой удаления папки ${folderId}:`, error);
      return false;
    }
  }

  public async toggleChatInFolderAsync(
    folderId: number,
    targetUserId?: number | null,
    targetGroupId?: number | null
  ): Promise<boolean | null> {
    try {
      const payload = {
        FolderId: folderId,
        TargetUserId: targetUserId ?? null,
        TargetGroupId: targetGroupId ?? null,
      };

      const response = await apiClient.post('api/ChatFolders/toggle-chat', payload);
      if (response.status >= 200 && response.status < 300) {
        const data = response.data;
        if (typeof data === 'boolean') {
          return data;
        }
        if (data && typeof data === 'object') {
          for (const key of Object.keys(data)) {
            if (data[key] === true) return true;
            if (data[key] === false) return false;
          }
        }
        return true;
      }
      return null;
    } catch (error) {
      console.error(`[ChatFolderService ERROR] Ошибка ToggleChatInFolderAsync для FolderId=${folderId}:`, error);
      return null;
    }
  }
}

export const chatFolderService = new ChatFolderService();