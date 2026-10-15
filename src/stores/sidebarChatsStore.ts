import { userPresenceState, parsePresence, UserPresence, PresenceTicket, GroupPresence, parseGroupPresence } from '../services/userPresenceState';
import { create } from 'zustand';
import { IChatListItem, IUserSearchResult } from '../types/models';
import { LastMessageType } from '../types/enums';
import { eventBus } from '../services/eventBus';
import { userSession } from '../services/userSession';
import { signalRService } from '../services/signalr.service';
import { chatService } from '../services/chat.service';
import { chatFolderService } from '../services/chatFolderService';
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
  updateChatFolderIds: (chatId: number, isGroup: boolean, folderId: number, isAdded: boolean, secretChatId?: string | null) => void;
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
  applyGroupPresence: (groupId:number,status:GroupPresence,ticket?:PresenceTicket)=>boolean;
  applyPresence: (userId: number, status: UserPresence, ticket?: PresenceTicket) => boolean;
  syncOnlineStatuses: (force?: boolean) => Promise<void>;
  startGlobalStatusPolling: () => void;
  stopGlobalStatusPolling: () => void;
}

let statusSyncPromise: Promise<void> | null = null;
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

function extractPresence(statuses: any, userId: number): UserPresence | undefined {
  if (!statuses) return undefined;
  if (statuses instanceof Map) return parsePresence(statuses.get(userId) ?? statuses.get(String(userId)));
  if (Array.isArray(statuses)) {
    for (const item of statuses) {
      if (Array.isArray(item) && Number(item[0]) === userId) return parsePresence(item[1]);
      if (item && Number(item.key ?? item.Key ?? item.userId ?? item.UserId) === userId) return parsePresence(item.value ?? item.Value ?? item);
    }
    return undefined;
  }
  return parsePresence(statuses[userId]);
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

  updateChatFolderIds: (chatId: number, isGroup: boolean, folderId: number, isAdded: boolean, secretChatId: string | null = null) => {
    const { allChats, selectedFolderId, isSystemFolder } = get();

    const updated = allChats.map((c) => {
      if (Boolean(c.isGroup) !== Boolean(isGroup)) return c;
      const targetId = isGroup ? Number(c.groupId ?? c.id) : Number(c.userId ?? c.id);
      if (secretChatId) {
        if (!c.isSecretChat || c.secretChatId !== secretChatId) return c;
      } else if (c.isSecretChat || targetId !== chatId) return c;

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

    const presenceTicket = userPresenceState.capture();
    try {
      const fetchedChats: IChatListItem[] = await chatService.getChatsAsync();
      const secretFolderItems = await chatFolderService.getSecretFolderItemsAsync().catch(() => ({} as Record<string, number[]>));
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
          folderIds: secretFolderItems[sc.secretChatId] || [],
          isLastAttachmentGif: false,
          isLastMessageDeletedForMe: false,
        });
      }

      if (presenceTicket.owner !== Number(userSession.userId || 0)) return;
      for (const chat of merged) {
        if (chat.isGroup) {
          const id=Number(chat.groupId??chat.id);const value=parseGroupPresence(chat);if(value)get().applyGroupPresence(id,value,presenceTicket);
          const known=userPresenceState.getGroup(id);if(known)Object.assign(chat,known);continue;
        }
        const id = Number(chat.userId ?? chat.id);
        // Push updates received while the list was loading take precedence over that HTTP response.
        if (!chat.isSecretChat) get().applyPresence(id, {isOnline:Boolean(chat.isOnline),lastSeen:chat.lastSeen}, presenceTicket);
        const known = userPresenceState.get(id);if (known) Object.assign(chat, known);
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

    if(resolvedUser.isGroup){const known=userPresenceState.getGroup(Number(resolvedUser.id));if(known)Object.assign(resolvedUser,known);}
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

  applyGroupPresence: (groupId,snapshot,ticket) => {
    const accepted=userPresenceState.acceptGroup(groupId,snapshot,ticket);if(!accepted)return false;
    const update=(chat:IChatListItem)=>chat.isGroup&&Number(chat.groupId??chat.id)===Number(groupId)?{...chat,...accepted}:chat;
    set(state=>{const chats=state.allChats.map(update);const selected=state.selectedChatUser;
      return {allChats:chats,filteredChats:applyFolderFilter(chats,state.selectedFolderId,state.isSystemFolder),
        currentSidebarChat:state.currentSidebarChat?update(state.currentSidebarChat):null,
        selectedChatUser:selected?.isGroup&&Number(selected.id)===Number(groupId)?{...selected,...accepted}:selected};});
    const active=useChatStore.getState().selectedChatUser;
    if(active?.isGroup&&Number(active.id)===Number(groupId))useChatStore.setState({selectedChatUser:{...active,...accepted}});
    return true;
  },
  applyPresence: (userId, snapshot, ticket) => {
    const accepted = userPresenceState.accept(userId, snapshot, ticket);
    if (!accepted) return false;
    const update = (chat: IChatListItem) => !chat.isGroup && Number(chat.userId ?? chat.id) === Number(userId) ? {...chat,...accepted} : chat;
    set(state => {
      const chats = state.allChats.map(update);
      const selected = state.selectedChatUser;
      return {allChats:chats, filteredChats:applyFolderFilter(chats,state.selectedFolderId,state.isSystemFolder),
        currentSidebarChat:state.currentSidebarChat ? chats.find(chat=>isMatchingChat(chat,state.currentSidebarChat!)) || update(state.currentSidebarChat) : null,
        selectedChatUser:selected && !selected.isGroup && Number(selected.id)===Number(userId) ? {...selected,...accepted} : selected};
    });
    const active = useChatStore.getState().selectedChatUser;
    if (active && !active.isGroup && Number(active.id)===Number(userId)) useChatStore.setState({selectedChatUser:{...active,...accepted}});
    userService.updateCachedPresence(userId, accepted);
    return true;
  },

  syncOnlineStatuses: async (force=false) => {
    if (statusSyncPromise) return force ? statusSyncPromise.then(()=>get().syncOnlineStatuses()) : statusSyncPromise;
    const task = (async () => {
      const userIds = new Set(get().allChats.filter(chat=>!chat.isGroup).map(chat=>Number(chat.userId??chat.id)).filter(id=>id>0));
      const active=useChatStore.getState().selectedChatUser;if(active&&!active.isGroup&&active.id>0)userIds.add(Number(active.id));
      const groupIds=new Set(get().allChats.filter(chat=>chat.isGroup).map(chat=>Number(chat.groupId??chat.id)).filter(id=>id>0));
      if(active?.isGroup&&active.id>0)groupIds.add(Number(active.id));
      if (!userIds.size&&!groupIds.size) return;
      const ticket=userPresenceState.capture();
      try {
        // Each result is independent: a failed group snapshot must not suppress personal status updates.
        const results=await Promise.allSettled([
          userIds.size?signalRService.getPresenceSnapshotAsync([...userIds]):Promise.resolve(null),
          groupIds.size?signalRService.getGroupPresenceSnapshotAsync([...groupIds]):Promise.resolve(null)]);
        if(ticket.owner!==Number(userSession.userId||0))return;
        const statuses=results[0].status==='fulfilled'?results[0].value:null;
        const groups=results[1].status==='fulfilled'?results[1].value:null;
        for(const id of userIds){const value=extractPresence(statuses,id);if(value)get().applyPresence(id,value,ticket);}
        for(const id of groupIds){const value=parseGroupPresence(groups?.[id]);if(value)get().applyGroupPresence(id,value,ticket);}
      }catch(error){console.warn('[Presence] Status synchronization failed:',error);}
    })();
    const tracked=task.finally(()=>{if(statusSyncPromise===tracked)statusSyncPromise=null;});statusSyncPromise=tracked;
    return tracked;
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

eventBus.on('GroupPresenceChangedMessage' as any,({groupId,onlineCount,memberCount}:any)=>{const value=parseGroupPresence({onlineCount,memberCount});if(value)useSidebarChatsStore.getState().applyGroupPresence(Number(groupId),value);});
eventBus.on('UserJoinedGroupMessage' as any,()=>{void useSidebarChatsStore.getState().syncOnlineStatuses(true);});
eventBus.on('UserLeftGroupMessage' as any,()=>{void useSidebarChatsStore.getState().syncOnlineStatuses(true);});

eventBus.on('UserStatusChangedMessage', ({userId,isOnline,lastSeen}) => {
  const status = parsePresence({isOnline,lastSeen});if(status)useSidebarChatsStore.getState().applyPresence(userId,status);
});
eventBus.on('BeforeAccountSwitchMessage',()=>{userPresenceState.reset();useSidebarChatsStore.getState().stopGlobalStatusPolling();});

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
  userPresenceState.invalidateRequests();
  void useSidebarChatsStore.getState().syncOnlineStatuses(true);
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
    if (!isGroup && !c.isGroup && !c.isSecretChat && Number(c.userId ?? c.id) === Number(senderId)) {
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
      if (!isGroup && !c.isGroup && !c.isSecretChat && Number(c.userId ?? c.id) === Number(senderId)) {
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

eventBus.on('UserProfileUpdatedMessage', ({ user }) => {
  if (!user || user.id <= 0) return;
  userService.cacheUserProfile(user);
  const profile = { nickName: user.nickName || user.username || 'User', username: user.username,
    avatar: user.avatar ?? null, avatarPath: user.avatarPath || null };
  useSidebarChatsStore.setState(state => {
    const update = (chat: IChatListItem) => !chat.isGroup && Number(chat.userId ?? chat.id) === user.id
      ? { ...chat, ...profile } : chat;
    const allChats = state.allChats.map(update);
    const selected = state.selectedChatUser;
    return { allChats, filteredChats: applyFolderFilter(allChats, state.selectedFolderId, state.isSystemFolder),
      currentSidebarChat: state.currentSidebarChat ? update(state.currentSidebarChat) : null,
      selectedChatUser: selected && !selected.isGroup && Number(selected.id) === user.id ? { ...selected, ...profile } : selected };
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