import { create } from 'zustand';
import type { INote, IMessage, IAttachment } from '../types/models';
import { NoteShapeType } from '../types/enums';
import { NotesService } from '../services/notes.service';
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

  // Настройки рисования
  noteEditMode: 'Ink' | 'Eraser' | 'Select' | 'Shape';
  brushSize: number;
  brushColor: string;
  selectedShape: NoteShapeType;
  customColor1: string;
  customColor2: string;
  isColorPickerOpen: boolean;

  // Actions
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
    const userId = userSession.userId;
    if (userId <= 0) return;

    await NotesService.syncNotesAsync(userId);
    const notes = await NotesService.getLocalNotesAsync(userId);
    set({ myNotes: notes });

    // Загрузка сохраненных кастомных цветов из localStorage
    const savedColors = localStorage.getItem('notes_custom_colors');
    if (savedColors) {
      try {
        const { c1, c2 } = JSON.parse(savedColors);
        if (c1) set({ customColor1: c1 });
        if (c2) set({ customColor2: c2 });
      } catch {}
    }

    if (notes.length > 0 && !get().selectedNote) {
      get().selectNote(notes[0]);
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

    const userId = userSession.userId;
    if (note.id) {
      const messages = await NotesService.getLocalNoteMessagesAsync(note.id, userId);
      set({ currentChatMessages: messages });
      await signalRService.subscribeToNoteAsync(note.id);
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

    const localId = await NotesService.saveLocalNoteAsync(newNote, userId);
    newNote.id = localId;

    const res = await NotesService.upsertNoteAsync(newNote);
    if (res?.id) {
      newNote.id = res.id;
      await NotesService.saveLocalNoteAsync(newNote, userId);
    }

    const updated = [newNote, ...get().myNotes];
    set({ myNotes: updated });
    await get().selectNote(newNote);
  },

  deleteNote: async (note) => {
    if (!note.id) return;
    const userId = userSession.userId;

    await NotesService.deleteLocalNoteAsync(note.id, userId);
    await NotesService.deleteNoteAsync(note.id);

    const updated = get().myNotes.filter((n) => n.id !== note.id);
    set({
      myNotes: updated,
      selectedNote: get().selectedNote?.id === note.id ? (updated[0] || null) : get().selectedNote,
    });
  },

  commitEditNote: async (note, newTitle) => {
    const finalTitle = newTitle.trim() || 'Unnamed Note';
    const userId = userSession.userId;
    const updatedNote = { ...note, title: finalTitle, lastEditedTime: new Date().toISOString() };

    await NotesService.saveLocalNoteAsync(updatedNote, userId);
    await NotesService.upsertNoteAsync(updatedNote);

    set((state) => ({
      myNotes: state.myNotes.map((n) => (n.id === note.id ? updatedNote : n)),
      selectedNote: state.selectedNote?.id === note.id ? updatedNote : state.selectedNote,
    }));
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
    localStorage.setItem(
      'notes_custom_colors',
      JSON.stringify({ c1: get().customColor1, c2: get().customColor2 })
    );
  },

  setColorPickerOpen: (open) => set({ isColorPickerOpen: open }),

  saveCurrentNoteInkData: async (serializedJson, thumbnailBase64) => {
    const { selectedNote } = get();
    if (!selectedNote || !selectedNote.id) return;

    const userId = userSession.userId;
    const updated: INote = {
      ...selectedNote,
      inkData: serializedJson,
      thumbnail: thumbnailBase64 || selectedNote.thumbnail,
      lastEditedTime: new Date().toISOString(),
    };

    await NotesService.saveLocalNoteAsync(updated, userId);
    await NotesService.upsertNoteAsync(updated);

    set((state) => ({
      selectedNote: updated,
      myNotes: state.myNotes.map((n) => (n.id === updated.id ? updated : n)),
    }));
  },

  sendNoteMessage: async (text, attachments) => {
    const { selectedNote, currentChatMessages } = get();
    if (!selectedNote || !selectedNote.id) return;

    const userId = userSession.userId;
    const newMsg: IMessage = {
      id: 0,
      serverId: 0,
      senderId: userId,
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

    const localId = await NotesService.saveLocalNoteMessageAsync(newMsg, userId);
    newMsg.id = localId;
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

// Прослушивание входящих сообщений заметки по SignalR
eventBus.on('ReceiveMessage', (msg) => {
  const store = useNotesStore.getState();
  if (msg.noteId && store.selectedNote?.id === msg.noteId) {
    useNotesStore.setState({
      currentChatMessages: [...store.currentChatMessages, msg],
    });
  }
});