import { create } from 'zustand';
import { IChatListItem, IUserSearchResult } from '../types/models';
import { LastMessageType } from '../types/enums';
import { eventBus } from '../services/eventBus';
import { userSession } from '../services/userSession';
import { signalRService } from '../services/signalr.service';
import { chatService } from '../services/chat.service';
import { apiClient } from '../services/apiClient';
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
  togglePinChat: (chat: IChatListItem) => Promise<void>;
  toggleMuteChat: (chat: IChatListItem) => Promise<void>;
  deleteChat: (chat: IChatListItem, groupService?: any) => Promise<void>;
  clearChatHistory: (chat: IChatListItem, deleteForAll: boolean) => Promise<void>;
  syncOnlineStatuses: () => Promise<void>;
}

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

  loadChats: async (forceReload = false) => {
    const isForce = typeof forceReload === 'boolean' ? forceReload : false;
    const currentUserId = Number(userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0);

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
        merged.push({
          id: sc.targetUserId,
          userId: sc.targetUserId,
          nickName: sc.targetName,
          avatarPath: sc.targetAvatar,
          isSecretChat: true,
          secretChatId: sc.secretChatId,
          keyFingerprint: sc.keyFingerprint,
          lastMessage: sc.lastMessage || '🔒 Секретный чат создан.',
          lastMessageType: LastMessageType.Text,
          lastMessageTime: sc.lastMessageTime || new Date().toISOString(),
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

      // 🟢 СРАЗУ ЖЕ СИНХРОНИЗИРУЕМ ОНЛАЙНЫ ПОСЛЕ ЗАГРУЗКИ СПИСКА
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

    // 🟢 Фоновое обновление профиля и статуса выбранного собеседника
    if (!resolvedUser.isGroup) {
      const targetId = resolvedUser.id;

      const fetchProfile = userService
        ? userService.getUserProfileAsync(targetId)
        : apiClient
            .get<any>(`api/Users/${targetId}`)
            .catch(() => apiClient.get<any>(`api/User/${targetId}`))
            .then((r) => r.data);

      Promise.resolve(fetchProfile).then((fresh: any) => {
        if (fresh) {
          const isOnline = Boolean(fresh.isOnline ?? fresh.IsOnline);
          const lastSeen = fresh.lastSeen ?? fresh.LastSeen;

          set((state) => ({
            selectedChatUser:
              state.selectedChatUser?.id === targetId
                ? { ...state.selectedChatUser, isOnline, lastSeen }
                : state.selectedChatUser,
            allChats: state.allChats.map((c) =>
              !c.isGroup && Number(c.userId ?? c.id) === targetId
                ? { ...c, isOnline, lastSeen }
                : c
            ),
          }));
        }
      });
    }
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

  deleteChat: async (chat, groupService) => {
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
    get().updateSidebar(chat.userId, chat.groupId, '', false, LastMessageType.None);
  },

  // 🟢 1 В 1 С WPF: Автоматически подтягивает статусы онлайна сразу при загрузке
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

    if (userIds.length === 0) return;

    try {
      // 1. Опрашиваем сокет SignalR
      const statusesPromise = signalRService
        .ensureConnectedAsync()
        .then((connected) => (connected ? signalRService.getOnlineStatusesAsync(userIds) : null))
        .catch(() => null);

      // 2. 🟢 1 в 1 с WPF UserService: запрашиваем профили из базы данных
      const profilesPromise = Promise.all(
        userIds.map(async (uid) => {
          try {
            const res = await apiClient
              .get<any>(`api/Users/${uid}`)
              .catch(() => apiClient.get<any>(`api/User/${uid}`));
            return { uid, user: res?.data };
          } catch {
            return { uid, user: null };
          }
        })
      );

      const [statuses, profiles] = await Promise.all([statusesPromise, profilesPromise]);

      set((state) => ({
        allChats: state.allChats.map((c) => {
          const uid = Number(c.userId ?? (c as any).UserId ?? c.id ?? (c as any).Id ?? 0);
          if (!c.isGroup && uid > 0) {
            const signalROnline = statuses ? extractOnline(statuses, uid) : undefined;
            const prof = profiles.find((p) => p.uid === uid)?.user;
            const apiOnline = prof ? Boolean(prof.isOnline ?? prof.IsOnline) : undefined;
            const apiLastSeen = prof ? prof.lastSeen ?? prof.LastSeen : undefined;

            // 🟢 Если либо сокет, либо база данных сообщает online — пользователь зеленый
            const finalOnline = signalROnline === true || apiOnline === true || (c.isOnline && signalROnline !== false);

            return {
              ...c,
              isOnline: finalOnline,
              lastSeen: apiLastSeen || c.lastSeen,
            };
          }
          return c;
        }),
      }));

      // Если открыт чат — обновляем и его статус
      const activeChat = useChatStore.getState().selectedChatUser;
      if (activeChat && !activeChat.isGroup) {
        const activeId = Number(activeChat.id ?? (activeChat as any).userId ?? 0);
        const chatInStore = get().allChats.find((c) => !c.isGroup && Number(c.userId || c.id) === activeId);
        if (chatInStore) {
          useChatStore.setState({
            selectedChatUser: {
              ...activeChat,
              isOnline: chatInStore.isOnline,
              lastSeen: chatInStore.lastSeen,
            },
          });
        }
      }
    } catch (err) {
      console.warn('[SidebarChatsStore ERROR] Ошибка синхронизации статусов онлайна:', err);
    }
  },
}));

// ================= СЛУШАТЕЛИ EVENTBUS =================

eventBus.on('SidebarUpdateMessage', (data) => {
  useSidebarChatsStore.getState().updateSidebar(
    data.userId,
    data.groupId,
    data.previewText,
    data.incrementUnread,
    data.messageType,
    data.secretChatId
  );
});

eventBus.on('UserTypingMessage', ({ senderId, groupId }) => {
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

// 🟢 При получении push-уведомления от сокета статус обновляется моментально в реальном времени
eventBus.on('UserStatusChangedMessage', ({ userId, isOnline, lastSeen }) => {
  const numId = Number(userId);

  useSidebarChatsStore.setState((state) => ({
    allChats: state.allChats.map((c) => {
      const uid = Number(c.userId ?? (c as any).UserId ?? c.id ?? (c as any).Id ?? 0);
      if (!c.isGroup && uid === numId) {
        return { ...c, isOnline: Boolean(isOnline), lastSeen: lastSeen || c.lastSeen };
      }
      return c;
    }),
  }));

  const activeChat = useChatStore.getState().selectedChatUser;
  if (activeChat && !activeChat.isGroup && Number(activeChat.id) === numId) {
    useChatStore.setState({
      selectedChatUser: {
        ...activeChat,
        isOnline: Boolean(isOnline),
        lastSeen: lastSeen || activeChat.lastSeen,
      },
    });
  }
});

// 🟢 При соединении сокета:
eventBus.on('SignalRConnectedMessage' as any, () => {
  const store = useSidebarChatsStore.getState();
  if (store.allChats.length === 0) {
    store.loadChats(false);
  } else {
    store.syncOnlineStatuses();
  }
});