import { create } from 'zustand';
import { IChatFolder, IChatListItem } from '../types/models';
import { ChatFolderCreateDto, ChatFolderOrderDto } from '../types/dtos';
import { chatFolderService } from '../services/chatFolderService';
import { useSidebarChatsStore } from './sidebarChatsStore';

export const AVAILABLE_FOLDER_ICONS: string[] = [
  'FolderOutline', 'BriefcaseOutline', 'StarOutline', 'HeartOutline', 'SchoolOutline',
  'GamepadVariantOutline', 'MusicNoteOutline', 'MessageOutline', 'BellOutline', 'AccountGroupOutline',
  'RobotOutline', 'Airplane', 'Basketball', 'PaletteOutline', 'CodeBraces', 'Bitcoin',
  'HomeOutline', 'CartOutline', 'MapMarkerOutline', 'CloudOutline', 'ShieldOutline',
  'BankOutline', 'Headphones', 'WalletOutline', 'KeyOutline', 'Paw', 'Earth', 'FormatListBulleted'
];

export const AVAILABLE_FOLDER_COLORS: string[] = [
  '#FFB3B3', '#FBD38D', '#FAF089', '#9AE6B4', '#90CDF4', '#D6BCFA', '#FBB6CE',
  '#FF6B6B', '#FFB84D', '#FDE047', '#6EE7B7', '#60A5FA', '#C4B5FD', '#F472B6',
  '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#8B5CF6', '#FF2D55',
  '#C53030', '#DD6B20', '#D69E2E', '#276749', '#2B6CB0', '#6B46C1', '#B83280'
];

const DEFAULT_SYSTEM_ALL_FOLDER: IChatFolder = {
  id: 0,
  name: 'All',
  icon: 'FolderOutline',
  color: '#FFFFFF',
  isSystem: true,
  orderIndex: 0,
  isSelected: true,
  isDragging: false,
};

interface ChatFolderState {
  chatFolders: IChatFolder[];
  customFolders: IChatFolder[];
  selectedFolderId: number;
  isCreateFolderDialogOpen: boolean;
  newFolderName: string;
  selectedFolderColor: string;
  selectedFolderIcon: string;
  folderDialogTitle: string;
  folderDialogConfirmButtonText: string;
  editingFolderId: number | null;

  // Actions
  loadFoldersAsync: () => Promise<void>;
  selectFolder: (folderOrId: IChatFolder | number) => void;
  saveFoldersOrderAsync: () => Promise<void>;
  reorderFoldersLive: (fromIndex: number, toIndex: number) => void;
  openCreateFolderDialog: () => void;
  openEditFolderDialog: (folder: IChatFolder) => void;
  cancelCreateFolder: () => void;
  confirmCreateFolder: () => Promise<void>;
  confirmRemoveFolder: (folder: IChatFolder) => Promise<void>;
  toggleChatInFolder: (folderId: number, chat: IChatListItem) => Promise<void>;
  setNewFolderName: (name: string) => void;
  setSelectedFolderColor: (color: string) => void;
  setSelectedFolderIcon: (icon: string) => void;
}

export const useChatFolderStore = create<ChatFolderState>((set, get) => ({
  chatFolders: [DEFAULT_SYSTEM_ALL_FOLDER],
  customFolders: [],
  selectedFolderId: 0,
  isCreateFolderDialogOpen: false,
  newFolderName: '',
  selectedFolderColor: '#FF3B30',
  selectedFolderIcon: 'FolderOutline',
  folderDialogTitle: 'Create Folder',
  folderDialogConfirmButtonText: 'Create',
  editingFolderId: null,

  setNewFolderName: (name) => set({ newFolderName: name }),
  setSelectedFolderColor: (color) => set({ selectedFolderColor: color }),
  setSelectedFolderIcon: (icon) => set({ selectedFolderIcon: icon }),

  loadFoldersAsync: async () => {
    try {
      const folders = await chatFolderService.getFoldersAsync();

      if (folders && folders.length > 0) {
        const sortedFolders = [...folders].sort((a, b) => a.orderIndex - b.orderIndex);
        const custom = sortedFolders.filter((f) => !f.isSystem);

        set({
          chatFolders: sortedFolders,
          customFolders: custom,
        });

        const firstFolder = sortedFolders[0];
        if (firstFolder) {
          get().selectFolder(firstFolder);
        }
      } else {
        set({
          chatFolders: [DEFAULT_SYSTEM_ALL_FOLDER],
          customFolders: [],
          selectedFolderId: 0,
        });
        get().selectFolder(DEFAULT_SYSTEM_ALL_FOLDER);
      }
    } catch (error) {
      console.error('[ChatFolderVM ERROR] Ошибка при загрузке папок чатов:', error);
    }
  },

  selectFolder: (folderOrId) => {
    const id = typeof folderOrId === 'number' ? folderOrId : folderOrId.id;
    const { chatFolders } = get();

    const targetFolder = chatFolders.find((f) => f.id === id) || DEFAULT_SYSTEM_ALL_FOLDER;

    const updatedFolders = chatFolders.map((f) => ({
      ...f,
      isSelected: f.id === id,
    }));

    const updatedCustom = get().customFolders.map((f) => ({
      ...f,
      isSelected: f.id === id,
    }));

    set({
      chatFolders: updatedFolders,
      customFolders: updatedCustom,
      selectedFolderId: id,
    });

    // Синхронизируем состояние с sidebarChatsStore
    useSidebarChatsStore.getState().selectFolder(targetFolder.isSystem ? null : id, targetFolder.isSystem);
  },

  reorderFoldersLive: (fromIndex, toIndex) => {
    const folders = [...get().chatFolders];
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= folders.length || toIndex >= folders.length) return;

    const [moved] = folders.splice(fromIndex, 1);
    folders.splice(toIndex, 0, moved);

    folders.forEach((f, idx) => {
      f.orderIndex = idx;
    });

    const custom = folders.filter((f) => !f.isSystem);
    set({ chatFolders: folders, customFolders: custom });
  },

  saveFoldersOrderAsync: async () => {
    const { chatFolders } = get();
    if (!chatFolders || chatFolders.length === 0) return;

    try {
      const newOrderPayload: ChatFolderOrderDto[] = chatFolders.map((f, index) => ({
        folderId: f.id,
        orderIndex: index,
      }));

      await chatFolderService.saveFoldersOrderAsync(newOrderPayload);
    } catch (error) {
      console.error('[ChatFolderVM ERROR] Ошибка сохранения порядка папок:', error);
    }
  },

  openCreateFolderDialog: () => {
    set({
      folderDialogTitle: 'Create Folder',
      folderDialogConfirmButtonText: 'Create',
      editingFolderId: null,
      newFolderName: '',
      selectedFolderColor: AVAILABLE_FOLDER_COLORS[0] || '#FF3B30',
      selectedFolderIcon: AVAILABLE_FOLDER_ICONS[0] || 'FolderOutline',
      isCreateFolderDialogOpen: true,
    });
  },

  openEditFolderDialog: (folder) => {
    if (!folder || folder.isSystem) return;

    const targetColor = folder.color || '#FF3B30';
    const matchedColor =
      AVAILABLE_FOLDER_COLORS.find((c) => c.toLowerCase() === targetColor.toLowerCase()) ||
      AVAILABLE_FOLDER_COLORS[0];

    const targetIcon = folder.icon || 'FolderOutline';
    const matchedIcon =
      AVAILABLE_FOLDER_ICONS.find((i) => i.toLowerCase() === targetIcon.toLowerCase()) ||
      AVAILABLE_FOLDER_ICONS[0];

    set({
      editingFolderId: folder.id,
      folderDialogTitle: 'Edit Folder',
      folderDialogConfirmButtonText: 'Save',
      newFolderName: folder.name,
      selectedFolderColor: matchedColor,
      selectedFolderIcon: matchedIcon,
      isCreateFolderDialogOpen: true,
    });
  },

  cancelCreateFolder: () => {
    set({
      isCreateFolderDialogOpen: false,
      editingFolderId: null,
      newFolderName: '',
    });
  },

  confirmCreateFolder: async () => {
    const {
      newFolderName,
      selectedFolderColor,
      selectedFolderIcon,
      editingFolderId,
      chatFolders,
      customFolders,
    } = get();

    if (!newFolderName.trim()) return;

    const dto: ChatFolderCreateDto = {
      name: newFolderName.trim(),
      color: selectedFolderColor,
      icon: selectedFolderIcon,
    };

    if (editingFolderId !== null) {
      try {
        const updated = await chatFolderService.updateFolderAsync(editingFolderId, dto);
        if (updated) {
          const newChatFolders = chatFolders.map((f) =>
            f.id === editingFolderId
              ? { ...f, name: updated.name, color: updated.color, icon: updated.icon }
              : f
          );
          const newCustomFolders = customFolders.map((f) =>
            f.id === editingFolderId
              ? { ...f, name: updated.name, color: updated.color, icon: updated.icon }
              : f
          );

          set({
            chatFolders: newChatFolders,
            customFolders: newCustomFolders,
            isCreateFolderDialogOpen: false,
            editingFolderId: null,
          });

          const currentSelected = newChatFolders.find((f) => f.isSelected);
          if (currentSelected) {
            get().selectFolder(currentSelected);
          }
        }
      } catch (error) {
        console.error(`[ChatFolderVM ERROR] Ошибка редактирования папки FolderId: ${editingFolderId}`, error);
      }
      return;
    }

    try {
      const created = await chatFolderService.createFolderAsync(dto);
      if (created) {
        const newChatFolders = [...chatFolders, created];
        const newCustomFolders = [...customFolders, created];

        set({
          chatFolders: newChatFolders,
          customFolders: newCustomFolders,
          isCreateFolderDialogOpen: false,
        });

        get().selectFolder(created);
      }
    } catch (error) {
      console.error('[ChatFolderVM ERROR] Ошибка создания папки чатов:', error);
    }
  },

  confirmRemoveFolder: async (folder) => {
    if (!folder || folder.isSystem) return;

    try {
      const success = await chatFolderService.deleteFolderAsync(folder.id);
      if (success) {
        const { chatFolders, customFolders } = get();
        const wasSelected = folder.isSelected;

        const newChatFolders = chatFolders.filter((f) => f.id !== folder.id);
        const newCustomFolders = customFolders.filter((f) => f.id !== folder.id);

        set({
          chatFolders: newChatFolders,
          customFolders: newCustomFolders,
        });

        if (wasSelected) {
          const allFolder =
            newChatFolders.find((f) => f.isSystem && f.name === 'All') || newChatFolders[0];
          if (allFolder) {
            get().selectFolder(allFolder);
          }
        }
      }
    } catch (error) {
      console.error(`[ChatFolderVM ERROR] Ошибка удаления папки FolderId: ${folder.id}`, error);
    }
  },

  toggleChatInFolder: async (folderId, chat) => {
    if (!chat || folderId <= 0) return;

    const targetUserId = chat.isGroup ? null : chat.userId;
    const targetGroupId = chat.isGroup ? chat.groupId : null;

    try {
      const isAdded = await chatFolderService.toggleChatInFolderAsync(
        folderId,
        targetUserId,
        targetGroupId
      );

      if (isAdded !== null) {
        // Обновляем коллекцию folderIds у самого чата в sidebarChatsStore
        const chatId = chat.isGroup ? (chat.groupId ?? chat.id) : (chat.userId ?? chat.id);
        useSidebarChatsStore.getState().updateChatFolderIds(
          Number(chatId),
          Boolean(chat.isGroup),
          folderId,
          isAdded
        );
      }
    } catch (error) {
      console.error(`[ChatFolderVM ERROR] Ошибка переключения чата в папке FolderId: ${folderId}`, error);
    }
  },
}));