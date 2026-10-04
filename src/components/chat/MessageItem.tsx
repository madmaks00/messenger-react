import React, { useState, useEffect } from 'react';
import { IMessageLayoutModel } from '../../types/layout';
import { IMessage, IAttachment } from '../../types/models';
import { LightweightChatTextBox } from './LightweightChatTextBox';
import { VoiceWaveform } from './VoiceWaveform';
import { MediaAlbumGrid } from './MediaAlbumGrid';
import { getAvatarColor, normalizeAvatarUrl } from '../../utils/helpers';
import { userSession } from '../../services/userSession';
import { AsyncChatLayoutEngine } from '../../utils/chatLayoutEngine';
import { useChatStore, getMessageReplyText } from '../../stores/chatStore';
import { useNavigationStore } from '../../stores/navigationStore';
import { audioPlayerService } from '../../services/audioPlayer.service';
import { AudioConverterHelper, getAudioSubtitle } from '../../utils/audioConverters';

interface MessageItemProps {
  model: IMessageLayoutModel;
  isHighlighted?: boolean;
  isSelectionMode: boolean;
  onToggleSelect: (msg: IMessage) => void;
  onReply: (msg: IMessage) => void;
  onEdit: (msg: IMessage) => void;
  onPin: (msg: IMessage) => void;
  onDelete: (msg: IMessage) => void;
  onForward: (msg: IMessage) => void;
  onScrollToMessage: (id: number) => void;
  onMediaClick?: (attachment: IAttachment, messageId: number) => void;
}

const PALETTE = {
  myBubbleBg: '#16699B',
  otherBubbleBg: '#1C212D',
  tgCheckmark: '#80BFFF',
  authorName: '#5E92CE',
  textMuted: '#7D8494',
  contextMenuBg: '#1C212D',
  contextMenuBorder: '#2A303C',
  contextMenuHover: '#232A3B',
  accent: '#1E9BEB',
  destructive: '#FF3B30',
  mediaStatusPillBg: 'rgba(0, 0, 0, 0.47)',
  selectionBg: 'rgba(94, 146, 206, 0.1)',
  callSummaryTitle: '#FFFFFF',
  callSummaryDetails: '#A0B0C0',
  callSummaryIcon: 'rgba(255, 255, 255, 0.25)',
};

const ICONS = {
  check: 'M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z',
  checkAll: 'M0.41,13.41L6,19L7.41,17.58L1.83,12M22.24,5.58L11.66,16.17L7.5,12L6.07,13.41L11.66,19L23.66,7M18,7L16.59,5.58L10.24,11.93L11.66,13.34L18,7Z',
  clock: 'M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z',
  pin: 'M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z',
  reply: 'M10,9V5L3,12L10,19V14.9C15,14.9 18.5,16.5 21,20C20,15 17,10 10,9Z',
  pencil: 'M14.06,9L15,9.94L5.92,19H5V18.08L14.06,9M17.66,3C17.41,3 17.15,3.1 16.96,3.29L15.13,5.12L18.88,8.87L20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18.17,3.09 17.92,3 17.66,3M14.06,6.19L3,17.25V21H6.75L17.81,9.94L14.06,6.19Z',
  copy: 'M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z',
  share: 'M14,5V9C7,10 4,15 3,20C5.5,16.5 9,14.9 14,14.9V19L21,12L14,5Z',
  checkCircle: 'M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z',
  delete: 'M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z',
  phone: 'M6.62,10.79C8.06,13.62 10.38,15.94 13.21,17.38L15.41,15.18C15.69,14.9 16.08,14.82 16.43,14.93C17.55,15.3 18.75,15.5 20,15.5A1,1 0 0,1 21,16.5V20A1,1 0 0,1 20,21A17,17 0 0,1 3,4A1,1 0 0,1 4,3H7.5A1,1 0 0,1 8.5,4C8.5,5.25 8.7,6.45 9.07,7.57C9.18,7.92 9.1,8.31 8.82,8.59L6.62,10.79Z',
  play: 'M8,5.14V19.14L19,12.14L8,5.14Z',
  pause: 'M14 19h4V5h-4v14zm-8 0h4V5H6v14z',
  arrowDown: 'M11,4H13V12L16.5,8.5L17.92,9.92L12,15.84L6.08,9.92L7.5,8.5L11,12V4Z',
  arrowTopRight: 'M5,17.59L15.59 7H9V5H19V15H17V8.41L6.41,19L5,17.59Z',
  arrowBottomLeft: 'M19,6.41L8.41,17H15V19H5V9H7V15.59L17.59,5L19,6.41Z',
};

const SvgIcon: React.FC<{ path: string; size?: number; color?: string; style?: React.CSSProperties }> = ({
  path,
  size = 18,
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

// 🟢 КОМПОНЕНТ ОТОБРАЖЕНИЯ МУЗЫКАЛЬНОГО ТРЕКА В БАБЛЕ
const MessageAudioItemRow: React.FC<{
  attachment: IAttachment;
  isSelectionMode: boolean;
}> = ({ attachment, isSelectionMode }) => {
  const [, setTick] = useState(0);
  const [duration, setDuration] = useState<number>(attachment.durationSeconds || 0);

  useEffect(() => {
    return audioPlayerService.subscribe(() => setTick((t) => (t + 1) % 1000000));
  }, []);

  // 🟢 Безопасное получение длительности без блокировки кэша
  useEffect(() => {
    if (attachment.durationSeconds && attachment.durationSeconds > 0) {
      setDuration(attachment.durationSeconds);
      return;
    }

    const audioUrl = attachment.url || attachment.localImagePath;
    if (!audioUrl) return;

    let isCanceled = false;
    const audio = new Audio();
    audio.preload = 'metadata';

    const onMeta = () => {
      if (!isCanceled && isFinite(audio.duration) && audio.duration > 0) {
        const dur = Math.round(audio.duration);
        attachment.durationSeconds = dur;
        setDuration(dur);
      }
      cleanup();
    };

    const cleanup = () => {
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('error', cleanup);
      audio.src = '';
    };

    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('error', cleanup);
    audio.src = audioUrl;

    return () => {
      isCanceled = true;
      cleanup();
    };
  }, [attachment.url, attachment.durationSeconds]);

  const currentAtt = audioPlayerService.currentAttachment;
  const isPlayingEngine = audioPlayerService.isPlaying;
  const isCurrent = AudioConverterHelper.isSameAttachment(currentAtt, attachment);
  const isPlayingThis = isCurrent && isPlayingEngine;

  const handleToggle = (e: React.MouseEvent) => {
    if (isSelectionMode) return;
    e.stopPropagation();
    useChatStore.getState().toggleAudio(attachment);
  };

  const displaySubtitle = getAudioSubtitle(attachment, duration);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        minWidth: 220,
        maxWidth: 320,
        height: 44,
        margin: '1px 0',
        boxSizing: 'border-box',
      }}
    >
      <button
        onClick={handleToggle}
        title={isPlayingThis ? 'Pause' : 'Play'}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: PALETTE.accent,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          flexShrink: 0,
          transition: 'opacity 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        {isPlayingThis ? (
          <SvgIcon path={ICONS.pause} size={22} color="#FFFFFF" />
        ) : (
          <SvgIcon path={ICONS.play} size={22} color="#FFFFFF" style={{ marginLeft: 2 }} />
        )}
      </button>

      <div style={{ marginLeft: 10, marginRight: 45, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span
          title={attachment.fileName}
          style={{
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: 14,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 240,
            marginBottom: 1,
          }}
        >
          {attachment.fileName}
        </span>

        {/* 🟢 Точно такой же стиль, цвет и размер, как в голосовых сообщениях */}
        <div
          style={{
            marginTop: 1,
            fontSize: 11.5,
            color: '#FFFFFF',
            opacity: isCurrent ? 0.9 : 0.7,
            fontWeight: isCurrent ? 600 : 'normal',
            whiteSpace: 'nowrap',
          }}
        >
          {isCurrent ? audioPlayerService.timeString : displaySubtitle}
        </div>
      </div>
    </div>
  );
};

// 🟢 КОМПОНЕНТ ОТОБРАЖЕНИЯ ГОЛОСОВОГО СООБЩЕНИЯ В БАБЛЕ
const MessageVoiceItemRow: React.FC<{
  attachment: IAttachment;
  isSelectionMode: boolean;
}> = ({ attachment, isSelectionMode }) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    return audioPlayerService.subscribe(() => setTick((t) => (t + 1) % 1000000));
  }, []);

  const currentAtt = audioPlayerService.currentAttachment;
  const isPlayingEngine = audioPlayerService.isPlaying;
  const isCurrent = AudioConverterHelper.isSameAttachment(currentAtt, attachment);
  const isPlayingThis = isCurrent && isPlayingEngine;

  const handleToggle = (e: React.MouseEvent) => {
    if (isSelectionMode) return;
    e.stopPropagation();
    useChatStore.getState().toggleAudio(attachment);
  };

  const handleSeek = (sec: number) => {
    useChatStore.getState().seekAudio(sec);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        minWidth: 220,
        maxWidth: 280,
        height: 44,
        margin: '1px 0',
        boxSizing: 'border-box',
      }}
    >
      <button
        onClick={handleToggle}
        title={isPlayingThis ? 'Pause' : 'Play'}
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: PALETTE.accent,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          flexShrink: 0,
          transition: 'opacity 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        {isPlayingThis ? (
          <SvgIcon path={ICONS.pause} size={20} color="#FFFFFF" />
        ) : (
          <SvgIcon path={ICONS.play} size={20} color="#FFFFFF" style={{ marginLeft: 2 }} />
        )}
      </button>

      <div style={{ flex: 1, marginLeft: 8, marginRight: 8, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <VoiceWaveform
          waveform={attachment.waveform}
          durationSeconds={attachment.durationSeconds || 0}
          playerDurationSeconds={audioPlayerService.durationSeconds}
          attachment={attachment}
          currentAttachment={currentAtt}
          positionSeconds={audioPlayerService.positionSeconds}
          onSeek={handleSeek}
        />

        <div
          style={{
            marginTop: 1,
            fontSize: 11.5,
            color: '#FFFFFF',
            opacity: isCurrent ? 0.9 : 0.7,
            fontWeight: isCurrent ? 600 : 'normal',
          }}
        >
          {isCurrent ? audioPlayerService.timeString : (attachment.fileSizeStr || '0:00')}
        </div>
      </div>
    </div>
  );
};

export const MessageItem: React.FC<MessageItemProps> = ({
  model,
  isHighlighted = false,
  isSelectionMode,
  onToggleSelect,
  onReply,
  onEdit,
  onPin,
  onDelete,
  onForward,
  onScrollToMessage,
  onMediaClick,
}) => {
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  const currentUserId = Number(userSession.userId);
  const senderId = Number(model.senderId);
  const isMy = model.isMyMessage || (currentUserId > 0 && senderId === currentUserId);
  const timeFormatted = new Date(model.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const rawText = String(model.text || '');
  const isCall = Boolean(
    model.isCallMessage || rawText.includes('_CALL:') || rawText.includes('CALL:')
  );

  let callTitle = model.callTitle;
  let callTimeAndDuration = model.callTimeAndDuration;
  let callArrowColor = model.callArrowColor || '#4CAF50';
  let isOut = isMy;

  if (isCall && (!callTitle || callTitle === 'Call' || callTitle === 'Звонок')) {
    const callIdx = rawText.indexOf('CALL:');
    const clean = callIdx !== -1 ? rawText.slice(callIdx) : rawText;
    const parts = clean.split(':');
    const status = (parts[1] || '').toUpperCase();
    const durationSec = parseInt(parts[2] || '0', 10);
    const isMissed = status === 'CANCELED' || status === 'MISSED' || status === 'DECLINED';

    if (isMissed) {
      callTitle = isMy ? 'Cancelled call' : 'Missed call';
      callArrowColor = '#FF4B4B';
    } else {
      callTitle = isMy ? 'Outgoing call' : 'Incoming call';
      callArrowColor = '#4CAF50';
    }

    if (durationSec > 0) {
      const durStr = durationSec < 60 ? `${durationSec} seconds` : `${Math.floor(durationSec / 60)} min ${durationSec % 60} sec`;
      callTimeAndDuration = `${timeFormatted}, ${durStr}`;
    } else {
      callTimeAndDuration = timeFormatted;
    }
  }

  useEffect(() => {
    const handleClose = () => setContextMenuPos(null);

    window.addEventListener('click', handleClose);
    window.addEventListener('mousedown', handleClose);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('CloseAllMessageContextMenus', handleClose);

    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('mousedown', handleClose);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('CloseAllMessageContextMenus', handleClose);
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    window.dispatchEvent(new CustomEvent('CloseAllMessageContextMenus'));
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleRowClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
      e.stopPropagation();
      onToggleSelect(model.sourceMessage);
    }
  };

  const getBubblePadding = () => {
    if (model.isMediaOnly) return '0px';
    if (model.isDeletedForMe) return '6px 48px 12px 12px';
    if (model.isChannel) return model.isEdited ? '0px 130px 12px 12px' : '0px 85px 12px 12px';

    if (model.isForwarded) {
      return isMy ? '1px 70px 6px 7px' : '1px 50px 6px 7px';
    }

    if (isMy) {
      if (model.isEdited) return '7px 125px 12px 12px';
      return '7px 70px 12px 12px';
    } else {
      if (model.isEdited) return '7px 100px 12px 12px';
      return '7px 50px 12px 12px';
    }
  };

  const bubbleRadius = model.isMediaOnly
    ? '16px'
    : isMy
    ? '16px 16px 2px 16px'
    : '16px 16px 16px 2px';

  const menuWidth = 185;
  const menuEstimatedHeight = 240;
  const menuLeft = contextMenuPos ? Math.min(contextMenuPos.x, window.innerWidth - menuWidth - 10) : 0;
  const menuTop = contextMenuPos
    ? contextMenuPos.y + menuEstimatedHeight > window.innerHeight
      ? Math.max(10, contextMenuPos.y - menuEstimatedHeight)
      : contextMenuPos.y
    : 0;

  return (
    <div
      onContextMenu={handleContextMenu}
      onClick={handleRowClick}
      style={{
        position: 'absolute',
        top: `${model.yOffset}px`,
        left: 0,
        right: 0,
        height: `${model.totalHeight || 60}px`,
        display: 'flex',
        alignItems: 'stretch',
        boxSizing: 'border-box',
        cursor: isSelectionMode ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <style>{`
        @keyframes wpfMessageHighlightPulse {
          0% { opacity: 0; }
          15.38% { opacity: 0.4; }
          50% { opacity: 0.4; }
          100% { opacity: 0; }
        }
        .wpf-message-highlight-pulse {
          animation: wpfMessageHighlightPulse 1300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards !important;
          will-change: opacity;
        }
      `}</style>

      {/* ПОДЛОЖКА ВЫДЕЛЕНИЯ ВСЕЙ СТРОКИ */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: PALETTE.selectionBg,
          opacity: model.isSelected ? 1 : 0,
          pointerEvents: 'none',
          transition: 'opacity 0.12s ease',
          zIndex: 1,
        }}
      />

      {/* КОНТЕНТ СООБЩЕНИЯ */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          justifyContent: isMy ? 'flex-end' : 'flex-start',
          alignItems: 'flex-start',
          padding: '0 15px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {!isMy && model.isGroupMessage && !model.isDeletedForMe && (
          <div
            onClick={(e) => {
              if (isSelectionMode) return;
              e.stopPropagation();
              useNavigationStore.getState().openUserProfile(model.senderId);
            }}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: getAvatarColor(model.senderId),
              marginRight: 8,
              alignSelf: 'flex-end',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: 14,
              overflow: 'hidden',
              flexShrink: 0,
              position: 'relative',
              cursor: 'pointer',
            }}
          >
            <span>{model.senderName ? model.senderName.charAt(0).toUpperCase() : 'U'}</span>
            {model.senderAvatar && (
              <img
                src={normalizeAvatarUrl(model.senderAvatar as string) || ''}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            )}
          </div>
        )}

        {/* БАБЛ СООБЩЕНИЯ */}
        <div style={{ position: 'relative', maxWidth: '500px', display: 'flex', overflow: 'visible' }}>
          {isMy && !model.isMediaOnly && (
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              style={{ position: 'absolute', right: -7, bottom: 0, zIndex: 2, display: 'block', pointerEvents: 'none' }}
            >
              <path d="M 0,8 L 8,8 L 0,0 Z" fill={PALETTE.myBubbleBg} />
            </svg>
          )}

          {!isMy && !model.isMediaOnly && (
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              style={{ position: 'absolute', left: -7, bottom: 0, zIndex: 2, display: 'block', pointerEvents: 'none' }}
            >
              <path d="M 8,8 L 0,8 L 8,0 Z" fill={PALETTE.otherBubbleBg} />
            </svg>
          )}

          <div
            style={{
              position: 'relative',
              backgroundColor: model.isMediaOnly ? 'transparent' : isMy ? PALETTE.myBubbleBg : PALETTE.otherBubbleBg,
              borderRadius: bubbleRadius,
              boxSizing: 'border-box',
              overflow: 'visible',
              minHeight: isCall ? '54px' : model.isMediaOnly ? undefined : `${Math.max(34, (model.totalHeight || 0) - 1)}px`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            {model.isSelected && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: bubbleRadius,
                  backgroundColor: '#000000',
                  opacity: 0.15,
                  pointerEvents: 'none',
                  zIndex: 21,
                }}
              />
            )}

            {model.isPinned && (
              <div style={{ position: 'absolute', top: 5, right: 10, transform: 'rotate(45deg)', zIndex: 10 }}>
                <SvgIcon path={ICONS.pin} size={14} color={PALETTE.tgCheckmark} />
              </div>
            )}

            {!isMy && (model.isGroupMessage || model.isChannel) && !model.isForwarded && !model.isDeletedForMe && (
              <div
                onClick={(e) => {
                  if (isSelectionMode) return;
                  e.stopPropagation();
                  useNavigationStore.getState().openUserProfile(model.senderId);
                }}
                style={{ padding: '6px 12px 2px 12px', fontSize: 14, fontWeight: 600, color: PALETTE.authorName, cursor: 'pointer' }}
              >
                {model.senderName}
              </div>
            )}

            {model.isForwarded && (
              <div
                onClick={(e) => {
                  if (isSelectionMode) return;
                  e.stopPropagation();
                  if (model.forwardedFromUserId > 0) {
                    useNavigationStore.getState().openUserProfile(model.forwardedFromUserId);
                  }
                }}
                style={{
                  padding: '6px 10px 2px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: model.isMediaOnly
                    ? isMy
                      ? PALETTE.myBubbleBg
                      : PALETTE.otherBubbleBg
                    : 'transparent',
                  width: model.isMediaOnly ? model.mediaWidth : undefined,
                  borderRadius: model.isMediaOnly ? '16px 16px 0 0' : undefined,
                  boxSizing: 'border-box',
                  userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span
                      style={{
                        fontSize: 13,
                        color: PALETTE.tgCheckmark,
                        fontWeight: 600,
                        marginBottom: 2,
                        lineHeight: '16px',
                      }}
                    >
                      Forwarded from
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: getAvatarColor(model.forwardedFromUserId || 0),
                          marginRight: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFFFFF',
                          fontSize: 9.5,
                          fontWeight: 'bold',
                          overflow: 'hidden',
                          position: 'relative',
                          flexShrink: 0,
                        }}
                      >
                        <span>{((model.forwardedFromName || 'U').charAt(0)).toUpperCase()}</span>
                        {model.forwardedFromAvatar && (
                          <img
                            src={normalizeAvatarUrl(model.forwardedFromAvatar as string) || ''}
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

                      <span
                        style={{
                          fontSize: 13.5,
                          color: '#FFFFFF',
                          fontWeight: 600,
                          lineHeight: '18px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 320,
                        }}
                      >
                        {model.forwardedFromName}
                      </span>
                    </div>
                  </div>

                  <SvgIcon
                    path={ICONS.share}
                    size={16}
                    color={PALETTE.tgCheckmark}
                    style={{ marginLeft: 8, marginRight: 6, alignSelf: 'center' }}
                  />
                </div>
              </div>
            )}

            {/* ЦИТИРУЕМЫЕ СООБЩЕНИЯ */}
            {model.repliedMessages && model.repliedMessages.length > 0 && (
              <div style={{ margin: '6px 10px 0 10px' }}>
                {model.repliedMessages.map((rep: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={(e) => {
                      if (isSelectionMode) return;
                      e.stopPropagation();
                      onScrollToMessage(rep.serverId || rep.id);
                    }}
                    style={{
                      display: 'flex',
                      cursor: 'pointer',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '0 6px 6px 0',
                      borderLeft: '2.5px solid #FFFFFF',
                      padding: '3px 8px',
                      margin: '2px 0',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 'bold', color: '#FFFFFF', lineHeight: '18px' }}>
                        {rep.senderName || 'User'}
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#FFFFFF' }}>
                        {getMessageReplyText(rep)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* МЕДИА В БАБЛЕ */}
            {model.previewMedia && model.previewMedia.length > 0 && (
              <div style={{ width: model.mediaWidth, height: model.mediaHeight, position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
                <MediaAlbumGrid
                  media={model.previewMedia}
                  mediaWidth={model.mediaWidth}
                  mediaHeight={model.mediaHeight}
                  onMediaClick={(att) => {
                    if (isSelectionMode) {
                      onToggleSelect(model.sourceMessage);
                      return;
                    }
                    onMediaClick?.(att, Number(model.id || model.serverId || 0));
                  }}
                  onImageDimensionsLoaded={(_att, naturalWidth, naturalHeight) => {
                    if (model.previewMedia && model.previewMedia.length === 1 && naturalWidth > 0 && naturalHeight > 0) {
                      const dims = AsyncChatLayoutEngine.calculateMediaDimensionsFromPixels(naturalWidth, naturalHeight);
                      const diffW = Math.abs(model.mediaWidth - dims.width);
                      const diffH = Math.abs(model.mediaHeight - dims.height);

                      if (diffW > 2 || diffH > 2) {
                        useChatStore.getState().updateAttachmentDimensions(
                          Number(model.id || model.serverId || 0),
                          naturalWidth,
                          naturalHeight
                        );
                      }
                    }
                  }}
                />
              </div>
            )}

            {/* 🟢 АУДИОПЛЕЕР (AudiosControl) */}
            {model.audios && model.audios.length > 0 && (
              <div style={{ margin: '6px 10px 4px 10px' }}>
                {model.audios.map((att: IAttachment, idx: number) => (
                  <MessageAudioItemRow
                    key={att.id || att.url || idx}
                    attachment={att}
                    isSelectionMode={isSelectionMode}
                  />
                ))}
              </div>
            )}

            {/* 🟢 ГОЛОСОВЫЕ СООБЩЕНИЯ (VoicesControl) */}
            {model.voices && model.voices.length > 0 && (
              <div style={{ margin: '4px 8px 4px 8px' }}>
                {model.voices.map((att: IAttachment, idx: number) => (
                  <MessageVoiceItemRow
                    key={att.id || att.url || idx}
                    attachment={att}
                    isSelectionMode={isSelectionMode}
                  />
                ))}
              </div>
            )}

            {/* ДОКУМЕНТЫ */}
            {model.documents && model.documents.length > 0 && (
              <div style={{ padding: '6px 10px 0 10px' }}>
                {model.documents.map((doc: IAttachment, idx: number) => (
                  <div
                    key={idx}
                    onClick={(e) => {
                      if (isSelectionMode) return;
                      e.stopPropagation();
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0 6px 0', cursor: 'pointer' }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: PALETTE.authorName, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <SvgIcon path={ICONS.arrowDown} size={22} color="#FFFFFF" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }}>
                        {doc.fileName}
                      </div>
                      <div style={{ fontSize: 12, color: '#A0B0C0', marginTop: 2 }}>{doc.fileSizeStr}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ТЕКСТ СООБЩЕНИЯ */}
            {model.text && !isCall && (
              <div style={{ padding: getBubblePadding(), boxSizing: 'border-box' }}>
                <LightweightChatTextBox text={model.text} isDeleted={model.isDeletedForMe} fontSize={15} lineHeight={20} />
              </div>
            )}

            {/* ЗВОНОК */}
            {isCall && (
              <div
                style={{
                  width: 210,
                  height: 54,
                  margin: '2px 4px 4px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box',
                  userSelect: 'none',
                }}
              >
                <div style={{ margin: '6px 0 6px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: PALETTE.callSummaryTitle, marginBottom: 3, whiteSpace: 'nowrap' }}>
                    {callTitle}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <SvgIcon path={isOut ? ICONS.arrowTopRight : ICONS.arrowBottomLeft} size={16} color={callArrowColor} style={{ marginRight: 4 }} />
                    <span style={{ fontSize: 14, color: PALETTE.callSummaryDetails, whiteSpace: 'nowrap' }}>{callTimeAndDuration}</span>
                  </div>
                </div>
                <SvgIcon path={ICONS.phone} size={32} color={PALETTE.callSummaryIcon} style={{ marginRight: 12 }} />
              </div>
            )}

            {/* ВРЕМЯ И СТАТУС ПРОЧТЕНИЯ */}
            {!isCall && (
              <div
                style={{
                  position: 'absolute',
                  right: 6,
                  bottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: model.isMediaOnly ? PALETTE.mediaStatusPillBg : 'transparent',
                  padding: model.isMediaOnly ? '2px 6px' : '0 2px',
                  borderRadius: 10,
                  pointerEvents: 'none',
                  userSelect: 'none',
                  zIndex: 10,
                }}
              >
                {model.isEdited && !model.isDeletedForMe && (
                  <span style={{ fontSize: 11, color: '#FFFFFF', opacity: 0.7, marginRight: 2 }}>edited</span>
                )}
                {model.isChannel && (
                  <span style={{ fontSize: 11, color: '#FFFFFF', opacity: 0.7, marginRight: 4 }}>👁 {model.viewsCount}</span>
                )}
                <span style={{ fontSize: 11, color: '#FFFFFF', opacity: 0.85 }}>{timeFormatted}</span>

                {isMy && !model.isDeletedForMe && (
                  <div style={{ display: 'flex', alignItems: 'center', marginLeft: 2 }}>
                    {!model.isSentToServer ? (
                      <SvgIcon path={ICONS.clock} size={15} color={PALETTE.tgCheckmark} />
                    ) : model.isRead ? (
                      <SvgIcon path={ICONS.checkAll} size={16} color={PALETTE.tgCheckmark} />
                    ) : (
                      <SvgIcon path={ICONS.check} size={15} color={PALETTE.tgCheckmark} />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {isHighlighted && (
            <div
              className="wpf-message-highlight-pulse"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20, display: 'flex', overflow: 'visible' }}
            >
              {isMy && !model.isMediaOnly && (
                <svg width="8" height="8" viewBox="0 0 8 8" style={{ position: 'absolute', right: -7, bottom: 0, display: 'block' }}>
                  <path d="M 0,8 L 8,8 L 0,0 Z" fill="#FFFFFF" />
                </svg>
              )}
              {!isMy && !model.isMediaOnly && (
                <svg width="8" height="8" viewBox="0 0 8 8" style={{ position: 'absolute', left: -7, bottom: 0, display: 'block' }}>
                  <path d="M 8,8 L 0,8 L 8,0 Z" fill="#FFFFFF" />
                </svg>
              )}
              <div style={{ position: 'absolute', inset: 0, borderRadius: bubbleRadius, backgroundColor: '#FFFFFF' }} />
            </div>
          )}
        </div>
      </div>

      {/* КРУЖОК ВЫДЕЛЕНИЯ */}
      {isSelectionMode && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(model.sourceMessage);
          }}
          style={{
            width: 24,
            height: 24,
            margin: '0 15px 8px 10px',
            alignSelf: 'flex-end',
            borderRadius: 12,
            border: `2px solid ${PALETTE.authorName}`,
            backgroundColor: model.isSelected ? PALETTE.authorName : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            zIndex: 3,
            boxSizing: 'border-box',
          }}
        >
          {model.isSelected && <SvgIcon path={ICONS.check} size={16} color="#FFFFFF" />}
        </div>
      )}

      {/* КОНТЕКСТНОЕ МЕНЮ */}
      {contextMenuPos && (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: menuTop,
            left: menuLeft,
            backgroundColor: PALETTE.contextMenuBg,
            border: `1.2px solid ${PALETTE.contextMenuBorder}`,
            borderRadius: 10,
            padding: '4px 0',
            zIndex: 99999,
            minWidth: 175,
            boxShadow: '0 8px 25px rgba(0,0,0,0.45)',
          }}
        >
          {!model.isDeletedForMe && (
            <ContextMenuItem
              icon={ICONS.reply}
              text="Reply"
              onClick={() => {
                onReply(model.sourceMessage);
                setContextMenuPos(null);
              }}
            />
          )}

          {isMy && !model.isForwarded && !isCall && !model.isDeletedForMe && (
            <ContextMenuItem
              icon={ICONS.pencil}
              text="Edit"
              onClick={() => {
                onEdit(model.sourceMessage);
                setContextMenuPos(null);
              }}
            />
          )}

          {!model.isDeletedForMe && (
            <ContextMenuItem
              icon={ICONS.pin}
              rotate={45}
              text={model.isPinned ? 'Unpin' : 'Pin'}
              onClick={() => {
                onPin(model.sourceMessage);
                setContextMenuPos(null);
              }}
            />
          )}

          {model.text && !isCall && !model.isDeletedForMe && (
            <ContextMenuItem
              icon={ICONS.copy}
              text="Copy Text"
              onClick={() => {
                navigator.clipboard.writeText(model.text);
                setContextMenuPos(null);
              }}
            />
          )}

          {!model.isDeletedForMe && (
            <ContextMenuItem
              icon={ICONS.share}
              text="Forward"
              onClick={() => {
                onForward(model.sourceMessage);
                setContextMenuPos(null);
              }}
            />
          )}

          {!model.isDeletedForMe && (
            <ContextMenuItem
              icon={ICONS.checkCircle}
              text="Select"
              onClick={() => {
                onToggleSelect(model.sourceMessage);
                setContextMenuPos(null);
              }}
            />
          )}

          <ContextMenuItem
            icon={ICONS.delete}
            text="Delete"
            isDestructive
            onClick={() => {
              onDelete(model.sourceMessage);
              setContextMenuPos(null);
            }}
          />
        </div>
      )}
    </div>
  );
};

const ContextMenuItem: React.FC<{
  icon: string;
  text: string;
  rotate?: number;
  isDestructive?: boolean;
  onClick: () => void;
}> = ({ icon, text, rotate, isDestructive, onClick }) => {
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '7px 18px 7px 10px',
        margin: '1px 2px',
        borderRadius: 6,
        fontSize: 14,
        cursor: 'pointer',
        color: isDestructive ? PALETTE.destructive : '#FFFFFF',
        backgroundColor: hover ? PALETTE.contextMenuHover : 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined, display: 'flex' }}>
        <SvgIcon path={icon} size={18} color={isDestructive ? PALETTE.destructive : '#FFFFFF'} />
      </div>
      <span style={{ whiteSpace: 'nowrap' }}>{text}</span>
    </div>
  );
};

export default MessageItem;