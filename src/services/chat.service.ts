import { apiClient, BASE_SERVER_URL } from './apiClient';
import { getLocalDatabase } from '../db/localDb';
import { userSession } from './userSession';
import { eventBus } from './eventBus';
import { UrlHelper } from '../utils/helpers';
import {
  IMessage,
  IAttachment,
  IChatListItem,
  ICachedSecretChat,
  ICachedGroupDetail,
  ICachedBlockStatus,
  MessageHelper,
} from '../types/models';
import { AttachmentDto, ChunkUploadStatusDto } from '../types/dtos';
import { AttachmentType } from '../types/enums';
import { mediaDimensionsCache } from '../utils/mediaDimensionsCache';
const CHUNK_SIZE = 512 * 1024;
const LINK_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(t\.me\/[^\s]+)|(\/[a-zA-Z0-9_\-]{3,})/i;

async function computeSha256(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const buffer: BufferSource = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : (data as unknown as BufferSource);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface IChatService {
  syncDeltaAsync(userId: number): Promise<number>;
  syncUnsentMessagesAsync(signalRHub: any): Promise<number>;
  markAsSentAsync(localId: number, serverId: number, videoUrl?: string | null, text?: string | null): Promise<void>;
  syncGroupHistoryAsync(groupId: number, currentUserId: number): Promise<void>;
  getChatsAsync(): Promise<IChatListItem[]>;
  toggleMuteChatAsync(targetUserId?: number | null, targetGroupId?: number | null): Promise<boolean | null>;
  togglePinChatAsync(targetUserId?: number | null, targetGroupId?: number | null): Promise<boolean | null>;
  clearChatHistoryAsync(targetUserId?: number | null, targetGroupId?: number | null, deleteForAll?: boolean): Promise<boolean>;
  getGroupHistoryAsync(groupId: number): Promise<IMessage[] | null>;
  uploadAttachmentsAsync(files: File[]): Promise<AttachmentDto[] | null>;
  downloadFileBytesAsync(fileUrl: string): Promise<ArrayBuffer | null>;
  savePermissionsAsync(groupId: number, canSendText: boolean, canSendMedia: boolean, canPinMessages: boolean): Promise<boolean>;
  searchMessagesAsync(query: string, groupId?: number | null, otherUserId?: number | null): Promise<IMessage[]>;
  getLocalMessagesAsync(currentUserId: number, targetUserId?: number | null, groupId?: number | null, secretChatId?: string | null, take?: number, beforeTimestamp?: string | null): Promise<IMessage[]>;
  getLocalPinnedMessagesAsync(currentUserId: number, targetUserId?: number | null, groupId?: number | null, secretChatId?: string | null): Promise<IMessage[]>;
  getMissingQuotedMessagesAsync(messageIds: number[]): Promise<IMessage[]>;
  getLocalMessageByIdAsync(messageId: number): Promise<IMessage | null>;
  searchLocalMessagesAsync(query: string, currentUserId: number, otherUserId?: number | null, groupId?: number | null, take?: number): Promise<IMessage[]>;
  markIncomingMessagesAsReadLocallyAsync(senderId: number, currentUserId: number): Promise<void>;
  saveMessageLocallyAsync(message: IMessage): Promise<void>;
  updateMessageLocallyAsync(localId: number, serverId: number, newText: string, attachments?: IAttachment[] | null, editedAt?: string | null): Promise<void>;
  deleteMessageLocallyAsync(localId: number, serverId: number, currentUserId: number, deleteForAll: boolean): Promise<void>;
  setMessagePinLocallyAsync(localId: number, serverId: number, isPinned: boolean): Promise<void>;
  markMessagesAsReadLocallyAsync(currentUserId: number, receiverId: number | null, maxReadServerId: number): Promise<void>;
  updateMessageViewsLocallyAsync(messageId: number, viewsCount: number): Promise<void>;
  getSharedMediaMessagesAsync(currentUserId: number, targetUserId: number): Promise<IMessage[]>;
  getSharedPinnedMessagesAsync(currentUserId: number, targetUserId: number): Promise<IMessage[]>;
  getSharedLinkMessagesAsync(currentUserId: number, targetUserId: number): Promise<IMessage[]>;
  getCachedSecretChatAsync(secretChatId: string): Promise<ICachedSecretChat | null>;
  getCachedSecretChatsAsync(): Promise<ICachedSecretChat[]>;
  saveCachedSecretChatAsync(chat: ICachedSecretChat): Promise<void>;
  removeCachedSecretChatByTargetUserAsync(targetUserId: number): Promise<void>;
  deleteSecretChatLocallyAsync(secretChatId: string): Promise<void>;
  getCachedGroupDetailAsync(groupId: number): Promise<ICachedGroupDetail | null>;
  saveCachedGroupDetailAsync(detail: ICachedGroupDetail): Promise<void>;
  getCachedBlockStatusAsync(targetUserId: number): Promise<ICachedBlockStatus | null>;
  saveCachedBlockStatusAsync(targetUserId: number, blockedByMe: boolean, blockedByThem: boolean): Promise<void>;
  getBlockedUserIdsAsync(): Promise<Set<number>>;
  getLastMessageForChatAsync(currentUserId: number, userId?: number | null, groupId?: number | null): Promise<IMessage | null>;
  deleteChatMessagesLocallyAsync(currentUserId: number, userId?: number | null, groupId?: number | null, deleteForAll?: boolean): Promise<void>;
  deleteSenderMessagesLocallyAsync(senderId: number, currentUserId: number): Promise<void>;
  markSecretMessagesAsReadLocallyAsync(secretChatId: string): Promise<void>;
}

export class ChatService implements IChatService {
  public async uploadAttachmentsAsync(files: File[]): Promise<AttachmentDto[] | null> {
    if (!files || files.length === 0) return null;

    try {
      const resultDtos: AttachmentDto[] = [];
      for (const file of files) {
        const dto = await this.uploadSingleFileChunkedAsync(file);
        if (dto) {
          resultDtos.push(dto);
        }
      }
      return resultDtos;
    } catch (ex) {
      console.error('[ChatService ERROR] Сбой чанковой загрузки файлов:', ex);
      return null;
    }
  }

  private async uploadSingleFileChunkedAsync(file: File): Promise<AttachmentDto | null> {
    const totalFileSize = file.size;
    const fileName = file.name;

    const fileBuffer = await file.arrayBuffer();
    const fileHash = await computeSha256(fileBuffer);

    let totalChunks = Math.ceil(totalFileSize / CHUNK_SIZE);
    if (totalChunks <= 0) totalChunks = 1;

    const uploadId = await computeSha256(`${fileHash}_${totalFileSize}_${totalChunks}`);

    const alreadyUploaded = new Set<number>();
    try {
      const statusUrl = `api/Messages/upload-status?uploadId=${uploadId}&fileHash=${fileHash}&totalChunks=${totalChunks}&fileName=${encodeURIComponent(fileName)}`;
      const statusRes = await apiClient.get<ChunkUploadStatusDto>(statusUrl);
      if (statusRes.status === 200 && statusRes.data) {
        if (statusRes.data.isCompleted && statusRes.data.attachment) {
          return statusRes.data.attachment;
        }
        if (statusRes.data.uploadedChunks) {
          statusRes.data.uploadedChunks.forEach((c) => alreadyUploaded.add(c));
        }
      }
    } catch {}

    let finalAttachment: AttachmentDto | null = null;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (alreadyUploaded.has(chunkIndex)) continue;

      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalFileSize);
      const chunkBlob = file.slice(start, end);

      const formData = new FormData();
      formData.append('UploadId', uploadId);
      formData.append('ChunkIndex', chunkIndex.toString());
      formData.append('TotalChunks', totalChunks.toString());
      formData.append('TotalFileSize', totalFileSize.toString());
      formData.append('FileHash', fileHash);
      formData.append('FileName', fileName);
      formData.append('chunk', chunkBlob, `${chunkIndex}.part`);

      const res = await apiClient.post<ChunkUploadStatusDto>('api/Messages/upload-chunk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.status >= 200 && res.status < 300 && res.data) {
        if (res.data.isCompleted && res.data.attachment) {
          finalAttachment = res.data.attachment;
          break;
        }
      } else {
        console.error(`[RESUMABLE ❌] Ошибка загрузки чанка ${chunkIndex + 1}/${totalChunks}`);
        return null;
      }
    }

    return finalAttachment;
  }

  // 🟢 ДЕЛЬТА-СИНХРОНИЗАЦИЯ С ЗАЩИТОЙ ОТ ДУБЛИРОВАНИЯ
  public async syncDeltaAsync(userId: number): Promise<number> {
    try {
      const db = getLocalDatabase(userId);

      let lastId = 0;
      try {
        const lastMsg = await db.messages.orderBy('serverId').last();
        lastId = lastMsg?.serverId || 0;
      } catch {
        const all = await db.messages.toArray();
        lastId = all.reduce((max, m) => Math.max(max, m.serverId || 0), 0);
      }

      const syncState = await db.syncStates.get('LastDeltaSyncUtc');
      let lastSyncUtcString = syncState?.value;
      if (!lastSyncUtcString) {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        lastSyncUtcString = d.toISOString();
      }

      const url = `api/Messages/delta?lastServerId=${lastId}&lastSyncTime=${encodeURIComponent(lastSyncUtcString)}`;
      const response = await apiClient.get<any[]>(url);
      const deltaMessages = response.data;

      if (!deltaMessages || deltaMessages.length === 0) return 0;

      let processedCount = 0;

      for (const msg of deltaMessages) {
        const serverId = msg.id || msg.serverId;

        if (msg.isDeleted) {
          await db.messages.where('serverId').equals(serverId).delete();
          processedCount++;
          continue;
        }

        const hasContent = Boolean(msg.text?.trim()) || (msg.attachments && msg.attachments.length > 0);
        if (!hasContent) continue;

        if (msg.deletedForUsers && msg.deletedForUsers.includes(`,${userId},`)) {
          continue;
        }

        const isMy = msg.senderId === userId;

        // 🟢 Ищем существующее сообщение по serverId
        let existing = await db.messages.where('serverId').equals(serverId).first();

        // 🟢 ЕСЛИ НЕ НАЙДЕНО ПО SERVER_ID — ИЩЕМ ОПТИМИСТИЧНОЕ СООБЩЕНИЕ (serverId = 0) С ТЕМ ЖЕ ТЕКСТОМ И ВРЕМЕНЕМ
        if (!existing && isMy) {
          const msgTime = new Date(msg.timestamp).getTime();
          existing = await db.messages
            .filter(
              (m) =>
                (!m.serverId || m.serverId === 0 || !m.isSentToServer) &&
                m.senderId === userId &&
                m.text === msg.text &&
                Math.abs(new Date(m.timestamp).getTime() - msgTime) < 15000
            )
            .first();
        }

        const formattedAttachments: IAttachment[] = (msg.attachments || []).map((a: any, idx: number) => {
  const existingAtt = existing?.attachments?.[idx];
  const cached = mediaDimensionsCache.get(a.url) || mediaDimensionsCache.get(a.fileName);

  // 🟢 Если сервер прислал 0, но клиент уже замерил картинку — сохраняем реальные пиксели!
  const resolvedWidth = a.width > 0 ? a.width : (existingAtt?.width && existingAtt.width > 0 ? existingAtt.width : (cached?.width || 0));
  const resolvedHeight = a.height > 0 ? a.height : (existingAtt?.height && existingAtt.height > 0 ? existingAtt.height : (cached?.height || 0));

  if (resolvedWidth > 0 && resolvedHeight > 0) {
    mediaDimensionsCache.set(a.url, { width: resolvedWidth, height: resolvedHeight });
    mediaDimensionsCache.set(a.fileName, { width: resolvedWidth, height: resolvedHeight });
  }

  return {
    id: idx + 1,
    messageId: existing?.id || 0,
    type: a.type as AttachmentType,
    fileName: a.fileName,
    fileSizeStr: a.fileSizeStr,
    fileSizeBytes: a.fileSizeBytes || 0,
    url: UrlHelper.normalize(a.url, BASE_SERVER_URL),
    thumbnailUrl: UrlHelper.normalize(a.thumbnailUrl, BASE_SERVER_URL),
    fileHash: a.fileHash,
    hasAudio: a.hasAudio,
    width: resolvedWidth,
    height: resolvedHeight,
    durationSeconds: a.durationSeconds,
    waveform: a.waveform,
  };
});

        if (existing && existing.id) {
          // Обновляем найденную оптимистичную запись, проставляя serverId (БЕЗ ДУБЛИРОВАНИЯ)
          await (db.messages.update as any)(existing.id, {
            serverId,
            isSentToServer: true,
            text: msg.text,
            isPinned: msg.isPinned,
            isRead: msg.isRead,
            replyToMessageIds: msg.replyToMessageIds,
            forwardedFromName: msg.forwardedFromName,
            forwardedFromAvatar: msg.forwardedFromAvatar,
            forwardedFromUserId: msg.forwardedFromUserId,
            editedAt: msg.editedAt ? new Date(msg.editedAt).toISOString() : null,
            attachments: formattedAttachments,
          });
          processedCount++;
        } else {
          await db.messages.add({
            serverId,
            senderId: msg.senderId,
            receiverId: msg.receiverId,
            groupId: msg.groupId,
            text: msg.text,
            timestamp: new Date(msg.timestamp).toISOString(),
            editedAt: msg.editedAt ? new Date(msg.editedAt).toISOString() : null,
            isSentToServer: true,
            isMyMessage: isMy,
            deletedForUsers: msg.deletedForUsers,
            isDeletedForMe: false,
            isDeleted: false,
            isRead: msg.isRead,
            isPinned: msg.isPinned,
            replyToMessageIds: msg.replyToMessageIds,
            forwardedFromName: msg.forwardedFromName,
            forwardedFromAvatar: msg.forwardedFromAvatar,
            forwardedFromUserId: msg.forwardedFromUserId,
            viewsCount: msg.viewsCount || 1,
            attachments: formattedAttachments,
          } as any);
          processedCount++;
        }
      }

      await db.syncStates.put({ key: 'LastDeltaSyncUtc', value: new Date().toISOString() });

      if (processedCount > 0) {
        eventBus.emit('ActiveChatRefreshRequestedMessage' as any, undefined);
      }

      return processedCount;
    } catch (ex) {
      console.error('[CLIENT DELTA_SYNC ERROR] Ошибка дельта-синхронизации:', ex);
      return 0;
    }
  }

  public async syncUnsentMessagesAsync(signalRHub: any): Promise<number> {
    const userId = userSession.userId;
    if (userId <= 0 || !signalRHub?.isConnected) return 0;

    const db = getLocalDatabase(userId);
    const unsent = await db.messages
      .filter((m) => !m.isSentToServer && m.isMyMessage)
      .toArray();

    if (unsent.length === 0) return 0;
    let sentCount = 0;

    for (const msg of unsent) {
      try {
        const attachmentDtos: AttachmentDto[] = (msg.attachments || []).map((a) => ({
          type: a.type,
          fileName: a.fileName,
          fileSizeStr: a.fileSizeStr,
          url: a.url,
          thumbnailUrl: a.thumbnailUrl,
          fileHash: a.fileHash,
          hasAudio: a.hasAudio,
          width: a.width,
          height: a.height,
          durationSeconds: a.durationSeconds,
          waveform: a.waveform,
        }));

        const realId = await signalRHub.sendMessageAsync(
          msg.receiverId,
          msg.groupId,
          msg.noteId,
          msg.text,
          msg.replyToMessageIds,
          msg.forwardedFromName,
          msg.forwardedFromAvatar,
          msg.forwardedFromUserId,
          attachmentDtos
        );

        if (realId > 0 && msg.id) {
          await (db.messages.update as any)(msg.id, { serverId: realId, isSentToServer: true });
          sentCount++;
        }
      } catch (ex) {
        console.error(`[UNSENT_SYNC] Ошибка отправки сообщения ${msg.id}:`, ex);
        break;
      }
    }

    return sentCount;
  }

  public async getChatsAsync(): Promise<IChatListItem[]> {
    try {
      const res = await apiClient.get<IChatListItem[]>(`api/Messages/chats?t=${Date.now()}`);
      return res.data || [];
    } catch (ex) {
      console.error('[ChatService ERROR] Ошибка загрузки списка чатов:', ex);
      return [];
    }
  }

  public async toggleMuteChatAsync(targetUserId?: number | null, targetGroupId?: number | null): Promise<boolean | null> {
    try {
      const res = await apiClient.post('api/Messages/toggle-mute', {
        TargetUserId: targetUserId,
        TargetGroupId: targetGroupId,
      });
      return typeof res.data === 'boolean' ? res.data : true;
    } catch (ex) {
      console.error('[ChatService ERROR] Ошибка toggleMuteChatAsync:', ex);
      return null;
    }
  }

  public async togglePinChatAsync(targetUserId?: number | null, targetGroupId?: number | null): Promise<boolean | null> {
    try {
      const res = await apiClient.post('api/Messages/toggle-pin', {
        TargetUserId: targetUserId,
        TargetGroupId: targetGroupId,
      });
      return typeof res.data === 'boolean' ? res.data : true;
    } catch (ex) {
      console.error('[ChatService ERROR] Ошибка togglePinChatAsync:', ex);
      return null;
    }
  }

  public async clearChatHistoryAsync(targetUserId?: number | null, targetGroupId?: number | null, deleteForAll: boolean = false): Promise<boolean> {
    try {
      const res = await apiClient.post('api/Messages/clear', {
        TargetUserId: targetUserId,
        TargetGroupId: targetGroupId,
        DeleteForAll: deleteForAll,
      });
      return res.status >= 200 && res.status < 300;
    } catch (ex) {
      console.error('[ChatService ERROR] Ошибка очистки истории чата:', ex);
      return false;
    }
  }

  public async getGroupHistoryAsync(groupId: number): Promise<IMessage[] | null> {
    try {
      const res = await apiClient.get<any[]>(`api/Messages/group-history/${groupId}`);
      if (!res.data) return null;

      return res.data.map((msg) => ({
        id: 0,
        serverId: msg.id,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        groupId: msg.groupId,
        isMyMessage: msg.senderId === userSession.userId,
        isSentToServer: true,
        text: msg.text,
        isRead: msg.isRead,
        timestamp: new Date(msg.timestamp).toISOString(),
        isDeleted: false,
        isDeletedForMe: false,
        replyToMessageIds: msg.replyToMessageIds,
        isPinned: msg.isPinned,
        forwardedFromName: msg.forwardedFromName,
        forwardedFromAvatar: msg.forwardedFromAvatar,
        forwardedFromUserId: msg.forwardedFromUserId,
        viewsCount: msg.viewsCount || 1,
        attachments: (msg.attachments || []).map((a: any, idx: number) => ({
          id: idx + 1,
          messageId: 0,
          type: a.type,
          fileName: a.fileName,
          fileSizeStr: a.fileSizeStr,
          fileSizeBytes: 0,
          url: UrlHelper.normalize(a.url, BASE_SERVER_URL),
          thumbnailUrl: UrlHelper.normalize(a.thumbnailUrl, BASE_SERVER_URL),
          fileHash: a.fileHash,
          hasAudio: a.hasAudio,
          width: a.width,
          height: a.height,
          durationSeconds: a.durationSeconds,
          waveform: a.waveform,
        })),
      }));
    } catch (ex) {
      console.error(`[ChatService ERROR] Ошибка получения истории группы ${groupId}:`, ex);
      return null;
    }
  }

  public async syncGroupHistoryAsync(groupId: number, currentUserId: number): Promise<void> {
    const msgs = await this.getGroupHistoryAsync(groupId);
    if (!msgs || msgs.length === 0) return;

    const db = getLocalDatabase(currentUserId);
    const existingServerIds = new Set(
      (await db.messages.where('groupId').equals(groupId).toArray()).map((m) => m.serverId)
    );

    for (const msg of msgs) {
      if (!existingServerIds.has(msg.serverId)) {
        await db.messages.add(msg);
      }
    }
  }

  public async searchMessagesAsync(query: string, groupId?: number | null, otherUserId?: number | null): Promise<IMessage[]> {
    if (!query || query.trim().length === 0) return [];

    try {
      let url = `api/Messages/search-messages?query=${encodeURIComponent(query)}`;
      if (groupId) url += `&groupId=${groupId}`;
      if (otherUserId) url += `&otherUserId=${otherUserId}`;

      const res = await apiClient.get<any[]>(url);
      if (!res.data) return [];

      return res.data
        .map((msg) => ({
          id: 0,
          serverId: msg.id,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          groupId: msg.groupId,
          isMyMessage: msg.senderId === userSession.userId,
          isSentToServer: true,
          text: msg.text,
          isRead: msg.isRead,
          timestamp: new Date(msg.timestamp).toISOString(),
          isDeleted: false,
          isDeletedForMe: false,
          isPinned: msg.isPinned,
          viewsCount: msg.viewsCount || 1,
          attachments: (msg.attachments || []).map((a: any, idx: number) => ({
            id: idx + 1,
            messageId: 0,
            type: a.type,
            fileName: a.fileName,
            fileSizeStr: a.fileSizeStr,
            fileSizeBytes: 0,
            url: UrlHelper.normalize(a.url, BASE_SERVER_URL),
            thumbnailUrl: UrlHelper.normalize(a.thumbnailUrl, BASE_SERVER_URL),
            fileHash: a.fileHash,
            hasAudio: a.hasAudio,
            width: a.width,
            height: a.height,
            durationSeconds: a.durationSeconds,
          })),
        }))
        .filter((m) => !MessageHelper.isCallMessage(m));
    } catch (ex) {
      console.error('[ChatService ERROR] Ошибка FTS поиска:', ex);
      return [];
    }
  }

  public async downloadFileBytesAsync(fileUrl: string): Promise<ArrayBuffer | null> {
    try {
      const res = await apiClient.get(fileUrl, { responseType: 'arraybuffer' });
      return res.data;
    } catch (ex) {
      console.error(`[ChatService ERROR] Ошибка скачивания ${fileUrl}:`, ex);
      return null;
    }
  }

  public async savePermissionsAsync(
    groupId: number,
    canSendText: boolean,
    canSendMedia: boolean,
    canPinMessages: boolean
  ): Promise<boolean> {
    try {
      const res = await apiClient.post(`api/Groups/update-permissions/${groupId}`, {
        CanSendText: canSendText,
        CanSendMedia: canSendMedia,
        CanPinMessages: canPinMessages,
      });
      return res.status >= 200 && res.status < 300;
    } catch (ex) {
      console.error(`[ChatService ERROR] Ошибка прав группы ${groupId}:`, ex);
      return false;
    }
  }

  // 🟢 1 В 1 С WPF ChatService.cs: ДЕДУПЛИКАЦИЯ СООБЩЕНИЙ (.GroupBy(m => m.ServerId > 0 ? m.ServerId : m.Id))
  // 🟢 1 В 1 С WPF ChatService.cs: ДЕДУПЛИКАЦИЯ СТРОГО ПО УНИКАЛЬНЫМ ИДЕНТИФИКАТОРАМ
  public async getLocalMessagesAsync(
    currentUserId: number,
    targetUserId?: number | null,
    groupId?: number | null,
    secretChatId?: string | null,
    take: number = 30,
    beforeTimestamp?: string | null
  ): Promise<IMessage[]> {
    const db = getLocalDatabase(currentUserId);
    let collection = db.messages.toCollection();

    if (secretChatId) {
      collection = db.messages.where('secretChatId').equals(secretChatId);
    } else if (groupId && groupId > 0) {
      collection = db.messages.where('groupId').equals(groupId);
    } else if (targetUserId && targetUserId > 0) {
      collection = db.messages.filter(
        (m) =>
          !m.groupId &&
          !m.secretChatId &&
          ((m.senderId === currentUserId && m.receiverId === targetUserId) ||
            (m.senderId === targetUserId && m.receiverId === currentUserId))
      );
    } else {
      return [];
    }

    let list = await collection
      .filter((m) => !m.isDeleted && !m.isDeletedForMe && m.text !== 'This message was deleted')
      .toArray();

    if (beforeTimestamp) {
      const beforeTime = new Date(beforeTimestamp).getTime();
      list = list.filter((m) => new Date(m.timestamp).getTime() < beforeTime);
    }

    // 🟢 Сортируем: более новые первыми для среза take
    list.sort((a, b) => {
      const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (timeDiff !== 0) return timeDiff;
      return ((b.serverId || 0) - (a.serverId || 0)) || ((b.id || 0) - (a.id || 0));
    });

    // 🟢 Строго как в C# WPF: GroupBy(m => m.ServerId > 0 ? m.ServerId : m.Id)
    // Больше НИКАКИХ удалений одинаковых текстов или фото, отправленных подряд!
    const seenKeys = new Set<string>();
    const deduplicated: IMessage[] = [];

    for (const m of list) {
      const key = m.serverId && m.serverId > 0 ? `s_${m.serverId}` : `l_${m.id}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      deduplicated.push(m);
    }

    // Возвращаем в хронологическом порядке (старые вверху, новые внизу)
    return deduplicated.slice(0, take).reverse();
  }

  public async getLocalPinnedMessagesAsync(
    currentUserId: number,
    targetUserId?: number | null,
    groupId?: number | null,
    secretChatId?: string | null
  ): Promise<IMessage[]> {
    const db = getLocalDatabase(currentUserId);
    return await db.messages
      .filter((m) => {
        if (!m.isPinned || m.isDeleted || (m.isDeletedForMe && m.senderId !== currentUserId)) return false;
        if (secretChatId) return m.secretChatId === secretChatId;
        if (groupId && groupId > 0) return m.groupId === groupId;
        if (targetUserId && targetUserId > 0) {
          return (
            !m.groupId &&
            !m.secretChatId &&
            ((m.senderId === currentUserId && m.receiverId === targetUserId) ||
              (m.senderId === targetUserId && m.receiverId === currentUserId))
          );
        }
        return false;
      })
      .toArray();
  }

  public async getMissingQuotedMessagesAsync(messageIds: number[]): Promise<IMessage[]> {
    if (!messageIds || messageIds.length === 0) return [];
    const db = getLocalDatabase(userSession.userId);
    const idSet = new Set(messageIds);
    return await db.messages.filter((m) => idSet.has(m.serverId) || (Boolean(m.id) && idSet.has(m.id!))).toArray();
  }

  public async getLocalMessageByIdAsync(messageId: number): Promise<IMessage | null> {
    const db = getLocalDatabase(userSession.userId);
    const msg = await db.messages
      .filter((m) => m.serverId === messageId || m.id === messageId)
      .first();
    return msg || null;
  }

  public async searchLocalMessagesAsync(
    query: string,
    currentUserId: number,
    otherUserId?: number | null,
    groupId?: number | null,
    take: number = 50
  ): Promise<IMessage[]> {
    const db = getLocalDatabase(currentUserId);
    const lower = query.toLowerCase();

    const result = await db.messages
      .filter((m) => {
        if (!m.text || !m.text.toLowerCase().includes(lower)) return false;
        if (MessageHelper.isCallMessage(m)) return false;

        if (groupId && groupId > 0) return m.groupId === groupId;
        if (otherUserId && otherUserId > 0) {
          return (
            !m.groupId &&
            ((m.senderId === currentUserId && m.receiverId === otherUserId) ||
              (m.senderId === otherUserId && m.receiverId === currentUserId))
          );
        }
        return false;
      })
      .toArray();

    return result
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, take);
  }

  public async markIncomingMessagesAsReadLocallyAsync(senderId: number, currentUserId: number): Promise<void> {
    const db = getLocalDatabase(currentUserId);
    const unread = await db.messages
      .filter((m) => !m.isMyMessage && !m.isRead && m.senderId === senderId && (!m.receiverId || m.receiverId === currentUserId))
      .toArray();

    for (const m of unread) {
      if (m.id) await (db.messages.update as any)(m.id, { isRead: true });
    }
  }

  public async saveMessageLocallyAsync(message: IMessage): Promise<void> {
    const db = getLocalDatabase(userSession.userId);
    if (message.id && message.id > 0) {
      await db.messages.put(message);
    } else {
      const id = await db.messages.add(message);
      message.id = id;
    }
  }

  public async updateMessageLocallyAsync(
    localId: number,
    serverId: number,
    newText: string,
    attachments?: IAttachment[] | null,
    editedAt?: string | null
  ): Promise<void> {
    const db = getLocalDatabase(userSession.userId);
    const target = await db.messages
      .filter((m) => (localId > 0 && m.id === localId) || (serverId > 0 && m.serverId === serverId))
      .first();

    if (target && target.id) {
      await (db.messages.update as any)(target.id, {
        text: newText,
        editedAt: editedAt || new Date().toISOString(),
        attachments: attachments || [],
      });
    }
  }

  public async deleteMessageLocallyAsync(
    localId: number,
    serverId: number,
    currentUserId: number,
    deleteForAll: boolean
  ): Promise<void> {
    const db = getLocalDatabase(currentUserId);
    const target = await db.messages
      .filter((m) => (localId > 0 && m.id === localId) || (serverId > 0 && m.serverId === serverId))
      .first();

    if (!target || !target.id) return;

    const isMy = target.senderId === currentUserId;

    if ((isMy && deleteForAll) || !isMy) {
      if (!isMy) {
        await db.messages.update(target.id, { isDeletedForMe: true });
      } else {
        await db.messages.delete(target.id);
      }
    } else if (isMy && !deleteForAll) {
      await db.messages.update(target.id, {
        attachments: [],
        isDeletedForMe: true,
        text: 'This message was deleted',
        editedAt: null,
      });
    }
  }

  public async setMessagePinLocallyAsync(localId: number, serverId: number, isPinned: boolean): Promise<void> {
    const db = getLocalDatabase(userSession.userId);
    const target = await db.messages
      .filter((m) => (serverId > 0 && m.serverId === serverId) || m.id === localId)
      .first();

    if (target && target.id) {
      await db.messages.update(target.id, { isPinned });
    }
  }

  public async markMessagesAsReadLocallyAsync(
    currentUserId: number,
    receiverId: number | null,
    maxReadServerId: number
  ): Promise<void> {
    if (!receiverId || maxReadServerId <= 0) return;
    const db = getLocalDatabase(currentUserId);

    const msgs = await db.messages
      .filter((m) => m.isMyMessage && !m.isRead && m.receiverId === receiverId && m.serverId > 0 && m.serverId <= maxReadServerId)
      .toArray();

    for (const m of msgs) {
      if (m.id) await db.messages.update(m.id, { isRead: true });
    }
  }

  public async updateMessageViewsLocallyAsync(messageId: number, viewsCount: number): Promise<void> {
    const db = getLocalDatabase(userSession.userId);
    const msg = await db.messages.filter((m) => m.serverId === messageId || m.id === messageId).first();
    if (msg && msg.id) {
      await db.messages.update(msg.id, { viewsCount });
    }
  }

  // 🟢 ОБНОВЛЕНИЕ СТАТУСА ОТПРАВКИ СООБЩЕНИЯ В ЛОКАЛЬНОЙ БАЗЕ
  public async markAsSentAsync(localId: number, serverId: number, _videoUrl?: string | null, text?: string | null): Promise<void> {
    const db = getLocalDatabase(userSession.userId);
    const updates: Partial<IMessage> = { serverId, isSentToServer: true };
    if (text) updates.text = text;

    if (localId > 0) {
      try {
        await db.messages.update(localId, updates);
      } catch {}
    }

    if (text) {
      const match = await db.messages.filter((m) => (!m.serverId || m.serverId === 0) && m.text === text).first();
      if (match && match.id) {
        await db.messages.update(match.id, updates);
      }
    }
  }

  public async getSharedMediaMessagesAsync(currentUserId: number, targetUserId: number): Promise<IMessage[]> {
    const db = getLocalDatabase(currentUserId);
    const list = await db.messages
      .filter(
        (m) =>
          !m.groupId &&
          !m.isDeletedForMe &&
          !m.isDeleted &&
          ((m.senderId === currentUserId && m.receiverId === targetUserId) ||
            (m.senderId === targetUserId && m.receiverId === currentUserId)) &&
          Boolean(m.attachments && m.attachments.length > 0)
      )
      .toArray();

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public async getSharedPinnedMessagesAsync(currentUserId: number, targetUserId: number): Promise<IMessage[]> {
    const db = getLocalDatabase(currentUserId);
    const list = await db.messages
      .filter(
        (m) =>
          m.isPinned &&
          !m.groupId &&
          !m.isDeletedForMe &&
          !m.isDeleted &&
          ((m.senderId === currentUserId && m.receiverId === targetUserId) ||
            (m.senderId === targetUserId && m.receiverId === currentUserId))
      )
      .toArray();

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public async getSharedLinkMessagesAsync(currentUserId: number, targetUserId: number): Promise<IMessage[]> {
    const db = getLocalDatabase(currentUserId);
    const list = await db.messages
      .filter(
        (m) =>
          !m.groupId &&
          !m.isDeletedForMe &&
          !m.isDeleted &&
          Boolean(m.text && m.text.trim().length > 0) &&
          ((m.senderId === currentUserId && m.receiverId === targetUserId) ||
            (m.senderId === targetUserId && m.receiverId === currentUserId)) &&
          LINK_REGEX.test(m.text)
      )
      .toArray();

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public async getCachedSecretChatAsync(secretChatId: string): Promise<ICachedSecretChat | null> {
    const db = getLocalDatabase(userSession.userId);
    const res = await db.cachedSecretChats.get(secretChatId);
    return res || null;
  }

  public async getCachedSecretChatsAsync(): Promise<ICachedSecretChat[]> {
    const db = getLocalDatabase(userSession.userId);
    return await db.cachedSecretChats.toArray();
  }

  public async saveCachedSecretChatAsync(chat: ICachedSecretChat): Promise<void> {
    const db = getLocalDatabase(userSession.userId);
    await db.cachedSecretChats.put(chat);
  }

  public async removeCachedSecretChatByTargetUserAsync(targetUserId: number): Promise<void> {
    const db = getLocalDatabase(userSession.userId);
    const chats = await db.cachedSecretChats.where('targetUserId').equals(targetUserId).toArray();
    for (const c of chats) {
      await db.cachedSecretChats.delete(c.secretChatId);
    }
  }

  public async deleteSecretChatLocallyAsync(secretChatId: string): Promise<void> {
    const db = getLocalDatabase(userSession.userId);
    await db.cachedSecretChats.delete(secretChatId);
    await db.messages.where('secretChatId').equals(secretChatId).delete();
  }

  public async markSecretMessagesAsReadLocallyAsync(secretChatId: string): Promise<void> {
    const db = getLocalDatabase(userSession.userId);
    const unread = await db.messages
      .filter((m) => m.secretChatId === secretChatId && !m.isMyMessage && !m.isRead)
      .toArray();

    for (const m of unread) {
      if (m.id) await db.messages.update(m.id, { isRead: true });
    }
  }

  public async getCachedGroupDetailAsync(groupId: number): Promise<ICachedGroupDetail | null> {
    const db = getLocalDatabase(userSession.userId);
    const res = await db.cachedGroupDetails.get(groupId);
    return res || null;
  }

  public async saveCachedGroupDetailAsync(detail: ICachedGroupDetail): Promise<void> {
    const db = getLocalDatabase(userSession.userId);
    await db.cachedGroupDetails.put(detail);
  }

  public async getCachedBlockStatusAsync(targetUserId: number): Promise<ICachedBlockStatus | null> {
    const db = getLocalDatabase(userSession.userId);
    const res = await db.cachedBlockStatuses.get(targetUserId);
    return res || null;
  }

  public async saveCachedBlockStatusAsync(targetUserId: number, blockedByMe: boolean, blockedByThem: boolean): Promise<void> {
    const db = getLocalDatabase(userSession.userId);
    await db.cachedBlockStatuses.put({ targetUserId, blockedByMe, blockedByThem });
  }

  public async getBlockedUserIdsAsync(): Promise<Set<number>> {
    const db = getLocalDatabase(userSession.userId);
    const blocked = await db.cachedBlockStatuses.filter((b) => b.blockedByMe).toArray();
    return new Set(blocked.map((b) => b.targetUserId));
  }

  public async getLastMessageForChatAsync(
    currentUserId: number,
    userId?: number | null,
    groupId?: number | null
  ): Promise<IMessage | null> {
    const db = getLocalDatabase(currentUserId);
    let list: IMessage[] = [];

    if (groupId && groupId > 0) {
      list = await db.messages
        .filter((m) => m.groupId === groupId && (!m.isDeletedForMe || m.senderId === currentUserId))
        .toArray();
    } else if (userId && userId > 0) {
      list = await db.messages
        .filter(
          (m) =>
            !m.groupId &&
            (!m.isDeletedForMe || m.senderId === currentUserId) &&
            ((m.senderId === currentUserId && m.receiverId === userId) ||
              (m.senderId === userId && m.receiverId === currentUserId))
        )
        .toArray();
    }

    if (list.length === 0) return null;
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }

  public async deleteChatMessagesLocallyAsync(
    currentUserId: number,
    userId?: number | null,
    groupId?: number | null,
    deleteForAll: boolean = false
  ): Promise<void> {
    const db = getLocalDatabase(currentUserId);

    if (groupId && groupId > 0) {
      await db.messages.where('groupId').equals(groupId).delete();
    } else if (userId && userId > 0) {
      const msgs = await db.messages
        .filter(
          (m) =>
            !m.groupId &&
            ((m.senderId === currentUserId && m.receiverId === userId) ||
              (m.senderId === userId && m.receiverId === currentUserId))
        )
        .toArray();

      for (const m of msgs) {
        if (!m.id) continue;
        if (deleteForAll || m.senderId === currentUserId) {
          await db.messages.delete(m.id);
        } else {
          await db.messages.update(m.id, { isDeletedForMe: true });
        }
      }
    }
  }

  public async deleteSenderMessagesLocallyAsync(senderId: number, currentUserId: number): Promise<void> {
    const db = getLocalDatabase(currentUserId);
    const msgs = await db.messages
      .filter((m) => !m.groupId && m.senderId === senderId && m.receiverId === currentUserId)
      .toArray();

    for (const m of msgs) {
      if (m.id) await db.messages.delete(m.id);
    }
  }
}

export const chatService = new ChatService();