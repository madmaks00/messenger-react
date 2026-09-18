import React, { useState } from 'react';
import { useTodoStore, ITodoList } from '../../stores/todoStore';

const ITEM_HEIGHT = 50;

export const SidebarTasksView: React.FC = () => {
  const {
    myTaskLists,
    smartTaskLists,
    selectedTaskList,
    listSearchText,
    selectTaskList,
    setListSearchText,
    createNewTaskList,
    beginEditList,
    cancelEditList,
    commitEditList,
    deleteTaskList,
  } = useTodoStore();

  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  const filteredLists = myTaskLists.filter((l) =>
    l.listName.toLowerCase().includes(listSearchText.toLowerCase())
  );

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      {/* 0: ШАПКА */}
      <div style={{ height: 52, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1E293B' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 'bold', color: '#FFF' }}>
          <span>📋</span>
          <span>Tasks</span>
        </div>
        <button
          onClick={createNewTaskList}
          title="New Task List"
          style={{ background: 'transparent', border: 'none', color: 'var(--app-accent, #3B82F6)', fontSize: 18, cursor: 'pointer' }}
        >
          ➕
        </button>
      </div>

      {/* 1: ПОИСК СПИСКОВ */}
      <div style={{ padding: '8px 12px' }}>
        <input
          type="text"
          placeholder="Search lists..."
          value={listSearchText}
          onChange={(e) => setListSearchText(e.target.value)}
          style={{
            width: '100%',
            height: 36,
            background: '#161B26',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: '0 12px',
            color: '#FFF',
            fontSize: 13.5,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* СМАРТ-СПИСКИ (My Day, Important, etc.) */}
      <div style={{ padding: '4px 6px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
        {smartTaskLists.map((smart) => {
          const isSelected = selectedTaskList?.localId === smart.localId;
          return (
            <div
              key={smart.localId}
              onClick={() => selectTaskList(smart)}
              style={{
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 12px',
                borderRadius: 8,
                cursor: 'pointer',
                backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: isSelected ? '#FFF' : '#94A3B8',
                marginBottom: 2,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: smart.iconColor, fontSize: 16 }}>★</span>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{smart.listName}</span>
              </div>
              {smart.uncompletedCount > 0 && (
                <span style={{ fontSize: 11.5, fontWeight: 'bold', color: '#94A3B8' }}>
                  {smart.uncompletedCount}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 2: СПИСОК ПОЛЬЗОВАТЕЛЬСКИХ ПРОЕКТОВ (50px Шаг из WPF) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {filteredLists.length === 0 && myTaskLists.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 80, color: '#64748B' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📑</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#FFF' }}>No Task Lists</div>
          </div>
        ) : (
          filteredLists.map((list) => {
            const isSelected = selectedTaskList?.localId === list.localId;
            const isHovered = hoveredId === list.localId;

            return (
              <div
                key={list.localId}
                onMouseEnter={() => setHoveredId(list.localId)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => !list.isEditing && selectTaskList(list)}
                style={{
                  height: ITEM_HEIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 10px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : isHovered ? '#1E2330' : 'transparent',
                  marginBottom: 2,
                  boxSizing: 'border-box',
                }}
              >
                {/* Левая часть: Иконка с карандашиком */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <div style={{ position: 'relative', width: 28, height: 28 }}>
                    <span style={{ fontSize: 20, color: list.iconColor }}>📁</span>
                    {list.isEditing && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          background: 'var(--app-accent, #3B82F6)',
                          color: '#FFF',
                          fontSize: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        ✏
                      </div>
                    )}
                  </div>

                  {/* Имя или инлайн-инпут */}
                  {list.isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      maxLength={20}
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEditList(list.localId, editingText);
                        if (e.key === 'Escape') cancelEditList(list.localId);
                      }}
                      onBlur={() => commitEditList(list.localId, editingText)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid #3B82F6',
                        color: '#FFF',
                        fontSize: 14,
                        outline: 'none',
                        width: '100%',
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#FFF', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {list.listName}
                    </span>
                  )}
                </div>

                {/* Правая часть: Бейдж срочности + Кнопки Edit / Delete */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {list.uncompletedCount > 0 && !list.isEditing && (
                    <div
                      style={{
                        padding: '2px 8px',
                        borderRadius: 10,
                        backgroundColor: list.urgencyColor,
                        color: '#FFF',
                        fontSize: 11,
                        fontWeight: 'bold',
                      }}
                    >
                      {list.uncompletedCount}
                    </div>
                  )}

                  {isHovered && !list.isEditing && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingText(list.listName);
                          beginEditList(list.localId);
                        }}
                        style={miniIconBtnStyle}
                        title="Edit"
                      >
                        ✏
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTaskList(list);
                        }}
                        style={{ ...miniIconBtnStyle, color: '#EF4444' }}
                        title="Delete"
                      >
                        🗑
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const miniIconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#94A3B8',
  fontSize: 13,
  cursor: 'pointer',
  padding: 4,
};