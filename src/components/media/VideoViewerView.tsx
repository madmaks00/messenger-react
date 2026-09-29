import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useVideoViewerStore } from '../../stores/videoViewerStore';
import { mediaCacheService } from '../../services/mediaCache.service';
import { BASE_SERVER_URL } from '../../services/apiClient';
import { UrlHelper } from '../../utils/helpers';

// Material Design SVG Paths (WPF PackIcon)
const MDI_ICONS = {
  close: 'M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z',
  play: 'M8,5.14V19.14L19,12.14L8,5.14Z',
  pause: 'M14,19H18V5H14M6,19H10V5H6V19Z',
  volumeHigh: 'M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z',
  volumeMute: 'M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.45 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L4.27,3M19,12C19,12.82 18.84,13.61 18.55,14.33L20.07,15.85C20.67,14.69 21,13.39 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z',
  fullscreen: 'M5,5H10V7H7V10H5V5M14,5H19V10H17V7H14V5M17,14H19V19H14V17H17V14M10,17V19H5V14H7V17H10Z',
  fullscreenExit: 'M14,14H19V16H16V19H14V14M5,14H10V19H8V16H5V14M8,5H10V10H5V8H8V5M19,8V10H14V5H16V8H19Z',
  rotateRight: 'M12,4A8,8 0 0,1 20,12H23L19.5,15.5L16,12H19A7,7 0 0,0 12,5C8.42,5 5.5,7.92 5.5,11.5C5.5,15.08 8.42,18 12,18C13.57,18 15.03,17.44 16.18,16.5L17.6,17.92C16.08,19.22 14.13,20 12,20A9,9 0 0,1 3,11.5A9,9 0 0,1 12,4Z',
  trayArrowDown: 'M2,12H4V17H20V12H22V17A2,2 0 0,1 20,19H4A2,2 0 0,1 2,17V12M12,15L17.5,9.5L16.08,8.08L13,11.17V2H11V11.17L7.92,8.08L6.5,9.5L12,15Z',
  cogOutline: 'M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z',
};

export const VideoViewerView: React.FC = () => {
  const {
    isOpen,
    videoUrl,
    isPlaying,
    isBuffering,
    isFullscreen,
    areControlsVisible,
    positionSeconds,
    durationSeconds,
    currentTimeStr,
    remainingTimeStr,
    volume,
    isMuted,
    playbackSpeed,
    rotationAngle,

    close,
    togglePlay,
    toggleFullscreen,
    toggleMute,
    setVolume,
    setSpeed,
    rotate,
    stepForward,
    stepBackward,
    seekTo,
    startSliderDrag,
    endSliderDrag,
    updatePlaybackInfo,
    onMediaEnded,
    onUserInteraction,
    downloadVideo,
    setIsBuffering,
  } = useVideoViewerStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const [resolvedSrc, setResolvedSrc] = useState<string>('');
  const [isSpeedOpen, setIsSpeedOpen] = useState<boolean>(false);
  const [centerIndicator, setCenterIndicator] = useState<{ isPlaying: boolean; active: boolean }>({
    isPlaying: true,
    active: false,
  });

  const [isScrubberHover, setIsScrubberHover] = useState<boolean>(false);
  const [isDraggingScrubber, setIsDraggingScrubber] = useState<boolean>(false);

  // 1. Кэширование и получение URL видео
  useEffect(() => {
    let cancelled = false;
    if (!videoUrl || !isOpen) {
      setResolvedSrc('');
      return;
    }

    const norm = videoUrl.startsWith('blob:')
      ? videoUrl
      : UrlHelper.normalize(videoUrl, BASE_SERVER_URL);

    if (norm.startsWith('blob:')) {
      setResolvedSrc(norm);
    } else {
      mediaCacheService
        .getCachedMediaUrl(norm)
        .then((cached) => {
          if (!cancelled && cached) setResolvedSrc(cached);
          else if (!cancelled) setResolvedSrc(norm);
        })
        .catch(() => {
          if (!cancelled) setResolvedSrc(norm);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [videoUrl, isOpen]);

  // 2. Синхронизация громкости и скорости
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = volume;
    videoRef.current.muted = isMuted;
  }, [volume, isMuted]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // 3. Синхронизация воспроизведения
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      const p = video.play();
      if (p !== undefined) {
        p.catch(() => {});
      }
    } else {
      video.pause();
    }
  }, [isPlaying, resolvedSrc]);

  // 4. Полноэкранный режим
  useEffect(() => {
    if (!rootRef.current) return;

    if (isFullscreen) {
      if (!document.fullscreenElement) {
        rootRef.current.requestFullscreen?.().catch(() => {});
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  }, [isFullscreen]);

  const triggerCenterIndicator = useCallback((playing: boolean) => {
    setCenterIndicator({ isPlaying: playing, active: true });
    setTimeout(() => {
      setCenterIndicator((prev) => ({ ...prev, active: false }));
    }, 500);
  }, []);

  // 5. Клавиатурные хоткеи
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          triggerCenterIndicator(!isPlaying);
          break;
        case 'Escape':
          e.preventDefault();
          if (isFullscreen) {
            toggleFullscreen();
          } else {
            close();
          }
          break;
        case 'r':
        case 'R':
        case 'к':
        case 'К':
          e.preventDefault();
          rotate();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          stepBackward();
          if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          stepForward();
          if (videoRef.current) {
            videoRef.current.currentTime = Math.min(
              videoRef.current.duration || 0,
              videoRef.current.currentTime + 5
            );
          }
          break;
        case 'f':
        case 'F':
        case 'а':
        case 'А':
        case 'F11':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPlaying, isFullscreen, togglePlay, toggleFullscreen, close, rotate, stepForward, stepBackward, triggerCenterIndicator]);

  // 6. Точный расчет скруббера при клике и перетаскивании
  const calculateScrubberSeconds = useCallback(
    (clientX: number) => {
      if (!scrubberRef.current || durationSeconds <= 0) return 0;
      const rect = scrubberRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const progress = Math.max(0, Math.min(1, relativeX / rect.width));
      return progress * durationSeconds;
    },
    [durationSeconds]
  );

  const handleScrubberMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingScrubber(true);
    startSliderDrag();

    const targetSec = calculateScrubberSeconds(e.clientX);
    seekTo(targetSec);
    if (videoRef.current) videoRef.current.currentTime = targetSec;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const sec = calculateScrubberSeconds(moveEvent.clientX);
      seekTo(sec);
      if (videoRef.current) videoRef.current.currentTime = sec;
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDraggingScrubber(false);
      const finalSec = calculateScrubberSeconds(upEvent.clientX);
      endSliderDrag(finalSec);
      if (videoRef.current) videoRef.current.currentTime = finalSec;

      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (!isOpen) return null;

  const progressPercent = durationSeconds > 0 ? (positionSeconds / durationSeconds) * 100 : 0;
  const isScrubberActive = isScrubberHover || isDraggingScrubber;

  return (
    <div
      ref={rootRef}
      onMouseMove={onUserInteraction}
      onClick={close} // 🟢 ФИКС 3: Любой клик в темную область окна закрывает плеер
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: isFullscreen ? '#000000' : 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes centerPulseAnim {
          0% { opacity: 0.85; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.15); }
        }
        .wpf-center-pulse {
          animation: centerPulseAnim 500ms cubic-bezier(0.215, 0.61, 0.355, 1) forwards;
        }
      `}</style>

      {/* 🟢 ФИКС 2 И 3: Контейнер пропускает клики (pointerEvents: none). 
          Клик по затемнению вокруг видео уходит в rootRef и закрывает окно! */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: isFullscreen ? '100vw' : 'calc(100vw - 80px)',
          height: isFullscreen ? '100vh' : 'calc(100vh - 140px)',
          maxWidth: isFullscreen ? '100vw' : 'calc(100vw - 80px)',
          maxHeight: isFullscreen ? '100vh' : 'calc(100vh - 140px)',
          pointerEvents: 'none', // Кликабельно строго само видео!
          boxSizing: 'border-box',
        }}
      >
        <video
          ref={videoRef}
          src={resolvedSrc}
          playsInline
          onClick={(e) => {
            e.stopPropagation(); // Клик по телу видео делает паузу/плей
            togglePlay();
            triggerCenterIndicator(!isPlaying);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onCanPlay={() => setIsBuffering(false)}
          onTimeUpdate={() => {
            if (videoRef.current && !isDraggingScrubber) {
              const cur = videoRef.current.currentTime;
              const dur = videoRef.current.duration;
              updatePlaybackInfo(cur, dur);
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              const cur = videoRef.current.currentTime;
              const dur = videoRef.current.duration;
              updatePlaybackInfo(cur, dur);
            }
          }}
          onEnded={onMediaEnded}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: isFullscreen ? 0 : 8,
            transform: `rotate(${rotationAngle}deg)`,
            transition: 'transform 0.25s cubic-bezier(0.215, 0.61, 0.355, 1)',
            pointerEvents: 'auto', // Само видео кликабельно
            cursor: 'pointer',
            display: 'block',
          }}
        />
      </div>

      {/* Индикатор Play/Pause по центру видео */}
      {centerIndicator.active && (
        <div
          className="wpf-center-pulse"
          style={{
            position: 'absolute',
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: 'rgba(0, 0, 0, 0.53)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="#FFFFFF"
            style={{ marginLeft: centerIndicator.isPlaying ? 2 : 0, display: 'block' }}
          >
            <path d={centerIndicator.isPlaying ? MDI_ICONS.play : MDI_ICONS.pause} />
          </svg>
        </div>
      )}

      {/* Спиннер буферизации */}
      {isBuffering && (
        <div
          style={{
            position: 'absolute',
            width: 38,
            height: 38,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 11,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '3.5px solid rgba(255, 255, 255, 0.25)',
              borderTopColor: '#FFFFFF',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Оверлей контролов (pointerEvents: none пропускает клики на фон) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: areControlsVisible ? 1 : 0,
          transition: 'opacity 0.2s cubic-bezier(0.645, 0.045, 0.355, 1)',
        }}
      >
        {/* Кнопка закрытия */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 20,
            display: 'flex',
            alignItems: 'center',
            pointerEvents: areControlsVisible ? 'auto' : 'none',
          }}
        >
          <IconButton
            icon={MDI_ICONS.close}
            size={22}
            width={36}
            height={36}
            title="Close (Esc)"
            onClick={close}
          />
        </div>

        {/* 🟢 Нижний остров управления */}
        <div
          onClick={(e) => e.stopPropagation()} // Клик внутри меню не закрывает окно
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 460,
            backgroundColor: 'rgba(24, 24, 24, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.125)',
            borderRadius: 10,
            padding: '8px 14px 10px 14px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            boxSizing: 'border-box',
            pointerEvents: areControlsVisible ? 'auto' : 'none',
          }}
        >
          {/* Строка кнопок */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            {/* Громкость */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <IconButton
                icon={isMuted ? MDI_ICONS.volumeMute : MDI_ICONS.volumeHigh}
                size={18}
                width={28}
                height={28}
                onClick={toggleMute}
              />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                style={{
                  width: 50,
                  height: 3,
                  marginLeft: 4,
                  accentColor: '#FFFFFF',
                  cursor: 'pointer',
                }}
              />
            </div>

            {/* Play/Pause */}
            <IconButton
              icon={isPlaying ? MDI_ICONS.pause : MDI_ICONS.play}
              size={22}
              width={34}
              height={34}
              onClick={togglePlay}
            />

            {/* Опции справа */}
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
              <IconButton
                icon={isFullscreen ? MDI_ICONS.fullscreenExit : MDI_ICONS.fullscreen}
                size={17}
                width={28}
                height={28}
                title="Fullscreen (F)"
                onClick={toggleFullscreen}
              />

              <IconButton
                icon={MDI_ICONS.rotateRight}
                size={17}
                width={28}
                height={28}
                marginLeft={2}
                title="Rotate 90° (R)"
                onClick={rotate}
              />

              <IconButton
                icon={MDI_ICONS.trayArrowDown}
                size={17}
                width={28}
                height={28}
                marginLeft={2}
                title="Save Video"
                onClick={downloadVideo}
              />

              <div style={{ position: 'relative', marginLeft: 2 }}>
                <IconButton
                  icon={MDI_ICONS.cogOutline}
                  size={17}
                  width={28}
                  height={28}
                  title="Playback Speed"
                  onClick={() => setIsSpeedOpen((prev) => !prev)}
                />

                {isSpeedOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 34,
                      right: 0,
                      width: 85,
                      backgroundColor: 'rgba(22, 27, 34, 0.85)',
                      border: '1px solid rgba(255, 255, 255, 0.21)',
                      borderRadius: 8,
                      padding: 4,
                      zIndex: 100,
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                    }}
                  >
                    <div
                      style={{
                        color: '#8E939A',
                        fontSize: 11,
                        fontWeight: 'bold',
                        padding: '4px 8px',
                      }}
                    >
                      Speed
                    </div>
                    {[0.5, 1.0, 1.5, 2.0].map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setSpeed(s);
                          setIsSpeedOpen(false);
                        }}
                        style={{
                          width: '100%',
                          height: 26,
                          background: playbackSpeed === s ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                          border: 'none',
                          color: '#FFFFFF',
                          fontSize: 11.5,
                          cursor: 'pointer',
                          borderRadius: 4,
                          textAlign: 'left',
                          padding: '0 8px',
                          display: 'block',
                        }}
                      >
                        {s.toFixed(1)}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 🟢 ФИКС 4: СТРОКА ТАЙМЛАЙНА (Моноширинные div жесткой ширины исключают сдвиг границ скруббера) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: 4,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {/* Текущее время */}
            <div
              style={{
                color: '#DCDCDC',
                fontSize: 11.5,
                fontWeight: 500,
                fontFamily: 'Consolas, monospace',
                fontVariantNumeric: 'tabular-nums',
                width: 44,
                minWidth: 44,
                maxWidth: 44,
                flexShrink: 0,
                textAlign: 'left',
                userSelect: 'none',
              }}
            >
              {currentTimeStr}
            </div>

            {/* Полоса перемотки (жесткие отступы margin: 0 10px) */}
            <div
              ref={scrubberRef}
              onMouseEnter={() => setIsScrubberHover(true)}
              onMouseLeave={() => setIsScrubberHover(false)}
              onMouseDown={handleScrubberMouseDown}
              style={{
                flex: 1,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                position: 'relative',
                margin: '0 10px',
              }}
            >
              {/* Фоновая подложка */}
              <div
                style={{
                  width: '100%',
                  height: isScrubberActive ? 4.5 : 3.0,
                  backgroundColor: 'rgba(255, 255, 255, 0.22)',
                  borderRadius: 1.5,
                  position: 'relative',
                  transition: 'height 0.12s ease',
                  overflow: 'visible',
                }}
              >
                {/* Белая заполненная полоса */}
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, progressPercent))}%`,
                    height: '100%',
                    backgroundColor: '#FFFFFF',
                    borderRadius: 1.5,
                    position: 'relative',
                  }}
                >
                  {/* Ползунок */}
                  <div
                    style={{
                      position: 'absolute',
                      right: -5,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: '#FFFFFF',
                      boxShadow: '0 0 4px rgba(0, 0, 0, 0.5)',
                      opacity: isScrubberActive ? 1 : 0,
                      transition: 'opacity 0.12s ease',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Оставшееся время */}
            <div
              style={{
                color: '#8E939A',
                fontSize: 11.5,
                fontWeight: 500,
                fontFamily: 'Consolas, monospace',
                fontVariantNumeric: 'tabular-nums',
                width: 48,
                minWidth: 48,
                maxWidth: 48,
                flexShrink: 0,
                textAlign: 'right',
                userSelect: 'none',
              }}
            >
              {remainingTimeStr}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const IconButton: React.FC<{
  icon: string;
  size?: number;
  width?: number;
  height?: number;
  marginLeft?: number;
  title?: string;
  onClick: () => void;
}> = ({ icon, size = 18, width = 30, height = 30, marginLeft = 0, title, onClick }) => {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        width,
        height,
        marginLeft,
        background: pressed
          ? 'rgba(255, 255, 255, 0.25)'
          : hover
          ? 'rgba(255, 255, 255, 0.145)'
          : 'transparent',
        border: 'none',
        borderRadius: width / 2,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        color: '#FFFFFF',
        outline: 'none',
        transition: 'background-color 0.1s ease',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF" style={{ display: 'block' }}>
        <path d={icon} />
      </svg>
    </button>
  );
};

export default VideoViewerView;