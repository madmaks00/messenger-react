import { create } from 'zustand';
import type { INote, IMessage, IAttachment } from '../types/models';
import { NoteShapeType } from '../types/enums';
import { apiClient } from '../services/apiClient';
import { userSession } from '../services/userSession';
import { signalRService } from '../services/signalr.service';
import { eventBus } from '../services/eventBus';

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
  sendNoteMessage: (text: string, attachments: IAttachment[]) => Promise<void>;
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
      // 🟢 ВЫЗОВ C# ЭНДПОИНТА: "GET api/Notes" (GetRemoteNotesAsync)
      const res = await apiClient.get<INote[]>('api/Notes');
      const notes = res.data || [];
      set({ myNotes: notes });

      if (notes.length > 0 && !get().selectedNote) {
        get().selectNote(notes[0]);
      }
    } catch (e) {
      console.error('[NotesStore] Ошибка загрузки api/Notes:', e);
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
        // 🟢 ВЫЗОВ C# ЭНДПОИНТА: "api/Notes/{id}/messages"
        const res = await apiClient.get<IMessage[]>(`api/Notes/${note.id}/messages`);
        set({ currentChatMessages: res.data || [] });
        await signalRService?.subscribeToNoteAsync?.(note.id);
      } catch {}
    }
  },

  createNewNote: async () => {
    const userId = userSession.userId;
    const count = get().myNotes.length + 1;
    const newNote: INote = {
      userId,
      title: `New Note ${count}`,
      iconKind: 'BookmarkOutline',
      iconColor: '#3B82F6',
      lastEditedTime: new Date().toISOString(),
    };

    try {
      // 🟢 ВЫЗОВ C# ЭНДПОИНТА: "POST api/Notes/upsert"
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
      // 🟢 ВЫЗОВ C# ЭНДПОИНТА: "DELETE api/Notes/{id}"
      await apiClient.delete(`api/Notes/${note.id}`);
      const updated = get().myNotes.filter((n) => n.id !== note.id);
      set({
        myNotes: updated,
        selectedNote: get().selectedNote?.id === note.id ? (updated[0] || null) : get().selectedNote,
      });
    } catch {}
  },

  commitEditNote: async (note, newTitle) => {
    const finalTitle = newTitle.trim() || 'Unnamed Note';
    const updatedNote = { ...note, title: finalTitle, lastEditedTime: new Date().toISOString() };

    set((state) => ({
      myNotes: state.myNotes.map((n) => (n.id === note.id ? updatedNote : n)),
      selectedNote: state.selectedNote?.id === note.id ? updatedNote : state.selectedNote,
    }));

    try {
      await apiClient.post('api/Notes/upsert', updatedNote);
    } catch {}
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
    } catch {}
  },

  sendNoteMessage: async (text, attachments) => {
    const { selectedNote, currentChatMessages } = get();
    if (!selectedNote || !selectedNote.id) return;

    const newMsg: IMessage = {
      id: Date.now(),
      serverId: 0,
      senderId: userSession.userId,
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
        newMsg.serverId = serverId;
        newMsg.isSentToServer = true;
        set({ currentChatMessages: [...get().currentChatMessages] });
      }
    } catch {}
  },
}));