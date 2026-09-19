import React, { useState, useRef } from 'react';
import {
  mdiBookmarkOutline,
  mdiFileDocumentPlusOutline,
  mdiPencil,
  mdiPencilOutline,
  mdiTrashCanOutline,
} from '@mdi/js';

import { SidebarHeaderUserControl } from '../common/SidebarHeaderUserControl';
import { SearchInputUserControl } from '../common/SearchInputUserControl';
import { useNotesStore } from '../../stores/notesStore';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import { INote } from '../../types/models';

const ITEM_HEIGHT = 50;

export const SidebarNotesView: React.FC = () => {
  const {
    myNotes,
    selectedNote,
    noteSearchText,
    selectNote,
    setNoteSearchText,
    deleteNote,
    commitEditNote,
  } = useNotesStore();

  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const { containerRef } = useSmoothScroll<HTMLDivElement>({ friction: 0.78, wheelMultiplier: 0.15 });

  const filteredNotes = myNotes.filter((n) =>
    n.title.toLowerCase().includes(noteSearchText.toLowerCase())
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
      <SidebarHeaderUserControl title="Notes" iconPath={mdiBookmarkOutline} />

      <SearchInputUserControl
        text={noteSearchText}
        hintText="Search notes..."
        onChange={setNoteSearchText}
        onClear={() => setNoteSearchText('')}
      />

      <div ref={containerRef} className="wpf-scroll-viewer" style={{ flex: 1, paddingBottom: 10 }}>
        {filteredNotes.length === 0 ? (
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
                <path d={mdiFileDocumentPlusOutline} />
              </svg>
            </div>
            <span style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
              No Notes
            </span>
          </div>
        ) : (
          filteredNotes.map((note: INote) => {
            const isSelected = selectedNote?.id === note.id;
            const isHovered = hoveredId === note.id;
            const isEditing = editingId === note.id;

            return (
              <div
                key={note.id}
                onClick={() => !isEditing && selectNote(note)}
                onMouseEnter={() => setHoveredId(note.id || null)}
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
                  style={{
                    width: 28,
                    height: 28,
                    marginRight: 10,
                    position: 'relative',
                    flexShrink: 0,
                  }}
                >
                  <svg viewBox="0 0 24 24" width={22} height={22} fill={note.iconColor || 'var(--text-muted)'}>
                    <path d={note.iconKind || mdiBookmarkOutline} />
                  </svg>

                  {isEditing && (
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

                {/* Заголовок / Инпут */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      autoFocus
                      maxLength={30}
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          commitEditNote(note, editingText || note.title);
                          setEditingId(null);
                        } else if (e.key === 'Escape') {
                          setEditingId(null);
                        }
                      }}
                      onBlur={() => {
                        commitEditNote(note, editingText || note.title);
                        setEditingId(null);
                      }}
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
                      {note.title}
                    </span>
                  )}
                </div>

                {/* Кнопки при наведении */}
                {isHovered && !isEditing && (
                  <div style={{ display: 'flex', alignItems: 'center', marginLeft: 8 }}>
                    <button
                      title="Edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(note.id || null);
                        setEditingText(note.title);
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
                        deleteNote(note);
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

export default SidebarNotesView;