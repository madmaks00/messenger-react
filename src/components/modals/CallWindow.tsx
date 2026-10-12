import './CallWindow.css';
import { normalizeCallAvatar } from '../../utils/callAvatar';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  mdiMonitorOff,
  mdiPin,
  mdiPinOff,
  mdiFullscreen,
  mdiFullscreenExit,
} from '@mdi/js';

import { useCallsStore, getLocalUserProfile } from '../../stores/callsStore';
import { useChatStore } from '../../stores/chatStore';
import { userService } from '../../services/user.service';
import { getAvatarColor } from '../../utils/helpers';

const PALETTE = {
  windowBg: '#12151B',
  surfaceCard: '#1A1E27',
  windowBorder: 'rgba(255, 255, 255, 0.08)',
  textControls: '#8B9197',
  textWhite: '#FFFFFF',
  accentBlue: '#36C2C9',
  accentPurple: '#7C6EF6',
  activeIndicator: '#2ECC71',
  actionBtnDarkBg: '#202735',
  actionBtnRedBg: '#F0445E',
};

// 🟢 Гарантированная загрузка аватарки: если base64 отсутствует, грузим по API бэкенда
function safeAvatarUrl(avatar?: unknown, userId?: number): string | null {
  return normalizeCallAvatar(avatar) || (userId ? normalizeCallAvatar(userService.getCachedUserAvatar(userId)) : null);
}

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

const VideoPlayerTile: React.FC<{
  stream: MediaStream | null;
  isMirror?: boolean;
  objectFit?: 'cover' | 'contain';
}> = ({ stream, isMirror = false, objectFit = 'contain' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    let isSubscribed = true;

    const playVideo = () => {
      if (video && video.paused && isSubscribed) {
        video.play().catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn('[VideoPlayerTile] Ошибка play():', err);
          }
        });
      }
    };

    video.addEventListener('loadedmetadata', playVideo);
    video.addEventListener('canplay', playVideo);
    playVideo();

    return () => {
      isSubscribed = false;
      video.removeEventListener('loadedmetadata', playVideo);
      video.removeEventListener('canplay', playVideo);
    };
  }, [stream]);

  if (!stream) return null;

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={true}
      style={{
        width: '100%',
        height: '100%',
        objectFit,
        transform: isMirror ? 'scaleX(-1)' : 'none',
        display: 'block',
        backgroundColor: '#000000',
      }}
    />
  );
};

export const CallWindow: React.FC = () => {
  const {
    isWindowOpen,
    windowState,
    currentCallUserId,
    currentCallUserName,
    currentCallUserAvatar,
    localUserName,
    localUserAvatar,
    isIncomingCallVisible,
    isOutgoingCallVisible,
    isActiveCallVisible,
    callDurationText,
    activeParticipants,
    isGroupCall,
    localCameraStream,
    remoteCameraStreams,
    availableScreenSources,
    selectedScreenSourceId,
    selectScreenSource,
    spotlightUserId,
    isMuted,
    isVideoOn,
    isScreenSharing,
    acceptCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    setSpotlightUserId,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
  } = useCallsStore();

  const { currentUserName: chatUserName, currentUserAvatar: chatUserAvatar } = useChatStore();

  const myDisplayName = useMemo(() => {
    const profile = getLocalUserProfile();
    if (profile.name && profile.name !== 'Вы') {
      return profile.name;
    }
    if (localUserName && localUserName !== 'Вы') {
      return localUserName;
    }
    if (chatUserName && chatUserName !== 'Me' && chatUserName !== 'User' && chatUserName !== 'Вы') {
      return chatUserName;
    }
    return 'Вы';
  }, [localUserName, chatUserName]);

  const myDisplayAvatar = useMemo(() => {
    const profile = getLocalUserProfile();
    return (
      profile.avatar ||
      chatUserAvatar ||
      localUserAvatar ||
      (profile.id > 0 ? userService.getCachedUserAvatar(profile.id) : null) ||
      null
    );
  }, [chatUserAvatar, localUserAvatar]);

  const currentSelectedSource = useMemo(() => {
    return (
      availableScreenSources.find((s) => String(s.id) === String(selectedScreenSourceId)) ||
      availableScreenSources[0]
    );
  }, [availableScreenSources, selectedScreenSourceId]);

  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isHeroFullScreen, setIsHeroFullScreen] = useState(false);
  const [isHeroHovered, setIsHeroHovered] = useState(false);

  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  const isPresenterMode = availableScreenSources.length > 0 || spotlightUserId !== null;
  const currentWindowWidth = isGroupCall || isPresenterMode || isVideoOn ? 1060 : 440;
  const currentWindowHeight = isGroupCall || isPresenterMode || isVideoOn ? 690 : 580;

  useEffect(() => {
    if (isWindowOpen && windowState === 'normal') {
      const centerX = Math.max(10, (window.innerWidth - currentWindowWidth) / 2);
      const centerY = Math.max(10, (window.innerHeight - currentWindowHeight) / 2);
      setPosition({ x: centerX, y: centerY });
    }
  }, [isWindowOpen, currentWindowWidth, currentWindowHeight]);

  const handleMouseDownHeader = (e: React.MouseEvent<HTMLDivElement>) => {
    if (windowState !== 'normal' || (e.target as Element).closest('button')) return;
    setIsDragging(true);
    dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, startX: position.x, startY: position.y };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || windowState !== 'normal') return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const newX = Math.max(0, Math.min(window.innerWidth - currentWindowWidth, dragStartRef.current.startX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - currentWindowHeight, dragStartRef.current.startY + dy));
      setPosition({ x: newX, y: newY });
    },
    [isDragging, windowState, currentWindowWidth, currentWindowHeight]
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

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
          border: `1px solid ${PALETTE.windowBorder}`,
          borderRadius: 14,
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
          cursor: 'pointer',
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PALETTE.activeIndicator }} />
        <span style={{ color: PALETTE.textWhite, fontSize: 13, fontWeight: 600 }}>{currentCallUserName}</span>
        <span style={{ color: PALETTE.textControls, fontSize: 12 }}>{callDurationText}</span>
        <button
            className="call-action" data-tone="danger"
          onClick={(e) => { e.stopPropagation(); void endCall(); }}
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
          }}
        >
          <MdiIcon path={mdiPhoneHangup} size={15} color="#FFFFFF" />
        </button>
      </div>
    );
  }

  const isMaximized = windowState === 'maximized';

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
      }
    : {
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: currentWindowWidth,
        height: currentWindowHeight,
        backgroundColor: PALETTE.windowBg,
        border: `1px solid ${PALETTE.windowBorder}`,
        borderRadius: 18,
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      };

  const heroStream = spotlightUserId
    ? (remoteCameraStreams.get(spotlightUserId) || null)
    : currentSelectedSource
    ? currentSelectedSource.stream
    : null;

  const heroBadgeTitle = spotlightUserId !== null
    ? `${activeParticipants.find(p => Number(p.userId) === spotlightUserId)?.username || 'Участник'} (Закреплено)`
    : currentSelectedSource
    ? (currentSelectedSource.isLocal ? 'Вы ведете презентацию (Ваш экран)' : currentSelectedSource.title)
    : 'Презентация';

  return (
    <div style={containerStyle}>
      {/* ШАПКА ОКНА */}
      <div
        onMouseDown={handleMouseDownHeader}
        style={{
          height: 48,
          minHeight: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          cursor: isMaximized ? 'default' : 'move',
          zIndex: 30,
          background: PALETTE.windowBg,
          borderBottom: `1px solid ${PALETTE.windowBorder}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isActiveCallVisible && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 8px',
                borderRadius: 6,
                background: 'rgba(46, 204, 113, 0.15)',
                border: '1px solid rgba(46, 204, 113, 0.3)',
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: PALETTE.activeIndicator }} />
              <span style={{ color: PALETTE.activeIndicator, fontSize: 11, fontWeight: 'bold' }}>{callDurationText}</span>
            </div>
          )}
          <span style={{ color: PALETTE.textWhite, fontSize: 14, fontWeight: 600 }}>{currentCallUserName}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className="call-action call-window-control"
            onClick={minimizeWindow}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: PALETTE.textControls, padding: 6 }}
          >
            <MdiIcon path={mdiWindowMinimize} size={16} />
          </button>
          <button
            className="call-action call-window-control"
            onClick={isMaximized ? restoreWindow : maximizeWindow}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: PALETTE.textControls, padding: 6 }}
          >
            <MdiIcon path={isMaximized ? mdiWindowRestore : mdiWindowMaximize} size={15} />
          </button>
          <button
            className="call-action call-window-control" data-tone="danger"
            onClick={() => void endCall()}
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              color: PALETTE.textControls,
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s ease, color 0.2s ease',
            }}
          >
            <MdiIcon path={mdiClose} size={16} />
          </button>
        </div>
      </div>

      {/* ЭКРАН ИСХОДЯЩЕГО ВЫЗОВА */}
      {isOutgoingCallVisible && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: PALETTE.accentBlue,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontWeight: 'bold',
              fontSize: 48,
              position: 'relative',
              overflow: 'hidden',
              marginBottom: 18,
            }}
          >
            <span>{(currentCallUserName || 'U').charAt(0).toUpperCase()}</span>
            {safeAvatarUrl(currentCallUserAvatar, currentCallUserId) && (
              <img
                key={safeAvatarUrl(currentCallUserAvatar, currentCallUserId)!}
                src={safeAvatarUrl(currentCallUserAvatar, currentCallUserId)!}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </div>
          <div style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', marginBottom: 6 }}>{currentCallUserName}</div>
          <div style={{ color: PALETTE.textControls, fontSize: 14, marginBottom: 32 }}>Вызов...</div>

          <button
            className="call-action" data-tone="danger"
            onClick={() => void endCall()}
            title="Завершить вызов"
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: PALETTE.actionBtnRedBg,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(229, 57, 53, 0.4)',
              transition: 'transform 0.15s ease',
            }}
          >
            <MdiIcon path={mdiPhoneHangup} size={28} color="#FFFFFF" />
          </button>
        </div>
      )}

      {/* ЭКРАН ВХОДЯЩЕГО ВЫЗОВА */}
      {isIncomingCallVisible && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: PALETTE.accentBlue,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontWeight: 'bold',
              fontSize: 48,
              position: 'relative',
              overflow: 'hidden',
              marginBottom: 18,
            }}
          >
            <span>{(currentCallUserName || 'U').charAt(0).toUpperCase()}</span>
            {safeAvatarUrl(currentCallUserAvatar, currentCallUserId) && (
              <img
                key={safeAvatarUrl(currentCallUserAvatar, currentCallUserId)!}
                src={safeAvatarUrl(currentCallUserAvatar, currentCallUserId)!}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </div>
          <div style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', marginBottom: 6 }}>{currentCallUserName}</div>
          <div style={{ color: PALETTE.textControls, fontSize: 14, marginBottom: 32 }}>Входящий вызов...</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <button
            className="call-action" data-tone="accept"
              onClick={() => void acceptCall()}
              title="Принять"
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: PALETTE.activeIndicator,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(46, 204, 113, 0.4)',
              }}
            >
              <MdiIcon path={mdiPhone} size={28} color="#FFFFFF" />
            </button>
            <button
            className="call-action" data-tone="danger"
              onClick={() => void endCall()}
              title="Отклонить"
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: PALETTE.actionBtnRedBg,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(229, 57, 53, 0.4)',
              }}
            >
              <MdiIcon path={mdiPhoneHangup} size={28} color="#FFFFFF" />
            </button>
          </div>
        </div>
      )}

      {/* ОСНОВНОЙ ЭКРАН АКТИВНОГО ЗВОНКА */}
      {isActiveCallVisible && (
        <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden', padding: 12 }}>
          {isPresenterMode ? (
            /* РЕЖИМ 1: ПРЕЗЕНТАЦИЯ / МУЛЬТИ-СКРИН */
            <div style={{ flex: 1, display: 'flex', gap: 12, width: '100%', height: '100%' }}>
              <div
                onMouseEnter={() => setIsHeroHovered(true)}
                onMouseLeave={() => setIsHeroHovered(false)}
                style={{
                  flex: 1,
                  backgroundColor: '#000000',
                  borderRadius: 14,
                  overflow: 'hidden',
                  position: 'relative',
                  border: `1px solid ${PALETTE.windowBorder}`,
                }}
              >
                <VideoPlayerTile
                  key={currentSelectedSource ? String(currentSelectedSource.id) : 'empty_hero'}
                  stream={heroStream}
                  objectFit="contain"
                  isMirror={false}
                />

                {availableScreenSources.length > 1 && (
                  <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 8, zIndex: 20 }}>
                    {availableScreenSources.map((source) => {
                      const isSelected = spotlightUserId === null && String(source.id) === String(currentSelectedSource?.id);
                      return (
                        <button
            className="call-action"
                          key={String(source.id)}
                          aria-pressed={isSelected}
                          onClick={(e) => { e.stopPropagation(); selectScreenSource(source.id); }}
                          style={{
                            backgroundColor: isSelected ? PALETTE.accentBlue : 'rgba(26, 30, 39, 0.85)',
                            border: isSelected ? '1px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#FFFFFF',
                            padding: '6px 12px',
                            borderRadius: 8,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            backdropFilter: 'blur(8px)',
                          }}
                        >
                          <MdiIcon path={mdiMonitorShare} size={14} color="#FFFFFF" />
                          <span>{source.title}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div
                  style={{
                    position: 'absolute',
                    bottom: 14,
                    left: 14,
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(8px)',
                    padding: '6px 12px',
                    borderRadius: 6,
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {heroBadgeTitle}
                </div>

                <button
            className="call-action"
                  onClick={(e) => { e.stopPropagation(); setIsHeroFullScreen(!isHeroFullScreen); }}
                  title={isHeroFullScreen ? 'Свернуть' : 'Развернуть на весь экран'}
                  aria-pressed={isHeroFullScreen}
                  style={{
                    position: 'absolute',
                    bottom: 14,
                    right: 14,
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: 'rgba(26, 30, 39, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isHeroHovered || isHeroFullScreen ? 1 : 0,
                    transition: 'opacity 0.2s ease',
                    backdropFilter: 'blur(8px)',
                    zIndex: 20,
                  }}
                >
                  <MdiIcon path={isHeroFullScreen ? mdiFullscreenExit : mdiFullscreen} size={20} color="#FFFFFF" />
                </button>

                {spotlightUserId && (
                  <button
            className="call-action"
                    onClick={() => setSpotlightUserId(null)}
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      background: 'rgba(0,0,0,0.65)',
                      border: 'none',
                      borderRadius: 8,
                      padding: '6px 12px',
                      color: '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                    }}
                  >
                    <MdiIcon path={mdiPinOff} size={16} />
                    <span>Вернуться к сетке</span>
                  </button>
                )}
              </div>

              {!isHeroFullScreen && (
                <div style={{ width: 250, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
                  <div style={{ height: 140, minHeight: 140 }}>
                    <MeetParticipantTile
                      name={myDisplayName === 'Вы' ? 'Вы' : `${myDisplayName} (Вы)`}
                      avatarPath={myDisplayAvatar}
                      stream={localCameraStream}
                      isLocal={true}
                      isVideoOn={isVideoOn}
                      isMuted={isMuted}
                      isScreenSharing={isScreenSharing}
                      onPin={() => {}}
                    />
                  </div>

                  {activeParticipants.map((p) => (
                    <div key={p.userId} style={{ height: 140, minHeight: 140 }}>
                      <MeetParticipantTile
                        name={p.username}
                        avatarPath={p.avatarPath || (p as any).avatar}
                        userId={p.userId}
                        stream={remoteCameraStreams.get(Number(p.userId)) || null}
                        isVideoOn={Boolean(p.isVideoOn)}
                        isMuted={Boolean(p.isMuted)}
                        isScreenSharing={Boolean(p.isScreenSharing)}
                        isPinned={spotlightUserId === Number(p.userId)}
                        onPin={() => setSpotlightUserId(Number(p.userId))}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* РЕЖИМ 2: СЕТКА (50/50 ДЛЯ 1-НА-1 И МУЛЬТИ-СЕТКА ДЛЯ ГРУПП) */
            <div
              style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns:
                  activeParticipants.length <= 1
                    ? 'repeat(2, minmax(0, 1fr))'
                    : activeParticipants.length <= 3
                    ? 'repeat(2, minmax(0, 1fr))'
                    : 'repeat(3, minmax(0, 1fr))',
                gridAutoRows: '1fr',
                gap: 12,
                width: '100%',
                height: '100%',
                boxSizing: 'border-box',
              }}
            >
              <MeetParticipantTile
                name={myDisplayName === 'Вы' ? 'Вы' : `${myDisplayName} (Вы)`}
                avatarPath={myDisplayAvatar}
                stream={localCameraStream}
                isLocal={true}
                isVideoOn={isVideoOn}
                isMuted={isMuted}
                isScreenSharing={isScreenSharing}
                onPin={() => {}}
              />

              {activeParticipants.map((p) => (
                <MeetParticipantTile
                  key={p.userId}
                  name={p.username}
                  avatarPath={p.avatarPath || (p as any).avatar}
                  userId={p.userId}
                  stream={remoteCameraStreams.get(Number(p.userId)) || null}
                  isVideoOn={Boolean(p.isVideoOn)}
                  isMuted={Boolean(p.isMuted)}
                  isScreenSharing={Boolean(p.isScreenSharing)}
                        isPinned={spotlightUserId === Number(p.userId)}
                  onPin={() => setSpotlightUserId(Number(p.userId))}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ПУЛЬТ УПРАВЛЕНИЯ */}
      {isActiveCallVisible && (
        <div
          style={{
            height: 74,
            minHeight: 74,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 30,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 18px',
              borderRadius: 30,
              background: 'rgba(26, 30, 39, 0.95)',
              border: `1px solid ${PALETTE.windowBorder}`,
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            }}
          >
            <DockButton
              title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
              icon={isMuted ? mdiMicrophoneOff : mdiMicrophone}
              isActive={isMuted}
              activeBg={PALETTE.actionBtnRedBg}
              defaultBg={PALETTE.actionBtnDarkBg}
              onClick={toggleMute}
            />

            <DockButton
              title={isVideoOn ? 'Выключить камеру' : 'Включить камеру'}
              icon={isVideoOn ? mdiVideo : mdiVideoOff}
              isActive={isVideoOn}
              activeBg={PALETTE.accentBlue}
              defaultBg={PALETTE.actionBtnDarkBg}
              onClick={() => void toggleVideo()}
            />

            <DockButton
              title={isScreenSharing ? 'Остановить экран' : 'Трансляция экрана'}
              icon={isScreenSharing ? mdiMonitorOff : mdiMonitorShare}
              isActive={isScreenSharing}
              activeBg={PALETTE.accentPurple}
              defaultBg={PALETTE.actionBtnDarkBg}
              onClick={() => void toggleScreenShare()}
            />

            <button
            className="call-action" data-tone="danger"
              onClick={() => void endCall()}
              title="Завершить звонок"
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: PALETTE.actionBtnRedBg,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(229, 57, 53, 0.4)',
              }}
            >
              <MdiIcon path={mdiPhoneHangup} size={24} color="#FFFFFF" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const MeetParticipantTile: React.FC<{
  name: string;
  avatarPath?: string | null;
  userId?: number;
  stream: MediaStream | null;
  isLocal?: boolean;
  isVideoOn: boolean;
  isMuted: boolean;
  isScreenSharing?: boolean;
  isPinned?: boolean;
  onPin: () => void;
}> = ({ name, avatarPath, userId, stream, isLocal = false, isVideoOn, isMuted, isScreenSharing = false, isPinned = false, onPin }) => {
  const hasVideo = isVideoOn && Boolean(stream && stream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled));
  const avatarSrc = safeAvatarUrl(avatarPath, userId);
  const firstLetter = (name || 'U').charAt(0).toUpperCase();
  const shouldMirror = isLocal && isVideoOn;

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: PALETTE.surfaceCard,
        border: `1px solid ${PALETTE.windowBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {hasVideo ? (
        <VideoPlayerTile stream={stream} isMirror={shouldMirror} objectFit="contain" />
      ) : (
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: getAvatarColor(name.length || 1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontWeight: 'bold',
            fontSize: 40,
            overflow: 'hidden',
            position: 'relative',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          }}
        >
          <span>{firstLetter}</span>
          {avatarSrc && (
            <img
              key={avatarSrc}
              src={avatarSrc}
              alt=""
              onError={(e) => (e.currentTarget.style.display = 'none')}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>
      )}

      {/* Бейдж имени и микрофона */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          padding: '4px 10px',
          borderRadius: 6,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          color: '#FFFFFF',
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          maxWidth: '85%',
        }}
      >
        <MdiIcon
          path={isMuted ? mdiMicrophoneOff : mdiMicrophone}
          size={14}
          color={isMuted ? '#E53935' : '#2ECC71'}
        />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      </div>

      {isScreenSharing && (
        <div
          title="Демонстрирует экран"
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            backgroundColor: PALETTE.accentPurple,
            borderRadius: 6,
            padding: '4px 6px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <MdiIcon path={mdiMonitorShare} size={14} color="#FFFFFF" />
        </div>
      )}

      {!isLocal && (
        <button
            className="call-action"
          onClick={onPin}
          title={isPinned ? 'Снять закрепление' : 'Закрепить камеру'}
          aria-pressed={isPinned}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: isPinned ? PALETTE.accentBlue : 'rgba(0,0,0,0.5)',
            border: 'none',
            borderRadius: 6,
            padding: 5,
            cursor: 'pointer',
            color: '#FFFFFF',
          }}
        >
          <span key={String(isPinned)} className="call-icon-switch"><MdiIcon path={isPinned ? mdiPinOff : mdiPin} size={14} /></span>
        </button>
      )}
    </div>
  );
};

const DockButton: React.FC<{
  title: string;
  icon: string;
  isActive: boolean;
  activeBg: string;
  defaultBg: string;
  onClick: () => void;
}> = ({ title, icon, isActive, activeBg, defaultBg, onClick }) => (
  <button className="call-action" onClick={onClick} title={title} aria-label={title} aria-pressed={isActive}
    style={{ '--call-accent': activeBg, width: 44, height: 44, borderRadius: 22,
      backgroundColor: isActive ? activeBg : defaultBg, border: '1px solid rgba(255,255,255,.08)',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties}>
    <span key={icon} className="call-icon-switch"><MdiIcon path={icon} size={22} color="#FFFFFF" /></span>
  </button>
);

export default CallWindow;