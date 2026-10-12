import Dexie, { type Table } from 'dexie';
import type {
  IMessage,
  INote,
  ITodoList,
  ITodoTask,
  IAttachment,
  ICachedSecretChat,
  ICachedGroupDetail,
  ICachedBlockStatus,
  ISavedGif,
  ISyncState,
} from '../types/models';

export class AppLocalDatabase extends Dexie {
  public messages!: Table<IMessage, number>;
  public notes!: Table<INote, number>;
  public todoLists!: Table<ITodoList, number>;
  public todoTasks!: Table<ITodoTask, number>;
  public attachments!: Table<IAttachment, number>;
  public cachedSecretChats!: Table<ICachedSecretChat, string>;
  public cachedGroupDetails!: Table<ICachedGroupDetail, number>;
  public cachedBlockStatuses!: Table<ICachedBlockStatus, number>;
  public savedGifs!: Table<ISavedGif, number>;
  public syncStates!: Table<ISyncState, string>;

  constructor(userId: number) {
    const dbName = userId > 0 ? `MessengerCache_${userId}` : 'MessengerCache_Guest';
    super(dbName);

    this.version(1).stores({
      messages: '++id, serverId, senderId, receiverId, groupId, timestamp, secretChatId, [groupId+timestamp], [senderId+receiverId+timestamp], [secretChatId+timestamp]',
      notes: '++id, userId',
      todoLists: '++localId, serverId',
      todoTasks: '++localId, serverId, localListId',
      attachments: '++id, messageId',
      cachedSecretChats: 'secretChatId, targetUserId',
      cachedGroupDetails: 'id, groupLink',
      cachedBlockStatuses: 'targetUserId',
      savedGifs: '++id, serverId',
      syncStates: 'key',
    });

    // 🟢 Версия 2: быстрая выборка закрепов и диапазонов без сканирования всей базы
    this.version(2).stores({
      messages: '++id, serverId, senderId, receiverId, groupId, timestamp, secretChatId, isPinned, [groupId+timestamp], [senderId+receiverId+timestamp], [secretChatId+timestamp]',
    });
    this.version(3).stores({
      messages: '++id, serverId, senderId, receiverId, groupId, timestamp, secretChatId, isPinned, [groupId+timestamp], [senderId+receiverId+timestamp], [secretChatId+timestamp], [groupId+timestamp+serverId], [senderId+receiverId+timestamp+serverId]',
    });

  }
}

let currentDbInstance: AppLocalDatabase | null = null;
let currentActiveUserId: number | null = null;

export function getLocalDatabase(userId: number): AppLocalDatabase {
  if (!currentDbInstance || currentActiveUserId !== userId) {
    if (currentDbInstance) {
      currentDbInstance.close();
    }
    currentActiveUserId = userId;
    currentDbInstance = new AppLocalDatabase(userId);
  }
  return currentDbInstance;
}

export function closeLocalDatabase(): void {
  if (currentDbInstance) {
    currentDbInstance.close();
    currentDbInstance = null;
    currentActiveUserId = null;
  }
}