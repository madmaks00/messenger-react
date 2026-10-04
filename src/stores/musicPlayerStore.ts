import { create } from 'zustand';
import { IAudioTrackModel, PlayPlaylistMessage } from '../types/audio.types';
import { audioPlayerService } from '../services/audioPlayer.service';
import { BASE_SERVER_URL } from '../services/apiClient';
import { AudioMetadataHelper } from '../types/audio.types';
import { AudioConverterHelper } from '../utils/audioConverters';
import { eventBus } from '../services/eventBus';
import { useChatStore } from './chatStore';
import { useSidebarChatsStore } from './sidebarChatsStore';
import { AttachmentType } from '../types/enums';

export type RepeatMode = 'off' | 'one' | 'all';

function getStoredVolume(): number {
  try {
    const saved = localStorage.getItem('player_volume');
    if (saved !== null) {
      const val = parseFloat(saved);
      if (!isNaN(val) && val >= 0 && val <= 100) return val;
    }
  } catch {}
  return 100;
}

interface MusicPlayerState {
  isOpen: boolean;
  isPlaying: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  isRepeat: boolean;
  volume: number;
  currentTrack: IAudioTrackModel | null;
  playlist: IAudioTrackModel[];

  currentTimeStr: string;
  totalTimeStr: string;
  progressPercent: number;
  playerHeight: number;

  totalDurationSeconds: () => number;

  loadPlaylistAndPlay: (tracks: IAudioTrackModel[], selectedTrack: IAudioTrackModel) => void;
  playTrack: (track: IAudioTrackModel | null) => void;
  togglePlay: () => void;
  nextTrack: (manual?: boolean) => void;
  previousTrack: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  closePlayer: () => void;
  goToSourceChat: () => void;
  seek: (percent: number) => void;
  setVolume: (volume: number) => void;
  setPlayerHeight: (height: number) => void;
  updateTimes: () => void;
  addTrackIfMatchesChat: (newTrack: IAudioTrackModel) => void;
}

let progressTimer: ReturnType<typeof setInterval> | null = null;

export const useMusicPlayerStore = create<MusicPlayerState>((set, get) => {
  const startTimer = () => {
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = setInterval(() => {
      const isPlaying = audioPlayerService.isPlaying;
      const currentTrack = get().currentTrack;
      if (currentTrack) {
        currentTrack.isPlaying = isPlaying;
      }
      get().updateTimes();
    }, 200);
  };

  const stopTimer = () => {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  };

  audioPlayerService.subscribe(() => {
    const isPlaying = audioPlayerService.isPlaying;
    const curAtt = audioPlayerService.currentAttachment;

    if (curAtt && curAtt.type === AttachmentType.Voice) {
      return;
    }

    set((state) => ({
      isPlaying,
      currentTrack: state.currentTrack ? { ...state.currentTrack, isPlaying } : null,
    }));
  });

  const initialVolume = getStoredVolume();

  return {
    isOpen: false,
    isPlaying: false,
    isShuffle: false,
    repeatMode: 'off',
    isRepeat: false,
    volume: initialVolume,
    currentTrack: null,
    playlist: [],
    currentTimeStr: '00:00',
    totalTimeStr: '00:00',
    progressPercent: 0,
    playerHeight: 54,

    totalDurationSeconds: () => audioPlayerService.durationSeconds,

    setPlayerHeight: (height: number) => set({ playerHeight: height }),

    addTrackIfMatchesChat: (newTrack: IAudioTrackModel) => {
      const { isOpen, currentTrack, playlist } = get();
      if (!isOpen || !currentTrack) return;

      if (Number(newTrack.chatId) !== Number(currentTrack.chatId)) return;

      const alreadyExists = playlist.some(
        (t) =>
          AudioConverterHelper.isSameAttachment(t.attachment, newTrack.attachment) ||
          (Boolean(t.attachment.url) && t.attachment.url === newTrack.attachment.url)
      );

      if (!alreadyExists) {
        set({ playlist: [...playlist, newTrack] });
      }
    },

    loadPlaylistAndPlay: (tracks: IAudioTrackModel[], selectedTrack: IAudioTrackModel) => {
      const validTracks = tracks.filter((t) => t.attachment.type !== AttachmentType.Voice);
      if (validTracks.length === 0) return;

      const cloned = validTracks.map((t) => ({ ...t, isPlaying: false }));

      const found =
        cloned.find(
          (t) =>
            t === selectedTrack ||
            AudioConverterHelper.isSameAttachment(t.attachment, selectedTrack.attachment) ||
            (Boolean(t.attachment.url) && Boolean(selectedTrack.attachment.url) && t.attachment.url === selectedTrack.attachment.url) ||
            (Boolean(t.attachment.fileName) &&
              Boolean(selectedTrack.attachment.fileName) &&
              t.attachment.fileName === selectedTrack.attachment.fileName &&
              t.messageId === selectedTrack.messageId)
        ) ||
        selectedTrack ||
        cloned[0];

      set({
        playlist: cloned,
        isOpen: true,
      });

      get().playTrack(found);
    },

    playTrack: (track: IAudioTrackModel | null) => {
      if (!track || track.attachment.type === AttachmentType.Voice) return;

      const updatedPlaylist = get().playlist.map((t) => ({
        ...t,
        isPlaying:
          t === track ||
          AudioConverterHelper.isSameAttachment(t.attachment, track.attachment) ||
          (Boolean(t.attachment.url) && t.attachment.url === track.attachment.url),
      }));

      const activeTrack = { ...track, isPlaying: true };

      set({
        playlist: updatedPlaylist,
        currentTrack: activeTrack,
        isPlaying: true,
      });

      audioPlayerService.togglePlay(activeTrack.attachment, BASE_SERVER_URL);
      audioPlayerService.setVolume(get().volume);
      startTimer();
    },

    togglePlay: () => {
      const { currentTrack, playlist, volume } = get();

      if (!currentTrack && playlist.length > 0) {
        get().playTrack(playlist[0]);
        return;
      }

      if (currentTrack) {
        audioPlayerService.togglePlay(currentTrack.attachment, BASE_SERVER_URL);
        const engineIsPlaying = audioPlayerService.isPlaying;

        set({
          isPlaying: engineIsPlaying,
          currentTrack: { ...currentTrack, isPlaying: engineIsPlaying },
        });

        if (engineIsPlaying) {
          audioPlayerService.setVolume(volume);
          startTimer();
        } else {
          stopTimer();
        }
      }
    },

    nextTrack: (manual = false) => {
      const { playlist, currentTrack, isShuffle, repeatMode } = get();
      if (playlist.length === 0 || !currentTrack) return;

      if (repeatMode === 'one' && !manual) {
        audioPlayerService.seek(0);
        audioPlayerService.play();
        return;
      }

      if (isShuffle) {
        const others = playlist.filter(
          (x) => !AudioConverterHelper.isSameAttachment(x.attachment, currentTrack.attachment)
        );
        if (others.length > 0) {
          const randomIndex = Math.floor(Math.random() * others.length);
          get().playTrack(others[randomIndex]);
          return;
        }
      }

      const currentIndex = playlist.findIndex(
        (x) =>
          AudioConverterHelper.isSameAttachment(x.attachment, currentTrack.attachment) ||
          (Boolean(x.attachment.url) && x.attachment.url === currentTrack.attachment.url)
      );

      if (currentIndex >= 0 && currentIndex < playlist.length - 1) {
        get().playTrack(playlist[currentIndex + 1]);
      } else if (repeatMode === 'all' || manual) {
        get().playTrack(playlist[0]);
      } else {
        audioPlayerService.stop();
        set({ isPlaying: false });
      }
    },

    previousTrack: () => {
      const { playlist, currentTrack, isShuffle, repeatMode } = get();
      if (playlist.length === 0 || !currentTrack) return;

      if (audioPlayerService.positionSeconds > 3) {
        audioPlayerService.seek(0);
        return;
      }

      if (isShuffle) {
        const others = playlist.filter(
          (x) => !AudioConverterHelper.isSameAttachment(x.attachment, currentTrack.attachment)
        );
        if (others.length > 0) {
          const randomIndex = Math.floor(Math.random() * others.length);
          get().playTrack(others[randomIndex]);
          return;
        }
      }

      const currentIndex = playlist.findIndex(
        (x) =>
          AudioConverterHelper.isSameAttachment(x.attachment, currentTrack.attachment) ||
          (Boolean(x.attachment.url) && x.attachment.url === currentTrack.attachment.url)
      );

      if (currentIndex > 0) {
        get().playTrack(playlist[currentIndex - 1]);
      } else if (repeatMode === 'all' || playlist.length > 1) {
        get().playTrack(playlist[playlist.length - 1]);
      } else {
        audioPlayerService.seek(0);
      }
    },

    toggleShuffle: () => set((state) => ({ isShuffle: !state.isShuffle })),

    cycleRepeat: () =>
      set((state) => {
        let nextMode: RepeatMode = 'off';
        if (state.repeatMode === 'off') nextMode = 'one';
        else if (state.repeatMode === 'one') nextMode = 'all';
        else nextMode = 'off';

        return {
          repeatMode: nextMode,
          isRepeat: nextMode !== 'off',
        };
      }),

    closePlayer: () => {
      audioPlayerService.stop();
      stopTimer();
      set({ isOpen: false, isPlaying: false });
    },

    goToSourceChat: () => {
      const track = get().currentTrack;
      if (!track) return;

      const activeChat = useChatStore.getState().selectedChatUser;
      const isTargetChatOpen =
        activeChat &&
        (track.isGroup
          ? Boolean(activeChat.isGroup && Number(activeChat.id) === Number(track.chatId))
          : Boolean(!activeChat.isGroup && Number(activeChat.id) === Number(track.chatId)));

      const fireScroll = () => {
        if (track.messageId > 0) {
          eventBus.emit('ScrollToMessageRequestMessage' as any, { messageId: Number(track.messageId) });
        }
      };

      if (isTargetChatOpen) {
        fireScroll();
      } else if (track.chatId > 0) {
        const allChats = useSidebarChatsStore.getState().allChats;
        const targetChat = allChats.find((c) =>
          track.isGroup
            ? Boolean(c.isGroup && (c.groupId === track.chatId || c.id === track.chatId))
            : Boolean(!c.isGroup && Number(c.userId || c.id) === Number(track.chatId))
        );

        if (targetChat) {
          useSidebarChatsStore.getState().openChat(targetChat);
          setTimeout(fireScroll, 250);
        } else {
          eventBus.emit('OpenChatRequestMessage' as any, {
            userId: track.isGroup ? null : track.chatId,
            groupId: track.isGroup ? track.chatId : null,
          });
          setTimeout(fireScroll, 250);
        }
      }
    },

    seek: (percent: number) => {
      const dur = audioPlayerService.durationSeconds;
      if (dur > 0) {
        const targetSec = (percent / 100.0) * dur;
        audioPlayerService.seek(targetSec);
        get().updateTimes();
      }
    },

    setVolume: (vol: number) => {
      const clamped = Math.max(0, Math.min(100, vol));
      try {
        localStorage.setItem('player_volume', String(clamped));
      } catch {}
      set({ volume: clamped });
      audioPlayerService.setVolume(clamped);
    },

    updateTimes: () => {
      const pos = audioPlayerService.positionSeconds;
      const dur = audioPlayerService.durationSeconds;

      set({
        currentTimeStr: AudioMetadataHelper.formatDuration(pos),
        totalTimeStr: AudioMetadataHelper.formatDuration(dur),
        progressPercent: dur > 0 ? (pos / dur) * 100.0 : 0,
      });
    },
  };
});

eventBus.on('PlayPlaylistMessage' as any, ({ tracks, selectedTrack }: PlayPlaylistMessage) => {
  useMusicPlayerStore.getState().loadPlaylistAndPlay(tracks, selectedTrack);
});

eventBus.on('AudioPlaybackEnded' as any, ({ attachment }: any) => {
  const { currentTrack } = useMusicPlayerStore.getState();
  if (!currentTrack) return;

  if (attachment && AudioConverterHelper.isSameAttachment(attachment, currentTrack.attachment)) {
    useMusicPlayerStore.getState().nextTrack(false);
  }
});