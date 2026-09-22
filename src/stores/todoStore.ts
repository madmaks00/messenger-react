import { create } from 'zustand';
import { TodoService } from '../services/todo.service';
import { ITodoList, ITodoTask, ISelectableItem } from '../types/models';
import { TaskCategory, TaskPriority, TaskStatus } from '../types/enums';
import { eventBus } from '../services/eventBus';

export interface TodoState {
  listSearchText: string;
  myTaskLists: ITodoList[];
  smartTaskLists: ITodoList[];
  allTasks: ITodoTask[];
  newTaskCategoryString: string;
  newTaskPriorityString: string;
  newTaskStatusString: string;
  selectedTaskList: ITodoList | null;
  visibleTasks: ITodoTask[];
  hasDueTasks: boolean;
  newTaskText: string;
  newListName: string;
  taskSearchText: string;
  newTaskDueDate: string | null;
  currentTaskFilter: string;
  isAiParseEnabled: boolean;

  initialize: () => Promise<void>;
  initializeAsync: () => Promise<void>;
  resetAndLoadAsync: () => Promise<void>;
  setTaskFilter: (filter: string) => Promise<void>;
  selectTaskList: (list: ITodoList | null) => Promise<void>;
  setListSearchText: (value: string) => void;
  setTaskSearchText: (value: string) => void;
  clearTaskSearch: () => void;
  setNewTaskText: (value: string) => void;
  setNewTaskDueDate: (date: string | null) => void;
  setNewTaskCategoryString: (cat: string) => void;
  setNewTaskPriorityString: (pri: string) => void;
  setNewTaskStatusString: (status: string) => void;
  toggleAiParse: () => void;

  addTask: () => Promise<void>;
  updateTask: (task: ITodoTask) => Promise<void>;
  updateTaskProperty: (task: ITodoTask) => Promise<void>;
  deleteTask: (task: ITodoTask) => Promise<void>;
  beginEditTask: (task: ITodoTask) => void;
  commitEditTask: (task: ITodoTask) => Promise<void>;

  decomposeTaskWithAi: (task: ITodoTask) => Promise<void>;
  acceptDraftSubtasks: (task: ITodoTask) => Promise<void>;
  rejectDraftSubtasks: (task: ITodoTask) => void;

  createNewTaskList: () => Promise<void>;
  deleteTaskList: (list: ITodoList) => void;
  beginEditList: (list: ITodoList) => void;
  cancelEditList: (list: ITodoList) => void;
  commitEditList: (list: ITodoList) => Promise<void>;
  openEditListDialog: (list: ITodoList) => void;

  refreshTasksUIAsync: () => Promise<void>;
  refreshAllBadgeCountsAsync: () => Promise<void>;
}

const createInitialSmartLists = (): ITodoList[] => [
  { localId: -1, serverId: 0, listName: 'My Day', iconKind: 'WhiteBalanceSunny', iconColor: '#F59E0B', uncompletedCount: 0, priority: TaskPriority.None, status: TaskStatus.Todo, isSynced: true, urgencyLevel: 3, urgencyColor: '#6B7280' },
  { localId: -2, serverId: 0, listName: 'Important', iconKind: 'StarOutline', iconColor: '#EC4899', uncompletedCount: 0, priority: TaskPriority.None, status: TaskStatus.Todo, isSynced: true, urgencyLevel: 3, urgencyColor: '#6B7280' },
  { localId: -3, serverId: 0, listName: 'Tomorrow', iconKind: 'CalendarArrowRight', iconColor: '#3B82F6', uncompletedCount: 0, priority: TaskPriority.None, status: TaskStatus.Todo, isSynced: true, urgencyLevel: 3, urgencyColor: '#6B7280' },
  { localId: -4, serverId: 0, listName: 'This Week', iconKind: 'CalendarWeek', iconColor: '#10B981', uncompletedCount: 0, priority: TaskPriority.None, status: TaskStatus.Todo, isSynced: true, urgencyLevel: 3, urgencyColor: '#6B7280' },
  { localId: -5, serverId: 0, listName: 'Someday', iconKind: 'LightbulbOutline', iconColor: '#8B5CF6', uncompletedCount: 0, priority: TaskPriority.None, status: TaskStatus.Todo, isSynced: true, urgencyLevel: 3, urgencyColor: '#6B7280' },
];

let nextDeadlineTimeoutId: ReturnType<typeof setTimeout> | null = null;

export const useTodoStore = create<TodoState>((set, get) => {
  const initCore = async () => {
    try {
      const { lists, tasks } = await TodoService.syncFromServerAsync();
      set({
        myTaskLists: lists,
        allTasks: tasks,
      });

      await get().refreshAllBadgeCountsAsync();

      const currentSelected = get().selectedTaskList;
      if (!currentSelected && lists.length > 0) {
        await get().selectTaskList(lists[0]);
      } else if (currentSelected) {
        await get().refreshTasksUIAsync();
      }
    } catch (ex) {
      console.error('[TodoStore ERROR] Ошибка синхронизации задач:', ex);
    }
  };

  return {
    listSearchText: '',
    myTaskLists: [],
    smartTaskLists: createInitialSmartLists(),
    allTasks: [],
    newTaskCategoryString: 'Auto',
    newTaskPriorityString: 'None',
    newTaskStatusString: 'Todo',
    selectedTaskList: null,
    visibleTasks: [],
    hasDueTasks: false,
    newTaskText: '',
    newListName: '',
    taskSearchText: '',
    newTaskDueDate: null,
    currentTaskFilter: 'All',
    isAiParseEnabled: true,

    initialize: initCore,
    initializeAsync: initCore,

    resetAndLoadAsync: async () => {
      if (nextDeadlineTimeoutId) {
        clearTimeout(nextDeadlineTimeoutId);
        nextDeadlineTimeoutId = null;
      }
      set({
        myTaskLists: [],
        allTasks: [],
        visibleTasks: [],
        selectedTaskList: null,
        newTaskText: '',
        smartTaskLists: createInitialSmartLists(),
      });
      await initCore();
    },

    setTaskFilter: async (filter: string) => {
      set({ currentTaskFilter: filter });
      await get().refreshTasksUIAsync();
    },

    selectTaskList: async (list: ITodoList | null) => {
      if (!list) return;

      set((state) => ({
        selectedTaskList: list,
        myTaskLists: state.myTaskLists.map((l) => ({ ...l, isSelected: l.localId === list.localId })),
        smartTaskLists: state.smartTaskLists.map((l) => ({ ...l, isSelected: l.localId === list.localId })),
      }));

      await get().refreshTasksUIAsync();
    },

    setListSearchText: (value: string) => set({ listSearchText: value }),
    setTaskSearchText: (value: string) => set({ taskSearchText: value }),
    clearTaskSearch: () => set({ taskSearchText: '' }),
    setNewTaskText: (value: string) => set({ newTaskText: value }),
    setNewTaskDueDate: (date: string | null) => set({ newTaskDueDate: date }),
    setNewTaskCategoryString: (cat: string) => set({ newTaskCategoryString: cat }),
    setNewTaskPriorityString: (pri: string) => set({ newTaskPriorityString: pri }),
    setNewTaskStatusString: (status: string) => set({ newTaskStatusString: status }),
    toggleAiParse: () => set((state) => ({ isAiParseEnabled: !state.isAiParseEnabled })),

    refreshTasksUIAsync: async () => {
      const { selectedTaskList, currentTaskFilter, allTasks } = get();
      if (!selectedTaskList) return;

      let tasks: ITodoTask[] = [];
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      if (selectedTaskList.localId && selectedTaskList.localId < 0) {
        if (selectedTaskList.localId === -1) {
          tasks = allTasks.filter((t) => t.dueDate?.startsWith(todayStr));
        } else if (selectedTaskList.localId === -2) {
          tasks = allTasks.filter((t) => t.priority === TaskPriority.High);
        } else if (selectedTaskList.localId === -3) {
          const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
          tasks = allTasks.filter((t) => t.dueDate?.startsWith(tomorrow));
        } else if (selectedTaskList.localId === -4) {
          const in7Days = new Date(now.getTime() + 7 * 86400000);
          tasks = allTasks.filter((t) => {
            if (!t.dueDate) return false;
            const d = new Date(t.dueDate);
            return d >= new Date(todayStr) && d <= in7Days;
          });
        } else if (selectedTaskList.localId === -5) {
          tasks = allTasks.filter((t) => t.category === TaskCategory.Someday || !t.dueDate);
        } else {
          tasks = allTasks;
        }
      } else if (selectedTaskList.localId) {
        tasks = allTasks.filter((t) => t.localListId === selectedTaskList.localId);
      }

      if (currentTaskFilter !== 'All') {
        const parsedCat = TaskCategory[currentTaskFilter as keyof typeof TaskCategory];
        if (parsedCat !== undefined) {
          tasks = tasks.filter((t) => t.category === parsedCat);
        }
      }

      // LINQ: OrderBy(t => t.IsCompleted).ThenBy(t => t.DueDate == null).ThenBy(t => t.DueDate).ThenByDescending(t => t.Priority)
      const sortedTasks = [...tasks].sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;

        const aHasDue = Boolean(a.dueDate);
        const bHasDue = Boolean(b.dueDate);
        if (aHasDue !== bHasDue) return aHasDue ? -1 : 1;

        if (a.dueDate && b.dueDate) {
          const timeA = new Date(a.dueDate).getTime();
          const timeB = new Date(b.dueDate).getTime();
          if (timeA !== timeB) return timeA - timeB;
        }

        const priA = typeof a.priority === 'number' ? a.priority : (TaskPriority[a.priority as any] ?? 0);
        const priB = typeof b.priority === 'number' ? b.priority : (TaskPriority[b.priority as any] ?? 0);
        return (priB as number) - (priA as number);
      });

      selectedTaskList.uncompletedCount = tasks.filter((t) => !t.isCompleted).length;
      set({ visibleTasks: sortedTasks });
    },

    addTask: async () => {
      const {
        newTaskText,
        selectedTaskList,
        isAiParseEnabled,
        newTaskDueDate,
        newTaskCategoryString,
        newTaskPriorityString,
        newTaskStatusString,
        myTaskLists,
        allTasks,
      } = get();

      if (!newTaskText.trim()) return;

      const input = newTaskText.trim();
      set({ newTaskText: '' });

      try {
        let aiResult: any = null;
        if (isAiParseEnabled) {
          aiResult = await TodoService.parseTaskWithAiAsync(input);
        }

        const title = aiResult?.title?.trim() ? aiResult.title : input;
        let dueDate: string | null = aiResult?.dueDate ? aiResult.dueDate : newTaskDueDate;
        set({ newTaskDueDate: null });

        let targetList = selectedTaskList;
        const setImportant = selectedTaskList?.localId === -2;

        if (!targetList || (targetList.localId && targetList.localId < 0)) {
          targetList = myTaskLists[0] || (await TodoService.createListAsync('Tasks'));
          if (!myTaskLists.some((l) => l.localId === targetList!.localId)) {
            set((s) => ({ myTaskLists: [...s.myTaskLists, targetList!] }));
          }

          if (selectedTaskList?.localId === -1) {
            dueDate = new Date().toISOString();
          }
        }

        const newTask = await TodoService.createTaskAsync(title, targetList, dueDate);

        let finalCategory: TaskCategory = TaskCategory.None;
        if (aiResult?.category && TaskCategory[aiResult.category as keyof typeof TaskCategory] !== undefined) {
          finalCategory = TaskCategory[aiResult.category as keyof typeof TaskCategory];
        } else if (newTaskCategoryString && newTaskCategoryString !== 'Auto') {
          finalCategory = TaskCategory[newTaskCategoryString as keyof typeof TaskCategory] ?? TaskCategory.None;
        }

        let finalPriority: TaskPriority = TaskPriority.None;
        if (aiResult?.priority && TaskPriority[aiResult.priority as keyof typeof TaskPriority] !== undefined) {
          finalPriority = TaskPriority[aiResult.priority as keyof typeof TaskPriority];
        } else if (newTaskPriorityString && newTaskPriorityString !== 'None') {
          finalPriority = TaskPriority[newTaskPriorityString as keyof typeof TaskPriority] ?? TaskPriority.None;
        }

        if (setImportant) finalPriority = TaskPriority.High;

        let finalStatus: TaskStatus = TaskStatus.Todo;
        if (newTaskStatusString && TaskStatus[newTaskStatusString as keyof typeof TaskStatus] !== undefined) {
          finalStatus = TaskStatus[newTaskStatusString as keyof typeof TaskStatus];
        }

        newTask.category = finalCategory;
        newTask.priority = finalPriority;
        newTask.status = finalStatus;

        await TodoService.updateTaskAsync(newTask);

        set({
          allTasks: [...allTasks, newTask],
          newTaskCategoryString: 'Auto',
          newTaskPriorityString: 'None',
          newTaskStatusString: 'Todo',
        });

        if (!get().selectedTaskList) {
          await get().selectTaskList(targetList);
        } else {
          await get().refreshTasksUIAsync();
          await get().refreshAllBadgeCountsAsync();
        }
      } catch (ex) {
        console.error('[TodoStore ERROR] Ошибка создания задачи:', ex);
      }
    },

    // (внутри метода updateTask стора useTodoStore):
    updateTask: async (task: ITodoTask) => {
      if (!task) return;

      // 1. Немедленное оптимистичное обновление в React стейте
      set((state) => {
        const matches = (t: ITodoTask) =>
          (task.localId && t.localId === task.localId) ||
          (task.serverId && t.serverId === task.serverId);

        return {
          allTasks: state.allTasks.map((t) => (matches(t) ? task : t)),
          visibleTasks: state.visibleTasks.map((t) => (matches(t) ? task : t)),
        };
      });

      // 2. Сетевой PUT-запрос
      await TodoService.updateTaskAsync(task);

      // 3. Пересчет сроков и счетчиков
      await get().refreshAllBadgeCountsAsync();
    },

    updateTaskProperty: async (task: ITodoTask) => {
      await get().updateTask(task);
    },

    beginEditTask: (task: ITodoTask) => {
      if (!task) return;
      set((state) => ({
        visibleTasks: state.visibleTasks.map((t) =>
          t.localId === task.localId ? { ...t, isEditing: true } : t
        ),
      }));
    },

    commitEditTask: async (task: ITodoTask) => {
      if (!task) return;
      const updated = { ...task, isEditing: false };
      await get().updateTask(updated);
    },

    deleteTask: async (task: ITodoTask) => {
      if (!task) return;
      try {
        await TodoService.deleteTaskAsync(task);
        set((state) => ({
          allTasks: state.allTasks.filter((t) => t.localId !== task.localId),
        }));
        await get().refreshTasksUIAsync();
        await get().refreshAllBadgeCountsAsync();
      } catch (ex) {
        console.error('[TodoStore ERROR] Ошибка удаления задачи:', ex);
      }
    },

    decomposeTaskWithAi: async (task: ITodoTask) => {
      if (!task || (task as any).isDecomposing) return;

      set((state) => ({
        visibleTasks: state.visibleTasks.map((t) =>
          t.localId === task.localId ? { ...t, isDecomposing: true } : t
        ),
      }));

      try {
        const subtaskDtos = await TodoService.decomposeTaskWithAiAsync(task.title);
        const draftSubtasks: ISelectableItem[] = subtaskDtos.map((dto) => ({
          text: dto.title,
          isSelected: true,
          category: TaskCategory[dto.category as keyof typeof TaskCategory] ?? TaskCategory.None,
          priority: TaskPriority[dto.priority as keyof typeof TaskPriority] ?? TaskPriority.None,
        }));

        set((state) => ({
          visibleTasks: state.visibleTasks.map((t) =>
            t.localId === task.localId
              ? { ...t, isDecomposing: false, hasDraftSubtasks: draftSubtasks.length > 0, draftSubtasks }
              : t
          ),
        }));
      } catch (ex) {
        console.error('[TodoStore ERROR] Ошибка ИИ-декомпозиции задачи:', ex);
        set((state) => ({
          visibleTasks: state.visibleTasks.map((t) =>
            t.localId === task.localId ? { ...t, isDecomposing: false } : t
          ),
        }));
      }
    },

    acceptDraftSubtasks: async (task: ITodoTask) => {
      const drafts = (task as any).draftSubtasks as ISelectableItem[] | undefined;
      if (!task || !drafts || drafts.length === 0) return;

      try {
        const selectedItems = drafts.filter((s) => s.isSelected);
        const { myTaskLists, selectedTaskList, allTasks } = get();
        const targetList = myTaskLists.find((l) => l.localId === task.localListId) || selectedTaskList;

        if (targetList) {
          const createdTasks: ITodoTask[] = [];
          for (const item of selectedItems) {
            const newSubtask = await TodoService.createTaskAsync(item.text, targetList, task.dueDate || null);
            newSubtask.category = item.category;
            newSubtask.priority = item.priority;
            await TodoService.updateTaskAsync(newSubtask);
            createdTasks.push(newSubtask);
          }

          set({
            allTasks: [...allTasks, ...createdTasks],
            visibleTasks: get().visibleTasks.map((t) =>
              t.localId === task.localId ? { ...t, hasDraftSubtasks: false, draftSubtasks: [] } : t
            ),
          });
        }

        await get().refreshTasksUIAsync();
        await get().refreshAllBadgeCountsAsync();
      } catch (ex) {
        console.error('[TodoStore ERROR] Ошибка сохранения подзадач:', ex);
      }
    },

    rejectDraftSubtasks: (task: ITodoTask) => {
      if (!task) return;
      set((state) => ({
        visibleTasks: state.visibleTasks.map((t) =>
          t.localId === task.localId ? { ...t, hasDraftSubtasks: false, draftSubtasks: [] } : t
        ),
      }));
    },

    createNewTaskList: async () => {
      const { myTaskLists, selectTaskList } = get();
      const name = `Project ${myTaskLists.length + 1}`;
      try {
        const newList = await TodoService.createListAsync(name);
        set((state) => ({ myTaskLists: [...state.myTaskLists, newList] }));
        await selectTaskList(newList);
      } catch (ex) {
        console.error('[TodoStore ERROR] Ошибка создания списка:', ex);
      }
    },

    deleteTaskList: (list: ITodoList) => {
      if (!list) return;

      eventBus.emit('OpenConfirmDialogMessage', {
        title: list.listName,
        message: `Delete '${list.listName}' and all tasks?`,
        avatar: null,
        checkboxText: null,
        confirmButtonText: 'Delete',
        onConfirmAction: async () => {
          try {
            await TodoService.deleteListAsync(list);

            set((state) => {
              const nextLists = state.myTaskLists.filter((l) => l.localId !== list.localId);
              const nextAllTasks = state.allTasks.filter((t) => t.localListId !== list.localId);
              const isCurrentDeleted = state.selectedTaskList?.localId === list.localId;
              return {
                myTaskLists: nextLists,
                allTasks: nextAllTasks,
                selectedTaskList: isCurrentDeleted ? null : state.selectedTaskList,
                visibleTasks: isCurrentDeleted ? [] : state.visibleTasks,
              };
            });

            await get().refreshAllBadgeCountsAsync();
          } catch (ex) {
            console.error('[TodoStore ERROR] Ошибка удаления списка задач:', ex);
          }
        },
      });
    },

    beginEditList: (list: ITodoList) => {
      if (!list) return;
      set((state) => ({
        myTaskLists: state.myTaskLists.map((l) =>
          l.localId === list.localId
            ? { ...l, isEditing: true, editingName: l.listName }
            : { ...l, isEditing: false }
        ),
      }));
    },

    cancelEditList: (list: ITodoList) => {
      if (!list) return;
      set((state) => ({
        myTaskLists: state.myTaskLists.map((l) =>
          l.localId === list.localId ? { ...l, isEditing: false } : l
        ),
      }));
    },

    commitEditList: async (list: ITodoList) => {
      if (!list) return;
      const newName = (list.editingName || list.listName).trim() || 'Unnamed Project';
      const updated = { ...list, listName: newName, isEditing: false };

      try {
        await TodoService.updateListAsync(updated);
        set((state) => ({
          myTaskLists: state.myTaskLists.map((l) => (l.localId === list.localId ? updated : l)),
          selectedTaskList: state.selectedTaskList?.localId === list.localId ? updated : state.selectedTaskList,
        }));
      } catch (ex) {
        console.error('[TodoStore ERROR] Ошибка сохранения имени списка:', ex);
      }
    },

    openEditListDialog: (list: ITodoList) => {
      if (!list) return;
      eventBus.emit('OpenEditTaskListDialogMessage' as any, { list });
    },

    refreshAllBadgeCountsAsync: async () => {
      const { allTasks, smartTaskLists, myTaskLists } = get();
      const now = new Date();
      const nowTime = now.getTime();
      const in3hTime = nowTime + 3 * 3600 * 1000;
      const in24hTime = nowTime + 24 * 3600 * 1000;

      const todayStr = now.toISOString().split('T')[0];
      const tomorrowStr = new Date(nowTime + 86400000).toISOString().split('T')[0];
      const nextWeekDate = new Date(nowTime + 7 * 86400000);

      const updatedSmart = smartTaskLists.map((l) => {
        let count = 0;
        if (l.localId === -1) {
          count = allTasks.filter((t) => !t.isCompleted && t.dueDate?.startsWith(todayStr)).length;
        } else if (l.localId === -2) {
          count = allTasks.filter((t) => !t.isCompleted && t.priority === TaskPriority.High).length;
        } else if (l.localId === -3) {
          count = allTasks.filter((t) => !t.isCompleted && t.dueDate?.startsWith(tomorrowStr)).length;
        } else if (l.localId === -4) {
          count = allTasks.filter((t) => {
            if (t.isCompleted || !t.dueDate) return false;
            const d = new Date(t.dueDate);
            return d >= new Date(todayStr) && d <= nextWeekDate;
          }).length;
        } else if (l.localId === -5) {
          count = allTasks.filter((t) => !t.isCompleted && (t.category === TaskCategory.Someday || !t.dueDate)).length;
        }
        return { ...l, uncompletedCount: count };
      });

      const updatedCustom = myTaskLists.map((list) => {
        const uncompleted = allTasks.filter((t) => t.localListId === list.localId && !t.isCompleted);
        let urgencyLevel = 3;
        let urgencyColor = '#6B7280';

        if (uncompleted.length === 0) {
          urgencyLevel = 3;
          urgencyColor = '#6B7280';
        } else if (uncompleted.some((t) => t.dueDate && new Date(t.dueDate).getTime() <= in3hTime)) {
          urgencyLevel = 0;
          urgencyColor = '#EF4444';
        } else if (uncompleted.some((t) => t.dueDate && new Date(t.dueDate).getTime() <= in24hTime)) {
          urgencyLevel = 1;
          urgencyColor = '#F59E0B';
        } else if (uncompleted.some((t) => Boolean(t.dueDate))) {
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

      updatedCustom.sort((a, b) => {
        if (a.urgencyLevel !== b.urgencyLevel) return a.urgencyLevel - b.urgencyLevel;
        return a.listName.localeCompare(b.listName);
      });

      const hasDue = allTasks.some(
        (t) => !t.isCompleted && t.dueDate && new Date(t.dueDate).getTime() <= in24hTime
      );

      set({
        smartTaskLists: updatedSmart,
        myTaskLists: updatedCustom,
        hasDueTasks: hasDue,
      });

      if (nextDeadlineTimeoutId) {
        clearTimeout(nextDeadlineTimeoutId);
        nextDeadlineTimeoutId = null;
      }
      const upcomingTriggers: number[] = [];
      for (const t of allTasks) {
        if (t.isCompleted || !t.dueDate) continue;
        const tt = new Date(t.dueDate).getTime();
        if (tt - 24 * 3600 * 1000 > nowTime) upcomingTriggers.push(tt - 24 * 3600 * 1000);
        if (tt - 3 * 3600 * 1000 > nowTime) upcomingTriggers.push(tt - 3 * 3600 * 1000);
      }
      if (upcomingTriggers.length > 0) {
        const delay = Math.min(Math.min(...upcomingTriggers) - nowTime, 2147483647);
        nextDeadlineTimeoutId = setTimeout(() => get().refreshAllBadgeCountsAsync(), delay);
      }
    },
  };
});

// Глобальная подписка на создание списка из NavigationRail
if (typeof window !== 'undefined') {
  window.addEventListener('CreateNewTaskList', () => {
    useTodoStore.getState().createNewTaskList();
  });
}
function normalizeTaskDto(dto: any): ITodoTask {
  return {
    localId: Number(dto.id || dto.serverId),
    serverId: Number(dto.id || dto.serverId),
    localListId: Number(dto.listId || dto.localListId),
    title: dto.title || '',
    description: dto.description || '',
    isCompleted: Boolean(dto.isCompleted),
    isImportant: Boolean(dto.isImportant),
    dueDate: dto.dueDate || null,
    priority: typeof dto.priority === 'string'
      ? (TaskPriority[dto.priority as keyof typeof TaskPriority] ?? TaskPriority.None)
      : (dto.priority ?? TaskPriority.None),
    status: typeof dto.status === 'string'
      ? (TaskStatus[dto.status as keyof typeof TaskStatus] ?? TaskStatus.Todo)
      : (dto.status ?? TaskStatus.Todo),
    category: typeof dto.category === 'string'
      ? (TaskCategory[dto.category as keyof typeof TaskCategory] ?? TaskCategory.None)
      : (dto.category ?? TaskCategory.None),
    isSynced: true,
  };
}

// 🟢 Реакция на изменения задач с другого устройства
eventBus.on('TaskCreated', (taskDto: any) => {
  const newTask = normalizeTaskDto(taskDto);
  const { allTasks } = useTodoStore.getState();

  // Если задача уже есть (добавлена оптимистично этим клиентом), обновляем её serverId
  const exists = allTasks.some((t) => t.serverId === newTask.serverId || t.localId === newTask.localId);
  if (!exists) {
    useTodoStore.setState({ allTasks: [...allTasks, newTask] });
    useTodoStore.getState().refreshTasksUIAsync();
    useTodoStore.getState().refreshAllBadgeCountsAsync();
  }
});

eventBus.on('TaskUpdated', (taskDto: any) => {
  const updatedTask = normalizeTaskDto(taskDto);
  const { allTasks } = useTodoStore.getState();

  const nextAllTasks = allTasks.map((t) =>
    (t.serverId && t.serverId === updatedTask.serverId) || (t.localId && t.localId === updatedTask.localId)
      ? { ...t, ...updatedTask }
      : t
  );

  useTodoStore.setState({ allTasks: nextAllTasks });
  useTodoStore.getState().refreshTasksUIAsync();
  useTodoStore.getState().refreshAllBadgeCountsAsync();
});

eventBus.on('TaskDeleted', ({ taskId }) => {
  const { allTasks } = useTodoStore.getState();
  const nextAllTasks = allTasks.filter((t) => t.serverId !== taskId && t.localId !== taskId);

  useTodoStore.setState({ allTasks: nextAllTasks });
  useTodoStore.getState().refreshTasksUIAsync();
  useTodoStore.getState().refreshAllBadgeCountsAsync();
});

// 🟢 Реакция на создание, обновление и удаление списков с другого устройства
eventBus.on('TaskListCreated', (listDto: any) => {
  const listId = Number(listDto.id || listDto.serverId);
  const { myTaskLists } = useTodoStore.getState();

  if (!myTaskLists.some((l) => l.serverId === listId || l.localId === listId)) {
    const newList: ITodoList = {
      localId: listId,
      serverId: listId,
      listName: listDto.listName || 'Untitled List',
      iconKind: listDto.iconKind || 'ClipboardListOutline',
      iconColor: listDto.iconColor || '#8B95A5',
      uncompletedCount: 0,
      priority: TaskPriority.None,
      status: TaskStatus.Todo,
      isSynced: true,
      urgencyLevel: 3,
      urgencyColor: '#6B7280',
    };

    useTodoStore.setState({ myTaskLists: [...myTaskLists, newList] });
    useTodoStore.getState().refreshAllBadgeCountsAsync();
  }
});

eventBus.on('TaskListUpdated', (listDto: any) => {
  const listId = Number(listDto.id || listDto.serverId);
  const { myTaskLists, selectedTaskList } = useTodoStore.getState();

  const nextLists = myTaskLists.map((l) =>
    l.serverId === listId || l.localId === listId
      ? { ...l, listName: listDto.listName, iconKind: listDto.iconKind, iconColor: listDto.iconColor }
      : l
  );

  const nextSelected = selectedTaskList && (selectedTaskList.serverId === listId || selectedTaskList.localId === listId)
    ? { ...selectedTaskList, listName: listDto.listName, iconKind: listDto.iconKind, iconColor: listDto.iconColor }
    : selectedTaskList;

  useTodoStore.setState({ myTaskLists: nextLists, selectedTaskList: nextSelected });
});

eventBus.on('TaskListDeleted', ({ listId }) => {
  const { myTaskLists, allTasks, selectedTaskList } = useTodoStore.getState();

  const nextLists = myTaskLists.filter((l) => l.serverId !== listId && l.localId !== listId);
  const nextTasks = allTasks.filter((t) => t.localListId !== listId);
  const isCurrentDeleted = selectedTaskList && (selectedTaskList.serverId === listId || selectedTaskList.localId === listId);

  useTodoStore.setState({
    myTaskLists: nextLists,
    allTasks: nextTasks,
    selectedTaskList: isCurrentDeleted ? null : selectedTaskList,
  });

  useTodoStore.getState().refreshTasksUIAsync();
  useTodoStore.getState().refreshAllBadgeCountsAsync();
});