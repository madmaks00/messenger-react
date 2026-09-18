// src/stores/emojiStore.ts
import { create } from 'zustand';
import { EmojiService } from '../services/emoji.service';
import { eventBus } from '../services/eventBus';
import { ISavedGif } from '../types/models';
import { apiClient } from '../services/apiClient';

interface EmojiState {
  isEmojiPickerOpen: boolean;
  selectedMainTab: 'Emoji' | 'GIF';
  selectedCategory: string;
  currentEmojiList: string[];
  savedGifs: ISavedGif[];
  isGifsLoading: boolean;

  // Actions
  togglePicker: () => void;
  openPicker: () => void;
  closePicker: () => void;
  selectMainTab: (tab: 'Emoji' | 'GIF') => void;
  switchEmojiCategory: (category: string) => void;
  addEmoji: (emoji: string) => void;
  pickGif: (gif: ISavedGif) => void;
  loadSavedGifs: () => Promise<void>;
}

export const useEmojiStore = create<EmojiState>((set, get) => ({
  isEmojiPickerOpen: false,
  selectedMainTab: 'Emoji',
  selectedCategory: 'Smileys',
  currentEmojiList: EmojiService.getCategories()['Smileys'] || [],
  savedGifs: [],
  isGifsLoading: false,

  togglePicker: () => set((state) => ({ isEmojiPickerOpen: !state.isEmojiPickerOpen })),
  openPicker: () => set({ isEmojiPickerOpen: true }),
  closePicker: () => set({ isEmojiPickerOpen: false }),

  selectMainTab: (tab) => {
    set({ selectedMainTab: tab });
    if (tab === 'GIF') {
      get().loadSavedGifs();
    }
  },

  switchEmojiCategory: (category) => {
    const categories = EmojiService.getCategories();
    if (categories[category]) {
      set({
        selectedCategory: category,
        currentEmojiList: categories[category],
      });
    }
  },

  addEmoji: (emoji) => {
    if (!emoji) return;
    EmojiService.addToRecent(emoji);
    eventBus.emit('EmojiPickedMessage' as any, { emoji });
    if (get().selectedCategory === 'Recent') {
      set({ currentEmojiList: EmojiService.getRecent() });
    }
  },

  pickGif: (gif) => {
    if (!gif) return;
    set({ isEmojiPickerOpen: false });
    eventBus.emit('GifPickedMessage' as any, { gif });
  },

  loadSavedGifs: async () => {
    set({ isGifsLoading: true });
    try {
      const res = await apiClient.get<ISavedGif[]>('api/Gifs/saved');
      set({ savedGifs: res.data || [], isGifsLoading: false });
    } catch {
      set({ isGifsLoading: false });
    }
  },
}));