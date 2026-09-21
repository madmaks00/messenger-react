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
import { BASE_SERVER_URL } from './apiClient';
import { getLocalDatabase } from '../db/localDb';
import { AttachmentDto } from '../types/dtos';
import { AttachmentType, LastMessageType } from '../types/enums';
import { IMessage } from '../types/models';

function getCleanToken(): string {
  let raw =
    userSession.token ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('token') ||
    '';
  if (!raw) {
    try {
      raw = JSON.parse(localStorage.getItem('user_session_data') || '{}').token || '';
    } catch {}
  }
  // 🟢 КРИТИЧНО: SignalR требует чистый токен БЕЗ "Bearer "
  return raw.replace(/^Bearer\s+/i, '').trim();
}

export class SignalRService {
  private hubConnection: HubConnection | null = null;
  private readonly serverUrl: string;
  private readonly hubPath: string = 'chat';
  private connectingPromise: Promise<boolean> | null = null;

  constructor() {
    this.serverUrl = (BASE_SERVER_URL || 'https://localhost:7214').replace(/\/+$/, '');
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

  public async ensureConnectedAsync(): Promise<boolean> {
    if (this.isConnected) return true;

    if (this.connectingPromise) {
      return await this.connectingPromise;
    }

    const token = getCleanToken();
    if (!token) return false;

    return await this.initAsync(token);
  }

  public async initAsync(tokenInput?: string, onReconnected?: () => Promise<void>): Promise<boolean> {
    const token = (tokenInput ? tokenInput.replace(/^Bearer\s+/i, '').trim() : '') || getCleanToken();
    if (!token) return false;

    if (this.isConnected) return true;

    if (this.connectingPromise) {
      return await this.connectingPromise;
    }

    this.connectingPromise = (async () => {
      try {
        if (this.hubConnection) {
          if (this.hubConnection.state === HubConnectionState.Connected) return true;
          if (this.hubConnection.state === HubConnectionState.Connecting) {
            while (this.hubConnection.state === HubConnectionState.Connecting) {
              await new Promise((r) => setTimeout(r, 50));
            }
            if (this.hubConnection.state === HubConnectionState.Connected) return true;
          }
          try {
            await this.hubConnection.stop();
          } catch {}
          this.hubConnection = null;
        }

        const builder = new HubConnectionBuilder()
          .withUrl(`${this.serverUrl}/${this.hubPath}`, {
            accessTokenFactory: () => getCleanToken(),
          })
          .withHubProtocol(new MessagePackHubProtocol())
          .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
          .configureLogging(LogLevel.Warning);

        this.hubConnection = builder.build();

        this.hubConnection.onreconnected(async () => {
          console.info('[SignalR] Соединение восстановлено.');
          eventBus.emit('SignalRConnectedMessage' as any, undefined);
          if (onReconnected) await onReconnected();
        });

        this.registerHubHandlers();

        await this.hubConnection.start();
        console.info('[SignalR] Соединение успешно установлено.');
        eventBus.emit('SignalRConnectedMessage' as any, undefined);
        return true;
      } catch (err: any) {
        console.error('[SignalR ERROR] Сбой подключения к хабу:', err);
        return false;
      } finally {
        this.connectingPromise = null;
      }
    })();

    return await this.connectingPromise;
  }

  public async stopAsync(): Promise<void> {
    if (this.hubConnection) {
      try {
        await this.hubConnection.stop();
      } finally {
        this.hubConnection = null;
        this.connectingPromise = null;
      }
    }
  }

  private registerHubHandlers(): void {
    if (!this.hubConnection) return;

    // 🟢 ВХОДЯЩИЕ СООБЩЕНИЯ (1 в 1 с WPF: MessageReceivedDto)
    this.hubConnection.on('ReceiveMessage', async (rawDto: any) => {
      console.log('⚡ [SignalR] Входящее сообщение ReceiveMessage:', rawDto);
      if (!rawDto) return;

      const currentId = Number(
        userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
      );

      const senderId = Number(rawDto.senderId ?? rawDto.SenderId ?? 0);
      const receiverId =
        rawDto.receiverId !== undefined
          ? Number(rawDto.receiverId)
          : rawDto.ReceiverId !== undefined
          ? Number(rawDto.ReceiverId)
          : null;
      const groupId =
        rawDto.groupId !== undefined
          ? Number(rawDto.groupId)
          : rawDto.GroupId !== undefined
          ? Number(rawDto.GroupId)
          : null;
      const serverId = Number(rawDto.serverId ?? rawDto.ServerId ?? rawDto.id ?? rawDto.Id ?? 0);
      const text = String(rawDto.text ?? rawDto.Text ?? '');
      const isRead = Boolean(rawDto.isRead ?? rawDto.IsRead ?? false);
      const replyToMessageIds = rawDto.replyToMessageIds ?? rawDto.ReplyToMessageIds ?? null;
      const rawAttachments = rawDto.attachments ?? rawDto.Attachments ?? [];
      const timestamp = rawDto.timestamp ?? rawDto.Timestamp ?? new Date().toISOString();
      const senderName = String(rawDto.senderName ?? rawDto.SenderName ?? '');
      const senderAvatar = rawDto.senderAvatar ?? rawDto.SenderAvatar ?? null;

      const isMyMessage = senderId === currentId;

      const newMsg: IMessage = {
        id: 0,
        serverId,
        senderId,
        receiverId,
        groupId,
        senderName: senderName || undefined,
        senderAvatar: senderAvatar || undefined,
        isMyMessage,
        isSentToServer: true,
        text,
        isRead: isMyMessage || isRead,
        timestamp: new Date(timestamp).toISOString(),
        isDeleted: false,
        isDeletedForMe: false,
        replyToMessageIds,
        isPinned: false,
        viewsCount: 1,
        attachments: (rawAttachments || []).map((a: any, idx: number) => ({
          id: idx + 1,
          messageId: serverId,
          type: (a.type ?? a.Type) as AttachmentType,
          fileName: a.fileName ?? a.FileName ?? '',
          fileSizeStr: a.fileSizeStr ?? a.FileSizeStr ?? '',
          fileSizeBytes: 0,
          url: UrlHelper.normalize(a.url ?? a.Url, this.serverUrl),
          thumbnailUrl: UrlHelper.normalize(a.thumbnailUrl ?? a.ThumbnailUrl, this.serverUrl),
          fileHash: a.fileHash ?? a.FileHash ?? '',
          hasAudio: Boolean(a.hasAudio ?? a.HasAudio),
          width: a.width ?? a.Width ?? 0,
          height: a.height ?? a.Height ?? 0,
          durationSeconds: a.durationSeconds ?? a.DurationSeconds ?? 0,
          waveform: a.waveform ?? a.Waveform ?? null,
        })),
      };

      try {
        if (currentId > 0) {
          const db = getLocalDatabase(currentId);
          // 🟢 КРИТИЧНО: удаляем id: 0 перед сохранением в Dexie, чтобы автоинкремент сгенерировал правильный ID
          const { id: _, ...toInsert } = newMsg;
          const localId = await db.messages.add(toInsert as any);
          newMsg.id = Number(localId);
        }
      } catch (err) {
        console.warn('[SignalR] Ошибка сохранения сообщения в локальную БД:', err);
      }

      // Отправляем в чат и обновляем сайдбар
      eventBus.emit('ReceiveMessage', newMsg);
      eventBus.emit('SidebarUpdateMessage', {
        userId: isMyMessage ? receiverId : senderId,
        groupId,
        previewText: text || ((newMsg.attachments?.length ?? 0) > 0 ? 'Вложение' : ''),
        incrementUnread: !isMyMessage,
        messageType: LastMessageType.Text,
      });
    });

    // 🟢 1 в 1 с WPF: Серверный таймер синхронизации дельты
    this.hubConnection.on('SyncTimer', () => {
      eventBus.emit('SyncTimerMessage' as any, undefined);
    });

    this.hubConnection.on('MessagesWereRead', (readerId: number, maxReadId: number) => {
      eventBus.emit('MessagesWereReadMessage', { readerId, maxReadId });
    });

    this.hubConnection.on('MessageEdited', (serverId: number, newText: string, attachments: any) => {
      eventBus.emit('MessageEditedMessage', { serverId, newText, attachments });
    });

    this.hubConnection.on('MessageDeleted', (serverId: number, isForAll: boolean) => {
      eventBus.emit('MessageDeletedMessage', { serverId, isForAll });
    });

    this.hubConnection.on('MessagePinned', (serverMessageId: number, isPinned: boolean) => {
      eventBus.emit('MessagePinnedMessage', { serverMessageId, isPinned });
    });

    this.hubConnection.on('UserStatusChanged', (userId: any, isOnline: any, lastSeen: any) => {
      const uid = Number(userId);
      const online = Boolean(isOnline);
      const seen =
        typeof lastSeen === 'string'
          ? lastSeen
          : lastSeen
          ? new Date(lastSeen).toISOString()
          : new Date().toISOString();

      eventBus.emit('UserStatusChangedMessage', {
        userId: uid,
        isOnline: online,
        lastSeen: seen,
      });
    });

    this.hubConnection.on('ReceiveTyping', (senderId: number, groupId: number | null) => {
      eventBus.emit('UserTypingMessage', { senderId, groupId });
    });

    this.hubConnection.on('ReceiveWebRTCData', (senderId: number, data: string) => {
      eventBus.emit('WebRTCDataMessage', { senderId, data });
    });

    this.hubConnection.on('IncomingCall', (callerId: number, callerName: string, callerAvatar: string | null) => {
      eventBus.emit('IncomingCallMessage', { callerId, callerName, callerAvatar });
    });

    this.hubConnection.on('CallResponse', (receiverId: number, accepted: boolean) => {
      eventBus.emit('CallResponseMessage', { receiverId, accepted });
    });

    this.hubConnection.on('CallEnded', (targetId: number) => {
      eventBus.emit('CallEndedMessage', { targetId });
    });

    this.hubConnection.on('IncomingGroupCall', (groupId: number, groupName: string, callerId: number, callerName: string, callerAvatar: string | null) => {
      eventBus.emit('IncomingGroupCallMessage', { groupId, groupName, callerId, callerName, callerAvatar });
    });

    this.hubConnection.on('GroupCallJoined', (groupId: number, participants: any[]) => {
      eventBus.emit('GroupCallJoinedMessage', { groupId, participants });
    });

    this.hubConnection.on('UserJoinedGroupCall', (groupId: number, participant: any) => {
      eventBus.emit('UserJoinedGroupCallMessage', { groupId, participant });
    });

    this.hubConnection.on('UserLeftGroupCall', (groupId: number, userId: number) => {
      eventBus.emit('UserLeftGroupCallMessage', { groupId, userId });
    });

    this.hubConnection.on('ReceiveGroupCallWebRTCData', (groupId: number, senderId: number, data: string) => {
      eventBus.emit('GroupCallWebRTCDataMessage', { groupId, senderId, data });
    });
  }

  private async safeInvoke<T = void>(methodName: string, ...args: any[]): Promise<T | null> {
    const connected = await this.ensureConnectedAsync();
    if (!connected || !this.hubConnection) {
      console.warn(`[SignalR] Метод '${methodName}' пропущен: нет соединения.`);
      return null;
    }

    try {
      return await this.hubConnection.invoke(methodName, ...args);
    } catch (err) {
      console.error(`[SignalR ERROR] Ошибка вызова '${methodName}':`, err);
      return null;
    }
  }

  public async getOnlineStatusesAsync(userIds: number[]): Promise<Record<number, boolean> | null> {
    if (!userIds || userIds.length === 0) return null;
    return await this.safeInvoke<Record<number, boolean>>('GetOnlineStatuses', userIds);
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

  public async setPinAsync(serverMessageId: number, pinForAll: boolean, isPinning: boolean): Promise<void> {
    await this.safeInvoke('SetPinMessage', serverMessageId, pinForAll, isPinning);
  }

  public async togglePinAsync(serverMessageId: number, pinForAll: boolean): Promise<void> {
    await this.safeInvoke('TogglePinMessage', serverMessageId, pinForAll);
  }

  public async trackPostViewsAsync(messageIds: number[]): Promise<void> {
    if (messageIds && messageIds.length > 0) {
      await this.safeInvoke('TrackPostViews', messageIds);
    }
  }

  public async sendTypingAsync(receiverId: number | null, groupId: number | null): Promise<void> {
    await this.safeInvoke('UserIsTyping', receiverId, groupId);
  }

  public async markChatAsReadAsync(targetUserId: number | null, groupId: number | null): Promise<number> {
    const result = await this.safeInvoke<number>('MarkAsRead', targetUserId, groupId);
    return result ?? 0;
  }

  public async markSecretChatAsReadAsync(targetUserId: number, secretChatId: string): Promise<void> {
    await this.safeInvoke('MarkSecretChatAsRead', targetUserId, secretChatId);
  }

  public async sendSecretMessageAsync(
    targetUserId: number,
    secretChatId: string,
    ciphertext: string,
    nonce: string,
    tag: string,
    sequenceNumber: number
  ): Promise<void> {
    await this.safeInvoke('SendSecretMessage', targetUserId, secretChatId, ciphertext, nonce, tag, sequenceNumber);
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

  public async subscribeToGroupAsync(groupId: number): Promise<void> {
    await this.safeInvoke('SubscribeToGroup', groupId);
  }

  public async unsubscribeFromGroupAsync(groupId: number): Promise<void> {
    await this.safeInvoke('UnsubscribeFromGroup', groupId);
  }

  public async subscribeToNoteAsync(noteId: number): Promise<void> {
    await this.safeInvoke('SubscribeToNote', noteId);
  }

  public async invokeAsync(methodName: string, ...args: any[]): Promise<any> {
    return await this.safeInvoke(methodName, ...args);
  }
}

export const signalRService = new SignalRService();