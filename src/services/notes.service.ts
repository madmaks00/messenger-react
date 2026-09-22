import { apiClient, BASE_SERVER_URL } from './apiClient';
import { getLocalDatabase } from '../db/localDb';
import { INote, IMessage } from '../types/models';
import { AttachmentDto } from '../types/dtos';
import { userSession } from './userSession';

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

      for (const lNote of local) {
        if (lNote.id && !remoteIds.has(lNote.id)) {
          await db.notes.delete(lNote.id);
        }
      }
    } catch (e) {
      console.error('[NotesService ERROR] Ошибка синхронизации заметок:', e);
    }
  }

  // 🟢 ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ЗАГРУЗКИ ФАЙЛА
  public static async uploadAttachmentAsync(file: File | Blob, fileName: string): Promise<AttachmentDto[] | null> {
    console.log(
      `%c[NOTES DEBUG 🔍] 1. Старт uploadAttachmentAsync для файла: "${fileName}" (Размер: ${file.size} байт, тип: ${file.type})`,
      'color: #00AFF4; font-weight: bold;'
    );

    try {
      const formData = new FormData();
      formData.append('files', file, fileName);

      const token = userSession.token || localStorage.getItem('jwt_token') || localStorage.getItem('auth_token') || '';
      const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
      const base = (BASE_SERVER_URL || 'https://localhost:7214').replace(/\/+$/, '');
      const uploadUrl = `${base}/api/Messages/upload-attachments`;

      console.log(`%c[NOTES DEBUG 🔍] 2. Отправка POST ${uploadUrl} (Токен: ${cleanToken ? 'Присутствует' : 'ОТСУТСТВУЕТ!'})`, 'color: #00AFF4;');

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          ...(cleanToken ? { Authorization: `Bearer ${cleanToken}` } : {}),
        },
        body: formData,
      });

      console.log(
        `%c[NOTES DEBUG 🔍] 3. Ответ сервера на загрузку файла: HTTP ${response.status} ${response.statusText}`,
        response.ok ? 'color: #4CAF50; font-weight: bold;' : 'color: #F44336; font-weight: bold;'
      );

      const responseText = await response.text();
      console.log(`%c[NOTES DEBUG 🔍] 4. Сырое тело ответа сервера:`, 'color: #9C27B0;', responseText);

      if (response.ok) {
        const dtos: AttachmentDto[] = JSON.parse(responseText);
        console.log(`%c[NOTES DEBUG ✅] 5. Файл успешно принят сервером! Получены DTO:`, 'color: #4CAF50; font-weight: bold;', dtos);
        return dtos;
      } else {
        console.error(`[NOTES DEBUG ❌] Сервер отклонил файл! Код: ${response.status}. Ответ:`, responseText);
        return null;
      }
    } catch (err: any) {
      console.error('[NOTES DEBUG ❌] Сетевое исключение в uploadAttachmentAsync:', err);
      return null;
    }
  }
}