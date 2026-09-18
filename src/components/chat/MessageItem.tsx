import React, { useState, useRef } from 'react';
import { IMessageLayoutModel } from '../../types/layout';
import { MediaAlbumGrid } from './MediaAlbumGrid';
import { IMessage, IAttachment } from '../../types/models';

interface MessageItemProps {
  model: IMessageLayoutModel;
  isSelectionMode: boolean;
  onToggleSelect: (msg: IMessage) => void;
  onReply: (msg: IMessage) => void;
  onEdit: (msg: IMessage) => void;
  onPin: (msg: IMessage) => void;
  onDelete: (msg: IMessage) => void;
  onForward: (msg: IMessage) => void;
  onScrollToMessage: (id: number) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  model,
  isSelectionMode,
  onToggleSelect,
  onReply,
  onEdit,
  onPin,
  onDelete,
  onForward,
  onScrollToMessage,
}) => {
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isMy = model.isMyMessage;
  const timeFormatted = new Date(model.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Контекстное меню по правому клику
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const closeMenu = () => setContextMenuPos(null);

  const handleCopyText = () => {
    if (model.text) {
      navigator.clipboard.writeText(model.text);
    }
    closeMenu();
  };

  return (
    <div
      ref={containerRef}
      onContextMenu={handleContextMenu}
      onClick={() => isSelectionMode && onToggleSelect(model.sourceMessage)}
      style={{
        position: 'absolute',
        top: `${model.yOffset}px`,
        left: 0,
        right: 0,
        minHeight: `${model.totalHeight}px`,
        display: 'flex',
        justifyContent: isMy ? 'flex-end' : 'flex-start',
        padding: '0 16px',
        boxSizing: 'border-box',
        backgroundColor: model.isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
      }}
    >
      {/* КРУЖОК ВЫДЕЛЕНИЯ В РЕЖИМЕ МУЛЬТИВЫБОРА */}
      {isSelectionMode && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(model.sourceMessage);
          }}
          style={{
            alignSelf: 'center',
            marginRight: isMy ? 12 : 0,
            marginLeft: isMy ? 0 : 12,
            order: isMy ? 2 : -1,
            width: 20,
            height: 20,
            borderRadius: 10,
            border: `2px solid ${model.isSelected ? 'var(--app-accent, #3B82F6)' : '#64748B'}`,
            background: model.isSelected ? 'var(--app-accent, #3B82F6)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {model.isSelected && <span style={{ color: '#FFF', fontSize: 12 }}>✓</span>}
        </div>
      )}

      {/* АВАТАРКА ОТПРАВИТЕЛЯ (ДЛЯ ГРУПП) */}
      {!isMy && model.isGroupMessage && !model.isDeletedForMe && (
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            marginRight: 8,
            alignSelf: 'flex-end',
            overflow: 'hidden',
            backgroundColor: '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFF',
            fontWeight: 'bold',
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          {model.senderAvatar ? (
            <img src={model.senderAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            model.senderName.charAt(0).toUpperCase()
          )}
        </div>
      )}

      {/* ОСНОВНОЙ БАБЛ СООБЩЕНИЯ */}
      <div
        style={{
          position: 'relative',
          maxWidth: '520px',
          borderRadius: isMy ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
          backgroundColor: model.isMediaOnly
            ? 'transparent'
            : isMy
            ? 'var(--my-bubble-bg, #2B5278)'
            : 'var(--other-bubble-bg, #182533)',
          color: '#FFFFFF',
          padding: model.isMediaOnly ? 0 : '8px 12px 6px 12px',
          boxShadow: model.isMediaOnly ? 'none' : '0 1px 2px rgba(0,0,0,0.2)',
          animation: isHighlighted ? 'highlightFade 1.3s ease-in-out' : 'none',
        }}
      >
        {/* ИМЯ В ГРУППЕ ИЛИ КАНАЛЕ */}
        {!isMy && (model.isGroupMessage || model.isChannel) && !model.isForwarded && (
          <div
            style={{
              color: 'var(--app-accent, #60A5FA)',
              fontSize: 13.5,
              fontWeight: 600,
              marginBottom: 4,
              cursor: 'pointer',
            }}
          >
            {model.senderName}
          </div>
        )}

        {/* ШАПКА ПЕРЕСЛАННОГО СООБЩЕНИЯ */}
        {model.isForwarded && (
          <div style={{ marginBottom: 6, fontSize: 12.5, color: 'var(--tg-checkmark, #60A5FA)' }}>
            <div style={{ opacity: 0.8, fontSize: 11 }}>Forwarded from</div>
            <div style={{ fontWeight: 600 }}>{model.forwardedFromName}</div>
          </div>
        )}

        {/* ЦИТИРУЕМЫЕ СООБЩЕНИЯ (REPLIES) */}
        {model.repliedMessages.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            {model.repliedMessages.map((rep: any, idx: number) => (
              <div
                key={idx}
                onClick={() => onScrollToMessage(rep.serverId || rep.id)}
                style={{
                  borderLeft: '2.5px solid var(--app-accent, #60A5FA)',
                  paddingLeft: 8,
                  cursor: 'pointer',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '0 4px 4px 0',
                  paddingTop: 2,
                  paddingBottom: 2,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-accent, #60A5FA)' }}>
                  {rep.senderName || 'Reply'}
                </div>
                <div style={{ fontSize: 12, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {rep.text || 'Attachment'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* СЕТКА ФОТО И ВИДЕО (АЛЬБОМЫ) */}
        {model.previewMedia.length > 0 && (
          <MediaAlbumGrid
            media={model.previewMedia}
            mediaWidth={model.mediaWidth}
            mediaHeight={model.mediaHeight}
          />
        )}

        {/* СПИСОК АУДИОФАЙЛОВ */}
        {model.audios.map((audio: IAttachment, idx: number) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                background: 'var(--app-accent, #3B82F6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              ▶
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {audio.fileName}
              </div>
              <div style={{ fontSize: 11.5, opacity: 0.7 }}>{audio.fileSizeStr}</div>
            </div>
          </div>
        ))}

        {/* ГОЛОСОВЫЕ СООБЩЕНИЯ (VOICE) */}
        {model.voices.map((voice: IAttachment, idx: number) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220, padding: '4px 0' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                background: 'var(--app-accent, #3B82F6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              🎤
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ height: 18, display: 'flex', alignItems: 'center', gap: 2 }}>
                {/* Имитация дорожки вейвформа */}
                {(voice.waveform ? voice.waveform.split(',') : Array(24).fill(12)).map((h, i) => (
                  <div
                    key={i}
                    style={{
                      width: 2,
                      height: `${Math.max(4, Math.min(20, Number(h)))}px`,
                      backgroundColor: 'rgba(255, 255, 255, 0.6)',
                      borderRadius: 1,
                    }}
                  />
                ))}
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                {voice.durationSeconds ? `${voice.durationSeconds}s` : voice.fileSizeStr}
              </div>
            </div>
          </div>
        ))}

        {/* ДОКУМЕНТЫ */}
        {model.documents.map((doc: IAttachment, idx: number) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '4px 0',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                background: 'rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              📄
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {doc.fileName}
              </div>
              <div style={{ fontSize: 11.5, opacity: 0.7 }}>{doc.fileSizeStr}</div>
            </div>
          </div>
        ))}

        {/* ТЕКСТ СООБЩЕНИЯ */}
        {model.text && (
          <div
            style={{
              fontSize: 15,
              lineHeight: '20px',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              marginTop: model.previewMedia.length > 0 ? 6 : 0,
              paddingRight: model.isMediaOnly ? 0 : 45, // отступ под плашку времени
            }}
          >
            {model.isDeletedForMe ? <i>This message was deleted</i> : model.text}
          </div>
        )}

        {/* КАРТОЧКА ЗВОНКА */}
        {model.isCallMessage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{model.callTitle}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{model.callTimeAndDuration}</div>
            </div>
            <div style={{ fontSize: 20, marginLeft: 'auto' }}>📞</div>
          </div>
        )}

        {/* СТАТУСНАЯ ПЛАШКА (ВРЕМЯ, ГАЛОЧКИ, ИЗМЕНЕНО, ПРОСМОТРЫ) */}
        <div
          style={{
            position: model.isMediaOnly ? 'absolute' : 'relative',
            bottom: model.isMediaOnly ? 8 : 0,
            right: model.isMediaOnly ? 8 : 0,
            float: model.isMediaOnly ? 'none' : 'right',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            opacity: 0.75,
            marginTop: model.isMediaOnly ? 0 : -10,
            background: model.isMediaOnly ? 'rgba(0, 0, 0, 0.45)' : 'transparent',
            padding: model.isMediaOnly ? '2px 6px' : '0',
            borderRadius: 10,
          }}
        >
          {model.isEdited && <span>edited</span>}
          {model.isChannel && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              👁 {model.viewsCount}
            </span>
          )}
          <span>{timeFormatted}</span>
          {isMy && !model.isDeletedForMe && (
            <span style={{ color: 'var(--tg-checkmark, #38BDF8)' }}>
              {!model.isSentToServer ? '🕒' : model.isRead ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>

      {/* КОНТЕКСТНОЕ МЕНЮ (TELEGRAM STYLE) */}
      {contextMenuPos && (
        <div
          onClick={closeMenu}
          style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: contextMenuPos.y,
              left: Math.min(contextMenuPos.x, window.innerWidth - 180),
              background: '#1E293B',
              border: '1px solid #334155',
              borderRadius: 10,
              padding: '4px 0',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              minWidth: 160,
              zIndex: 1001,
            }}
          >
            <div style={menuItemStyle} onClick={() => { onReply(model.sourceMessage); closeMenu(); }}>↩ Ответить</div>
            {isMy && !model.isDeletedForMe && !model.isCallMessage && (
              <div style={menuItemStyle} onClick={() => { onEdit(model.sourceMessage); closeMenu(); }}>✏ Изменить</div>
            )}
            {!model.isDeletedForMe && (
              <div style={menuItemStyle} onClick={() => { onPin(model.sourceMessage); closeMenu(); }}>
                📌 {model.isPinned ? 'Открепить' : 'Закрепить'}
              </div>
            )}
            {model.text && <div style={menuItemStyle} onClick={handleCopyText}>📋 Копировать текст</div>}
            {!model.isDeletedForMe && (
              <div style={menuItemStyle} onClick={() => { onForward(model.sourceMessage); closeMenu(); }}>↗ Переслать</div>
            )}
            <div style={menuItemStyle} onClick={() => { onToggleSelect(model.sourceMessage); closeMenu(); }}>☑ Выделить</div>
            <div style={{ ...menuItemStyle, color: '#EF4444' }} onClick={() => { onDelete(model.sourceMessage); closeMenu(); }}>
              🗑 Удалить
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const menuItemStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 13.5,
  cursor: 'pointer',
  color: '#F8FAFC',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};