import { create } from 'zustand';
import { EmojiService } from '../services/emoji.service';
import { gifService, getCanonicalGifFilename } from '../services/gif.service';
import { eventBus } from '../services/eventBus';
import { ISavedGif } from '../types/models';
import { UrlHelper } from '../utils/helpers';
import { BASE_SERVER_URL } from '../services/apiClient';

interface EmojiState {
  isEmojiPickerOpen: boolean;
  selectedMainTab: 'Emoji' | 'GIF';
  selectedCategory: string;
  currentEmojiList: string[];
  savedGifs: ISavedGif[];
  isGifsLoading: boolean;

  togglePicker: () => void;
  openPicker: () => void;
  closePicker: () => void;
  selectMainTab: (tab: 'Emoji' | 'GIF') => void;
  switchEmojiCategory: (category: string) => void;
  addEmoji: (emoji: string) => void;
  pickGif: (gif: ISavedGif) => void;
  loadSavedGifs: () => Promise<void>;
  addSavedGifLocally: (gif: ISavedGif) => void;
}

export const useEmojiStore = create<EmojiState>((set, get) => ({
  isEmojiPickerOpen: false,
  selectedMainTab: 'Emoji',
  selectedCategory: 'Smileys',
  currentEmojiList: EmojiService.getCategories()['Smileys'] || [],
  savedGifs: [],
  isGifsLoading: false,

  togglePicker: () => {
    const nextState = !get().isEmojiPickerOpen;
    set({ isEmojiPickerOpen: nextState });
    if (nextState && get().selectedMainTab === 'GIF') {
      void get().loadSavedGifs();
    }
  },

  openPicker: () => {
    set({ isEmojiPickerOpen: true });
    if (get().selectedMainTab === 'GIF') {
      void get().loadSavedGifs();
    }
  },

  closePicker: () => set({ isEmojiPickerOpen: false }),

  selectMainTab: (tab) => {
    if (get().selectedMainTab === tab) return;
    set({ selectedMainTab: tab });
    if (tab === 'GIF') {
      void get().loadSavedGifs();
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
    try {
      set({ isGifsLoading: get().savedGifs.length === 0 });

      // 1. Мгновенное чтение дедуплицированного списка из локальной БД
      const localGifs = await gifService.getSavedGifsAsync();
      if (localGifs.length > 0) {
        set({ savedGifs: localGifs, isGifsLoading: false });
      }

      // 2. Фоновая синхронизация с сервером
      const syncedGifs = await gifService.syncGifsWithServerAsync();
      set({ savedGifs: syncedGifs, isGifsLoading: false });
    } catch (e) {
      console.error('[EmojiStore] Ошибка загрузки сохраненных GIF:', e);
      set({ isGifsLoading: false });
    }
  },

  addSavedGifLocally: (gif: ISavedGif) => {
    if (!gif.url || gif.url.startsWith('blob:')) return;
    const normUrl = UrlHelper.normalize(gif.url, BASE_SERVER_URL);
    const targetFname = getCanonicalGifFilename(normUrl);

    set((state) => {
      const exists = state.savedGifs.some((g) => {
        const gNorm = UrlHelper.normalize(g.url, BASE_SERVER_URL);
        return gNorm === normUrl || (targetFname && getCanonicalGifFilename(gNorm) === targetFname);
      });

      if (exists) return state;

      return {
        savedGifs: [{ ...gif, url: normUrl }, ...state.savedGifs],
      };
    });
  },
}));

setTimeout(() => {
  void useEmojiStore.getState().loadSavedGifs();
}, 500);