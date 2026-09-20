import { create } from 'zustand';
import {
  IMessage,
  IUserSearchResult,
  IAttachment,
  ISelectableChat,
  IAudioTrackModel,
} from '../types/models';
import { AttachmentType } from '../types/enums';
import { chatService } from '../services/chat.service';
import { signalRService } from '../services/signalr.service';
import { userService } from '../services/user.service';
import { groupService } from '../services/group.service';
import { secretChatCrypto } from '../services/secretChatCrypto.service';
import { userSession } from '../services/userSession';
import { eventBus } from '../services/eventBus';

interface ChatState {
  selectedChatUser: IUserSearchResult | null;
  currentChatMessages: IMessage[];
  pinnedMessages: IMessage[];
  chatSearchResults: IMessage[];
  forwardChatList: ISelectableChat[];
  isChatSearching: boolean;
  isChatSearchMode: boolean;
  chatSearchText: string;
  isChatLoading: boolean;
  isHistoryLoading: boolean;
  isScrolledToBottom: boolean;
  unreadCountInActiveChat: number;

  // Права
  isCurrentChatJoined: boolean;
  isBlockedByMe: boolean;
  isBlockedByThem: boolean;
  canSendText: boolean;
  canSendMedia: boolean;
  canPinMessages: boolean;

  // Мультивыбор
  isSelectionMode: boolean;
  selectedCount: number;

  // Модальные окна
  isPinDialogOpen: boolean;
  messageToPin: IMessage | null;
  isForwardDialogOpen: boolean;
  messagesToForward: IMessage[];

  // Actions
  selectChatUser: (target: IUserSearchResult | null) => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  ensureMessageLoadedAsync: (messageId: number) => Promise<IMessage | null>;
  sendMessage: (text: string, attachments: IAttachment[], editingMessage: IMessage | null, replies: IMessage[]) => Promise<void>;
  editMessage: (localId: number, serverId: number, text: string) => Promise<void>;
  deleteMessage: (msg: IMessage, deleteForAll: boolean) => Promise<void>;
  togglePinMessage: (msg: IMessage, pinForAll: boolean) => Promise<void>;
  toggleSelectMessage: (msg: IMessage) => void;
  clearSelection: () => void;
  forwardMessages: (messages: IMessage[]) => void;
  confirmForward: (selectedChatIds: number[]) => Promise<void>;
  startSearch: () => void;
  exitSearch: () => void;
  markAsRead: () => Promise<void>;
  trackVisiblePosts: (serverIds: number[]) => void;
  toggleAudio: (clickedAtt: IAttachment) => void;
}

const alreadyTrackedPostIds = new Set<number>();

export const useChatStore = create<ChatState>((set, get) => ({
  selectedChatUser: null,
  currentChatMessages: [],
  pinnedMessages: [],
  chatSearchResults: [],
  forwardChatList: [],
  isChatSearching: false,
  isChatSearchMode: false,
  chatSearchText: '',
  isChatLoading: false,
  isHistoryLoading: false,
  isScrolledToBottom: true,
  unreadCountInActiveChat: 0,

  isCurrentChatJoined: true,
  isBlockedByMe: false,
  isBlockedByThem: false,
  canSendText: true,
  canSendMedia: true,
  canPinMessages: true,

  isSelectionMode: false,
  selectedCount: 0,
  isPinDialogOpen: false,
  messageToPin: null,
  isForwardDialogOpen: false,
  messagesToForward: [],

  // 1. Выбор чата и загрузка истории (по OnSelectedChatUserChanged)
  selectChatUser: async (target) => {
    if (!target) {
      set({ selectedChatUser: null, currentChatMessages: [], pinnedMessages: [] });
      return;
    }

    alreadyTrackedPostIds.clear();

    set({
      selectedChatUser: target,
      isHistoryLoading: true,
      currentChatMessages: [],
      pinnedMessages: [],
      isSelectionMode: false,
      selectedCount: 0,
    });

    const currentUserId = userSession.userId;
    const targetUserId = target.isGroup ? null : target.id;
    const groupId = target.isGroup ? target.id : null;
    const secretChatId = target.isSecretChat ? target.secretChatId : null;

    try {
      if (secretChatId) {
        const cachedSecret = await chatService.getCachedSecretChatAsync(secretChatId);
        if (cachedSecret?.sharedKey) {
          secretChatCrypto.restoreSessionFromProtectedState(secretChatId, cachedSecret.sharedKey);
        }
      }

      const cached = await chatService.getLocalMessagesAsync(currentUserId, targetUserId, groupId, secretChatId, 30);
      const pinned = await chatService.getLocalPinnedMessagesAsync(currentUserId, targetUserId, groupId, secretChatId);

      set({
        currentChatMessages: cached,
        pinnedMessages: pinned,
        isHistoryLoading: false,
      });

      await get().markAsRead();
    } catch (e) {
      console.error('[ChatStore] Ошибка загрузки чата:', e);
      set({ isHistoryLoading: false });
    }
  },

  loadOlderMessages: async () => {
    const { selectedChatUser, currentChatMessages, isHistoryLoading } = get();
    if (!selectedChatUser || currentChatMessages.length === 0 || isHistoryLoading) return;

    set({ isHistoryLoading: true });
    const oldestTime = currentChatMessages[0].timestamp;
    const currentUserId = userSession.userId;

    try {
      const older = await chatService.getLocalMessagesAsync(
        currentUserId,
        selectedChatUser.isGroup ? null : selectedChatUser.id,
        selectedChatUser.isGroup ? selectedChatUser.id : null,
        selectedChatUser.isSecretChat ? selectedChatUser.secretChatId : null,
        30,
        oldestTime
      );

      if (older.length > 0) {
        set({ currentChatMessages: [...older, ...currentChatMessages] });
      }
    } finally {
      set({ isHistoryLoading: false });
    }
  },

  // 2. Догрузка сообщений при переходе к цитате (EnsureMessageLoadedAsync)
  ensureMessageLoadedAsync: async (messageId: number) => {
    const { currentChatMessages, loadOlderMessages } = get();
    let found = currentChatMessages.find((m) => m.id === messageId || (m.serverId > 0 && m.serverId === messageId));
    if (found) return found;

    for (let i = 0; i < 10; i++) {
      await loadOlderMessages();
      found = get().currentChatMessages.find((m) => m.id === messageId || (m.serverId > 0 && m.serverId === messageId));
      if (found) return found;
    }

    return null;
  },

  // 3. Отправка сообщений (обычные, группы, E2EE секретные чаты)
  sendMessage: async (text, attachments, editingMessage, replies) => {
    const { selectedChatUser, currentChatMessages } = get();
    if (!selectedChatUser) return;

    if (editingMessage) {
      await get().editMessage(editingMessage.id, editingMessage.serverId, text);
      return;
    }

    const currentUserId = userSession.userId;
    const isSecret = selectedChatUser.isSecretChat && selectedChatUser.secretChatId;

    // --- СЕКРЕТНЫЙ ЧАТ ---
    if (isSecret) {
      const secretChatId = selectedChatUser.secretChatId!;
      const replySender = replies[0]?.senderName || null;
      const replyText = replies[0]?.text || null;

      const payload = {
        text,
        replySender,
        replyText,
        attachments: attachments.map((a) => ({
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
        })),
      };

      const encrypted = await secretChatCrypto.encryptText(secretChatId, JSON.stringify(payload));

      const newSecretMsg: IMessage = {
        id: Date.now(),
        serverId: 0,
        senderId: currentUserId,
        receiverId: selectedChatUser.id,
        secretChatId,
        text,
        timestamp: new Date().toISOString(),
        isMyMessage: true,
        isSentToServer: true,
        isRead: false,
        isDeleted: false,
        isDeletedForMe: false,
        isPinned: false,
        viewsCount: 1,
        replyToMessageIds: replyText ? `sec::${replySender}::${replyText}` : null,
        attachments,
      };

      await chatService.saveMessageLocallyAsync(newSecretMsg);
      set({ currentChatMessages: [...currentChatMessages, newSecretMsg] });

      await ((signalRService as any).sendSecretMessageAsync || signalRService.sendMessageAsync)(
        selectedChatUser.id,
        secretChatId,
        encrypted.ciphertextBase64,
        encrypted.nonceBase64,
        encrypted.tagBase64,
        encrypted.sequenceNumber
      );
      return;
    }

    // --- ОБЫЧНЫЙ ЧАТ / ГРУППА ---
    const replyIds = replies.map((r) => r.serverId || r.id).filter(Boolean).join(',');

    const newMsg: IMessage = {
      id: Date.now(),
      serverId: 0,
      senderId: currentUserId,
      receiverId: selectedChatUser.isGroup ? null : selectedChatUser.id,
      groupId: selectedChatUser.isGroup ? selectedChatUser.id : null,
      text,
      timestamp: new Date().toISOString(),
      isMyMessage: true,
      isSentToServer: false,
      isRead: false,
      isDeleted: false,
      isDeletedForMe: false,
      isPinned: false,
      replyToMessageIds: replyIds || null,
      viewsCount: 1,
      attachments,
      repliedMessages: replies,
    };

    await chatService.saveMessageLocallyAsync(newMsg);
    set({ currentChatMessages: [...currentChatMessages, newMsg] });

    const realId = await signalRService.sendMessageAsync(
  newMsg.receiverId ?? null,
  newMsg.groupId ?? null,
      null,
      text,
      replyIds || null,
      null,
      null,
      null,
      attachments as any
    );

    if (realId > 0) {
      newMsg.serverId = realId;
      newMsg.isSentToServer = true;
      await chatService.markAsSentAsync(newMsg.id, realId);
      set({ currentChatMessages: [...get().currentChatMessages] });
    }
  },

  editMessage: async (localId, serverId, text) => {
    await chatService.updateMessageLocallyAsync(localId, serverId, text);
    set((state) => ({
      currentChatMessages: state.currentChatMessages.map((m) =>
        (localId > 0 && m.id === localId) || (serverId > 0 && m.serverId === serverId)
          ? { ...m, text, editedAt: new Date().toISOString() }
          : m
      ),
    }));

    if (serverId > 0) {
      await signalRService.editMessageAsync(serverId, text);
    }
  },

  deleteMessage: async (msg, deleteForAll) => {
    const currentUserId = userSession.userId;
    await chatService.deleteMessageLocallyAsync(msg.id, msg.serverId, currentUserId, deleteForAll);

    set((state) => ({
      currentChatMessages: deleteForAll || msg.senderId !== currentUserId
        ? state.currentChatMessages.filter((m) => m.id !== msg.id)
        : state.currentChatMessages.map((m) => (m.id === msg.id ? { ...m, isDeletedForMe: true, text: 'This message was deleted' } : m)),
    }));

    if (msg.serverId > 0) {
      await signalRService.deleteMessageAsync(msg.serverId, deleteForAll);
    }
  },

  togglePinMessage: async (msg, pinForAll) => {
    const isPinned = !msg.isPinned;
    await chatService.setMessagePinLocallyAsync(msg.id, msg.serverId, isPinned);

    set((state) => ({
      currentChatMessages: state.currentChatMessages.map((m) => (m.id === msg.id ? { ...m, isPinned } : m)),
      pinnedMessages: isPinned
        ? [...state.pinnedMessages, msg]
        : state.pinnedMessages.filter((p) => p.id !== msg.id && p.serverId !== msg.serverId),
    }));

    if (msg.serverId > 0) {
      await signalRService.setPinAsync(msg.serverId, pinForAll, isPinned);
    }
  },

  toggleSelectMessage: (msg) => {
    set((state) => {
      const msgs = state.currentChatMessages.map((m) => (m.id === msg.id ? { ...m, isSelected: !m.isSelected } : m));
      const count = msgs.filter((m) => m.isSelected).length;
      return { currentChatMessages: msgs, isSelectionMode: count > 0, selectedCount: count };
    });
  },

  clearSelection: () => {
    set((state) => ({
      currentChatMessages: state.currentChatMessages.map((m) => ({ ...m, isSelected: false })),
      isSelectionMode: false,
      selectedCount: 0,
    }));
  },

  forwardMessages: (messages) => {
    set({ messagesToForward: messages, isForwardDialogOpen: true });
  },

  confirmForward: async (selectedChatIds) => {
    const { messagesToForward } = get();
    for (const chatId of selectedChatIds) {
      for (const msg of messagesToForward) {
        await signalRService.sendMessageAsync(
          chatId,
          null,
          null,
          msg.text,
          null,
          msg.senderName,
          msg.senderAvatar,
          msg.senderId,
          msg.attachments as any
        );
      }
    }
    set({ isForwardDialogOpen: false, messagesToForward: [] });
    get().clearSelection();
  },

  startSearch: () => set({ isChatSearchMode: true, chatSearchText: '' }),
  exitSearch: () => set({ isChatSearchMode: false, chatSearchText: '', chatSearchResults: [] }),

  // Внутри useChatStore -> actions:
markAsRead: async () => {
  const { selectedChatUser, currentChatMessages } = get();
  if (!selectedChatUser) return;

  const currentUserId = userSession.userId;
  const targetUserId = selectedChatUser.isGroup ? null : selectedChatUser.id;
  const targetGroupId = selectedChatUser.isGroup ? selectedChatUser.id : null;
  const secretChatId = selectedChatUser.isSecretChat ? selectedChatUser.secretChatId : null;

  // 1. Сбрасываем счетчик непрочитанных в сайдбаре (как ActiveChatUnreadResetMessage в WPF)
  eventBus.emit('ActiveChatUnreadResetMessage' as any, {
    targetUserId,
    targetGroupId,
    secretChatId,
  });

  // 2. В UI помечаем все входящие сообщения как прочитанные
  set((state) => ({
    currentChatMessages: state.currentChatMessages.map((m) =>
      !m.isMyMessage && !m.isRead ? { ...m, isRead: true } : m
    ),
    unreadCountInActiveChat: 0,
  }));

  try {
    // 3. Обработка E2EE секретного чата
    if (secretChatId) {
      await chatService.markSecretMessagesAsReadLocallyAsync(secretChatId);
      if (targetUserId) {
        await (signalRService as any).markSecretChatAsReadAsync?.(targetUserId, secretChatId);
      }
      return;
    }

    // 4. Помечаем входящие сообщения прочитанными в локальной IndexedDB!
    if (targetUserId) {
      await chatService.markIncomingMessagesAsReadLocallyAsync(targetUserId, currentUserId);
    }

    // 5. Уведомляем сервер через SignalR
    const maxOutgoingReadId = await signalRService.markChatAsReadAsync(targetUserId, targetGroupId);

    // 6. Сервер вернул maxOutgoingReadId: собеседник прочитал наши исходящие сообщения
    if (maxOutgoingReadId > 0 && targetUserId) {
      set((state) => ({
        currentChatMessages: state.currentChatMessages.map((m) =>
          m.isMyMessage && !m.isRead && m.serverId > 0 && m.serverId <= maxOutgoingReadId
            ? { ...m, isRead: true }
            : m
        ),
      }));

      // Сохраняем статус прочтения наших сообщений в IndexedDB
      await chatService.markMessagesAsReadLocallyAsync(currentUserId, targetUserId, maxOutgoingReadId);
    }
  } catch (e) {
    console.error('[ChatStore] Ошибка при пометке сообщений прочитанными:', e);
  }
},

  trackVisiblePosts: (serverIds) => {
    const { selectedChatUser } = get();
    if (!selectedChatUser?.isChannel) return;

    const unviewed = serverIds.filter((id) => id > 0 && !alreadyTrackedPostIds.has(id));
    if (unviewed.length === 0) return;

    unviewed.forEach((id) => alreadyTrackedPostIds.add(id));
    signalRService.trackPostViewsAsync(unviewed);
  },

  toggleAudio: (clickedAtt) => {
    const { currentChatMessages, selectedChatUser } = get();
    if (!clickedAtt || !selectedChatUser) return;

    // Сборка плейлиста музыки по логике ToggleAudio из C#
    const tracks: IAudioTrackModel[] = [];
    currentChatMessages.forEach((msg) => {
      (msg.attachments || []).forEach((att) => {
        if (att.type === AttachmentType.Audio) {
          tracks.push({
            attachment: att,
            messageId: msg.serverId || msg.id,
            chatId: selectedChatUser.id,
            chatName: selectedChatUser.nickName,
            isGroup: selectedChatUser.isGroup,
            isChannel: selectedChatUser.isChannel,
            title: att.fileName,
            artist: 'Audio',
            durationStr: att.fileSizeStr,
            durationSeconds: att.durationSeconds,
            isPlaying: att === clickedAtt,
          });
        }
      });
    });

    const targetTrack = tracks.find((t) => t.attachment === clickedAtt) || tracks[0];
    if (targetTrack) {
      eventBus.emit('PlayPlaylistMessage' as any, { tracks, selectedTrack: targetTrack });
    }
  },
  
}));
// 🟢 1. Слушатель дельта-синхронизации (обновляет активный чат при приходе новых данных)
eventBus.on('ActiveChatRefreshRequestedMessage' as any, async () => {
  const { selectedChatUser } = useChatStore.getState();
  if (selectedChatUser) {
    const currentUserId = userSession.userId;
    const targetUserId = selectedChatUser.isGroup ? null : selectedChatUser.id;
    const groupId = selectedChatUser.isGroup ? selectedChatUser.id : null;
    const secretChatId = selectedChatUser.isSecretChat ? selectedChatUser.secretChatId : null;

    const [messages, pinned] = await Promise.all([
      chatService.getLocalMessagesAsync(currentUserId, targetUserId, groupId, secretChatId, 30),
      chatService.getLocalPinnedMessagesAsync(currentUserId, targetUserId, groupId, secretChatId),
    ]);

    useChatStore.setState({ currentChatMessages: messages, pinnedMessages: pinned });
  }
});
// 🟢 Слушатель: собеседник прочитал сообщения (MessagesWereReadMessage из SignalR)
eventBus.on('MessagesWereReadMessage' as any, async (data: { readerId: number; maxReadId: number }) => {
  const { selectedChatUser } = useChatStore.getState();
  const currentUserId = userSession.userId;

  if (selectedChatUser && !selectedChatUser.isGroup && selectedChatUser.id === data.readerId) {
    useChatStore.setState((state) => ({
      currentChatMessages: state.currentChatMessages.map((msg) =>
        msg.isMyMessage && !msg.isRead && (data.maxReadId <= 0 || (msg.serverId > 0 && msg.serverId <= data.maxReadId))
          ? { ...msg, isRead: true }
          : msg
      ),
    }));

    await chatService.markMessagesAsReadLocallyAsync(currentUserId, data.readerId, data.maxReadId);
  }
});
// 🟢 2. Слушатель выбора чата (из глобального поиска или сайдбара)
eventBus.on('SelectChatUserMessage' as any, async (data: any) => {
  if (data?.target) {
    await useChatStore.getState().selectChatUser(data.target);
  }
});