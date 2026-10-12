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
  markAsSentAsync(localId: number, serverId: number, attachments?: IAttachment[] | null, text?: string | null): Promise<void>;
  syncGroupHistoryAsync(groupId: number, currentUserId: number): Promise<void>;
  getChatsAsync(): Promise<IChatListItem[]>;
  toggleMuteChatAsync(targetUserId?: number | null, targetGroupId?: number | null): Promise<boolean | null>;
  togglePinChatAsync(targetUserId?: number | null, targetGroupId?: number | null): Promise<boolean | null>;
  clearChatHistoryAsync(targetUserId?: number | null, targetGroupId?: number | null, deleteForAll?: boolean): Promise<boolean>;
  getMessageContextAsync(serverMessageId: number): Promise<IMessage[]>;
  getGroupSharedMediaMessagesAsync(groupId: number): Promise<IMessage[]>;
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
      console.log(`[ChatService] Начинаем загрузку ${files.length} файл(ов)...`);
      const resultDtos: AttachmentDto[] = [];
      for (const file of files) {
        console.log(`[ChatService] Обработка файла: "${file.name}", размер: ${file.size} байт (${(file.size / 1024).toFixed(1)} КБ)`);
        const dto = await this.uploadSingleFileChunkedAsync(file);
        if (dto) {
          resultDtos.push(dto);
        }
      }
      return resultDtos;
    } catch (ex: any) {
      console.error('[ChatService ERROR] Сбой чанковой загрузки файлов:', ex);
      return null;
    }
  }

  private async uploadSingleFileChunkedAsync(file: File): Promise<AttachmentDto | null> {
    const totalFileSize = file.size;
    const fileName = file.name;

    if (totalFileSize <= 0) {
      console.error(`[ChatService ❌] Ошибка: файл "${fileName}" пустой (0 байт)! Загрузка отменена.`);
      return null;
    }

    const fileBuffer = await file.arrayBuffer();
    const fileHash = await computeSha256(fileBuffer);

    let totalChunks = Math.ceil(totalFileSize / CHUNK_SIZE);
    if (totalChunks <= 0) totalChunks = 1;

    const uploadId = await computeSha256(`${fileHash}_${totalFileSize}_${totalChunks}`);

    console.log(`[ChatService 🛰️] Подготовка к чанковой загрузке: FileHash=${fileHash.substring(0, 10)}..., UploadId=${uploadId.substring(0, 10)}..., Чанков=${totalChunks}, Размер=${totalFileSize} байт`);

    const alreadyUploaded = new Set<number>();
    try {
      const statusUrl = `api/Messages/upload-status?uploadId=${uploadId}&fileHash=${fileHash}&totalChunks=${totalChunks}&fileName=${encodeURIComponent(fileName)}`;
      const statusRes = await apiClient.get<ChunkUploadStatusDto>(statusUrl);
      if (statusRes.status === 200 && statusRes.data) {
        if (statusRes.data.isCompleted && statusRes.data.attachment) {
          console.log('[ChatService ⚡] Файл уже был загружен ранее (дедупликация)!');
          return statusRes.data.attachment;
        }
        if (statusRes.data.uploadedChunks) {
          statusRes.data.uploadedChunks.forEach((c) => alreadyUploaded.add(c));
        }
      }
    } catch (statusErr) {
      console.warn('[ChatService] Статус загрузки не получен, продолжаем загрузку с 0 чанка:', statusErr);
    }

    let finalAttachment: AttachmentDto | null = null;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (alreadyUploaded.has(chunkIndex)) {
        console.log(`[ChatService ⏩] Чанк ${chunkIndex + 1}/${totalChunks} уже на сервере, пропускаем.`);
        continue;
      }

      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalFileSize);
      const chunkBlob = file.slice(start, end);

      console.log(`[ChatService 🚀] Отправка чанка ${chunkIndex + 1}/${totalChunks} (Размер чанка: ${chunkBlob.size} байт)...`);

      const formData = new FormData();
      formData.append('UploadId', uploadId);
      formData.append('ChunkIndex', chunkIndex.toString());
      formData.append('TotalChunks', totalChunks.toString());
      formData.append('TotalFileSize', totalFileSize.toString());
      formData.append('FileHash', fileHash);
      formData.append('FileName', fileName);

      // 🟢 1 в 1 с C# WPF: formContent.Add(memoryContent, "chunk", $"{chunkIndex}.part")
      formData.append('chunk', chunkBlob, `${chunkIndex}.part`);

      try {
        const res = await apiClient.post<ChunkUploadStatusDto>('api/Messages/upload-chunk', formData);

        if (res.status >= 200 && res.status < 300 && res.data) {
          console.log(`[ChatService ✅] Чанк ${chunkIndex + 1}/${totalChunks} успешно принят сервером.`);
          if (res.data.isCompleted && res.data.attachment) {
            console.log('[ChatService 🎉] Все чанки собраны! Сервер вернул AttachmentDto:', res.data.attachment);
            finalAttachment = res.data.attachment;
            break;
          }
        } else {
          console.error(`[ChatService ❌] Сервер вернул статус ${res.status} для чанка ${chunkIndex + 1}/${totalChunks}`);
          return null;
        }
      } catch (err: any) {
        console.error(`[ChatService ❌] Ошибка запроса на чанке ${chunkIndex + 1}/${totalChunks}:`, err);
        if (err?.response?.data) {
          console.error('[ChatService ❌ ДЕТАЛИ ОШИБКИ СЕРВЕРА]:', err.response.data);
        }
        return null;
      }
    }

    return finalAttachment;
  }

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

        let existing = await db.messages.where('serverId').equals(serverId).first();

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

          const resolvedWidth = a.width > 0 ? a.width : (existingAtt?.width && existingAtt.width > 0 ? existingAtt.width : (cached?.width || 0));
          const resolvedHeight = a.height > 0 ? a.height : (existingAtt?.height && existingAtt.height > 0 ? existingAtt.height : (cached?.height || 0));

          const serverWave = a.waveform || a.Waveform;
          const resolvedWaveform = (serverWave && String(serverWave).trim().length > 0)
            ? serverWave
            : (existingAtt?.waveform || '');

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
            waveform: resolvedWaveform,
          };
        });

        if (existing && existing.id) {
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

      const d = res.data;
      if (typeof d === 'boolean') return d;
      // 🟢 1:1 С C# ReadToggleResultAsync: парсим булево значение из свойств JSON-объекта
      if (d && typeof d === 'object') {
        for (const val of Object.values(d)) {
          if (typeof val === 'boolean') return val;
        }
      }
      return null;
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

      const d = res.data;
      if (typeof d === 'boolean') return d;
      // 🟢 1:1 С C# ReadToggleResultAsync: парсим булево значение из свойств JSON-объекта
      if (d && typeof d === 'object') {
        for (const val of Object.values(d)) {
          if (typeof val === 'boolean') return val;
        }
      }
      return null;
    } catch (ex) {
      console.error('[ChatService ERROR] Ошибка togglePinChatAsync:', ex);
      return null;
    }
  }

  public async clearChatHistoryAsync(targetUserId?: number | null, targetGroupId?: number | null, deleteForAll: boolean = false): Promise<boolean> {
    try {
      const payload = { TargetUserId: targetUserId, TargetGroupId: targetGroupId, DeleteForAll: deleteForAll };
      const response = await apiClient.post('api/Messages/clear', payload);
      return response.status >= 200 && response.status < 300;
    } catch (ex) {
      console.error('[ChatService ERROR] Ошибка очистки истории чата:', ex);
      return false;
    }
  }

  public async getMessageContextAsync(serverMessageId: number): Promise<IMessage[]> {
    const response = await apiClient.get<any[]>(`api/Messages/context/${serverMessageId}`);
    const db = getLocalDatabase(userSession.userId);
    const messages: IMessage[] = [];
    for (const raw of response.data || []) {
      const cached = await db.messages.filter(message => message.serverId === raw.id).first();
      if (cached) { if (!cached.isDeleted && !cached.isDeletedForMe) messages.push(cached); continue; }
      const message = {
        ...raw, serverId: raw.id, isMyMessage: raw.senderId === userSession.userId,
        isSentToServer: true, isDeleted: false, isDeletedForMe: false, timestamp: new Date(raw.timestamp).toISOString(),
        attachments: (raw.attachments || []).map((attachment: any, index: number) => ({
          ...attachment, id: -raw.id * 1000 - index - 1, messageId: raw.id,
          url: UrlHelper.normalize(attachment.url, BASE_SERVER_URL), thumbnailUrl: UrlHelper.normalize(attachment.thumbnailUrl, BASE_SERVER_URL),
        })),
      } as IMessage;
      // Server IDs and the auto-increment local primary key are different namespaces.
      delete (message as any).id;
      await this.saveMessageLocallyAsync(message);
      messages.push(message);
    }
    return messages;
  }

  public async getGroupSharedMediaMessagesAsync(groupId: number): Promise<IMessage[]> {
    const messages: IMessage[] = [];
    let beforeId: number | undefined;
    while (true) {
      const response = await apiClient.get<any[]>(`api/Messages/group-shared-media/${groupId}`, { params: { beforeId } });
      const page = response.data || [];
      messages.push(...page.map((message: any) => ({
        ...message, serverId: message.id, isMyMessage: message.senderId === userSession.userId,
        isSentToServer: true, isDeleted: false, isDeletedForMe: false, timestamp: new Date(message.timestamp).toISOString(),
        attachments: (message.attachments || []).map((attachment: any, index: number) => ({
          ...attachment, id: -message.id * 1000 - index - 1, messageId: message.id, fileSizeBytes: 0,
          url: UrlHelper.normalize(attachment.url, BASE_SERVER_URL),
          thumbnailUrl: UrlHelper.normalize(attachment.thumbnailUrl, BASE_SERVER_URL),
        })),
      })));
      if (page.length < 200) break;
      const cursor = Math.min(...page.map((message: any) => message.id));
      if (beforeId !== undefined && cursor >= beforeId) break;
      beforeId = cursor;
    }
    return messages;
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
        senderName: msg.senderName || msg.SenderName || null,       // 🟢 Мапим имя
        senderAvatar: msg.senderAvatar || msg.SenderAvatar || null, // 🟢 Мапим аватар
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

  public async getLocalMessagesAsync(
    currentUserId: number,
    targetUserId?: number | null,
    groupId?: number | null,
    secretChatId?: string | null,
    take: number = 30,
    beforeTimestamp?: string | null
  ): Promise<IMessage[]> {
    const db = getLocalDatabase(currentUserId);
    const maxTime = beforeTimestamp || '\uffff';

    let rawList: IMessage[] = [];

    if (secretChatId) {
      rawList = await db.messages
        .where('[secretChatId+timestamp]')
        .between([secretChatId, ''], [secretChatId, maxTime], true, false)
        .reverse()
        .limit(take)
        .toArray();
    } else if (groupId && groupId > 0) {
      rawList = await db.messages
        .where('[groupId+timestamp]')
        .between([groupId, ''], [groupId, maxTime], true, false)
        .reverse()
        .limit(take)
        .toArray();
    } else if (targetUserId && targetUserId > 0) {
      const [sent, received] = await Promise.all([
        db.messages
          .where('[senderId+receiverId+timestamp]')
          .between([currentUserId, targetUserId, ''], [currentUserId, targetUserId, maxTime], true, false)
          .reverse()
          .limit(take)
          .toArray(),
        db.messages
          .where('[senderId+receiverId+timestamp]')
          .between([targetUserId, currentUserId, ''], [targetUserId, currentUserId, maxTime], true, false)
          .reverse()
          .limit(take)
          .toArray(),
      ]);

      rawList = [...sent, ...received];
    } else {
      return [];
    }

    let list = rawList.filter(
      (m) => !m.isDeleted && !m.isDeletedForMe && m.text !== 'This message was deleted'
    );

    list.sort((a, b) => {
      const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (timeDiff !== 0) return timeDiff;
      return (b.serverId || 0) - (a.serverId || 0) || (b.id || 0) - (a.id || 0);
    });

    const seenKeys = new Set<string>();
    const deduplicated: IMessage[] = [];

    for (const m of list) {
      const key = m.serverId && m.serverId > 0 ? `s_${m.serverId}` : `l_${m.id}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      deduplicated.push(m);
    }

    return deduplicated.slice(0, take).reverse();
  }

  public async getLocalPinnedMessagesAsync(
    currentUserId: number,
    targetUserId?: number | null,
    groupId?: number | null,
    secretChatId?: string | null
  ): Promise<IMessage[]> {
    const db = getLocalDatabase(currentUserId);
    let list: IMessage[] = [];

    if (secretChatId) {
      list = await db.messages
        .where('[secretChatId+timestamp]')
        .between([secretChatId, ''], [secretChatId, '\uffff'])
        .filter((m) => Boolean(m.isPinned) && !m.isDeleted && !m.isDeletedForMe)
        .toArray();
    } else if (groupId && groupId > 0) {
      list = await db.messages
        .where('[groupId+timestamp]')
        .between([groupId, ''], [groupId, '\uffff'])
        .filter((m) => Boolean(m.isPinned) && !m.isDeleted && !m.isDeletedForMe)
        .toArray();
    } else if (targetUserId && targetUserId > 0) {
      const [sent, received] = await Promise.all([
        db.messages
          .where('[senderId+receiverId+timestamp]')
          .between([currentUserId, targetUserId, ''], [currentUserId, targetUserId, '\uffff'])
          .filter((m) => Boolean(m.isPinned) && !m.isDeleted && !m.isDeletedForMe)
          .toArray(),
        db.messages
          .where('[senderId+receiverId+timestamp]')
          .between([targetUserId, currentUserId, ''], [targetUserId, currentUserId, '\uffff'])
          .filter((m) => Boolean(m.isPinned) && !m.isDeleted && !m.isDeletedForMe)
          .toArray(),
      ]);

      list = [...sent, ...received];
    } else {
      return [];
    }

    return list.sort((a, b) => {
      const idA = Number(a.serverId && a.serverId > 0 ? a.serverId : (a.id || 0));
      const idB = Number(b.serverId && b.serverId > 0 ? b.serverId : (b.id || 0));
      if (idA > 0 && idB > 0 && idA !== idB) {
        return idA - idB;
      }
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
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

  public async markAsSentAsync(
    localId: number,
    serverId: number,
    attachments?: IAttachment[] | null,
    text?: string | null
  ): Promise<void> {
    const db = getLocalDatabase(userSession.userId);
    const updates: Partial<IMessage> = { serverId, isSentToServer: true };
    if (text) updates.text = text;
    if (attachments && attachments.length > 0) {
      updates.attachments = attachments.map((a) => {
        const { rawFile, ...rest } = a;
        return rest;
      });
    }

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