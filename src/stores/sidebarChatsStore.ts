import { create } from 'zustand';
import { IChatListItem, IUserSearchResult } from '../types/models';
import { LastMessageType } from '../types/enums';
import { eventBus } from '../services/eventBus';
import { userSession } from '../services/userSession';
import { signalRService } from '../services/signalr.service';
import { chatService } from '../services/chat.service';
import { apiClient } from '../services/apiClient';
import { MessagePreviewHelper } from '../utils/helpers';
import { useChatStore } from './chatStore';

interface SidebarChatsState {
  allChats: IChatListItem[];
  selectedChatUser: IUserSearchResult | null;
  currentSidebarChat: IChatListItem | null;
  selectedFolderId: number | null;
  isSystemFolder: boolean;
  typingTimers: Map<string, ReturnType<typeof setTimeout>>;

  loadChats: (forceReload?: boolean) => Promise<void>;
  openChat: (target: IUserSearchResult | IChatListItem, userService?: any) => void;
  selectFolder: (folderId: number | null, isSystem: boolean) => void;
  updateSidebar: (
    userId?: number | null,
    groupId?: number | null,
    lastMessage?: string,
    incrementUnread?: boolean,
    messageType?: LastMessageType,
    secretChatId?: string | null
  ) => void;
  updateSidebarAfterDeletion: (userId: number | null, groupId: number | null) => Promise<void>;
  updateSidebarForEdit: (
    userId: number | null,
    groupId: number | null,
    localId: number,
    serverId: number,
    newText: string
  ) => Promise<void>;
  togglePinChat: (chat: IChatListItem) => Promise<void>;
  toggleMuteChat: (chat: IChatListItem) => Promise<void>;
  blockUser: (chat: IChatListItem) => Promise<void>;
  deleteChat: (chat: IChatListItem, groupService?: any) => Promise<void>;
  clearChatHistory: (chat: IChatListItem, deleteForAll: boolean) => Promise<void>;
  syncOnlineStatuses: () => Promise<void>;
  startGlobalStatusPolling: () => void;
  stopGlobalStatusPolling: () => void;
}

let globalStatusTimer: ReturnType<typeof setInterval> | null = null;

function sortChats(chats: IChatListItem[]): IChatListItem[] {
  return [...chats].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }
    const timeA = new Date(a.lastMessageTime).getTime();
    const timeB = new Date(b.lastMessageTime).getTime();
    return timeB - timeA;
  });
}

function extractOnline(statuses: any, userId: number): boolean | undefined {
  if (!statuses) return undefined;
  const num = Number(userId);

  if (statuses instanceof Map) {
    if (statuses.has(num)) return Boolean(statuses.get(num));
    if (statuses.has(String(num))) return Boolean(statuses.get(String(num)));
    for (const [k, v] of statuses.entries()) {
      if (Number(k) === num) return Boolean(v);
    }
    return undefined;
  }

  if (Array.isArray(statuses)) {
    for (const item of statuses) {
      if (Array.isArray(item) && item.length >= 2) {
        if (Number(item[0]) === num) return Boolean(item[1]);
      } else if (item && typeof item === 'object') {
        const k = item.key ?? item.Key ?? item.userId ?? item.UserId;
        const v = item.value ?? item.Value ?? item.isOnline ?? item.IsOnline;
        if (Number(k) === num && v !== undefined) return Boolean(v);
      }
    }
    return undefined;
  }

  if (typeof statuses === 'object') {
    if (num in statuses) return Boolean(statuses[num]);
    const str = String(num);
    if (str in statuses) return Boolean(statuses[str]);
    for (const [k, v] of Object.entries(statuses)) {
      if (Number(k) === num) return Boolean(v);
    }
  }

  return undefined;
}

export const useSidebarChatsStore = create<SidebarChatsState>((set, get) => ({
  allChats: [],
  selectedChatUser: null,
  currentSidebarChat: null,
  selectedFolderId: null,
  isSystemFolder: true,
  typingTimers: new Map(),

  selectFolder: (folderId, isSystem) => {
    set({ selectedFolderId: isSystem ? null : folderId, isSystemFolder: isSystem });
  },

  startGlobalStatusPolling: () => {
    if (globalStatusTimer) return;
    // 🟢 Глобальный легкий опрос через сокет раз в 7 секунд, даже когда чат не открыт
    globalStatusTimer = setInterval(() => {
      get().syncOnlineStatuses();
    }, 7000);
  },

  stopGlobalStatusPolling: () => {
    if (globalStatusTimer) {
      clearInterval(globalStatusTimer);
      globalStatusTimer = null;
    }
  },

  loadChats: async (forceReload = false) => {
    const isForce = typeof forceReload === 'boolean' ? forceReload : false;
    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );

    if (isForce) {
      set({ selectedFolderId: null, isSystemFolder: true });
    }

    try {
      const fetchedChats: IChatListItem[] = await chatService.getChatsAsync();
      const cachedSecrets: any[] = (await chatService.getCachedSecretChatsAsync?.()) || [];
      const merged: IChatListItem[] = [];

      if (fetchedChats && fetchedChats.length > 0) {
        const filtered = fetchedChats
          .filter((c: any) => {
            const isGroup = Boolean(c.isGroup ?? c.IsGroup);
            const uid = Number(c.userId ?? c.UserId ?? c.id ?? c.Id ?? 0);
            return isGroup || uid !== currentUserId;
          })
          .map((c: any) => {
            const isGroup = Boolean(c.isGroup ?? c.IsGroup);
            const uid = isGroup ? null : Number(c.userId ?? c.UserId ?? c.id ?? c.Id ?? 0);
            const gid = isGroup ? Number(c.groupId ?? c.GroupId ?? c.id ?? c.Id ?? 0) : null;

            return {
              ...c,
              id: Number(c.id ?? c.Id ?? uid ?? gid ?? 0),
              userId: uid,
              groupId: gid,
              isGroup,
              lastMessage: c.lastMessage || c.rawLastMessage || c.RawLastMessage || '',
              isOnline: Boolean(c.isOnline ?? c.IsOnline),
              nickName: c.nickName ?? c.NickName ?? c.groupName ?? c.GroupName ?? 'Chat',
              avatarPath: c.avatarPath ?? c.AvatarPath ?? null,
              lastSeen: c.lastSeen ?? c.LastSeen ?? new Date().toISOString(),
              unreadCount: Number(c.unreadCount ?? c.UnreadCount ?? 0),
              isPinned: Boolean(c.isPinned ?? c.IsPinned),
              isMuted: Boolean(c.isMuted ?? c.IsMuted),
            };
          });

        merged.push(...filtered);
      }

      for (const sc of cachedSecrets) {
        const secretMessages = await chatService.getLocalMessagesAsync(currentUserId, null, null, sc.secretChatId, 1);
        const lastSecretMsg = secretMessages?.length ? secretMessages[secretMessages.length - 1] : null;

        let displayText = sc.lastMessage || (sc.isEstablished ? '🔒 Секретный чат создан.' : '🔒 Ожидание подключения собеседника...');
        let finalType = LastMessageType.Text;

        if (lastSecretMsg) {
          const [preview, type] = MessagePreviewHelper.formatPreview(lastSecretMsg, currentUserId, false, false);
          displayText = preview;
          finalType = type;
        }

        merged.push({
          id: sc.targetUserId,
          userId: sc.targetUserId,
          nickName: sc.targetName,
          avatarPath: sc.targetAvatar,
          isSecretChat: true,
          secretChatId: sc.secretChatId,
          keyFingerprint: sc.keyFingerprint,
          lastMessage: displayText,
          lastMessageType: finalType,
          lastMessageTime: lastSecretMsg?.timestamp || sc.lastMessageTime || new Date().toISOString(),
          unreadCount: 0,
          isPinned: false,
          isMuted: false,
          isBlocked: false,
          isOnline: false,
          isTyping: false,
          isChannel: false,
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
        });
      }

      const sorted = sortChats(merged);
      set({ allChats: sorted });

      get().startGlobalStatusPolling();
      await get().syncOnlineStatuses();
    } catch (e) {
      console.error('[SidebarChatsStore ERROR] Ошибка загрузки чатов:', e);
    }
  },

  openChat: (target, userService) => {
    let resolvedUser: IUserSearchResult;
    let sidebarItem: IChatListItem | null = null;

    if ('chat' in target) {
      target = (target as any).chat;
    }

    const isListItem = 'userId' in target || 'groupId' in target || 'isGroup' in target;

    if (isListItem) {
      const ci = target as IChatListItem;
      sidebarItem = ci;
      resolvedUser = {
        id: ci.isGroup ? ci.groupId ?? 0 : ci.userId ?? ci.id ?? 0,
        nickName: (ci.isGroup ? ci.groupName : ci.nickName) || 'Chat',
        username: ci.isGroup ? null : (ci as any).username,
        avatarPath: ci.avatarPath,
        avatar: (ci as any).avatar ?? null,
        isOnline: Boolean(ci.isOnline),
        lastSeen: ci.lastSeen,
        isGroup: Boolean(ci.isGroup),
        memberCount: ci.memberCount,
        onlineCount: ci.onlineCount,
        isTyping: false,
        isChannel: Boolean(ci.isChannel),
        adminId: ci.adminId,
        isSecretChat: Boolean(ci.isSecretChat),
        secretChatId: ci.secretChatId,
        keyFingerprint: ci.keyFingerprint,
      };
    } else {
      resolvedUser = target as IUserSearchResult;
      sidebarItem =
        get().allChats.find((c) =>
          (resolvedUser.isGroup && c.groupId === resolvedUser.id) ||
          (!resolvedUser.isGroup && Number(c.userId || c.id) === resolvedUser.id)
        ) || null;

      if (sidebarItem && !resolvedUser.isGroup) {
        resolvedUser.isOnline = Boolean(sidebarItem.isOnline);
        resolvedUser.lastSeen = sidebarItem.lastSeen || resolvedUser.lastSeen;
      }
    }

    set({ selectedChatUser: resolvedUser, currentSidebarChat: sidebarItem });
    eventBus.emit('SelectChatUserMessage', { target: resolvedUser });
  },

  updateSidebar: (userId, groupId, lastMessage, incrementUnread = false, messageType = LastMessageType.Text, secretChatId = null) => {
    const chats = [...get().allChats];
    const index = chats.findIndex((c) =>
      (Boolean(secretChatId) && c.isSecretChat && c.secretChatId === secretChatId) ||
      (!secretChatId && !c.isSecretChat &&
        ((Boolean(groupId) && c.isGroup && c.groupId === groupId) ||
         (Boolean(userId) && !c.isGroup && Number(c.userId || c.id) === Number(userId))))
    );

    if (index >= 0) {
      const chat = { ...chats[index] };
      if (lastMessage !== undefined) {
        chat.lastMessage = lastMessage;
        chat.lastMessageType = messageType;
      }
      chat.lastMessageTime = new Date().toISOString();
      if (incrementUnread) {
        chat.unreadCount = (chat.unreadCount || 0) + 1;
      }
      chats[index] = chat;
      set({ allChats: sortChats(chats) });
    }
  },

  updateSidebarAfterDeletion: async (userId: number | null, groupId: number | null) => {
    try {
      const currentUserId = Number(
        userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
      );
      const lastMsg = await chatService.getLastMessageForChatAsync(currentUserId, userId, groupId);

      const chat = get().allChats.find((c) =>
        (groupId && groupId > 0 && c.groupId === groupId) ||
        (userId && userId > 0 && !c.isGroup && Number(c.userId || c.id) === userId)
      );

      if (chat) {
        const [formattedText, msgType] = MessagePreviewHelper.formatPreview(
          lastMsg,
          currentUserId,
          chat.isGroup,
          chat.isChannel
        );

        const updated = get().allChats.map((c) => {
          if (c.id === chat.id) {
            return {
              ...c,
              lastMessage: formattedText,
              lastMessageType: msgType,
              lastMessageTime: lastMsg ? lastMsg.timestamp : c.lastMessageTime,
            };
          }
          return c;
        });

        set({ allChats: sortChats(updated) });
      }
    } catch (ex) {
      console.error('[SidebarChatsStore ERROR] Ошибка обновления сайдбара после удаления:', ex);
    }
  },

  updateSidebarForEdit: async (userId, groupId, localId, serverId, newText) => {
    const chat = get().allChats.find((c) =>
      (groupId && c.groupId === groupId) || (!groupId && Number(c.userId || c.id) === userId)
    );
    if (!chat) return;

    try {
      const currentUserId = Number(
        userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
      );
      const trueLastMsg = await chatService.getLastMessageForChatAsync(currentUserId, userId, groupId);

      if (trueLastMsg && (trueLastMsg.id === localId || trueLastMsg.serverId === serverId)) {
        const updated = get().allChats.map((c) =>
          c.id === chat.id
            ? { ...c, lastMessage: newText, lastMessageType: LastMessageType.Text }
            : c
        );
        set({ allChats: updated });
      }
    } catch (ex) {
      console.error('[SidebarChatsStore ERROR] Ошибка обновления сайдбара при редактировании:', ex);
    }
  },

  togglePinChat: async (chat) => {
    const isNowPinned = await chatService.togglePinChatAsync(chat.userId, chat.groupId);
    if (isNowPinned !== null) {
      const chats = get().allChats.map((c) => (c.id === chat.id ? { ...c, isPinned: isNowPinned } : c));
      set({ allChats: sortChats(chats) });
    }
  },

  toggleMuteChat: async (chat) => {
    const isNowMuted = await chatService.toggleMuteChatAsync(chat.userId, chat.groupId);
    if (isNowMuted !== null) {
      const chats = get().allChats.map((c) => (c.id === chat.id ? { ...c, isMuted: isNowMuted } : c));
      set({ allChats: chats });
    }
  },

  blockUser: async (chat) => {
    if (chat.isGroup || !chat.userId) return;
    try {
      const res = await apiClient.post<any>(`api/Users/block/${chat.userId}`);
      if (res && res.data) {
        const isBlocked = Boolean(res.data.isBlocked ?? res.data);
        set((state) => ({
          allChats: state.allChats.map((c) => (c.id === chat.id ? { ...c, isBlocked } : c)),
        }));
        eventBus.emit('BlockStatusChangedMessage' as any, { blockerId: chat.userId, isBlocked });
      }
    } catch (ex) {
      console.error('[SidebarChatsStore ERROR] Ошибка блокировки пользователя:', ex);
    }
  },

  deleteChat: async (chat, groupService) => {
    if (chat.isSecretChat && chat.secretChatId) {
      try {
        if (chat.userId) {
          await signalRService.discardSecretChatAsync(chat.userId, chat.secretChatId);
        }
        await chatService.deleteSecretChatLocallyAsync(chat.secretChatId);
      } catch (ex) {
        console.error('[SidebarChatsStore ERROR] Ошибка удаления секретного чата:', ex);
      }

      const updated = get().allChats.filter((c) => c.secretChatId !== chat.secretChatId);
      set({ allChats: updated });

      if (get().selectedChatUser?.secretChatId === chat.secretChatId) {
        set({ selectedChatUser: null, currentSidebarChat: null });
        eventBus.emit('SelectChatUserMessage', { target: null });
        eventBus.emit('ClearActiveChatMessagesMessage' as any, undefined);
      }
      return;
    }

    if (chat.isGroup && chat.groupId) {
      await groupService?.leaveGroupAsync(chat.groupId);
      await signalRService.unsubscribeFromGroupAsync(chat.groupId);
    } else {
      await chatService.clearChatHistoryAsync(chat.userId, null, true);
    }

    const updated = get().allChats.filter((c) => c.id !== chat.id);
    set({ allChats: updated });

    if (get().selectedChatUser?.id === (chat.isGroup ? chat.groupId : chat.userId)) {
      set({ selectedChatUser: null, currentSidebarChat: null });
      eventBus.emit('SelectChatUserMessage', { target: null });
    }
  },

  clearChatHistory: async (chat, deleteForAll) => {
    await chatService.clearChatHistoryAsync(chat.userId, chat.groupId, deleteForAll);
    if (deleteForAll) {
      get().updateSidebar(chat.userId, chat.groupId, '', false, LastMessageType.None);
    } else {
      await get().updateSidebarAfterDeletion(chat.userId ?? null, chat.groupId ?? null);
    }
  },

  // 🟢 1 В 1 С WPF SidebarChatsViewModel.SyncOnlineStatusesAsync:
  // БЕЗ лишних HTTP-запросов! Опрашивает только SignalR RPC GetOnlineStatuses.
  syncOnlineStatuses: async () => {
    const currentChats = get().allChats;
    const userIds = Array.from(
      new Set(
        currentChats
          .filter((c) => !c.isGroup)
          .map((c) => Number(c.userId ?? (c as any).UserId ?? c.id ?? (c as any).Id ?? 0))
          .filter((id) => id > 0)
      )
    );

    const activeUser = useChatStore.getState().selectedChatUser;
    if (activeUser && !activeUser.isGroup) {
      const activeId = Number(activeUser.id ?? (activeUser as any).userId ?? 0);
      if (activeId > 0 && !userIds.includes(activeId)) {
        userIds.push(activeId);
      }
    }

    if (userIds.length === 0) return;

    try {
      const statuses = await signalRService.getOnlineStatusesAsync(userIds);
      if (!statuses) return;

      set((state) => ({
        allChats: state.allChats.map((c) => {
          const uid = Number(c.userId ?? (c as any).UserId ?? c.id ?? (c as any).Id ?? 0);
          if (!c.isGroup && uid > 0) {
            const isOnline = extractOnline(statuses, uid);
            if (isOnline !== undefined) {
              return {
                ...c,
                isOnline,
                lastSeen: isOnline ? new Date().toISOString() : c.lastSeen,
              };
            }
          }
          return c;
        }),
      }));

      // Обновляем шапку активного чата
      const currentActive = useChatStore.getState().selectedChatUser;
      if (currentActive && !currentActive.isGroup) {
        const activeId = Number(currentActive.id ?? (currentActive as any).userId ?? 0);
        const isOnlineNow = extractOnline(statuses, activeId);

        if (isOnlineNow !== undefined && isOnlineNow !== currentActive.isOnline) {
          useChatStore.setState({
            selectedChatUser: {
              ...currentActive,
              isOnline: isOnlineNow,
              lastSeen: isOnlineNow ? new Date().toISOString() : currentActive.lastSeen,
            },
          });
        }
      }
    } catch (err) {
      console.warn('[SidebarChatsStore] Ошибка синхронизации статусов онлайна:', err);
    }
  },
}));

// ================= ВСЕ СЛУШАТЕЛИ EVENTBUS (1 В 1 С SidebarChatsViewModel.cs) =================

// 🟢 1. Статус онлайна (UserStatusChangedMessage)
eventBus.on('UserStatusChangedMessage' as any, ({ userId, isOnline, lastSeen }: { userId: number; isOnline: boolean; lastSeen: string }) => {
  const numId = Number(userId);

  console.log(`%c[STATUS-LOG 🔔] Пришёл статус от сервера: UserId=${numId}, isOnline=${isOnline}, LastSeen=${lastSeen}`, 'color: #00bcd4; font-weight: bold;');

  useSidebarChatsStore.setState((state) => {
    let found = false;
    const updatedChats = state.allChats.map((c) => {
      const uid = Number(c.userId ?? (c as any).UserId ?? c.id ?? (c as any).Id ?? 0);
      if (!c.isGroup && uid === numId) {
        found = true;
        console.log(`%c[STATUS-LOG ✅] Сменили статус в сайдбаре для чата "${c.nickName}" на: ${isOnline ? 'ONLINE' : 'OFFLINE'}`, 'color: #4caf50; font-weight: bold;');
        return {
          ...c,
          isOnline: Boolean(isOnline),
          lastSeen: isOnline ? new Date().toISOString() : (lastSeen || c.lastSeen),
        };
      }
      return c;
    });

    if (!found) {
      console.warn(`[STATUS-LOG ⚠️] Пользователь с Id=${numId} не найден в списке allChats:`, state.allChats.map(c => ({ nick: c.nickName, id: c.id, userId: c.userId })));
    }

    return { allChats: updatedChats };
  });

  // Обновляем шапку активного диалога
  const activeChat = useChatStore.getState().selectedChatUser;
  if (activeChat && !activeChat.isGroup && Number(activeChat.id ?? (activeChat as any).userId) === numId) {
    useChatStore.setState({
      selectedChatUser: {
        ...activeChat,
        isOnline: Boolean(isOnline),
        lastSeen: isOnline ? new Date().toISOString() : (lastSeen || activeChat.lastSeen),
      },
    });
  }
});

// 🟢 2. Синхронизация при выборе чата (SelectChatUserMessage)
eventBus.on('SelectChatUserMessage' as any, (data: any) => {
  const target = data?.target || data;
  if (target) {
    const existing = useSidebarChatsStore.getState().allChats.find((c) =>
      (target.isGroup && c.groupId === target.id) || (!target.isGroup && Number(c.userId || c.id) === target.id)
    );
    useSidebarChatsStore.setState({
      selectedChatUser: target,
      currentSidebarChat: existing || null,
    });
  }
});

// 🟢 3. Обновление сайдбара после удаления сообщения (SidebarUpdateAfterDeletionMessage)
eventBus.on('SidebarUpdateAfterDeletionMessage' as any, ({ userId, groupId }: { userId: number | null; groupId: number | null }) => {
  useSidebarChatsStore.getState().updateSidebarAfterDeletion(userId, groupId);
});

// 🟢 4. Обновление сайдбара при редактировании сообщения (SidebarUpdateForEditMessage)
eventBus.on('SidebarUpdateForEditMessage' as any, ({ userId, groupId, localId, serverId, newText }: any) => {
  useSidebarChatsStore.getState().updateSidebarForEdit(userId, groupId, localId, serverId, newText);
});

// 🟢 5. Создание секретного чата (SecretChatCreatedMessage)
eventBus.on('SecretChatCreatedMessage' as any, ({ secretChat }: any) => {
  if (!secretChat) return;
  const store = useSidebarChatsStore.getState();
  const existing = store.allChats.filter((c) => c.secretChatId !== secretChat.secretChatId);
  useSidebarChatsStore.setState({
    allChats: sortChats([secretChat, ...existing]),
  });
});

// 🟢 6. Секретный чат подтверждён собеседником (SecretChatEstablishedMessage)
eventBus.on('SecretChatEstablishedMessage' as any, ({ secretChatId, keyFingerprint }: any) => {
  useSidebarChatsStore.setState((state) => ({
    allChats: state.allChats.map((c) =>
      c.secretChatId === secretChatId
        ? { ...c, keyFingerprint, lastMessage: '🔒 Секретный чат создан.', lastMessageTime: new Date().toISOString() }
        : c
    ),
  }));
});

// 🟢 7. Секретный чат сброшен/удалён (SecretChatDiscardedMessage)
eventBus.on('SecretChatDiscardedMessage' as any, ({ secretChatId }: any) => {
  const store = useSidebarChatsStore.getState();
  const updated = store.allChats.filter((c) => c.secretChatId !== secretChatId);
  useSidebarChatsStore.setState({ allChats: updated });

  if (store.selectedChatUser?.secretChatId === secretChatId) {
    useSidebarChatsStore.setState({ selectedChatUser: null, currentSidebarChat: null });
    eventBus.emit('SelectChatUserMessage', { target: null });
  }
});

// 🟢 8. Серверный таймер синхронизации (SyncTimerMessage)
eventBus.on('SyncTimerMessage' as any, () => {
  useSidebarChatsStore.getState().syncOnlineStatuses();
});

// 🟢 9. Восстановление сокета SignalR (SignalRConnectedMessage)
eventBus.on('SignalRConnectedMessage' as any, () => {
  useSidebarChatsStore.getState().syncOnlineStatuses();
});

// 🟢 10. Обычное обновление превью (SidebarUpdateMessage)
eventBus.on('SidebarUpdateMessage' as any, (data: any) => {
  useSidebarChatsStore.getState().updateSidebar(
    data.userId,
    data.groupId,
    data.previewText,
    data.incrementUnread,
    data.messageType,
    data.secretChatId
  );
});

// 🟢 11. Индикатор тайпинга (UserTypingMessage)
eventBus.on('UserTypingMessage' as any, ({ senderId, groupId }: { senderId: number; groupId: number | null }) => {
  const store = useSidebarChatsStore.getState();
  const key = groupId ? `g_${groupId}` : `u_${senderId}`;

  const chats = store.allChats.map((c) => {
    const uid = Number(c.userId || c.id || 0);
    if ((groupId && c.groupId === groupId) || (!groupId && uid === Number(senderId))) {
      return { ...c, isTyping: true };
    }
    return c;
  });
  useSidebarChatsStore.setState({ allChats: chats });

  if (store.typingTimers.has(key)) {
    clearTimeout(store.typingTimers.get(key)!);
  }

  const timer = setTimeout(() => {
    const currentChats = useSidebarChatsStore.getState().allChats.map((c) => {
      const uid = Number(c.userId || c.id || 0);
      if ((groupId && c.groupId === groupId) || (!groupId && uid === Number(senderId))) {
        return { ...c, isTyping: false };
      }
      return c;
    });
    useSidebarChatsStore.setState({ allChats: currentChats });
    store.typingTimers.delete(key);
  }, 4000);

  store.typingTimers.set(key, timer);
});

// 🟢 12. Сброс счётчика непрочитанных (ActiveChatUnreadResetMessage)
eventBus.on('ActiveChatUnreadResetMessage' as any, (data: any) => {
  useSidebarChatsStore.setState((state) => ({
    allChats: state.allChats.map((chat) => {
      const match = data.secretChatId
        ? chat.secretChatId === data.secretChatId
        : data.targetGroupId
        ? chat.groupId === data.targetGroupId
        : Number(chat.userId || chat.id) === Number(data.targetUserId);

      return match ? { ...chat, unreadCount: 0 } : chat;
    }),
  }));
});

// 🟢 13. Обновление информации о группе (GroupUpdatedMessage)
eventBus.on('GroupUpdatedMessage' as any, ({ groupId, newName, newAvatar, newDescription }: any) => {
  useSidebarChatsStore.setState((state) => ({
    allChats: state.allChats.map((c) =>
      c.isGroup && c.groupId === groupId
        ? {
            ...c,
            groupName: newName || c.groupName,
            avatar: newAvatar || (c as any).avatar,
            avatarPath: newAvatar ? null : c.avatarPath,
            groupDescription: newDescription || c.groupDescription,
          }
        : c
    ),
  }));
});

// 🟢 14. Очистка диалога собеседником для обоих (ChatClearedForBothMessage)
eventBus.on('ChatClearedForBothMessage' as any, ({ blockerId }: { blockerId: number }) => {
  const store = useSidebarChatsStore.getState();
  const updated = store.allChats.map((c) =>
    !c.isGroup && Number(c.userId || c.id) === blockerId
      ? { ...c, lastMessage: '', lastMessageType: LastMessageType.None }
      : c
  );
  useSidebarChatsStore.setState({ allChats: updated });

  if (store.selectedChatUser && !store.selectedChatUser.isGroup && Number(store.selectedChatUser.id) === blockerId) {
    eventBus.emit('ClearActiveChatMessagesMessage' as any, undefined);
  }
});