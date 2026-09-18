import React from 'react';
import { useNotesStore } from '../../stores/notesStore';
import { NotesCanvas } from './NotesCanvas';
import { MessageInputUserControl } from '../chat/MessageInputUserControl';

export const NotesWorkspaceView: React.FC = () => {
  const {
    selectedNote,
    isNoteChatMode,
    currentChatMessages,
    toggleNoteView,
  } = useNotesStore();

  if (!selectedNote) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0B141B', color: '#64748B' }}>
        <div style={{ padding: '16px 24px', borderRadius: 20, background: '#1E293B', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>🔖</span>
          <span style={{ color: '#E2E8F0', fontWeight: 600 }}>Select a note to start creating</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#0B141B', overflow: 'hidden' }}>
      {/* 0. ШАПКА В СТИЛЕ И РАЗМЕРАХ ЧАТА (54px) */}
      <div
        style={{
          height: 54,
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #1E293B',
          backgroundColor: '#161B26',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22, color: selectedNote.iconColor || '#3B82F6' }}>🔖</span>
          <span style={{ fontSize: 16, fontWeight: 'bold', color: '#FFF' }}>{selectedNote.title}</span>
        </div>

        {/* Переключатель Discussion / Canvas */}
        <div style={{ display: 'flex', height: '100%' }}>
          <button
            onClick={() => !isNoteChatMode && toggleNoteView()}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0 16px',
              fontSize: 14,
              fontWeight: 600,
              color: isNoteChatMode ? '#FFF' : '#8696A0',
              borderBottom: isNoteChatMode ? '3px solid #3B82F6' : '3px solid transparent',
              cursor: 'pointer',
            }}
          >
            Discussion
          </button>
          <button
            onClick={() => isNoteChatMode && toggleNoteView()}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0 16px',
              fontSize: 14,
              fontWeight: 600,
              color: !isNoteChatMode ? '#FFF' : '#8696A0',
              borderBottom: !isNoteChatMode ? '3px solid #3B82F6' : '3px solid transparent',
              cursor: 'pointer',
            }}
          >
            Canvas
          </button>
        </div>
      </div>

      {/* 1. КОНТЕНТ (ЧАТ ИЛИ ХОЛСТ) */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {isNoteChatMode ? (
          /* РЕЖИМ DISCUSSION: ЛЕНТА СООБЩЕНИЙ ЗАМЕТКИ */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 0' }}>
              <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 20px' }}>
                {currentChatMessages.map((msg) => (
                  <div
                    key={msg.id || msg.serverId}
                    style={{
                      display: 'flex',
                      gap: 12,
                      marginBottom: 16,
                      justifyContent: msg.isMyMessage ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {!msg.isMyMessage && (
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: '#3B82F6',
                          color: '#FFF',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {(msg.senderName || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div
                      style={{
                        maxWidth: 480,
                        borderRadius: 12,
                        padding: '10px 14px',
                        backgroundColor: msg.isMyMessage ? '#2B5278' : '#182533',
                        color: '#FFF',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#38BDF8' }}>
                          {msg.senderName || 'Unknown User'}
                        </span>
                        <span style={{ fontSize: 11, opacity: 0.6 }}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, lineHeight: '19px' }}>{msg.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Модуль ввода комментариев/сообщений */}
            <div style={{ padding: '0 30px 20px 30px', zIndex: 10 }}>
              <MessageInputUserControl />
            </div>
          </div>
        ) : (
          /* РЕЖИМ ХОЛСТА */
          <NotesCanvas />
        )}
      </div>
    </div>
  );
};