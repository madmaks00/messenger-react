import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  mdiWindowMinimize,
  mdiWindowMaximize,
  mdiWindowRestore,
  mdiClose,
  mdiPhone,
  mdiPhoneHangup,
  mdiMicrophone,
  mdiMicrophoneOff,
  mdiVideoOff,
  mdiVideo,
  mdiMonitorShare,
} from '@mdi/js';

import { useCallsStore, GroupCallParticipant } from '../../stores/callsStore';
import { getAvatarColor, normalizeAvatarUrl } from '../../utils/helpers';

const PALETTE = {
  windowBg: '#16191E',
  windowBorder: '#2C313A',
  windowControlsHover: 'rgba(255, 255, 255, 0.12)',
  windowCloseHover: '#E53935',
  textControls: '#8B9197',
  textWhite: '#FFFFFF',
  accentBlue: '#1E9BEB',
  subtitleMuted: '#8B9197',
  participantCardBg: '#1C1F26',
  participantCardBorder: '#2A303D',
  activePeerIndicator: '#2ECC71',
  actionBtnDarkBg: '#2B313A',
  actionBtnLightBg: '#E1E3E6',
  actionBtnDarkText: '#18191D',
  actionBtnGreenBg: '#2ECC71',
  actionBtnRedBg: '#E53935',
  labelColor: '#E1E3E6',
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
    fill={color === 'inherit' ? 'currentColor' : color}
    style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle', ...style }}
  >
    <path d={path} />
  </svg>
);

export const CallWindow: React.FC = () => {
  const {
    isWindowOpen,
    windowState,
    currentCallUserId,
    currentCallUserName,
    currentCallUserAvatar,
    isIncomingCallVisible,
    isOutgoingCallVisible,
    isActiveCallVisible,
    callDurationText,
    activeParticipants,
    isMuted,
    isVideoOn,
    isScreenSharing,
    acceptCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
  } = useCallsStore();

  // Состояние перетаскивания окна (1 в 1 с Window_MouseLeftButtonDown)
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  // Центрирование при первом открытии
  useEffect(() => {
    if (isWindowOpen && windowState === 'normal') {
      const centerX = Math.max(0, (window.innerWidth - 380) / 2);
      const centerY = Math.max(0, (window.innerHeight - 520) / 2);
      setPosition({ x: centerX, y: centerY });
    }
  }, [isWindowOpen]);

  const handleMouseDownHeader = (e: React.MouseEvent<HTMLDivElement>) => {
    if (windowState !== 'normal') return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || windowState !== 'normal') return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const newX = Math.max(0, Math.min(window.innerWidth - 380, dragStartRef.current.startX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 520, dragStartRef.current.startY + dy));
      setPosition({ x: newX, y: newY });
    },
    [isDragging, windowState]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!isWindowOpen) return null;

  // Режим свернутого окна (Minimized)
  if (windowState === 'minimized') {
    return (
      <div
        onClick={restoreWindow}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 999999,
          backgroundColor: PALETTE.windowBg,
          border: `1.2px solid ${PALETTE.windowBorder}`,
          borderRadius: 14,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: PALETTE.activePeerIndicator }} />
        <span style={{ color: PALETTE.textWhite, fontSize: 14, fontWeight: 600 }}>{currentCallUserName}</span>
        <span style={{ color: PALETTE.subtitleMuted, fontSize: 13 }}>{callDurationText}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            endCall();
          }}
          style={{
            background: PALETTE.actionBtnRedBg,
            border: 'none',
            borderRadius: '50%',
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            marginLeft: 6,
          }}
        >
          <MdiIcon path={mdiPhoneHangup} size={16} color="#FFFFFF" />
        </button>
      </div>
    );
  }

  const isMaximized = windowState === 'maximized';
  const avatarSrc = normalizeAvatarUrl(currentCallUserAvatar);
  const firstLetter = (currentCallUserName || 'U').charAt(0).toUpperCase();

  const containerStyle: React.CSSProperties = isMaximized
    ? {
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: PALETTE.windowBg,
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        userSelect: 'none',
      }
    : {
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: 380,
        height: 520,
        backgroundColor: PALETTE.windowBg,
        border: `1px solid ${PALETTE.windowBorder}`,
        borderRadius: 20,
        boxShadow: '0 4px 25px rgba(0, 0, 0, 0.5)',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        userSelect: 'none',
        overflow: 'hidden',
      };

  return (
    <div style={containerStyle}>
      {/* ================= ROW 0: КНОПКИ УПРАВЛЕНИЯ ОКНОМ (Height: 40px) ================= */}
      <div
        onMouseDown={handleMouseDownHeader}
        style={{
          height: 40,
          minHeight: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 10px',
          cursor: isMaximized ? 'default' : 'move',
          zIndex: 10,
        }}
      >
        <WindowControlBtn onClick={minimizeWindow} title="Свернуть">
          <MdiIcon path={mdiWindowMinimize} size={18} color={PALETTE.textControls} />
        </WindowControlBtn>

        <WindowControlBtn onClick={isMaximized ? restoreWindow : maximizeWindow} title={isMaximized ? 'Восстановить' : 'Развернуть'}>
          <MdiIcon path={isMaximized ? mdiWindowRestore : mdiWindowMaximize} size={16} color={PALETTE.textControls} />
        </WindowControlBtn>

        <WindowControlBtn isClose onClick={endCall} title="Закрыть">
          <MdiIcon path={mdiClose} size={20} color={PALETTE.textControls} />
        </WindowControlBtn>
      </div>

      {/* ================= ROW 1: CENTER (Avatar, text and list of participants) ================= */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {activeParticipants.length === 0 ? (
          /* Полноразмерный Аватар (Виден в личных звонках или когда в группе вы один) */
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: 200, height: 200, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              {/* Фоновое акцентное свечение (BlurEffect 40px, Opacity 0.2) */}
              <div
                style={{
                  position: 'absolute',
                  width: 130,
                  height: 130,
                  borderRadius: 65,
                  backgroundColor: PALETTE.accentBlue,
                  opacity: 0.2,
                  filter: 'blur(20px)',
                  transform: 'scale(1.2)',
                }}
              />

              {/* 130x130 Аватар */}
              <div
                style={{
                  width: 130,
                  height: 130,
                  borderRadius: 65,
                  backgroundColor: getAvatarColor(currentCallUserId),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: PALETTE.textWhite,
                  fontWeight: 'bold',
                  fontSize: 50,
                  overflow: 'hidden',
                  position: 'relative',
                  zIndex: 2,
                }}
              >
                <span>{firstLetter}</span>
                {avatarSrc && (
                  <img
                    src={avatarSrc}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </div>
            </div>

            {/* Имя собеседника */}
            <div
              style={{
                color: PALETTE.textWhite,
                fontSize: 20,
                fontWeight: 600,
                textAlign: 'center',
                marginBottom: 8,
                fontVariant: 'all-small-caps',
                letterSpacing: 0.5,
              }}
            >
              {currentCallUserName}
            </div>

            {/* Статус звонка / Таймер */}
            <div style={{ color: PALETTE.subtitleMuted, fontSize: 14, textAlign: 'center' }}>
              {isIncomingCallVisible
                ? 'incoming call...'
                : isOutgoingCallVisible
                ? 'calling...'
                : isActiveCallVisible
                ? callDurationText
                : 'Call'}
            </div>
          </div>
        ) : (
          /* Сетка участников группового звонка (Активируется при наличии пиров) */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 15px', overflow: 'hidden' }}>
            <div style={{ textAlign: 'center', marginBottom: 15 }}>
              <div style={{ color: PALETTE.subtitleMuted, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                Групповой вызов
              </div>
              <div style={{ color: PALETTE.textWhite, fontSize: 16, fontWeight: 'bold' }}>
                {callDurationText}
              </div>
            </div>

            <div className="wpf-scroll-viewer" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
              {activeParticipants.map((p) => (
                <ParticipantCard key={p.userId} participant={p} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ================= ROW 2: BUTTONS (Height: 140px) ================= */}
      <div
        style={{
          height: 140,
          minHeight: 140,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* 1. АКТИВНЫЙ ЗВОНОК (4 кнопки: Mute, Video On, End, Screen) */}
        {isActiveCallVisible && (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 10 }}>
            {/* Mute Button */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 70 }}>
              <button
                onClick={toggleMute}
                title={isMuted ? 'Unmute' : 'Mute'}
                style={{
                  width: 55,
                  height: 55,
                  borderRadius: 27.5,
                  backgroundColor: isMuted ? PALETTE.actionBtnRedBg : PALETTE.actionBtnDarkBg,
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <MdiIcon path={isMuted ? mdiMicrophoneOff : mdiMicrophone} size={26} color="#FFFFFF" />
              </button>
              <span style={{ color: PALETTE.labelColor, fontSize: 12, marginTop: 6 }}>
                {isMuted ? 'Unmute' : 'Mute'}
              </span>
            </div>

            {/* Video On Button */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 70 }}>
              <button
                onClick={toggleVideo}
                title="Video"
                style={{
                  width: 55,
                  height: 55,
                  borderRadius: 27.5,
                  backgroundColor: isVideoOn ? PALETTE.accentBlue : PALETTE.actionBtnLightBg,
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <MdiIcon path={isVideoOn ? mdiVideo : mdiVideoOff} size={26} color={isVideoOn ? '#FFFFFF' : PALETTE.actionBtnDarkText} />
              </button>
              <span style={{ color: PALETTE.labelColor, fontSize: 12, marginTop: 6 }}>
                {isVideoOn ? 'Video Off' : 'Video On'}
              </span>
            </div>

            {/* End Call Button */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 75 }}>
              <button
                onClick={endCall}
                title="End"
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: PALETTE.actionBtnRedBg,
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 15px rgba(229, 57, 53, 0.4)',
                }}
              >
                <MdiIcon path={mdiPhoneHangup} size={30} color="#FFFFFF" />
              </button>
              <span style={{ color: PALETTE.labelColor, fontSize: 12, marginTop: 8 }}>End</span>
            </div>

            {/* Screen Share Button */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 70 }}>
              <button
                onClick={toggleScreenShare}
                title="Screen"
                style={{
                  width: 55,
                  height: 55,
                  borderRadius: 27.5,
                  backgroundColor: isScreenSharing ? PALETTE.accentBlue : PALETTE.actionBtnDarkBg,
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <MdiIcon path={mdiMonitorShare} size={24} color="#FFFFFF" />
              </button>
              <span style={{ color: PALETTE.labelColor, fontSize: 12, marginTop: 6 }}>Screen</span>
            </div>
          </div>
        )}

        {/* 2. ВХОДЯЩИЙ ЗВОНОК (2 кнопки: Accept, Decline) */}
        {isIncomingCallVisible && (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 40 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                onClick={acceptCall}
                title="Accept"
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: PALETTE.actionBtnGreenBg,
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 15px rgba(46, 204, 113, 0.4)',
                }}
              >
                <MdiIcon path={mdiPhone} size={30} color="#FFFFFF" />
              </button>
              <span style={{ color: PALETTE.labelColor, fontSize: 12, marginTop: 6 }}>Accept</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                onClick={endCall}
                title="Decline"
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: PALETTE.actionBtnRedBg,
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 15px rgba(229, 57, 53, 0.4)',
                }}
              >
                <MdiIcon path={mdiPhoneHangup} size={30} color="#FFFFFF" />
              </button>
              <span style={{ color: PALETTE.labelColor, fontSize: 12, marginTop: 6 }}>Decline</span>
            </div>
          </div>
        )}

        {/* 3. ИСХОДЯЩИЙ ЗВОНОК (1 кнопка: Cancel) */}
        {isOutgoingCallVisible && !isActiveCallVisible && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              onClick={endCall}
              title="Cancel"
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: PALETTE.actionBtnRedBg,
                border: 'none',
                outline: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(229, 57, 53, 0.4)',
              }}
            >
              <MdiIcon path={mdiPhoneHangup} size={30} color="#FFFFFF" />
            </button>
            <span style={{ color: PALETTE.labelColor, fontSize: 12, marginTop: 6 }}>Cancel</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ================= КАРТОЧКА УЧАСТНИКА ГРУППОВОГО ЗВОНКА (100x125) =================
const ParticipantCard: React.FC<{ participant: GroupCallParticipant }> = ({ participant }) => {
  const avatarSrc = normalizeAvatarUrl(participant.avatarPath);
  const firstLetter = (participant.username || 'U').charAt(0).toUpperCase();

  return (
    <div
      style={{
        width: 100,
        height: 125,
        backgroundColor: PALETTE.participantCardBg,
        border: `1px solid ${PALETTE.participantCardBorder}`,
        borderRadius: 12,
        margin: 6,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Декоративный светящийся индикатор активности пира (6x6 #2ECC71) */}
      <div
        style={{
          position: 'absolute',
          top: 6,
          right: 8,
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: PALETTE.activePeerIndicator,
          boxShadow: '0 0 6px rgba(46, 204, 113, 0.8)',
        }}
      />

      {/* Аватар 50x50 */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: getAvatarColor(participant.userId),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: PALETTE.textWhite,
            fontWeight: 'bold',
            fontSize: 20,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <span>{firstLetter}</span>
          {avatarSrc && (
            <img
              src={avatarSrc}
              alt=""
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>
      </div>

      {/* Имя пира */}
      <div
        style={{
          color: PALETTE.textWhite,
          fontSize: 11,
          fontWeight: 600,
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          padding: '0 6px 6px 6px',
        }}
      >
        {participant.username}
      </div>
    </div>
  );
};

// ================= КНОПКА УПРАВЛЕНИЯ ОКНОМ =================
const WindowControlBtn: React.FC<{
  isClose?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ isClose, onClick, title, children }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={title}
      style={{
        width: 30,
        height: 30,
        backgroundColor: isHovered
          ? isClose
            ? PALETTE.windowCloseHover
            : PALETTE.windowControlsHover
          : 'transparent',
        border: 'none',
        borderRadius: 5,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transition: 'background-color 0.1s ease',
      }}
    >
      {React.cloneElement(children as React.ReactElement<any>, {
        color: isHovered ? '#FFFFFF' : PALETTE.textControls,
      })}
    </button>
  );
};

export default CallWindow;