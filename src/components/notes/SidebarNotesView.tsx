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
import { resolveMdiIcon } from '../../utils/iconResolver';
import { INote } from '../../types/models';

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
    style={{ display: 'inline-block', flexShrink: 0, ...style }}
  >
    <path d={path} />
  </svg>
);

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
        width: '100%', // 🟢 Растягивается на всю ширину сплиттера
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
      <SidebarHeaderUserControl title="Notes" iconPath={mdiBookmarkOutline} />

      <SearchInputUserControl
        text={noteSearchText}
        hintText="Search notes..."
        onChange={setNoteSearchText}
        onClear={() => setNoteSearchText('')}
      />

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
        {filteredNotes.length === 0 ? (
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
              <MdiIcon path={mdiFileDocumentPlusOutline} size={40} color="#7D8494" style={{ opacity: 0.5 }} />
            </div>
            <span style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>
              No Notes
            </span>
          </div>
        ) : (
          filteredNotes.map((note: INote) => {
            const isSelected = selectedNote?.id === note.id;
            const isHovered = hoveredId === note.id;
            const isEditing = editingId === note.id;
            const noteIconPath = resolveMdiIcon(note.iconKind, mdiBookmarkOutline);

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
                  backgroundColor: isSelected
                    ? '#232836'
                    : isHovered
                    ? '#1C212D'
                    : 'transparent',
                  boxSizing: 'border-box',
                  transition: 'background-color 0.12s ease',
                  position: 'relative',
                  width: 'auto', // 🟢 Занимает всю ширину контейнера
                }}
              >
                {/* Иконка 28x28 */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    marginRight: 10,
                    position: 'relative',
                    cursor: isEditing ? 'pointer' : 'default',
                    flexShrink: 0,
                  }}
                >
                  <MdiIcon
                    path={noteIconPath}
                    size={22}
                    color={note.iconColor || '#7D8494'}
                    style={{ position: 'absolute', left: 0, top: 0 }}
                  />

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

                {/* Название */}
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
                        borderBottom: '1px solid #3B82F6',
                        color: '#FFFFFF',
                        fontSize: 14.5,
                        fontWeight: 600,
                        outline: 'none',
                        padding: '2px 0',
                        caretColor: '#FFFFFF',
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
                      {note.title}
                    </span>
                  )}
                </div>

                {/* Кнопки */}
                {!isEditing && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      opacity: isHovered ? 1 : 0,
                      pointerEvents: isHovered ? 'auto' : 'none',
                      transition: 'opacity 0.15s ease',
                      flexShrink: 0,
                      marginLeft: 6,
                    }}
                  >
                    <button
                      title="Edit Note"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(note.id || null);
                        setEditingText(note.title);
                      }}
                      style={actionBtnStyle}
                    >
                      <MdiIcon path={mdiPencilOutline} size={16} color="#3B82F6" />
                    </button>

                    <button
                      title="Delete Note"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNote(note);
                      }}
                      style={actionBtnStyle}
                    >
                      <MdiIcon path={mdiTrashCanOutline} size={16} color="#EF4444" />
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

export default SidebarNotesView;