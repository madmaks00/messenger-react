import React, { useState } from 'react';
import { useNotesStore } from '../../stores/notesStore';
import { INote } from '../../types/models';

const ITEM_HEIGHT = 50;

export const SidebarNotesView: React.FC = () => {
  const {
    myNotes,
    selectedNote,
    noteSearchText,
    selectNote,
    setNoteSearchText,
    createNewNote,
    deleteNote,
    commitEditNote,
  } = useNotesStore();

  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  const filteredNotes = myNotes.filter((n) =>
    n.title.toLowerCase().includes(noteSearchText.toLowerCase())
  );

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      {/* 0: ШАПКА */}
      <div style={{ height: 52, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1E293B' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 'bold', color: '#FFF' }}>
          <span>🔖</span>
          <span>Notes</span>
        </div>
        <button
          onClick={createNewNote}
          title="New Note"
          style={{ background: 'transparent', border: 'none', color: 'var(--app-accent, #3B82F6)', fontSize: 18, cursor: 'pointer' }}
        >
          ➕
        </button>
      </div>

      {/* 1: ПОИСК */}
      <div style={{ padding: '8px 12px' }}>
        <input
          type="text"
          placeholder="Search notes..."
          value={noteSearchText}
          onChange={(e) => setNoteSearchText(e.target.value)}
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

      {/* 2: СПИСОК ЗАМЕТОК (Шаг 50px из XAML) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {filteredNotes.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 100, color: '#64748B' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📑</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#FFF' }}>No Notes</div>
          </div>
        ) : (
          filteredNotes.map((note) => {
            const isSelected = selectedNote?.id === note.id;
            const isHovered = hoveredId === note.id;
            const isEditing = editingId === note.id;

            return (
              <div
                key={note.id}
                onMouseEnter={() => setHoveredId(note.id || null)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => !isEditing && selectNote(note)}
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
                {/* Иконка + Карандашик при редактировании */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <div style={{ position: 'relative', width: 28, height: 28 }}>
                    <span style={{ fontSize: 20, color: note.iconColor || '#3B82F6' }}>🔖</span>
                    {isEditing && (
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

                  {/* Название или инпут переименования */}
                  {isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      maxLength={30}
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          commitEditNote(note, editingText);
                          setEditingId(null);
                        }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onBlur={() => {
                        commitEditNote(note, editingText);
                        setEditingId(null);
                      }}
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
                      {note.title}
                    </span>
                  )}
                </div>

                {/* Кнопки Edit / Delete */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {isHovered && !isEditing && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(note.id || null);
                          setEditingText(note.title);
                        }}
                        style={miniBtnStyle}
                        title="Edit title"
                      >
                        ✏
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNote(note);
                        }}
                        style={{ ...miniBtnStyle, color: '#EF4444' }}
                        title="Delete note"
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

const miniBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#94A3B8',
  fontSize: 13,
  cursor: 'pointer',
  padding: 4,
};