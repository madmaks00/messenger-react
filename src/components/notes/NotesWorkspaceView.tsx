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
import { getAvatarColor } from '../../utils/helpers';
import { resolveMdiIcon } from '../../utils/iconResolver';
import { IAttachment } from '../../types/models';
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
  const [pendingFiles, setPendingFiles] = useState<IAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isNoteChatMode && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentChatMessages, isNoteChatMode]);

  const handleSend = () => {
    if (!inputText.trim() && pendingFiles.length === 0) return;
    sendNoteMessage(inputText.trim(), pendingFiles);
    setInputText('');
    setPendingFiles([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: IAttachment[] = Array.from(files).map((f, idx) => ({
  id: Date.now() + idx,
  messageId: 0,
  type: f.type.startsWith('image/') ? AttachmentType.Photo : AttachmentType.Document,
  fileName: f.name,
  fileSizeStr: `${(f.size / 1024).toFixed(1)} KB`,
  fileSizeBytes: f.size,
  url: URL.createObjectURL(f),
  localImagePath: URL.createObjectURL(f),
  hasAudio: false,
  width: 0,
  height: 0,
  durationSeconds: 0,
}));

    setPendingFiles((prev) => [...prev, ...newAttachments]);
  };

  // Заглушка, если заметка не выбрана (NullToVisibilityConverter)
  if (!selectedNote) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#11141B', // BgChat
          userSelect: 'none',
        }}
      >
        <div
          style={{
            padding: '10px 20px',
            borderRadius: 20,
            backgroundColor: '#1C212D', // NotesEmptyStateBgBrush
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
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#11141B', // BgChat
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ======================================================== */}
      {/* 🟢 СЛОЙ 0: ШАПКА 1 В 1 С XAML (Высота 54px, Padding 15,0,5,0) */}
      {/* ======================================================== */}
      <div
        style={{
          height: 54,
          minHeight: 54,
          backgroundColor: '#161A23', // ChatHeaderBackgroundBrush
          borderBottom: '1px solid #1F2533', // ChatHeaderBorderBrush
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 5px 0 15px',
          zIndex: 20,
          boxSizing: 'border-box',
          userSelect: 'none',
        }}
      >
        {/* СЛЕВА: НАЗВАНИЕ ЗАМЕТКИ И ДИНАМИЧЕСКАЯ ИКОНКА */}
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <MdiIcon
            path={noteIconPath}
            size={22}
            color={selectedNote.iconColor || '#1E9BEB'}
            style={{ marginRight: 10 }}
          />
          <span
            style={{
              color: '#FFFFFF', // ChatHeaderTitleBrush
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

        {/* СПРАВА: ЧИСТЫЕ ВКЛАДКИ С ПОДЧЕРКИВАНИЕМ (HeaderTabButtonStyle) */}
        <div style={{ display: 'flex', height: '100%', alignItems: 'stretch' }}>
          <button
            onClick={() => !isNoteChatMode && toggleNoteView()}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0 16px',
              fontSize: 14,
              fontWeight: isNoteChatMode ? 'bold' : 600,
              color: isNoteChatMode ? '#FFFFFF' : '#8B95A5', // NotesHeaderFloatingModesInactiveTextBrush
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
                  backgroundColor: '#1E9BEB', // AppAccentBrush
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

      {/* ======================================================== */}
      {/* 🟢 СЛОЙ 1: КОНТЕНТ (ЧАТ ОБСУЖДЕНИЯ ИЛИ ХОЛСТ)           */}
      {/* ======================================================== */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {isNoteChatMode ? (
          /* РЕЖИМ 2: ОБСУЖДЕНИЕ (CHAT) */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
            
            {/* СПИСОК СООБЩЕНИЙ ЗАМЕТКИ: NoteMessagesList */}
            <div
              className="wpf-scroll-viewer"
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '15px 0 85px 0', // ItemsPresenter Margin="0,15,0,40" + запас под инпут
                boxSizing: 'border-box',
              }}
            >
              {/* Grid MaxWidth="800" HorizontalAlignment="Center" Margin="15,0" */}
              <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 15px' }}>
                {currentChatMessages.map((msg) => {
                  const isMy = Boolean(msg.isMyMessage);
                  const firstLetter = (msg.senderName || 'U').charAt(0).toUpperCase();

                  return (
                    <div
                      key={msg.id || msg.serverId}
                      style={{
                        display: 'flex',
                        margin: '6px 0', // Margin="0,6"
                        alignItems: 'flex-start',
                      }}
                    >
                      {/* 1. АВАТАРКА СЛЕВА 40x40 (Margin="0,0,12,0") */}
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
                        {msg.senderAvatar && (
                          <img
                            src={msg.senderAvatar}
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

                      {/* 2. КОНТЕНТ СООБЩЕНИЯ (StackPanel Grid.Column="1") */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        
                        {/* Шапка сообщения: SenderNameText + Timestamp */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', margin: '2px 0 4px 2px' }}>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: isMy ? '#60A5FA' : '#E2E8F0', // NotesChatMyAuthorNameBrush (#60A5FA) : NotesChatAuthorNameBrush (#E2E8F0)
                              lineHeight: 1,
                            }}
                          >
                            {msg.senderName || (isMy ? 'Me' : 'Unknown User')}
                          </span>

                          <span
                            style={{
                              fontSize: 11,
                              color: '#64748B', // NotesChatTimestampBrush
                              marginLeft: 8,
                              lineHeight: 1,
                            }}
                          >
                            {msg.timestamp
                              ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : ''}
                          </span>
                        </div>

                        {/* Плашка (Бабл) сообщения: CornerRadius="0,10,10,10" HorizontalAlignment="Left" MinWidth="40" */}
                        <div
                          style={{
                            alignSelf: 'flex-start',
                            minWidth: 40,
                            borderRadius: '0 10px 10px 10px',
                            backgroundColor: isMy ? '#1E9BEB' : '#1E293B', // NotesChatMyBubbleBgBrush (#1E9BEB) : NotesChatOtherBubbleBgBrush (#1E293B)
                            color: '#FFFFFF',
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                          }}
                        >
                          {/* Вложения (если есть) */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div style={{ padding: '2px 2px 0 2px' }}>
                              {msg.attachments.map((att, i) => (
                                <img
                                  key={i}
                                  src={att.url || att.localImagePath || undefined}
                                  alt=""
                                  style={{
                                    maxWidth: 400,
                                    maxHeight: 400,
                                    borderRadius: 10,
                                    display: 'block',
                                  }}
                                />
                              ))}
                            </div>
                          )}

                          {/* Текст сообщения: Padding="12,8" FontSize="14" */}
                          {msg.text && (
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
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* ЭФФЕКТ ТУМАНА (Height="80" LinearGradientBrush) */}
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

            {/* 🟢 ЕДИНЫЙ МОДУЛЬНЫЙ КОНТРОЛ ВВОДА: MessageInputUserControl Margin="30,0,30,20" */}
            <div
              style={{
                margin: '0 30px 20px 30px',
                position: 'relative',
                zIndex: 10,
              }}
            >
              {/* Полоса прикрепленных файлов */}
              {pendingFiles.length > 0 && (
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
                  {pendingFiles.map((file, idx) => (
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
                      <img src={file.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
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

              {/* Инпут-бар 1 в 1 с XAML: BorderBrush="#2A303C" BorderThickness="1.2" CornerRadius="20" Padding="10,1,2,1" MinHeight="40" MaxHeight="200" */}
              <div
                style={{
                  minHeight: 40,
                  maxHeight: 200,
                  backgroundColor: '#1C212D', // InputAreaBackgroundBrush
                  border: '1.2px solid #2A303C', // InputAreaBorderBrush
                  borderRadius: 20,
                  padding: '1px 2px 1px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  boxSizing: 'border-box',
                }}
              >
                {/* 1. Кнопка скрепки 36x36 (Rotate -45°) */}
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

                {/* 2. Текстовое поле ввода: Hint="Write a note or comment..." */}
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
                    color: '#FFFFFF', // InputAreaTextBrush
                    fontSize: 14,
                    padding: '8px 8px',
                    fontFamily: "'Segoe UI', -apple-system, sans-serif",
                  }}
                />

                {/* 3. Кнопка Эмодзи 36x36 */}
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

                {/* 4. Кнопка действия (Отправка / Микрофон 38x38 #1E9BEB) */}
                <button
                  onClick={handleSend}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: '#1E9BEB', // AppAccentBrush
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
                    path={inputText.trim() || pendingFiles.length > 0 ? mdiSend : mdiMicrophone}
                    size={20}
                    color="#FFFFFF"
                  />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* РЕЖИМ 1: ХОЛСТ (CANVAS) */
          <NotesCanvas />
        )}
      </div>
    </div>
  );
};

export default NotesWorkspaceView;