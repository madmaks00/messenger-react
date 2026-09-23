import React, { useState, useEffect, useRef } from 'react';
import {
  mdiFormatListBulleted,
  mdiFormatListChecks,
  mdiFilterVariant,
  mdiFilterVariantRemove,
  mdiPlusCircleOutline,
  mdiCalendarMonth,
  mdiCalendarBlankOutline,
  mdiTagOutline,
  mdiTagOffOutline,
  mdiFlag,
  mdiFlagOutline,
  mdiListStatus,
  mdiAutoFix,
  mdiBriefcaseOutline,
  mdiAccountOutline,
  mdiPhoneOutline,
  mdiCartOutline,
  mdiHeartPulse,
  mdiSchoolOutline,
  mdiHomeHeart,
  mdiWalletOutline,
  mdiLightningBoltOutline,
  mdiBrain,
  mdiLightbulbOutline,
  mdiPencilOutline,
  mdiTrashCanOutline,
  mdiCheck,
} from '@mdi/js';

import { useTodoStore } from '../../stores/todoStore';
import { useNavigationStore } from '../../stores/navigationStore';
import { SearchInputUserControl } from '../common/SearchInputUserControl';
import { resolveMdiIcon } from '../../utils/iconResolver';
import { ITodoTask, ISelectableItem } from '../../types/models';
import { TaskCategory, TaskPriority, TaskStatus, MainTab } from '../../types/enums';

const MdiIcon: React.FC<{ path: string; size?: number; color?: string; style?: React.CSSProperties }> = ({
  path,
  size = 20,
  color = 'currentColor',
  style,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill={color}
    style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle', ...style }}
  >
    <path d={path} />
  </svg>
);

const NEON_FILTERS = [
  { key: 'All', label: 'All Tasks', icon: mdiFormatListChecks, glow: '#60A5FA', activeBg: '#152A4A' },
  { key: 'Work', label: 'Work', icon: mdiBriefcaseOutline, glow: '#3B82F6', activeBg: '#102542' },
  { key: 'Personal', label: 'Personal', icon: mdiAccountOutline, glow: '#10B981', activeBg: '#063222' },
  { key: 'Calls', label: 'Calls', icon: mdiPhoneOutline, glow: '#14B8A6', activeBg: '#05302E' },
  { key: 'Shopping', label: 'Shopping', icon: mdiCartOutline, glow: '#06B6D4', activeBg: '#04323A' },
  { key: 'Health', label: 'Health', icon: mdiHeartPulse, glow: '#EF4444', activeBg: '#3D1212' },
  { key: 'Learning', label: 'Learning', icon: mdiSchoolOutline, glow: '#D946EF', activeBg: '#36113B' },
  { key: 'Family', label: 'Family', icon: mdiHomeHeart, glow: '#F97316', activeBg: '#3D1F08' },
  { key: 'Finance', label: 'Finance', icon: mdiWalletOutline, glow: '#EAB308', activeBg: '#3B2E05' },
  { key: 'Quick', label: 'Quick', icon: mdiLightningBoltOutline, glow: '#F59E0B', activeBg: '#3B2605' },
  { key: 'DeepWork', label: 'Deep Work', icon: mdiBrain, glow: '#8B5CF6', activeBg: '#221442' },
  { key: 'Someday', label: 'Someday', icon: mdiLightbulbOutline, glow: '#64748B', activeBg: '#1E232E' },
  { key: 'None', label: 'No Category', icon: mdiTagOffOutline, glow: '#9CA3AF', activeBg: '#242A38' },
];

// 🟢 ТОЧНЫЙ МАППИНГ ИКОНОК КАТЕГОРИЙ (1 в 1 с WPF MaterialDesign Icons)
const CATEGORY_ICONS: Record<string, string> = {
  Work: mdiBriefcaseOutline,
  Personal: mdiAccountOutline,
  Calls: mdiPhoneOutline,
  Shopping: mdiCartOutline,
  Health: mdiHeartPulse,
  Learning: mdiSchoolOutline,
  Family: mdiHomeHeart,
  Finance: mdiWalletOutline,
  Quick: mdiLightningBoltOutline,
  DeepWork: mdiBrain,
  Someday: mdiLightbulbOutline,
  None: mdiTagOutline,
};

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  Work: { bg: '#172554', text: '#60A5FA' },
  Personal: { bg: '#064E3B', text: '#34D399' },
  Calls: { bg: '#134E4A', text: '#2DD4BF' },
  Shopping: { bg: '#164E63', text: '#22D3EE' },
  Health: { bg: '#4C0519', text: '#FB7185' },
  Learning: { bg: '#4A044E', text: '#E879F9' },
  Family: { bg: '#7C2D12', text: '#FB923C' },
  Finance: { bg: '#713F12', text: '#FACC15' },
  Quick: { bg: '#451A03', text: '#FBBF24' },
  DeepWork: { bg: '#2E1065', text: '#A78BFA' },
  Someday: { bg: '#1E293B', text: '#94A3B8' },
};

const PRIORITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  High: { bg: '#331E23', text: '#EF4444', border: '#EF4444' },
  Medium: { bg: '#332A1B', text: '#F59E0B', border: '#F59E0B' },
  Low: { bg: '#1D283A', text: '#3B82F6', border: '#3B82F6' },
  None: { bg: 'transparent', text: '#94A3B8', border: '#4B5563' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  Review: { bg: '#1E3A8A', text: '#93C5FD' },
  Waiting: { bg: '#3B2F00', text: '#FDE047' },
  InProgress: { bg: '#281B3A', text: '#A78BFA' },
  Blocked: { bg: '#3A1B24', text: '#FB7185' },
  Todo: { bg: '#2A303C', text: '#94A3B8' },
};

export const TasksWorkspaceView: React.FC = () => {
  const { currentTab } = useNavigationStore();
  const {
    selectedTaskList,
    visibleTasks,
    currentTaskFilter,
    taskSearchText,
    isAiParseEnabled,
    newTaskText,
    newTaskDueDate,
    newTaskCategoryString,
    newTaskPriorityString,
    newTaskStatusString,
    myTaskLists,
    setTaskFilter,
    setTaskSearchText,
    clearTaskSearch,
    setNewTaskText,
    setNewTaskDueDate,
    setNewTaskCategoryString,
    setNewTaskPriorityString,
    setNewTaskStatusString,
    toggleAiParse,
    addTask,
    updateTask,
    deleteTask,
    beginEditTask,
    commitEditTask,
    decomposeTaskWithAi,
    acceptDraftSubtasks,
    rejectDraftSubtasks,
  } = useTodoStore();

  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [activePopup, setActivePopup] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => setActivePopup(null);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  if (currentTab !== MainTab.Tasks) {
    return null;
  }

  // Заглушка, если список не выбран (1 в 1 с XAML)
  if (!selectedTaskList) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#11141B',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            padding: '10px 20px',
            borderRadius: 20,
            backgroundColor: '#1C212D',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <MdiIcon path={mdiFormatListChecks} size={20} color="#1E9BEB" style={{ marginRight: 10 }} />
          <span style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 600 }}>
            {myTaskLists.length === 0
              ? 'Create your first list to start organizing tasks'
              : 'Select a list to view tasks'}
          </span>
        </div>
      </div>
    );
  }

  const displayedTasks = visibleTasks.filter((t) => {
    if (!taskSearchText.trim()) return true;
    const query = taskSearchText.toLowerCase();
    return (
      (t.title && t.title.toLowerCase().includes(query)) ||
      (t.description && t.description.toLowerCase().includes(query))
    );
  });

  // 🟢 Иконка заголовка списка резолвится динамически (геймпад, список и т.д.)
  const headerListIcon = resolveMdiIcon(selectedTaskList.iconKind, mdiFormatListBulleted);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#11141B',
        overflowY: 'auto',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* ================= РЯД 0: ШАПКА, ПОИСК И ФИЛЬТРЫ ================= */}
      <div style={{ margin: '15px 30px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <MdiIcon
              path={headerListIcon}
              size={26}
              color={selectedTaskList.iconColor || '#7D8494'}
              style={{ marginRight: 12 }}
            />
            <span
              style={{
                color: '#FFFFFF',
                fontSize: 24,
                fontWeight: 'bold',
              }}
            >
              {selectedTaskList.listName}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 220, height: 40, marginRight: 10 }}>
              <SearchInputUserControl
                text={taskSearchText}
                hintText="Search tasks..."
                onChange={setTaskSearchText}
                onClear={clearTaskSearch}
                margin="0"
              />
            </div>

            <button
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              style={{
                width: 115,
                height: 40,
                borderRadius: 10,
                backgroundColor: isFiltersExpanded ? '#232A3B' : 'transparent',
                border: '1px solid #2A3143',
                color: isFiltersExpanded ? '#E2E8F0' : '#94A3B8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 6px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease',
              }}
            >
              <MdiIcon
                path={isFiltersExpanded ? mdiFilterVariantRemove : mdiFilterVariant}
                size={16}
                color="currentColor"
                style={{ marginRight: 6 }}
              />
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {isFiltersExpanded ? 'Hide Filters' : 'Show Filters'}
              </span>
            </button>
          </div>
        </div>

        {isFiltersExpanded && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              margin: '10px 0 0 0',
              padding: '12px 10px 2px 10px',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            {NEON_FILTERS.map((chip) => {
              const isChecked = currentTaskFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  onClick={() => setTaskFilter(chip.key)}
                  style={{
                    height: 34,
                    padding: '0 16px 0 14px',
                    margin: '0 10px 10px 0',
                    borderRadius: 17,
                    backgroundColor: isChecked ? chip.activeBg : '#161A23',
                    border: isChecked ? `1px solid ${chip.glow}` : '1px solid #2A3143',
                    color: isChecked ? '#FFFFFF' : '#94A3B8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                    outline: 'none',
                    boxShadow: isChecked ? `0 0 14px ${chip.glow}77` : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <MdiIcon path={chip.icon} size={16} color={chip.glow} style={{ marginRight: 6 }} />
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= РЯД 1: ПОЛЕ ДОБАВЛЕНИЯ ЗАДАЧИ ================= */}
      <div style={{ margin: '0 30px 25px 30px' }}>
        <div
          style={{
            backgroundColor: '#1C212D',
            borderRadius: 16,
            border: '1px solid #2A303C',
            padding: '15px 12px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'flex-start',
            boxSizing: 'border-box',
          }}
        >
          <MdiIcon
            path={mdiPlusCircleOutline}
            size={26}
            color="#1E9BEB"
            style={{ margin: '5px 15px 0 0', flexShrink: 0 }}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              type="text"
              placeholder="What needs to be done?"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#FFFFFF',
                fontSize: 16,
                padding: '2px 0 8px 0',
                fontFamily: "'Segoe UI', -apple-system, sans-serif",
              }}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6, alignItems: 'center' }}>
              {/* Due Date */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopup(activePopup === 'newDueDate' ? null : 'newDueDate');
                }}
                style={parameterBadgeStyle}
              >
                <MdiIcon path={mdiCalendarMonth} size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                <span style={{ color: newTaskDueDate ? '#FFFFFF' : '#94A3B8', fontSize: 13, fontWeight: 500 }}>
                  {newTaskDueDate
                    ? new Date(newTaskDueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })
                    : 'Due Date'}
                </span>

                {activePopup === 'newDueDate' && (
                  <div onClick={(e) => e.stopPropagation()} style={popoverCardStyle}>
                    <input
                      type="date"
                      value={newTaskDueDate ? newTaskDueDate.split('T')[0] : ''}
                      onChange={(e) => {
                        setNewTaskDueDate(e.target.value ? new Date(e.target.value).toISOString() : null);
                        setActivePopup(null);
                      }}
                      style={{
                        background: '#161A23',
                        border: '1px solid #3B82F6',
                        color: '#FFF',
                        borderRadius: 6,
                        padding: '6px 8px',
                        outline: 'none',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Category */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopup(activePopup === 'newCategory' ? null : 'newCategory');
                }}
                style={parameterBadgeStyle}
              >
                <MdiIcon
                  path={CATEGORY_ICONS[newTaskCategoryString] || mdiTagOutline}
                  size={16}
                  color="#94A3B8"
                  style={{ marginRight: 8 }}
                />
                <span style={{ color: newTaskCategoryString !== 'Auto' ? '#FFFFFF' : '#94A3B8', fontSize: 13, fontWeight: 500 }}>
                  {newTaskCategoryString}
                </span>

                {activePopup === 'newCategory' && (
                  <div style={popoverCardStyle}>
                    {['Auto', 'Work', 'Personal', 'Calls', 'Shopping', 'Health', 'Learning', 'Family', 'Finance', 'Quick', 'DeepWork', 'Someday', 'None'].map(
                      (cat) => (
                        <div
                          key={cat}
                          onClick={() => {
                            setNewTaskCategoryString(cat);
                            setActivePopup(null);
                          }}
                          style={{ ...popoverItemStyle, display: 'flex', alignItems: 'center' }}
                        >
                          <MdiIcon
                            path={CATEGORY_ICONS[cat] || mdiTagOutline}
                            size={15}
                            color="#94A3B8"
                            style={{ marginRight: 8 }}
                          />
                          <span>{cat}</span>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Priority */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopup(activePopup === 'newPriority' ? null : 'newPriority');
                }}
                style={parameterBadgeStyle}
              >
                <MdiIcon path={mdiFlagOutline} size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                <span style={{ color: newTaskPriorityString !== 'None' ? '#FFFFFF' : '#94A3B8', fontSize: 13, fontWeight: 500 }}>
                  {newTaskPriorityString === 'None' ? 'Priority' : newTaskPriorityString}
                </span>

                {activePopup === 'newPriority' && (
                  <div style={popoverCardStyle}>
                    {['None', 'Low', 'Medium', 'High'].map((pri) => (
                      <div
                        key={pri}
                        onClick={() => {
                          setNewTaskPriorityString(pri);
                          setActivePopup(null);
                        }}
                        style={{
                          ...popoverItemStyle,
                          color:
                            pri === 'High' ? '#EF4444' : pri === 'Medium' ? '#F59E0B' : pri === 'Low' ? '#3B82F6' : '#94A3B8',
                        }}
                      >
                        {pri}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopup(activePopup === 'newStatus' ? null : 'newStatus');
                }}
                style={parameterBadgeStyle}
              >
                <MdiIcon path={mdiListStatus} size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                <span style={{ color: newTaskStatusString !== 'Todo' ? '#FFFFFF' : '#94A3B8', fontSize: 13, fontWeight: 500 }}>
                  {newTaskStatusString}
                </span>

                {activePopup === 'newStatus' && (
                  <div style={popoverCardStyle}>
                    {['Todo', 'InProgress', 'Review', 'Waiting', 'Blocked'].map((st) => (
                      <div
                        key={st}
                        onClick={() => {
                          setNewTaskStatusString(st);
                          setActivePopup(null);
                        }}
                        style={popoverItemStyle}
                      >
                        {st}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Auto Toggle */}
              <button
                type="button"
                onClick={toggleAiParse}
                title="Toggle AI Auto-parsing (Detects dates, categories and priority from text)"
                style={{
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 8,
                  backgroundColor: isAiParseEnabled ? '#7C3AED' : '#242A38',
                  border: 'none',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  outline: 'none',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <MdiIcon path={mdiAutoFix} size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>AI Auto</span>
              </button>
            </div>
          </div>

          <button
            onClick={addTask}
            style={{
              height: 40,
              padding: '0 20px',
              borderRadius: 20,
              backgroundColor: '#1E9BEB',
              border: 'none',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 'bold',
              cursor: 'pointer',
              marginLeft: 15,
              alignSelf: 'flex-end',
              boxShadow: '0 3px 10px rgba(0,0,0,0.4)',
              outline: 'none',
              flexShrink: 0,
            }}
          >
            Add Task
          </button>
        </div>
      </div>

      {/* ================= РЯД 2: СПИСОК ЗАДАЧ ================= */}
      <div style={{ margin: '0 30px', flex: 1 }}>
        {displayedTasks.map((task) => (
          <TaskCardItem
            key={task.localId || task.serverId}
            task={task}
            activePopup={activePopup}
            setActivePopup={setActivePopup}
            updateTask={updateTask}
            deleteTask={deleteTask}
            beginEditTask={beginEditTask}
            commitEditTask={commitEditTask}
            decomposeTaskWithAi={decomposeTaskWithAi}
            acceptDraftSubtasks={acceptDraftSubtasks}
            rejectDraftSubtasks={rejectDraftSubtasks}
          />
        ))}
      </div>
    </div>
  );
};

const TaskCardItem: React.FC<{
  task: ITodoTask;
  activePopup: string | null;
  setActivePopup: (popup: string | null) => void;
  updateTask: (task: ITodoTask) => Promise<void>;
  deleteTask: (task: ITodoTask) => Promise<void>;
  beginEditTask: (task: ITodoTask) => void;
  commitEditTask: (task: ITodoTask) => Promise<void>;
  decomposeTaskWithAi: (task: ITodoTask) => Promise<void>;
  acceptDraftSubtasks: (task: ITodoTask) => Promise<void>;
  rejectDraftSubtasks: (task: ITodoTask) => void;
}> = ({
  task,
  activePopup,
  setActivePopup,
  updateTask,
  deleteTask,
  beginEditTask,
  commitEditTask,
  decomposeTaskWithAi,
  acceptDraftSubtasks,
  rejectDraftSubtasks,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const isCommittingRef = useRef(false);

  useEffect(() => {
    setEditTitle(task.title);
  }, [task.title, task.isEditing]);

  const handleCommit = () => {
    if (isCommittingRef.current) return;
    isCommittingRef.current = true;
    const newTitle = editTitle.trim() || task.title;
    commitEditTask({ ...task, title: newTitle });
    setTimeout(() => {
      isCommittingRef.current = false;
    }, 200);
  };

  const categoryName = typeof task.category === 'number' ? TaskCategory[task.category] : task.category;
  const priorityName = typeof task.priority === 'number' ? TaskPriority[task.priority] : task.priority;
  const statusName = typeof task.status === 'number' ? TaskStatus[task.status] : task.status;

  const catStyle = CATEGORY_STYLES[categoryName] || null;
  const priStyle = PRIORITY_STYLES[priorityName] || PRIORITY_STYLES.None;
  const statusStyle = STATUS_STYLES[statusName] || STATUS_STYLES.Todo;

  // 🟢 Реальная иконка категории вместо дефолтной бирки
  const categoryIcon = CATEGORY_ICONS[categoryName] || mdiTagOutline;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: task.isCompleted ? '#12151D' : isHovered ? '#232A3B' : '#1E232F',
        borderRadius: 12,
        border: task.isCompleted ? '1px solid transparent' : '1px solid #2A303C',
        opacity: task.isCompleted ? 0.6 : 1,
        padding: 12,
        marginBottom: 8,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        transition: 'background-color 0.12s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {/* Круглый чекбокс */}
        <div
          onClick={() => updateTask({ ...task, isCompleted: !task.isCompleted })}
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            border: task.isCompleted ? '2px solid #10B981' : `2px solid ${priStyle.border}`,
            backgroundColor: task.isCompleted ? '#10B981' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            marginRight: 16,
            marginTop: 2,
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
        >
          {task.isCompleted && <MdiIcon path={mdiCheck} size={16} color="#FFFFFF" />}
        </div>

        {/* Текст или инпут редактирования */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {task.isEditing ? (
            <input
              type="text"
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCommit();
                }
                if (e.key === 'Escape') {
                  setEditTitle(task.title);
                  useTodoStore.setState((s) => ({
                    visibleTasks: s.visibleTasks.map((t) =>
                      t.localId === task.localId || t.serverId === task.serverId ? { ...t, isEditing: false } : t
                    ),
                  }));
                }
              }}
              onBlur={handleCommit}
              style={{
                backgroundColor: '#161A23',
                border: '1px solid #3B82F6',
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: 500,
                padding: '6px 4px',
                borderRadius: 4,
                width: '100%',
                outline: 'none',
                fontFamily: "'Segoe UI', -apple-system, sans-serif",
              }}
            />
          ) : (
            <div
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: '#E2E8F0',
                textDecoration: task.isCompleted ? 'line-through' : 'none',
                wordBreak: 'break-word',
                lineHeight: '20px',
              }}
            >
              {task.title}
            </div>
          )}

          {/* Панель метаданных */}
          {!task.isCompleted && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' }}>
              {task.dueDate && (
                <div style={{ display: 'flex', alignItems: 'center', marginRight: 10 }}>
                  <MdiIcon path={mdiCalendarBlankOutline} size={14} color="#3B82F6" style={{ marginRight: 4 }} />
                  <span style={{ fontSize: 12, color: '#3B82F6', fontWeight: 600 }}>
                    {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )}

              {priorityName !== 'None' && (
                <div
                  style={{
                    backgroundColor: priStyle.bg,
                    borderRadius: 4,
                    padding: '2px 6px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <MdiIcon path={mdiFlag} size={12} color={priStyle.text} style={{ marginRight: 4 }} />
                  <span style={{ fontSize: 11, fontWeight: 'bold', color: priStyle.text }}>
                    {priorityName}
                  </span>
                </div>
              )}

              {/* 🟢 Отображение специализированной иконки категории (корзина, трубка, юзер и т.д.) */}
              {categoryName !== 'None' && catStyle && (
                <div
                  style={{
                    backgroundColor: catStyle.bg,
                    borderRadius: 4,
                    padding: '2px 6px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <MdiIcon path={categoryIcon} size={12} color={catStyle.text} style={{ marginRight: 4 }} />
                  <span style={{ fontSize: 11, fontWeight: 'bold', color: catStyle.text }}>
                    {categoryName}
                  </span>
                </div>
              )}

              <div
                style={{
                  backgroundColor: statusStyle.bg,
                  borderRadius: 4,
                  padding: '2px 6px',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 'bold', color: statusStyle.text }}>
                  {statusName}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Кнопки действий по ховеру */}
        {!task.isEditing && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? 'auto' : 'none',
              transition: 'opacity 0.15s ease',
              marginLeft: 10,
              position: 'relative',
            }}
          >
            {/* ИИ декомпозиция */}
            <button
              onClick={() => decomposeTaskWithAi(task)}
              title="Break down with AI"
              style={actionBtnItemStyle}
            >
              <MdiIcon path={mdiAutoFix} size={18} color="#8B5CF6" />
            </button>

            {/* Редактирование */}
            <button
              onClick={() => {
                setEditTitle(task.title);
                beginEditTask(task);
              }}
              title="Edit"
              style={actionBtnItemStyle}
            >
              <MdiIcon path={mdiPencilOutline} size={18} color="#94A3B8" />
            </button>

            {/* Выбор даты */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopup(activePopup === `date_${task.localId}` ? null : `date_${task.localId}`);
                }}
                title="Set Due Date"
                style={actionBtnItemStyle}
              >
                <MdiIcon path={mdiCalendarMonth} size={18} color="#94A3B8" />
              </button>

              {activePopup === `date_${task.localId}` && (
                <div onClick={(e) => e.stopPropagation()} style={popoverCardStyle}>
                  <input
                    type="date"
                    value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                    onChange={(e) => {
                      updateTask({
                        ...task,
                        dueDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                      });
                      setActivePopup(null);
                    }}
                    style={{
                      background: '#161A23',
                      border: '1px solid #3B82F6',
                      color: '#FFF',
                      borderRadius: 6,
                      padding: '6px 8px',
                      outline: 'none',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Выбор приоритета */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopup(activePopup === `pri_${task.localId}` ? null : `pri_${task.localId}`);
                }}
                title="Set Priority"
                style={actionBtnItemStyle}
              >
                <MdiIcon path={mdiFlagOutline} size={18} color="#94A3B8" />
              </button>

              {activePopup === `pri_${task.localId}` && (
                <div style={popoverCardStyle}>
                  {['None', 'Low', 'Medium', 'High'].map((pri) => (
                    <div
                      key={pri}
                      onClick={() => {
                        updateTask({ ...task, priority: TaskPriority[pri as keyof typeof TaskPriority] });
                        setActivePopup(null);
                      }}
                      style={{
                        ...popoverItemStyle,
                        color:
                          pri === 'High' ? '#EF4444' : pri === 'Medium' ? '#F59E0B' : pri === 'Low' ? '#3B82F6' : '#94A3B8',
                      }}
                    >
                      {pri}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Выбор статуса */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopup(activePopup === `st_${task.localId}` ? null : `st_${task.localId}`);
                }}
                title="Set Status"
                style={actionBtnItemStyle}
              >
                <MdiIcon path={mdiListStatus} size={18} color="#94A3B8" />
              </button>

              {activePopup === `st_${task.localId}` && (
                <div style={popoverCardStyle}>
                  {['Todo', 'InProgress', 'Review', 'Waiting', 'Blocked'].map((st) => (
                    <div
                      key={st}
                      onClick={() => {
                        updateTask({ ...task, status: TaskStatus[st as keyof typeof TaskStatus] });
                        setActivePopup(null);
                      }}
                      style={popoverItemStyle}
                    >
                      {st}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Выбор категории */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopup(activePopup === `cat_${task.localId}` ? null : `cat_${task.localId}`);
                }}
                title="Set Category"
                style={actionBtnItemStyle}
              >
                <MdiIcon path={categoryIcon} size={18} color="#94A3B8" />
              </button>

              {activePopup === `cat_${task.localId}` && (
                <div style={popoverCardStyle}>
                  {['None', 'Work', 'Personal', 'Calls', 'Shopping', 'Health', 'Learning', 'Family', 'Finance', 'Quick', 'DeepWork', 'Someday'].map(
                    (cat) => (
                      <div
                        key={cat}
                        onClick={() => {
                          updateTask({ ...task, category: TaskCategory[cat as keyof typeof TaskCategory] });
                          setActivePopup(null);
                        }}
                        style={{ ...popoverItemStyle, display: 'flex', alignItems: 'center' }}
                      >
                        <MdiIcon
                          path={CATEGORY_ICONS[cat] || mdiTagOutline}
                          size={15}
                          color="#94A3B8"
                          style={{ marginRight: 8 }}
                        />
                        <span>{cat}</span>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Удаление */}
            <button onClick={() => deleteTask(task)} title="Delete" style={{ ...actionBtnItemStyle, color: '#EF4444' }}>
              <MdiIcon path={mdiTrashCanOutline} size={18} color="#EF4444" />
            </button>
          </div>
        )}
      </div>

      {/* ИИ подзадачи */}
      {(task as any).hasDraftSubtasks && (task as any).draftSubtasks && (
        <div
          style={{
            margin: '10px 0 5px 40px',
            backgroundColor: '#181F2E',
            borderRadius: 10,
            padding: 12,
            border: '1px solid #8B5CF6',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <MdiIcon path={mdiAutoFix} size={16} color="#8B5CF6" style={{ marginRight: 6 }} />
            <span style={{ fontSize: 12, fontWeight: 'bold', color: '#A78BFA' }}>
              AI Subtask Suggestions
            </span>
          </div>

          <div>
            {((task as any).draftSubtasks as ISelectableItem[]).map((sub, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', margin: '3px 0' }}>
                <input
                  type="checkbox"
                  checked={sub.isSelected}
                  onChange={(e) => {
                    const drafts = [...(task as any).draftSubtasks];
                    drafts[idx].isSelected = e.target.checked;
                    useTodoStore.setState((s) => ({
                      visibleTasks: s.visibleTasks.map((t) =>
                        t.localId === task.localId || t.serverId === task.serverId ? { ...t, draftSubtasks: drafts } : t
                      ),
                    }));
                  }}
                  style={{ cursor: 'pointer', marginRight: 8 }}
                />
                <span style={{ color: '#E2E8F0', fontSize: 13, flex: 1 }}>{sub.text}</span>

                {sub.category !== TaskCategory.None && (
                  <span
                    style={{
                      backgroundColor: '#2B364E',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 10,
                      fontWeight: 'bold',
                      color: '#3B82F6',
                      marginLeft: 10,
                    }}
                  >
                    {TaskCategory[sub.category]}
                  </span>
                )}

                {sub.priority !== TaskPriority.None && (
                  <span
                    style={{
                      backgroundColor: '#2B364E',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 10,
                      fontWeight: 'bold',
                      color: '#EF4444',
                      marginLeft: 4,
                    }}
                  >
                    {TaskPriority[sub.priority]}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            <button
              onClick={() => rejectDraftSubtasks(task)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9CA3AF',
                cursor: 'pointer',
                fontSize: 12,
                padding: '0 12px',
                height: 28,
              }}
            >
              Reject
            </button>
            <button
              onClick={() => acceptDraftSubtasks(task)}
              style={{
                backgroundColor: '#8B5CF6',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                padding: '0 14px',
                height: 28,
                fontSize: 12,
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Accept Subtasks
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const parameterBadgeStyle: React.CSSProperties = {
  backgroundColor: '#242A38',
  borderRadius: 8,
  padding: '4px 12px',
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
  position: 'relative',
};

const popoverCardStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 6,
  backgroundColor: '#2B2D31',
  border: '1px solid #333E4A',
  borderRadius: 8,
  padding: '4px 0',
  zIndex: 100,
  minWidth: 140,
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
};

const popoverItemStyle: React.CSSProperties = {
  padding: '8px 16px',
  color: '#E2E8F0',
  fontSize: 13,
  cursor: 'pointer',
  transition: 'background-color 0.1s ease',
};

const actionBtnItemStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  marginLeft: 4,
};

export default TasksWorkspaceView;