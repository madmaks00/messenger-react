import { create } from 'zustand';
import { IUserSearchResult, IMessage } from '../types/models';
import { userService } from '../services/user.service';
import { chatService } from '../services/chat.service';
import { userSession } from '../services/userSession';
import { eventBus } from '../services/eventBus';

const RECENT_SEARCHES_KEY = 'recent_searches_users';

interface SearchState {
  searchText: string;
  isSearching: boolean;
  recentUsers: IUserSearchResult[];
  foundUsers: IUserSearchResult[];
  foundMessages: IMessage[];

  // Actions
  setSearchText: (text: string) => void;
  selectUser: (user: IUserSearchResult) => void;
  clearRecentSearches: () => void;
  jumpToMessage: (message: IMessage) => void;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useSearchStore = create<SearchState>((set, get) => ({
  searchText: '',
  isSearching: false,
  recentUsers: loadRecentFromStorage(),
  foundUsers: [],
  foundMessages: [],

  setSearchText: (text) => {
    set({ searchText: text });

    if (!text.trim()) {
      set({ foundUsers: [], foundMessages: [], isSearching: false });
      return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);

    set({ isSearching: true });

    // Дебаунс 250 мс из C#
    debounceTimer = setTimeout(async () => {
      const query = text.trim();
      try {
        const [users, messages] = await Promise.all([
          userService.searchUsersAsync(query),
          chatService.searchMessagesAsync(query),
        ]);

        const filtered = (users || []).filter((u) => u.id !== userSession.userId);
        set({ foundUsers: filtered, foundMessages: messages || [], isSearching: false });
      } catch {
        set({ isSearching: false });
      }
    }, 250);
  },

  selectUser: (user) => {
    const recent = get().recentUsers.filter((u) => u.id !== user.id);
    const updated = [user, ...recent].slice(0, 30);
    set({ recentUsers: updated });
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));

    eventBus.emit('SelectChatUserMessage', { target: user });
  },

  clearRecentSearches: () => {
    set({ recentUsers: [] });
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  },

  jumpToMessage: (message) => {
    const targetId = message.groupId || (message.senderId === userSession.userId ? message.receiverId : message.senderId);
    if (targetId) {
      const targetUser: IUserSearchResult = {
        id: targetId,
        nickName: message.senderName || 'Chat',
        isGroup: Boolean(message.groupId),
        isOnline: false,
        lastSeen: '',
        memberCount: 0,
        onlineCount: 0,
        isTyping: false,
        isChannel: false,
        adminId: 0,
        isSecretChat: false,
      };
      eventBus.emit('SelectChatUserMessage', { target: targetUser });
      eventBus.emit('ScrollToMessageRequestMessage' as any, { messageId: message.serverId || message.id });
    }
  },
}));

function loadRecentFromStorage(): IUserSearchResult[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}