import { create } from 'zustand';
import {
  IMessage,
  IUserSearchResult,
  IAttachment,
  ISelectableChat,
  MessageHelper,
} from '../types/models';
import { LastMessageType } from '../types/enums';
import { apiClient, BASE_SERVER_URL } from '../services/apiClient';
import { UrlHelper } from '../utils/helpers';
import { chatService } from '../services/chat.service';
import { signalRService } from '../services/signalr.service';
import { secretChatCrypto } from '../services/secretChatCrypto.service';
import { userSession } from '../services/userSession';
import { eventBus } from '../services/eventBus';
import { useSidebarChatsStore } from './sidebarChatsStore';
import { useMessageInputStore } from './messageInputStore';
import { mediaCacheService } from '../services/mediaCache.service';
import { mediaDimensionsCache } from '../utils/mediaDimensionsCache';
import { getLocalDatabase } from '../db/localDb';

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

  currentUserName: string;
  currentUserAvatar: string | null;

  isCurrentChatJoined: boolean;
  isBlockedByMe: boolean;
  isBlockedByThem: boolean;
  canSendText: boolean;
  canSendMedia: boolean;
  canPinMessages: boolean;
  canWriteMessages: boolean;

  isSelectionMode: boolean;
  selectedCount: number;

  ensureMyProfileLoadedAsync: () => Promise<void>;
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
  onChatSearchTextChanged: (query: string) => void;
  jumpToSearchedMessage: (targetMsg: IMessage) => Promise<void>;

  markAsRead: () => Promise<void>;
  trackVisiblePosts: (serverIds: number[]) => void;
  sendTyping: (text?: string) => void;
  syncPermissionsWithInput: () => void;
  triggerDeltaSync: () => Promise<void>;
  updateAttachmentDimensions: (messageId: number, width: number, height: number) => void;
}

const alreadyTrackedPostIds = new Set<number>();
let activeChatTypingTimer: ReturnType<typeof setTimeout> | null = null;
let typingDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let deltaSyncInterval: ReturnType<typeof setInterval> | null = null;
let chatSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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

function resolveSessionUser(): { name: string; avatar: string | null } {
  try {
    const raw =
      localStorage.getItem('user_session_data') ||
      localStorage.getItem('current_user') ||
      localStorage.getItem('user');
    if (raw) {
      const parsed = JSON.parse(raw);
      const name = parsed.nickName || parsed.nickname || parsed.username || parsed.name || '';
      const avatar = parsed.avatarPath || parsed.avatar || null;
      return { name, avatar };
    }
  } catch {}

  const anySession = userSession as any;
  return {
    name: anySession?.nickName || anySession?.username || '',
    avatar: anySession?.avatarPath || null,
  };
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

  currentUserName: resolveSessionUser().name,
  currentUserAvatar: resolveSessionUser().avatar,

  isCurrentChatJoined: true,
  isBlockedByMe: false,
  isBlockedByThem: false,
  canSendText: true,
  canSendMedia: true,
  canPinMessages: true,
  canWriteMessages: true,

  isSelectionMode: false,
  selectedCount: 0,

  ensureMyProfileLoadedAsync: async () => {
    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );
    if (currentUserId <= 0) return;

    const { name: localName, avatar: localAvatar } = resolveSessionUser();
    if (localName && localName !== 'Me') {
      set({ currentUserName: localName, currentUserAvatar: localAvatar });
    }

    try {
      const res = await apiClient
        .get<any>(`api/Users/${currentUserId}`)
        .catch(() => apiClient.get<any>(`api/User/${currentUserId}`));
      if (res && res.data) {
        const u = res.data;
        const freshName = u.nickName || u.username || localName || 'User';
        const freshAvatar = u.avatarPath || u.avatar || localAvatar;
        set({ currentUserName: freshName, currentUserAvatar: freshAvatar });
      }
    } catch (e) {
      console.warn('[ChatStore] Ошибка загрузки собственного профиля:', e);
    }
  },

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
        const { selectedChatUser, currentChatMessages } = get();
        if (selectedChatUser) {
          const targetUserId = selectedChatUser.isGroup ? null : selectedChatUser.id;
          const groupId = selectedChatUser.isGroup ? selectedChatUser.id : null;
          const secretChatId = selectedChatUser.isSecretChat ? selectedChatUser.secretChatId : null;

          // 🟢 ИСПРАВЛЕНИЕ: берем не жесткие 30, а текущую длину сообщений, чтобы не отрезать верхние сообщения диалога
          const takeCount = Math.max(30, currentChatMessages.length);

          const updated = await chatService.getLocalMessagesAsync(
            currentUserId,
            targetUserId,
            groupId,
            secretChatId,
            takeCount
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
    await get().ensureMyProfileLoadedAsync();

    const targetUserId = target.isGroup ? null : Number(target.id ?? (target as any).userId ?? 0);
    const groupId = target.isGroup ? Number(target.id ?? (target as any).groupId ?? 0) : null;
    const targetId = target.isGroup ? (groupId ?? 0) : (targetUserId ?? 0);

    const existingSidebarChat = useSidebarChatsStore
      .getState()
      .allChats.find((c) => !c.isGroup && Number(c.userId || c.id) === targetId);

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

    if (get().isChatSearchMode) {
      get().exitSearch();
    }

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

      if (deltaSyncInterval) clearInterval(deltaSyncInterval);
      deltaSyncInterval = setInterval(() => {
        get().triggerDeltaSync();
        useSidebarChatsStore.getState().syncOnlineStatuses();
      }, 3500);

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

  sendMessage: async (text, attachments, editingMessage, replies) => {
    const { selectedChatUser, currentUserName, currentUserAvatar } = get();
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

    // Сохраняем исходные вложения с уже известными размерами
    const initialAttachments: IAttachment[] = (attachments || []).map((a) => {
      const cached = mediaDimensionsCache.get(a.url) || mediaDimensionsCache.get(a.fileName);
      return {
        ...a,
        width: a.width > 0 ? a.width : (cached?.width || 0),
        height: a.height > 0 ? a.height : (cached?.height || 0),
      };
    });

    const replyIds = replies.map((r) => r.serverId || r.id).filter(Boolean).join(',');

    const newMsg: IMessage = {
      id: localTempId,
      serverId: 0,
      senderId: currentUserId,
      senderName: currentUserName,
      senderAvatar: currentUserAvatar,
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
      attachments: initialAttachments,
      repliedMessages: replies,
    };

    // 🟢 1. Мгновенно отображаем сообщение в интерфейсе (оптимистичный вывод)
    set((state) => ({ currentChatMessages: [...state.currentChatMessages, newMsg] }));

    try {
      await chatService.saveMessageLocallyAsync(newMsg);
    } catch (e) {
      console.warn('[ChatStore] Ошибка кэширования сообщения:', e);
    }

    useSidebarChatsStore.getState().updateSidebar(
      newMsg.receiverId,
      newMsg.groupId,
      text || (initialAttachments.length > 0 ? 'Вложение' : ''),
      false,
      LastMessageType.Text
    );

    // 🟢 2. Фоновая чанковая загрузка на сервер и сохранение в постоянный CacheStorage
    (async () => {
      try {
        let finalAttachments = [...initialAttachments];
        const filesToUpload: File[] = [];
        const fileIndices: number[] = [];

        initialAttachments.forEach((att, idx) => {
          if (att.rawFile) {
            filesToUpload.push(att.rawFile);
            fileIndices.push(idx);
          }
        });

        if (filesToUpload.length > 0) {
          const uploadedResults = await chatService.uploadAttachmentsAsync(filesToUpload);

          if (uploadedResults && uploadedResults.length > 0) {
            uploadedResults.forEach((upDto, i) => {
              const targetIdx = fileIndices[i];
              if (targetIdx !== undefined && finalAttachments[targetIdx]) {
                const targetAtt = finalAttachments[targetIdx];
                const rawFile = targetAtt.rawFile;

                // 🟢 Формируем полный постоянный URL бэкенда (порт 7214)
                const fullServerUrl = UrlHelper.normalize(upDto.url, BASE_SERVER_URL);
                const fullThumbUrl = upDto.thumbnailUrl
                  ? UrlHelper.normalize(upDto.thumbnailUrl, BASE_SERVER_URL)
                  : fullServerUrl;

                // Сохраняем файл в дисковый CacheStorage браузера
                if (rawFile) {
                  mediaCacheService.cacheMediaFile(fullServerUrl, rawFile);
                }

                targetAtt.url = fullServerUrl;
                targetAtt.thumbnailUrl = fullThumbUrl;
                targetAtt.fileHash = upDto.fileHash;
                if (upDto.width > 0) targetAtt.width = upDto.width;
                if (upDto.height > 0) targetAtt.height = upDto.height;

                mediaDimensionsCache.set(fullServerUrl, { width: targetAtt.width, height: targetAtt.height });
                mediaDimensionsCache.set(upDto.fileName, { width: targetAtt.width, height: targetAtt.height });
              }
            });
          }
        }

        const uploadedDtos = finalAttachments.map((a) => {
          const cached = mediaDimensionsCache.get(a.url) || mediaDimensionsCache.get(a.fileName);
          const w = a.width > 0 ? a.width : (cached?.width || 0);
          const h = a.height > 0 ? a.height : (cached?.height || 0);

          return {
            type: a.type,
            fileName: a.fileName,
            fileSizeStr: a.fileSizeStr,
            url: a.url,
            thumbnailUrl: a.thumbnailUrl || a.url,
            fileHash: a.fileHash,
            hasAudio: Boolean(a.hasAudio),
            width: w,
            height: h,
            durationSeconds: a.durationSeconds || 0,
          };
        });

        set((state) => ({
          currentChatMessages: state.currentChatMessages.map((m) =>
            m.id === localTempId ? { ...m, attachments: finalAttachments } : m
          ),
        }));

        try {
          const db = getLocalDatabase(userSession.userId);
          const localRecord = await db.messages.filter((m) => m.id === localTempId).first();
          if (localRecord?.id) {
            await db.messages.update(localRecord.id, { attachments: finalAttachments });
          }
        } catch {}

        const realId = await signalRService.sendMessageAsync(
          newMsg.receiverId ?? null,
          newMsg.groupId ?? null,
          null,
          text,
          replyIds || null,
          null,
          null,
          null,
          uploadedDtos.length > 0 ? (uploadedDtos as any) : null
        );

        if (realId && realId > 0) {
          set((state) => ({
            currentChatMessages: state.currentChatMessages.map((m) =>
              m.id === localTempId ? { ...m, serverId: realId, isSentToServer: true } : m
            ),
          }));

          await chatService.markAsSentAsync(localTempId, realId, undefined, text);
        }
      } catch (err) {
        console.error('[ChatStore ERROR] Ошибка фоновой загрузки и отправки:', err);
      }
    })();
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

  startSearch: () => {
    const { selectedChatUser, isChatSearchMode } = get();
    if (!selectedChatUser) return;

    if (isChatSearchMode) {
      get().exitSearch();
      return;
    }

    get().ensureMyProfileLoadedAsync();

    set({
      isChatSearchMode: true,
      chatSearchText: '',
      chatSearchResults: [],
      isChatSearching: false,
    });

    eventBus.emit('FocusSearchBoxMessage', undefined);
  },

  exitSearch: () => {
    set({
      isChatSearchMode: false,
      chatSearchText: '',
      chatSearchResults: [],
      isChatSearching: false,
    });

    eventBus.emit('EndSearchBoxMessage', undefined);
  },

  onChatSearchTextChanged: (query: string) => {
    if (chatSearchDebounceTimer) {
      clearTimeout(chatSearchDebounceTimer);
      chatSearchDebounceTimer = null;
    }

    set({ chatSearchText: query });

    const { isChatSearchMode, selectedChatUser } = get();
    if (!isChatSearchMode || !selectedChatUser || !query.trim()) {
      set({ chatSearchResults: [], isChatSearching: false });
      return;
    }

    const searchVal = query.trim();
    set({ isChatSearching: true });

    chatSearchDebounceTimer = setTimeout(async () => {
      try {
        const currentUserId = Number(
          userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
        );

        await get().ensureMyProfileLoadedAsync();
        const { currentUserName, currentUserAvatar } = get();

        const groupId = selectedChatUser.isGroup ? selectedChatUser.id : null;
        const otherUserId = !selectedChatUser.isGroup ? selectedChatUser.id : null;

        let serverResults = await chatService.searchMessagesAsync(searchVal, groupId, otherUserId);

        let results: IMessage[] = [];
        if (serverResults && serverResults.length > 0) {
          results = serverResults;
        } else {
          results = await chatService.searchLocalMessagesAsync(
            searchVal,
            currentUserId,
            otherUserId,
            groupId,
            50
          );
        }

        results = results.filter((msg) => !msg.isCallMessage && !MessageHelper.isCallMessage(msg));

        const seen = new Set<string>();
        const uniqueResults: IMessage[] = [];

        for (const msg of results) {
          const key = msg.serverId > 0 ? `s_${msg.serverId}` : `l_${msg.id}_${msg.timestamp}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueResults.push(msg);
          }
        }

        const myActualName = currentUserName && currentUserName !== 'Me' ? currentUserName : resolveSessionUser().name || 'You';
        const myActualAvatar = currentUserAvatar || resolveSessionUser().avatar;

        for (const msg of uniqueResults) {
          msg.isMyMessage = msg.senderId === currentUserId;
          msg.senderName = msg.isMyMessage ? myActualName : selectedChatUser.nickName;
          msg.senderAvatar = msg.isMyMessage
            ? myActualAvatar
            : selectedChatUser.avatarPath || (selectedChatUser as any).avatar;
        }

        set({
          chatSearchResults: uniqueResults,
          isChatSearching: false,
        });
      } catch (err) {
        console.error('[ChatStore ERROR] Ошибка при поиске по сообщениям чата:', err);
        set({ isChatSearching: false });
      }
    }, 250);
  },

  jumpToSearchedMessage: async (targetMsg: IMessage) => {
    if (!targetMsg) return;

    const targetServerId = Number(targetMsg.serverId || 0);
    const targetLocalId = Number(targetMsg.id || 0);
    const targetId = targetServerId > 0 ? targetServerId : targetLocalId;

    let isLoaded = get().currentChatMessages.some(
      (m) =>
        (targetServerId > 0 && Number(m.serverId) === targetServerId) ||
        (targetLocalId > 0 && Number(m.id) === targetLocalId) ||
        (targetMsg.text && m.text === targetMsg.text && Math.abs(new Date(m.timestamp).getTime() - new Date(targetMsg.timestamp).getTime()) < 3000)
    );

    if (!isLoaded) {
      for (let i = 0; i < 10; i++) {
        await get().loadOlderMessages();
        isLoaded = get().currentChatMessages.some(
          (m) =>
            (targetServerId > 0 && Number(m.serverId) === targetServerId) ||
            (targetLocalId > 0 && Number(m.id) === targetLocalId) ||
            (targetMsg.text && m.text === targetMsg.text && Math.abs(new Date(m.timestamp).getTime() - new Date(targetMsg.timestamp).getTime()) < 3000)
        );
        if (isLoaded) break;
      }
    }

    setTimeout(() => {
      eventBus.emit('ScrollToMessageRequestMessage' as any, {
        messageId: targetId,
        localId: targetLocalId,
        serverId: targetServerId,
        text: targetMsg.text,
        timestamp: targetMsg.timestamp,
      });
    }, 60);
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

  updateAttachmentDimensions: (messageId: number, width: number, height: number) => {
    if (width <= 0 || height <= 0) return;

    set((state) => {
      let modified = false;

      const newMessages = state.currentChatMessages.map((m) => {
        const currentId = Number(m.id || 0);
        const currentServerId = Number(m.serverId || 0);
        const isMatch = messageId > 0 && (currentId === messageId || currentServerId === messageId);

        if (isMatch && m.attachments && m.attachments.length > 0) {
          const att = m.attachments[0];

          mediaDimensionsCache.set(att.url, { width, height });
          mediaDimensionsCache.set(att.fileName, { width, height });

          if (att.width !== width || att.height !== height) {
            modified = true;
            return {
              ...m,
              attachments: m.attachments.map((a, idx) =>
                idx === 0 ? { ...a, width, height } : a
              ),
            };
          }
        }
        return m;
      });

      if (!modified) return state;

      const updatedTarget = newMessages.find((m) => {
        const currentId = Number(m.id || 0);
        const currentServerId = Number(m.serverId || 0);
        return messageId > 0 && (currentId === messageId || currentServerId === messageId);
      });

      if (updatedTarget && updatedTarget.id) {
        try {
          const db = getLocalDatabase(userSession.userId);
          db.messages.update(updatedTarget.id, {
            attachments: updatedTarget.attachments,
          }).catch(() => {});
        } catch {}
      }

      return { currentChatMessages: newMessages };
    });
  },
}));

// ================= СЛУШАТЕЛИ EVENTBUS =================

eventBus.on('SelectChatUserMessage' as any, async (data: any) => {
  const target = data?.target || data;
  if (target) {
    await useChatStore.getState().selectChatUser(target);
  }
});

eventBus.on('ChatSearchQueryChangedMessage', ({ query }) => {
  if (useChatStore.getState().isChatSearchMode) {
    useChatStore.getState().onChatSearchTextChanged(query);
  }
});

eventBus.on('EndSearchBoxMessage', () => {
  if (useChatStore.getState().isChatSearchMode) {
    useChatStore.setState({
      isChatSearchMode: false,
      chatSearchText: '',
      chatSearchResults: [],
      isChatSearching: false,
    });
  }
});

eventBus.on(
  'UserStatusChangedMessage' as any,
  ({ userId, isOnline, lastSeen }: { userId: number; isOnline: boolean; lastSeen: string }) => {
    const { selectedChatUser } = useChatStore.getState();
    if (selectedChatUser && !selectedChatUser.isGroup && Number(selectedChatUser.id) === Number(userId)) {
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

eventBus.on('UserTypingMessage' as any, ({ senderId, groupId }: { senderId: number; groupId: number | null }) => {
  const { selectedChatUser } = useChatStore.getState();
  if (!selectedChatUser) return;

  const activeId = Number(selectedChatUser.id ?? (selectedChatUser as any).userId ?? 0);
  const isCurrent = groupId
    ? selectedChatUser.isGroup && activeId === Number(groupId)
    : !selectedChatUser.isGroup && (activeId === Number(senderId) || activeId === Number(senderId));

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

eventBus.on('ReceiveMessage' as any, (incoming: IMessage) => {
  const currentUserId = Number(
    userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
  );
  const { selectedChatUser, currentUserName, currentUserAvatar } = useChatStore.getState();
  const isMy = Number(incoming.senderId) === Number(currentUserId);
  incoming.isMyMessage = isMy;

  if (isMy) {
    incoming.senderName = currentUserName;
    incoming.senderAvatar = currentUserAvatar;
  }

  const activeChatId = selectedChatUser
    ? Number(selectedChatUser.id ?? (selectedChatUser as any).userId ?? 0)
    : 0;

  if (selectedChatUser && activeChatId > 0) {
    const isFromCurrentChat = incoming.groupId
      ? selectedChatUser.isGroup && activeChatId === Number(incoming.groupId)
      : !selectedChatUser.isGroup &&
        (activeChatId === Number(incoming.senderId) || activeChatId === Number(incoming.receiverId));

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

  const isChatOpen = Boolean(
    selectedChatUser &&
      activeChatId > 0 &&
      ((incoming.groupId && selectedChatUser.isGroup && activeChatId === Number(incoming.groupId)) ||
        (!incoming.groupId &&
          !selectedChatUser.isGroup &&
          (activeChatId === Number(incoming.senderId) || activeChatId === Number(incoming.receiverId))))
  );

  if (isMy) {
    let matched = false;

    useChatStore.setState((state) => {
      const updated = state.currentChatMessages.map((m) => {
        if (
          (incoming.serverId > 0 && m.serverId === incoming.serverId) ||
          (m.serverId === 0 && m.isMyMessage && (m.text === incoming.text || m.id === incoming.id))
        ) {
          matched = true;
          return {
            ...m,
            serverId: incoming.serverId,
            isSentToServer: true,
            isRead: incoming.isRead, // 🟢 Берем честный статус от сервера, без принудительного true
          };
        }
        return m;
      });

      if (!matched && isChatOpen) {
        const alreadyExists = updated.some(
          (m) =>
            (incoming.serverId > 0 && m.serverId === incoming.serverId) ||
            (incoming.id > 0 && m.id === incoming.id) ||
            (m.text === incoming.text &&
              Math.abs(new Date(m.timestamp).getTime() - new Date(incoming.timestamp).getTime()) < 2000)
        );

        if (!alreadyExists) {
          return { currentChatMessages: [...updated, incoming] };
        }
      }

      return { currentChatMessages: updated };
    });

    if (!matched) {
      chatService.saveMessageLocallyAsync(incoming).catch((err) => {
        console.warn('[ChatStore] Ошибка локального сохранения синхронизированного сообщения:', err);
      });
    }
  } else {
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

eventBus.on('MessagesWereReadMessage' as any, async (data: { readerId: number; maxReadId: number }) => {
  const { selectedChatUser } = useChatStore.getState();
  const currentUserId = Number(
    userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
  );

  // 🟢 Отмечаем прочитанными только те исходящие сообщения, чей ID <= maxReadId (и строго maxReadId > 0)
  if (selectedChatUser && !selectedChatUser.isGroup && selectedChatUser.id === data.readerId) {
    if (data.maxReadId > 0) {
      useChatStore.setState((state) => ({
        currentChatMessages: state.currentChatMessages.map((msg) =>
          msg.isMyMessage && !msg.isRead && msg.serverId > 0 && msg.serverId <= data.maxReadId
            ? { ...msg, isRead: true }
            : msg
        ),
      }));

      await chatService.markMessagesAsReadLocallyAsync(currentUserId, data.readerId, data.maxReadId);
    }
  }
});

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

eventBus.on('MessageViewsUpdatedMessage' as any, ({ serverMessageId, viewsCount }: { serverMessageId: number; viewsCount: number }) => {
  useChatStore.setState((state) => ({
    currentChatMessages: state.currentChatMessages.map((m) =>
      m.serverId === serverMessageId ? { ...m, viewsCount } : m
    ),
  }));
});

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

eventBus.on('ClearActiveChatMessagesMessage' as any, () => {
  useChatStore.setState({
    currentChatMessages: [],
    pinnedMessages: [],
    selectedCount: 0,
    isSelectionMode: false,
  });
});

eventBus.on('ActiveChatRefreshRequestedMessage' as any, async () => {
  const { selectedChatUser, currentChatMessages } = useChatStore.getState();
  if (selectedChatUser) {
    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );
    const targetUserId = selectedChatUser.isGroup ? null : selectedChatUser.id;
    const groupId = selectedChatUser.isGroup ? selectedChatUser.id : null;
    const secretChatId = selectedChatUser.isSecretChat ? selectedChatUser.secretChatId : null;

    // 🟢 ИСПРАВЛЕНИЕ: сохраняем всю текущую длину списка сообщений
    const takeCount = Math.max(30, currentChatMessages.length);

    const [messages, pinned] = await Promise.all([
      chatService.getLocalMessagesAsync(currentUserId, targetUserId, groupId, secretChatId, takeCount),
      chatService.getLocalPinnedMessagesAsync(currentUserId, targetUserId, groupId, secretChatId),
    ]);

    useChatStore.setState({ currentChatMessages: messages, pinnedMessages: pinned });
  }
});

eventBus.on('SyncTimerMessage' as any, () => {
  useChatStore.getState().triggerDeltaSync();
});