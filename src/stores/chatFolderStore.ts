import { create } from 'zustand';
import { IChatListItem } from '../types/models';
import { apiClient } from '../services/apiClient';

export interface IChatFolder {
  id: number;
  name: string;
  icon: string;
  color: string;
  isSystem: boolean;
  order: number;
  includedChatIds: number[];
  isDragging?: boolean;
}

interface ChatFolderState {
  chatFolders: IChatFolder[];
  customFolders: IChatFolder[];
  selectedFolderId: number | null;
  isEditFolderDialogOpen: boolean;
  editingFolder: IChatFolder | null;

  // Действия
  loadFolders: () => Promise<void>;
  selectFolder: (folderId: number | null) => void;
  reorderFolders: (fromIndex: number, toIndex: number) => void;
  saveFoldersOrder: () => Promise<void>;
  toggleChatInFolder: (folderId: number, chat: IChatListItem) => Promise<void>;
  createFolder: (name: string, icon: string, color: string, chatIds?: number[]) => Promise<void>;
  updateFolder: (folder: IChatFolder) => Promise<void>;
  deleteFolder: (folderId: number) => Promise<void>;
  openEditDialog: (folder: IChatFolder) => void;
  closeEditDialog: () => void;
}

const DEFAULT_SYSTEM_FOLDER: IChatFolder = {
  id: 0,
  name: 'All Chats',
  icon: 'FolderOutline',
  color: '#FFFFFF',
  isSystem: true,
  order: 0,
  includedChatIds: [],
};

export const useChatFolderStore = create<ChatFolderState>((set, get) => ({
  chatFolders: [DEFAULT_SYSTEM_FOLDER],
  customFolders: [],
  selectedFolderId: 0,
  isEditFolderDialogOpen: false,
  editingFolder: null,

  loadFolders: async () => {
    try {
      const res = await apiClient.get<IChatFolder[]>('api/Folders');
      const loaded = res.data || [];
      const custom = loaded.filter((f) => !f.isSystem).sort((a, b) => a.order - b.order);
      set({
        chatFolders: [DEFAULT_SYSTEM_FOLDER, ...custom],
        customFolders: custom,
      });
    } catch {
      // Fallback на локальное хранилище
      const localRaw = localStorage.getItem('user_chat_folders');
      if (localRaw) {
        const parsed: IChatFolder[] = JSON.parse(localRaw);
        set({
          chatFolders: [DEFAULT_SYSTEM_FOLDER, ...parsed],
          customFolders: parsed,
        });
      }
    }
  },

  selectFolder: (folderId) => set({ selectedFolderId: folderId }),

  reorderFolders: (fromIndex, toIndex) => {
    const folders = [...get().chatFolders];
    // Нельзя перемещать системную папку 'All' (индекс 0)
    if (fromIndex <= 0 || toIndex <= 0 || fromIndex >= folders.length || toIndex >= folders.length) return;

    const [moved] = folders.splice(fromIndex, 1);
    folders.splice(toIndex, 0, moved);

    // Пересчет индексов order
    folders.forEach((f, idx) => {
      f.order = idx;
    });

    const custom = folders.filter((f) => !f.isSystem);
    set({ chatFolders: folders, customFolders: custom });
    get().saveFoldersOrder();
  },

  saveFoldersOrder: async () => {
    const custom = get().customFolders;
    try {
      await apiClient.post('api/Folders/reorder', custom.map((f) => ({ id: f.id, order: f.order })));
    } catch {
      // Локальное сохранение
      localStorage.setItem('user_chat_folders', JSON.stringify(custom));
    }
  },

  toggleChatInFolder: async (folderId, chat) => {
    const chatId = chat.isGroup ? chat.groupId! : chat.userId!;
    const custom = get().customFolders.map((f) => {
      if (f.id === folderId) {
        const exists = f.includedChatIds.includes(chatId);
        const updated = exists
          ? f.includedChatIds.filter((id) => id !== chatId)
          : [...f.includedChatIds, chatId];
        return { ...f, includedChatIds: updated };
      }
      return f;
    });

    set({
      customFolders: custom,
      chatFolders: [DEFAULT_SYSTEM_FOLDER, ...custom],
    });

    try {
      await apiClient.post(`api/Folders/${folderId}/toggle-chat/${chatId}`);
    } catch {
      localStorage.setItem('user_chat_folders', JSON.stringify(custom));
    }
  },

  createFolder: async (name, icon, color, chatIds = []) => {
    const newFolder: IChatFolder = {
      id: Date.now(),
      name,
      icon,
      color,
      isSystem: false,
      order: get().chatFolders.length,
      includedChatIds: chatIds,
    };

    try {
      const res = await apiClient.post<IChatFolder>('api/Folders/create', newFolder);
      if (res.data) newFolder.id = res.data.id;
    } catch {
      // Offline fallback
    }

    const custom = [...get().customFolders, newFolder];
    set({
      customFolders: custom,
      chatFolders: [DEFAULT_SYSTEM_FOLDER, ...custom],
    });
    localStorage.setItem('user_chat_folders', JSON.stringify(custom));
  },

  updateFolder: async (folder) => {
    const custom = get().customFolders.map((f) => (f.id === folder.id ? folder : f));
    set({
      customFolders: custom,
      chatFolders: [DEFAULT_SYSTEM_FOLDER, ...custom],
    });

    try {
      await apiClient.put(`api/Folders/${folder.id}`, folder);
    } catch {
      localStorage.setItem('user_chat_folders', JSON.stringify(custom));
    }
  },

  deleteFolder: async (folderId) => {
    const custom = get().customFolders.filter((f) => f.id !== folderId);
    set({
      customFolders: custom,
      chatFolders: [DEFAULT_SYSTEM_FOLDER, ...custom],
      selectedFolderId: get().selectedFolderId === folderId ? 0 : get().selectedFolderId,
    });

    try {
      await apiClient.delete(`api/Folders/${folderId}`);
    } catch {
      localStorage.setItem('user_chat_folders', JSON.stringify(custom));
    }
  },

  openEditDialog: (folder) => set({ isEditFolderDialogOpen: true, editingFolder: folder }),
  closeEditDialog: () => set({ isEditFolderDialogOpen: false, editingFolder: null }),
}));