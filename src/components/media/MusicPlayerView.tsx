import React, { useState, useRef, useEffect } from 'react';
import { useMusicPlayerStore } from '../../stores/musicPlayerStore';
import { IAudioTrackModel } from '../../types/models';

const COMPACT_HEIGHT = 82;
const EXPANDED_HEIGHT = 280;

export const MusicPlayerView: React.FC = () => {
  const {
    isOpen,
    isPlaying,
    isShuffle,
    isRepeat,
    volume,
    currentTrack,
    playlist,
    currentTimeStr,
    totalTimeStr,
    progressPercent,
    playTrack,
    togglePlay,
    nextTrack,
    previousTrack,
    toggleShuffle,
    toggleRepeat,
    seek,
    setVolume,
    closePlayer,
    goToSourceChat,
  } = useMusicPlayerStore();

  const [playerHeight, setPlayerHeight] = useState(COMPACT_HEIGHT);
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);
  const [isScrubberHovered, setIsScrubberHovered] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);

  const isResizing = useRef(false);
  const resizeStartY = useRef(0);
  const resizeStartH = useRef(COMPACT_HEIGHT);

  // Обработка вертикального ресайза (ResizeThumb_DragDelta)
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true;
    resizeStartY.current = e.clientY;
    resizeStartH.current = playerHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const deltaY = resizeStartY.current - moveEvent.clientY;
      const newH = Math.min(450, Math.max(COMPACT_HEIGHT, resizeStartH.current + deltaY));
      setPlayerHeight(newH);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeDoubleClick = () => {
    setPlayerHeight((prev) => (prev > COMPACT_HEIGHT + 20 ? COMPACT_HEIGHT : EXPANDED_HEIGHT));
  };

  if (!isOpen || !currentTrack) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      {/* 🔖 ЗАКЛАДКА ПЕРЕХОДА К ЧАТУ (CornerTabButtonStyle) */}
      <button
        onClick={goToSourceChat}
        title="Перейти к сообщению с треком"
        style={{
          alignSelf: 'flex-start',
          background: '#17212B',
          border: '1px solid #222E35',
          borderBottom: 'none',
          borderRadius: '0 10px 0 0',
          padding: '4px 12px 3px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          color: '#F8FAFC',
          marginBottom: -1,
          zIndex: 10,
        }}
      >
        <div style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#3B82F6', color: '#FFF', fontSize: 9, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {(currentTrack.chatName || 'C').charAt(0).toUpperCase()}
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentTrack.chatName || 'Chat'}
        </span>
        <span style={{ fontSize: 10, color: '#94A3B8' }}>↗</span>
      </button>

      {/* 🎵 КОРПУС ПЛЕЕРА С РЕСАЙЗОМ */}
      <div
        style={{
          height: playerHeight,
          minHeight: COMPACT_HEIGHT,
          maxHeight: 450,
          backgroundColor: '#17212B',
          borderTop: '1px solid #222E35',
          boxShadow: '0 -4px 14px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* ЗОНА РЕСАЙЗА (Thumb) */}
        <div
          onMouseDown={handleResizeMouseDown}
          onDoubleClick={handleResizeDoubleClick}
          title="Drag to resize, double click to toggle"
          style={{ height: 4, width: '100%', cursor: 'ns-resize', position: 'relative' }}
        >
          <div style={{ height: 1.5, backgroundColor: 'var(--app-accent, #3B82F6)', opacity: 0.3 }} />
        </div>

        {/* 1. КОМПАКТНЫЙ ПЛЕЕР */}
        <div style={{ padding: '4px 10px 2px 10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', height: 40 }}>
            {/* Обложка + Название + Время + Автор */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: 16, flexShrink: 0 }}>
                🎵
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentTrack.title || currentTrack.attachment.fileName}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: '#94A3B8' }}>
                  <span style={{ color: 'var(--app-accent, #38BDF8)', fontWeight: 600 }}>{currentTimeStr}</span>
                  <span>/ {totalTimeStr}</span>
                  <span>•</span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>
                    {currentTrack.artist || 'Unknown'}
                  </span>
                </div>
              </div>
            </div>

            {/* Кнопки управления (⏮ ▶ ⏭) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={previousTrack} style={playerIconBtnStyle} title="Previous track">⏮</button>
              <button
                onClick={togglePlay}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: 'var(--app-accent, #3B82F6)',
                  border: 'none',
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
                title="Play / Pause"
              >
                {isPlaying ? '❚❚' : '▶'}
              </button>
              <button onClick={nextTrack} style={playerIconBtnStyle} title="Next track">⏭</button>
            </div>

            {/* Правые контролы (Shuffle, Repeat, Volume, Close) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
              <button onClick={toggleShuffle} style={{ ...playerIconBtnStyle, color: isShuffle ? '#38BDF8' : '#94A3B8' }} title="Shuffle">
                🔀
              </button>
              <button onClick={toggleRepeat} style={{ ...playerIconBtnStyle, color: isRepeat ? '#38BDF8' : '#94A3B8' }} title="Repeat">
                🔁
              </button>

              {/* Громкость с выпадающим вертикальным слайдером */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setIsVolumeOpen(!isVolumeOpen)}
                  style={playerIconBtnStyle}
                  title="Volume"
                >
                  {volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}
                </button>

                {isVolumeOpen && (
                  <div
                    onWheel={(e) => setVolume(volume + (e.deltaY < 0 ? 5 : -5))}
                    style={{
                      position: 'absolute',
                      bottom: 34,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 32,
                      height: 110,
                      backgroundColor: '#17212B',
                      border: '1px solid #222E35',
                      borderRadius: 14,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px 0',
                      boxSizing: 'border-box',
                    }}
                  >
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={volume}
                      onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                      style={{
                        writingMode: 'vertical-lr',
                        direction: 'rtl',
                        height: 80,
                        width: 4,
                        accentColor: '#3B82F6',
                        cursor: 'pointer',
                      }}
                    />
                  </div>
                )}
              </div>

              <button onClick={closePlayer} style={playerIconBtnStyle} title="Close Player">✕</button>
            </div>
          </div>

          {/* ПРОГРЕСС-БАР ТРЕКА С АНИМАЦИЕЙ ХОВЕРА (2px -> 4px) */}
          <div
            onMouseEnter={() => setIsScrubberHovered(true)}
            onMouseLeave={() => !isDraggingProgress && setIsScrubberHovered(false)}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = ((e.clientX - rect.left) / rect.width) * 100;
              seek(pct);
            }}
            style={{
              height: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '100%',
                height: isScrubberHovered ? 4 : 2,
                backgroundColor: '#202C33',
                borderRadius: 2,
                position: 'relative',
                transition: 'height 0.12s ease-out',
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  backgroundColor: 'var(--app-accent, #3B82F6)',
                  borderRadius: 2,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: `calc(${progressPercent}% - 4px)`,
                  top: -2,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'var(--app-accent, #3B82F6)',
                  border: '1px solid #FFFFFF',
                  opacity: isScrubberHovered ? 1 : 0,
                  transition: 'opacity 0.12s',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* 2. РАЗВЕРНУТЫЙ ПЛЕЙЛИСТ */}
        {playerHeight > COMPACT_HEIGHT + 20 && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
            {playlist.map((track) => {
              const isCurrent = currentTrack.attachment.url === track.attachment.url;
              return (
                <div
                  key={track.messageId + track.attachment.fileName}
                  onClick={() => playTrack(track)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    backgroundColor: isCurrent ? '#202C33' : 'transparent',
                    marginBottom: 2,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 6, backgroundColor: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: 16, flexShrink: 0 }}>
                      🎵
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isCurrent ? 'var(--app-accent, #3B82F6)' : '#FFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {track.title || track.attachment.fileName}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {track.artist || 'Unknown'}
                      </div>
                    </div>
                  </div>

                  {isCurrent && isPlaying && (
                    <span style={{ color: 'var(--app-accent, #3B82F6)', fontSize: 14 }}>🔊</span>
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

const playerIconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#94A3B8',
  width: 26,
  height: 26,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  borderRadius: 13,
};