import React, { useState, useRef } from 'react';
import {
  mdiClipboardListOutline,
  mdiClipboardPlusOutline,
  mdiFormatListBulleted,
  mdiPencil,
  mdiPencilOutline,
  mdiTrashCanOutline,
} from '@mdi/js';

import { SidebarHeaderUserControl } from '../common/SidebarHeaderUserControl';
import { SearchInputUserControl } from '../common/SearchInputUserControl';
import { useTodoStore } from '../../stores/todoStore';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import { resolveMdiIcon } from '../../utils/iconResolver';
import { ITodoList } from '../../types/models';

const ITEM_HEIGHT = 50;

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

export const SidebarTasksView: React.FC = () => {
  const {
    myTaskLists,
    selectedTaskList,
    listSearchText,
    selectTaskList,
    setListSearchText,
    beginEditList,
    cancelEditList,
    commitEditList,
    deleteTaskList,
    openEditListDialog,
  } = useTodoStore();

  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const { containerRef } = useSmoothScroll<HTMLDivElement>({ friction: 0.78, wheelMultiplier: 0.15 });

  const filteredLists = myTaskLists.filter((l) => {
    if (!listSearchText.trim()) return true;
    return l.listName.toLowerCase().includes(listSearchText.toLowerCase());
  });

  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        height: '100%',
        backgroundColor: '#161A23',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* 0: ШАПКА */}
      <SidebarHeaderUserControl title="Tasks" iconPath={mdiClipboardListOutline} />

      {/* 1: ПОИСК */}
      <SearchInputUserControl
        text={listSearchText}
        hintText="Search lists..."
        onChange={setListSearchText}
        onClear={() => setListSearchText('')}
        margin="0 6px 10px 6px"
      />

      {/* 2: СПИСОК СПИСКОВ ЗАДАЧ */}
      <div
        ref={containerRef}
        className="wpf-scroll-viewer"
        style={{
          flex: 1,
          width: '100%',
          padding: '0 0 10px 0',
          overflowY: 'auto',
          overflowX: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {myTaskLists.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '130px 20px 0 20px' }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#1C212D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 15,
              }}
            >
              <MdiIcon path={mdiClipboardPlusOutline} size={40} color="#7D8494" style={{ opacity: 0.5 }} />
            </div>
            <span style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>
              No Task Lists
            </span>
          </div>
        ) : filteredLists.length === 0 ? (
          <div style={{ color: '#7D8494', fontSize: 14, textAlign: 'center', margin: '40px 0' }}>
            No task lists found
          </div>
        ) : (
          filteredLists.map((list) => {
            const isSelected = selectedTaskList?.localId === list.localId;
            const isHovered = hoveredId === list.localId;
            const isEditing = Boolean(list.isEditing);
            const listIconPath = resolveMdiIcon(list.iconKind, mdiFormatListBulleted);

            return (
              <div
                key={list.localId}
                onClick={() => !isEditing && selectTaskList(list)}
                onMouseEnter={() => setHoveredId(list.localId!)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  height: ITEM_HEIGHT,
                  margin: '2px 6px',
                  padding: '0 10px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: isSelected
                    ? '#232836'
                    : isHovered
                    ? '#1C212D'
                    : 'transparent',
                  boxSizing: 'border-box',
                  transition: 'background-color 0.12s ease',
                  position: 'relative',
                }}
              >
                {/* 🟢 ИКОНКА С НАВИСАЮЩИМ БЕЙДЖИКОМ: перехват onMouseDown предотвращает сброс режима редактирования инпутом */}
                <div
                  onMouseDown={(e) => {
                    if (isEditing) {
                      e.preventDefault();
                      e.stopPropagation();
                      openEditListDialog(list);
                    }
                  }}
                  onClick={(e) => {
                    if (isEditing) {
                      e.stopPropagation();
                      openEditListDialog(list);
                    }
                  }}
                  title={isEditing ? 'Change Icon & Color' : undefined}
                  style={{
                    width: 28,
                    height: 28,
                    marginRight: 10,
                    position: 'relative',
                    flexShrink: 0,
                    cursor: isEditing ? 'pointer' : 'default',
                  }}
                >
                  <MdiIcon
                    path={listIconPath}
                    size={22}
                    color={list.iconColor || '#7D8494'}
                    style={{ position: 'absolute', left: 0, top: 0 }}
                  />

                  {/* Бейджик карандаша при IsEditing */}
                  {isEditing && (
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        bottom: 0,
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: '#1E9BEB',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MdiIcon path={mdiPencil} size={8.5} color="#FFFFFF" />
                    </div>
                  )}
                </div>

                {/* ТЕКСТ / ПОЛЕ ВВОДА ИМЕНИ */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      autoFocus
                      maxLength={20}
                      defaultValue={list.listName}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          commitEditList({ ...list, editingName: editingText || list.listName });
                        }
                        if (e.key === 'Escape') {
                          cancelEditList(list);
                        }
                      }}
                      onBlur={() => {
                        commitEditList({ ...list, editingName: editingText || list.listName });
                      }}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid #3B82F6',
                        color: '#FFFFFF',
                        fontSize: 14.5,
                        fontWeight: 600,
                        outline: 'none',
                        padding: '2px 0',
                        caretColor: '#FFFFFF',
                        fontFamily: "'Segoe UI', -apple-system, sans-serif",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        color: '#FFFFFF',
                        fontSize: 14.5,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {list.listName}
                    </span>
                  )}
                </div>

                {/* ПРАВАЯ ЧАСТЬ: СЧЕТЧИК И КНОПКИ */}
                <div style={{ display: 'flex', alignItems: 'center', marginLeft: 6, flexShrink: 0 }}>
                  {!isEditing && list.uncompletedCount > 0 && (
                    <div
                      style={{
                        borderRadius: 10,
                        minWidth: 20,
                        height: 20,
                        padding: '0 6px',
                        backgroundColor: list.urgencyColor || '#2A303C',
                        color: '#FFFFFF',
                        fontSize: 11.5,
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 4,
                        boxSizing: 'border-box',
                      }}
                    >
                      {list.uncompletedCount}
                    </div>
                  )}

                  {!isEditing && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        opacity: isHovered ? 1 : 0,
                        pointerEvents: isHovered ? 'auto' : 'none',
                        transition: 'opacity 0.15s ease',
                      }}
                    >
                      <button
                        title="Edit Project"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingText(list.listName);
                          beginEditList(list);
                        }}
                        style={{ ...actionBtnStyle, color: '#3B82F6' }}
                      >
                        <MdiIcon path={mdiPencilOutline} size={16} color="#3B82F6" />
                      </button>

                      <button
                        title="Delete Project"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTaskList(list);
                        }}
                        style={{ ...actionBtnStyle, color: '#EF4444' }}
                      >
                        <MdiIcon path={mdiTrashCanOutline} size={16} color="#EF4444" />
                      </button>
                    </div>
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

const actionBtnStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  padding: 0,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 4,
};

export default SidebarTasksView;