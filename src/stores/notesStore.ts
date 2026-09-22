import { create } from 'zustand';
import type { INote, IMessage, IAttachment, IUser } from '../types/models';
import { NoteShapeType, AttachmentType } from '../types/enums';
import { apiClient, BASE_SERVER_URL } from '../services/apiClient';
import { userSession } from '../services/userSession';
import { signalRService } from '../services/signalr.service';
import { eventBus } from '../services/eventBus';
import { normalizeAvatarUrl, UrlHelper } from '../utils/helpers';
import { useAuthStore } from './authStore';
import { NotesService } from '../services/notes.service';

export interface NotesState {
  myNotes: INote[];
  selectedNote: INote | null;
  isNoteChatMode: boolean;
  isNoteSidebarHidden: boolean;
  noteSearchText: string;
  currentChatMessages: IMessage[];

  noteEditMode: 'Ink' | 'Eraser' | 'Select' | 'Shape';
  brushSize: number;
  brushColor: string;
  selectedShape: NoteShapeType;
  customColor1: string;
  customColor2: string;
  isColorPickerOpen: boolean;
  customBrushColorHex: string;
  activeCustomSlot: 1 | 2;

  initialize: (forceRefresh?: boolean) => Promise<void>;
  selectNote: (note: INote | null) => Promise<void>;
  createNewNote: () => Promise<void>;
  deleteNote: (note: INote) => void;
  beginEditNote: (noteId: number) => void;
  cancelEditNote: (noteId: number) => void;
  commitEditNote: (note: INote, newTitle: string) => Promise<void>;
  toggleNoteSidebar: () => void;
  toggleNoteView: () => void;
  setNoteSearchText: (text: string) => void;
  clearNoteSearch: () => void;

  setNoteTool: (tool: 'Ink' | 'Eraser' | 'Select' | 'Shape') => void;
  selectShape: (shape: NoteShapeType) => void;
  resetShapeTool: () => void;
  setBrushSize: (size: number) => void;
  setBrushColor: (color: string) => void;
  setCustomColorHex: (hex: string) => void;
  openCustomColorPicker: (slot: 1 | 2) => void;
  closeColorPicker: () => void;

  saveCurrentNoteInkData: (serializedJson: string, thumbnailBase64?: string) => Promise<void>;
  sendNoteMessage: (text: string, filesToUpload?: File[]) => Promise<void>;
}

const userProfileCache = new Map<number, IUser>();

async function fetchUserProfileDeduplicated(userId: number): Promise<IUser | null> {
  if (userProfileCache.has(userId)) return userProfileCache.get(userId)!;
  try {
    const res = await apiClient.get<IUser>(`api/Users/${userId}`).catch(() => apiClient.get<IUser>(`api/User/${userId}`));
    if (res && res.data) {
      userProfileCache.set(userId, res.data);
      return res.data;
    }
  } catch {}
  return null;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  myNotes: [],
  selectedNote: null,
  isNoteChatMode: true,
  isNoteSidebarHidden: false,
  noteSearchText: '',
  currentChatMessages: [],

  noteEditMode: 'Ink',
  brushSize: 3.0,
  brushColor: '#000000',
  selectedShape: NoteShapeType.None,
  customColor1: localStorage.getItem('notes_custom_color_1') || '#FF0000',
  customColor2: localStorage.getItem('notes_custom_color_2') || '#00FF00',
  isColorPickerOpen: false,
  customBrushColorHex: '#FFFF0000',
  activeCustomSlot: 1,

  initialize: async () => {
    try {
      const res = await apiClient.get<INote[]>('api/Notes');
      const notes = res.data || [];
      set({ myNotes: notes });

      if (notes.length > 0 && !get().selectedNote) {
        await get().selectNote(notes[0]);
      }
    } catch (e) {
      console.error('[NotesStore] Ошибка загрузки заметок:', e);
    }
  },

  selectNote: async (note) => {
    if (!note) {
      set({ selectedNote: null, currentChatMessages: [] });
      return;
    }

    set((state) => ({
      selectedNote: note,
      isNoteChatMode: true,
      myNotes: state.myNotes.map((n) => ({ ...n, isSelected: n.id === note.id })),
    }));

    if (note.id) {
      try {
        const currentUser = useAuthStore.getState().currentUser;
        const currentUserId = Number(currentUser?.id || userSession.userId || 0);
        const myName = currentUser?.nickName || currentUser?.username || 'User';
        const myAvatar = currentUser?.avatarPath || (currentUser as any)?.avatar || null;

        const res = await apiClient.get<any[]>(`api/Notes/${note.id}/messages`);
        const rawMessages = res.data || [];

        const uniqueOtherUserIds = Array.from(
          new Set(
            rawMessages
              .map((m) => Number(m.senderId ?? m.SenderId))
              .filter((id) => id > 0 && id !== currentUserId && !userProfileCache.has(id))
          )
        );

        for (const uid of uniqueOtherUserIds) {
          await fetchUserProfileDeduplicated(uid);
        }

        const enrichedMessages: IMessage[] = rawMessages.map((m) => {
          const senderId = Number(m.senderId ?? m.SenderId);
          const isMy = senderId === currentUserId;

          let senderName = m.senderName ?? m.SenderName;
          let senderAvatar = m.senderAvatar ?? m.SenderAvatar;

          if (isMy) {
            senderName = myName;
            senderAvatar = myAvatar;
          } else {
            const cached = userProfileCache.get(senderId);
            if (cached) {
              senderName = cached.nickName || cached.username || `User ${senderId}`;
              senderAvatar = cached.avatarPath || (cached as any)?.avatar;
            }
          }

          const rawAttachments = m.attachments || m.Attachments || [];
          const normalizedAttachments = rawAttachments.map((att: any, idx: number) => {
            const rawUrl = (att.url || att.Url || att.localImagePath || att.LocalImagePath || '').trim();
            const finalUrl = rawUrl.startsWith('blob:') || rawUrl.startsWith('http')
              ? rawUrl
              : UrlHelper.normalize(rawUrl, BASE_SERVER_URL);

            return {
              id: att.id || att.Id || idx + 1,
              messageId: m.id || m.Id || 0,
              type: att.type ?? att.Type ?? AttachmentType.Photo,
              fileName: att.fileName || att.FileName || '',
              fileSizeStr: att.fileSizeStr || att.FileSizeStr || '',
              fileSizeBytes: att.fileSizeBytes || att.FileSizeBytes || 0,
              url: finalUrl,
              thumbnailUrl: finalUrl,
              localImagePath: finalUrl,
              hasAudio: Boolean(att.hasAudio ?? att.HasAudio),
              width: att.width || att.Width || 0,
              height: att.height || att.Height || 0,
              durationSeconds: att.durationSeconds || att.DurationSeconds || 0,
            };
          });

          return {
            ...m,
            isMyMessage: isMy,
            senderName: senderName || 'User',
            senderAvatar: senderAvatar ? normalizeAvatarUrl(senderAvatar) : null,
            attachments: normalizedAttachments,
          };
        });

        set({ currentChatMessages: enrichedMessages });
        await signalRService?.subscribeToNoteAsync?.(note.id);
      } catch (err) {
        console.error('[NotesStore ERROR] Сбой загрузки сообщений заметки:', err);
      }
    }
  },

  createNewNote: async () => {
    const currentUser = useAuthStore.getState().currentUser;
    const currentUserId = Number(currentUser?.id || userSession.userId || 0);
    const count = get().myNotes.length + 1;
    const newNote: INote = {
      userId: currentUserId,
      title: `New Note ${count}`,
      iconKind: 'BookmarkOutline',
      iconColor: '#3B82F6',
      lastEditedTime: new Date().toISOString(),
    };

    try {
      const res = await apiClient.post<INote>('api/Notes/upsert', newNote);
      if (res.data?.id) newNote.id = res.data.id;

      const updated = [newNote, ...get().myNotes];
      set({ myNotes: updated });
      await get().selectNote(newNote);
    } catch (e) {
      console.error('[NotesStore ERROR] Ошибка создания новой заметки:', e);
    }
  },

  deleteNote: (note) => {
    if (!note || !note.id) return;

    eventBus.emit('OpenConfirmDialogMessage', {
      title: note.title,
      message: `Delete note '${note.title}'?`,
      avatar: null,
      checkboxText: null,
      confirmButtonText: 'Delete',
      onConfirmAction: async () => {
        try {
          await apiClient.delete(`api/Notes/${note.id}`);
          const updated = get().myNotes.filter((n) => n.id !== note.id);
          const isSelectedDeleted = get().selectedNote?.id === note.id;

          set({
            myNotes: updated,
            selectedNote: isSelectedDeleted ? (updated[0] || null) : get().selectedNote,
            currentChatMessages: isSelectedDeleted ? [] : get().currentChatMessages,
          });

          if (isSelectedDeleted && updated[0]) {
            await get().selectNote(updated[0]);
          }
        } catch (err) {
          console.error('[NotesStore ERROR] Ошибка при удалении заметки:', err);
        }
      },
    });
  },

  beginEditNote: (noteId: number) => {
    set((state) => ({
      myNotes: state.myNotes.map((n) =>
        n.id === noteId ? { ...n, isEditing: true, editingName: n.title } : { ...n, isEditing: false }
      ),
    }));
  },

  cancelEditNote: (noteId: number) => {
    set((state) => ({
      myNotes: state.myNotes.map((n) => (n.id === noteId ? { ...n, isEditing: false } : n)),
    }));
  },

  commitEditNote: async (note, newTitle) => {
    const finalTitle = newTitle.trim() || 'Unnamed Note';
    const updatedNote = { ...note, title: finalTitle, isEditing: false, lastEditedTime: new Date().toISOString() };

    set((state) => ({
      myNotes: state.myNotes.map((n) => (n.id === note.id ? updatedNote : n)),
      selectedNote: state.selectedNote?.id === note.id ? updatedNote : state.selectedNote,
    }));

    try {
      await apiClient.post('api/Notes/upsert', updatedNote);
    } catch (err) {
      console.error('[NotesStore ERROR] Ошибка синхронизации имени заметки:', err);
    }
  },

  toggleNoteSidebar: () => set((state) => ({ isNoteSidebarHidden: !state.isNoteSidebarHidden })),
  toggleNoteView: () => set((state) => ({ isNoteChatMode: !state.isNoteChatMode })),
  setNoteSearchText: (text) => set({ noteSearchText: text }),
  clearNoteSearch: () => set({ noteSearchText: '' }),

  setNoteTool: (tool) => set({ noteEditMode: tool, selectedShape: NoteShapeType.None }),
  selectShape: (shape) => set({ selectedShape: shape, noteEditMode: shape === NoteShapeType.None ? 'Select' : 'Shape' }),
  resetShapeTool: () => set({ selectedShape: NoteShapeType.None, noteEditMode: 'Select' }),
  setBrushSize: (size) => set({ brushSize: size }),
  setBrushColor: (color) => set({ brushColor: color }),

  openCustomColorPicker: (slot) => {
    const currentColor = slot === 1 ? get().customColor1 : get().customColor2;
    set({
      activeCustomSlot: slot,
      isColorPickerOpen: true,
      customBrushColorHex: currentColor,
      brushColor: currentColor,
    });
  },

  closeColorPicker: () => set({ isColorPickerOpen: false }),

  setCustomColorHex: (hex) => {
    const slot = get().activeCustomSlot;
    if (slot === 1) {
      localStorage.setItem('notes_custom_color_1', hex);
      set({ customColor1: hex, brushColor: hex, customBrushColorHex: hex });
    } else {
      localStorage.setItem('notes_custom_color_2', hex);
      set({ customColor2: hex, brushColor: hex, customBrushColorHex: hex });
    }
  },

  saveCurrentNoteInkData: async (serializedJson, thumbnailBase64) => {
    const { selectedNote } = get();
    if (!selectedNote || !selectedNote.id) return;

    const updated: INote = {
      ...selectedNote,
      inkData: serializedJson,
      thumbnail: thumbnailBase64 || selectedNote.thumbnail,
      lastEditedTime: new Date().toISOString(),
    };

    set((state) => ({
      selectedNote: updated,
      myNotes: state.myNotes.map((n) => (n.id === updated.id ? updated : n)),
    }));

    try {
      await apiClient.post('api/Notes/upsert', updated);
    } catch (err) {
      console.error('[NotesStore ERROR] Ошибка сохранения данных холста:', err);
    }
  },

  // 🟢 Отправка с дублированием свойств в PascalCase для MessagePack
  sendNoteMessage: async (text, filesToUpload = []) => {
    const { selectedNote, currentChatMessages } = get();
    if (!selectedNote || !selectedNote.id) return;
    if (!text.trim() && filesToUpload.length === 0) return;

    const currentUser = useAuthStore.getState().currentUser;
    const currentUserId = Number(currentUser?.id || userSession.userId || 0);
    const myName = currentUser?.nickName || currentUser?.username || 'User';
    const myAvatar = currentUser?.avatarPath || (currentUser as any)?.avatar || null;

    const tempAttachments: IAttachment[] = filesToUpload.map((f, idx) => ({
      id: Date.now() + idx,
      messageId: 0,
      type: f.type.startsWith('image/') ? AttachmentType.Photo : AttachmentType.Document,
      fileName: f.name,
      fileSizeStr: `${(f.size / 1024).toFixed(1)} KB`,
      fileSizeBytes: f.size,
      url: URL.createObjectURL(f),
      localImagePath: URL.createObjectURL(f),
      hasAudio: false,
      width: 0,
      height: 0,
      durationSeconds: 0,
    }));

    const tempId = Date.now();
    const newMsg: IMessage = {
      id: tempId,
      serverId: 0,
      senderId: currentUserId,
      senderName: myName,
      senderAvatar: myAvatar ? normalizeAvatarUrl(myAvatar) : undefined,
      noteId: selectedNote.id,
      text,
      isMyMessage: true,
      isSentToServer: false,
      isRead: true,
      timestamp: new Date().toISOString(),
      isDeleted: false,
      isDeletedForMe: false,
      isPinned: false,
      viewsCount: 1,
      attachments: tempAttachments,
    };

    set({ currentChatMessages: [...currentChatMessages, newMsg] });

    try {
      // 1. Загрузка бинарников на сервер
      const uploadedDtos: any[] = [];
      for (const file of filesToUpload) {
        const dtos = await NotesService.uploadAttachmentAsync(file, file.name);
        if (dtos && dtos.length > 0) {
          uploadedDtos.push(...dtos);
        }
      }

      // 🟢 2. Передача свойств в PascalCase, чтобы MessagePack в C# связал свойства Url, FileName, Type
      const signalRAttachments = uploadedDtos.map((dto: any) => ({
        Type: dto.type ?? dto.Type ?? 0,
        FileName: dto.fileName ?? dto.FileName ?? '',
        FileSizeStr: dto.fileSizeStr ?? dto.FileSizeStr ?? '',
        Url: dto.url ?? dto.Url ?? '',
        ThumbnailUrl: dto.thumbnailUrl ?? dto.ThumbnailUrl ?? null,
        FileHash: dto.fileHash ?? dto.FileHash ?? null,
        HasAudio: Boolean(dto.hasAudio ?? dto.HasAudio),
        Width: dto.width ?? dto.Width ?? 0,
        Height: dto.height ?? dto.Height ?? 0,
        DurationSeconds: dto.durationSeconds ?? dto.DurationSeconds ?? 0,
        type: dto.type ?? dto.Type ?? 0,
        fileName: dto.fileName ?? dto.FileName ?? '',
        fileSizeStr: dto.fileSizeStr ?? dto.FileSizeStr ?? '',
        url: dto.url ?? dto.Url ?? '',
      }));

      // 3. Отправка через SignalR
      const serverId = await signalRService.sendMessageAsync(
        null,
        null,
        selectedNote.id,
        text,
        null,
        null,
        null,
        null,
        signalRAttachments as any
      );

      // 4. Обновление сообщения постоянными URL
      if (serverId > 0) {
        const finalAttachments: IAttachment[] = uploadedDtos.map((dto, idx) => {
          const rawUrl = dto.url || dto.Url || '';
          const finalUrl = UrlHelper.normalize(rawUrl, BASE_SERVER_URL);
          return {
            id: idx + 1,
            messageId: serverId,
            type: dto.type ?? dto.Type ?? AttachmentType.Photo,
            fileName: dto.fileName ?? dto.FileName ?? '',
            fileSizeStr: dto.fileSizeStr ?? dto.FileSizeStr ?? '',
            fileSizeBytes: dto.fileSizeBytes ?? dto.FileSizeBytes ?? 0,
            url: finalUrl,
            thumbnailUrl: finalUrl,
            localImagePath: finalUrl,
            hasAudio: Boolean(dto.hasAudio ?? dto.HasAudio),
            width: dto.width ?? dto.Width ?? 0,
            height: dto.height ?? dto.Height ?? 0,
            durationSeconds: dto.durationSeconds ?? dto.DurationSeconds ?? 0,
          };
        });

        set((state) => ({
          currentChatMessages: state.currentChatMessages.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  serverId,
                  isSentToServer: true,
                  attachments: finalAttachments.length > 0 ? finalAttachments : m.attachments,
                }
              : m
          ),
        }));
      }
    } catch (err) {
      console.error('[NotesStore ERROR] Ошибка отправки сообщения в заметку:', err);
    }
  },
}));

eventBus.on('ReceiveMessage' as any, async (incoming: IMessage) => {
  const { selectedNote, currentChatMessages } = useNotesStore.getState();
  if (incoming.noteId && selectedNote && Number(incoming.noteId) === Number(selectedNote.id)) {
    const currentUser = useAuthStore.getState().currentUser;
    const currentUserId = Number(currentUser?.id || userSession.userId || 0);
    const isMy = Number(incoming.senderId) === currentUserId;

    const existingIdx = currentChatMessages.findIndex(
      (m) => (incoming.serverId && m.serverId === incoming.serverId) || (isMy && m.serverId === 0 && m.text === incoming.text)
    );

    let senderName = incoming.senderName;
    let senderAvatar = incoming.senderAvatar;

    if (isMy && currentUser) {
      senderName = currentUser.nickName || currentUser.username || 'User';
      senderAvatar = currentUser.avatarPath || (currentUser as any)?.avatar;
    } else {
      const profile = await fetchUserProfileDeduplicated(Number(incoming.senderId));
      if (profile) {
        senderName = profile.nickName || profile.username || `User ${incoming.senderId}`;
        senderAvatar = profile.avatarPath || (profile as any)?.avatar;
      }
    }

    const rawAttachments = incoming.attachments || (incoming as any).Attachments || [];
    const normalizedAttachments = rawAttachments.map((att: any, idx: number) => {
      const rawUrl = att.url || att.Url || att.localImagePath || att.LocalImagePath || '';
      const fullUrl = rawUrl.startsWith('blob:') || rawUrl.startsWith('http')
        ? rawUrl
        : UrlHelper.normalize(rawUrl, BASE_SERVER_URL);

      return {
        ...att,
        id: att.id || idx + 1,
        url: fullUrl,
        localImagePath: fullUrl,
      };
    });

    const preparedMsg: IMessage = {
      ...incoming,
      isMyMessage: isMy,
      senderName: senderName || 'User',
      senderAvatar: senderAvatar ? normalizeAvatarUrl(senderAvatar) : undefined,
      attachments: normalizedAttachments,
    };

    if (existingIdx !== -1) {
      const updated = [...currentChatMessages];
      updated[existingIdx] = { ...updated[existingIdx], ...preparedMsg };
      useNotesStore.setState({ currentChatMessages: updated });
    } else {
      useNotesStore.setState({
        currentChatMessages: [...currentChatMessages, preparedMsg],
      });
    }
  }
});

if (typeof window !== 'undefined') {
  window.addEventListener('CreateNewNote', () => {
    useNotesStore.getState().createNewNote();
  });
}