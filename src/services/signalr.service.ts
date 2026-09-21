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
import { AttachmentDto, MessageReceivedDto } from '../types/dtos';
import { AttachmentType, LastMessageType } from '../types/enums';
import { IMessage } from '../types/models';

export class SignalRService {
  private hubConnection: HubConnection | null = null;
  private readonly serverUrl: string;
  private readonly hubPath: string = 'chat';
  private connectingPromise: Promise<void> | null = null;

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
      try {
        await this.connectingPromise;
        return this.isConnected;
      } catch {
        return false;
      }
    }

    const token = userSession.token;
    if (token) {
      try {
        await this.initAsync(token);
        return this.isConnected;
      } catch {
        return false;
      }
    }

    return false;
  }

  public async initAsync(token: string, onReconnected?: () => Promise<void>): Promise<void> {
    if (!token) return;

    if (this.hubConnection) {
      await this.stopAsync();
    }

    const builder = new HubConnectionBuilder()
      .withUrl(`${this.serverUrl}/${this.hubPath}`, {
        accessTokenFactory: () => userSession.token || token,
      })
      .withHubProtocol(new MessagePackHubProtocol())
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning);

    this.hubConnection = builder.build();

    this.hubConnection.onreconnected(async () => {
      console.info('[SignalR] Соединение восстановлено.');
      if (onReconnected) await onReconnected();
    });

    this.registerHubHandlers();

    this.connectingPromise = this.hubConnection.start();
    try {
      await this.connectingPromise;
      console.info('[SignalR] Соединение успешно установлено.');
    } finally {
      this.connectingPromise = null;
    }
  }

  public async stopAsync(): Promise<void> {
    if (this.hubConnection) {
      try {
        await this.hubConnection.stop();
      } finally {
        this.hubConnection = null;
      }
    }
  }

  private registerHubHandlers(): void {
    if (!this.hubConnection) return;

    this.hubConnection.on('ReceiveMessage', async (dto: MessageReceivedDto) => {
      const currentId = Number(userSession.userId);
      const isMyMessage = Number(dto.senderId) === currentId;

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
        isDeleted: false,
        isDeletedForMe: false,
        replyToMessageIds: dto.replyToMessageIds,
        isPinned: false,
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
        const db = getLocalDatabase(currentId);
        const localId = await db.messages.add(newMsg);
        newMsg.id = localId;
      } catch { }

      eventBus.emit('ReceiveMessage', newMsg);
      eventBus.emit('SidebarUpdateMessage', {
        userId: isMyMessage ? dto.receiverId : dto.senderId,
        groupId: dto.groupId,
        previewText: dto.text || 'Вложение',
        incrementUnread: !isMyMessage,
        messageType: LastMessageType.Text,
      });
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

    this.hubConnection.on('UserStatusChanged', (userId: number, isOnline: boolean, lastSeen: string) => {
      eventBus.emit('UserStatusChangedMessage', { userId, isOnline, lastSeen });
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

  // ================= СООБЩЕНИЯ =================

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

  // ================= ЗВОНКИ И WEBRTC =================

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

  // ================= ГРУППЫ И ЗАМЕТКИ =================

  public async subscribeToGroupAsync(groupId: number): Promise<void> {
    await this.safeInvoke('SubscribeToGroup', groupId);
  }

  public async unsubscribeFromGroupAsync(groupId: number): Promise<void> {
    await this.safeInvoke('UnsubscribeFromGroup', groupId);
  }

  public async subscribeToNoteAsync(noteId: number): Promise<void> {
    await this.safeInvoke('SubscribeToNote', noteId);
  }

  public async getOnlineStatusesAsync(userIds: number[]): Promise<Record<number, boolean> | null> {
    if (!userIds || userIds.length === 0) return null;
    return await this.safeInvoke<Record<number, boolean>>('GetOnlineStatuses', userIds);
  }

  public async invokeAsync(methodName: string, ...args: any[]): Promise<any> {
    return await this.safeInvoke(methodName, ...args);
  }
}

export const signalRService = new SignalRService();