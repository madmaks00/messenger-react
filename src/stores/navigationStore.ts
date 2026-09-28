import { create } from 'zustand';
import { MainTab } from '../types/enums';
import { IUserSearchResult } from '../types/models';
import { userService } from '../services/user.service';
import { userSession } from '../services/userSession';
import { useChatStore } from './chatStore';
import type { RightContainerType } from '../components/profile/useProfileView';

export type { RightContainerType };

interface NavigationState {
  currentTab: MainTab;
  isDarkTheme: boolean;
  isProfileOpen: boolean;
  hasUnreadChats: boolean;
  hasDueTasks: boolean;

  isOwnProfile: boolean;
  isGroupProfile: boolean;
  profileUser: any | null;
  profileInitialTab: RightContainerType;

  sidebarWidth: number;
  isSidebarCollapsed: boolean;

  switchTab: (tab: MainTab) => void;
  toggleTheme: () => void;

  openOwnProfile: (initialTab?: RightContainerType) => Promise<void>;
  openUserProfile: (userId: number, initialData?: any) => Promise<void>;
  openGroupProfile: (group: IUserSearchResult | any) => Promise<void>;
  openCurrentChatProfile: () => void;
  openProfile: (target?: any) => void;
  closeProfile: () => void;

  setSidebarWidth: (width: number) => void;
  toggleSidebarCollapse: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setHasUnreadChats: (has: boolean) => void;
  setHasDueTasks: (has: boolean) => void;
}

function getCurrentSessionUser(): any {
  try {
    const raw =
      localStorage.getItem('user_session_data') ||
      localStorage.getItem('current_user') ||
      localStorage.getItem('user');
    if (raw) {
      const parsed = JSON.parse(raw);
      const resolvedId = Number(parsed.id || parsed.userId || parsed.Id || userSession.userId || 0);
      return { ...parsed, id: resolvedId, userId: resolvedId };
    }
  } catch {}

  const fallbackId = Number(userSession.userId || 0);
  return { id: fallbackId, userId: fallbackId, nickName: 'Me' };
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  currentTab: MainTab.Chats,
  isDarkTheme: true,
  isProfileOpen: false,
  hasUnreadChats: false,
  hasDueTasks: false,

  isOwnProfile: true,
  isGroupProfile: false,
  profileUser: null,
  profileInitialTab: 'stories',

  sidebarWidth: 340,
  isSidebarCollapsed: false,

  switchTab: (tab) => set({ currentTab: tab }),

  toggleTheme: () => {
    const nextTheme = !get().isDarkTheme;
    set({ isDarkTheme: nextTheme });
    document.documentElement.setAttribute('data-theme', nextTheme ? 'dark' : 'light');
  },

  openOwnProfile: async (initialTab = 'stories') => {
    console.warn('%c[PROFILE_DEBUG] ⚠️ openOwnProfile() CALLED!', 'color: #ff0055; font-weight: bold;', {
      stack: new Error().stack,
    });

    const sessionUser = getCurrentSessionUser();
    set({
      isProfileOpen: true,
      isOwnProfile: true,
      isGroupProfile: false,
      profileUser: sessionUser,
      profileInitialTab: initialTab,
    });

    const currentUserId = Number(userSession.userId || sessionUser.id || sessionUser.userId || 0);
    if (currentUserId > 0) {
      try {
        const freshUser = await userService.getUserProfileAsync(currentUserId);
        if (freshUser && get().isOwnProfile) {
          set({ profileUser: freshUser });
        }
      } catch (err) {
        console.warn('[NavigationStore] Ошибка загрузки своего профиля:', err);
      }
    }
  },

  openUserProfile: async (userId: number, initialData?: any) => {
    const targetId = Number(userId || 0);
    const sessionUser = getCurrentSessionUser();
    const currentUserId = Number(userSession.userId || sessionUser?.id || sessionUser?.userId || 0);

    console.log('%c[PROFILE_DEBUG] openUserProfile() called', 'color: #00ff66; font-weight: bold;', {
      targetId,
      rawUserIdParam: userId,
      currentUserId,
      sessionUser,
      isEqual: targetId === currentUserId,
      initialData,
    });

    if (targetId <= 0) {
      console.error('[PROFILE_DEBUG] ❌ targetId <= 0, прерываем открытие профиля:', userId);
      return;
    }

    if (currentUserId > 0 && targetId === currentUserId) {
      console.warn('[PROFILE_DEBUG] targetId совпал с currentUserId -> открываем свой профиль');
      await get().openOwnProfile();
      return;
    }

    // 🟢 СИНХРОННО: переключаем флаги и сразу записываем базовые данные собеседника
    set({
      isProfileOpen: true,
      isOwnProfile: false,
      isGroupProfile: false,
      profileUser: initialData
        ? { id: targetId, userId: targetId, ...initialData }
        : { id: targetId, userId: targetId, nickName: 'Loading...' },
      profileInitialTab: null,
    });

    try {
      const targetUser = await userService.getUserProfileAsync(targetId);
      console.log('[PROFILE_DEBUG] Ответ от userService.getUserProfileAsync:', targetUser);

      if (targetUser && !get().isOwnProfile && Number(get().profileUser?.id) === targetId) {
        set({
          profileUser: targetUser,
        });
      }
    } catch (err) {
      console.error(`[NavigationStore] Ошибка при открытии профиля UserId=${targetId}:`, err);
    }
  },

  openGroupProfile: async (group: any) => {
    console.log('%c[PROFILE_DEBUG] openGroupProfile() called', 'color: #00ccff; font-weight: bold;', group);
    if (!group) return;
    const targetGroupId = Number(group.id || group.groupId || (group as any).Id || 0);

    set({
      isProfileOpen: true,
      isOwnProfile: false,
      isGroupProfile: true,
      profileUser: {
        id: targetGroupId,
        groupId: targetGroupId,
        nickName: group.nickName || group.groupName || 'Group',
        ...group,
      },
      profileInitialTab: null,
    });
  },

  openCurrentChatProfile: () => {
    const activeChat = useChatStore.getState().selectedChatUser;
    console.log('%c[PROFILE_DEBUG] openCurrentChatProfile() called', 'color: #ffbb00; font-weight: bold;', {
      activeChat,
    });

    if (!activeChat) {
      void get().openOwnProfile();
      return;
    }

    const targetGroupId = Number(
      activeChat.groupId ||
      (activeChat as any).GroupId ||
      (activeChat.isGroup ? activeChat.id : 0) ||
      0
    );

    const targetUserId = Number(
      activeChat.userId ||
      (activeChat as any).UserId ||
      (!activeChat.isGroup ? activeChat.id : 0) ||
      0
    );

    if (activeChat.isGroup && targetGroupId > 0) {
      void get().openGroupProfile(activeChat);
    } else if (!activeChat.isGroup && targetUserId > 0) {
      void get().openUserProfile(targetUserId, activeChat);
    } else {
      console.warn('[PROFILE_DEBUG] Не удалось определить ID чата:', activeChat);
    }
  },

  openProfile: (target?: any) => {
    console.log('%c[PROFILE_DEBUG] openProfile() универсальный вызван с аргументом:', 'color: #ff9900; font-weight: bold;', target);

    if (target && typeof target === 'object' && ('nativeEvent' in target || 'currentTarget' in target)) {
      get().openCurrentChatProfile();
      return;
    }

    if (target) {
      if (typeof target === 'number') {
        void get().openUserProfile(target);
        return;
      }
      if (target.isGroup) {
        void get().openGroupProfile(target);
        return;
      }

      const resolvedId = Number(target.userId || target.senderId || target.id || (target as any).Id || 0);
      if (resolvedId > 0) {
        void get().openUserProfile(resolvedId, target);
        return;
      }
    }

    // Если вызов без параметров — открываем свой профиль
    void get().openOwnProfile();
  },

  closeProfile: () => set({ isProfileOpen: false }),

  setSidebarWidth: (width) => set({ sidebarWidth: width }),

  toggleSidebarCollapse: () => {
    const { isSidebarCollapsed, sidebarWidth } = get();
    if (isSidebarCollapsed) {
      set({ isSidebarCollapsed: false, sidebarWidth: sidebarWidth < 180 ? 340 : sidebarWidth });
    } else {
      set({ isSidebarCollapsed: true });
    }
  },

  setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
  setHasUnreadChats: (has) => set({ hasUnreadChats: has }),
  setHasDueTasks: (has) => set({ hasDueTasks: has }),
}));