import { create } from 'zustand';
import { IChatListItem, IUserSearchResult } from '../types/models';
import { LastMessageType } from '../types/enums';
import { eventBus } from '../services/eventBus';
import { userSession } from '../services/userSession';
import { signalRService } from '../services/signalr.service';

interface SidebarChatsState {
  allChats: IChatListItem[];
  selectedChatUser: IUserSearchResult | null;
  currentSidebarChat: IChatListItem | null;
  selectedFolderId: number | null;
  isSystemFolder: boolean;
  typingTimers: Map<string, ReturnType<typeof setTimeout>>;

  // Actions
  loadChats: (chatService: any, forceReload?: boolean) => Promise<void>;
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
  togglePinChat: (chat: IChatListItem, chatService: any) => Promise<void>;
  toggleMuteChat: (chat: IChatListItem, chatService: any) => Promise<void>;
  deleteChat: (chat: IChatListItem, chatService: any, groupService?: any) => Promise<void>;
  clearChatHistory: (chat: IChatListItem, chatService: any, deleteForAll: boolean) => Promise<void>;
  syncOnlineStatuses: () => Promise<void>;
}

// Хелпер сортировки чатов: сначала закрепленные, затем по времени последнего сообщения
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

  loadChats: async (chatService, forceReload = false) => {
    // 🟢 Берём ID из session или localStorage
    const currentUserId = userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0;
    
    // Если токена нет совсем — выходим
    if (!userSession.token) {
      console.warn('[SidebarChatsStore] Загрузка чатов отменена: нет токена авторизации.');
      return;
    }

    if (forceReload) {
      set({ selectedFolderId: null, isSystemFolder: true });
    }

    try {
      const fetchedChats: IChatListItem[] = await chatService.getChatsAsync();
      const cachedSecrets: any[] = await chatService.getCachedSecretChatsAsync?.() || [];

      const merged: IChatListItem[] = [];

      // 1. Обычные чаты и группы
      if (fetchedChats && fetchedChats.length > 0) {
        const filtered = fetchedChats.filter((c) => c.isGroup || c.userId !== currentUserId);
        merged.push(...filtered);
      }

      // 2. Секретные чаты
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

      await get().syncOnlineStatuses();
    } catch (e) {
      console.error('[SidebarChatsStore] Ошибка загрузки чатов:', e);
    }
  },

  openChat: (target, userService) => {
    let resolvedUser: IUserSearchResult;
    let sidebarItem: IChatListItem | null = null;

    if ('chat' in target) {
      target = (target as any).chat;
    }

    if ('isGroup' in target && 'groupName' in target) {
      // Это IChatListItem
      const ci = target as unknown as IChatListItem;
      sidebarItem = ci;
      resolvedUser = {
        id: ci.isGroup ? ci.groupId ?? 0 : ci.userId ?? 0,
        nickName: (ci.isGroup ? ci.groupName : ci.nickName) || 'Chat',
        username: ci.isGroup ? null : ci.username,
        avatarPath: ci.avatarPath,
        isOnline: ci.isOnline,
        lastSeen: ci.lastSeen,
        isGroup: Boolean(ci.isGroup),
        memberCount: ci.memberCount,
        onlineCount: ci.onlineCount,
        isTyping: false,
        isChannel: ci.isChannel,
        adminId: ci.adminId,
        isSecretChat: ci.isSecretChat,
        secretChatId: ci.secretChatId,
        keyFingerprint: ci.keyFingerprint,
      };
    } else {
      resolvedUser = target as IUserSearchResult;
      sidebarItem = get().allChats.find((c) =>
        (resolvedUser.isGroup && c.groupId === resolvedUser.id) ||
        (!resolvedUser.isGroup && c.userId === resolvedUser.id)
      ) || null;
    }

    set({ selectedChatUser: resolvedUser, currentSidebarChat: sidebarItem });
    eventBus.emit('SelectChatUserMessage', { target: resolvedUser });

    // Фоновое обновление профиля и статуса собеседника
    if (!resolvedUser.isGroup && userService) {
      userService.getUserProfileAsync(resolvedUser.id).then((fresh: any) => {
        if (fresh) {
          set((state) => ({
            selectedChatUser: state.selectedChatUser?.id === fresh.id
  ? ({ ...state.selectedChatUser, lastSeen: fresh.lastSeen, isOnline: fresh.isOnline } as unknown as IUserSearchResult)
  : state.selectedChatUser,
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
         (Boolean(userId) && !c.isGroup && c.userId === userId)))
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

  togglePinChat: async (chat, chatService) => {
    const isNowPinned = await chatService.togglePinChatAsync(chat.userId, chat.groupId);
    if (isNowPinned !== null) {
      const chats = get().allChats.map((c) => (c.id === chat.id ? { ...c, isPinned: isNowPinned } : c));
      set({ allChats: sortChats(chats) });
    }
  },

  toggleMuteChat: async (chat, chatService) => {
    const isNowMuted = await chatService.toggleMuteChatAsync(chat.userId, chat.groupId);
    if (isNowMuted !== null) {
      const chats = get().allChats.map((c) => (c.id === chat.id ? { ...c, isMuted: isNowMuted } : c));
      set({ allChats: chats });
    }
  },

  deleteChat: async (chat, chatService, groupService) => {
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

  clearChatHistory: async (chat, chatService, deleteForAll) => {
    await chatService.clearChatHistoryAsync(chat.userId, chat.groupId, deleteForAll);
    get().updateSidebar(chat.userId, chat.groupId, '', false, LastMessageType.None);
  },

  syncOnlineStatuses: async () => {
    const userIds = get().allChats
      .filter((c) => !c.isGroup && c.userId)
      .map((c) => c.userId!);

    if (userIds.length === 0) return;

    const statuses = await signalRService.getOnlineStatusesAsync(userIds);
    if (statuses) {
      const updated = get().allChats.map((c) => {
        if (!c.isGroup && c.userId && statuses[c.userId] !== undefined) {
          return { ...c, isOnline: statuses[c.userId] };
        }
        return c;
      });
      set({ allChats: updated });
    }
  },
}));

// Подписка на глобальные события шины сообщений для автоматического обновления сайдбара
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

  // Устанавливаем флаг isTyping
  const chats = store.allChats.map((c) => {
    if ((groupId && c.groupId === groupId) || (!groupId && c.userId === senderId)) {
      return { ...c, isTyping: true };
    }
    return c;
  });
  useSidebarChatsStore.setState({ allChats: chats });

  // Сбрасываем таймер через 4 секунды (аналог DispatcherTimer в WPF)
  if (store.typingTimers.has(key)) {
    clearTimeout(store.typingTimers.get(key)!);
  }

  const timer = setTimeout(() => {
    const currentChats = useSidebarChatsStore.getState().allChats.map((c) => {
      if ((groupId && c.groupId === groupId) || (!groupId && c.userId === senderId)) {
        return { ...c, isTyping: false };
      }
      return c;
    });
    useSidebarChatsStore.setState({ allChats: currentChats });
    store.typingTimers.delete(key);
  }, 4000);

  store.typingTimers.set(key, timer);
});

eventBus.on('UserStatusChangedMessage', ({ userId, isOnline, lastSeen }) => {
  const chats = useSidebarChatsStore.getState().allChats.map((c) => {
    if (!c.isGroup && c.userId === userId) {
      return { ...c, isOnline, lastSeen };
    }
    return c;
  });
  useSidebarChatsStore.setState({ allChats: chats });
});