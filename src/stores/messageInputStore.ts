import { create } from 'zustand';
import { IAttachment, IMessage } from '../types/models';
import { AttachmentType } from '../types/enums';
import { voiceRecordingService } from '../services/voiceRecording.service';
import { eventBus } from '../services/eventBus';
import { useChatStore } from './chatStore';

interface MessageInputState {
  newMessageText: string;
  editingMessage: IMessage | null;
  replyingToMessages: IMessage[];
  pendingAttachments: IAttachment[];
  isRecordingVoice: boolean;
  recordingTimeStr: string;
  hintText: string;

  // Права и ограничения
  canWriteMessages: boolean;
  canSendMedia: boolean;
  canSendText: boolean;
  isBlockedByMe: boolean;
  isBlockedByThem: boolean;
  isGroup: boolean;
  isChannel: boolean;
  isCurrentChatJoined: boolean;
  isAdmin: boolean;

  // Действия
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

  // 🟢 При любом вводе текста отправляем статус typing через сокет собеседнику в C# WPF
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

    const maxFileSize = 500 * 1024 * 1024; // 500 MB
    const newAtts: IAttachment[] = [];

    for (const file of files) {
      if (file.size > maxFileSize) continue;

      let type = AttachmentType.Document;
      let width = 0;
      let height = 0;
      let durationSeconds = 0;
      let hasAudio = false;

      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'].includes(ext) || file.type.startsWith('image/')) {
        type = AttachmentType.Photo;
      } else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext) || file.type.startsWith('video/')) {
        type = AttachmentType.Video;
        hasAudio = true;
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
      const fileSizeStr = `${size.toFixed(2)} ${units[unitIdx]}`;
      const objectUrl = URL.createObjectURL(file);

      newAtts.push({
        id: Date.now() + Math.random(),
        messageId: 0,
        type,
        fileName: file.name,
        fileSizeStr,
        fileSizeBytes: file.size,
        url: objectUrl,
        localImagePath: objectUrl,
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

// Слушатель выбора эмодзи
eventBus.on('EmojiPickedMessage' as any, (data: any) => {
  if (data?.emoji) {
    const current = useMessageInputStore.getState().newMessageText;
    useMessageInputStore.getState().setNewMessageText(current + data.emoji);
  }
});