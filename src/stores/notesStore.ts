import { create } from 'zustand';
import type { INote, IMessage, IAttachment, IUser } from '../types/models';
import { NoteShapeType } from '../types/enums';
import { apiClient } from '../services/apiClient';
import { userSession } from '../services/userSession';
import { signalRService } from '../services/signalr.service';
import { eventBus } from '../services/eventBus';
import { normalizeAvatarUrl } from '../utils/helpers';

interface NotesState {
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

  initialize: () => Promise<void>;
  selectNote: (note: INote | null) => Promise<void>;
  createNewNote: () => Promise<void>;
  deleteNote: (note: INote) => Promise<void>;
  beginEditNote: (noteId: number) => void;
  cancelEditNote: (noteId: number) => void;
  commitEditNote: (note: INote, newTitle: string) => Promise<void>;
  toggleNoteSidebar: () => void;
  toggleNoteView: () => void;
  setNoteSearchText: (text: string) => void;
  setNoteEditMode: (mode: 'Ink' | 'Eraser' | 'Select' | 'Shape') => void;
  setSelectedShape: (shape: NoteShapeType) => void;
  setBrushSize: (size: number) => void;
  setBrushColor: (color: string) => void;
  setCustomColor: (slot: 1 | 2, color: string) => void;
  setColorPickerOpen: (open: boolean) => void;
  saveCurrentNoteInkData: (serializedJson: string, thumbnailBase64?: string) => Promise<void>;
  sendNoteMessage: (text: string, attachments?: IAttachment[]) => Promise<void>;
}

// Локальный кэш авторов, чтобы не опрашивать сервер повторно
const userProfileCache = new Map<number, IUser>();

async function fetchUserProfileDeduplicated(userId: number): Promise<IUser | null> {
  if (userProfileCache.has(userId)) {
    return userProfileCache.get(userId)!;
  }
  try {
    const res = await apiClient
      .get<IUser>(`api/Users/${userId}`)
      .catch(() => apiClient.get<IUser>(`api/User/${userId}`));
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
  customColor1: '#FF0000',
  customColor2: '#00FF00',
  isColorPickerOpen: false,

  initialize: async () => {
    try {
      const res = await apiClient.get<INote[]>('api/Notes');
      const notes = res.data || [];
      set({ myNotes: notes });

      if (notes.length > 0 && !get().selectedNote) {
        await get().selectNote(notes[0]);
      }
    } catch (e) {
      console.error('[NotesStore] Ошибка инициализации заметок:', e);
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
        const currentUserId = Number(
          userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
        );

        const sessionUser = JSON.parse(localStorage.getItem('user_session_data') || '{}');
        const myName = sessionUser.nickName || sessionUser.username || 'Me';
        const myAvatar = sessionUser.avatarPath || sessionUser.avatar || null;

        const res = await apiClient.get<IMessage[]>(`api/Notes/${note.id}/messages`);
        const rawMessages = res.data || [];

        // 🟢 ДЕДУПЛИКАЦИЯ: находим уникальные чужие ID, чтобы не спамить в API
        const uniqueOtherUserIds = Array.from(
          new Set(
            rawMessages
              .map((m) => Number(m.senderId))
              .filter((id) => id > 0 && id !== currentUserId && !userProfileCache.has(id))
          )
        );

        for (const uid of uniqueOtherUserIds) {
          await fetchUserProfileDeduplicated(uid);
        }

        const enrichedMessages: IMessage[] = rawMessages.map((m) => {
          const senderId = Number(m.senderId);
          const isMy = senderId === currentUserId;

          let senderName = m.senderName;
          let senderAvatar = m.senderAvatar;

          if (isMy) {
            senderName = myName;
            senderAvatar = myAvatar;
          } else if (!senderName || senderName === 'Unknown User') {
            const cached = userProfileCache.get(senderId);
            senderName = cached?.nickName || cached?.username || `User ${senderId}`;
            senderAvatar = cached?.avatarPath || (cached as any)?.avatar;
          }

          return {
            ...m,
            isMyMessage: isMy,
            senderName,
            senderAvatar: normalizeAvatarUrl(senderAvatar),
          };
        });

        set({ currentChatMessages: enrichedMessages });
        await signalRService?.subscribeToNoteAsync?.(note.id);
      } catch (err) {
        console.error('[NotesStore] Ошибка загрузки сообщений заметки:', err);
      }
    }
  },

  createNewNote: async () => {
    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );
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
      console.error('[NotesStore] Ошибка создания заметки:', e);
    }
  },

  deleteNote: async (note) => {
    if (!note.id) return;
    try {
      await apiClient.delete(`api/Notes/${note.id}`);
      const updated = get().myNotes.filter((n) => n.id !== note.id);
      set({
        myNotes: updated,
        selectedNote: get().selectedNote?.id === note.id ? (updated[0] || null) : get().selectedNote,
      });
    } catch (err) {
      console.error('[NotesStore] Ошибка удаления заметки:', err);
    }
  },

  beginEditNote: (noteId: number) => {
    set((state) => ({
      myNotes: state.myNotes.map((n) => (n.id === noteId ? { ...n, isEditing: true, editingName: n.title } : { ...n, isEditing: false })),
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
      console.error('[NotesStore] Ошибка переименования заметки:', err);
    }
  },

  toggleNoteSidebar: () => set((state) => ({ isNoteSidebarHidden: !state.isNoteSidebarHidden })),
  toggleNoteView: () => set((state) => ({ isNoteChatMode: !state.isNoteChatMode })),
  setNoteSearchText: (text) => set({ noteSearchText: text }),
  setNoteEditMode: (mode) => set({ noteEditMode: mode }),
  setSelectedShape: (shape) => set({ selectedShape: shape, noteEditMode: shape === NoteShapeType.None ? 'Ink' : 'Shape' }),
  setBrushSize: (size) => set({ brushSize: size }),
  setBrushColor: (color) => set({ brushColor: color }),

  setCustomColor: (slot, color) => {
    if (slot === 1) set({ customColor1: color });
    else set({ customColor2: color });
  },

  setColorPickerOpen: (open) => set({ isColorPickerOpen: open }),

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
      console.error('[NotesStore] Ошибка сохранения данных холста:', err);
    }
  },

  sendNoteMessage: async (text, attachments = []) => {
    const { selectedNote, currentChatMessages } = get();
    if (!selectedNote || !selectedNote.id) return;
    if (!text.trim() && attachments.length === 0) return;

    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );

    const sessionUser = JSON.parse(localStorage.getItem('user_session_data') || '{}');
    const myName = sessionUser.nickName || sessionUser.username || 'Me';
    const myAvatar = sessionUser.avatarPath || sessionUser.avatar || null;

    const tempId = Date.now();
    const newMsg: IMessage = {
      id: tempId,
      serverId: 0,
      senderId: currentUserId,
      senderName: myName,
      senderAvatar: myAvatar || undefined,
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
      attachments,
    };

    set({ currentChatMessages: [...currentChatMessages, newMsg] });

    try {
      const serverId = await signalRService.sendMessageAsync(
        null,
        null,
        selectedNote.id,
        text,
        null,
        null,
        null,
        null,
        attachments as any
      );

      if (serverId > 0) {
        set((state) => ({
          currentChatMessages: state.currentChatMessages.map((m) =>
            m.id === tempId ? { ...m, serverId, isSentToServer: true } : m
          ),
        }));
      }
    } catch (err) {
      console.error('[NotesStore] Ошибка отправки сообщения заметки:', err);
    }
  },
}));

// Слушатель входящих сообщений заметки через SignalR
eventBus.on('ReceiveMessage' as any, async (incoming: IMessage) => {
  const { selectedNote, currentChatMessages } = useNotesStore.getState();
  if (incoming.noteId && selectedNote && Number(incoming.noteId) === Number(selectedNote.id)) {
    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );
    const isMy = Number(incoming.senderId) === currentUserId;

    let senderName = incoming.senderName;
    let senderAvatar = incoming.senderAvatar;

    if (!senderName || senderName === 'Unknown User') {
      const profile = await fetchUserProfileDeduplicated(Number(incoming.senderId));
      senderName = profile?.nickName || profile?.username || (isMy ? 'Me' : `User ${incoming.senderId}`);
      senderAvatar = profile?.avatarPath || (profile as any)?.avatar;
    }

    const preparedMsg: IMessage = {
      ...incoming,
      isMyMessage: isMy,
      senderName,
      senderAvatar: normalizeAvatarUrl(senderAvatar),
    };

    useNotesStore.setState({
      currentChatMessages: [...currentChatMessages, preparedMsg],
    });
  }
});