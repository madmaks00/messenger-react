// src/stores/notificationStore.ts
import { create } from 'zustand';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  avatar?: string | null;
}

interface NotificationState {
  notifications: NotificationItem[];
  showNotification: (title: string, message: string, avatar?: string | null, autoCloseSeconds?: number) => void;
  removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],

  showNotification: (title, message, avatar = null, autoCloseSeconds = 4) => {
    const id = `notif_${Date.now()}_${Math.random()}`;
    const item: NotificationItem = { id, title, message, avatar };

    // Максимум 3 всплывающих уведомления (MaxNotifications = 3 из C#)
    const current = get().notifications;
    const updated = [item, ...current].slice(0, 3);
    set({ notifications: updated });

    setTimeout(() => {
      get().removeNotification(id);
    }, autoCloseSeconds * 1000);
  },

  removeNotification: (id) => {
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) }));
  },
}));