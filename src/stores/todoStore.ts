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
  urgencyLevel: number; // 0 = Red (<=3h), 1 = Yellow (<=24h), 2 = Green, 3 = Gray
  urgencyColor: string;
  isSelected?: boolean;
  isEditing?: boolean;
  editingName?: string;
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

  // Форма новой задачи
  newTaskText: string;
  newTaskDueDate: string | null;
  newTaskCategoryString: string;
  newTaskPriorityString: string;
  newTaskStatusString: string;

  // Actions
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

  // Task CRUD & AI
  addTask: () => Promise<void>;
  updateTask: (task: ITodoTask) => Promise<void>;
  deleteTask: (taskId: number) => Promise<void>;
  beginEditTask: (taskId: number) => void;
  commitEditTask: (task: ITodoTask, newTitle: string) => Promise<void>;
  decomposeTaskWithAi: (task: ITodoTask) => Promise<void>;
  acceptDraftSubtasks: (task: ITodoTask) => Promise<void>;
  rejectDraftSubtasks: (task: ITodoTask) => void;

  // List CRUD
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
      const [listsRes, tasksRes] = await Promise.all([
        apiClient.get<ITodoList[]>('api/Todo/lists').catch(() => ({ data: [] })),
        apiClient.get<ITodoTask[]>('api/Todo/tasks').catch(() => ({ data: [] })),
      ]);

      const lists: ITodoList[] = listsRes.data || [];
      const tasks: ITodoTask[] = tasksRes.data || [];

      set({ myTaskLists: lists });
      refreshBadgesAndDeadlines(lists, tasks, set);

      // По умолчанию открываем My Day
      if (!get().selectedTaskList) {
        get().selectTaskList(get().smartTaskLists[0]);
      }
    } catch (e) {
      console.error('[TodoStore] Ошибка инициализации:', e);
    }
  },

  selectTaskList: (list) => {
    set((state) => ({
      selectedTaskList: list,
      myTaskLists: state.myTaskLists.map((l) => ({ ...l, isSelected: l.localId === list.localId })),
      smartTaskLists: state.smartTaskLists.map((l) => ({ ...l, isSelected: l.localId === list.localId })),
    }));
    refreshTasksUI(list, get().currentTaskFilter, set);
  },

  setTaskFilter: (filter) => {
    set({ currentTaskFilter: filter });
    if (get().selectedTaskList) {
      refreshTasksUI(get().selectedTaskList!, filter, set);
    }
  },

  setTaskSearchText: (text) => set({ taskSearchText: text }),
  setListSearchText: (text) => set({ listSearchText: text }),
  setNewTaskText: (text) => set({ newTaskText: text }),
  setNewTaskDueDate: (date) => set({ newTaskDueDate: date }),
  setNewTaskCategoryString: (cat) => set({ newTaskCategoryString: cat }),
  setNewTaskPriorityString: (pri) => set({ newTaskPriorityString: pri }),
  setNewTaskStatusString: (status) => set({ newTaskStatusString: status }),
  toggleAiParse: () => set((state) => ({ isAiParseEnabled: !state.isAiParseEnabled })),

  addTask: async () => {
    const { newTaskText, selectedTaskList, isAiParseEnabled, newTaskDueDate, newTaskCategoryString, newTaskPriorityString, newTaskStatusString } = get();
    if (!newTaskText.trim() || !selectedTaskList) return;

    const input = newTaskText.trim();
    set({ newTaskText: '' });

    let parsedTitle = input;
    let dueDate: string | null = newTaskDueDate;
    let category: TaskCategory = (newTaskCategoryString !== 'Auto' ? newTaskCategoryString : 'None') as TaskCategory;
    let priority: TaskPriority = (newTaskPriorityString !== 'None' ? newTaskPriorityString : 'None') as TaskPriority;

    if (isAiParseEnabled) {
      try {
        const aiRes = await apiClient.post<{ title: string; dueDate?: string; category?: string; priority?: string }>('api/Todo/ai-parse', { text: input });
        if (aiRes.data) {
          if (aiRes.data.title) parsedTitle = aiRes.data.title;
          if (aiRes.data.dueDate) dueDate = aiRes.data.dueDate;
          if (aiRes.data.category) category = aiRes.data.category as TaskCategory;
          if (aiRes.data.priority) priority = aiRes.data.priority as TaskPriority;
        }
      } catch {}
    }

    if (selectedTaskList.localId === -1) dueDate = new Date().toISOString().split('T')[0];
    if (selectedTaskList.localId === -2) priority = 'High';

    let targetListId = selectedTaskList.localId;
    if (targetListId < 0) {
      targetListId = get().myTaskLists[0]?.localId || 1;
    }

    const newTask: ITodoTask = {
      localId: Date.now(),
      localListId: targetListId,
      title: parsedTitle,
      dueDate,
      category,
      priority,
      status: (newTaskStatusString as TaskStatus) || 'Todo',
      isCompleted: false,
    };

    try {
      const res = await apiClient.post<ITodoTask>('api/Todo/tasks', newTask);
      if (res.data?.localId) newTask.localId = res.data.localId;
    } catch {}

    const updatedTasks = [...get().visibleTasks, newTask];
    set({
      visibleTasks: updatedTasks,
      newTaskCategoryString: 'Auto',
      newTaskPriorityString: 'None',
      newTaskStatusString: 'Todo',
      newTaskDueDate: null,
    });

    refreshBadgesAndDeadlines(get().myTaskLists, updatedTasks, set);
  },

  updateTask: async (task) => {
    const updated = get().visibleTasks.map((t) => (t.localId === task.localId ? task : t));
    set({ visibleTasks: updated });
    refreshBadgesAndDeadlines(get().myTaskLists, updated, set);
    try {
      await apiClient.put(`api/Todo/tasks/${task.localId}`, task);
    } catch {}
  },

  deleteTask: async (taskId) => {
    const updated = get().visibleTasks.filter((t) => t.localId !== taskId);
    set({ visibleTasks: updated });
    refreshBadgesAndDeadlines(get().myTaskLists, updated, set);
    try {
      await apiClient.delete(`api/Todo/tasks/${taskId}`);
    } catch {}
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
      const res = await apiClient.post<any[]>('api/Todo/ai-decompose', { title: task.title });
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

    const newCreated: ITodoTask[] = [];
    for (const sub of selected) {
      const subTask: ITodoTask = {
        localId: Date.now() + Math.random(),
        localListId: task.localListId,
        title: sub.text,
        dueDate: task.dueDate,
        category: sub.category,
        priority: sub.priority,
        status: 'Todo',
        isCompleted: false,
      };
      newCreated.push(subTask);
      apiClient.post('api/Todo/tasks', subTask).catch(() => {});
    }

    const updated = get().visibleTasks
      .map((t) => (t.localId === task.localId ? { ...t, hasDraftSubtasks: false, draftSubtasks: [] } : t))
      .concat(newCreated);

    set({ visibleTasks: updated });
    refreshBadgesAndDeadlines(get().myTaskLists, updated, set);
  },

  rejectDraftSubtasks: (task) => {
    set((state) => ({
      visibleTasks: state.visibleTasks.map((t) => (t.localId === task.localId ? { ...t, hasDraftSubtasks: false, draftSubtasks: [] } : t)),
    }));
  },

  createNewTaskList: async () => {
    const count = get().myTaskLists.length + 1;
    const newList: ITodoList = {
      localId: Date.now(),
      listName: `Project ${count}`,
      iconKind: 'FormatListBulleted',
      iconColor: '#3B82F6',
      uncompletedCount: 0,
      urgencyLevel: 3,
      urgencyColor: '#6B7280',
    };

    try {
      const res = await apiClient.post<ITodoList>('api/Todo/lists', newList);
      if (res.data?.localId) newList.localId = res.data.localId;
    } catch {}

    const updated = [...get().myTaskLists, newList];
    set({ myTaskLists: updated });
    get().selectTaskList(newList);
  },

  deleteTaskList: async (list) => {
    const updatedLists = get().myTaskLists.filter((l) => l.localId !== list.localId);
    const updatedTasks = get().visibleTasks.filter((t) => t.localListId !== list.localId);
    set({
      myTaskLists: updatedLists,
      visibleTasks: updatedTasks,
      selectedTaskList: get().selectedTaskList?.localId === list.localId ? null : get().selectedTaskList,
    });
    try {
      await apiClient.delete(`api/Todo/lists/${list.localId}`);
    } catch {}
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
    const updated = get().myTaskLists.map((l) => (l.localId === listId ? { ...l, listName: finalName, isEditing: false } : l));
    set({ myTaskLists: updated });
    try {
      await apiClient.put(`api/Todo/lists/${listId}`, { listName: finalName });
    } catch {}
  },
}));

// Логика расчета срочности и бейджей дедлайнов (SafeRefreshBadgeCountsAsync из C#)
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
      urgencyColor = '#EF4444'; // Red
    } else if (uncompleted.some((t) => t.dueDate && new Date(t.dueDate) <= in24h)) {
      urgencyLevel = 1;
      urgencyColor = '#F59E0B'; // Yellow
    } else if (uncompleted.some((t) => t.dueDate)) {
      urgencyLevel = 2;
      urgencyColor = '#10B981'; // Green
    }

    return {
      ...list,
      uncompletedCount: uncompleted.length,
      urgencyLevel,
      urgencyColor,
    };
  });

  const hasDueTasks = allTasks.some((t) => !t.isCompleted && t.dueDate && new Date(t.dueDate) <= in24h);

  set({
    smartTaskLists: updatedSmart,
    myTaskLists: updatedCustom.sort((a, b) => a.urgencyLevel - b.urgencyLevel || a.listName.localeCompare(b.listName)),
    hasDueTasks,
  });
}

function refreshTasksUI(list: ITodoList, filter: string, set: any) {
  apiClient.get<ITodoTask[]>('api/Todo/tasks').then((res) => {
    let tasks = res.data || [];
    if (list.localId === -1) {
      const today = new Date().toISOString().split('T')[0];
      tasks = tasks.filter((t) => t.dueDate?.startsWith(today));
    } else if (list.localId === -2) {
      tasks = tasks.filter((t) => t.priority === 'High');
    } else if (list.localId > 0) {
      tasks = tasks.filter((t) => t.localListId === list.localId);
    }

    if (filter !== 'All') {
      tasks = tasks.filter((t) => t.category === filter);
    }

    set({
      visibleTasks: tasks.sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted)),
    });
  });
}