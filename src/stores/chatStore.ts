import { create } from 'zustand';
import {
  IMessage,
  IUserSearchResult,
  IAttachment,
  ISelectableChat,
} from '../types/models';
import { chatService } from '../services/chat.service';
import { signalRService } from '../services/signalr.service';
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

  isCurrentChatJoined: boolean;
  isBlockedByMe: boolean;
  isBlockedByThem: boolean;
  canSendText: boolean;
  canSendMedia: boolean;
  canPinMessages: boolean;

  isSelectionMode: boolean;
  selectedCount: number;

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
  startSearch: () => void;
  exitSearch: () => void;
  markAsRead: () => Promise<void>;
  trackVisiblePosts: (serverIds: number[]) => void;
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

  // 1. ВЫБОР ЧАТА (Открытие диалога)
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
    const targetUserId = target.isGroup ? null : (target.id || (target as any).userId);
    const groupId = target.isGroup ? (target.id || (target as any).groupId) : null;
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

      // Автоматическая доотправка сообщений, если они зависли в офлайне
      chatService.syncUnsentMessagesAsync(signalRService).then((sent) => {
        if (sent > 0) {
          chatService.getLocalMessagesAsync(currentUserId, targetUserId, groupId, secretChatId, 30).then((updated) => {
            set({ currentChatMessages: updated });
          });
        }
      });
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

  // 2. ОТПРАВКА СООБЩЕНИЙ
  sendMessage: async (text, attachments, editingMessage, replies) => {
    const { selectedChatUser } = get();
    if (!selectedChatUser) return;

    if (editingMessage) {
      await get().editMessage(editingMessage.id, editingMessage.serverId, text);
      return;
    }

    const currentUserId = userSession.userId;
    const isSecret = selectedChatUser.isSecretChat && selectedChatUser.secretChatId;
    const localTempId = Date.now();

    // Секретный чат (E2EE)
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
          width: a.width || 0,
          height: a.height || 0,
          durationSeconds: a.durationSeconds || 0,
        })),
      };

      const encrypted = await secretChatCrypto.encryptText(secretChatId, JSON.stringify(payload));

      const newSecretMsg: IMessage = {
        id: localTempId,
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
      set((state) => ({ currentChatMessages: [...state.currentChatMessages, newSecretMsg] }));

      await (signalRService as any).sendSecretMessageAsync?.(
        selectedChatUser.id,
        secretChatId,
        encrypted.ciphertextBase64,
        encrypted.nonceBase64,
        encrypted.tagBase64,
        encrypted.sequenceNumber
      );
      return;
    }

    // Обычный чат или группа
    const replyIds = replies.map((r) => r.serverId || r.id).filter(Boolean).join(',');

    const newMsg: IMessage = {
      id: localTempId,
      serverId: 0,
      senderId: currentUserId,
      receiverId: selectedChatUser.isGroup ? null : selectedChatUser.id,
      groupId: selectedChatUser.isGroup ? selectedChatUser.id : null,
      text,
      timestamp: new Date().toISOString(),
      isMyMessage: true,
      isSentToServer: false, // Временно показываем таймер до подтверждения сервером
      isRead: false,
      isDeleted: false,
      isDeletedForMe: false,
      isPinned: false,
      replyToMessageIds: replyIds || null,
      viewsCount: 1,
      attachments,
      repliedMessages: replies,
    };

    // Мгновенное добавление в UI
    set((state) => ({ currentChatMessages: [...state.currentChatMessages, newMsg] }));

    try {
      await chatService.saveMessageLocallyAsync(newMsg);
    } catch (e) {
      console.warn('[ChatStore] IndexedDB save warning:', e);
    }

    const attachmentDtos = (attachments || []).map((a) => ({
      type: a.type,
      fileName: a.fileName,
      fileSizeStr: a.fileSizeStr,
      url: a.url,
      thumbnailUrl: a.thumbnailUrl,
      fileHash: a.fileHash,
      hasAudio: Boolean(a.hasAudio),
      width: a.width || 0,
      height: a.height || 0,
      durationSeconds: a.durationSeconds || 0,
    }));

    try {
      const realId = await signalRService.sendMessageAsync(
        newMsg.receiverId ?? null,
        newMsg.groupId ?? null,
        null,
        text,
        replyIds || null,
        null,
        null,
        null,
        attachmentDtos.length > 0 ? (attachmentDtos as any) : null
      );

      // Смена таймера на галочку
      if (realId && realId > 0) {
        set((state) => ({
          currentChatMessages: state.currentChatMessages.map((m) =>
            m.id === localTempId || (m.serverId === 0 && m.timestamp === newMsg.timestamp && m.text === newMsg.text)
              ? { ...m, serverId: realId, isSentToServer: true }
              : m
          ),
        }));

        await chatService.markAsSentAsync(newMsg.id, realId, undefined, text);
      }
    } catch (err) {
      console.error('[ChatStore ERROR] Ошибка отправки:', err);
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
      currentChatMessages:
        deleteForAll || msg.senderId !== currentUserId
          ? state.currentChatMessages.filter((m) => m.id !== msg.id && m.serverId !== msg.serverId)
          : state.currentChatMessages.map((m) =>
              m.id === msg.id ? { ...m, isDeletedForMe: true, text: 'This message was deleted' } : m
            ),
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
      const msgs = state.currentChatMessages.map((m) =>
        m.id === msg.id ? { ...m, isSelected: !m.isSelected } : m
      );
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
    eventBus.emit('OpenConfirmDialogMessage' as any, { messages });
  },

  startSearch: () => set({ isChatSearchMode: true, chatSearchText: '' }),
  exitSearch: () => set({ isChatSearchMode: false, chatSearchText: '', chatSearchResults: [] }),

  markAsRead: async () => {
    const { selectedChatUser } = get();
    if (!selectedChatUser) return;

    const currentUserId = userSession.userId;
    const targetUserId = selectedChatUser.isGroup ? null : selectedChatUser.id;
    const targetGroupId = selectedChatUser.isGroup ? selectedChatUser.id : null;
    const secretChatId = selectedChatUser.isSecretChat ? selectedChatUser.secretChatId : null;

    eventBus.emit('ActiveChatUnreadResetMessage' as any, {
      targetUserId,
      targetGroupId,
      secretChatId,
    });

    set((state) => ({
      currentChatMessages: state.currentChatMessages.map((m) =>
        !m.isMyMessage && !m.isRead ? { ...m, isRead: true } : m
      ),
      unreadCountInActiveChat: 0,
    }));

    try {
      if (secretChatId) {
        await chatService.markSecretMessagesAsReadLocallyAsync(secretChatId);
        if (targetUserId) {
          await (signalRService as any).markSecretChatAsReadAsync?.(targetUserId, secretChatId);
        }
        return;
      }

      if (targetUserId) {
        await chatService.markIncomingMessagesAsReadLocallyAsync(targetUserId, currentUserId);
      }

      const maxOutgoingReadId = await signalRService.markChatAsReadAsync(targetUserId, targetGroupId);

      if (maxOutgoingReadId > 0 && targetUserId) {
        set((state) => ({
          currentChatMessages: state.currentChatMessages.map((m) =>
            m.isMyMessage && !m.isRead && m.serverId > 0 && m.serverId <= maxOutgoingReadId
              ? { ...m, isRead: true }
              : m
          ),
        }));

        await chatService.markMessagesAsReadLocallyAsync(currentUserId, targetUserId, maxOutgoingReadId);
      }
    } catch (e) {
      console.error('[ChatStore] Ошибка прочтения:', e);
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
}));

// ================= СЛУШАТЕЛИ СОБЫТИЙ EVENTBUS =================

// 🟢 ГЛАВНЫЙ СЛУШАТЕЛЬ: Открытие чата из сайдбара / поиска
eventBus.on('SelectChatUserMessage' as any, async (data: any) => {
  const target = data?.target || data;
  if (target) {
    await useChatStore.getState().selectChatUser(target);
  }
});

// 🟢 Слушатель входящих сообщений
eventBus.on('ReceiveMessage' as any, (incoming: IMessage) => {
  const currentUserId = userSession.userId;
  const { selectedChatUser } = useChatStore.getState();
  const isMy = incoming.senderId === currentUserId;
  incoming.isMyMessage = isMy;

  if (isMy) {
    useChatStore.setState((state) => ({
      currentChatMessages: state.currentChatMessages.map((m) => {
        if (
          (incoming.serverId > 0 && m.serverId === incoming.serverId) ||
          (m.serverId === 0 && m.isMyMessage && (m.text === incoming.text || m.id === incoming.id))
        ) {
          return {
            ...m,
            serverId: incoming.serverId,
            isSentToServer: true,
            isRead: incoming.isRead || m.isRead,
          };
        }
        return m;
      }),
    }));
  } else {
    const isChatOpen =
      selectedChatUser &&
      ((incoming.groupId && selectedChatUser.isGroup && selectedChatUser.id === incoming.groupId) ||
        (!incoming.groupId &&
          !selectedChatUser.isGroup &&
          (selectedChatUser.id === incoming.senderId || selectedChatUser.id === incoming.receiverId)));

    if (isChatOpen) {
      useChatStore.setState((state) => {
        if (state.currentChatMessages.some((m) => (m.serverId > 0 && m.serverId === incoming.serverId) || m.id === incoming.id)) {
          return state;
        }
        return { currentChatMessages: [...state.currentChatMessages, incoming] };
      });

      useChatStore.getState().markAsRead();
    }
  }
});

// 🟢 Слушатель прочтения сообщений собеседником
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

// 🟢 Слушатель дельта-синхронизации
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