import { create } from 'zustand';
import { eventBus } from '../services/eventBus';
import { mediaCacheService } from '../services/mediaCache.service';
import { BASE_SERVER_URL } from '../services/apiClient';
import { UrlHelper } from '../utils/helpers';

interface VideoViewerState {
  isOpen: boolean;
  videoUrl: string;
  isPlaying: boolean;
  isBuffering: boolean;
  isFullscreen: boolean;
  areControlsVisible: boolean;

  positionSeconds: number;
  durationSeconds: number;
  currentTimeStr: string;
  remainingTimeStr: string;

  volume: number;
  isMuted: boolean;
  playbackSpeed: number;
  rotationAngle: number;

  open: (videoUrl: string, initialDuration?: number) => void;
  close: () => void;
  togglePlay: () => void;
  toggleFullscreen: () => void;
  toggleMute: () => void;
  setVolume: (value: number) => void;
  setSpeed: (speed: number) => void;
  rotate: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  seekTo: (seconds: number) => void;
  startSliderDrag: () => void;
  endSliderDrag: (finalPosition: number) => void;
  updatePlaybackInfo: (currentPos: number, duration?: number) => void;
  onMediaEnded: () => void;
  onUserInteraction: () => void;
  downloadVideo: () => Promise<void>;
  setIsBuffering: (isBuffering: boolean) => void;
}

const formatDuration = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds <= 0) return '00:00';
  const sec = Math.floor(totalSeconds);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
};

let autoHideTimer: NodeJS.Timeout | null = null;
let previousVolume = 1.0;
let isDraggingSliderInternal = false;

export const useVideoViewerStore = create<VideoViewerState>((set, get) => {
  const resetAutoHideTimer = () => {
    if (autoHideTimer) clearTimeout(autoHideTimer);
    if (get().isPlaying && !isDraggingSliderInternal) {
      autoHideTimer = setTimeout(() => {
        if (get().isPlaying && !isDraggingSliderInternal) {
          set({ areControlsVisible: false });
        }
      }, 2500);
    }
  };

  const calculateTimeStrings = (pos: number, dur: number) => {
    const curStr = formatDuration(pos);
    const rem = dur > pos ? dur - pos : 0;
    const remStr = `-${formatDuration(rem)}`;
    return { currentTimeStr: curStr, remainingTimeStr: remStr };
  };

  return {
    isOpen: false,
    videoUrl: '',
    isPlaying: false,
    isBuffering: false,
    isFullscreen: false,
    areControlsVisible: true,

    positionSeconds: 0,
    durationSeconds: 0,
    currentTimeStr: '00:00',
    remainingTimeStr: '-00:00',

    volume: 1.0,
    isMuted: false,
    playbackSpeed: 1.0,
    rotationAngle: 0,

    open: (videoUrl: string, initialDuration?: number) => {
      if (!videoUrl || videoUrl.trim().length === 0) return;

      const dur = initialDuration && initialDuration > 0 ? initialDuration : 0;

      set({
        videoUrl,
        isOpen: true,
        isPlaying: true,
        isBuffering: true,
        areControlsVisible: true,
        positionSeconds: 0,
        durationSeconds: dur,
        currentTimeStr: '00:00',
        remainingTimeStr: dur > 0 ? `-${formatDuration(dur)}` : '-00:00',
        rotationAngle: 0,
        isFullscreen: false,
      });

      resetAutoHideTimer();
    },

    close: () => {
      if (autoHideTimer) clearTimeout(autoHideTimer);
      if (get().isFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      set({
        isOpen: false,
        isPlaying: false,
        isFullscreen: false,
        rotationAngle: 0,
        videoUrl: '',
      });
    },

    togglePlay: () => {
      const { isPlaying } = get();
      if (isPlaying) {
        if (autoHideTimer) clearTimeout(autoHideTimer);
        set({ isPlaying: false, areControlsVisible: true });
      } else {
        set({ isPlaying: true });
        resetAutoHideTimer();
      }
    },

    toggleFullscreen: () => {
      const next = !get().isFullscreen;
      set({ isFullscreen: next });
      resetAutoHideTimer();
    },

    toggleMute: () => {
      const { isMuted, volume } = get();
      if (isMuted) {
        const restored = previousVolume > 0 ? previousVolume : 0.5;
        set({ isMuted: false, volume: restored });
      } else {
        previousVolume = volume > 0 ? volume : 0.5;
        set({ isMuted: true, volume: 0 });
      }
    },

    setVolume: (value: number) => {
      const clamped = Math.max(0, Math.min(1, value));
      set({
        volume: clamped,
        isMuted: clamped <= 0.001,
      });
    },

    setSpeed: (speed: number) => {
      set({ playbackSpeed: speed });
      resetAutoHideTimer();
    },

    rotate: () => {
      set((state) => ({ rotationAngle: state.rotationAngle + 90 }));
      resetAutoHideTimer();
    },

    stepForward: () => {
      const { positionSeconds, durationSeconds } = get();
      const newPos = Math.max(0, Math.min(durationSeconds, positionSeconds + 5));
      const times = calculateTimeStrings(newPos, durationSeconds);
      set({ positionSeconds: newPos, ...times });
      resetAutoHideTimer();
    },

    stepBackward: () => {
      const { positionSeconds, durationSeconds } = get();
      const newPos = Math.max(0, Math.min(durationSeconds, positionSeconds - 5));
      const times = calculateTimeStrings(newPos, durationSeconds);
      set({ positionSeconds: newPos, ...times });
      resetAutoHideTimer();
    },

    seekTo: (seconds: number) => {
      const { durationSeconds } = get();
      const clamped = Math.max(0, Math.min(durationSeconds, seconds));
      const times = calculateTimeStrings(clamped, durationSeconds);
      set({ positionSeconds: clamped, ...times });
      resetAutoHideTimer();
    },

    startSliderDrag: () => {
      isDraggingSliderInternal = true;
      if (autoHideTimer) clearTimeout(autoHideTimer);
    },

    endSliderDrag: (finalPosition: number) => {
      isDraggingSliderInternal = false;
      const { durationSeconds } = get();
      const clamped = Math.max(0, Math.min(durationSeconds, finalPosition));
      const times = calculateTimeStrings(clamped, durationSeconds);
      set({ positionSeconds: clamped, ...times });
      resetAutoHideTimer();
    },

    // 🟢 ФИКС 4: Защита от сброса длительности в 0/NaN во время тиканья видео
    updatePlaybackInfo: (currentPos: number, duration?: number) => {
      const curDur = get().durationSeconds;
      const validDuration =
        duration && isFinite(duration) && !isNaN(duration) && duration > 0
          ? duration
          : curDur > 0
          ? curDur
          : 0;

      if (!isDraggingSliderInternal) {
        const times = calculateTimeStrings(currentPos, validDuration);
        set({
          durationSeconds: validDuration,
          positionSeconds: currentPos,
          ...times,
        });
      } else if (validDuration > 0) {
        set({ durationSeconds: validDuration });
      }
    },

    onMediaEnded: () => {
      if (autoHideTimer) clearTimeout(autoHideTimer);
      const { durationSeconds } = get();
      const times = calculateTimeStrings(durationSeconds, durationSeconds);
      set({
        isPlaying: false,
        positionSeconds: durationSeconds,
        areControlsVisible: true,
        ...times,
      });
    },

    onUserInteraction: () => {
      set({ areControlsVisible: true });
      resetAutoHideTimer();
    },

    downloadVideo: async () => {
      const { videoUrl } = get();
      if (!videoUrl) return;

      try {
        const resolvedUrl = videoUrl.startsWith('blob:')
          ? videoUrl
          : UrlHelper.normalize(videoUrl, BASE_SERVER_URL);

        let finalDownloadUrl = resolvedUrl;

        if (!resolvedUrl.startsWith('blob:')) {
          const cached = await mediaCacheService.getCachedMediaUrl(resolvedUrl);
          if (cached) finalDownloadUrl = cached;
        }

        const link = document.createElement('a');
        link.href = finalDownloadUrl;

        let name = resolvedUrl.split('/').pop()?.split('?')[0] || '';
        if (!name || !name.includes('.')) {
          const nowStr = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
          name = `video_${nowStr}.mp4`;
        }

        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error('[VideoViewer] Ошибка скачивания видео:', err);
      }
    },

    setIsBuffering: (isBuffering: boolean) => set({ isBuffering }),
  };
});

eventBus.on('OpenVideoViewerRequestMessage' as any, (payload: any) => {
  const { videoUrl, durationSeconds } = payload || {};
  useVideoViewerStore.getState().open(videoUrl, durationSeconds);
});