import { IAttachment } from '../types/models';
import { AudioConverterHelper } from '../utils/audioConverters';
import { AudioMetadataHelper } from '../types/audio.types';
import { AttachmentType } from '../types/enums';
import { eventBus } from './eventBus';

export type AudioPlayerListener = () => void;

function getStoredVolume(): number {
  try {
    const saved = localStorage.getItem('player_volume');
    if (saved !== null) {
      const val = parseFloat(saved);
      if (!isNaN(val) && val >= 0 && val <= 100) return val / 100.0;
    }
  } catch {}
  return 1.0;
}

export class AudioPlayerService {
  private static instance: AudioPlayerService;
  private audio: HTMLAudioElement;

  private _currentAttachment: IAttachment | null = null;
  private _isPlaying: boolean = false;
  private _isDragging: boolean = false;
  private _positionSeconds: number = 0;
  private _durationSeconds: number = 0;
  private _timeString: string = '00:00';
  private _currentVolume: number = getStoredVolume();

  private listeners: Set<AudioPlayerListener> = new Set();

  private constructor() {
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.audio.volume = this._currentVolume;

    this.audio.addEventListener('timeupdate', this.onTimeUpdate);
    this.audio.addEventListener('loadedmetadata', this.onLoadedMetadata);
    this.audio.addEventListener('ended', this.onEnded);
    this.audio.addEventListener('pause', this.onPause);
    this.audio.addEventListener('play', this.onPlay);
    this.audio.addEventListener('error', this.onError);
  }

  public static getInstance(): AudioPlayerService {
    if (!AudioPlayerService.instance) {
      AudioPlayerService.instance = new AudioPlayerService();
    }
    return AudioPlayerService.instance;
  }

  public subscribe(cb: AudioPlayerListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    this.listeners.forEach((cb) => cb());
  }

  public get currentAttachment(): IAttachment | null {
    return this._currentAttachment;
  }

  public get isPlaying(): boolean {
    return this._isPlaying;
  }

  public get isDragging(): boolean {
    return this._isDragging;
  }

  public get positionSeconds(): number {
    return this._positionSeconds;
  }

  public get durationSeconds(): number {
    return this._durationSeconds;
  }

  public get timeString(): string {
    return this._timeString;
  }

  public get volume(): number {
    return this._currentVolume * 100.0;
  }

  public setVolume(volume0to100: number): void {
    const clamped = Math.max(0, Math.min(100, volume0to100));
    this._currentVolume = clamped / 100.0;
    this.audio.volume = this._currentVolume;
    try {
      localStorage.setItem('player_volume', String(clamped));
    } catch {}
    this.notify();
  }

  public togglePlay(attachment: IAttachment, serverBaseUrl: string = ''): void {
    if (!attachment) return;

    const targetUrl = this.resolveAudioUrl(attachment, serverBaseUrl);
    const isSame = this._currentAttachment && AudioConverterHelper.isSameAttachment(this._currentAttachment, attachment);

    if (isSame && this.audio.src && (this.audio.src === targetUrl || targetUrl.endsWith(this.audio.src))) {
      if (this._isPlaying) {
        this.pause();
      } else {
        this.play();
      }
      return;
    }

    this.audio.pause();
    this._currentAttachment = attachment;

    if (!targetUrl) {
      this.stop();
      return;
    }

    if (this.audio.src !== targetUrl) {
      this.audio.src = targetUrl;
    }

    this._positionSeconds = 0;

    const attDur = attachment.durationSeconds && attachment.durationSeconds > 0 ? attachment.durationSeconds : 0;
    this._durationSeconds = attDur;
    this._timeString = `${AudioMetadataHelper.formatDuration(0)} / ${AudioMetadataHelper.formatDuration(attDur)}`;
    this.notify();

    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (err.name === 'AbortError') return;
        console.warn('[AudioPlayerService] Play error:', err);
        this._isPlaying = false;
        this.notify();
      });
    }
  }

  private resolveAudioUrl(att: IAttachment, serverBaseUrl: string): string {
    const rawUrl = att.url || att.localImagePath || '';
    if (!rawUrl) return '';

    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('blob:')) {
      return rawUrl;
    }

    const base = (serverBaseUrl || '').replace(/\/+$/, '');
    const cleanPath = rawUrl.replace(/^\/+/, '');
    return base ? `${base}/${cleanPath}` : `/${cleanPath}`;
  }

  public play(): void {
    if (!this.audio.src) return;
    this.audio.play().catch((err) => {
      if (err.name === 'AbortError') return;
      console.error('[AudioPlayerService] Play error:', err);
    });
  }

  public pause(): void {
    this.audio.pause();
  }

  public stop(): void {
    try {
      this.audio.pause();
      this.audio.currentTime = 0;
    } catch {}

    this._isPlaying = false;
    this._isDragging = false;
    this._positionSeconds = 0;
    this._durationSeconds = 0;
    this._timeString = '00:00';
    this._currentAttachment = null;
    this.notify();
  }

  public seek(seconds: number): void {
    if (!this._currentAttachment) return;
    const rawDur = this.audio.duration;
    const dur = typeof rawDur === 'number' && isFinite(rawDur) && rawDur > 0
      ? rawDur
      : (this._durationSeconds || 0);

    const target = Math.max(0, Math.min(dur > 0 ? dur : seconds, seconds));

    this.audio.currentTime = target;
    this._positionSeconds = target;
    this._timeString = `${AudioMetadataHelper.formatDuration(this._positionSeconds)} / ${AudioMetadataHelper.formatDuration(dur)}`;
    this.notify();
  }

  public beginDrag(): void {
    this._isDragging = true;
    this.notify();
  }

  public dragSeek(seconds: number): void {
    if (!this._currentAttachment) return;
    const rawDur = this.audio.duration;
    const dur = typeof rawDur === 'number' && isFinite(rawDur) && rawDur > 0
      ? rawDur
      : (this._durationSeconds || 0);

    this._positionSeconds = Math.max(0, Math.min(dur > 0 ? dur : seconds, seconds));
    this._timeString = `${AudioMetadataHelper.formatDuration(this._positionSeconds)} / ${AudioMetadataHelper.formatDuration(dur)}`;
    this.notify();
  }

  public endDrag(seconds: number): void {
    this._isDragging = false;
    this.seek(seconds);
  }

  private onTimeUpdate = (): void => {
    if (this._isDragging) return;
    this._positionSeconds = this.audio.currentTime || 0;

    const rawDur = this.audio.duration;
    if (typeof rawDur === 'number' && isFinite(rawDur) && rawDur > 0) {
      this._durationSeconds = rawDur;
    } else if (this._durationSeconds <= 0 && this._currentAttachment?.durationSeconds) {
      this._durationSeconds = this._currentAttachment.durationSeconds;
    }

    this._timeString = `${AudioMetadataHelper.formatDuration(this._positionSeconds)} / ${AudioMetadataHelper.formatDuration(this._durationSeconds)}`;
    this.notify();
  };

  private onLoadedMetadata = (): void => {
    const rawDur = this.audio.duration;
    if (typeof rawDur === 'number' && isFinite(rawDur) && rawDur > 0) {
      this._durationSeconds = rawDur;
    } else if (this._currentAttachment?.durationSeconds && this._currentAttachment.durationSeconds > 0) {
      this._durationSeconds = this._currentAttachment.durationSeconds;
    }

    this._timeString = `${AudioMetadataHelper.formatDuration(this._positionSeconds)} / ${AudioMetadataHelper.formatDuration(this._durationSeconds)}`;
    this.notify();
  };

  private onPlay = (): void => {
    this._isPlaying = true;
    this.notify();
    eventBus.emit('AudioPlaybackStateChanged' as any, { isPlaying: true, attachment: this._currentAttachment });
  };

  private onPause = (): void => {
    this._isPlaying = false;
    this.notify();
    eventBus.emit('AudioPlaybackStateChanged' as any, { isPlaying: false, attachment: this._currentAttachment });
  };

  private onEnded = (): void => {
    this._isPlaying = false;
    const endedAtt = this._currentAttachment;

    const isVoice =
      endedAtt?.type === AttachmentType.Voice ||
      (Boolean(endedAtt?.waveform) && String(endedAtt?.waveform).trim().length > 0) ||
      (Boolean(endedAtt?.fileName) && Boolean(endedAtt?.fileName?.toLowerCase().startsWith('voice_')));

    if (isVoice) {
      try {
        this.audio.currentTime = 0;
      } catch {}
      this._positionSeconds = 0;
      this._currentAttachment = null;
      this._timeString = '00:00';
    } else {
      this._positionSeconds = 0;
      this._timeString = `${AudioMetadataHelper.formatDuration(0)} / ${AudioMetadataHelper.formatDuration(this._durationSeconds)}`;
    }

    this.notify();
    eventBus.emit('AudioPlaybackEnded' as any, { attachment: endedAtt });
  };

  private onError = (): void => {
    if (!this.audio.src) return;
    console.warn('[AudioPlayerService] Audio stream error.');
    this._isPlaying = false;
    this.notify();
  };
}

export const audioPlayerService = AudioPlayerService.getInstance();