import React, { useRef, useState, useEffect } from 'react';

interface TelegramInlinePlayerProps {
  sourceUrl: string;
  thumbnailUrl?: string | null;
  cornerRadius?: string;
  width?: string | number;
  height?: string | number;
}

export const TelegramInlinePlayer: React.FC<TelegramInlinePlayerProps> = ({
  sourceUrl,
  thumbnailUrl,
  cornerRadius = '14px',
  width = '100%',
  height = '100%',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFirstFrameShown, setIsFirstFrameShown] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Пауза, если вкладка ушла в фон (OnWindowDeactivated / Minimized)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
      } else {
        video.play().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', () => video.pause());
    window.addEventListener('focus', () => video.play().catch(() => {}));

    // Остановка при выходе из видимой области скролла (ReleasePlayer)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: cornerRadius,
        overflow: 'hidden',
        background: 'transparent',
      }}
    >
      {/* 1. Постерное превью (скрывается, когда видео готово) */}
      {thumbnailUrl && !isFirstFrameShown && (
        <img
          src={thumbnailUrl}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: cornerRadius,
          }}
        />
      )}

      {/* 2. Декодируемое видео */}
      <video
        ref={videoRef}
        src={sourceUrl}
        autoPlay
        loop
        muted
        playsInline
        onLoadedData={() => setIsFirstFrameShown(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          borderRadius: cornerRadius,
        }}
      />
    </div>
  );
};