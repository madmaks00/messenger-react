import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { MessagePackHubProtocol } from '@microsoft/signalr-protocol-msgpack';
import { userSession } from './userSession';
import { eventBus } from './eventBus';
import { UrlHelper } from '../utils/helpers';
import { getLocalDatabase } from '../db/localDb';
import { AttachmentDto, MessageReceivedDto } from '../types/dtos';
import { AttachmentType, LastMessageType } from '../types/enums';
import { IMessage } from '../types/models';

export class SignalRService {
  private hubConnection: HubConnection | null = null;
  private readonly serverUrl: string;
  private readonly hubPath: string = 'chat';

  constructor(serverUrl: string = 'https://localhost:7214') {
    this.serverUrl = serverUrl.replace(/\/+$/, '');
  }

  public get connection(): HubConnection {
    if (!this.hubConnection) {
      throw new Error(`SignalR: Подключение к хабу '${this.hubPath}' не инициализировано.`);
    }
    return this.hubConnection;
  }

  public get isConnected(): boolean {
    return this.hubConnection !== null && this.hubConnection.state === HubConnectionState.Connected;
  }

  public async initAsync(token: string, onReconnected?: () => Promise<void>): Promise<void> {
    if (!token) {
      console.warn('[SignalR] Попытка подключения с пустым токеном авторизации.');
      return;
    }

    if (this.hubConnection) {
      await this.stopAsync();
    }

    console.info('[SignalR] Инициализация подключения к хабу...');

    const builder = new HubConnectionBuilder()
      .withUrl(`${this.serverUrl}/${this.hubPath}`, {
        accessTokenFactory: () => token,
      })
      .withHubProtocol(new MessagePackHubProtocol())
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information);

    this.hubConnection = builder.build();

    this.hubConnection.onreconnecting((error) => {
      console.warn('[SignalR] Потеря связи. Переподключение...', error);
    });

    this.hubConnection.onreconnected(async (connectionId) => {
      console.info(`[SignalR] Соединение восстановлено. ConnectionId: ${connectionId}`);
      if (onReconnected) {
        try {
          await onReconnected();
        } catch (err) {
          console.error('[SignalR] Ошибка в обратном вызове onReconnected:', err);
        }
      }
    });

    this.hubConnection.onclose((error) => {
      console.warn('[SignalR] Соединение с хабом закрыто.', error);
    });

    this.registerHubHandlers();

    try {
      await this.hubConnection.start();
      console.info('[SignalR] Соединение с хабом успешно установлено.');
    } catch (err) {
      console.error('[SignalR ERROR] Сбой подключения к хабу:', err);
      throw err;
    }
  }

  public async stopAsync(): Promise<void> {
    if (this.hubConnection) {
      try {
        await this.hubConnection.stop();
        console.info('[SignalR] Соединение с хабом остановлено.');
      } catch (err) {
        console.error('[SignalR ERROR] Ошибка при остановке соединения:', err);
      } finally {
        this.hubConnection = null;
      }
    }
  }

  private registerHubHandlers(): void {
    if (!this.hubConnection) return;

    // 1. Обычные сообщения
    this.hubConnection.on('ReceiveMessage', async (dto: MessageReceivedDto) => {
      const db = getLocalDatabase(userSession.userId);
      const isMyMessage = dto.senderId === userSession.userId;

      const newMsg: IMessage = {
        id: 0,
        serverId: dto.serverId,
        senderId: dto.senderId,
        receiverId: dto.receiverId,
        groupId: dto.groupId,
        isMyMessage,
        isSentToServer: true,
        text: dto.text,
        isRead: isMyMessage,
        timestamp: new Date().toISOString(),
        noteId: dto.noteId,
        isDeleted: false,
        isDeletedForMe: false,
        replyToMessageIds: dto.replyToMessageIds,
        isPinned: false,
        forwardedFromName: dto.forwardedFromName,
        forwardedFromAvatar: dto.forwardedFromAvatar,
        forwardedFromUserId: dto.forwardedFromUserId,
        viewsCount: 1,
        attachments: (dto.attachments || []).map((a, idx) => ({
          id: idx + 1,
          messageId: dto.serverId,
          type: a.type as AttachmentType,
          fileName: a.fileName,
          fileSizeStr: a.fileSizeStr,
          fileSizeBytes: 0,
          url: UrlHelper.normalize(a.url, this.serverUrl),
          thumbnailUrl: UrlHelper.normalize(a.thumbnailUrl, this.serverUrl),
          fileHash: a.fileHash,
          hasAudio: a.hasAudio,
          width: a.width,
          height: a.height,
          durationSeconds: a.durationSeconds,
          waveform: a.waveform,
        })),
      };

      try {
        const localId = await db.messages.add(newMsg);
        newMsg.id = localId;
      } catch (e) {
        console.error('[SignalR] Ошибка сохранения входящего сообщения в IndexedDB', e);
      }

      eventBus.emit('ReceiveMessage', newMsg);
      eventBus.emit('SidebarUpdateMessage', {
        userId: isMyMessage ? dto.receiverId : dto.senderId,
        groupId: dto.groupId,
        previewText: dto.text || 'Вложение',
        incrementUnread: !isMyMessage,
        messageType: LastMessageType.Text,
      });
    });

    // 2. Статусы и события сообщений
    this.hubConnection.on('MessageEdited', (serverId: number, newText: string, attachments: any) => {
      eventBus.emit('MessageEditedMessage', { serverId, newText, attachments });
    });

    this.hubConnection.on('MessageDeleted', (serverId: number, isForAll: boolean) => {
      eventBus.emit('MessageDeletedMessage', { serverId, isForAll });
    });

    this.hubConnection.on('MessagePinned', (serverMessageId: number, isPinned: boolean) => {
      eventBus.emit('MessagePinnedMessage', { serverMessageId, isPinned });
    });

    this.hubConnection.on('MessageViewsUpdated', (serverMessageId: number, viewsCount: number) => {
      eventBus.emit('MessageViewsUpdatedMessage', { serverMessageId, viewsCount });
    });

    this.hubConnection.on('MessagesWereRead', (readerId: number, maxReadId: number) => {
      eventBus.emit('MessagesWereReadMessage', { readerId, maxReadId });
    });

    this.hubConnection.on('ChatClearedForBoth', (blockerId: number) => {
      eventBus.emit('ChatClearedForBothMessage', { blockerId });
    });

    this.hubConnection.on('UserStatusChanged', (userId: number, isOnline: boolean, lastSeen: string) => {
      eventBus.emit('UserStatusChangedMessage', { userId, isOnline, lastSeen });
    });

    this.hubConnection.on('ReceiveTyping', (senderId: number, groupId: number | null) => {
      eventBus.emit('UserTypingMessage', { senderId, groupId });
    });

    this.hubConnection.on('BlockStatusChanged', async (blockerId: number, isBlocked: boolean) => {
      const db = getLocalDatabase(userSession.userId);
      await db.cachedBlockStatuses.put({
        targetUserId: blockerId,
        blockedByMe: false,
        blockedByThem: isBlocked,
      });
      eventBus.emit('BlockStatusChangedMessage', { targetUserId: blockerId, isBlocked });
    });

    this.hubConnection.on('AttachmentProcessed', (fileHash: string, fileName: string, finalUrl: string, thumbnailUrl: string | null, width: number, height: number, hasAudio: boolean, finalType: number) => {
      eventBus.emit('AttachmentProcessedMessage', {
        fileHash,
        fileName,
        url: UrlHelper.normalize(finalUrl, this.serverUrl),
        thumbnailUrl: UrlHelper.normalize(thumbnailUrl, this.serverUrl),
        width,
        height,
        hasAudio,
        finalType,
      });
    });

    // 3. Группы
    this.hubConnection.on('KickedFromGroup', (groupId: number) => eventBus.emit('KickedFromGroupMessage', { groupId }));
    this.hubConnection.on('UserJoinedGroup', (groupId: number, member: any, memberCount: number, onlineCount: number) =>
      eventBus.emit('UserJoinedGroupMessage', { groupId, member, memberCount, onlineCount }));
    this.hubConnection.on('UserLeftGroup', (groupId: number, userId: number, memberCount: number, onlineCount: number) =>
      eventBus.emit('UserLeftGroupMessage', { groupId, userId, memberCount, onlineCount }));
    this.hubConnection.on('GroupUpdated', (groupId: number, newName: string, newAvatar: string | null, newDescription: string | null) =>
      eventBus.emit('GroupUpdatedMessage', { groupId, newName, newAvatar, newDescription }));
    this.hubConnection.on('GroupPermissionsChanged', (groupId: number, canText: boolean, canMedia: boolean, canPin: boolean) =>
      eventBus.emit('GroupPermissionsChangedMessage', { groupId, canText, canMedia, canPin }));

    // 4. Звонки и WebRTC
    this.hubConnection.on('IncomingCall', (callerId: number, callerName: string, callerAvatar: string | null) =>
      eventBus.emit('IncomingCallMessage', { callerId, callerName, callerAvatar }));
    this.hubConnection.on('CallResponse', (receiverId: number, accepted: boolean) =>
      eventBus.emit('CallResponseMessage', { receiverId, accepted }));
    this.hubConnection.on('CallEnded', (targetId: number) => eventBus.emit('CallEndedMessage', { targetId }));
    this.hubConnection.on('ReceiveWebRTCData', (senderId: number, data: string) =>
      eventBus.emit('WebRTCDataMessage', { senderId, data }));

    // 5. Заметки, Истории, Синхронизация
    this.hubConnection.on('NoteUpdated', (noteId: number) => eventBus.emit('NoteUpdatedMessage', { noteId }));
    this.hubConnection.on('StoryPosted', (userId: number, userName: string, userAvatar: string | null) =>
      eventBus.emit('StoryPostedMessage', { userId, userName, userAvatar }));
    this.hubConnection.on('SyncTimer', () => eventBus.emit('SyncTimerMessage', undefined));
  }

  //#region Исходящие методы (RPC)

  private async safeInvoke<T = void>(methodName: string, ...args: any[]): Promise<T | null> {
    if (!this.isConnected) {
      console.warn(`[SignalR] Метод '${methodName}' пропущен: нет соединения.`);
      return null;
    }
    try {
      return await this.connection.invoke(methodName, ...args);
    } catch (err) {
      console.error(`[SignalR ERROR] Ошибка вызова метода '${methodName}':`, err);
      return null;
    }
  }

  public async sendMessageAsync(
    receiverId: number | null,
    groupId: number | null,
    noteId: number | null,
    message: string,
    replyToMessageIds: string | null = null,
    forwardedFromName: string | null = null,
    forwardedFromAvatar: string | null = null,
    forwardedFromUserId: number | null = null,
    attachments: AttachmentDto[] | null = null
  ): Promise<number> {
    const result = await this.safeInvoke<number>(
      'SendMessage',
      receiverId,
      groupId,
      noteId,
      message,
      replyToMessageIds,
      forwardedFromName,
      forwardedFromAvatar,
      forwardedFromUserId,
      attachments
    );
    return result ?? 0;
  }

  public async editMessageAsync(serverId: number, newText: string, attachments: AttachmentDto[] | null = null): Promise<void> {
    await this.safeInvoke('EditMessage', serverId, newText, attachments);
  }

  public async deleteMessageAsync(serverId: number, deleteForAll: boolean): Promise<void> {
    await this.safeInvoke('DeleteMessage', serverId, deleteForAll);
  }

  public async sendTypingAsync(receiverId: number | null, groupId: number | null): Promise<void> {
    await this.safeInvoke('UserIsTyping', receiverId, groupId);
  }

  public async markChatAsReadAsync(targetUserId: number | null, groupId: number | null): Promise<number> {
    const result = await this.safeInvoke<number>('MarkAsRead', targetUserId, groupId);
    return result ?? 0;
  }

  public async togglePinAsync(serverMessageId: number, pinForAll: boolean): Promise<void> {
    await this.safeInvoke('TogglePinMessage', serverMessageId, pinForAll);
  }

  public async setPinAsync(serverMessageId: number, pinForAll: boolean, isPinning: boolean): Promise<void> {
    await this.safeInvoke('SetPinMessage', serverMessageId, pinForAll, isPinning);
  }

  public async getOnlineStatusesAsync(userIds: number[]): Promise<Record<number, boolean> | null> {
    if (!userIds || userIds.length === 0) return null;
    return await this.safeInvoke<Record<number, boolean>>('GetOnlineStatuses', userIds);
  }

  public async trackPostViewsAsync(messageIds: number[]): Promise<void> {
    if (messageIds && messageIds.length > 0) {
      await this.safeInvoke('TrackPostViews', messageIds);
    }
  }

  public async subscribeToGroupAsync(groupId: number): Promise<void> {
    await this.safeInvoke('SubscribeToGroup', groupId);
  }

  public async unsubscribeFromGroupAsync(groupId: number): Promise<void> {
    await this.safeInvoke('UnsubscribeFromGroup', groupId);
  }

  public async subscribeToNoteAsync(noteId: number): Promise<void> {
    await this.safeInvoke('SubscribeToNote', noteId);
  }

  public async startCallAsync(receiverId: number): Promise<void> {
    await this.safeInvoke('StartCall', receiverId);
  }

  public async answerCallAsync(callerId: number, accept: boolean): Promise<void> {
    await this.safeInvoke('AnswerCall', callerId, accept);
  }

  public async endCallAsync(targetId: number): Promise<void> {
    await this.safeInvoke('EndCall', targetId);
  }

  public async sendWebRTCDataAsync(targetId: number, data: string): Promise<void> {
    await this.safeInvoke('SendWebRTCData', targetId, data);
  }

  public async startGroupCallAsync(groupId: number): Promise<void> {
    await this.safeInvoke('StartGroupCall', groupId);
  }

  public async joinGroupCallAsync(groupId: number): Promise<void> {
    await this.safeInvoke('JoinGroupCall', groupId);
  }

  public async leaveGroupCallAsync(groupId: number): Promise<void> {
    await this.safeInvoke('LeaveGroupCall', groupId);
  }

  public async sendGroupCallWebRTCDataAsync(groupId: number, targetUserId: number, data: string): Promise<void> {
    await this.safeInvoke('SendGroupCallWebRTCData', groupId, targetUserId, data);
  }

  public async invokeAsync(methodName: string, ...args: any[]): Promise<any> {
    return await this.safeInvoke(methodName, ...args);
  }
public async markSecretChatAsReadAsync(targetUserId: number, secretChatId: string): Promise<void> {
  await this.safeInvoke('MarkSecretChatAsRead', targetUserId, secretChatId);
}
  //#endregion
}

export const signalRService = new SignalRService();