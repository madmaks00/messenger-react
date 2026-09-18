import React, { useRef, useEffect } from 'react';
import { useMessageInputStore } from '../../stores/messageInputStore';
import { useChatStore } from '../../stores/chatStore';
import { useEmojiStore } from '../../stores/emojiStore';
import { EmojiPickerUserControl } from './EmojiPickerUserControl';

export const MessageInputUserControl: React.FC = () => {
  const {
    newMessageText,
    editingMessage,
    replyingToMessages,
    pendingAttachments,
    isRecordingVoice,
    recordingTimeStr,
    hintText,
    canWriteMessages,
    canSendText,
    canSendMedia,
    isBlockedByMe,
    isBlockedByThem,
    isGroup,
    isChannel,
    isCurrentChatJoined,
    isAdmin,
    setNewMessageText,
    cancelEdit,
    cancelReply,
    addPendingAttachments,
    removePendingAttachment,
    startVoiceRecording,
    cancelVoiceRecording,
    stopAndSendVoiceRecording,
  } = useMessageInputStore();

  const { sendMessage } = useChatStore();
  const { togglePicker } = useEmojiStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputTextBoxRef = useRef<HTMLTextAreaElement>(null);

  // Автоматический пересчет высоты textarea под контент (до 200px)
  useEffect(() => {
    if (inputTextBoxRef.current) {
      inputTextBoxRef.current.style.height = 'auto';
      inputTextBoxRef.current.style.height = `${Math.min(inputTextBoxRef.current.scrollHeight, 200)}px`;
    }
  }, [newMessageText]);

  // Фокус поля при изменении реплаев или редактирования
  useEffect(() => {
    if ((editingMessage || replyingToMessages.length > 0) && inputTextBoxRef.current) {
      inputTextBoxRef.current.focus();
    }
  }, [editingMessage, replyingToMessages.length]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        return; // Shift + Enter: перенос строки
      }
      e.preventDefault(); // Enter: отправка
      handleSendAction();
    }
  };

  const handleSendAction = async () => {
    if (isRecordingVoice) {
      await stopAndSendVoiceRecording();
      return;
    }

    const text = newMessageText.trim();
    if (!text && pendingAttachments.length === 0) return;

    await sendMessage(text, pendingAttachments, editingMessage, replyingToMessages);
    setNewMessageText('');
    cancelEdit();
    cancelReply();
    if (inputTextBoxRef.current) {
      inputTextBoxRef.current.style.height = 'auto';
    }
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addPendingAttachments(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const hasAttachments = pendingAttachments.length > 0;
  const hasText = newMessageText.trim().length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', position: 'relative' }}>
      {/* 1. ПЛАШКА РЕДАКТИРОВАНИЯ СООБЩЕНИЯ */}
      {editingMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#1E293B',
            borderLeft: '2px solid var(--app-accent, #3B82F6)',
            margin: '8px 20px 5px 20px',
            padding: '5px 10px',
            borderRadius: '0 8px 8px 0',
          }}
        >
          <span style={{ fontSize: 18, color: 'var(--app-accent, #3B82F6)', marginRight: 10 }}>✏</span>
          <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--app-accent, #3B82F6)' }}>Edit Message</span>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>
                {new Date(editingMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {editingMessage.text || 'Attachment'}
            </div>
          </div>
          <button onClick={cancelEdit} style={closeToolBtnStyle} title="Cancel Edit">✕</button>
        </div>
      )}

      {/* 2. ПЛАШКА ЦИТИРОВАНИЯ (REPLY) */}
      {replyingToMessages.length > 0 && !editingMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            backgroundColor: '#1E293B',
            borderLeft: '2px solid var(--app-accent, #3B82F6)',
            margin: '0 20px 5px 20px',
            padding: '5px 10px',
            borderRadius: '0 8px 8px 0',
          }}
        >
          <span style={{ fontSize: 20, color: 'var(--app-accent, #3B82F6)', margin: '2px 10px 0 5px' }}>↩</span>
          <div style={{ flex: 1, maxHeight: 80, overflowY: 'auto', marginRight: 10 }}>
            {replyingToMessages.map((rep) => (
              <div key={rep.id || rep.serverId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '3px 0' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--app-accent, #3B82F6)' }}>{rep.senderName}</div>
                  <div style={{ fontSize: 13, color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {rep.text || 'Attachment'}
                  </div>
                </div>
                <button onClick={() => cancelReply(rep)} style={closeToolBtnStyle} title="Remove Quote">✕</button>
              </div>
            ))}
          </div>
          <button onClick={() => cancelReply()} style={{ ...closeToolBtnStyle, fontSize: 16 }} title="Cancel All Replies">✕</button>
        </div>
      )}

      {/* 3. ОСНОВНОЙ КОНТРОЛ ВВОДА / ПРЕДУПРЕЖДЕНИЯ */}
      <div>
        {/* Блокировка мною */}
        {isBlockedByMe && (
          <div style={warningBarStyle}>
            <span style={{ fontSize: 18, color: '#EF4444', marginRight: 8 }}>🚫</span>
            <span style={{ color: '#F8FAFC', fontSize: 14, fontWeight: 600 }}>This user is in your blacklist</span>
          </div>
        )}

        {/* Блокировка собеседником */}
        {isBlockedByThem && (
          <div style={warningBarStyle}>
            <span style={{ fontSize: 18, color: '#EF4444', marginRight: 8 }}>🚫</span>
            <span style={{ color: '#F8FAFC', fontSize: 14, fontWeight: 600 }}>You are in this user's blacklist. You cannot send messages.</span>
          </div>
        )}

        {/* Запрет на отправку сообщений в группе */}
        {!canWriteMessages && isGroup && isCurrentChatJoined && !isAdmin && !canSendText && (
          <div style={{ ...warningBarStyle, height: 45, opacity: 0.7 }}>
            <span style={{ fontSize: 18, marginRight: 8 }}>🔇</span>
            <span style={{ color: '#F8FAFC', fontSize: 14, fontWeight: 600 }}>Sending messages is disabled in this group by administrator.</span>
          </div>
        )}

        {/* Кнопка вступления в группу / канал */}
        {isGroup && !isCurrentChatJoined && !isBlockedByMe && !isBlockedByThem && (
          <div style={{ ...warningBarStyle, height: 45 }}>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('JoinCurrentChatRequestMessage'))}
              style={{ background: 'transparent', border: 'none', color: 'var(--app-accent, #3B82F6)', fontSize: 15, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span>🚪</span>
              <span>{isChannel ? 'JOIN CHANNEL' : 'JOIN GROUP'}</span>
            </button>
          </div>
        )}

        {/* АКТИВНОЕ ПОЛЕ ВВОДА */}
        {canWriteMessages && (
          <div>
            {/* Горизонтальная лента прикрепленных файлов */}
            {hasAttachments && (
              <div style={{ display: 'flex', gap: 8, padding: 6, backgroundColor: '#1E293B', borderRadius: 10, marginBottom: 5, overflowX: 'auto' }}>
                {pendingAttachments.map((att, idx) => (
                  <div key={att.id || idx} style={{ position: 'relative', width: 60, height: 60, flexShrink: 0, borderRadius: 8, overflow: 'hidden', backgroundColor: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {att.type === 0 && att.url ? (
                      <img src={att.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 24, color: '#94A3B8' }}>📄</span>
                    )}
                    <button
                      onClick={() => removePendingAttachment(idx)}
                      style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: 10, background: 'rgba(0,0,0,0.6)', color: '#FFF', border: 'none', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Инпут-бар */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                minHeight: 40,
                maxHeight: 200,
                backgroundColor: isRecordingVoice ? '#1E293B' : 'var(--input-area-bg, #1E293B)',
                border: '1.2px solid #334155',
                borderRadius: 20,
                padding: '4px 10px',
                boxSizing: 'border-box',
                position: 'relative',
              }}
            >
              {/* 1. Кнопка скрепки */}
              {!isRecordingVoice && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ background: 'transparent', border: 'none', width: 36, height: 36, color: '#94A3B8', fontSize: 20, cursor: 'pointer', transform: 'rotate(-45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}
                  title="Attach file"
                >
                  📎
                </button>
              )}
              <input ref={fileInputRef} type="file" multiple onChange={handleFileSelection} style={{ display: 'none' }} />

              {/* 2. Текстовое поле ввода */}
              {!isRecordingVoice && (
                <textarea
                  ref={inputTextBoxRef}
                  rows={1}
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={hintText || 'Message...'}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#FFFFFF',
                    fontSize: 14,
                    lineHeight: '20px',
                    resize: 'none',
                    maxHeight: 200,
                    padding: '8px 8px',
                    fontFamily: 'inherit',
                  }}
                />
              )}

              {/* 3. Панель записи голосового */}
              {isRecordingVoice && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF3B30', animation: 'pulse 1s infinite' }} />
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#FFFFFF' }}>{recordingTimeStr}</span>
                  <span style={{ fontSize: 13, color: '#94A3B8' }}>Recording voice message...</span>
                </div>
              )}

              {/* 4. Кнопка Эмодзи */}
              {!isRecordingVoice && (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={togglePicker}
                    style={{ background: 'transparent', border: 'none', width: 36, height: 36, color: '#94A3B8', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}
                    title="Emoji"
                  >
                    😊
                  </button>
                  <EmojiPickerUserControl />
                </div>
              )}

              {/* 5. Кнопка отмены записи */}
              {isRecordingVoice && (
                <button
                  onClick={cancelVoiceRecording}
                  style={{ background: 'transparent', border: 'none', width: 36, height: 36, color: '#FF3B30', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}
                  title="Cancel recording"
                >
                  ✕
                </button>
              )}

              {/* 6. Кнопка действия (Отправка / Микрофон / Готово) */}
              <button
                onClick={
                  isRecordingVoice
                    ? stopAndSendVoiceRecording
                    : hasAttachments || hasText
                    ? handleSendAction
                    : startVoiceRecording
                }
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: 'var(--app-accent, #3B82F6)',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  marginLeft: 4,
                  marginBottom: 1,
                  flexShrink: 0,
                }}
              >
                {isRecordingVoice ? '✓' : hasAttachments || hasText ? '➤' : '🎤'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const closeToolBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#94A3B8',
  cursor: 'pointer',
  padding: 4,
  fontSize: 14,
};

const warningBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#1E293B',
  border: '1.2px solid #334155',
  borderRadius: 20,
  height: 40,
  padding: '0 20px',
  boxSizing: 'border-box',
};