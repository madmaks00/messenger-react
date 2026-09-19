import { create } from 'zustand';
import { apiClient } from '../services/apiClient';

export type TaskPriority = 'None' | 'Low' | 'Medium' | 'High';
export type TaskStatus = 'Todo' | 'InProgress' | 'Review' | 'Waiting' | 'Blocked';
export type TaskCategory =
  | 'None'
  | 'Work'
  | 'Personal'
  | 'Calls'
  | 'Shopping'
  | 'Health'
  | 'Learning'
  | 'Family'
  | 'Finance'
  | 'Quick'
  | 'DeepWork'
  | 'Someday';

export interface IDraftSubtask {
  text: string;
  isSelected: boolean;
  category: TaskCategory;
  priority: TaskPriority;
}

export interface ITodoTask {
  localId: number;
  serverId?: number;
  localListId: number;
  title: string;
  description?: string;
  dueDate?: string | null;
  priority: TaskPriority;
  category: TaskCategory;
  status: TaskStatus;
  isCompleted: boolean;
  isEditing?: boolean;
  isDecomposing?: boolean;
  hasDraftSubtasks?: boolean;
  draftSubtasks?: IDraftSubtask[];
}

export interface ITodoList {
  localId: number;
  serverId?: number;
  listName: string;
  iconKind: string;
  iconColor: string;
  uncompletedCount: number;
  urgencyLevel: number;
  urgencyColor: string;
  isSelected?: boolean;
  isEditing?: boolean;
  editingName?: string;
  tasks?: ITodoTask[];
}

interface TodoState {
  myTaskLists: ITodoList[];
  smartTaskLists: ITodoList[];
  selectedTaskList: ITodoList | null;
  visibleTasks: ITodoTask[];
  currentTaskFilter: string;
  taskSearchText: string;
  listSearchText: string;
  hasDueTasks: boolean;
  isAiParseEnabled: boolean;

  newTaskText: string;
  newTaskDueDate: string | null;
  newTaskCategoryString: string;
  newTaskPriorityString: string;
  newTaskStatusString: string;

  initialize: () => Promise<void>;
  selectTaskList: (list: ITodoList) => void;
  setTaskFilter: (filter: string) => void;
  setTaskSearchText: (text: string) => void;
  setListSearchText: (text: string) => void;
  setNewTaskText: (text: string) => void;
  setNewTaskDueDate: (date: string | null) => void;
  setNewTaskCategoryString: (cat: string) => void;
  setNewTaskPriorityString: (pri: string) => void;
  setNewTaskStatusString: (status: string) => void;
  toggleAiParse: () => void;

  addTask: () => Promise<void>;
  updateTask: (task: ITodoTask) => Promise<void>;
  deleteTask: (taskId: number) => Promise<void>;
  beginEditTask: (taskId: number) => void;
  commitEditTask: (task: ITodoTask, newTitle: string) => Promise<void>;
  decomposeTaskWithAi: (task: ITodoTask) => Promise<void>;
  acceptDraftSubtasks: (task: ITodoTask) => Promise<void>;
  rejectDraftSubtasks: (task: ITodoTask) => void;

  createNewTaskList: () => Promise<void>;
  deleteTaskList: (list: ITodoList) => Promise<void>;
  beginEditList: (listId: number) => void;
  cancelEditList: (listId: number) => void;
  commitEditList: (listId: number, newName: string) => Promise<void>;
}

const SMART_LISTS_INIT: ITodoList[] = [
  { localId: -1, listName: 'My Day', iconKind: 'WhiteBalanceSunny', iconColor: '#F59E0B', uncompletedCount: 0, urgencyLevel: 3, urgencyColor: '#6B7280' },
  { localId: -2, listName: 'Important', iconKind: 'StarOutline', iconColor: '#EC4899', uncompletedCount: 0, urgencyLevel: 3, urgencyColor: '#6B7280' },
  { localId: -3, listName: 'Tomorrow', iconKind: 'CalendarArrowRight', iconColor: '#3B82F6', uncompletedCount: 0, urgencyLevel: 3, urgencyColor: '#6B7280' },
  { localId: -4, listName: 'This Week', iconKind: 'CalendarWeek', iconColor: '#10B981', uncompletedCount: 0, urgencyLevel: 3, urgencyColor: '#6B7280' },
  { localId: -5, listName: 'Someday', iconKind: 'LightbulbOutline', iconColor: '#8B5CF6', uncompletedCount: 0, urgencyLevel: 3, urgencyColor: '#6B7280' },
];

export const useTodoStore = create<TodoState>((set, get) => ({
  myTaskLists: [],
  smartTaskLists: [...SMART_LISTS_INIT],
  selectedTaskList: null,
  visibleTasks: [],
  currentTaskFilter: 'All',
  taskSearchText: '',
  listSearchText: '',
  hasDueTasks: false,
  isAiParseEnabled: true,

  newTaskText: '',
  newTaskDueDate: null,
  newTaskCategoryString: 'Auto',
  newTaskPriorityString: 'None',
  newTaskStatusString: 'Todo',

  initialize: async () => {
    try {
      // 🟢 ВЫЗОВ ЭНДПОИНТА ИЗ C# TodoService.cs: "api/Tasks/sync"
      const res = await apiClient.get<any[]>('api/Tasks/sync');
      const serverLists = res.data || [];

      const parsedLists: ITodoList[] = [];
      const allExtractedTasks: ITodoTask[] = [];

      for (const sList of serverLists) {
        const listObj: ITodoList = {
          localId: sList.serverId || sList.id || Date.now() + Math.random(),
          serverId: sList.serverId || sList.id,
          listName: sList.listName || 'Untitled List',
          iconKind: sList.iconKind || 'ClipboardListOutline',
          iconColor: sList.iconColor || '#8B95A5',
          uncompletedCount: 0,
          urgencyLevel: 3,
          urgencyColor: '#6B7280',
        };

        if (sList.tasks && Array.isArray(sList.tasks)) {
          for (const sTask of sList.tasks) {
            allExtractedTasks.push({
              localId: sTask.serverId || sTask.id || Date.now() + Math.random(),
              serverId: sTask.serverId || sTask.id,
              localListId: listObj.localId,
              title: sTask.title || 'Untitled Task',
              description: sTask.description || '',
              isCompleted: Boolean(sTask.isCompleted),
              dueDate: sTask.dueDate || null,
              priority: sTask.priority || 'None',
              status: sTask.status || 'Todo',
              category: sTask.category || 'None',
            });
          }
        }
        parsedLists.push(listObj);
      }

      set({ myTaskLists: parsedLists });
      refreshBadgesAndDeadlines(parsedLists, allExtractedTasks, set);

      // Открываем первый проект или смарт-список
      if (parsedLists.length > 0) {
        get().selectTaskList(parsedLists[0]);
      } else {
        get().selectTaskList(get().smartTaskLists[0]);
      }
    } catch (e) {
      console.error('[TodoStore] Ошибка синхронизации api/Tasks/sync:', e);
    }
  },

  selectTaskList: (list) => {
    set((state) => ({
      selectedTaskList: list,
      myTaskLists: state.myTaskLists.map((l) => ({ ...l, isSelected: l.localId === list.localId })),
      smartTaskLists: state.smartTaskLists.map((l) => ({ ...l, isSelected: l.localId === list.localId })),
    }));
  },

  setTaskFilter: (filter) => set({ currentTaskFilter: filter }),
  setTaskSearchText: (text) => set({ taskSearchText: text }),
  setListSearchText: (text) => set({ listSearchText: text }),
  setNewTaskText: (text) => set({ newTaskText: text }),
  setNewTaskDueDate: (date) => set({ newTaskDueDate: date }),
  setNewTaskCategoryString: (cat) => set({ newTaskCategoryString: cat }),
  setNewTaskPriorityString: (pri) => set({ newTaskPriorityString: pri }),
  setNewTaskStatusString: (status) => set({ newTaskStatusString: status }),
  toggleAiParse: () => set((state) => ({ isAiParseEnabled: !state.isAiParseEnabled })),

  addTask: async () => {
    const { newTaskText, selectedTaskList, newTaskDueDate, newTaskCategoryString, newTaskPriorityString, newTaskStatusString } = get();
    if (!newTaskText.trim() || !selectedTaskList) return;

    const input = newTaskText.trim();
    set({ newTaskText: '' });

    let targetListId = selectedTaskList.serverId || selectedTaskList.localId;
    if (targetListId < 0) {
      targetListId = get().myTaskLists[0]?.serverId || 1;
    }

    const payload = {
      listId: targetListId,
      title: input,
      dueDate: newTaskDueDate,
    };

    try {
      // 🟢 ВЫЗОВ C# ЭНДПОИНТА: "api/Tasks/task"
      const res = await apiClient.post<any>('api/Tasks/task', payload);
      const serverId = res.data?.id || Date.now();

      const newTask: ITodoTask = {
        localId: serverId,
        serverId,
        localListId: targetListId,
        title: input,
        dueDate: newTaskDueDate,
        category: (newTaskCategoryString !== 'Auto' ? newTaskCategoryString : 'None') as TaskCategory,
        priority: (newTaskPriorityString !== 'None' ? newTaskPriorityString : 'None') as TaskPriority,
        status: (newTaskStatusString as TaskStatus) || 'Todo',
        isCompleted: false,
      };

      const updatedTasks = [...get().visibleTasks, newTask];
      set({ visibleTasks: updatedTasks });
      refreshBadgesAndDeadlines(get().myTaskLists, updatedTasks, set);
    } catch (err) {
      console.error('[TodoStore] Ошибка создания задачи:', err);
    }
  },

  updateTask: async (task) => {
    const updated = get().visibleTasks.map((t) => (t.localId === task.localId ? task : t));
    set({ visibleTasks: updated });
    refreshBadgesAndDeadlines(get().myTaskLists, updated, set);

    if (task.serverId) {
      try {
        await apiClient.put(`api/Tasks/task/${task.serverId}`, task);
      } catch {}
    }
  },

  deleteTask: async (taskId) => {
    const taskToDelete = get().visibleTasks.find((t) => t.localId === taskId);
    const updated = get().visibleTasks.filter((t) => t.localId !== taskId);
    set({ visibleTasks: updated });
    refreshBadgesAndDeadlines(get().myTaskLists, updated, set);

    if (taskToDelete?.serverId) {
      try {
        await apiClient.delete(`api/Tasks/task/${taskToDelete.serverId}`);
      } catch {}
    }
  },

  beginEditTask: (taskId) => {
    set((state) => ({
      visibleTasks: state.visibleTasks.map((t) => (t.localId === taskId ? { ...t, isEditing: true } : t)),
    }));
  },

  commitEditTask: async (task, newTitle) => {
    const updatedTask = { ...task, title: newTitle.trim() || task.title, isEditing: false };
    await get().updateTask(updatedTask);
  },

  decomposeTaskWithAi: async (task) => {
    set((state) => ({
      visibleTasks: state.visibleTasks.map((t) => (t.localId === task.localId ? { ...t, isDecomposing: true } : t)),
    }));
    try {
      const res = await apiClient.post<any[]>('api/Tasks/ai/decompose', { title: task.title });
      const subtasks: IDraftSubtask[] = (res.data || []).map((d) => ({
        text: d.title || d.text,
        isSelected: true,
        category: (d.category as TaskCategory) || 'None',
        priority: (d.priority as TaskPriority) || 'None',
      }));

      set((state) => ({
        visibleTasks: state.visibleTasks.map((t) =>
          t.localId === task.localId
            ? { ...t, isDecomposing: false, hasDraftSubtasks: subtasks.length > 0, draftSubtasks: subtasks }
            : t
        ),
      }));
    } catch {
      set((state) => ({
        visibleTasks: state.visibleTasks.map((t) => (t.localId === task.localId ? { ...t, isDecomposing: false } : t)),
      }));
    }
  },

  acceptDraftSubtasks: async (task) => {
    if (!task.draftSubtasks) return;
    const selected = task.draftSubtasks.filter((s) => s.isSelected);

    for (const sub of selected) {
      await get().addTask();
    }

    set((state) => ({
      visibleTasks: state.visibleTasks.map((t) =>
        t.localId === task.localId ? { ...t, hasDraftSubtasks: false, draftSubtasks: [] } : t
      ),
    }));
  },

  rejectDraftSubtasks: (task) => {
    set((state) => ({
      visibleTasks: state.visibleTasks.map((t) => (t.localId === task.localId ? { ...t, hasDraftSubtasks: false, draftSubtasks: [] } : t)),
    }));
  },

  createNewTaskList: async () => {
    const count = get().myTaskLists.length + 1;
    const name = `Project ${count}`;

    try {
      // 🟢 ВЫЗОВ C# ЭНДПОИНТА: "api/Tasks/list"
      const res = await apiClient.post<any>('api/Tasks/list', {
        listName: name,
        iconKind: 'ClipboardListOutline',
        iconColor: '#3B82F6',
      });

      const serverId = res.data?.id || Date.now();
      const newList: ITodoList = {
        localId: serverId,
        serverId,
        listName: name,
        iconKind: 'ClipboardListOutline',
        iconColor: '#3B82F6',
        uncompletedCount: 0,
        urgencyLevel: 3,
        urgencyColor: '#6B7280',
      };

      const updated = [...get().myTaskLists, newList];
      set({ myTaskLists: updated });
      get().selectTaskList(newList);
    } catch (e) {
      console.error('[TodoStore] Ошибка создания проекта:', e);
    }
  },

  deleteTaskList: async (list) => {
    const updatedLists = get().myTaskLists.filter((l) => l.localId !== list.localId);
    const updatedTasks = get().visibleTasks.filter((t) => t.localListId !== list.localId);
    set({
      myTaskLists: updatedLists,
      visibleTasks: updatedTasks,
      selectedTaskList: get().selectedTaskList?.localId === list.localId ? null : get().selectedTaskList,
    });

    if (list.serverId) {
      try {
        await apiClient.delete(`api/Tasks/list/${list.serverId}`);
      } catch {}
    }
  },

  beginEditList: (listId) => {
    set((state) => ({
      myTaskLists: state.myTaskLists.map((l) => (l.localId === listId ? { ...l, isEditing: true, editingName: l.listName } : l)),
    }));
  },

  cancelEditList: (listId) => {
    set((state) => ({
      myTaskLists: state.myTaskLists.map((l) => (l.localId === listId ? { ...l, isEditing: false } : l)),
    }));
  },

  commitEditList: async (listId, newName) => {
    const finalName = newName.trim() || 'Unnamed Project';
    const list = get().myTaskLists.find((l) => l.localId === listId);
    const updated = get().myTaskLists.map((l) => (l.localId === listId ? { ...l, listName: finalName, isEditing: false } : l));
    set({ myTaskLists: updated });

    if (list?.serverId) {
      try {
        await apiClient.put(`api/Tasks/list/${list.serverId}`, {
          listName: finalName,
          iconKind: list.iconKind,
          iconColor: list.iconColor,
        });
      } catch {}
    }
  },
}));

function refreshBadgesAndDeadlines(myLists: ITodoList[], allTasks: ITodoTask[], set: any) {
  const now = new Date();
  const in3h = new Date(now.getTime() + 3 * 3600 * 1000);
  const in24h = new Date(now.getTime() + 24 * 3600 * 1000);

  const updatedSmart = [...SMART_LISTS_INIT].map((smart) => {
    let count = 0;
    if (smart.localId === -1) {
      const todayStr = now.toISOString().split('T')[0];
      count = allTasks.filter((t) => !t.isCompleted && t.dueDate?.startsWith(todayStr)).length;
    } else if (smart.localId === -2) {
      count = allTasks.filter((t) => !t.isCompleted && t.priority === 'High').length;
    } else if (smart.localId === -3) {
      const tomStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
      count = allTasks.filter((t) => !t.isCompleted && t.dueDate?.startsWith(tomStr)).length;
    } else if (smart.localId === -4) {
      const nextWeek = new Date(now.getTime() + 7 * 86400000);
      count = allTasks.filter((t) => !t.isCompleted && t.dueDate && new Date(t.dueDate) <= nextWeek).length;
    } else if (smart.localId === -5) {
      count = allTasks.filter((t) => !t.isCompleted && (t.category === 'Someday' || !t.dueDate)).length;
    }
    return { ...smart, uncompletedCount: count };
  });

  const updatedCustom = myLists.map((list) => {
    const uncompleted = allTasks.filter((t) => t.localListId === list.localId && !t.isCompleted);
    let urgencyLevel = 3;
    let urgencyColor = '#6B7280';

    if (uncompleted.length === 0) {
      urgencyLevel = 3;
      urgencyColor = '#6B7280';
    } else if (uncompleted.some((t) => t.dueDate && new Date(t.dueDate) <= in3h)) {
      urgencyLevel = 0;
      urgencyColor = '#EF4444';
    } else if (uncompleted.some((t) => t.dueDate && new Date(t.dueDate) <= in24h)) {
      urgencyLevel = 1;
      urgencyColor = '#F59E0B';
    } else if (uncompleted.some((t) => t.dueDate)) {
      urgencyLevel = 2;
      urgencyColor = '#10B981';
    }

    return {
      ...list,
      uncompletedCount: uncompleted.length,
      urgencyLevel,
      urgencyColor,
    };
  });

  set({
    smartTaskLists: updatedSmart,
    myTaskLists: updatedCustom,
    hasDueTasks: allTasks.some((t) => !t.isCompleted && t.dueDate && new Date(t.dueDate) <= in24h),
  });
}