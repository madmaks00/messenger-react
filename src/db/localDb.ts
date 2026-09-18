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
    // Каждому аккаунту — изолированная база данных, как было в WPF: $"{userId}_cached.db"
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
  }
}

// Реестр открытых баз данных для поддержки Account Switcher
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