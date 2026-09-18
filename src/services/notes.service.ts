import { apiClient } from './apiClient';
import { getLocalDatabase } from '../db/localDb';
import { INote, IMessage } from '../types/models';
import { AttachmentDto } from '../types/dtos';

export class NotesService {
  public static async getRemoteNotesAsync(): Promise<INote[]> {
    try {
      const res = await apiClient.get<INote[]>('api/Notes');
      return res.data || [];
    } catch {
      return [];
    }
  }

  public static async upsertNoteAsync(note: INote): Promise<INote | null> {
    try {
      const res = await apiClient.post<INote>('api/Notes/upsert', note);
      return res.data || null;
    } catch {
      return null;
    }
  }

  public static async deleteNoteAsync(noteId: number): Promise<boolean> {
    try {
      const res = await apiClient.delete(`api/Notes/${noteId}`);
      return res.status >= 200 && res.status < 300;
    } catch {
      return false;
    }
  }

  public static async getLocalNotesAsync(userId: number): Promise<INote[]> {
    const db = getLocalDatabase(userId);
    return await db.notes.where('userId').equals(userId).reverse().sortBy('lastEditedTime');
  }

  public static async saveLocalNoteAsync(note: INote, userId: number): Promise<number> {
    const db = getLocalDatabase(userId);
    note.userId = userId;
    if (note.id && note.id > 0) {
      await db.notes.put(note);
      return note.id;
    }
    const id = await db.notes.add(note);
    note.id = id;
    return id;
  }

  public static async deleteLocalNoteAsync(noteId: number, userId: number): Promise<void> {
    const db = getLocalDatabase(userId);
    await db.notes.delete(noteId);
    await db.messages.where('noteId').equals(noteId).delete();
  }

  public static async getLocalNoteMessagesAsync(noteId: number, userId: number): Promise<IMessage[]> {
    const db = getLocalDatabase(userId);
    return await db.messages.where('noteId').equals(noteId).sortBy('timestamp');
  }

  public static async saveLocalNoteMessageAsync(message: IMessage, userId: number): Promise<number> {
    const db = getLocalDatabase(userId);
    return await db.messages.add(message);
  }

  public static async syncNotesAsync(userId: number): Promise<void> {
    try {
      const remote = await this.getRemoteNotesAsync();
      const db = getLocalDatabase(userId);
      const local = await db.notes.where('userId').equals(userId).toArray();
      const remoteIds = new Set(remote.map((r) => r.id));

      for (const rNote of remote) {
        rNote.userId = userId;
        await db.notes.put(rNote);
      }

      // Удаление локальных, которых больше нет на сервере
      for (const lNote of local) {
        if (lNote.id && !remoteIds.has(lNote.id)) {
          await db.notes.delete(lNote.id);
        }
      }
    } catch (e) {
      console.error('[NotesService ERROR] Ошибка синхронизации заметок:', e);
    }
  }

  public static async uploadAttachmentAsync(file: File | Blob, fileName: string): Promise<AttachmentDto[] | null> {
    try {
      const formData = new FormData();
      formData.append('files', file, fileName);
      const res = await apiClient.post<AttachmentDto[]>('api/Messages/upload-attachments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data || null;
    } catch {
      return null;
    }
  }
}