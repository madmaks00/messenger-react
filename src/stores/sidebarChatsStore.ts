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
  filteredChats: IChatListItem[]; // 🟢 1-в-1 аналог FilteredChatsView из SidebarChatsViewModel.cs
  selectedChatUser: IUserSearchResult | null;
  currentSidebarChat: IChatListItem | null;
  selectedFolderId: number | null;
  isSystemFolder: boolean;
  typingTimers: Map<string, ReturnType<typeof setTimeout>>;

  loadChats: (forceReload?: boolean) => Promise<void>;
  openChat: (target: IUserSearchResult | IChatListItem, userService?: any) => void;
  selectFolder: (folderId: number | null, isSystem: boolean) => void;
  updateChatFolderIds: (chatId: number, isGroup: boolean, folderId: number, isAdded: boolean) => void;
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

// 🟢 Логика фильтрации строго 1-в-1 с C# SidebarChatsViewModel.FilterChats:
function applyFolderFilter(
  chats: IChatListItem[],
  selectedFolderId: number | null,
  isSystemFolder: boolean
): IChatListItem[] {
  if (isSystemFolder || selectedFolderId === null || selectedFolderId === undefined) {
    return chats;
  }
  return chats.filter(
    (c) => Array.isArray(c.folderIds) && c.folderIds.includes(selectedFolderId)
  );
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
  filteredChats: [],
  selectedChatUser: null,
  currentSidebarChat: null,
  selectedFolderId: null,
  isSystemFolder: true,
  typingTimers: new Map(),

  selectFolder: (folderId, isSystem) => {
    const targetFolderId = isSystem ? null : folderId;
    const allChats = get().allChats;
    const filtered = applyFolderFilter(allChats, targetFolderId, isSystem);

    set({
      selectedFolderId: targetFolderId,
      isSystemFolder: isSystem,
      filteredChats: filtered,
    });
  },

  // 🟢 Обновление принадлежности чата к папкам при ToggleChatInFolder
  updateChatFolderIds: (chatId: number, isGroup: boolean, folderId: number, isAdded: boolean) => {
    const { allChats, selectedFolderId, isSystemFolder } = get();

    const updated = allChats.map((c) => {
      const isMatch = isGroup ? c.groupId === chatId : Number(c.userId || c.id) === chatId;
      if (!isMatch) return c;

      const currentIds = new Set(c.folderIds || []);
      if (isAdded) {
        currentIds.add(folderId);
      } else {
        currentIds.delete(folderId);
      }

      return {
        ...c,
        folderIds: Array.from(currentIds),
      };
    });

    const filtered = applyFolderFilter(updated, selectedFolderId, isSystemFolder);
    set({ allChats: updated, filteredChats: filtered });
  },

  startGlobalStatusPolling: () => {
    if (globalStatusTimer) return;
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

            // 🟢 Парсим FolderIds как с camelCase, так и с PascalCase
            const rawFolderIds = c.folderIds ?? c.FolderIds;
            const parsedFolderIds = Array.isArray(rawFolderIds) ? rawFolderIds.map(Number) : [];

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
              folderIds: parsedFolderIds,
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
      const { selectedFolderId, isSystemFolder } = get();
      const filteredResult = applyFolderFilter(sorted, selectedFolderId, isSystemFolder);

      set({
        allChats: sorted,
        filteredChats: filteredResult,
      });

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
      const sorted = sortChats(chats);
      const { selectedFolderId, isSystemFolder } = get();

      set({
        allChats: sorted,
        filteredChats: applyFolderFilter(sorted, selectedFolderId, isSystemFolder),
      });
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

        const sorted = sortChats(updated);
        const { selectedFolderId, isSystemFolder } = get();

        set({
          allChats: sorted,
          filteredChats: applyFolderFilter(sorted, selectedFolderId, isSystemFolder),
        });
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
        const { selectedFolderId, isSystemFolder } = get();
        set({
          allChats: updated,
          filteredChats: applyFolderFilter(updated, selectedFolderId, isSystemFolder),
        });
      }
    } catch (ex) {
      console.error('[SidebarChatsStore ERROR] Ошибка обновления сайдбара при редактировании:', ex);
    }
  },

  togglePinChat: async (chat) => {
    const isNowPinned = await chatService.togglePinChatAsync(chat.userId, chat.groupId);
    if (isNowPinned !== null) {
      const chats = get().allChats.map((c) => (c.id === chat.id ? { ...c, isPinned: isNowPinned } : c));
      const sorted = sortChats(chats);
      const { selectedFolderId, isSystemFolder } = get();

      set({
        allChats: sorted,
        filteredChats: applyFolderFilter(sorted, selectedFolderId, isSystemFolder),
      });
    }
  },

  toggleMuteChat: async (chat) => {
    const isNowMuted = await chatService.toggleMuteChatAsync(chat.userId, chat.groupId);
    if (isNowMuted !== null) {
      const chats = get().allChats.map((c) => (c.id === chat.id ? { ...c, isMuted: isNowMuted } : c));
      const { selectedFolderId, isSystemFolder } = get();

      set({
        allChats: chats,
        filteredChats: applyFolderFilter(chats, selectedFolderId, isSystemFolder),
      });
    }
  },

  blockUser: async (chat) => {
    if (chat.isGroup || !chat.userId) return;
    try {
      const res = await apiClient.post<any>(`api/Users/block/${chat.userId}`);
      if (res && res.data) {
        const isBlocked = Boolean(res.data.isBlocked ?? res.data);
        const updated = get().allChats.map((c) => (c.id === chat.id ? { ...c, isBlocked } : c));
        const { selectedFolderId, isSystemFolder } = get();

        set({
          allChats: updated,
          filteredChats: applyFolderFilter(updated, selectedFolderId, isSystemFolder),
        });
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
      const { selectedFolderId, isSystemFolder } = get();

      set({
        allChats: updated,
        filteredChats: applyFolderFilter(updated, selectedFolderId, isSystemFolder),
      });

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
    const { selectedFolderId, isSystemFolder } = get();

    set({
      allChats: updated,
      filteredChats: applyFolderFilter(updated, selectedFolderId, isSystemFolder),
    });

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

      const updated = get().allChats.map((c) => {
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
      });

      const { selectedFolderId, isSystemFolder } = get();

      set({
        allChats: updated,
        filteredChats: applyFolderFilter(updated, selectedFolderId, isSystemFolder),
      });

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

  useSidebarChatsStore.setState((state) => {
    const updatedChats = state.allChats.map((c) => {
      const uid = Number(c.userId ?? (c as any).UserId ?? c.id ?? (c as any).Id ?? 0);
      if (!c.isGroup && uid === numId) {
        return {
          ...c,
          isOnline: Boolean(isOnline),
          lastSeen: isOnline ? new Date().toISOString() : (lastSeen || c.lastSeen),
        };
      }
      return c;
    });

    return {
      allChats: updatedChats,
      filteredChats: applyFolderFilter(updatedChats, state.selectedFolderId, state.isSystemFolder),
    };
  });

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
  const sorted = sortChats([secretChat, ...existing]);

  useSidebarChatsStore.setState({
    allChats: sorted,
    filteredChats: applyFolderFilter(sorted, store.selectedFolderId, store.isSystemFolder),
  });
});

// 🟢 6. Секретный чат подтверждён собеседником (SecretChatEstablishedMessage)
eventBus.on('SecretChatEstablishedMessage' as any, ({ secretChatId, keyFingerprint }: any) => {
  useSidebarChatsStore.setState((state) => {
    const updated = state.allChats.map((c) =>
      c.secretChatId === secretChatId
        ? { ...c, keyFingerprint, lastMessage: '🔒 Секретный чат создан.', lastMessageTime: new Date().toISOString() }
        : c
    );
    return {
      allChats: updated,
      filteredChats: applyFolderFilter(updated, state.selectedFolderId, state.isSystemFolder),
    };
  });
});

// 🟢 7. Секретный чат сброшен/удалён (SecretChatDiscardedMessage)
eventBus.on('SecretChatDiscardedMessage' as any, ({ secretChatId }: any) => {
  const store = useSidebarChatsStore.getState();
  const updated = store.allChats.filter((c) => c.secretChatId !== secretChatId);
  useSidebarChatsStore.setState({
    allChats: updated,
    filteredChats: applyFolderFilter(updated, store.selectedFolderId, store.isSystemFolder),
  });

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

  useSidebarChatsStore.setState({
    allChats: chats,
    filteredChats: applyFolderFilter(chats, store.selectedFolderId, store.isSystemFolder),
  });

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
    const currentStore = useSidebarChatsStore.getState();
    useSidebarChatsStore.setState({
      allChats: currentChats,
      filteredChats: applyFolderFilter(currentChats, currentStore.selectedFolderId, currentStore.isSystemFolder),
    });
    currentStore.typingTimers.delete(key);
  }, 4000);

  store.typingTimers.set(key, timer);
});

// 🟢 12. Сброс счётчика непрочитанных (ActiveChatUnreadResetMessage)
eventBus.on('ActiveChatUnreadResetMessage' as any, (data: any) => {
  useSidebarChatsStore.setState((state) => {
    const updated = state.allChats.map((chat) => {
      const match = data.secretChatId
        ? chat.secretChatId === data.secretChatId
        : data.targetGroupId
        ? chat.groupId === data.targetGroupId
        : Number(chat.userId || chat.id) === Number(data.targetUserId);

      return match ? { ...chat, unreadCount: 0 } : chat;
    });

    return {
      allChats: updated,
      filteredChats: applyFolderFilter(updated, state.selectedFolderId, state.isSystemFolder),
    };
  });
});

// 🟢 13. Обновление информации о группе (GroupUpdatedMessage)
eventBus.on('GroupUpdatedMessage' as any, ({ groupId, newName, newAvatar, newDescription }: any) => {
  useSidebarChatsStore.setState((state) => {
    const updated = state.allChats.map((c) =>
      c.isGroup && c.groupId === groupId
        ? {
            ...c,
            groupName: newName || c.groupName,
            avatar: newAvatar || (c as any).avatar,
            avatarPath: newAvatar ? null : c.avatarPath,
            groupDescription: newDescription || c.groupDescription,
          }
        : c
    );

    return {
      allChats: updated,
      filteredChats: applyFolderFilter(updated, state.selectedFolderId, state.isSystemFolder),
    };
  });
});

// 🟢 14. Очистка диалога собеседником для обоих (ChatClearedForBothMessage)
eventBus.on('ChatClearedForBothMessage' as any, ({ blockerId }: { blockerId: number }) => {
  const store = useSidebarChatsStore.getState();
  const updated = store.allChats.map((c) =>
    !c.isGroup && Number(c.userId || c.id) === blockerId
      ? { ...c, lastMessage: '', lastMessageType: LastMessageType.None }
      : c
  );

  useSidebarChatsStore.setState({
    allChats: updated,
    filteredChats: applyFolderFilter(updated, store.selectedFolderId, store.isSystemFolder),
  });

  if (store.selectedChatUser && !store.selectedChatUser.isGroup && Number(store.selectedChatUser.id) === blockerId) {
    eventBus.emit('ClearActiveChatMessagesMessage' as any, undefined);
  }
});

// 🟢 15. Переключение папки через Messenger (ChatFolderSelectedMessage)
eventBus.on('ChatFolderSelectedMessage' as any, ({ folder }: { folder: any }) => {
  if (!folder) return;
  const isSystem = Boolean(folder.isSystem ?? folder.IsSystem);
  const folderId = isSystem ? null : Number(folder.id ?? folder.Id);
  useSidebarChatsStore.getState().selectFolder(folderId, isSystem);
});