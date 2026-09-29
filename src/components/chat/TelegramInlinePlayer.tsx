import React, { useEffect, useRef, useState, useCallback } from 'react';
import { mediaCacheService } from '../../services/mediaCache.service';
import { BASE_SERVER_URL } from '../../services/apiClient';
import { UrlHelper } from '../../utils/helpers';

interface TelegramInlinePlayerProps {
  sourceUrl: string;
  thumbnailUrl?: string | null;
  cornerRadius: string;
  onDimensionsLoaded?: (naturalWidth: number, naturalHeight: number) => void;
}

export const TelegramInlinePlayer: React.FC<TelegramInlinePlayerProps> = ({
  sourceUrl,
  thumbnailUrl,
  cornerRadius,
  onDimensionsLoaded,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [posterSrc, setPosterSrc] = useState<string>('');
  const [firstFrameRendered, setFirstFrameRendered] = useState<boolean>(false);
  const [isWindowActive, setIsWindowActive] = useState<boolean>(true);

  // 1. Нормализация и локальное кэширование постера (аналог LoadThumbnail в WPF)
  useEffect(() => {
    let isCancelled = false;
    const rawThumb = thumbnailUrl || sourceUrl || '';
    if (!rawThumb) return;

    const normalizedThumb = rawThumb.startsWith('blob:')
      ? rawThumb
      : UrlHelper.normalize(rawThumb, BASE_SERVER_URL);

    if (normalizedThumb.startsWith('blob:')) {
      setPosterSrc(normalizedThumb);
    } else {
      mediaCacheService
        .getCachedMediaUrl(normalizedThumb)
        .then((cached) => {
          if (!isCancelled && cached) {
            setPosterSrc(cached);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setPosterSrc(normalizedThumb);
          }
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [thumbnailUrl, sourceUrl]);

  // 2. Кэширование и загрузка видеофайла (аналог EnsureCachedLocallyAsync в WPF)
  useEffect(() => {
    let isCancelled = false;
    setFirstFrameRendered(false);

    if (!sourceUrl) {
      setVideoSrc('');
      return;
    }

    const normalizedVideo = sourceUrl.startsWith('blob:')
      ? sourceUrl
      : UrlHelper.normalize(sourceUrl, BASE_SERVER_URL);

    if (normalizedVideo.startsWith('blob:')) {
      setVideoSrc(normalizedVideo);
    } else {
      mediaCacheService
        .getCachedMediaUrl(normalizedVideo)
        .then((cached) => {
          if (!isCancelled && cached) {
            setVideoSrc(cached);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setVideoSrc(normalizedVideo);
          }
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [sourceUrl]);

  // 3. Отслеживание активности окна и видимости вкладки (аналог OnWindowActivated / Deactivated в WPF)
  useEffect(() => {
    const handleFocus = () => setIsWindowActive(true);
    const handleBlur = () => setIsWindowActive(false);
    const handleVisibilityChange = () => {
      setIsWindowActive(document.visibilityState === 'visible');
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 4. Управление воспроизведением / паузой в зависимости от фокуса окна (CheckAndPlay / PausePlayer)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isWindowActive) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Автоплей беззвучного видео разрешен браузером, игнорируем прерывания смены src
        });
      }
    } else {
      video.pause();
    }
  }, [isWindowActive, videoSrc]);

  const handleLoadedData = useCallback(() => {
    setFirstFrameRendered(true);
  }, []);

  const handleLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const target = e.currentTarget;
      if (target.videoWidth > 0 && target.videoHeight > 0) {
        onDimensionsLoaded?.(target.videoWidth, target.videoHeight);
      }
    },
    [onDimensionsLoaded]
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        borderRadius: cornerRadius,
        overflow: 'hidden',
        backgroundColor: 'transparent',
      }}
    >
      {/* Слой 1: Постер (_posterBorder в WPF, виден до отрисовки первого кадра) */}
      {posterSrc && !firstFrameRendered && (
        <img
          src={posterSrc}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: cornerRadius,
            display: 'block',
          }}
        />
      )}

      {/* Слой 2: Видео-поток (_videoImage в WPF) */}
      {videoSrc && (
        <video
          ref={videoRef}
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={handleLoadedData}
          onLoadedMetadata={handleLoadedMetadata}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: cornerRadius,
            display: 'block',
          }}
        />
      )}
    </div>
  );
};