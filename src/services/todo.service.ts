import { apiClient } from './apiClient';
import { ITodoList, ITodoTask } from '../types/models';
import { TaskCategory, TaskPriority, TaskStatus } from '../types/enums';
import { AiParseTaskResultDto, AiSubtaskDto } from '../types/dtos';

function toPriorityInt(p: any): number {
  if (typeof p === 'number') return p;
  if (typeof p === 'string') {
    const val = TaskPriority[p as keyof typeof TaskPriority];
    return typeof val === 'number' ? val : 0;
  }
  return 0;
}

function toStatusInt(s: any): number {
  if (typeof s === 'number') return s;
  if (typeof s === 'string') {
    const val = TaskStatus[s as keyof typeof TaskStatus];
    return typeof val === 'number' ? val : 0;
  }
  return 0;
}

function toCategoryInt(c: any): number {
  if (typeof c === 'number') return c;
  if (typeof c === 'string') {
    const val = TaskCategory[c as keyof typeof TaskCategory];
    return typeof val === 'number' ? val : 0;
  }
  return 0;
}

export class TodoService {
  public static async syncFromServerAsync(): Promise<{ lists: ITodoList[]; tasks: ITodoTask[] }> {
    try {
      const response = await apiClient.get<any[]>('api/Tasks/sync');
      if (response.status === 200 && Array.isArray(response.data)) {
        const parsedLists: ITodoList[] = [];
        const parsedTasks: ITodoTask[] = [];

        for (const sList of response.data) {
          const listId: number = Number(sList.id || sList.serverId || Date.now());
          const listObj: ITodoList = {
            localId: listId,
            serverId: sList.id || sList.serverId || 0,
            listName: sList.listName || 'Untitled List',
            iconKind: sList.iconKind || 'ClipboardListOutline',
            iconColor: sList.iconColor || '#8B95A5',
            uncompletedCount: 0,
            priority: TaskPriority.None,
            status: TaskStatus.Todo,
            isSynced: true,
            urgencyLevel: 3,
            urgencyColor: '#6B7280',
          };
          parsedLists.push(listObj);

          if (sList.tasks && Array.isArray(sList.tasks)) {
            for (const sTask of sList.tasks) {
              const taskId: number = Number(sTask.id || sTask.serverId || Date.now() + Math.random());
              const priorityVal: TaskPriority = toPriorityInt(sTask.priority);
              const statusVal: TaskStatus = toStatusInt(sTask.status);
              const categoryVal: TaskCategory = toCategoryInt(sTask.category);

              parsedTasks.push({
                localId: taskId,
                serverId: sTask.id || sTask.serverId || taskId,
                localListId: listId,
                title: sTask.title || 'Untitled Task',
                description: sTask.description || '',
                isCompleted: Boolean(sTask.isCompleted),
                isImportant: Boolean(sTask.isImportant),
                dueDate: sTask.dueDate || null,
                priority: priorityVal,
                status: statusVal,
                category: categoryVal,
                isSynced: true,
              });
            }
          }
        }

        return { lists: parsedLists, tasks: parsedTasks };
      }
    } catch (ex) {
      console.error('[TodoService ERROR] Сбой при синхронизации задач с сервером:', ex);
    }
    return { lists: [], tasks: [] };
  }

  public static async createListAsync(name: string): Promise<ITodoList> {
    const newList: ITodoList = {
      localId: Date.now(),
      serverId: 0,
      listName: name,
      iconKind: 'ClipboardListOutline',
      iconColor: '#8B95A5',
      uncompletedCount: 0,
      priority: TaskPriority.None,
      status: TaskStatus.Todo,
      isSynced: false,
      urgencyLevel: 3,
      urgencyColor: '#6B7280',
    };

    try {
      const response = await apiClient.post<{ id: number }>('api/Tasks/list', {
        ListName: name,
        IconKind: newList.iconKind,
        IconColor: newList.iconColor,
      });
      const returnedId = response.data?.id || (response.data as any)?.Id;
      if (returnedId) {
        newList.serverId = returnedId;
        newList.localId = returnedId;
        newList.isSynced = true;
      }
    } catch (ex) {
      console.error('[TodoService ERROR] Ошибка создания списка на сервере:', ex);
    }

    return newList;
  }

  public static async updateListAsync(list: ITodoList): Promise<void> {
    const targetId = list.serverId || list.localId;
    if (!targetId) return;

    try {
      await apiClient.put(`api/Tasks/list/${targetId}`, {
        ListName: list.listName,
        IconKind: list.iconKind,
        IconColor: list.iconColor,
      });
    } catch (ex) {
      console.error(`[TodoService ERROR] Ошибка обновления списка ListId=${targetId}:`, ex);
    }
  }

  public static async deleteListAsync(list: ITodoList): Promise<void> {
    const targetId = list.serverId || list.localId;
    if (!targetId) return;

    try {
      await apiClient.delete(`api/Tasks/list/${targetId}`);
    } catch (ex) {
      console.error(`[TodoService ERROR] Ошибка удаления списка ListId=${targetId}:`, ex);
    }
  }

  public static async createTaskAsync(title: string, list: ITodoList, dueDate: string | null): Promise<ITodoTask> {
    const targetListId = list.serverId || list.localId || 1;
    const newTask: ITodoTask = {
      localId: Date.now(),
      serverId: 0,
      localListId: list.localId!,
      title,
      description: '',
      isCompleted: false,
      isImportant: false,
      dueDate,
      category: TaskCategory.None,
      priority: TaskPriority.None,
      status: TaskStatus.Todo,
      isSynced: false,
    };

    try {
      const response = await apiClient.post<{ id: number }>('api/Tasks/task', {
        ListId: targetListId,
        listId: targetListId,
        Title: title,
        title: title,
        DueDate: dueDate,
        dueDate: dueDate,
      });
      const returnedId = response.data?.id || (response.data as any)?.Id || (response.data as any)?.serverId;
      if (returnedId) {
        newTask.serverId = returnedId;
        newTask.localId = returnedId;
        newTask.isSynced = true;
      }
    } catch (ex) {
      console.error('[TodoService ERROR] Ошибка создания задачи на сервере:', ex);
    }

    return newTask;
  }

  // 🟢 1 в 1 с UpdateTaskAsync из C#: правильные типы полей, id и int-значения перечислений
  public static async updateTaskAsync(task: ITodoTask): Promise<boolean> {
    const serverId = task.serverId || (task as any).id || task.localId;
    if (!serverId) {
      console.warn('[TodoService] Пропуск обновления: отсутствует ServerId задачи', task);
      return false;
    }

    try {
      const payload = {
        id: serverId,
        serverId: serverId,
        localListId: task.localListId,
        listId: task.localListId,
        title: task.title,
        description: task.description || '',
        isCompleted: Boolean(task.isCompleted),
        isImportant: Boolean(task.isImportant),
        dueDate: task.dueDate || null,
        priority: toPriorityInt(task.priority),
        status: toStatusInt(task.status),
        category: toCategoryInt(task.category),
      };

      const response = await apiClient.put(`api/Tasks/task/${serverId}`, payload);
      const isOk = response.status >= 200 && response.status < 300;
      if (!isOk) {
        console.warn(`[TodoService] Сервер вернул код ${response.status} при обновлении задачи ${serverId}`);
      }
      return isOk;
    } catch (ex: any) {
      console.error(`[TodoService ERROR] Сбой обновления задачи TaskId=${serverId}:`, ex.response?.data || ex.message);
      return false;
    }
  }

  public static async deleteTaskAsync(task: ITodoTask): Promise<void> {
    const serverId = task.serverId || (task as any).id || task.localId;
    if (!serverId) return;

    try {
      await apiClient.delete(`api/Tasks/task/${serverId}`);
    } catch (ex) {
      console.error(`[TodoService ERROR] Ошибка удаления задачи TaskId=${serverId}:`, ex);
    }
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