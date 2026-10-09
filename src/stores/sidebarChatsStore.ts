import { create } from 'zustand';
import { IChatListItem, IUserSearchResult } from '../types/models';
import { LastMessageType } from '../types/enums';
import { eventBus } from '../services/eventBus';
import { userSession } from '../services/userSession';
import { signalRService } from '../services/signalr.service';
import { chatService } from '../services/chat.service';
import { userService } from '../services/user.service';
import { MessagePreviewHelper } from '../utils/messagePreviewHelper';
import { useChatStore } from './chatStore';

interface SidebarChatsState {
  allChats: IChatListItem[];
  filteredChats: IChatListItem[];
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
  deleteChat: (chat: IChatListItem, groupService?: any, deleteForAll?: boolean) => Promise<void>;
  clearChatHistory: (chat: IChatListItem, deleteForAll: boolean) => Promise<void>;
  syncOnlineStatuses: () => Promise<void>;
  startGlobalStatusPolling: () => void;
  stopGlobalStatusPolling: () => void;
}

let globalStatusTimer: ReturnType<typeof setInterval> | null = null;

function sortChats(chats: IChatListItem[]): IChatListItem[] {
  return [...chats].sort((a, b) => {
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
      return a.isPinned ? -1 : 1;
    }
    const timeA = new Date(a.lastMessageTime || 0).getTime();
    const timeB = new Date(b.lastMessageTime || 0).getTime();
    return timeB - timeA;
  });
}

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

function isMatchingChat(a: IChatListItem, b: IChatListItem): boolean {
  if (!a || !b) return false;
  if (a.isSecretChat || b.isSecretChat) {
    return Boolean(a.secretChatId && b.secretChatId && a.secretChatId === b.secretChatId);
  }
  if (Boolean(a.isGroup) !== Boolean(b.isGroup)) {
    return false;
  }
  if (a.isGroup) {
    const gidA = Number(a.groupId ?? a.id ?? 0);
    const gidB = Number(b.groupId ?? b.id ?? 0);
    return gidA > 0 && gidA === gidB;
  } else {
    const uidA = Number(a.userId ?? a.id ?? 0);
    const uidB = Number(b.userId ?? b.id ?? 0);
    return uidA > 0 && uidA === uidB;
  }
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

  updateChatFolderIds: (chatId: number, isGroup: boolean, folderId: number, isAdded: boolean) => {
    const { allChats, selectedFolderId, isSystemFolder } = get();

    const updated = allChats.map((c) => {
      if (Boolean(c.isGroup) !== Boolean(isGroup)) return c;
      const targetId = isGroup ? Number(c.groupId ?? c.id) : Number(c.userId ?? c.id);
      if (targetId !== chatId) return c;

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
        // 🟢 Подписываем SignalR на все группы пользователя
        fetchedChats.forEach((c: any) => {
          const isGroup = Boolean(c.isGroup ?? c.IsGroup);
          const gid = Number(c.groupId ?? c.GroupId ?? c.id ?? c.Id ?? 0);
          if (isGroup && gid > 0) {
            void signalRService.subscribeToGroupAsync(gid);
          }
        });

        const filtered = fetchedChats
          .filter((c: any) => {
            const isGroup = Boolean(c.isGroup ?? c.IsGroup);
            const uid = Number(c.userId ?? c.UserId ?? c.id ?? c.Id ?? 0);
            return isGroup || uid !== currentUserId;
          })
          .map((c: any) => {
            const isGroup = Boolean(c.isGroup ?? c.IsGroup);
            const isChannel = Boolean(c.isChannel ?? c.IsChannel);
            const uid = isGroup ? null : Number(c.userId ?? c.UserId ?? c.id ?? c.Id ?? 0);
            const gid = isGroup ? Number(c.groupId ?? c.GroupId ?? c.id ?? c.Id ?? 0) : null;

            const rawFolderIds = c.folderIds ?? c.FolderIds;
            const parsedFolderIds = Array.isArray(rawFolderIds) ? rawFolderIds.map(Number) : [];

            const rawLastMessage = c.rawLastMessage ?? c.RawLastMessage ?? c.lastMessage ?? c.LastMessage ?? null;
            const lastAttachmentType = c.lastAttachmentType ?? c.LastAttachmentType ?? null;
            const lastMessageSenderId = c.lastMessageSenderId ?? c.LastMessageSenderId ?? null;
            const isLastAttachmentGif = Boolean(c.isLastAttachmentGif ?? c.IsLastAttachmentGif);
            const isLastMessageDeletedForMe = Boolean(c.isLastMessageDeletedForMe ?? c.IsLastMessageDeletedForMe);

            const [displayText, msgType] = MessagePreviewHelper.formatPreview(
              rawLastMessage,
              lastAttachmentType,
              lastMessageSenderId,
              currentUserId,
              isLastMessageDeletedForMe,
              isGroup,
              isChannel,
              isLastAttachmentGif
            );

            return {
              ...c,
              id: Number(c.id ?? c.Id ?? uid ?? gid ?? 0),
              userId: uid,
              groupId: gid,
              isGroup,
              isChannel,
              rawLastMessage,
              lastAttachmentType,
              lastMessageSenderId,
              isLastAttachmentGif,
              isLastMessageDeletedForMe,
              lastMessage: displayText,
              lastMessageType: msgType,
              isOnline: Boolean(c.isOnline ?? c.IsOnline),
              nickName: c.nickName || c.NickName || c.username || c.UserName || c.groupName || c.GroupName || 'User',
              groupName: c.groupName || c.GroupName || c.nickName || c.NickName || 'Group',
              avatarPath: c.avatarPath ?? c.AvatarPath ?? null,
              lastSeen: c.lastSeen ?? c.LastSeen ?? new Date().toISOString(),
              unreadCount: Number(c.unreadCount ?? c.UnreadCount ?? 0),
              isPinned: Boolean(c.isPinned ?? c.IsPinned),
              isMuted: Boolean(c.isMuted ?? c.IsMuted),
              isBlocked: Boolean(c.isBlocked ?? c.IsBlocked),
              folderIds: parsedFolderIds,
            };
          });

        merged.push(...filtered);
      }

      for (const sc of cachedSecrets) {
        const secretMessages = await chatService.getLocalMessagesAsync(currentUserId, null, null, sc.secretChatId, 1);
        const lastSecretMsg = secretMessages?.length ? secretMessages[secretMessages.length - 1] : null;

        let displayText = sc.lastMessage || (sc.isEstablished ? '🔒 Секретный чат создан.' : '🔒 Ожидание подключения собеседника...');
        let finalType = LastMessageType.None;

        if (lastSecretMsg) {
          const [preview, type] = MessagePreviewHelper.formatPreviewFromMessage(lastSecretMsg, currentUserId, false, false);
          displayText = preview;
          finalType = type;
        } else if (sc.lastMessage) {
          displayText = sc.lastMessage;
          finalType = LastMessageType.Text;
        }

        merged.push({
          id: sc.targetUserId,
          userId: sc.targetUserId,
          groupId: null,
          nickName: sc.targetName,
          groupName: '',
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
          isGroup: false,
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

  openChat: (target) => {
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
        id: ci.isGroup ? (ci.groupId ?? ci.id ?? 0) : (ci.userId ?? ci.id ?? 0),
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
          resolvedUser.isGroup
            ? Boolean(c.isGroup && Number(c.groupId ?? c.id) === Number(resolvedUser.id))
            : Boolean(!c.isGroup && !c.isSecretChat && Number(c.userId ?? c.id) === Number(resolvedUser.id))
        ) || null;

      if (sidebarItem && !resolvedUser.isGroup) {
        resolvedUser.isOnline = Boolean(sidebarItem.isOnline);
        resolvedUser.lastSeen = sidebarItem.lastSeen || resolvedUser.lastSeen;
      }
    }

    // 🟢 Гарантированно подписываемся на открытую группу в SignalR
    if (resolvedUser.isGroup && resolvedUser.id > 0) {
      void signalRService.subscribeToGroupAsync(Number(resolvedUser.id));
    }

    const { allChats, selectedFolderId, isSystemFolder } = get();
    const updatedChats = allChats.map((c) => {
      const isTarget = resolvedUser.isSecretChat
        ? Boolean(c.isSecretChat && c.secretChatId === resolvedUser.secretChatId)
        : resolvedUser.isGroup
        ? Boolean(c.isGroup && Number(c.groupId ?? c.id) === Number(resolvedUser.id))
        : Boolean(!c.isGroup && !c.isSecretChat && Number(c.userId ?? c.id) === Number(resolvedUser.id));

      return isTarget ? { ...c, unreadCount: 0 } : c;
    });

    const currentUpdated = sidebarItem ? { ...sidebarItem, unreadCount: 0 } : null;

    set({
      allChats: updatedChats,
      filteredChats: applyFolderFilter(updatedChats, selectedFolderId, isSystemFolder),
      selectedChatUser: resolvedUser,
      currentSidebarChat: currentUpdated,
    });

    eventBus.emit('SelectChatUserMessage', { target: resolvedUser });
    eventBus.emit('FocusMessageInputMessage' as any, undefined);
  },

  updateSidebar: (userId, groupId, lastMessage, incrementUnread = false, messageType = LastMessageType.Text, secretChatId = null) => {
    const finalMessage = lastMessage;
    const finalType = messageType;

    const chats = [...get().allChats];
    const index = chats.findIndex((c) => {
      if (Boolean(secretChatId)) {
        return Boolean(c.isSecretChat && c.secretChatId === secretChatId);
      }
      if (c.isSecretChat) return false;

      if (Boolean(groupId && groupId > 0)) {
        return Boolean(c.isGroup && Number(c.groupId ?? c.id) === Number(groupId));
      }
      if (Boolean(userId && userId > 0)) {
        return Boolean(!c.isGroup && Number(c.userId ?? c.id) === Number(userId));
      }
      return false;
    });

    if (index >= 0) {
      const chat = { ...chats[index] };
      if (finalMessage !== undefined && finalMessage !== null && finalMessage.trim().length > 0) {
        chat.lastMessage = finalMessage;
        chat.lastMessageType = finalType;
      }
      chat.lastMessageTime = new Date().toISOString();

      if (incrementUnread) {
        chat.unreadCount = (chat.unreadCount || 0) + 1;
      }

      chats[index] = chat;
      const sorted = sortChats(chats);
      const { selectedFolderId, isSystemFolder, currentSidebarChat } = get();

      const updatedCurrent = currentSidebarChat && isMatchingChat(currentSidebarChat, chat)
        ? { ...currentSidebarChat, ...chat }
        : currentSidebarChat;

      set({
        allChats: sorted,
        filteredChats: applyFolderFilter(sorted, selectedFolderId, isSystemFolder),
        currentSidebarChat: updatedCurrent,
      });
    } else {
      get().loadChats(true);
    }
  },

  updateSidebarAfterDeletion: async (userId: number | null, groupId: number | null) => {
    try {
      const currentUserId = Number(
        userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
      );
      const lastMsg = await chatService.getLastMessageForChatAsync(currentUserId, userId, groupId);

      const isGroupSearch = Boolean(groupId && groupId > 0);
      const chat = get().allChats.find((c) =>
        isGroupSearch
          ? Boolean(c.isGroup && Number(c.groupId ?? c.id) === Number(groupId))
          : Boolean(!c.isGroup && Number(c.userId ?? c.id) === Number(userId))
      );

      if (chat) {
        const [formattedText, msgType] = MessagePreviewHelper.formatPreviewFromMessage(
          lastMsg,
          currentUserId,
          chat.isGroup,
          chat.isChannel
        );

        const updated = get().allChats.map((c) => {
          if (isMatchingChat(c, chat)) {
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
        const { selectedFolderId, isSystemFolder, currentSidebarChat } = get();

        const updatedCurrent = currentSidebarChat && isMatchingChat(currentSidebarChat, chat)
          ? {
              ...currentSidebarChat,
              lastMessage: formattedText,
              lastMessageType: msgType,
              lastMessageTime: lastMsg ? lastMsg.timestamp : currentSidebarChat.lastMessageTime,
            }
          : currentSidebarChat;

        set({
          allChats: sorted,
          filteredChats: applyFolderFilter(sorted, selectedFolderId, isSystemFolder),
          currentSidebarChat: updatedCurrent,
        });
      }
    } catch (ex) {
      console.error('[SidebarChatsStore ERROR] Ошибка обновления сайдбара после удаления:', ex);
    }
  },

  updateSidebarForEdit: async (userId, groupId, localId, serverId, newText) => {
    const isGroupSearch = Boolean(groupId && groupId > 0);
    const chat = get().allChats.find((c) =>
      isGroupSearch
        ? Boolean(c.isGroup && Number(c.groupId ?? c.id) === Number(groupId))
        : Boolean(!c.isGroup && Number(c.userId ?? c.id) === Number(userId))
    );
    if (!chat) return;

    try {
      const currentUserId = Number(
        userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
      );
      const trueLastMsg = await chatService.getLastMessageForChatAsync(currentUserId, userId, groupId);

      if (trueLastMsg && (trueLastMsg.id === localId || trueLastMsg.serverId === serverId)) {
        const updated = get().allChats.map((c) =>
          isMatchingChat(c, chat)
            ? { ...c, lastMessage: newText, lastMessageType: LastMessageType.Text }
            : c
        );
        const { selectedFolderId, isSystemFolder, currentSidebarChat } = get();
        const updatedCurrent = currentSidebarChat && isMatchingChat(currentSidebarChat, chat)
          ? { ...currentSidebarChat, lastMessage: newText, lastMessageType: LastMessageType.Text }
          : currentSidebarChat;

        set({
          allChats: updated,
          filteredChats: applyFolderFilter(updated, selectedFolderId, isSystemFolder),
          currentSidebarChat: updatedCurrent,
        });
      }
    } catch (ex) {
      console.error('[SidebarChatsStore ERROR] Ошибка обновления сайдбара при редактировании:', ex);
    }
  },

  togglePinChat: async (chat) => {
    const isNowPinned = !Boolean(chat.isPinned);
    const isGroup = Boolean(chat.isGroup);

    const targetUserId = isGroup ? null : Number(chat.userId ?? chat.id);
    const targetGroupId = isGroup ? Number(chat.groupId ?? chat.id) : null;

    const updatedChats = get().allChats.map((c) =>
      isMatchingChat(c, chat) ? { ...c, isPinned: isNowPinned } : c
    );
    const sorted = sortChats(updatedChats);
    const { selectedFolderId, isSystemFolder, currentSidebarChat } = get();

    const updatedCurrent = currentSidebarChat && isMatchingChat(currentSidebarChat, chat)
      ? { ...currentSidebarChat, isPinned: isNowPinned }
      : currentSidebarChat;

    set({
      allChats: sorted,
      filteredChats: applyFolderFilter(sorted, selectedFolderId, isSystemFolder),
      currentSidebarChat: updatedCurrent,
    });

    try {
      const res = await chatService.togglePinChatAsync(targetUserId, targetGroupId);
      if (res !== null && res !== isNowPinned) {
        const reverted = get().allChats.map((c) =>
          isMatchingChat(c, chat) ? { ...c, isPinned: res } : c
        );
        const reSorted = sortChats(reverted);
        set({
          allChats: reSorted,
          filteredChats: applyFolderFilter(reSorted, selectedFolderId, isSystemFolder),
          currentSidebarChat: get().currentSidebarChat && isMatchingChat(get().currentSidebarChat!, chat)
            ? { ...get().currentSidebarChat!, isPinned: res }
            : get().currentSidebarChat,
        });
      }
    } catch (ex) {
      console.error('[SidebarChatsStore] Ошибка при смене закрепа чата, откат:', ex);
      const reverted = get().allChats.map((c) =>
        isMatchingChat(c, chat) ? { ...c, isPinned: !isNowPinned } : c
      );
      const reSorted = sortChats(reverted);
      set({
        allChats: reSorted,
        filteredChats: applyFolderFilter(reSorted, selectedFolderId, isSystemFolder),
        currentSidebarChat: get().currentSidebarChat && isMatchingChat(get().currentSidebarChat!, chat)
          ? { ...get().currentSidebarChat!, isPinned: !isNowPinned }
          : get().currentSidebarChat,
      });
    }
  },

  toggleMuteChat: async (chat) => {
    const isNowMuted = !Boolean(chat.isMuted);
    const isGroup = Boolean(chat.isGroup);

    const targetUserId = isGroup ? null : Number(chat.userId ?? chat.id);
    const targetGroupId = isGroup ? Number(chat.groupId ?? chat.id) : null;

    const updatedChats = get().allChats.map((c) =>
      isMatchingChat(c, chat) ? { ...c, isMuted: isNowMuted } : c
    );
    const { selectedFolderId, isSystemFolder, currentSidebarChat } = get();

    const updatedCurrent = currentSidebarChat && isMatchingChat(currentSidebarChat, chat)
      ? { ...currentSidebarChat, isMuted: isNowMuted }
      : currentSidebarChat;

    set({
      allChats: updatedChats,
      filteredChats: applyFolderFilter(updatedChats, selectedFolderId, isSystemFolder),
      currentSidebarChat: updatedCurrent,
    });

    if (!isGroup && targetUserId) {
      eventBus.emit('UserMuteStatusChangedMessage' as any, {
        userId: targetUserId,
        isMuted: isNowMuted,
      });
    }

    try {
      const res = await chatService.toggleMuteChatAsync(targetUserId, targetGroupId);
      if (res !== null && res !== isNowMuted) {
        const reverted = get().allChats.map((c) =>
          isMatchingChat(c, chat) ? { ...c, isMuted: res } : c
        );
        set({
          allChats: reverted,
          filteredChats: applyFolderFilter(reverted, selectedFolderId, isSystemFolder),
          currentSidebarChat: get().currentSidebarChat && isMatchingChat(get().currentSidebarChat!, chat)
            ? { ...get().currentSidebarChat!, isMuted: res }
            : get().currentSidebarChat,
        });
      }
    } catch (ex) {
      console.error('[SidebarChatsStore] Ошибка при смене звука чата, откат:', ex);
      const reverted = get().allChats.map((c) =>
        isMatchingChat(c, chat) ? { ...c, isMuted: !isNowMuted } : c
      );
      set({
        allChats: reverted,
        filteredChats: applyFolderFilter(reverted, selectedFolderId, isSystemFolder),
        currentSidebarChat: get().currentSidebarChat && isMatchingChat(get().currentSidebarChat!, chat)
          ? { ...get().currentSidebarChat!, isMuted: !isNowMuted }
          : get().currentSidebarChat,
      });
      if (!isGroup && targetUserId) {
        eventBus.emit('UserMuteStatusChangedMessage' as any, {
          userId: targetUserId,
          isMuted: !isNowMuted,
        });
      }
    }
  },

  blockUser: async (chat: IChatListItem) => {
    if (!chat || chat.isGroup) return;

    const targetUserId = Number(chat.userId ?? chat.id ?? 0);
    if (!targetUserId || targetUserId <= 0) return;

    const currentBlocked = Boolean(chat.isBlocked);
    const nextBlocked = !currentBlocked;

    const updatedChats = get().allChats.map((c) =>
      isMatchingChat(c, chat) ? { ...c, isBlocked: nextBlocked } : c
    );
    const { selectedFolderId, isSystemFolder, currentSidebarChat } = get();

    set({
      allChats: updatedChats,
      filteredChats: applyFolderFilter(updatedChats, selectedFolderId, isSystemFolder),
      currentSidebarChat: currentSidebarChat && isMatchingChat(currentSidebarChat, chat)
        ? { ...currentSidebarChat, isBlocked: nextBlocked }
        : currentSidebarChat,
    });

    try {
      const serverResult = await userService.toggleBlockUserAsync(targetUserId);
      const finalBlocked = Boolean(serverResult ?? nextBlocked);
      await chatService.saveCachedBlockStatusAsync(targetUserId, finalBlocked, false);

      eventBus.emit('BlockStatusChangedMessage' as any, {
        targetUserId,
        blockerId: userSession.userId,
        isBlockedByMe: finalBlocked,
        isBlocked: finalBlocked,
      });
    } catch (ex: any) {
      console.error('[sidebarChatsStore ❌ blockUser] Сбой блокировки:', ex);
    }
  },

  deleteChat: async (chat, groupService, deleteForAll = false) => {
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

      if (useChatStore.getState().selectedChatUser?.secretChatId === chat.secretChatId) {
        set({ selectedChatUser: null, currentSidebarChat: null });
        useChatStore.setState({
          selectedChatUser: null,
          currentChatMessages: [],
          pinnedMessages: [],
          chatSearchResults: [],
          isSelectionMode: false,
          selectedCount: 0,
        });
        eventBus.emit('SelectChatUserMessage', { target: null });
        eventBus.emit('ClearActiveChatMessagesMessage' as any, undefined);
      }
      return;
    }

    const isGroup = Boolean(chat.isGroup);
    const targetUserId = isGroup ? null : Number(chat.userId || chat.id);
    const targetGroupId = isGroup ? Number(chat.groupId || chat.id) : null;
    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );

    if (isGroup && targetGroupId) {
      await groupService?.leaveGroupAsync(targetGroupId);
      await signalRService.unsubscribeFromGroupAsync(targetGroupId);
    } else if (targetUserId) {
      await chatService.deleteChatMessagesLocallyAsync(currentUserId, targetUserId, null, deleteForAll);
      await chatService.clearChatHistoryAsync(targetUserId, null, deleteForAll);
    }

    const updated = get().allChats.filter((c) => !isMatchingChat(c, chat));
    const { selectedFolderId, isSystemFolder } = get();

    set({
      allChats: updated,
      filteredChats: applyFolderFilter(updated, selectedFolderId, isSystemFolder),
    });

    const activeUser = useChatStore.getState().selectedChatUser;
    if (activeUser && Boolean(activeUser.isGroup) === isGroup) {
      const activeId = Number(activeUser.id);
      const targetChatId = Number(isGroup ? targetGroupId : targetUserId);
      if (activeId === targetChatId) {
        set({ selectedChatUser: null, currentSidebarChat: null });
        useChatStore.setState({
          selectedChatUser: null,
          currentChatMessages: [],
          pinnedMessages: [],
          chatSearchResults: [],
          isSelectionMode: false,
          selectedCount: 0,
        });
        eventBus.emit('SelectChatUserMessage', { target: null });
      }
    }
  },

  clearChatHistory: async (chat, deleteForAll) => {
    const isGroup = Boolean(chat.isGroup);
    const targetUserId = isGroup ? null : Number(chat.userId || chat.id);
    const targetGroupId = isGroup ? Number(chat.groupId || chat.id) : null;
    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );

    try {
      await chatService.deleteChatMessagesLocallyAsync(currentUserId, targetUserId, targetGroupId, deleteForAll);

      const activeChat = useChatStore.getState().selectedChatUser;
      const isCurrentActive = activeChat &&
        Boolean(activeChat.isGroup) === isGroup &&
        Number(activeChat.id) === (isGroup ? targetGroupId : targetUserId);

      if (isCurrentActive) {
        useChatStore.setState({
          currentChatMessages: [],
          pinnedMessages: [],
          chatSearchResults: [],
          isSelectionMode: false,
          selectedCount: 0,
        });
      }

      await chatService.clearChatHistoryAsync(targetUserId, targetGroupId, deleteForAll);

      if (deleteForAll) {
        get().updateSidebar(targetUserId, targetGroupId, '', false, LastMessageType.None);
      } else {
        await get().updateSidebarAfterDeletion(targetUserId, targetGroupId);
      }
    } catch (ex) {
      console.error('[SidebarChatsStore ERROR] Ошибка очистки истории чата:', ex);
    }
  },

  syncOnlineStatuses: async () => {
    const currentChats = get().allChats;
    const userIds = Array.from(
      new Set(
        currentChats
          .filter((c) => !c.isGroup && !c.isSecretChat)
          .map((c) => Number(c.userId ?? (c as any).UserId ?? c.id ?? 0))
          .filter((id) => id > 0)
      )
    );

    const activeUser = useChatStore.getState().selectedChatUser;
    if (activeUser && !activeUser.isGroup && !activeUser.isSecretChat) {
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
        if (c.isGroup || c.isSecretChat) return c;
        const uid = Number(c.userId ?? (c as any).UserId ?? c.id ?? 0);
        if (uid > 0) {
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
      if (currentActive && !currentActive.isGroup && !currentActive.isSecretChat) {
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
      console.warn('[SidebarChatsStore] Ошибка синхронизации онлайна:', err);
    }
  },
}));

// ================= ВСЕ СЛУШАТЕЛИ EVENTBUS =================

eventBus.on('NewMessageAddedMessage' as any, (m: any) => {
  if (!m) return;
  const currentUserId = Number(userSession.userId || 0);
  const otherUserId = m.isMyMessage ? m.receiverId : m.senderId;

  const [previewText, msgType] = MessagePreviewHelper.formatPreviewFromMessage(
    m,
    currentUserId,
    Boolean(m.groupId && m.groupId > 0),
    false
  );

  useSidebarChatsStore.getState().updateSidebar(
    otherUserId,
    m.groupId,
    previewText,
    !m.isMyMessage,
    msgType,
    m.secretChatId
  );
});

eventBus.on('UserStatusChangedMessage' as any, ({ userId, isOnline, lastSeen }: { userId: number; isOnline: boolean; lastSeen: string }) => {
  const numId = Number(userId);

  useSidebarChatsStore.setState((state) => {
    const updatedChats = state.allChats.map((c) => {
      if (c.isGroup || c.isSecretChat) return c;
      const uid = Number(c.userId ?? (c as any).UserId ?? c.id ?? (c as any).Id ?? 0);
      if (uid === numId) {
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
  if (activeChat && !activeChat.isGroup && !activeChat.isSecretChat && Number(activeChat.id ?? (activeChat as any).userId) === numId) {
    useChatStore.setState({
      selectedChatUser: {
        ...activeChat,
        isOnline: Boolean(isOnline),
        lastSeen: isOnline ? new Date().toISOString() : (lastSeen || activeChat.lastSeen),
      },
    });
  }
});

eventBus.on('SelectChatUserMessage' as any, (data: any) => {
  const target = data && typeof data === 'object' && 'target' in data ? data.target : data;
  if (target) {
    const isGroup = Boolean(target.isGroup);
    const targetId = Number(target.id);
    const existing = useSidebarChatsStore.getState().allChats.find((c) =>
      isGroup
        ? Boolean(c.isGroup && Number(c.groupId ?? c.id) === targetId)
        : Boolean(!c.isGroup && !c.isSecretChat && Number(c.userId ?? c.id) === targetId)
    );
    useSidebarChatsStore.setState({
      selectedChatUser: target,
      currentSidebarChat: existing || null,
    });
  } else {
    useSidebarChatsStore.setState({
      selectedChatUser: null,
      currentSidebarChat: null,
    });
  }
});

eventBus.on('SidebarUpdateAfterDeletionMessage' as any, ({ userId, groupId }: { userId: number | null; groupId: number | null }) => {
  useSidebarChatsStore.getState().updateSidebarAfterDeletion(userId, groupId);
});

eventBus.on('SidebarUpdateForEditMessage' as any, ({ userId, groupId, localId, serverId, newText }: any) => {
  useSidebarChatsStore.getState().updateSidebarForEdit(userId, groupId, localId, serverId, newText);
});

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

eventBus.on('SyncTimerMessage' as any, () => {
  useSidebarChatsStore.getState().syncOnlineStatuses();
});

eventBus.on('SignalRConnectedMessage' as any, () => {
  useSidebarChatsStore.getState().syncOnlineStatuses();
});

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

eventBus.on('UserTypingMessage' as any, ({ senderId, groupId }: { senderId: number; groupId: number | null }) => {
  const store = useSidebarChatsStore.getState();
  const isGroup = Boolean(groupId && groupId > 0);
  const key = isGroup ? `g_${groupId}` : `u_${senderId}`;

  const chats = store.allChats.map((c) => {
    if (isGroup && c.isGroup && Number(c.groupId ?? c.id) === Number(groupId)) {
      return { ...c, isTyping: true };
    }
    if (!isGroup && !c.isGroup && Number(c.userId ?? c.id) === Number(senderId)) {
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
      if (isGroup && c.isGroup && Number(c.groupId ?? c.id) === Number(groupId)) {
        return { ...c, isTyping: false };
      }
      if (!isGroup && !c.isGroup && Number(c.userId ?? c.id) === Number(senderId)) {
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

eventBus.on('ActiveChatUnreadResetMessage' as any, (data: any) => {
  useSidebarChatsStore.setState((state) => {
    const targetUid = Number(data?.targetUserId ?? data?.userId ?? 0);
    const targetGid = Number(data?.targetGroupId ?? data?.groupId ?? 0);
    const secretChatId = data?.secretChatId;

    const updated = state.allChats.map((chat) => {
      if (secretChatId) {
        return chat.isSecretChat && chat.secretChatId === secretChatId
          ? { ...chat, unreadCount: 0 }
          : chat;
      }

      if (targetGid > 0) {
        return Boolean(chat.isGroup && Number(chat.groupId ?? chat.id) === targetGid)
          ? { ...chat, unreadCount: 0 }
          : chat;
      }

      if (targetUid > 0) {
        return Boolean(!chat.isGroup && !chat.isSecretChat && Number(chat.userId ?? chat.id) === targetUid)
          ? { ...chat, unreadCount: 0 }
          : chat;
      }

      return chat;
    });

    return {
      allChats: updated,
      filteredChats: applyFolderFilter(updated, state.selectedFolderId, state.isSystemFolder),
    };
  });
});

eventBus.on('GroupUpdatedMessage' as any, ({ groupId, newName, newAvatar, newDescription }: any) => {
  useSidebarChatsStore.setState((state) => {
    const updated = state.allChats.map((c) =>
      c.isGroup && Number(c.groupId ?? c.id) === Number(groupId)
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

eventBus.on('ChatClearedForBothMessage' as any, async ({ blockerId }: { blockerId: number }) => {
  const currentUserId = Number(userSession.userId || 0);
  const { selectedChatUser } = useChatStore.getState();

  console.log(`[sidebarChatsStore 💥 ChatClearedForBothMessage] Собеседник ${blockerId} удалил чат для обоих! Полная очистка.`);

  if (selectedChatUser && !selectedChatUser.isGroup && Number(selectedChatUser.id) === Number(blockerId)) {
    useChatStore.setState({
      currentChatMessages: [],
      pinnedMessages: [],
      chatSearchResults: [],
      isSelectionMode: false,
      selectedCount: 0,
    });
  }

  await chatService.deleteChatMessagesLocallyAsync(currentUserId, blockerId, null, true);
  await useSidebarChatsStore.getState().updateSidebarAfterDeletion(blockerId, null);
});

eventBus.on('ChatFolderSelectedMessage' as any, ({ folder }: { folder: any }) => {
  if (!folder) return;
  const isSystem = Boolean(folder.isSystem ?? folder.IsSystem);
  const folderId = isSystem ? null : Number(folder.id ?? folder.Id);
  useSidebarChatsStore.getState().selectFolder(folderId, isSystem);
});

eventBus.on('ToggleBlockUserMessage' as any, ({ userId }: { userId: number }) => {
  const store = useSidebarChatsStore.getState();
  const numId = Number(userId);
  const targetChat = store.allChats.find((c) => !c.isGroup && Number(c.userId ?? c.id) === numId);
  if (targetChat) {
    store.blockUser(targetChat);
  } else {
    store.blockUser({ id: numId, userId: numId, isGroup: false } as any);
  }
});