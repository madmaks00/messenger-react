import { create } from 'zustand';
import { IAttachment, IMessage } from '../types/models';
import { AttachmentType } from '../types/enums';
import { voiceRecordingService } from '../services/voiceRecording.service';
import { eventBus } from '../services/eventBus';
import { useChatStore } from './chatStore';
import { mediaDimensionsCache } from '../utils/mediaDimensionsCache';

interface MessageInputState {
  newMessageText: string;
  editingMessage: IMessage | null;
  replyingToMessages: IMessage[];
  pendingAttachments: IAttachment[];
  isRecordingVoice: boolean;
  recordingTimeStr: string;
  hintText: string;

  canWriteMessages: boolean;
  canSendMedia: boolean;
  canSendText: boolean;
  isBlockedByMe: boolean;
  isBlockedByThem: boolean;
  isGroup: boolean;
  isChannel: boolean;
  isCurrentChatJoined: boolean;
  isAdmin: boolean;

  setNewMessageText: (text: string) => void;
  setEditMessage: (msg: IMessage) => void;
  cancelEdit: () => void;
  addReplyMessage: (msg: IMessage) => void;
  cancelReply: (msg?: IMessage) => void;
  addPendingAttachments: (files: File[]) => Promise<void>;
  removePendingAttachment: (index: number) => void;
  startVoiceRecording: () => Promise<void>;
  cancelVoiceRecording: () => void;
  stopAndSendVoiceRecording: () => Promise<void>;
  reset: () => void;
  syncChatPermissions: (perms: {
    isGroup: boolean;
    isChannel: boolean;
    isAdmin: boolean;
    isCurrentChatJoined: boolean;
    isBlockedByMe: boolean;
    isBlockedByThem: boolean;
    canSendText: boolean;
    canSendMedia: boolean;
    canWriteMessages: boolean;
  }) => void;
}

export const useMessageInputStore = create<MessageInputState>((set, get) => ({
  newMessageText: '',
  editingMessage: null,
  replyingToMessages: [],
  pendingAttachments: [],
  isRecordingVoice: false,
  recordingTimeStr: '00:00',
  hintText: 'Message...',

  canWriteMessages: true,
  canSendMedia: true,
  canSendText: true,
  isBlockedByMe: false,
  isBlockedByThem: false,
  isGroup: false,
  isChannel: false,
  isCurrentChatJoined: true,
  isAdmin: false,

  setNewMessageText: (text) => {
    set({ newMessageText: text });
    useChatStore.getState().sendTyping(text);
  },

  setEditMessage: (msg) => {
    set({
      editingMessage: msg,
      newMessageText: msg.text || '',
      pendingAttachments: msg.attachments ? [...msg.attachments] : [],
    });
  },

  cancelEdit: () => {
    set({
      editingMessage: null,
      newMessageText: '',
      pendingAttachments: [],
    });
  },

  addReplyMessage: (msg) => {
    const existing = get().replyingToMessages;
    if (!existing.some((m) => (m.serverId > 0 && m.serverId === msg.serverId) || (m.id > 0 && m.id === msg.id))) {
      set({ replyingToMessages: [...existing, msg] });
    }
  },

  cancelReply: (msg) => {
    if (!msg) {
      set({ replyingToMessages: [] });
    } else {
      set({ replyingToMessages: get().replyingToMessages.filter((m) => m !== msg) });
    }
  },

  addPendingAttachments: async (files: File[]) => {
    const state = get();
    if (state.isGroup && !state.isAdmin && !state.canSendMedia) return;

    const maxFileSize = 500 * 1024 * 1024;
    const newAtts: IAttachment[] = [];

    for (const file of files) {
      if (file.size > maxFileSize) continue;

      let type = AttachmentType.Document;
      
      const cached = mediaDimensionsCache.get(file.name);
      let width = Number((file as any).width || cached?.width || 0);
      let height = Number((file as any).height || cached?.height || 0);
      let durationSeconds = 0;
      let hasAudio = false;
      let displayImageUrl = '';

      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isGifExt = ext === 'gif' || file.type === 'image/gif' || file.name.toLowerCase().includes('.gif');
      const isVideoExt = ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext) || file.type.startsWith('video/');

      const objectUrl = URL.createObjectURL(file);

      if (isGifExt) {
        type = AttachmentType.Video;
        hasAudio = false;

        // Для GIF генерируем кадр превью через Canvas
        try {
          const videoMeta = await new Promise<{ width: number; height: number; thumbUrl: string }>((resolve) => {
            const video = document.createElement('video');
            video.preload = 'auto';
            video.muted = true;
            video.playsInline = true;

            video.onloadeddata = () => {
              video.currentTime = 0.001;
            };

            video.onseeked = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 300;
                canvas.height = video.videoHeight || 300;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  resolve({
                    width: video.videoWidth || 0,
                    height: video.videoHeight || 0,
                    thumbUrl: canvas.toDataURL('image/jpeg', 0.85),
                  });
                  return;
                }
              } catch {}
              resolve({ width: 0, height: 0, thumbUrl: '' });
            };

            video.onerror = () => resolve({ width: 0, height: 0, thumbUrl: '' });
            video.src = objectUrl;
          });

          displayImageUrl = videoMeta.thumbUrl;
          if (videoMeta.width > 0 && width === 0) width = videoMeta.width;
          if (videoMeta.height > 0 && height === 0) height = videoMeta.height;
        } catch {}

      } else if (['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext) || file.type.startsWith('image/')) {
        type = AttachmentType.Photo;
        displayImageUrl = objectUrl;

      } else if (isVideoExt) {
        type = AttachmentType.Video;

        // Для обычного видео считываем метаданные, звук и первый кадр
        try {
          const videoMeta = await new Promise<{
            hasAudio: boolean;
            duration: number;
            width: number;
            height: number;
            thumbUrl: string;
          }>((resolve) => {
            const video = document.createElement('video');
            video.preload = 'auto';
            video.muted = true;
            video.playsInline = true;

            video.onloadeddata = () => {
              video.currentTime = 0.001;
            };

            video.onseeked = () => {
              let thumb = '';
              try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 300;
                canvas.height = video.videoHeight || 300;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  thumb = canvas.toDataURL('image/jpeg', 0.85);
                }
              } catch {}

              const anyVid = video as any;
              const hasSound = Boolean(
                anyVid.mozHasAudio ||
                anyVid.webkitAudioDecodedByteCount > 0 ||
                Boolean(anyVid.audioTracks && anyVid.audioTracks.length > 0)
              );

              resolve({
                hasAudio: hasSound,
                duration: Math.round(video.duration || 0),
                width: video.videoWidth || 0,
                height: video.videoHeight || 0,
                thumbUrl: thumb,
              });
            };

            video.onerror = () => resolve({ hasAudio: true, duration: 0, width: 0, height: 0, thumbUrl: '' });
            video.src = objectUrl;
          });

          hasAudio = videoMeta.hasAudio;
          durationSeconds = videoMeta.duration;
          displayImageUrl = videoMeta.thumbUrl;
          if (videoMeta.width > 0 && width === 0) width = videoMeta.width;
          if (videoMeta.height > 0 && height === 0) height = videoMeta.height;
        } catch {
          hasAudio = true;
        }

      } else if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'opus'].includes(ext) || file.type.startsWith('audio/')) {
        type = AttachmentType.Audio;
      }

      const units = ['B', 'KB', 'MB', 'GB'];
      let size = file.size;
      let unitIdx = 0;
      while (size >= 1024 && unitIdx < units.length - 1) {
        size /= 1024;
        unitIdx++;
      }
      
      const fileSizeStr = (isGifExt || (type === AttachmentType.Video && !hasAudio))
        ? 'GIF'
        : `${size.toFixed(2)} ${units[unitIdx]}`;

      newAtts.push({
        id: Date.now() + Math.random(),
        messageId: 0,
        type,
        fileName: file.name,
        fileSizeStr,
        fileSizeBytes: file.size,
        url: objectUrl,
        localImagePath: objectUrl,
        displayImageUrl: displayImageUrl || undefined,
        rawFile: file,
        hasAudio,
        width,
        height,
        durationSeconds,
      });
    }

    set({ pendingAttachments: [...get().pendingAttachments, ...newAtts] });
  },

  removePendingAttachment: (index) => {
    const atts = [...get().pendingAttachments];
    atts.splice(index, 1);
    set({ pendingAttachments: atts });
  },

  startVoiceRecording: async () => {
    const state = get();
    if (state.isRecordingVoice || !state.canWriteMessages) return;

    await voiceRecordingService.startRecording();
    set({ isRecordingVoice: true, recordingTimeStr: '00:00' });
  },

  cancelVoiceRecording: () => {
    voiceRecordingService.cancelRecording();
    set({ isRecordingVoice: false, recordingTimeStr: '00:00' });
  },

  stopAndSendVoiceRecording: async () => {
    const result = await voiceRecordingService.stopRecording();
    set({ isRecordingVoice: false, recordingTimeStr: '00:00' });

    if (!result) return;

    const url = URL.createObjectURL(result.file);
    const voiceAtt: IAttachment = {
      id: Date.now(),
      messageId: 0,
      type: AttachmentType.Voice,
      fileName: result.file.name,
      fileSizeStr: `${result.durationSeconds}s, ${(result.file.size / 1024).toFixed(1)} KB`,
      fileSizeBytes: result.file.size,
      url,
      localImagePath: url,
      rawFile: result.file,
      waveform: result.waveform,
      durationSeconds: result.durationSeconds,
      hasAudio: true,
      width: 0,
      height: 0,
    };

    set({ pendingAttachments: [voiceAtt] });
  },

  reset: () => {
    set({
      newMessageText: '',
      editingMessage: null,
      pendingAttachments: [],
      replyingToMessages: [],
      isRecordingVoice: false,
      recordingTimeStr: '00:00',
    });
  },

  syncChatPermissions: (perms) => set(perms),
}));

eventBus.on('EmojiPickedMessage' as any, (data: any) => {
  if (data?.emoji) {
    const current = useMessageInputStore.getState().newMessageText;
    useMessageInputStore.getState().setNewMessageText(current + data.emoji);
  }
});