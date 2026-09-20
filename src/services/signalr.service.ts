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

  public get isConnected(): boolean {
    return this.hubConnection !== null && this.hubConnection.state === HubConnectionState.Connected;
  }

  // 🟢 Автоматическое подключение, если сокет еще не стартовал
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

  public async getOnlineStatusesAsync(userIds: number[]): Promise<Record<number, boolean> | null> {
    if (!userIds || userIds.length === 0) return null;
    return await this.safeInvoke<Record<number, boolean>>('GetOnlineStatuses', userIds);
  }

  public async subscribeToNoteAsync(noteId: number): Promise<void> {
    await this.safeInvoke('SubscribeToNote', noteId);
  }

  public async markChatAsReadAsync(targetUserId: number | null, groupId: number | null): Promise<number> {
    const result = await this.safeInvoke<number>('MarkAsRead', targetUserId, groupId);
    return result ?? 0;
  }
}

export const signalRService = new SignalRService();