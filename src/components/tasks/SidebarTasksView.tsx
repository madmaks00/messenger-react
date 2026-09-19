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
import { useTodoStore, ITodoList } from '../../stores/todoStore';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import { resolveMdiIcon } from '../../utils/iconResolver';

const ITEM_HEIGHT = 50;

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
  } = useTodoStore();

  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const { containerRef } = useSmoothScroll<HTMLDivElement>({ friction: 0.78, wheelMultiplier: 0.15 });

  const filteredLists = myTaskLists.filter((l) =>
    l.listName.toLowerCase().includes(listSearchText.toLowerCase())
  );

  return (
    <div
      style={{
        width: 340,
        height: '100%',
        backgroundColor: 'var(--bg-list)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <SidebarHeaderUserControl title="Tasks" iconPath={mdiClipboardListOutline} />

      <SearchInputUserControl
        text={listSearchText}
        hintText="Search lists..."
        onChange={setListSearchText}
      />

      <div ref={containerRef} className="wpf-scroll-viewer" style={{ flex: 1, paddingBottom: 10 }}>
        {filteredLists.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '130px 20px 0 20px' }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: 'var(--sidebar-search-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 15,
              }}
            >
              <svg viewBox="0 0 24 24" width={40} height={40} fill="var(--text-muted)" style={{ opacity: 0.5 }}>
                <path d={mdiClipboardPlusOutline} />
              </svg>
            </div>
            <span style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
              No Task Lists
            </span>
          </div>
        ) : (
          filteredLists.map((list: ITodoList) => {
            const isSelected = selectedTaskList?.localId === list.localId;
            const isHovered = hoveredId === list.localId;
            const listIconPath = resolveMdiIcon(list.iconKind, mdiFormatListBulleted);

            return (
              <div
                key={list.localId}
                onClick={() => !list.isEditing && selectTaskList(list)}
                onMouseEnter={() => setHoveredId(list.localId)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  height: ITEM_HEIGHT,
                  margin: '2px 6px',
                  padding: '0 10px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: isSelected ? 'var(--chat-item-active)' : isHovered ? 'var(--chat-item-hover)' : 'transparent',
                  boxSizing: 'border-box',
                  transition: 'background-color 0.1s ease',
                }}
              >
                {/* Иконка 28x28 */}
                <div
                  onClick={(e) => {
                    if (list.isEditing) e.stopPropagation();
                  }}
                  style={{
                    width: 28,
                    height: 28,
                    marginRight: 10,
                    position: 'relative',
                    cursor: list.isEditing ? 'pointer' : 'default',
                    flexShrink: 0,
                  }}
                >
                  <svg viewBox="0 0 24 24" width={22} height={22} fill={list.iconColor || 'var(--text-muted)'}>
                    <path d={listIconPath} />
                  </svg>

                  {list.isEditing && (
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        bottom: 0,
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: 'var(--app-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg viewBox="0 0 24 24" width={8.5} height={8.5} fill="#FFFFFF">
                        <path d={mdiPencil} />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Название / Инпут */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                  {list.isEditing ? (
                    <input
                      ref={editInputRef}
                      autoFocus
                      maxLength={20}
                      defaultValue={list.listName}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEditList(list.localId, editingText || list.listName);
                        if (e.key === 'Escape') cancelEditList(list.localId);
                      }}
                      onBlur={() => commitEditList(list.localId, editingText || list.listName)}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--action-edit-icon)',
                        color: '#FFFFFF',
                        fontSize: 14.5,
                        fontWeight: 600,
                        outline: 'none',
                        padding: '2px 0',
                      }}
                    />
                  ) : (
                    <span style={{ color: '#FFFFFF', fontSize: 14.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {list.listName}
                    </span>
                  )}
                </div>

                {/* Бейдж и кнопки */}
                <div style={{ display: 'flex', alignItems: 'center', marginLeft: 8 }}>
                  {!list.isEditing && list.uncompletedCount > 0 && (
                    <div
                      style={{
                        borderRadius: 10,
                        minWidth: 20,
                        height: 20,
                        padding: '0 6px',
                        backgroundColor: list.urgencyColor || 'var(--item-count-badge-bg)',
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

                  {isHovered && !list.isEditing && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <button
                        title="Edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingText(list.listName);
                          beginEditList(list.localId);
                        }}
                        style={miniIconBtnStyle}
                      >
                        <svg viewBox="0 0 24 24" width={16} height={16} fill="var(--action-edit-icon)">
                          <path d={mdiPencilOutline} />
                        </svg>
                      </button>

                      <button
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTaskList(list);
                        }}
                        style={miniIconBtnStyle}
                      >
                        <svg viewBox="0 0 24 24" width={16} height={16} fill="var(--action-delete-icon)">
                          <path d={mdiTrashCanOutline} />
                        </svg>
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

const miniIconBtnStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  padding: 0,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export default SidebarTasksView;