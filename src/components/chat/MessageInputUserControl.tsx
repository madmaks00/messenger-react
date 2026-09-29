import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  mdiPencil,
  mdiReply,
  mdiClose,
  mdiBlockHelper,
  mdiVolumeOff,
  mdiLogin,
  mdiFileDocumentOutline,
  mdiAttachment,
  mdiEmoticonOutline,
  mdiMicrophone,
  mdiSend,
  mdiCheck,
} from '@mdi/js';
import { mediaDimensionsCache } from '../../utils/mediaDimensionsCache';
import { useMessageInputStore } from '../../stores/messageInputStore';
import { useChatStore } from '../../stores/chatStore';
import { useEmojiStore } from '../../stores/emojiStore';
import { EmojiPickerUserControl } from './EmojiPickerUserControl';
import { AttachmentType } from '../../types/enums';

const COLORS = {
  accent: '#1E9BEB',
  inputBg: '#1C212D',
  inputBorder: '#2A303C',
  inputText: '#FFFFFF',
  textMuted: '#7D8494',
  warningBg: '#1C212D',
  warningBorder: '#E74C3C',
  warningText: '#FFFFFF',
  activeToggleBg: '#2AFFFFFF',
  hoverWhite: '#FFFFFF',
};

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
    isBlockedByMe,
    isBlockedByThem,
    isGroup,
    isChannel,
    isCurrentChatJoined,
    isAdmin,
    setNewMessageText,
    cancelEdit,
    cancelReply,
    removePendingAttachment,
    addPendingAttachments,
    startVoiceRecording,
    cancelVoiceRecording,
    stopAndSendVoiceRecording,
  } = useMessageInputStore();

  const { sendMessage } = useChatStore();
  const { isEmojiPickerOpen, togglePicker } = useEmojiStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputTextBoxRef = useRef<HTMLTextAreaElement>(null);

  const [isClipHovered, setIsClipHovered] = useState(false);
  const [isEmojiHovered, setIsEmojiHovered] = useState(false);

  const focusInputField = useCallback(() => {
    if (inputTextBoxRef.current) {
      inputTextBoxRef.current.focus();
      const len = inputTextBoxRef.current.value.length;
      inputTextBoxRef.current.setSelectionRange(len, len);
    }
  }, []);

  useEffect(() => {
    if (inputTextBoxRef.current) {
      inputTextBoxRef.current.style.height = 'auto';
      inputTextBoxRef.current.style.height = `${Math.min(inputTextBoxRef.current.scrollHeight, 180)}px`;
    }
  }, [newMessageText]);

  useEffect(() => {
    if (editingMessage || replyingToMessages.length > 0) {
      focusInputField();
    }
  }, [editingMessage, replyingToMessages.length, focusInputField]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) return;
      e.preventDefault();
      handleSendAction();
    }
  };

  const handleSendAction = () => {
    if (isRecordingVoice) {
      void stopAndSendVoiceRecording();
      return;
    }

    const text = (newMessageText || '').trim();
    const attachmentsToSend = [...pendingAttachments];
    const editMsg = editingMessage;
    const replies = [...replyingToMessages];

    if (!text && attachmentsToSend.length === 0) return;

    setNewMessageText('');
    cancelEdit();
    cancelReply();
    if (inputTextBoxRef.current) {
      inputTextBoxRef.current.style.height = 'auto';
    }

    void sendMessage(text, attachmentsToSend, editMsg, replies);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files);
      e.target.value = '';

      for (const file of fileList) {
        if (file.type.startsWith('image/')) {
          await new Promise<void>((resolve) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            img.onload = () => {
              (file as any).width = img.naturalWidth;
              (file as any).height = img.naturalHeight;
              
              mediaDimensionsCache.set(file.name, { width: img.naturalWidth, height: img.naturalHeight });
              mediaDimensionsCache.set(objectUrl, { width: img.naturalWidth, height: img.naturalHeight });
              resolve();
            };
            img.onerror = () => {
              resolve();
            };
            img.src = objectUrl;
          });
        }
      }

      void addPendingAttachments(fileList);
    }
  };

  const hasAttachments = pendingAttachments && pendingAttachments.length > 0;
  const hasText = Boolean(newMessageText && newMessageText.trim().length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box' }}>
      
      <style>{`
        .wpf-message-input::placeholder {
          color: rgba(255, 255, 255, 0.56) !important;
          opacity: 1 !important;
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif !important;
          font-size: 14px !important;
        }
        .wpf-message-input::-webkit-input-placeholder {
          color: rgba(255, 255, 255, 0.56) !important;
          opacity: 1 !important;
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif !important;
          font-size: 14px !important;
        }
        .wpf-message-input::-moz-placeholder {
          color: rgba(255, 255, 255, 0.56) !important;
          opacity: 1 !important;
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif !important;
          font-size: 14px !important;
        }
        .wpf-message-input:-ms-input-placeholder {
          color: rgba(255, 255, 255, 0.56) !important;
          opacity: 1 !important;
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif !important;
          font-size: 14px !important;
        }
      `}</style>

      {/* 1. ПЛАШКА РЕДАКТИРОВАНИЯ */}
      {editingMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: COLORS.inputBg,
            borderLeft: `2px solid ${COLORS.accent}`,
            margin: '8px 20px 5px 20px',
            padding: '5px 10px',
            borderRadius: '0 8px 8px 0',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ marginRight: 10, display: 'flex', alignItems: 'center' }}>
            <MdiIcon path={mdiPencil} size={20} color={COLORS.accent} />
          </div>

          <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.accent }}>Edit Message</span>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>
                {editingMessage.timestamp
                  ? new Date(editingMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : ''}
              </span>
            </div>
            <div
              style={{
                fontSize: 13,
                color: COLORS.textMuted,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {editingMessage.text || 'Media message'}
            </div>
          </div>

          <button onClick={cancelEdit} title="Cancel edit" style={actionCloseButtonStyle(26)}>
            <MdiIcon path={mdiClose} size={16} color={COLORS.textMuted} />
          </button>
        </div>
      )}

      {/* 2. ПЛАШКА ЦИТИРОВАНИЯ */}
      {replyingToMessages.length > 0 && !editingMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            backgroundColor: COLORS.inputBg,
            borderLeft: `2px solid ${COLORS.accent}`,
            margin: '0 20px 5px 20px',
            padding: '5px 10px 5px 5px',
            borderRadius: '0 8px 8px 0',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ margin: '5px 10px 0 5px', display: 'flex', alignItems: 'center' }}>
            <MdiIcon path={mdiReply} size={24} color={COLORS.accent} />
          </div>

          <div style={{ flex: 1, maxHeight: 80, overflowY: 'auto', marginRight: 10 }} className="wpf-scroll-viewer">
            {replyingToMessages.map((rep: any) => (
              <div
                key={rep.id || rep.serverId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  margin: '3px 0',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.accent }}>
                    {rep.senderName || 'Message'}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: COLORS.textMuted,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {rep.text || 'Attachment'}
                  </div>
                </div>

                <button onClick={() => cancelReply(rep)} style={{ ...actionCloseButtonStyle(24), margin: '0 15px 0 10px' }}>
                  <MdiIcon path={mdiClose} size={16} color="#777777" />
                </button>
              </div>
            ))}
          </div>

          <button onClick={() => cancelReply()} style={actionCloseButtonStyle(28)}>
            <MdiIcon path={mdiClose} size={20} color={COLORS.textMuted} />
          </button>
        </div>
      )}

      {/* 3. ОСНОВНАЯ ОБЛАСТЬ ВВОДА / ПРЕДУПРЕЖДЕНИЯ */}
      <div>
        {isBlockedByMe && (
          <div style={warningBarStyle}>
            <MdiIcon path={mdiBlockHelper} size={20} color={COLORS.warningBorder} style={{ marginRight: 8 }} />
            <span style={{ color: COLORS.warningText, fontSize: 14, fontWeight: 600 }}>This user is in your blacklist</span>
          </div>
        )}

        {isBlockedByThem && (
          <div style={warningBarStyle}>
            <MdiIcon path={mdiBlockHelper} size={20} color={COLORS.warningBorder} style={{ marginRight: 8 }} />
            <span style={{ color: COLORS.warningText, fontSize: 14, fontWeight: 600 }}>You are in this user's blacklist. You cannot send messages.</span>
          </div>
        )}

        {!canWriteMessages && isGroup && isCurrentChatJoined && !isAdmin && !canSendText && (
          <div style={{ ...warningBarStyle, height: 45, opacity: 0.7 }}>
            <MdiIcon path={mdiVolumeOff} size={20} color={COLORS.warningText} style={{ marginRight: 8 }} />
            <span style={{ color: COLORS.warningText, fontSize: 14, fontWeight: 600 }}>Sending messages is disabled in this group by administrator.</span>
          </div>
        )}

        {isGroup && !isCurrentChatJoined && !isBlockedByMe && !isBlockedByThem && (
          <div style={{ ...warningBarStyle, height: 45 }}>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('JoinCurrentChatRequestMessage'))}
              style={{
                background: 'transparent',
                border: 'none',
                color: COLORS.accent,
                fontSize: 15,
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <MdiIcon path={mdiLogin} size={20} color={COLORS.accent} />
              <span>{isChannel ? 'JOIN CHANNEL' : 'JOIN GROUP'}</span>
            </button>
          </div>
        )}

        {/* АКТИВНОЕ ПОЛЕ ВВОДА */}
        {canWriteMessages && (
          <div>
            {/* 🟢 ЛЕНТА ПРИКРЕПЛЕННЫХ ФАЙЛОВ С ПОДДЕРЖКОЙ ВИДЕО И ГИФ */}
            {hasAttachments && (
              <div
                style={{
                  background: COLORS.inputBg,
                  borderRadius: 10,
                  margin: '0 0 5px 0',
                  padding: 5,
                  display: 'flex',
                  gap: 8,
                  overflowX: 'auto',
                }}
              >
                {pendingAttachments.map((att: any, idx: number) => {
                  const isVideoOrGif =
                    att.type === AttachmentType.Video ||
                    att.fileSizeStr === 'GIF' ||
                    (att.rawFile && (att.rawFile.type.startsWith('video/') || att.rawFile.name.toLowerCase().endsWith('.gif')));

                  return (
                    <div
                      key={att.id || idx}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 8,
                        position: 'relative',
                        background: '#232A3B',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {att.displayImageUrl ? (
                        <img
                          src={att.displayImageUrl}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : isVideoOrGif && att.url ? (
                        <video
                          src={`${att.url}#t=0.001`}
                          muted
                          playsInline
                          preload="metadata"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            pointerEvents: 'none',
                          }}
                        />
                      ) : att.url && (att.type === AttachmentType.Photo || (att.rawFile && att.rawFile.type.startsWith('image/'))) ? (
                        <img
                          src={att.url}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <MdiIcon path={mdiFileDocumentOutline} size={30} color="#5E92CE" />
                      )}

                      <button
                        onClick={() => removePendingAttachment(idx)}
                        style={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          background: 'rgba(0, 0, 0, 0.7)',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          zIndex: 5,
                        }}
                      >
                        <MdiIcon path={mdiClose} size={12} color="#FFFFFF" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ИНПУТ-КАПСУЛА */}
            <div
              style={{
                border: `1.2px solid ${COLORS.inputBorder}`,
                borderRadius: 20,
                padding: '2px 5px 2px 7px',
                minHeight: 46,
                maxHeight: 200,
                backgroundColor: isRecordingVoice ? '#1C212D' : COLORS.inputBg,
                display: 'flex',
                alignItems: 'flex-end',
                boxSizing: 'border-box',
                position: 'relative',
              }}
            >
              {!isRecordingVoice && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  onMouseEnter={() => setIsClipHovered(true)}
                  onMouseLeave={() => setIsClipHovered(false)}
                  title="Attach file"
                  style={{
                    width: 36,
                    height: 36,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 2,
                    borderRadius: 18,
                    flexShrink: 0,
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  <div style={{ transform: 'rotate(-45deg)', display: 'flex', alignItems: 'center' }}>
                    <MdiIcon
                      path={mdiAttachment}
                      size={26}
                      color={isClipHovered ? COLORS.hoverWhite : COLORS.textMuted}
                    />
                  </div>
                </button>
              )}
              <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} style={{ display: 'none' }} />

              {!isRecordingVoice && (
                <textarea
                  ref={inputTextBoxRef}
                  className="wpf-message-input"
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
                    color: COLORS.inputText,
                    caretColor: '#FFFFFF',
                    fontSize: 14,
                    lineHeight: '20px',
                    padding: '8px 8px 10px 8px',
                    resize: 'none',
                    maxHeight: 180,
                    fontFamily: 'Segoe UI, -apple-system, BlinkMacSystemFont, Roboto, sans-serif',
                    boxSizing: 'border-box',
                  }}
                />
              )}

              {isRecordingVoice && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', height: 40, marginLeft: 10 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: '#FF3B30',
                      marginRight: 10,
                      animation: 'pulse 1s infinite ease-in-out',
                    }}
                  />
                  <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.inputText, marginRight: 15 }}>
                    {recordingTimeStr}
                  </span>
                  <span style={{ fontSize: 13, color: COLORS.textMuted }}>
                    Recording voice message...
                  </span>
                </div>
              )}

              {!isRecordingVoice && (
                <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    onClick={togglePicker}
                    onMouseEnter={() => setIsEmojiHovered(true)}
                    onMouseLeave={() => setIsEmojiHovered(false)}
                    title="Emoji"
                    style={{
                      width: 36,
                      height: 36,
                      background: isEmojiPickerOpen ? COLORS.activeToggleBg : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 5px 2px 0',
                      borderRadius: 18,
                      flexShrink: 0,
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <MdiIcon
                      path={mdiEmoticonOutline}
                      size={24}
                      color={isEmojiPickerOpen || isEmojiHovered ? COLORS.hoverWhite : COLORS.textMuted}
                    />
                  </button>

                  <EmojiPickerUserControl />
                </div>
              )}

              {isRecordingVoice && (
                <button
                  onClick={cancelVoiceRecording}
                  title="Cancel recording"
                  style={{
                    width: 37,
                    height: 37,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 5px 2px 0',
                    borderRadius: 18,
                    flexShrink: 0,
                  }}
                >
                  <MdiIcon path={mdiClose} size={22} color="#FF3B30" />
                </button>
              )}

              <button
                onClick={
                  isRecordingVoice
                    ? stopAndSendVoiceRecording
                    : hasAttachments || hasText
                    ? handleSendAction
                    : startVoiceRecording
                }
                title={isRecordingVoice ? 'Send recording' : hasAttachments || hasText ? 'Send message' : 'Record voice'}
                style={{
                  width: 38,
                  height: 38,
                  minWidth: 38,
                  borderRadius: 19,
                  backgroundColor: COLORS.accent,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  margin: '0 0 1px 0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                  flexShrink: 0,
                  transition: 'opacity 0.1s ease',
                }}
              >
                <MdiIcon
                  path={isRecordingVoice ? mdiCheck : hasAttachments || hasText ? mdiSend : mdiMicrophone}
                  size={22}
                  color="#FFFFFF"
                  style={!isRecordingVoice && (hasAttachments || hasText) ? { transform: 'translateX(1px)' } : undefined}
                />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const actionCloseButtonStyle = (size: number): React.CSSProperties => ({
  width: size,
  height: size,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const warningBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: COLORS.warningBg,
  border: `1.2px solid ${COLORS.warningBorder}`,
  borderRadius: 20,
  height: 40,
  padding: '0 20px',
  boxSizing: 'border-box',
};

export default MessageInputUserControl;