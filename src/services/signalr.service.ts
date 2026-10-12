import { UserPresence, parsePresence, GroupPresence } from './userPresenceState';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { userSession } from './userSession';
import { eventBus } from './eventBus';
import { UrlHelper } from '../utils/helpers';
import { BASE_SERVER_URL } from './apiClient';
import { getLocalDatabase } from '../db/localDb';
import { AttachmentDto, PrivacySettingsDto, GroupCallParticipantDto } from '../types/dtos';
import { AttachmentType, LastMessageType } from '../types/enums';
import { IMessage, IUser, IChatFolder, IChatListItem, ICachedSecretChat } from '../types/models';
import { parsePrivacyVisibility } from '../components/profile/profileView.utils';
import { useChatFolderStore } from '../stores/chatFolderStore';
import { useSidebarChatsStore } from '../stores/sidebarChatsStore';
import { MessagePreviewHelper } from '../utils/messagePreviewHelper';
import { secretChatCrypto } from './secretChatCrypto.service';
import { userService } from './user.service';

function getCleanToken(): string {
  let raw =
    userSession.token ||
    localStorage.getItem('jwt_token') ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('token') ||
    '';
  if (!raw) {
    try {
      raw = JSON.parse(localStorage.getItem('user_session_data') || '{}').token || '';
    } catch {}
  }
  return raw.replace(/^Bearer\s+/i, '').trim();
}

export class SignalRService {
  private hubConnection: HubConnection | null = null;
  private readonly serverUrl: string;
  private readonly hubPath: string = 'chat';
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatRunning = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private connectionGeneration = 0;
  private connectingPromise: Promise<boolean> | null = null;

  constructor() {
    this.serverUrl = (BASE_SERVER_URL || 'https://localhost:7214').replace(/\/+$/, '');
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!this.stopped){if(this.isConnected){void this.heartbeat();void useSidebarChatsStore.getState().syncOnlineStatuses(true);}else void this.ensureConnectedAsync();}});
    window.addEventListener('pagehide',(event)=>{if(!event.persisted)void this.stopAsync();});
    window.addEventListener('online',()=>{if(!this.stopped)void this.ensureConnectedAsync();});
  }

  private scheduleReconnect(generation: number) {
    if(this.stopped||generation!==this.connectionGeneration||!userSession.isAuthenticated)return;
    if(this.reconnectTimer)clearTimeout(this.reconnectTimer);
    this.reconnectTimer=setTimeout(()=>{this.reconnectTimer=null;if(!this.stopped&&generation===this.connectionGeneration)void this.ensureConnectedAsync();},5000);
  }

  private async heartbeat(): Promise<void> {
    if(!this.isConnected||this.heartbeatRunning)return;
    this.heartbeatRunning=true;
    try{await this.safeInvoke('Heartbeat');}finally{this.heartbeatRunning=false;}
  }
  private startHeartbeat() {
    if(this.heartbeatTimer)clearInterval(this.heartbeatTimer);
    void this.heartbeat();this.heartbeatTimer=setInterval(()=>{void this.heartbeat();},25000);
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
    if (!token) {
      console.warn('[SignalR] Токен не найден в памяти и localStorage. Подключение ожидает авторизации.');
      return false;
    }

    return await this.initAsync(token);
  }

  public async initAsync(tokenInput?: string, onReconnected?: () => Promise<void>): Promise<boolean> {
    const token = (tokenInput ? tokenInput.replace(/^Bearer\s+/i, '').trim() : '') || getCleanToken();
    if (!token) return false;

    if (this.isConnected) return true;

    if (this.connectingPromise) {
      return await this.connectingPromise;
    }

    const generation=++this.connectionGeneration;this.stopped=false;
    if(this.reconnectTimer){clearTimeout(this.reconnectTimer);this.reconnectTimer=null;}
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
          .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
          .configureLogging(LogLevel.Warning);

        this.hubConnection = builder.build();
        const connection=this.hubConnection;

        this.hubConnection.onreconnecting((error) => {
          console.warn('[SignalR] Потеря связи с хабом. Переподключение...', error);
        });

        this.hubConnection.onreconnected(async (id) => {
          if(this.stopped||generation!==this.connectionGeneration||this.hubConnection!==connection)return;
          console.info('[SignalR] Соединение восстановлено. ConnectionId:', id);
          this.startHeartbeat();

          // 🟢 Переподписываемся на группы после разрыва соединения
          try {
            const chats = useSidebarChatsStore.getState().allChats;
            chats.forEach((c) => {
              if (c.isGroup && c.groupId) {
                void this.subscribeToGroupAsync(c.groupId);
              }
            });
          } catch (e) {
            console.warn('[SignalR] Ошибка переподписки на группы:', e);
          }

          eventBus.emit('SignalRConnectedMessage' as any, undefined);
          if (onReconnected) {
            try {
              await onReconnected();
            } catch (ex) {
              console.error('[SignalR] Ошибка в onReconnected:', ex);
            }
          }
        });

        this.hubConnection.onclose((error) => {
          console.warn('[SignalR] Соединение закрыто.', error);
          this.scheduleReconnect(generation);
        });

        this.registerHubHandlers();

        await connection.start();
        if(this.stopped||generation!==this.connectionGeneration||this.hubConnection!==connection)return false;
        console.info('[SignalR] Соединение успешно установлено.');
        this.startHeartbeat();
        eventBus.emit('SignalRConnectedMessage' as any, undefined);
        return true;
      } catch (err: any) {
        if(generation===this.connectionGeneration){console.error('[SignalR ERROR] Сбой подключения к хабу:', err);this.scheduleReconnect(generation);}
        return false;
      } finally {
        if(generation===this.connectionGeneration)this.connectingPromise = null;
      }
    })();

    return await this.connectingPromise;
  }

  public async stopAsync(): Promise<void> {
    this.stopped=true;this.connectionGeneration++;
    if(this.reconnectTimer){clearTimeout(this.reconnectTimer);this.reconnectTimer=null;}
    if(this.heartbeatTimer){clearInterval(this.heartbeatTimer);this.heartbeatTimer=null;}
    const connection=this.hubConnection;this.hubConnection=null;this.connectingPromise=null;
    if(connection)await connection.stop();
  }

  private registerHubHandlers(): void {
    if (!this.hubConnection) return;

    this.hubConnection.on('GroupStoriesChanged', (groupId: number) => {
      eventBus.emit('GroupStoriesChangedMessage', { groupId });
    });
    this.hubConnection.on('StoryPosted', (userId: number, userName: string, userAvatar: any) => {
      eventBus.emit('StoryPostedMessage', { userId, userName, userAvatar });
    });
this.hubConnection.on(
      'UserMediaStateChanged',
      (groupId: number, userId: number, isMuted: boolean, isVideoOn: boolean, isScreenSharing: boolean) => {
        eventBus.emit('UserMediaStateChangedMessage' as any, {
          groupId: Number(groupId),
          userId: Number(userId),
          isMuted: Boolean(isMuted),
          isVideoOn: Boolean(isVideoOn),
          isScreenSharing: Boolean(isScreenSharing),
        });
      }
    );
    this.hubConnection.on('StoryDeleted', (storyId: number, userId: number) => {
      eventBus.emit('StoryDeletedMessage', { storyId, userId });
    });

    this.hubConnection.on('StoryCommentAdded', (storyId: number, commentsCount: number) => {
      eventBus.emit('StoryCommentAddedMessage', { storyId, commentsCount });
    });
    this.hubConnection.on('GroupMessagesWereRead', (groupId: number, readerId: number, maxReadId: number) => {
      eventBus.emit('MessagesWereReadMessage' as any, { readerId: Number(readerId), maxReadId: Number(maxReadId) });
    });
    // 🟢 1. ВХОДЯЩИЕ ОБЫЧНЫЕ СООБЩЕНИЯ
    this.hubConnection.on('ReceiveMessage', async (rawDto: any) => {
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
      const noteId =
        rawDto.noteId !== undefined
          ? Number(rawDto.noteId)
          : rawDto.NoteId !== undefined
          ? Number(rawDto.NoteId)
          : null;
      const serverId = Number(rawDto.serverId ?? rawDto.ServerId ?? rawDto.id ?? rawDto.Id ?? 0);
      const text = String(rawDto.text ?? rawDto.Text ?? '');
      const isRead = Boolean(rawDto.isRead ?? rawDto.IsRead ?? false);
      const replyToMessageIds = rawDto.replyToMessageIds ?? rawDto.ReplyToMessageIds ?? null;
      const rawAttachments = rawDto.attachments ?? rawDto.Attachments ?? [];
      const timestamp = rawDto.timestamp ?? rawDto.Timestamp ?? new Date().toISOString();
      let senderName = String(rawDto.senderName ?? rawDto.SenderName ?? '');
      let senderAvatar = rawDto.senderAvatar ?? rawDto.SenderAvatar ?? null;

      const isMyMessage = senderId === currentId;

      // 🟢 Обогащаем имя и аватарку автора чужого сообщения в группе
      if (!isMyMessage && groupId && senderId > 0 && !senderName) {
        try {
          const profile = await userService.getUserProfileAsync(senderId);
          if (profile) {
            senderName = profile.nickName || profile.username || `User ${senderId}`;
            senderAvatar = profile.avatarPath || profile.avatar || null;
          }
        } catch {}
      }

      const newMsg: IMessage = {
        id: 0,
        serverId,
        senderId,
        receiverId,
        groupId,
        noteId,
        senderName: senderName || undefined,
        senderAvatar: senderAvatar || undefined,
        isMyMessage,
        isSentToServer: true,
        text,
        isRead,
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

      if (!isMyMessage && currentId > 0) {
        try {
          const db = getLocalDatabase(currentId);
          await db.transaction('rw',db.messages,async()=> {
            const existing = serverId>0 ? await db.messages.where('serverId').equals(serverId).first() : undefined;
            if(existing) Object.assign(newMsg,existing);
            else {
              const {id:_,...toInsert}=newMsg;
              newMsg.id=Number(await db.messages.add(toInsert as any));
            }
          });
        } catch (err) {
          console.warn('[SignalR] Ошибка сохранения сообщения в локальную БД:', err);
        }
      }

      eventBus.emit('ReceiveMessage', newMsg);
      if (!noteId) {
        const [previewText, msgType] = MessagePreviewHelper.formatPreviewFromMessage(
          newMsg,
          currentId,
          Boolean(groupId && groupId > 0),
          false
        );

        eventBus.emit('SidebarUpdateMessage', {
          userId: isMyMessage ? receiverId : senderId,
          groupId,
          previewText,
          incrementUnread: !isMyMessage,
          messageType: msgType,
        });
      }
    });

    this.hubConnection.on(
      'AttachmentProcessed',
      (
        fileHash: string,
        fileName: string,
        finalUrl: string,
        thumbnailUrl: string,
        width: number,
        height: number,
        hasAudio: boolean,
        finalType: number
      ) => {
        eventBus.emit('AttachmentProcessedMessage' as any, {
          fileHash,
          fileName,
          finalUrl: UrlHelper.normalize(finalUrl, this.serverUrl),
          thumbnailUrl: UrlHelper.normalize(thumbnailUrl, this.serverUrl),
          width,
          height,
          hasAudio,
          finalType,
        });
      }
    );

    // 🟢 2. ВХОДЯЩИЙ ХЭНДШЕЙК СЕКРЕТНОГО ЧАТА (БОБ)
    this.hubConnection.on(
      'IncomingSecretChatRequest',
      async (
        initiatorId: number,
        initiatorName: string,
        initiatorAvatar: any,
        secretChatId: string,
        pubKey: string
      ) => {
        console.log(
          `%c[SignalR 📥 IncomingSecretChatRequest] От InitiatorId=${initiatorId}, ChatId=${secretChatId}`,
          'color: #4ADE80; font-weight: bold;'
        );

        try {
          const currentUserId = Number(userSession.userId || 0);
          const { publicKeyBase64: bobPubKey, fingerprint, protectedState } =
            await secretChatCrypto.processIncomingHandshake(secretChatId, initiatorId, pubKey);

          const db = getLocalDatabase(currentUserId);
          const existing = await db.cachedSecretChats.get(secretChatId);

          const cachedItem: ICachedSecretChat = {
            secretChatId,
            targetUserId: initiatorId,
            targetName: initiatorName,
            targetAvatar: typeof initiatorAvatar === 'string' ? initiatorAvatar : null,
            sharedKey: protectedState,
            keyFingerprint: fingerprint,
            emojiFingerprint: secretChatCrypto.getSession(secretChatId)?.emojiFingerprint || '',
            isEstablished: true,
            lastMessage: '🔒 Секретный чат создан.',
            lastMessageTime: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          };

          if (!existing) {
            await db.cachedSecretChats.add(cachedItem);
          } else {
            await db.cachedSecretChats.put(cachedItem);
          }

          await this.acceptSecretChatAsync(initiatorId, secretChatId, bobPubKey);

          const secretChat: IChatListItem = {
            id: initiatorId,
            userId: initiatorId,
            groupId: null,
            nickName: initiatorName,
            groupName: '',
            avatarPath: typeof initiatorAvatar === 'string' ? initiatorAvatar : null,
            isGroup: false,
            isChannel: false,
            isSecretChat: true,
            secretChatId,
            keyFingerprint: fingerprint,
            lastMessage: '🔒 Секретный чат создан.',
            lastMessageType: LastMessageType.None,
            lastMessageTime: new Date().toISOString(),
            unreadCount: 0,
            isPinned: false,
            isMuted: false,
            isBlocked: false,
            isOnline: false,
            isTyping: false,
            adminId: 0,
            memberCount: 0,
            onlineCount: 0,
            lastSeen: new Date().toISOString(),
            groupDescription: '',
            isPublic: false,
            groupLink: '',
            folderIds: [],
            isLastAttachmentGif: false,
            isLastMessageDeletedForMe: false,
          };

          eventBus.emit('SecretChatCreatedMessage' as any, { secretChat });
          eventBus.emit('SecretChatEstablishedMessage' as any, { secretChatId, keyFingerprint: fingerprint });
        } catch (ex) {
          console.error('[E2EE ERROR] Ошибка обработки IncomingSecretChatRequest:', ex);
        }
      }
    );

    // 🟢 3. ХЭНДШЕЙК ПРИНЯТ (АЛИСА)
    this.hubConnection.on(
      'SecretChatAccepted',
      async (responderId: number, secretChatId: string, pubKey: string) => {
        console.log(
          `%c[SignalR 📥 SecretChatAccepted] Боб принял чат! ResponderId=${responderId}, ChatId=${secretChatId}`,
          'color: #F59E0B; font-weight: bold;'
        );

        try {
          const currentUserId = Number(userSession.userId || 0);
          const db = getLocalDatabase(currentUserId);
          const cached = await db.cachedSecretChats.get(secretChatId);
          if (!cached) {
            console.error(`[E2EE ❌] CachedSecretChat не найден для ${secretChatId}!`);
            return;
          }

          const { fingerprint, protectedState } = await secretChatCrypto.completeOutgoingHandshake(
            secretChatId,
            pubKey,
            cached.localPrivateKeyBase64
          );

          cached.sharedKey = protectedState;
          cached.keyFingerprint = fingerprint;
          cached.isEstablished = true;
          cached.localPrivateKeyBase64 = null;
          cached.lastMessage = '🔒 Секретный чат создан.';
          cached.lastMessageTime = new Date().toISOString();

          await db.cachedSecretChats.put(cached);

          eventBus.emit('SecretChatEstablishedMessage' as any, { secretChatId, keyFingerprint: fingerprint });
          eventBus.emit('SidebarUpdateMessage', {
            userId: responderId,
            groupId: null,
            previewText: '🔒 Секретный чат создан.',
            incrementUnread: false,
            messageType: LastMessageType.None,
            secretChatId,
          });
        } catch (ex) {
          console.error('[E2EE ERROR] Ошибка завершения хэндшейка в SecretChatAccepted:', ex);
        }
      }
    );

    // 🟢 4. ВХОДЯЩЕЕ СЕКРЕТНОЕ СООБЩЕНИЕ
    this.hubConnection.on(
      'ReceiveSecretMessage',
      async (
        senderId: number,
        secretChatId: string,
        ciphertext: string,
        nonce: string,
        tag: string,
        seq: number,
        timestamp: any
      ) => {
        console.log(
          `%c[SignalR 📥 ReceiveSecretMessage] Получен пакет: SenderId=${senderId}, ChatId=${secretChatId}, Seq=${seq}`,
          'color: #3B82F6; font-weight: bold;'
        );

        try {
          const currentUserId = Number(userSession.userId || 0);
          const db = getLocalDatabase(currentUserId);

          let session = secretChatCrypto.getSession(secretChatId);
          if (!session || !session.isEstablished) {
            console.warn(`[SignalR ⚡] Сессия ${secretChatId} отсутствует в памяти, восстанавливаем из IndexedDB...`);
            const cached = await db.cachedSecretChats.get(secretChatId);
            if (cached?.sharedKey) {
              secretChatCrypto.restoreSessionFromProtectedState(
                cached.secretChatId,
                typeof cached.sharedKey === 'string' ? cached.sharedKey : ''
              );
              session = secretChatCrypto.getSession(secretChatId);
            } else {
              console.error(`[SignalR ❌] В IndexedDB не найден SharedKey для секретного чата ${secretChatId}!`);
              return;
            }
          }

          const { decryptedText: decryptedPayload, updatedProtectedState } =
            await secretChatCrypto.decryptText(secretChatId, ciphertext, nonce, tag, Number(seq));

          console.log(
            `%c[SignalR 📥 ✅ РАСШИФРОВАНО] Payload='${decryptedPayload.substring(0, 50)}...'`,
            'color: #10B981; font-weight: bold;'
          );

          let finalText = decryptedPayload;
          let replyText: string | null = null;
          let replySender: string | null = null;
          let incomingAttachments: AttachmentDto[] | null = null;

          if (decryptedPayload.startsWith('{') && decryptedPayload.endsWith('}')) {
            try {
              const payload = JSON.parse(decryptedPayload);
              if (payload) {
                finalText = payload.text ?? payload.Text ?? '';
                replyText = payload.replyText ?? payload.ReplyText ?? null;
                replySender = payload.replySender ?? payload.ReplySender ?? null;
                incomingAttachments = payload.attachments ?? payload.Attachments ?? null;
              }
            } catch (jsonErr) {
              console.warn('[SignalR] Payload не является JSON, обрабатывается как обычный текст.');
            }
          }

          const isoTimestamp = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

          const newMsg: IMessage = {
            id: 0,
            serverId: 0,
            senderId,
            receiverId: currentUserId,
            secretChatId,
            text: finalText,
            timestamp: isoTimestamp,
            isMyMessage: false,
            isSentToServer: true,
            isRead: false,
            isDeleted: false,
            isDeletedForMe: false,
            isPinned: false,
            viewsCount: 1,
            replyToMessageIds: replyText ? `sec::${replySender}::${replyText}` : null,
            attachments: (incomingAttachments || []).map((a, idx) => ({
              id: idx + 1,
              messageId: 0,
              type: a.type as AttachmentType,
              fileName: a.fileName,
              fileSizeStr: a.fileSizeStr,
              fileSizeBytes: 0,
              url: a.url,
              thumbnailUrl: a.thumbnailUrl,
              fileHash: a.fileHash,
              hasAudio: Boolean(a.hasAudio),
              width: a.width || 0,
              height: a.height || 0,
              durationSeconds: a.durationSeconds || 0,
            })),
            repliedMessages: replyText
              ? [
                  {
                    id: 0,
                    senderName: replySender || 'User',
                    text: replyText,
                  } as any,
                ]
              : [],
          };

          const { id: _, ...toInsert } = newMsg;
          const localId = await db.messages.add(toInsert as any);
          newMsg.id = Number(localId);

          const cachedChat = await db.cachedSecretChats.get(secretChatId);
          const [sidebarPreview, msgType] = MessagePreviewHelper.formatPreviewFromMessage(newMsg, currentUserId, false, false);

          if (cachedChat) {
            cachedChat.sharedKey = updatedProtectedState;
            cachedChat.lastMessage = sidebarPreview;
            cachedChat.lastMessageTime = new Date().toISOString();
            await db.cachedSecretChats.put(cachedChat);
          }

          console.log(
            `%c[SignalR 📢 EventBus] Эмитим SecretMessageReceivedMessage для ChatId=${secretChatId}`,
            'color: #3B82F6;'
          );

          eventBus.emit('SidebarUpdateMessage', {
            userId: senderId,
            groupId: null,
            previewText: sidebarPreview,
            incrementUnread: true,
            messageType: msgType,
            secretChatId,
          });

          eventBus.emit('SecretMessageReceivedMessage' as any, {
            senderId,
            secretChatId,
            ciphertext: finalText,
            nonce,
            tag,
            timestamp: isoTimestamp,
            replyText,
            replySender,
            incomingAttachments,
            message: newMsg,
          });
        } catch (ex) {
          console.error(`❌ [SIGNALR CRITICAL] Сбой расшифровки секретного сообщения: SenderId=${senderId}, ChatId=${secretChatId}, Seq=${seq}`, ex);
        }
      }
    );

    // 🟢 5. СБРОС И ПРОЧТЕНИЕ
    this.hubConnection.on('SecretChatDiscarded', async (senderId: number, secretChatId: string) => {
      console.log(
        `%c[SignalR 📥 SecretChatDiscarded] Собеседник сбросил чат: SenderId=${senderId}, ChatId=${secretChatId}`,
        'color: #EF4444; font-weight: bold;'
      );

      try {
        const currentUserId = Number(userSession.userId || 0);
        const db = getLocalDatabase(currentUserId);

        await db.cachedSecretChats.delete(secretChatId);
        await db.messages.where('secretChatId').equals(secretChatId).delete();
      } catch (ex) {
        console.error('[SignalRService] Ошибка локального удаления сброшенного секретного чата:', ex);
      }

      eventBus.emit('SecretChatDiscardedMessage' as any, { senderId, secretChatId });
    });

    this.hubConnection.on('SecretChatWereRead', async (readerId: number, secretChatId: string) => {
      try {
        const currentUserId = Number(userSession.userId || 0);
        const db = getLocalDatabase(currentUserId);

        const myMsgs = await db.messages
          .filter((m) => m.secretChatId === secretChatId && Boolean(m.isMyMessage) && !m.isRead)
          .toArray();

        for (const m of myMsgs) {
          if (m.id) await db.messages.update(m.id, { isRead: true });
        }
      } catch (ex) {
        console.error('[SignalRService] Ошибка обновления статуса прочтения секретного чата:', ex);
      }

      eventBus.emit('SecretChatWereReadMessage' as any, { readerId, secretChatId });
    });

    // 🟢 6. СТАТУСЫ ОНЛАЙНА
    const presenceConnection=this.hubConnection;const presenceOwner=Number(userSession.userId||0);
    this.hubConnection.on('GroupPresenceChanged',(groupId:number,onlineCount:number,memberCount:number)=>{
      if(this.hubConnection!==presenceConnection||Number(userSession.userId||0)!==presenceOwner)return;
      eventBus.emit('GroupPresenceChangedMessage' as any,{groupId,onlineCount,memberCount});
    });
    this.hubConnection.on('UserStatusChanged', (userId: any, isOnline: any, lastSeen: any) => {
      if(this.hubConnection!==presenceConnection||Number(userSession.userId||0)!==presenceOwner)return;
      const uid = Number(userId);
      const parsedPresence = parsePresence(isOnline); if(!parsedPresence)return;
      const online = parsedPresence.isOnline;
      const seen =
        typeof lastSeen === 'string'
          ? lastSeen
          : lastSeen
          ? new Date(lastSeen).toISOString()
          : '0001-01-01T00:00:00Z';

      eventBus.emit('UserStatusChangedMessage', {
        userId: uid,
        isOnline: online,
        lastSeen: seen,
      });
    });

    this.hubConnection.on('SyncTimer', () => {
      eventBus.emit('SyncTimerMessage' as any, undefined);
    });

    this.hubConnection.on('NoteUpdated', (noteId: number) => {
      eventBus.emit('NoteUpdated' as any, Number(noteId));
    });

    this.hubConnection.on('NoteDeleted', (noteId: number) => {
      eventBus.emit('NoteDeleted' as any, Number(noteId));
    });

    this.hubConnection.on('MessagesWereRead', (readerId: number, maxReadId: number) => {
      eventBus.emit('MessagesWereReadMessage', { readerId: Number(readerId), maxReadId: Number(maxReadId) });
    });

    this.hubConnection.on('MessageEdited', (serverId: number, newText: string, attachments: any) => {
      eventBus.emit('MessageEditedMessage', { serverId: Number(serverId), newText, attachments });
    });

    this.hubConnection.on('MessageDeleted', (serverId: number, isForAll: boolean) => {
      eventBus.emit('MessageDeletedMessage', { serverId: Number(serverId), isForAll: Boolean(isForAll) });
    });

    this.hubConnection.on('MessagePinned', (serverMessageId: number, isPinned: boolean) => {
      eventBus.emit('MessagePinnedMessage', { serverMessageId: Number(serverMessageId), isPinned: Boolean(isPinned) });
    });

    this.hubConnection.on('MessageViewsUpdated', (serverMessageId: number, viewsCount: number) => {
      eventBus.emit('MessageViewsUpdatedMessage', { serverMessageId: Number(serverMessageId), viewsCount: Number(viewsCount) });
    });

    this.hubConnection.on('ChatClearedForBoth', (blockerId: number) => {
      eventBus.emit('ChatClearedForBothMessage', { blockerId: Number(blockerId) });
    });

    this.hubConnection.on('BlockStatusChanged', (blockerId: number, isBlocked: boolean) => {
      eventBus.emit('BlockStatusChangedMessage' as any, {
        targetUserId: Number(blockerId),
        blockerId: Number(blockerId),
        isBlocked: Boolean(isBlocked),
      });
    });

    this.hubConnection.on('ReceiveTyping', (senderId: number, groupId: number | null) => {
      eventBus.emit('UserTypingMessage', { senderId: Number(senderId), groupId: groupId ? Number(groupId) : null });
    });

    this.hubConnection.on('KickedFromGroup', (groupId: number) => {
      eventBus.emit('KickedFromGroupMessage' as any, { groupId: Number(groupId) });
    });

    this.hubConnection.on('UserJoinedGroup', (groupId: number, member: any, memberCount: number, onlineCount: number) => {
      eventBus.emit('UserJoinedGroupMessage' as any, { groupId, member, memberCount, onlineCount });
    });

    this.hubConnection.on('UserLeftGroup', (groupId: number, userId: number, memberCount: number, onlineCount: number) => {
      eventBus.emit('UserLeftGroupMessage' as any, { groupId, userId, memberCount, onlineCount });
    });

    this.hubConnection.on('GroupUpdated', (groupId: number, newName: string, newAvatar: any, newDescription: string | null) => {
      eventBus.emit('GroupUpdatedMessage' as any, { groupId, newName, newAvatar, newDescription });
    });

    this.hubConnection.on('GroupPermissionsChanged', (groupId: number, canText: boolean, canMedia: boolean, canPin: boolean) => {
      eventBus.emit('GroupPermissionsChangedMessage' as any, { groupId, canText, canMedia, canPin });
    });

    this.hubConnection.on('ReceiveWebRTCData', (senderId: number, data: string) => {
      eventBus.emit('WebRTCDataMessage', { senderId: Number(senderId), data });
    });

    this.hubConnection.on('IncomingCall', (callerId: number, callerName: string, callerAvatar: string | null) => {
      eventBus.emit('IncomingCallMessage', { callerId: Number(callerId), callerName, callerAvatar });
    });

    this.hubConnection.on('CallResponse', (receiverId: number, accepted: boolean) => {
      eventBus.emit('CallResponseMessage', { receiverId: Number(receiverId), accepted: Boolean(accepted) });
    });

    this.hubConnection.on('CallEnded', (targetId: number) => {
      eventBus.emit('CallEndedMessage', { targetId: Number(targetId) });
    });

    this.hubConnection.on('IncomingGroupCall', (groupId: number, groupName: string, callerId: number, callerName: string, callerAvatar: string | null) => {
      eventBus.emit('IncomingGroupCallMessage', { groupId: Number(groupId), groupName, callerId: Number(callerId), callerName, callerAvatar });
    });

    this.hubConnection.on('GroupCallJoined', (groupId: number, participants: any[]) => {
      eventBus.emit('GroupCallJoinedMessage', { groupId: Number(groupId), participants });
    });

    this.hubConnection.on('UserJoinedGroupCall', (groupId: number, participant: any) => {
      eventBus.emit('UserJoinedGroupCallMessage', { groupId: Number(groupId), participant });
    });

    this.hubConnection.on('UserLeftGroupCall', (groupId: number, userId: number) => {
      eventBus.emit('UserLeftGroupCallMessage', { groupId: Number(groupId), userId: Number(userId) });
    });

    this.hubConnection.on('ReceiveGroupCallWebRTCData', (groupId: number, senderId: number, data: string) => {
      eventBus.emit('GroupCallWebRTCDataMessage', { groupId: Number(groupId), senderId: Number(senderId), data });
    });

    this.hubConnection.on('TaskCreated', (taskDto: any) => eventBus.emit('TaskCreated', taskDto));
    this.hubConnection.on('TaskUpdated', (taskDto: any) => eventBus.emit('TaskUpdated', taskDto));
    this.hubConnection.on('TaskDeleted', (taskId: number) => eventBus.emit('TaskDeleted', { taskId: Number(taskId) }));
    this.hubConnection.on('TaskListCreated', (listDto: any) => eventBus.emit('TaskListCreated', listDto));
    this.hubConnection.on('TaskListUpdated', (listDto: any) => eventBus.emit('TaskListUpdated', listDto));
    this.hubConnection.on('TaskListDeleted', (listId: number) => eventBus.emit('TaskListDeleted', { listId: Number(listId) }));

    this.hubConnection.on('UserProfileUpdated', (rawUser: any) => {
      if (!rawUser) return;
      const updatedUser: IUser = {
        id: Number(rawUser.id ?? rawUser.Id),
        username: String(rawUser.username ?? rawUser.Username ?? ''),
        nickName: String(rawUser.nickName ?? rawUser.NickName ?? ''),
        firstName: rawUser.firstName ?? rawUser.FirstName ?? null,
        lastName: rawUser.lastName ?? rawUser.LastName ?? null,
        email: String(rawUser.email ?? rawUser.Email ?? ''),
        phone: rawUser.phone ?? rawUser.Phone ?? null,
        description: rawUser.description ?? rawUser.Description ?? null,
        gender: rawUser.gender ?? rawUser.Gender ?? null,
        birthday: rawUser.birthday ?? rawUser.Birthday ?? null,
        avatar: rawUser.avatar ?? rawUser.Avatar ?? null,
        avatarPath: rawUser.avatarPath ?? rawUser.AvatarPath ?? null,
        registrationDate: rawUser.registrationDate ?? rawUser.RegistrationDate ?? new Date().toISOString(),
        isOnline: Boolean(rawUser.isOnline ?? rawUser.IsOnline),
        lastSeen: rawUser.lastSeen ?? rawUser.LastSeen ?? new Date().toISOString(),
      };
      eventBus.emit('UserProfileUpdatedMessage', { user: updatedUser });
    });

    this.hubConnection.on('PrivacySettingsUpdated', (rawSettings: any) => {
      if (!rawSettings) return;
      const dto: PrivacySettingsDto = {
        fullNameVisibility: parsePrivacyVisibility(rawSettings.fullNameVisibility ?? rawSettings.FullNameVisibility),
        genderVisibility: parsePrivacyVisibility(rawSettings.genderVisibility ?? rawSettings.GenderVisibility),
        descriptionVisibility: parsePrivacyVisibility(rawSettings.descriptionVisibility ?? rawSettings.DescriptionVisibility),
        lastSeenVisibility: parsePrivacyVisibility(rawSettings.lastSeenVisibility ?? rawSettings.LastSeenVisibility),
        avatarVisibility: parsePrivacyVisibility(rawSettings.avatarVisibility ?? rawSettings.AvatarVisibility),
        emailVisibility: parsePrivacyVisibility(rawSettings.emailVisibility ?? rawSettings.EmailVisibility),
        phoneVisibility: parsePrivacyVisibility(rawSettings.phoneVisibility ?? rawSettings.PhoneVisibility),
        birthdayVisibility: parsePrivacyVisibility(rawSettings.birthdayVisibility ?? rawSettings.BirthdayVisibility),
      };
      eventBus.emit('PrivacySettingsUpdatedMessage', { settings: dto });
    });

    this.hubConnection.on('ChatFolderCreated', (rawFolder: any) => {
      if (!rawFolder) return;
      const folder: IChatFolder = {
        id: Number(rawFolder.id ?? rawFolder.Id),
        name: String(rawFolder.name ?? rawFolder.Name ?? ''),
        orderIndex: Number(rawFolder.orderIndex ?? rawFolder.OrderIndex ?? 0),
        isSystem: Boolean(rawFolder.isSystem ?? rawFolder.IsSystem),
        icon: rawFolder.icon ?? rawFolder.Icon ?? 'FolderOutline',
        color: rawFolder.color ?? rawFolder.Color ?? '#FF3B30',
        isSelected: false,
        isDragging: false,
      };

      const { chatFolders, customFolders } = useChatFolderStore.getState();
      if (!chatFolders.some((f) => f.id === folder.id)) {
        useChatFolderStore.setState({
          chatFolders: [...chatFolders, folder].sort((a, b) => a.orderIndex - b.orderIndex),
          customFolders: [...customFolders, folder].sort((a, b) => a.orderIndex - b.orderIndex),
        });
      }
    });

    this.hubConnection.on('ChatFolderUpdated', (rawFolder: any) => {
      if (!rawFolder) return;
      const folderId = Number(rawFolder.id ?? rawFolder.Id);
      const name = String(rawFolder.name ?? rawFolder.Name ?? '');
      const icon = rawFolder.icon ?? rawFolder.Icon ?? 'FolderOutline';
      const color = rawFolder.color ?? rawFolder.Color ?? '#FF3B30';
      const orderIndex = Number(rawFolder.orderIndex ?? rawFolder.OrderIndex ?? 0);
      const isSystem = Boolean(rawFolder.isSystem ?? rawFolder.IsSystem);

      const { chatFolders, customFolders, selectedFolderId } = useChatFolderStore.getState();
      useChatFolderStore.setState({
        chatFolders: chatFolders.map((f) => (f.id === folderId ? { ...f, name, icon, color, orderIndex, isSystem } : f)),
        customFolders: customFolders.map((f) => (f.id === folderId ? { ...f, name, icon, color, orderIndex, isSystem } : f)),
      });

      if (selectedFolderId === folderId) {
        useSidebarChatsStore.getState().selectFolder(folderId, false);
      }
    });

    this.hubConnection.on('ChatFolderDeleted', (deletedFolderId: any) => {
      const id = Number(deletedFolderId);
      const { chatFolders, customFolders, selectedFolderId, selectFolder } = useChatFolderStore.getState();
      const filteredChatFolders = chatFolders.filter((f) => f.id !== id);
      const filteredCustom = customFolders.filter((f) => f.id !== id);

      useChatFolderStore.setState({ chatFolders: filteredChatFolders, customFolders: filteredCustom });

      if (selectedFolderId === id) {
        const allFolder = filteredChatFolders.find((f) => f.isSystem && f.name === 'All') || filteredChatFolders[0];
        if (allFolder) selectFolder(allFolder);
      }
    });

    this.hubConnection.on('ChatFoldersOrderUpdated', (rawOrders: any[]) => {
      if (!Array.isArray(rawOrders)) return;
      const orderMap = new Map<number, number>(
        rawOrders.map((o: any) => [
          Number(o.folderId ?? o.FolderId ?? o.id ?? o.Id),
          Number(o.orderIndex ?? o.OrderIndex ?? 0),
        ])
      );

      const { chatFolders, customFolders } = useChatFolderStore.getState();
      useChatFolderStore.setState({
        chatFolders: chatFolders
          .map((f) => ({ ...f, orderIndex: orderMap.has(f.id) ? orderMap.get(f.id)! : f.orderIndex }))
          .sort((a, b) => a.orderIndex - b.orderIndex),
        customFolders: customFolders
          .map((f) => ({ ...f, orderIndex: orderMap.has(f.id) ? orderMap.get(f.id)! : f.orderIndex }))
          .sort((a, b) => a.orderIndex - b.orderIndex),
      });
    });

    this.hubConnection.on('ChatFolderChatToggled', (folderId: any, targetUserId: any, targetGroupId: any, isAdded: boolean) => {
      const fId = Number(folderId);
      const tUid = targetUserId ? Number(targetUserId) : null;
      const tGid = targetGroupId ? Number(targetGroupId) : null;
      const isGroup = Boolean(tGid && tGid > 0);
      const chatId = isGroup ? tGid! : (tUid ?? 0);
      useSidebarChatsStore.getState().updateChatFolderIds(chatId, isGroup, fId, Boolean(isAdded));
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

  public async getGroupPresenceSnapshotAsync(groupIds:number[]):Promise<Record<number,GroupPresence>|null> {return this.safeInvoke<Record<number,GroupPresence>>('GetGroupPresenceSnapshot',groupIds);}

  public async getPresenceSnapshotAsync(userIds: number[]): Promise<Record<number,UserPresence>|null> {
    if(!userIds?.length)return null;
    return this.safeInvoke<Record<number,UserPresence>>('GetPresenceSnapshot',userIds);
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

  public async requestSecretChatAsync(targetUserId: number, secretChatId: string, publicKey: string): Promise<void> {
    console.log(
      `%c[SignalR 📤 RequestSecretChat] Вызов RPC: TargetUser=${targetUserId}, ChatId=${secretChatId}`,
      'color: #00AFF4; font-weight: bold;'
    );
    await this.safeInvoke('RequestSecretChat', targetUserId, secretChatId, publicKey);
  }

  public async acceptSecretChatAsync(targetUserId: number, secretChatId: string, publicKey: string): Promise<void> {
    console.log(
      `%c[SignalR 📤 AcceptSecretChat] Вызов RPC: TargetUser=${targetUserId}, ChatId=${secretChatId}`,
      'color: #4ADE80; font-weight: bold;'
    );
    await this.safeInvoke('AcceptSecretChat', targetUserId, secretChatId, publicKey);
  }

  public async discardSecretChatAsync(targetUserId: number, secretChatId: string): Promise<void> {
    console.log(
      `%c[SignalR 📤 DiscardSecretChat] Вызов RPC: TargetUser=${targetUserId}, ChatId=${secretChatId}`,
      'color: #EF4444; font-weight: bold;'
    );
    await this.safeInvoke('DiscardSecretChat', targetUserId, secretChatId);
  }

  public async markSecretChatAsReadAsync(targetUserId: number, secretChatId: string): Promise<void> {
    console.log(
      `%c[SignalR 📤 MarkSecretChatAsRead] Вызов RPC: TargetUser=${targetUserId}, ChatId=${secretChatId}`,
      'color: #10B981;'
    );
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
    console.log(
      `%c[SignalR 📤 SendSecretMessage] Вызов RPC: TargetUser=${targetUserId}, ChatId=${secretChatId}, Seq=${sequenceNumber}, CipherLen=${ciphertext.length}`,
      'color: #38BDF8; font-weight: bold;'
    );
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