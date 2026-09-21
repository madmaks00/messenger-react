import { create } from 'zustand';
import {
  IMessage,
  IUserSearchResult,
  IAttachment,
  ISelectableChat,
} from '../types/models';
import { LastMessageType } from '../types/enums';
import { apiClient } from '../services/apiClient';
import { chatService } from '../services/chat.service';
import { signalRService } from '../services/signalr.service';
import { secretChatCrypto } from '../services/secretChatCrypto.service';
import { userSession } from '../services/userSession';
import { eventBus } from '../services/eventBus';
import { useSidebarChatsStore } from './sidebarChatsStore';
import { useMessageInputStore } from './messageInputStore';

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
  isLoadingOlder: boolean;
  isScrolledToBottom: boolean;
  unreadCountInActiveChat: number;

  isCurrentChatJoined: boolean;
  isBlockedByMe: boolean;
  isBlockedByThem: boolean;
  canSendText: boolean;
  canSendMedia: boolean;
  canPinMessages: boolean;
  canWriteMessages: boolean;

  isSelectionMode: boolean;
  selectedCount: number;

  selectChatUser: (target: IUserSearchResult | null) => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  ensureMessageLoadedAsync: (messageId: number) => Promise<IMessage | null>;
  sendMessage: (
    text: string,
    attachments: IAttachment[],
    editingMessage: IMessage | null,
    replies: IMessage[]
  ) => Promise<void>;
  editMessage: (localId: number, serverId: number, text: string) => Promise<void>;
  deleteMessage: (msg: IMessage, deleteForAll: boolean) => Promise<void>;
  togglePinMessage: (msg: IMessage, pinForAll: boolean) => Promise<void>;
  toggleSelectMessage: (msg: IMessage) => void;
  clearSelection: () => void;
  forwardMessages: (messages: IMessage[]) => void;
  startSearch: () => void;
  exitSearch: () => void;
  setChatSearchText: (query: string) => void;
  markAsRead: () => Promise<void>;
  trackVisiblePosts: (serverIds: number[]) => void;
  sendTyping: (text?: string) => void;
  syncPermissionsWithInput: () => void;
  triggerDeltaSync: () => Promise<void>;
}

const alreadyTrackedPostIds = new Set<number>();
let activeChatTypingTimer: ReturnType<typeof setTimeout> | null = null;
let typingDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let deltaSyncInterval: ReturnType<typeof setInterval> | null = null;

function computeCanWriteMessages(
  target: IUserSearchResult | null,
  isBlockedByMe: boolean,
  isBlockedByThem: boolean,
  isCurrentChatJoined: boolean,
  canSendText: boolean,
  currentUserId: number
): boolean {
  if (!target) return false;
  if (isBlockedByMe || isBlockedByThem) return false;
  if (target.isGroup && !isCurrentChatJoined) return false;
  if (!target.isGroup && !target.isChannel) return true;

  if (target.isChannel) {
    return target.adminId === currentUserId;
  }

  if (target.isGroup) {
    const isGroupAdmin = target.adminId === currentUserId;
    if (!isGroupAdmin && !canSendText) return false;
  }

  return true;
}

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
  isLoadingOlder: false,
  isScrolledToBottom: true,
  unreadCountInActiveChat: 0,

  isCurrentChatJoined: true,
  isBlockedByMe: false,
  isBlockedByThem: false,
  canSendText: true,
  canSendMedia: true,
  canPinMessages: true,
  canWriteMessages: true,

  isSelectionMode: false,
  selectedCount: 0,

  syncPermissionsWithInput: () => {
    const s = get();
    useMessageInputStore.getState().syncChatPermissions({
      isGroup: Boolean(s.selectedChatUser?.isGroup),
      isChannel: Boolean(s.selectedChatUser?.isChannel),
      isAdmin: Boolean(
        s.selectedChatUser &&
          (s.selectedChatUser.adminId === userSession.userId ||
            (s.selectedChatUser as any).adminId === userSession.userId)
      ),
      isCurrentChatJoined: s.isCurrentChatJoined,
      isBlockedByMe: s.isBlockedByMe,
      isBlockedByThem: s.isBlockedByThem,
      canSendText: s.canSendText,
      canSendMedia: s.canSendMedia,
      canWriteMessages: s.canWriteMessages,
    });
  },

  triggerDeltaSync: async () => {
    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );
    if (currentUserId <= 0) return;

    try {
      const count = await chatService.syncDeltaAsync(currentUserId);
      if (count > 0) {
        const { selectedChatUser } = get();
        if (selectedChatUser) {
          const targetUserId = selectedChatUser.isGroup ? null : selectedChatUser.id;
          const groupId = selectedChatUser.isGroup ? selectedChatUser.id : null;
          const secretChatId = selectedChatUser.isSecretChat ? selectedChatUser.secretChatId : null;

          const updated = await chatService.getLocalMessagesAsync(
            currentUserId,
            targetUserId,
            groupId,
            secretChatId,
            30
          );
          set({ currentChatMessages: updated });
        }
      }
    } catch (e) {
      console.warn('[ChatStore] Ошибка фонового Delta Sync:', e);
    }
  },

  selectChatUser: async (target) => {
    if (!target) {
      if (deltaSyncInterval) {
        clearInterval(deltaSyncInterval);
        deltaSyncInterval = null;
      }
      set({
        selectedChatUser: null,
        currentChatMessages: [],
        pinnedMessages: [],
        canWriteMessages: false,
      });
      get().syncPermissionsWithInput();
      return;
    }

    alreadyTrackedPostIds.clear();

    const targetUserId = target.isGroup ? null : Number(target.id ?? (target as any).userId ?? 0);
    const groupId = target.isGroup ? Number(target.id ?? (target as any).groupId ?? 0) : null;
    const targetId = target.isGroup ? (groupId ?? 0) : (targetUserId ?? 0);

    // 🟢 1 в 1 с WPF: берем актуальный статус онлайна из существующего элемента сайдбара
    const existingSidebarChat = useSidebarChatsStore.getState().allChats.find((c) =>
      !c.isGroup && Number(c.userId || c.id) === targetId
    );

    const isOnlineInitial = existingSidebarChat ? existingSidebarChat.isOnline : Boolean(target.isOnline);
    const lastSeenInitial = existingSidebarChat
      ? existingSidebarChat.lastSeen
      : target.lastSeen || new Date().toISOString();

    const normalizedTarget: IUserSearchResult = {
      ...target,
      id: targetId,
      isGroup: Boolean(target.isGroup),
      isOnline: isOnlineInitial,
      lastSeen: lastSeenInitial,
    };

    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );

    const isJoined = !normalizedTarget.isGroup || true;
    const canWrite = computeCanWriteMessages(normalizedTarget, false, false, isJoined, true, currentUserId);

    set({
      selectedChatUser: normalizedTarget,
      isHistoryLoading: true,
      isLoadingOlder: false,
      currentChatMessages: [],
      pinnedMessages: [],
      isSelectionMode: false,
      selectedCount: 0,
      isBlockedByMe: false,
      isBlockedByThem: false,
      canSendText: true,
      canSendMedia: true,
      canPinMessages: true,
      isCurrentChatJoined: isJoined,
      canWriteMessages: canWrite,
    });
    get().syncPermissionsWithInput();

    const secretChatId = normalizedTarget.isSecretChat ? normalizedTarget.secretChatId : null;

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
      await get().triggerDeltaSync();

      // 🟢 Фоновый интервал: синхронизирует дельту сообщений И статусы онлайна 1 в 1 с WPF
      if (deltaSyncInterval) clearInterval(deltaSyncInterval);
      deltaSyncInterval = setInterval(() => {
        get().triggerDeltaSync();
        useSidebarChatsStore.getState().syncOnlineStatuses();
      }, 3500);

      // Свежий профиль из API
      if (!normalizedTarget.isGroup && targetUserId && !normalizedTarget.isSecretChat) {
        apiClient
          .get<any>(`api/Users/${targetUserId}`)
          .catch(() => apiClient.get<any>(`api/User/${targetUserId}`))
          .then((res) => {
            if (res && res.data) {
              const fresh = res.data;
              const isOnline = Boolean(fresh.isOnline ?? fresh.IsOnline);
              const lastSeen = fresh.lastSeen ?? fresh.LastSeen;

              const curr = get().selectedChatUser;
              if (curr && Number(curr.id) === Number(targetUserId)) {
                set({
                  selectedChatUser: {
                    ...curr,
                    isOnline: curr.isOnline || isOnline,
                    lastSeen: isOnline ? new Date().toISOString() : lastSeen || curr.lastSeen,
                    avatar: fresh.avatar || curr.avatar,
                    avatarPath: fresh.avatarPath || curr.avatarPath,
                  },
                });
              }

              useSidebarChatsStore.setState((state) => ({
                allChats: state.allChats.map((c) =>
                  !c.isGroup && Number(c.userId ?? c.id) === Number(targetUserId)
                    ? { ...c, isOnline, lastSeen }
                    : c
                ),
              }));
            }
          })
          .catch(() => {});
      }

      // Доотправка офлайн-сообщений
      chatService.syncUnsentMessagesAsync(signalRService).then((sent) => {
        if (sent > 0) {
          chatService
            .getLocalMessagesAsync(currentUserId, targetUserId, groupId, secretChatId, 30)
            .then((updated) => {
              set({ currentChatMessages: updated });
            });
        }
      });
    } catch (e) {
      console.error('[ChatStore ERROR] Ошибка загрузки чата:', e);
      set({ isHistoryLoading: false });
    }
  },

  sendTyping: (text?: string) => {
    const { selectedChatUser } = get();
    if (!selectedChatUser) return;
    if (text !== undefined && text.trim().length === 0) return;

    if (!typingDebounceTimer) {
      const rId = selectedChatUser.isGroup
        ? null
        : Number(selectedChatUser.id ?? (selectedChatUser as any).userId ?? 0);
      const gId = selectedChatUser.isGroup
        ? Number(selectedChatUser.id ?? (selectedChatUser as any).groupId ?? 0)
        : null;

      if ((rId && rId > 0) || (gId && gId > 0)) {
        signalRService.sendTypingAsync(rId, gId).catch((err) => {
          console.warn('[ChatStore] Ошибка отправки typing:', err);
        });
      }

      typingDebounceTimer = setTimeout(() => {
        typingDebounceTimer = null;
      }, 2000);
    }
  },

  loadOlderMessages: async () => {
    const { selectedChatUser, currentChatMessages, isHistoryLoading, isLoadingOlder } = get();
    if (!selectedChatUser || currentChatMessages.length === 0 || isHistoryLoading || isLoadingOlder) return;

    set({ isLoadingOlder: true });
    const oldestTime = currentChatMessages[0].timestamp;
    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );

    try {
      const older = await chatService.getLocalMessagesAsync(
        currentUserId,
        selectedChatUser.isGroup ? null : selectedChatUser.id,
        selectedChatUser.isGroup ? selectedChatUser.id : null,
        selectedChatUser.isSecretChat ? selectedChatUser.secretChatId : null,
        30,
        oldestTime
      );

      if (older && older.length > 0) {
        set({ currentChatMessages: [...older, ...currentChatMessages] });
      }
    } catch (err) {
      console.error('[ChatStore ERROR] Ошибка подгрузки старых сообщений:', err);
    } finally {
      set({ isLoadingOlder: false });
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

  // 🟢 ПОЛНАЯ ОТПРАВКА: с поддержкой E2EE шифрования секретных чатов + обычных сообщений
  sendMessage: async (text, attachments, editingMessage, replies) => {
    const { selectedChatUser } = get();
    if (!selectedChatUser) return;

    if (editingMessage) {
      await get().editMessage(editingMessage.id, editingMessage.serverId, text);
      return;
    }

    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );
    const isSecret = Boolean(selectedChatUser.isSecretChat && selectedChatUser.secretChatId);
    const localTempId = Date.now();

    if (typingDebounceTimer) {
      clearTimeout(typingDebounceTimer);
      typingDebounceTimer = null;
    }

    // 🟢 ВЕТКА 1: СЕКРЕТНЫЙ ЧАТ (E2EE)
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

      useSidebarChatsStore.getState().updateSidebar(
        selectedChatUser.id,
        null,
        text || 'Вложение',
        false,
        LastMessageType.Text,
        secretChatId
      );

      await signalRService.sendSecretMessageAsync(
        selectedChatUser.id,
        secretChatId,
        encrypted.ciphertextBase64,
        encrypted.nonceBase64,
        encrypted.tagBase64,
        encrypted.sequenceNumber
      );
      return;
    }

    // 🟢 ВЕТКА 2: ОБЫЧНЫЙ ЧАТ И ГРУППА
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

    set((state) => ({ currentChatMessages: [...state.currentChatMessages, newMsg] }));

    try {
      await chatService.saveMessageLocallyAsync(newMsg);
    } catch (e) {
      console.warn('[ChatStore] Ошибка кэширования сообщения:', e);
    }

    useSidebarChatsStore.getState().updateSidebar(
      newMsg.receiverId,
      newMsg.groupId,
      text || (attachments.length > 0 ? 'Вложение' : ''),
      false,
      LastMessageType.Text
    );

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
      console.error('[ChatStore ERROR] Ошибка отправки сообщения:', err);
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
    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );
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

  setChatSearchText: (query) => {
    set({ chatSearchText: query });
    if (!query.trim()) {
      set({ chatSearchResults: [], isChatSearching: false });
      return;
    }

    const { selectedChatUser } = get();
    if (!selectedChatUser) return;

    set({ isChatSearching: true });
    const groupId = selectedChatUser.isGroup ? selectedChatUser.id : null;
    const otherUserId = !selectedChatUser.isGroup ? selectedChatUser.id : null;

    chatService
      .searchMessagesAsync(query.trim(), groupId, otherUserId)
      .then((results) => {
        set({ chatSearchResults: results || [], isChatSearching: false });
      })
      .catch(() => set({ isChatSearching: false }));
  },

  markAsRead: async () => {
    const { selectedChatUser } = get();
    if (!selectedChatUser) return;

    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );
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
          await signalRService.markSecretChatAsReadAsync(targetUserId, secretChatId);
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
      console.error('[ChatStore ERROR] Ошибка прочтения:', e);
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

// ================= СЛУШАТЕЛИ EVENTBUS (1 В 1 С ChatViewModel.cs) =================

eventBus.on('SelectChatUserMessage' as any, async (data: any) => {
  const target = data?.target || data;
  if (target) {
    await useChatStore.getState().selectChatUser(target);
  }
});

// 🟢 1. Статус онлайна (UserStatusChanged)
eventBus.on(
  'UserStatusChangedMessage' as any,
  ({ userId, isOnline, lastSeen }: { userId: number; isOnline: boolean; lastSeen: string }) => {
    const { selectedChatUser } = useChatStore.getState();
    if (selectedChatUser && !selectedChatUser.isGroup && Number(selectedChatUser.id) === Number(userId)) {
      console.log(`[ChatStore 🔄] Обновление статуса собеседника: isOnline=${isOnline}`);
      useChatStore.setState({
        selectedChatUser: {
          ...selectedChatUser,
          isOnline: Boolean(isOnline),
          lastSeen: isOnline ? new Date().toISOString() : lastSeen || selectedChatUser.lastSeen,
        },
      });
    }
  }
);

// 🟢 2. Тайпинг (UserTypingMessage)
eventBus.on('UserTypingMessage' as any, ({ senderId, groupId }: { senderId: number; groupId: number | null }) => {
  const { selectedChatUser } = useChatStore.getState();
  if (!selectedChatUser) return;

  const activeId = Number(selectedChatUser.id ?? (selectedChatUser as any).userId ?? 0);
  const isCurrent = groupId
    ? selectedChatUser.isGroup && activeId === Number(groupId)
    : !selectedChatUser.isGroup && activeId === Number(senderId);

  if (isCurrent) {
    useChatStore.setState({
      selectedChatUser: { ...selectedChatUser, isTyping: true },
    });

    if (activeChatTypingTimer) clearTimeout(activeChatTypingTimer);
    activeChatTypingTimer = setTimeout(() => {
      const current = useChatStore.getState().selectedChatUser;
      if (current) {
        useChatStore.setState({
          selectedChatUser: { ...current, isTyping: false },
        });
      }
      activeChatTypingTimer = null;
    }, 4000);
  }
});

eventBus.on('MessageInputTextChangedMessage' as any, ({ text }: { text: string }) => {
  useChatStore.getState().sendTyping(text);
});

// 🟢 3. Входящее сообщение в реальном времени (ReceiveMessage)
eventBus.on('ReceiveMessage' as any, (incoming: IMessage) => {
  const currentUserId = Number(
    userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
  );
  const { selectedChatUser } = useChatStore.getState();
  const isMy = Number(incoming.senderId) === Number(currentUserId);
  incoming.isMyMessage = isMy;

  const activeChatId = selectedChatUser
    ? Number(selectedChatUser.id ?? (selectedChatUser as any).userId ?? 0)
    : 0;

  if (selectedChatUser && activeChatId > 0) {
    const isFromCurrentChat = incoming.groupId
      ? selectedChatUser.isGroup && activeChatId === Number(incoming.groupId)
      : !selectedChatUser.isGroup && activeChatId === Number(incoming.senderId);

    if (isFromCurrentChat) {
      if (activeChatTypingTimer) {
        clearTimeout(activeChatTypingTimer);
        activeChatTypingTimer = null;
      }
      if (selectedChatUser.isTyping) {
        useChatStore.setState({ selectedChatUser: { ...selectedChatUser, isTyping: false } });
      }
    }
  }

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
    const isChatOpen = Boolean(
      selectedChatUser &&
        activeChatId > 0 &&
        ((incoming.groupId && selectedChatUser.isGroup && activeChatId === Number(incoming.groupId)) ||
          (!incoming.groupId &&
            !selectedChatUser.isGroup &&
            (activeChatId === Number(incoming.senderId) || activeChatId === Number(incoming.receiverId))))
    );

    if (isChatOpen) {
      useChatStore.setState((state) => {
        const alreadyExists = state.currentChatMessages.some(
          (m) =>
            (incoming.serverId > 0 && m.serverId === incoming.serverId) ||
            (incoming.id > 0 && m.id === incoming.id) ||
            (m.text === incoming.text &&
              Math.abs(new Date(m.timestamp).getTime() - new Date(incoming.timestamp).getTime()) < 2000)
        );
        if (alreadyExists) return state;

        return { currentChatMessages: [...state.currentChatMessages, incoming] };
      });

      useChatStore.getState().markAsRead();
    }
  }
});

// 🟢 4. Статус прочтения сообщений собеседником (синие галочки)
eventBus.on('MessagesWereReadMessage' as any, async (data: { readerId: number; maxReadId: number }) => {
  const { selectedChatUser } = useChatStore.getState();
  const currentUserId = Number(
    userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
  );

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

// 🟢 5. Редактирование сообщений в реальном времени (MessageEditedMessage)
eventBus.on('MessageEditedMessage' as any, ({ serverId, newText, attachments }: any) => {
  useChatStore.setState((state) => ({
    currentChatMessages: state.currentChatMessages.map((m) =>
      m.serverId === serverId
        ? {
            ...m,
            text: newText,
            editedAt: new Date().toISOString(),
            attachments: attachments || m.attachments,
          }
        : m
    ),
    pinnedMessages: state.pinnedMessages.map((p) =>
      p.serverId === serverId
        ? {
            ...p,
            text: newText,
            editedAt: new Date().toISOString(),
            attachments: attachments || p.attachments,
          }
        : p
    ),
  }));
});

// 🟢 6. Удаление сообщений в реальном времени (MessageDeletedMessage)
eventBus.on('MessageDeletedMessage' as any, ({ serverId, isForAll }: { serverId: number; isForAll: boolean }) => {
  useChatStore.setState((state) => ({
    currentChatMessages: isForAll
      ? state.currentChatMessages.filter((m) => m.serverId !== serverId && m.id !== serverId)
      : state.currentChatMessages.map((m) =>
          m.serverId === serverId
            ? { ...m, isDeletedForMe: true, text: 'This message was deleted' }
            : m
        ),
    pinnedMessages: state.pinnedMessages.filter((p) => p.serverId !== serverId && p.id !== serverId),
  }));
});

// 🟢 7. Закрепление сообщений в реальном времени (MessagePinnedMessage)
eventBus.on('MessagePinnedMessage' as any, ({ serverMessageId, isPinned }: { serverMessageId: number; isPinned: boolean }) => {
  useChatStore.setState((state) => {
    const updatedMessages = state.currentChatMessages.map((m) =>
      m.serverId === serverMessageId || m.id === serverMessageId ? { ...m, isPinned } : m
    );

    let updatedPins = [...state.pinnedMessages];
    if (isPinned) {
      const target = updatedMessages.find((m) => m.serverId === serverMessageId || m.id === serverMessageId);
      if (target && !updatedPins.some((p) => p.serverId === serverMessageId || p.id === serverMessageId)) {
        updatedPins.push(target);
      }
    } else {
      updatedPins = updatedPins.filter((p) => p.serverId !== serverMessageId && p.id !== serverMessageId);
    }

    return { currentChatMessages: updatedMessages, pinnedMessages: updatedPins };
  });
});

// 🟢 8. Обновление счётчика просмотров постов в каналах
eventBus.on('MessageViewsUpdatedMessage' as any, ({ serverMessageId, viewsCount }: { serverMessageId: number; viewsCount: number }) => {
  useChatStore.setState((state) => ({
    currentChatMessages: state.currentChatMessages.map((m) =>
      m.serverId === serverMessageId ? { ...m, viewsCount } : m
    ),
  }));
});

// 🟢 9. Изменение статуса блокировки пользователя в реальном времени
eventBus.on('BlockStatusChangedMessage' as any, ({ blockerId, isBlocked }: { blockerId: number; isBlocked: boolean }) => {
  const { selectedChatUser } = useChatStore.getState();
  if (selectedChatUser && !selectedChatUser.isGroup && Number(selectedChatUser.id) === Number(blockerId)) {
    useChatStore.setState({
      isBlockedByThem: isBlocked,
      canWriteMessages: !isBlocked,
    });
    useChatStore.getState().syncPermissionsWithInput();
  }
});

// 🟢 10. Очистка активных сообщений
eventBus.on('ClearActiveChatMessagesMessage' as any, () => {
  useChatStore.setState({
    currentChatMessages: [],
    pinnedMessages: [],
    selectedCount: 0,
    isSelectionMode: false,
  });
});

// 🟢 11. Обновление истории при Delta Sync
eventBus.on('ActiveChatRefreshRequestedMessage' as any, async () => {
  const { selectedChatUser } = useChatStore.getState();
  if (selectedChatUser) {
    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );
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

// 🟢 12. Серверный таймер синхронизации дельты
eventBus.on('SyncTimerMessage' as any, () => {
  useChatStore.getState().triggerDeltaSync();
});