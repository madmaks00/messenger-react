import React, { useState, useRef, useEffect } from 'react';

interface VideoViewerViewProps {
  videoUrl: string;
  fileHeader?: string;
  senderMeta?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const VideoViewerView: React.FC<VideoViewerViewProps> = ({
  videoUrl,
  fileHeader = 'Video',
  senderMeta = '',
  isOpen,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [isScrubberHovered, setIsScrubberHovered] = useState(false);
  const [isScrubberDragging, setIsScrubberDragging] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // Анимация центрального индикатора Play/Pause
  const [centerIconState, setCenterIconState] = useState<'play' | 'pause' | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'Escape':
          e.preventDefault();
          if (isFullscreen) {
            setIsFullscreen(false);
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          } else {
            onClose();
          }
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          handleRotate();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekDelta(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekDelta(5);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPlaying, isFullscreen, rotation]);

  if (!isOpen) return null;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
      triggerCenterIndicator('play');
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      triggerCenterIndicator('pause');
    }
  };

  const triggerCenterIndicator = (state: 'play' | 'pause') => {
    setCenterIconState(state);
    setTimeout(() => setCenterIconState(null), 500);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const seekDelta = (deltaSeconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + deltaSeconds));
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Обработка клика и протяжки по Scrubber
  const handleScrubberAction = (clientX: number) => {
    if (!scrubberRef.current || duration <= 0 || !videoRef.current) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = progress * duration;
    videoRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const remainingTimeStr = `-${formatTime(Math.max(0, duration - currentTime))}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: isFullscreen ? '#FF000000' : '#A6000000',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      {/* ЦЕНТРАЛЬНОЕ ВИДЕО С ПОВОРОТОМ */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          toggleFullscreen();
        }}
        style={{
          width: isFullscreen ? '100vw' : 'calc(100vw - 80px)',
          height: isFullscreen ? '100vh' : 'calc(100vh - 140px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
              setIsBuffering(false);
            }
          }}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transform: `rotate(${rotation}deg)`,
            transition: 'transform 0.25s ease-out',
          }}
        />
      </div>

      {/* ЗНАЧОК PLAY/PAUSE ПО ЦЕНТРУ */}
      {centerIconState && (
        <div
          style={{
            position: 'absolute',
            width: 64,
            height: 64,
            borderRadius: 32,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            color: '#FFF',
            pointerEvents: 'none',
          }}
        >
          {centerIconState === 'play' ? '▶' : '❚❚'}
        </div>
      )}

      {/* ВЕРХНИЙ ПРАВЫЙ УГОЛ: ЗАКРЫТИЕ */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          position: 'absolute',
          top: 16,
          right: 20,
          background: 'transparent',
          border: 'none',
          color: '#FFF',
          fontSize: 22,
          cursor: 'pointer',
        }}
      >
        ✕
      </button>

      {/* НИЖНИЙ ЛЕВЫЙ УГОЛ: МЕТАДАННЫЕ */}
      <div style={{ position: 'absolute', bottom: 20, left: 24, pointerEvents: 'none' }}>
        <div style={{ color: '#FFF', fontSize: 13.5, fontWeight: 600 }}>{fileHeader}</div>
        <div style={{ color: '#8E939A', fontSize: 12, marginTop: 2 }}>{senderMeta}</div>
      </div>

      {/* НИЖНИЙ ОСТРОВ УПРАВЛЕНИЯ (Ширина 460px) */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 460,
          background: '#B3181818',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 10,
          padding: '8px 14px 10px 14px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* СТРОКА 1: КНОПКИ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          {/* Громкость */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.muted = !isMuted;
                  setIsMuted(!isMuted);
                }
              }}
              style={tgIconBtn}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setVolume(val);
                if (videoRef.current) {
                  videoRef.current.volume = val;
                  videoRef.current.muted = val === 0;
                  setIsMuted(val === 0);
                }
              }}
              style={{ width: 50, accentColor: '#38BDF8' }}
            />
          </div>

          {/* Play/Pause строго по центру */}
          <button onClick={togglePlay} style={{ ...tgIconBtn, fontSize: 18 }}>
            {isPlaying ? '❚❚' : '▶'}
          </button>

          {/* Опции: Fullscreen, Поворот, Скачать, Скорость */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
            <button onClick={toggleFullscreen} style={tgIconBtn} title="Fullscreen (F)">⛶</button>
            <button onClick={handleRotate} style={tgIconBtn} title="Rotate 90° (R)">↻</button>
            <button
              onClick={() => {
                const a = document.createElement('a');
                a.href = videoUrl;
                a.download = fileHeader || 'video.mp4';
                a.click();
              }}
              style={tgIconBtn}
              title="Save Video"
            >
              ⬇
            </button>

            {/* Скорость */}
            <button onClick={() => setSpeedMenuOpen(!speedMenuOpen)} style={tgIconBtn} title="Speed">⚙</button>
            {speedMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 36,
                  right: 0,
                  background: '#D9161B22',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  padding: 4,
                  width: 85,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                }}
              >
                {[0.5, 1.0, 1.5, 2.0].map((spd) => (
                  <div
                    key={spd}
                    onClick={() => {
                      setPlaybackSpeed(spd);
                      if (videoRef.current) videoRef.current.playbackRate = spd;
                      setSpeedMenuOpen(false);
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: 11.5,
                      color: playbackSpeed === spd ? '#38BDF8' : '#FFF',
                      cursor: 'pointer',
                      borderRadius: 4,
                    }}
                  >
                    {spd}x
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* СТРОКА 2: СКРАББЕР И ВРЕМЯ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#DCDCDC', fontSize: 11.5 }}>{formatTime(currentTime)}</span>

          {/* Полоса перемотки */}
          <div
            ref={scrubberRef}
            onMouseEnter={() => setIsScrubberHovered(true)}
            onMouseLeave={() => !isScrubberDragging && setIsScrubberHovered(false)}
            onMouseDown={(e) => {
              setIsScrubberDragging(true);
              handleScrubberAction(e.clientX);
            }}
            onMouseMove={(e) => {
              if (isScrubberDragging) handleScrubberAction(e.clientX);
            }}
            onMouseUp={() => setIsScrubberDragging(false)}
            style={{
              flex: 1,
              height: 18,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            {/* Фон дорожки */}
            <div
              style={{
                width: '100%',
                height: isScrubberHovered || isScrubberDragging ? 4.5 : 3.0,
                backgroundColor: 'rgba(255,255,255,0.22)',
                borderRadius: 2,
                position: 'relative',
                transition: 'height 0.15s ease-out',
              }}
            >
              {/* Прогресс */}
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 2,
                }}
              />
            </div>

            {/* Бегунок-кружок */}
            <div
              style={{
                position: 'absolute',
                left: `calc(${progressPercent}% - 5px)`,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: '#FFFFFF',
                boxShadow: '0 0 4px rgba(0,0,0,0.5)',
                opacity: isScrubberHovered || isScrubberDragging ? 1 : 0,
                transition: 'opacity 0.15s',
                pointerEvents: 'none',
              }}
            />
          </div>

          <span style={{ color: '#8E939A', fontSize: 11.5 }}>{remainingTimeStr}</span>
        </div>
      </div>
    </div>
  );
};

const tgIconBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#FFFFFF',
  cursor: 'pointer',
  width: 30,
  height: 30,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 15,
};