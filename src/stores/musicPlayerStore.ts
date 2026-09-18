// src/stores/musicPlayerStore.ts
import { create } from 'zustand';
import { IAudioTrackModel } from '../types/models';
import { eventBus } from '../services/eventBus';

interface MusicPlayerState {
  isOpen: boolean;
  isPlaying: boolean;
  isShuffle: boolean;
  isRepeat: boolean;
  volume: number;
  currentTrack: IAudioTrackModel | null;
  playlist: IAudioTrackModel[];
  currentTimeStr: string;
  totalTimeStr: string;
  progressPercent: number;

  // Actions
  loadPlaylistAndPlay: (tracks: IAudioTrackModel[], selectedTrack: IAudioTrackModel) => void;
  playTrack: (track: IAudioTrackModel) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  seek: (percent: number) => void;
  setVolume: (volume: number) => void;
  closePlayer: () => void;
  goToSourceChat: () => void;
}

let audioInstance: HTMLAudioElement | null = null;

export const useMusicPlayerStore = create<MusicPlayerState>((set, get) => ({
  isOpen: false,
  isPlaying: false,
  isShuffle: false,
  isRepeat: false,
  volume: 75,
  currentTrack: null,
  playlist: [],
  currentTimeStr: '00:00',
  totalTimeStr: '00:00',
  progressPercent: 0,

  loadPlaylistAndPlay: (tracks, selectedTrack) => {
    set({ playlist: tracks, isOpen: true });
    get().playTrack(selectedTrack);
  },

  playTrack: (track) => {
    if (!audioInstance) {
      audioInstance = new Audio();
      setupAudioListeners(set, get);
    }

    audioInstance.src = track.attachment.url;
    audioInstance.volume = get().volume / 100;
    audioInstance.play().catch(() => {});

    set({ currentTrack: track, isPlaying: true });
  },

  togglePlay: () => {
    const { isPlaying, currentTrack, playlist } = get();
    if (!currentTrack && playlist.length > 0) {
      get().playTrack(playlist[0]);
      return;
    }

    if (audioInstance) {
      if (isPlaying) {
        audioInstance.pause();
        set({ isPlaying: false });
      } else {
        audioInstance.play().catch(() => {});
        set({ isPlaying: true });
      }
    }
  },

  nextTrack: () => {
    const { playlist, currentTrack, isShuffle, isRepeat } = get();
    if (playlist.length === 0 || !currentTrack) return;

    if (isShuffle) {
      const remaining = playlist.filter((t) => t !== currentTrack);
      if (remaining.length > 0) {
        const next = remaining[Math.floor(Math.random() * remaining.length)];
        get().playTrack(next);
        return;
      }
    }

    const idx = playlist.indexOf(currentTrack);
    if (idx >= 0 && idx < playlist.length - 1) {
      get().playTrack(playlist[idx + 1]);
    } else if (isRepeat) {
      get().playTrack(playlist[0]);
    }
  },

  previousTrack: () => {
    const { playlist, currentTrack, isRepeat } = get();
    if (playlist.length === 0 || !currentTrack) return;

    const idx = playlist.indexOf(currentTrack);
    if (idx > 0) {
      get().playTrack(playlist[idx - 1]);
    } else if (isRepeat) {
      get().playTrack(playlist[playlist.length - 1]);
    }
  },

  toggleShuffle: () => set((s) => ({ isShuffle: !s.isShuffle })),
  toggleRepeat: () => set((s) => ({ isRepeat: !s.isRepeat })),

  seek: (percent) => {
    if (audioInstance && audioInstance.duration) {
      audioInstance.currentTime = (percent / 100) * audioInstance.duration;
    }
  },

  setVolume: (val) => {
    const clamped = Math.max(0, Math.min(100, val));
    if (audioInstance) audioInstance.volume = clamped / 100;
    set({ volume: clamped });
  },

  closePlayer: () => {
    if (audioInstance) {
      audioInstance.pause();
      audioInstance = null;
    }
    set({ isOpen: false, isPlaying: false, currentTrack: null });
  },

  goToSourceChat: () => {
    const { currentTrack } = get();
    if (currentTrack) {
      eventBus.emit('ScrollToMessageRequestMessage' as any, { messageId: currentTrack.messageId });
    }
  },
}));

function setupAudioListeners(set: any, get: any) {
  if (!audioInstance) return;

  audioInstance.ontimeupdate = () => {
    if (!audioInstance || !audioInstance.duration) return;
    const cur = audioInstance.currentTime;
    const dur = audioInstance.duration;

    const format = (s: number) => {
      const m = Math.floor(s / 60).toString().padStart(2, '0');
      const sec = Math.floor(s % 60).toString().padStart(2, '0');
      return `${m}:${sec}`;
    };

    set({
      currentTimeStr: format(cur),
      totalTimeStr: format(dur),
      progressPercent: (cur / dur) * 100,
    });
  };

  audioInstance.onended = () => {
    get().nextTrack();
  };
}

eventBus.on('PlayPlaylistMessage' as any, ({ tracks, selectedTrack }: any) => {
  useMusicPlayerStore.getState().loadPlaylistAndPlay(tracks, selectedTrack);
});