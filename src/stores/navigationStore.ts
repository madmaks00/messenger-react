import { create } from 'zustand';
import { MainTab } from '../types/enums';

interface NavigationState {
  currentTab: MainTab;
  isDarkTheme: boolean;
  isProfileOpen: boolean;
  hasUnreadChats: boolean;
  hasDueTasks: boolean;
  
  // Размеры и состояние сайдбара
  sidebarWidth: number;
  isSidebarCollapsed: boolean;

  // Actions
  switchTab: (tab: MainTab) => void;
  toggleTheme: () => void;
  openProfile: () => void;
  closeProfile: () => void;
  setSidebarWidth: (width: number) => void;
  toggleSidebarCollapse: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setHasUnreadChats: (has: boolean) => void;
  setHasDueTasks: (has: boolean) => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  currentTab: MainTab.Chats,
  isDarkTheme: true,
  isProfileOpen: false,
  hasUnreadChats: false,
  hasDueTasks: false,
  sidebarWidth: 340,
  isSidebarCollapsed: false,

  switchTab: (tab) => set({ currentTab: tab }),

  toggleTheme: () => {
    const nextTheme = !get().isDarkTheme;
    set({ isDarkTheme: nextTheme });
    document.documentElement.setAttribute('data-theme', nextTheme ? 'dark' : 'light');
  },

  openProfile: () => set({ isProfileOpen: true }),
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