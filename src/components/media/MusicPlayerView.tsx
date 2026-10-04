import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useMusicPlayerStore } from '../../stores/musicPlayerStore';
import { useNavigationStore } from '../../stores/navigationStore';
import { getAvatarColor, normalizeAvatarUrl } from '../../utils/helpers';
import { AudioConverterHelper } from '../../utils/audioConverters';

const COMPACT_HEIGHT = 54;
const EXPANDED_HEIGHT = 280;
const MIN_HEIGHT = 54;
const MAX_HEIGHT = 450;

const iconBtnStyle = (width: number, height: number, margin?: string): React.CSSProperties => ({
  width,
  height,
  margin: margin || 0,
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: 16,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  outline: 'none',
  transition: 'background-color 0.12s ease',
});

export const MusicPlayerView: React.FC = () => {
  const {
    isOpen,
    isPlaying,
    isShuffle,
    repeatMode,
    volume,
    currentTrack,
    playlist,
    currentTimeStr,
    totalTimeStr,
    progressPercent,
    playerHeight,
    setPlayerHeight,
    togglePlay,
    nextTrack,
    previousTrack,
    toggleShuffle,
    cycleRepeat,
    closePlayer,
    goToSourceChat,
    seek,
    setVolume,
    playTrack,
  } = useMusicPlayerStore();

  const [isVolumePopupOpen, setIsVolumePopupOpen] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(100);
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [isResizeHovered, setIsResizeHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const progressBarRef = useRef<HTMLDivElement>(null);
  const volumeTrackRef = useRef<HTMLDivElement>(null);
  const volumeContainerRef = useRef<HTMLDivElement>(null);
  const closePopupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closePopupTimerRef.current) clearTimeout(closePopupTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isVolumePopupOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (volumeContainerRef.current && !volumeContainerRef.current.contains(e.target as Node)) {
        setIsVolumePopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isVolumePopupOpen]);

  const updateProgressFromClientX = useCallback(
    (clientX: number) => {
      if (!progressBarRef.current) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;

      const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const percent = (clickX / rect.width) * 100.0;
      seek(percent);
    },
    [seek]
  );

  const updateVolumeFromClientY = useCallback(
    (clientY: number) => {
      if (!volumeTrackRef.current) return;
      const rect = volumeTrackRef.current.getBoundingClientRect();
      const trackHeight = rect.height;
      if (trackHeight <= 11) return;

      const thumbRadius = 5.5;
      const travelRange = trackHeight - 11.0;
      const relY = Math.max(thumbRadius, Math.min(trackHeight - thumbRadius, clientY - rect.top));

      const newVol = Math.max(0, Math.min(100, ((trackHeight - thumbRadius - relY) / travelRange) * 100.0));
      setVolume(newVol);
    },
    [setVolume]
  );

  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = playerHeight;

    const onMouseMove = (moveEvt: MouseEvent) => {
      const deltaY = startY - moveEvt.clientY;
      const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight + deltaY));
      setPlayerHeight(newHeight);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onResizeDoubleClick = () => {
    setPlayerHeight(playerHeight > COMPACT_HEIGHT + 20 ? COMPACT_HEIGHT : EXPANDED_HEIGHT);
  };

  const onProgressBarMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDraggingProgress(true);
    updateProgressFromClientX(e.clientX);

    const onMouseMove = (moveEvt: MouseEvent) => {
      updateProgressFromClientX(moveEvt.clientX);
    };

    const onMouseUp = () => {
      setIsDraggingProgress(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onVolumeMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDraggingVolume(true);
    updateVolumeFromClientY(e.clientY);

    const onMouseMove = (moveEvt: MouseEvent) => {
      updateVolumeFromClientY(moveEvt.clientY);
    };

    const onMouseUp = () => {
      setIsDraggingVolume(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onVolumeMouseEnter = () => {
    if (closePopupTimerRef.current) clearTimeout(closePopupTimerRef.current);
    setIsVolumePopupOpen(true);
  };

  const onVolumeMouseLeave = () => {
    if (!isDraggingVolume) {
      if (closePopupTimerRef.current) clearTimeout(closePopupTimerRef.current);
      closePopupTimerRef.current = setTimeout(() => {
        setIsVolumePopupOpen(false);
      }, 350);
    }
  };

  const onVolumeWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const step = e.deltaY < 0 ? 5 : -5;
    setVolume(Math.max(0, Math.min(100, volume + step)));
  };

  const onVolumeBtnClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (volume > 0) {
      setPreviousVolume(volume);
      setVolume(0);
    } else {
      setVolume(previousVolume > 0 ? previousVolume : 100);
    }
  };

  const onOpenChatProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentTrack || !currentTrack.chatId) return;

    if (currentTrack.isGroup) {
      void useNavigationStore.getState().openGroupProfile({
        id: currentTrack.chatId,
        groupId: currentTrack.chatId,
        nickName: currentTrack.chatName,
      });
    } else {
      void useNavigationStore.getState().openUserProfile(currentTrack.chatId, {
        id: currentTrack.chatId,
        nickName: currentTrack.chatName,
        avatarPath: currentTrack.chatAvatar,
      } as any);
    }
  };

  if (!isOpen) return null;

  const volumeFactor = volume / 100.0;
  const travelRangeVal = 90 - 11;
  const thumbBottom = volumeFactor * travelRangeVal;
  const fillHeight = volume <= 0 ? 0 : thumbBottom + 5.5;

  const normalizedChatAvatar = normalizeAvatarUrl(currentTrack?.chatAvatar);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: playerHeight,
        minHeight: MIN_HEIGHT,
        maxHeight: MAX_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-chat, #11141B)',
        zIndex: 50,
        userSelect: 'none',
        overflow: 'visible',
      }}
    >
      {/* 🔖 ЗАКЛАДКА ПЕРЕХОДА К ПРОФИЛЮ */}
      <button
        onClick={onOpenChatProfile}
        title="Открыть профиль"
        style={{
          position: 'absolute',
          top: -25,
          left: 0,
          height: 26,
          backgroundColor: 'var(--bg-chat, #11141B)',
          borderTop: '1px solid var(--divider-color, #1E232F)',
          borderRight: '1px solid var(--divider-color, #1E232F)',
          borderBottom: 'none',
          borderLeft: 'none',
          borderRadius: '0 10px 0 0',
          padding: '4px 12px 3px 10px',
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          zIndex: 10,
          outline: 'none',
          transition: 'background-color 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--other-bubble-bg, #1C212D)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-chat, #11141B)')}
      >
        <div style={{ width: 16, height: 16, marginRight: 6, position: 'relative' }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: getAvatarColor(currentTrack?.chatId || 0),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 9,
              fontWeight: 'bold',
            }}
          >
            {(currentTrack?.chatName || 'C').charAt(0).toUpperCase()}
          </div>
          {normalizedChatAvatar && (
            <img
              src={normalizedChatAvatar}
              alt=""
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              style={{ position: 'absolute', inset: 0, width: 16, height: 16, borderRadius: 8, objectFit: 'cover' }}
            />
          )}
        </div>

        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--main-window-text, #FFFFFF)',
            maxWidth: 150,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {currentTrack?.chatName || 'Chat'}
        </span>

        <svg viewBox="0 0 24 24" width={10} height={10} fill="var(--text-muted, #7D8494)" style={{ marginLeft: 4 }}>
          <path d="M5 17.59L15.59 7H9V5h10v10h-2V8.41L6.41 19z" />
        </svg>
      </button>

      {/* 🎵 КОРПУС ПЛЕЕРА */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          borderTop: '1px solid var(--divider-color, #1E232F)',
          overflow: 'visible',
          position: 'relative',
        }}
      >
        {/* ЗОНА РЕСАЙЗА */}
        <div
          onMouseDown={onResizeMouseDown}
          onDoubleClick={onResizeDoubleClick}
          onMouseEnter={() => setIsResizeHovered(true)}
          onMouseLeave={() => setIsResizeHovered(false)}
          style={{
            height: 3,
            cursor: 'ns-resize',
            backgroundColor: 'transparent',
            position: 'relative',
            zIndex: 20,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              height: 1.5,
              width: '100%',
              backgroundColor: 'var(--app-accent, #1E9BEB)',
              boxShadow: '0 0 6px #00A3FF',
              opacity: isResizeHovered || isResizing ? 1 : 0,
              transition: 'opacity 0.15s ease',
            }}
          />
        </div>

        {/* 1. КОМПАКТНЫЙ ПЛЕЕР (ШАПКА 54px) */}
        <div style={{ padding: '1px 10px 2px 10px', display: 'flex', flexDirection: 'column', position: 'relative', flexShrink: 0, overflow: 'visible' }}>
          <div style={{ height: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflow: 'visible' }}>
            {/* ЛЕВАЯ ЧАСТЬ: ОБЛОЖКА + НАЗВАНИЕ + ВРЕМЯ + АВТОР */}
            <div
              onClick={goToSourceChat}
              title="Перейти к сообщению с треком"
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                minWidth: 0,
                marginRight: 6,
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: 6,
                maxWidth: 'calc(50% - 65px)',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  backgroundColor: 'var(--app-accent, #1E9BEB)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                  flexShrink: 0,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <svg viewBox="0 0 24 24" width={16} height={16} fill="white">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
                {currentTrack?.coverArt && (
                  <img
                    src={currentTrack.coverArt}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span
                  title={currentTrack?.title}
                  style={{
                    fontWeight: 600,
                    fontSize: 12,
                    color: 'var(--main-window-text, #FFFFFF)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {currentTrack?.title || 'No track'}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', marginTop: 1, fontSize: 10.5 }}>
                  <span style={{ fontWeight: 600, color: 'var(--app-accent, #1E9BEB)' }}>{currentTimeStr}</span>
                  <span style={{ color: 'var(--text-muted, #7D8494)' }}>{` / ${totalTimeStr}`}</span>
                  <span style={{ color: 'var(--text-muted, #7D8494)', margin: '0 4px' }}>•</span>
                  <span
                    style={{
                      color: 'var(--text-muted, #7D8494)',
                      maxWidth: 80,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {currentTrack?.artist || 'Unknown'}
                  </span>
                </div>
              </div>
            </div>

            {/* ЦЕНТРАЛЬНЫЙ БЛОК: КНОПКИ УПРАВЛЕНИЯ (⏮ ▶ ⏭) */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                zIndex: 2,
              }}
            >
              <button onClick={previousTrack} title="Previous track" style={iconBtnStyle(26, 26)}>
                <svg viewBox="0 0 24 24" width={17} height={17} fill="var(--text-muted, #7D8494)">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>

              <button
                onClick={togglePlay}
                title="Play / Pause"
                style={{
                  width: 32,
                  height: 32,
                  margin: '0 4px',
                  borderRadius: 16,
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: 'var(--app-accent, #1E9BEB)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isPlaying ? (
                    <svg viewBox="0 0 24 24" width={16} height={16} fill="white">
                      <path d="M14 19h4V5h-4v14zm-8 0h4V5H6v14z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width={16} height={16} fill="white" style={{ marginLeft: 1.5 }}>
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </div>
              </button>

              <button onClick={() => nextTrack(true)} title="Next track" style={iconBtnStyle(26, 26)}>
                <svg viewBox="0 0 24 24" width={17} height={17} fill="var(--text-muted, #7D8494)">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>
            </div>

            {/* ПРАВАЯ ЧАСТЬ: SHUFFLE, REPEAT (3 состояния), VOLUME, CLOSE */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1, zIndex: 1, overflow: 'visible' }}>
              <button
                onClick={toggleShuffle}
                title={isShuffle ? 'Shuffle: On' : 'Shuffle: Off'}
                style={iconBtnStyle(22, 22, '0 1px 0 0')}
              >
                <svg
                  viewBox="0 0 24 24"
                  width={13}
                  height={13}
                  fill={isShuffle ? 'var(--app-accent, #1E9BEB)' : 'var(--text-muted, #7D8494)'}
                >
                  <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
                </svg>
              </button>

              <button
                onClick={cycleRepeat}
                title={
                  repeatMode === 'one'
                    ? 'Repeat: Current Track'
                    : repeatMode === 'all'
                    ? 'Repeat: Entire Playlist'
                    : 'Repeat: Off'
                }
                style={iconBtnStyle(22, 22, '0 1px 0 0')}
              >
                {repeatMode === 'one' ? (
                  <svg viewBox="0 0 24 24" width={13} height={13} fill="var(--app-accent, #1E9BEB)">
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    width={13}
                    height={13}
                    fill={repeatMode === 'all' ? 'var(--app-accent, #1E9BEB)' : 'var(--text-muted, #7D8494)'}
                  >
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
                  </svg>
                )}
              </button>

              {/* ЗВУК И СЛАЙДЕР */}
              <div
                ref={volumeContainerRef}
                onMouseEnter={onVolumeMouseEnter}
                onMouseLeave={onVolumeMouseLeave}
                onWheel={onVolumeWheel}
                style={{ position: 'relative', margin: '0 2px 0 0', overflow: 'visible' }}
              >
                <button
                  onClick={onVolumeBtnClick}
                  title={volume <= 0 ? 'Unmute' : 'Mute'}
                  style={iconBtnStyle(22, 22)}
                >
                  {volume <= 0 ? (
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="var(--text-muted, #7D8494)">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                  ) : volume < 50 ? (
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="var(--text-muted, #7D8494)">
                      <path d="M5 9v6h4l5 5V4L9 9H5zm11 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="var(--text-muted, #7D8494)">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                  )}
                </button>

                {isVolumePopupOpen && (
                  <div
                    onMouseEnter={onVolumeMouseEnter}
                    onMouseLeave={onVolumeMouseLeave}
                    onWheel={onVolumeWheel}
                    style={{
                      position: 'absolute',
                      bottom: 26,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 32,
                      height: 110,
                      backgroundColor: 'var(--bg-chat, #11141B)',
                      border: '1px solid var(--divider-color, #1E232F)',
                      borderRadius: 14,
                      zIndex: 9999,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: -5,
                        right: -5,
                        height: 12,
                        background: 'transparent',
                      }}
                    />

                    <div
                      ref={volumeTrackRef}
                      onMouseDown={onVolumeMouseDown}
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: 90,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          width: 3.5,
                          height: '100%',
                          backgroundColor: 'var(--other-bubble-bg, #1C212D)',
                          borderRadius: 1.75,
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          width: 3.5,
                          height: fillHeight,
                          backgroundColor: 'var(--app-accent, #1E9BEB)',
                          borderRadius: 1.75,
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: thumbBottom,
                          width: 11,
                          height: 11,
                          borderRadius: 5.5,
                          backgroundColor: 'var(--app-accent, #1E9BEB)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <button onClick={closePlayer} title="Close Player" style={iconBtnStyle(22, 22, '0 0 0 2px')}>
                <svg viewBox="0 0 24 24" width={13} height={13} fill="var(--text-muted, #7D8494)">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
          </div>

          {/* ПРОГРЕСС-БАР С ПЕРЕМОТКОЙ */}
          <div
            ref={progressBarRef}
            onMouseEnter={() => setIsHoveringProgress(true)}
            onMouseLeave={() => setIsHoveringProgress(false)}
            onMouseDown={onProgressBarMouseDown}
            style={{
              position: 'relative',
              height: 7,
              cursor: 'pointer',
              margin: '-1px 0 1px 0',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: isHoveringProgress || isDraggingProgress ? 4 : 2,
                borderRadius: 1,
                backgroundColor: 'var(--other-bubble-bg, #1C212D)',
                transition: 'height 0.12s ease-out',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                width: `${progressPercent}%`,
                height: isHoveringProgress || isDraggingProgress ? 4 : 2,
                borderRadius: 1,
                backgroundColor: 'var(--app-accent, #1E9BEB)',
                transition: isDraggingProgress ? 'none' : 'height 0.12s ease-out',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: `calc(${progressPercent}% - 4px)`,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: 'var(--app-accent, #1E9BEB)',
                border: '1px solid white',
                opacity: isHoveringProgress || isDraggingProgress ? 1 : 0,
                transition: 'opacity 0.12s ease-out',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* 2. РАЗВЕРНУТЫЙ ПЛЕЙЛИСТ */}
        {playerHeight > COMPACT_HEIGHT && (
          <div
            className="wpf-scroll-viewer"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              margin: '4px 8px 6px 8px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {playlist.map((track, idx) => {
              const isTrackPlaying =
                track.isPlaying ||
                (currentTrack &&
                  (AudioConverterHelper.isSameAttachment(currentTrack.attachment, track.attachment) ||
                    (Boolean(currentTrack.attachment.url) && currentTrack.attachment.url === track.attachment.url)) &&
                  isPlaying);

              return (
                <div
                  key={track.attachment.url || `${track.messageId}_${idx}` || idx}
                  onClick={() => playTrack(track)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 6px',
                    margin: '1.5px 0',
                    borderRadius: 8,
                    cursor: 'pointer',
                    backgroundColor: isTrackPlaying ? 'var(--other-bubble-bg, #1C212D)' : 'transparent',
                    transition: 'background-color 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isTrackPlaying) e.currentTarget.style.backgroundColor = 'var(--other-bubble-bg, #1C212D)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isTrackPlaying) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 6,
                      backgroundColor: 'var(--app-accent, #1E9BEB)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 8,
                      flexShrink: 0,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <svg viewBox="0 0 24 24" width={17} height={17} fill="white">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                    {track.coverArt && (
                      <img
                        src={track.coverArt}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0, marginRight: 6, display: 'flex', flexDirection: 'column' }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: isTrackPlaying ? 'var(--app-accent, #1E9BEB)' : 'var(--main-window-text, #FFFFFF)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {track.title}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        color: 'var(--text-muted, #7D8494)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginTop: 1,
                      }}
                    >
                      {track.artist}
                    </span>
                  </div>

                  {isTrackPlaying && (
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="var(--app-accent, #1E9BEB)">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MusicPlayerView;