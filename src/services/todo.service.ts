import { apiClient } from './apiClient';
import { userSession } from './userSession';
import { eventBus } from './eventBus';
import { ITodoList, ITodoTask } from '../types/models';
import { TaskCategory, TaskPriority, TaskStatus } from '../types/enums';
import { AiParseTaskResultDto, AiSubtaskDto } from '../types/dtos';

type Operation = { key: string; kind: 'list' | 'task'; action: 'create' | 'update' | 'delete'; entity: any };
type Saved = { operations: Operation[]; ids: Record<string, number>; lists: ITodoList[]; tasks: ITodoTask[] };
const keyFor = (userId: number) => `todo-outbox-v1:${userId}`;
const read = (userId: number): Saved => {
  const raw = localStorage.getItem(keyFor(userId));
  return raw ? JSON.parse(raw) : { operations: [], ids: {}, lists: [], tasks: [] };
};
const save = (userId: number, data: Saved) => localStorage.setItem(keyFor(userId), JSON.stringify(data));
const numberValue = (value: any, values: any) => typeof value === 'number' ? value : values[value] ?? 0;
const listPayload = (list: ITodoList) => ({ listName: list.listName, iconKind: list.iconKind, iconColor: list.iconColor });
const taskPayload = (task: ITodoTask, listId: number) => ({ listId, title: task.title, description: task.description || '',
  dueDate: task.dueDate || null, isCompleted: Boolean(task.isCompleted), isImportant: Boolean(task.isImportant),
  priority: numberValue(task.priority, TaskPriority), status: numberValue(task.status, TaskStatus), category: numberValue(task.category, TaskCategory) });
const mapKey = (kind: string, localId: number) => `${kind}:${localId}`;
const resolveId = (data: Saved, kind: string, entity: any) => entity.serverId || data.ids[mapKey(kind, entity.localId)] || 0;
const flights = new Map<number, Promise<void>>();
const retries = new Map<number, ReturnType<typeof setTimeout>>();
const backoffs = new Map<number, number>();

function enqueue(userId: number, kind: Operation['kind'], action: Operation['action'], entity: any) {
  if (userId <= 0) throw new Error('Task session is not initialized');
  const data = read(userId);
  const entityId = resolveId(data, kind, entity);
  const index = data.operations.findIndex(o => o.kind === kind && (o.entity.localId === entity.localId || (entityId > 0 && resolveId(data, kind, o.entity) === entityId)));
  if (index >= 0) {
    const previous = data.operations[index];
    if (action === 'delete' && previous.action === 'create' && !flights.has(userId)) {
      data.operations.splice(index, 1);
      if (kind === 'list') data.operations = data.operations.filter(o => o.kind !== 'task' || o.entity.localListId !== entity.localId);
    } else data.operations[index] = { ...previous, action: action === 'update' ? previous.action : action, entity: { ...entity } };
  } else data.operations.push({ key: crypto.randomUUID(), kind, action, entity: { ...entity } });
  if (kind === 'list') {
    data.lists = data.lists.filter(l => l.localId !== entity.localId && (!entityId || resolveId(data, 'list', l) !== entityId));
    if (action !== 'delete') data.lists.push({ ...entity });
    else data.tasks = data.tasks.filter(t => t.localListId !== entity.localId);
  } else {
    data.tasks = data.tasks.filter(t => t.localId !== entity.localId && (!entityId || resolveId(data, 'task', t) !== entityId));
    if (action !== 'delete') data.tasks.push({ ...entity });
  }
  save(userId, data);
}

async function flush(userId: number): Promise<void> {
  const active = flights.get(userId); if (active) return active;
  const running = (async () => {
    let changed = false;
    while (userSession.userId === userId && navigator.onLine) {
      const data = read(userId); const op = data.operations[0]; if (!op) {
        backoffs.delete(userId);
        if (changed) eventBus.emit('TodoOutboxFlushedMessage' as any, { userId });
        return;
      }
      try {
        const id = resolveId(data, op.kind, op.entity);
        const payload = op.kind === 'list' ? listPayload(op.entity) : taskPayload(op.entity,
          data.ids[mapKey('list', op.entity.localListId)] || op.entity.localListId);
        if (op.action === 'delete') {
          if (id) await apiClient.delete(`api/Tasks/${op.kind}/${id}`);
        } else if (op.action === 'create' && !id) {
          const result = await apiClient.post(`api/Tasks/${op.kind}`, { ...payload, clientRequestId: op.key });
          const createdId = Number(result.data.id || result.data.Id); if (!createdId) throw new Error('Missing task acknowledgement');
          const latest = read(userId); latest.ids[mapKey(op.kind, op.entity.localId)] = createdId; save(userId, latest);
          // Create is replayable; PUT preserves all edits made while creation was pending.
          if (userSession.userId !== userId) return;
          if (op.kind === 'task') await apiClient.put(`api/Tasks/task/${createdId}`, payload);
        } else {
          if (!id) throw new Error('Task has no server ID');
          await apiClient.put(`api/Tasks/${op.kind}/${id}`, payload);
        }
        changed = true;
        const latest = read(userId);
        const current = latest.operations.findIndex(o => o.key === op.key);
        // Do not discard a newer edit that arrived while the request was running.
        if (current >= 0 && JSON.stringify(latest.operations[current]) === JSON.stringify(op)) latest.operations.splice(current, 1);
        save(userId, latest);
      } catch (error: any) {
        if (op.action === 'delete' && error.response?.status === 404) {
          const latest = read(userId); latest.operations = latest.operations.filter(o => o.key !== op.key); save(userId, latest); continue;
        }
        const status = error.response?.status;
        if ((!status || status === 429 || status >= 500) && navigator.onLine && userSession.userId === userId && !retries.has(userId)) {
          const delay = Math.min(30000, (backoffs.get(userId) || 500) * 2);
          backoffs.set(userId, delay);
          retries.set(userId, setTimeout(() => {
            retries.delete(userId);
            if (userSession.userId === userId) void flush(userId);
          }, delay + Math.floor(Math.random() * 300)));
        }
        console.warn('[TodoService] Pending operation retained for retry', status || 'offline');
        return;
      }
    }
  })();
  flights.set(userId, running); try { await running; } finally { flights.delete(userId); }
}

function overlay(data: Saved) {
  let lists = data.lists.map(l => {
    const id = resolveId(data, 'list', l); return { ...l, localId: id || l.localId, serverId: id };
  }), tasks = data.tasks.map(t => {
    const id = resolveId(data, 'task', t); return { ...t, localId: id || t.localId, serverId: id,
      localListId: data.ids[mapKey('list', t.localListId)] || t.localListId };
  });
  lists = [...new Map(lists.map(l => [l.localId, l])).values()];
  tasks = [...new Map(tasks.map(t => [t.localId, t])).values()];
  for (const op of data.operations) {
    const id = resolveId(data, op.kind, op.entity), e = { ...op.entity, localId: id || op.entity.localId, serverId: id, isSynced: false };
    if (op.kind === 'list') {
      lists = lists.filter(l => l.localId !== e.localId && (!id || l.serverId !== id));
      if (op.action !== 'delete') lists.push(e);
      else tasks = tasks.filter(t => t.localListId !== e.localId && t.localListId !== id);
    } else {
      tasks = tasks.filter(t => t.localId !== e.localId && (!id || t.serverId !== id));
      if (op.action !== 'delete') tasks.push({ ...e, localListId: data.ids[mapKey('list', e.localListId)] || e.localListId });
    }
  }
  return { lists, tasks };
}

export class TodoService {
  public static resolveListId(list: ITodoList): number {
    return resolveId(read(userSession.userId), 'list', list) || list.localId || 0;
  }
  public static async syncFromServerAsync(): Promise<{ lists: ITodoList[]; tasks: ITodoTask[] }> {
    const userId = userSession.userId; if (userId <= 0) return { lists: [], tasks: [] };
    await flush(userId);
    if (userSession.userId !== userId) return { lists: [], tasks: [] };
    try {
      const response = await apiClient.get<any[]>('api/Tasks/sync');
      if (userSession.userId !== userId) return { lists: [], tasks: [] };
      const lists: ITodoList[] = [], tasks: ITodoTask[] = [];
      for (const list of response.data) {
        lists.push({ localId: list.id, serverId: list.id, listName: list.listName, iconKind: list.iconKind || 'ClipboardListOutline',
          iconColor: list.iconColor || '#8B95A5', uncompletedCount: 0, priority: TaskPriority.None, status: TaskStatus.Todo,
          isSynced: true, urgencyLevel: 3, urgencyColor: '#6B7280' });
        for (const task of list.tasks || []) tasks.push({ ...task, localId: task.id, serverId: task.id, localListId: list.id, isSynced: true });
      }
      const data = read(userId); data.lists = lists; data.tasks = tasks; save(userId, data);
    } catch { /* Keep the last successful snapshot and every pending edit. */ }
    return overlay(read(userId));
  }

  public static async createListAsync(name: string): Promise<ITodoList> {
    const userId = userSession.userId;
    const list: ITodoList = { localId: Date.now(), serverId: 0, listName: name, iconKind: 'ClipboardListOutline',
      iconColor: '#8B95A5', uncompletedCount: 0, priority: TaskPriority.None, status: TaskStatus.Todo,
      isSynced: false, urgencyLevel: 3, urgencyColor: '#6B7280' };
    enqueue(userId, 'list', 'create', list); await flush(userId);
    const id = resolveId(read(userId), 'list', list); if (id) { list.localId = id; list.serverId = id; list.isSynced = true; }
    return list;
  }
  public static async createTaskAsync(title: string, list: ITodoList, dueDate: string | null): Promise<ITodoTask> {
    const userId = userSession.userId;
    const task: ITodoTask = { localId: Date.now(), serverId: 0, localListId: list.serverId || list.localId!, title, description: '',
      isCompleted: false, isImportant: false, dueDate, category: TaskCategory.None, priority: TaskPriority.None, status: TaskStatus.Todo, isSynced: false };
    enqueue(userId, 'task', 'create', task); await flush(userId);
    const id = resolveId(read(userId), 'task', task); if (id) { task.localId = id; task.serverId = id; task.isSynced = true; }
    return task;
  }
  public static async updateListAsync(list: ITodoList): Promise<void> {
    const userId = userSession.userId; enqueue(userId, 'list', 'update', list); await flush(userId);
  }
  public static async deleteListAsync(list: ITodoList): Promise<void> {
    const userId = userSession.userId; enqueue(userId, 'list', 'delete', list); await flush(userId);
  }
  public static async updateTaskAsync(task: ITodoTask): Promise<boolean> {
    const userId = userSession.userId; enqueue(userId, 'task', 'update', task); await flush(userId);
    const data = read(userId); const id = resolveId(data, 'task', task); if (id) task.serverId = id;
    return !data.operations.some(o => o.kind === 'task' && o.entity.localId === task.localId);
  }
  public static async deleteTaskAsync(task: ITodoTask): Promise<void> {
    const userId = userSession.userId; enqueue(userId, 'task', 'delete', task); await flush(userId);
  }
  public static async parseTaskWithAiAsync(userInput: string): Promise<AiParseTaskResultDto | null> {
    try {
      const response = await apiClient.post<AiParseTaskResultDto>('api/Tasks/ai/parse', { text: userInput });
      if (response.status === 200 && response.data) {
        return response.data;
      }
    } catch (ex) {
      console.error('[TodoService ERROR] Сбой ИИ-парсера задачи:', ex);
    }
    return null;
  }

  public static async decomposeTaskWithAiAsync(taskTitle: string): Promise<AiSubtaskDto[]> {
    try {
      const response = await apiClient.post<AiSubtaskDto[]>('api/Tasks/ai/decompose', { title: taskTitle });
      if (response.status === 200 && response.data && Array.isArray(response.data)) {
        return response.data;
      }
    } catch (ex) {
      console.error('[TodoService ERROR] Сбой ИИ-декомпозиции задачи:', ex);
    }
    return [];
  }
}