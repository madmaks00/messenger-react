import React, { useRef, useEffect, useState } from 'react';
import {
  mdiBookmarkOutline,
  mdiNotebookEditOutline,
  mdiAttachment,
  mdiEmoticonOutline,
  mdiSend,
  mdiMicrophone,
  mdiClose,
} from '@mdi/js';
import { useNotesStore } from '../../stores/notesStore';
import { NotesCanvas } from './NotesCanvas';
import { getAvatarColor, normalizeAvatarUrl } from '../../utils/helpers';
import { resolveMdiIcon } from '../../utils/iconResolver';
import { BASE_SERVER_URL } from '../../services/apiClient';
import { IMessage } from '../../types/models';
import { AttachmentType } from '../../types/enums';
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

function resolveAttachmentUrl(att: any): string {
  if (!att) return '';
  const raw =
    att.url ||
    att.Url ||
    att.localImagePath ||
    att.LocalImagePath ||
    att.thumbnailUrl ||
    att.ThumbnailUrl ||
    '';
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }
  const base = (BASE_SERVER_URL || 'https://localhost:7214').replace(/\/+$/, '');
  const clean = trimmed.replace(/^\/+/, '');
  return `${base}/${clean}`;
}

// 🟢 КОМПОНЕНТ СООБЩЕНИЯ С ДИНАМИЧЕСКИМ ФОНОМ (Прозрачный для чистого медиа, цветной при наличии текста/документов)
const NoteMessageItem: React.FC<{ msg: IMessage }> = ({ msg }) => {
  const isMy = Boolean(msg.isMyMessage);
  const firstLetter = (msg.senderName || 'U').charAt(0).toUpperCase();
  const avatarUrl = msg.senderAvatar ? normalizeAvatarUrl(msg.senderAvatar) : null;

  const validAttachments = (msg.attachments || [])
    .map((att) => ({ ...att, resolvedUrl: resolveAttachmentUrl(att) }))
    .filter((att) => Boolean(att.resolvedUrl));

  const hasText = Boolean(msg.text && msg.text.trim().length > 0);

  // Если нет ни текста, ни валидных картинок — не выводим
  if (!hasText && validAttachments.length === 0) {
    return null;
  }

  // Проверка: является ли вложение фото или видео (type 0 или 1)
  const isMediaAttachment = (type: any) =>
    type === AttachmentType.Photo || type === AttachmentType.Video || type === 0 || type === 1;

  const hasMedia = validAttachments.some((att) => isMediaAttachment(att.type));
  const hasNonMedia = validAttachments.some((att) => !isMediaAttachment(att.type));

  // 🟢 Режим "только медиа": есть фото/видео, НЕТ текста и НЕТ документов/файлов
  const isMediaOnly = !hasText && !hasNonMedia && hasMedia;

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        margin: '6px 0',
        padding: '0 20px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'flex-start',
          maxWidth: 800,
          boxSizing: 'border-box',
        }}
      >
        {/* АВАТАРКА */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: getAvatarColor(msg.senderId),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontWeight: 'bold',
            fontSize: 15,
            marginRight: 12,
            flexShrink: 0,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <span>{firstLetter}</span>
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt=""
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          )}
        </div>

        {/* ТЕЛО СООБЩЕНИЯ */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', margin: '2px 0 4px 2px' }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: isMy ? '#60A5FA' : '#E2E8F0',
                lineHeight: 1,
              }}
            >
              {msg.senderName || 'User'}
            </span>

            <span
              style={{
                fontSize: 11,
                color: '#64748B',
                marginLeft: 8,
                lineHeight: 1,
              }}
            >
              {msg.timestamp
                ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : ''}
            </span>
          </div>

          {/* 🟢 БАБЛ: прозрачный без синей обводки для одиночных фото/видео, цветной при тексте/файлах */}
          <div
            style={{
              alignSelf: 'flex-start',
              minWidth: isMediaOnly ? undefined : 40,
              borderRadius: isMediaOnly ? 10 : '0 10px 10px 10px',
              backgroundColor: isMediaOnly ? 'transparent' : isMy ? '#1E9BEB' : '#1E293B',
              color: '#FFFFFF',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            {validAttachments.length > 0 && (
              <div style={{ padding: isMediaOnly ? 0 : '2px 2px 0 2px' }}>
                {validAttachments.map((att, i) => (
                  <div
                    key={i}
                    style={{
                      maxWidth: 400,
                      maxHeight: 400,
                      borderRadius: 10,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img
                      src={att.resolvedUrl}
                      alt=""
                      style={{
                        maxWidth: '100%',
                        maxHeight: 400,
                        borderRadius: 10,
                        display: 'block',
                        objectFit: 'contain',
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {hasText && (
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: 14,
                  lineHeight: '19px',
                  wordBreak: 'break-word',
                }}
              >
                {msg.text}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const NotesWorkspaceView: React.FC = () => {
  const {
    selectedNote,
    isNoteChatMode,
    currentChatMessages,
    myNotes,
    toggleNoteView,
    sendNoteMessage,
  } = useNotesStore();

  const [inputText, setInputText] = useState('');
  const [pendingUploadFiles, setPendingUploadFiles] = useState<{ file: File; previewUrl: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isNoteChatMode && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentChatMessages, isNoteChatMode]);

  const handleSend = () => {
    if (!inputText.trim() && pendingUploadFiles.length === 0) return;
    const files = pendingUploadFiles.map((p) => p.file);
    sendNoteMessage(inputText.trim(), files);
    setInputText('');
    setPendingUploadFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files).map((f) => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
    }));

    setPendingUploadFiles((prev) => [...prev, ...newFiles]);
  };

  if (!selectedNote) {
    return (
      <div
        style={{
          flex: 1,
          width: '100%',
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
            gap: 10,
          }}
        >
          <MdiIcon path={mdiNotebookEditOutline} size={20} color="#1E9BEB" />
          <span style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 600 }}>
            {myNotes.length === 0
              ? 'Create your first note to save your thoughts'
              : 'Select a note to start creating'}
          </span>
        </div>
      </div>
    );
  }

  const noteIconPath = resolveMdiIcon(selectedNote.iconKind, mdiBookmarkOutline);

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#11141B',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ШАПКА ЗАМЕТКИ */}
      <div
        style={{
          height: 54,
          minHeight: 54,
          width: '100%',
          backgroundColor: '#161A23',
          borderBottom: '1px solid #1F2533',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 5px 0 15px',
          zIndex: 20,
          boxSizing: 'border-box',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <MdiIcon
            path={noteIconPath}
            size={22}
            color={selectedNote.iconColor || '#1E9BEB'}
            style={{ marginRight: 10 }}
          />
          <span
            style={{
              color: '#FFFFFF',
              fontSize: 15,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {selectedNote.title}
          </span>
        </div>

        <div style={{ display: 'flex', height: '100%', alignItems: 'stretch' }}>
          <button
            onClick={() => !isNoteChatMode && toggleNoteView()}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0 16px',
              fontSize: 14,
              fontWeight: isNoteChatMode ? 'bold' : 600,
              color: isNoteChatMode ? '#FFFFFF' : '#8B95A5',
              position: 'relative',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
            }}
          >
            Discussion
            {isNoteChatMode && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 16,
                  right: 16,
                  height: 3,
                  borderRadius: '1.5px 1.5px 0 0',
                  backgroundColor: '#1E9BEB',
                  boxShadow: '0 0 8px rgba(30, 155, 235, 0.8)',
                }}
              />
            )}
          </button>

          <button
            onClick={() => isNoteChatMode && toggleNoteView()}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0 16px',
              fontSize: 14,
              fontWeight: !isNoteChatMode ? 'bold' : 600,
              color: !isNoteChatMode ? '#FFFFFF' : '#8B95A5',
              position: 'relative',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
            }}
          >
            Canvas
            {!isNoteChatMode && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 16,
                  right: 16,
                  height: 3,
                  borderRadius: '1.5px 1.5px 0 0',
                  backgroundColor: '#1E9BEB',
                  boxShadow: '0 0 8px rgba(30, 155, 235, 0.8)',
                }}
              />
            )}
          </button>
        </div>
      </div>

      {/* КОНТЕНТ */}
      <div style={{ flex: 1, width: '100%', position: 'relative', overflow: 'hidden' }}>
        {isNoteChatMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', position: 'relative' }}>
            
            {/* СКРОЛЛЕР СООБЩЕНИЙ */}
            <div
              className="wpf-scroll-viewer"
              style={{
                flex: 1,
                width: '100%',
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '15px 0 85px 0',
                boxSizing: 'border-box',
              }}
            >
              {currentChatMessages.map((msg) => (
                <NoteMessageItem key={msg.id || msg.serverId} msg={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* ЭФФЕКТ ТУМАНА ВНИЗУ */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: 80,
                background: 'linear-gradient(to bottom, rgba(17, 20, 27, 0) 0%, rgba(17, 20, 27, 0.8) 50%, #11141B 100%)',
                pointerEvents: 'none',
                zIndex: 5,
              }}
            />

            {/* ПОЛЕ ВВОДА (Margin="30,0,30,20") */}
            <div
              style={{
                margin: '0 30px 20px 30px',
                position: 'relative',
                zIndex: 10,
                boxSizing: 'border-box',
              }}
            >
              {pendingUploadFiles.length > 0 && (
                <div
                  style={{
                    backgroundColor: '#1C212D',
                    borderRadius: 10,
                    margin: '0 0 5px 0',
                    padding: '5px',
                    display: 'flex',
                    gap: 8,
                  }}
                >
                  {pendingUploadFiles.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        width: 50,
                        height: 50,
                        borderRadius: 8,
                        overflow: 'hidden',
                        backgroundColor: '#232A3B',
                      }}
                    >
                      <img src={item.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        onClick={() => setPendingUploadFiles((prev) => prev.filter((_, i) => i !== idx))}
                        style={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          border: 'none',
                          color: '#FFF',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <MdiIcon path={mdiClose} size={12} color="#FFF" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div
                style={{
                  minHeight: 40,
                  maxHeight: 200,
                  backgroundColor: '#1C212D',
                  border: '1.2px solid #2A303C',
                  borderRadius: 20,
                  padding: '1px 2px 1px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  boxSizing: 'border-box',
                  width: '100%',
                }}
              >
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: 36,
                    height: 36,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#7D8494',
                    transform: 'rotate(-45deg)',
                    padding: 0,
                  }}
                  title="Attach files"
                >
                  <MdiIcon path={mdiAttachment} size={24} color="#7D8494" />
                </button>

                <input
                  type="text"
                  placeholder="Write a note or comment..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSend();
                  }}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#FFFFFF',
                    fontSize: 14,
                    padding: '8px 8px',
                    fontFamily: "'Segoe UI', -apple-system, sans-serif",
                  }}
                />

                <button
                  style={{
                    width: 36,
                    height: 36,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#7D8494',
                    marginRight: 4,
                    padding: 0,
                  }}
                >
                  <MdiIcon path={mdiEmoticonOutline} size={22} color="#7D8494" />
                </button>

                <button
                  onClick={handleSend}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: '#1E9BEB',
                    border: 'none',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    padding: 0,
                  }}
                >
                  <MdiIcon
                    path={inputText.trim() || pendingUploadFiles.length > 0 ? mdiSend : mdiMicrophone}
                    size={20}
                    color="#FFFFFF"
                  />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <NotesCanvas />
        )}
      </div>
    </div>
  );
};

export default NotesWorkspaceView;