import React, { useState } from 'react';
import { useTodoStore, TaskCategory, TaskPriority, TaskStatus, ITodoTask } from '../../stores/todoStore';

// Палитра категорий 1-в-1 из XAML-ресурсов
const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  Work: { bg: '#172554', text: '#60A5FA', label: 'Work' },
  Personal: { bg: '#064E3B', text: '#34D399', label: 'Personal' },
  Calls: { bg: '#134E4A', text: '#2DD4BF', label: 'Calls' },
  Shopping: { bg: '#164E63', text: '#22D3EE', label: 'Shopping' },
  Health: { bg: '#4C0519', text: '#FB7185', label: 'Health' },
  Learning: { bg: '#4A044E', text: '#E879F9', label: 'Learning' },
  Family: { bg: '#7C2D12', text: '#FB923C', label: 'Family' },
  Finance: { bg: '#713F12', text: '#FACC15', label: 'Finance' },
  Quick: { bg: '#451A03', text: '#FBBF24', label: 'Quick' },
  DeepWork: { bg: '#2E1065', text: '#A78BFA', label: 'Deep Work' },
  Someday: { bg: '#1E293B', text: '#94A3B8', label: 'Someday' },
  None: { bg: '#1F2937', text: '#9CA3AF', label: 'No Category' },
};

const PRIORITY_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  High: { border: '#EF4444', bg: '#331E23', text: '#EF4444' },
  Medium: { border: '#F59E0B', bg: '#332A1B', text: '#F59E0B' },
  Low: { border: '#3B82F6', bg: '#1D283A', text: '#3B82F6' },
  None: { border: '#64748B', bg: 'transparent', text: '#94A3B8' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  Review: { bg: '#1E3A8A', text: '#93C5FD' },
  Waiting: { bg: '#3B2F00', text: '#FDE047' },
  InProgress: { bg: '#281B3A', text: '#A78BFA' },
  Blocked: { bg: '#3A1B24', text: '#FB7185' },
  Todo: { bg: 'rgba(255,255,255,0.08)', text: '#94A3B8' },
};

export const TasksWorkspaceView: React.FC = () => {
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
    setTaskFilter,
    setTaskSearchText,
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

  const [showFilters, setShowFilters] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');

  if (!selectedTaskList) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0B141B', color: '#64748B' }}>
        <div style={{ padding: '16px 24px', borderRadius: 20, background: '#1E293B', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>📋</span>
          <span style={{ color: '#E2E8F0', fontWeight: 600 }}>Select a list to view tasks</span>
        </div>
      </div>
    );
  }

  const filteredTasks = visibleTasks.filter((t) => {
    if (!taskSearchText.trim()) return true;
    return t.title.toLowerCase().includes(taskSearchText.toLowerCase());
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#0B141B', overflowY: 'auto' }}>
      {/* 1. ШАПКА: ЗАГОЛОВОК + ПОИСК + КНОПКА ФИЛЬТРОВ */}
      <div style={{ padding: '24px 30px 10px 30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 26, color: selectedTaskList.iconColor }}>★</span>
            <h1 style={{ fontSize: 24, fontWeight: 'bold', color: '#FFF', margin: 0 }}>{selectedTaskList.listName}</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="text"
              placeholder="Search tasks..."
              value={taskSearchText}
              onChange={(e) => setTaskSearchText(e.target.value)}
              style={{
                width: 220,
                height: 38,
                background: '#161B26',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '0 12px',
                color: '#FFF',
                fontSize: 13.5,
                outline: 'none',
              }}
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid #334155',
                background: showFilters ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                color: showFilters ? '#38BDF8' : '#94A3B8',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>
        </div>

        {/* НЕОНОВЫЕ ФИЛЬТРЫ-ЧИПЫ */}
        {showFilters && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {['All', 'Work', 'Personal', 'Calls', 'Shopping', 'Health', 'Learning', 'Family', 'Finance', 'Quick', 'DeepWork', 'Someday', 'None'].map((cat) => {
              const isSelected = currentTaskFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setTaskFilter(cat)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 17,
                    border: isSelected ? '1px solid #38BDF8' : '1px solid #334155',
                    background: isSelected ? 'rgba(56, 189, 248, 0.2)' : '#161B26',
                    color: isSelected ? '#38BDF8' : '#E2E8F0',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 12px rgba(56, 189, 248, 0.35)' : 'none',
                  }}
                >
                  {cat === 'All' ? 'All Tasks' : CATEGORY_STYLES[cat]?.label || cat}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. КАРТОЧКА СОЗДАНИЯ НОВОЙ ЗАДАЧИ С ИИ-ТУМБЛЕРОМ */}
      <div style={{ padding: '0 30px 20px 30px' }}>
        <div style={{ background: '#161B26', borderRadius: 16, border: '1px solid #334155', padding: '16px 20px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
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
              color: '#FFF',
              fontSize: 16,
              outline: 'none',
              marginBottom: 12,
            }}
          />

          {/* Параметры задачи */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Due Date */}
              <input
                type="date"
                value={newTaskDueDate || ''}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                style={badgeSelectStyle}
              />

              {/* Category */}
              <select
                value={newTaskCategoryString}
                onChange={(e) => setNewTaskCategoryString(e.target.value)}
                style={badgeSelectStyle}
              >
                <option value="Auto">Auto (Filter)</option>
                {Object.keys(CATEGORY_STYLES).map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>

              {/* Priority */}
              <select
                value={newTaskPriorityString}
                onChange={(e) => setNewTaskPriorityString(e.target.value)}
                style={badgeSelectStyle}
              >
                <option value="None">Priority: None</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>

              {/* Status */}
              <select
                value={newTaskStatusString}
                onChange={(e) => setNewTaskStatusString(e.target.value)}
                style={badgeSelectStyle}
              >
                <option value="Todo">Status: Todo</option>
                <option value="InProgress">InProgress</option>
                <option value="Review">Review</option>
                <option value="Waiting">Waiting</option>
                <option value="Blocked">Blocked</option>
              </select>

              {/* Тумблер ИИ */}
              <button
                type="button"
                onClick={toggleAiParse}
                style={{
                  ...badgeSelectStyle,
                  background: isAiParseEnabled ? '#7C3AED' : '#2B364E',
                  color: '#FFF',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ✨ AI Auto
              </button>
            </div>

            <button
              onClick={addTask}
              style={{
                height: 38,
                padding: '0 20px',
                borderRadius: 19,
                background: 'var(--app-accent, #3B82F6)',
                color: '#FFF',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Add Task
            </button>
          </div>
        </div>
      </div>

      {/* 3. СПИСОК ЗАДАЧ */}
      <div style={{ flex: 1, padding: '0 30px 30px 30px' }}>
        {filteredTasks.map((task) => {
          const catStyle = CATEGORY_STYLES[task.category] || CATEGORY_STYLES.None;
          const priColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.None;
          const statusStyle = STATUS_STYLES[task.status] || STATUS_STYLES.Todo;

          return (
            <div
              key={task.localId}
              style={{
                background: task.isCompleted ? '#12151D' : '#161B26',
                opacity: task.isCompleted ? 0.6 : 1,
                border: '1px solid #334155',
                borderRadius: 12,
                padding: '14px 16px',
                marginBottom: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                {/* 1. Круглый чекбокс */}
                <div
                  onClick={() => updateTask({ ...task, isCompleted: !task.isCompleted })}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    border: `2px solid ${task.isCompleted ? '#22C55E' : priColor.border}`,
                    background: task.isCompleted ? '#22C55E' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#FFF',
                    fontSize: 12,
                    marginTop: 2,
                    flexShrink: 0,
                  }}
                >
                  {task.isCompleted && '✓'}
                </div>

                {/* 2. Тело задачи / Инлайн-редактирование */}
                <div style={{ flex: 1 }}>
                  {task.isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && commitEditTask(task, editingTitle)}
                      onBlur={() => commitEditTask(task, editingTitle)}
                      style={{ background: '#1E2330', border: '1px solid #3B82F6', color: '#FFF', fontSize: 15, padding: '4px 8px', borderRadius: 4, width: '100%' }}
                    />
                  ) : (
                    <div style={{ fontSize: 15, fontWeight: 500, color: '#F8FAFC', textDecoration: task.isCompleted ? 'line-through' : 'none' }}>
                      {task.title}
                    </div>
                  )}

                  {/* 3. Бейджи метаданных */}
                  {!task.isCompleted && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {task.dueDate && (
                        <div style={{ fontSize: 11.5, color: '#38BDF8', fontWeight: 600 }}>
                          📅 {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </div>
                      )}
                      {task.priority !== 'None' && (
                        <div style={{ padding: '2px 6px', borderRadius: 4, background: priColor.bg, color: priColor.text, fontSize: 10.5, fontWeight: 'bold' }}>
                          🚩 {task.priority}
                        </div>
                      )}
                      {task.category !== 'None' && (
                        <div style={{ padding: '2px 6px', borderRadius: 4, background: catStyle.bg, color: catStyle.text, fontSize: 10.5, fontWeight: 'bold' }}>
                          🏷 {catStyle.label}
                        </div>
                      )}
                      <div style={{ padding: '2px 6px', borderRadius: 4, background: statusStyle.bg, color: statusStyle.text, fontSize: 10.5, fontWeight: 'bold' }}>
                        {task.status}
                      </div>
                    </div>
                  )}

                  {/* ЧЕРНОВИК ИИ-ПОДЗАДАЧ */}
                  {task.hasDraftSubtasks && task.draftSubtasks && (
                    <div style={{ marginTop: 12, background: '#181F2E', border: '1px solid #8B5CF6', borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 'bold', color: '#A78BFA', marginBottom: 8 }}>
                        ✨ AI Subtask Suggestions
                      </div>
                      {task.draftSubtasks.map((sub, idx) => (
                        <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#E2E8F0', fontSize: 13, marginBottom: 4, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={sub.isSelected}
                            onChange={(e) => {
                              const updatedDrafts = [...task.draftSubtasks!];
                              updatedDrafts[idx].isSelected = e.target.checked;
                              updateTask({ ...task, draftSubtasks: updatedDrafts });
                            }}
                          />
                          <span>{sub.text}</span>
                        </label>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                        <button onClick={() => rejectDraftSubtasks(task)} style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 12 }}>
                          Reject
                        </button>
                        <button onClick={() => acceptDraftSubtasks(task)} style={{ background: '#8B5CF6', border: 'none', color: '#FFF', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
                          Accept Subtasks
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Кнопки действий */}
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => decomposeTaskWithAi(task)}
                    title="Break down with AI"
                    style={taskIconBtnStyle}
                  >
                    ✨
                  </button>
                  <button
                    onClick={() => {
                      setEditingTitle(task.title);
                      beginEditTask(task.localId);
                    }}
                    title="Edit"
                    style={taskIconBtnStyle}
                  >
                    ✏
                  </button>
                  <button
                    onClick={() => deleteTask(task.localId)}
                    title="Delete"
                    style={{ ...taskIconBtnStyle, color: '#EF4444' }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const badgeSelectStyle: React.CSSProperties = {
  background: '#1E293B',
  border: '1px solid #334155',
  borderRadius: 8,
  padding: '6px 10px',
  color: '#E2E8F0',
  fontSize: 12.5,
  outline: 'none',
};

const taskIconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#94A3B8',
  fontSize: 14,
  cursor: 'pointer',
  padding: 4,
};