import React, { useState, useEffect, useCallback } from 'react';
import { IAttachment, AttachmentHelper } from '../../types/models';
import { AttachmentType } from '../../types/enums';
import { TelegramInlinePlayer } from './TelegramInlinePlayer';
import { mediaCacheService } from '../../services/mediaCache.service';
import { BASE_SERVER_URL } from '../../services/apiClient';
import { UrlHelper } from '../../utils/helpers';

interface MediaAlbumGridProps {
  media: IAttachment[];
  mediaWidth: number;
  mediaHeight: number;
  isSilentVideo?: boolean;
  onMediaClick?: (attachment: IAttachment) => void;
  onImageDimensionsLoaded?: (attachment: IAttachment, naturalWidth: number, naturalHeight: number) => void;
}

// Порог автовоспроизведения для веба (100 МБ)
const AUTO_PLAY_SIZE_LIMIT = 100 * 1024 * 1024;

// Кисти темы из DefaultDark.xaml
const BRUSHES = {
  videoOverlayBg: 'rgba(0, 0, 0, 0.125)', // #20000000
  videoLabelTagBg: 'rgba(0, 0, 0, 0.6)',   // #99000000
  videoPlayIcon: '#FFFFFF',                // #FFFFFF
  videoPlayLabel: '#FFFFFF',               // #FFFFFF
  gifTagBg: 'rgba(0, 0, 0, 0.5)',          // #80000000
  moreMediaOverlayBg: 'rgba(0, 0, 0, 0.7)',// #B3000000
};

// Material Design SVG иконки
const MATERIAL_ICONS = {
  videoOutline: 'M15,8V16H5V8H15M16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5V7A1,1 0 0,0 16,6Z',
  play: 'M8,5.14V19.14L19,12.14L8,5.14Z',
  arrowDown: 'M11,4H13V12L16.5,8.5L17.92,9.92L12,15.84L6.08,9.92L7.5,8.5L11,12V4Z',
};

export const MediaAlbumGrid: React.FC<MediaAlbumGridProps> = ({
  media,
  mediaWidth,
  mediaHeight,
  isSilentVideo: forceSilent,
  onMediaClick,
  onImageDimensionsLoaded,
}) => {
  if (!media || media.length === 0) return null;

  const totalCount = media.length;
  const displayItems = media.slice(0, 4);
  const extraCount = totalCount > 4 ? totalCount - 3 : 0;

  // Маппинг углов сетки WPF: TopLeft, TopRight, BottomRight, BottomLeft
  const getCornerRadius = (index: number): string => {
    if (totalCount === 1) {
      return '16px 16px 16px 16px';
    }
    if (totalCount === 2) {
      return index === 0 ? '16px 2px 2px 16px' : '2px 16px 16px 2px';
    }
    if (totalCount === 3) {
      if (index === 0) return '16px 2px 2px 2px';
      if (index === 1) return '2px 16px 2px 2px';
      return '2px 2px 16px 16px';
    }
    switch (index) {
      case 0:
        return '16px 2px 2px 2px';
      case 1:
        return '2px 16px 2px 2px';
      case 2:
        return '2px 2px 2px 16px';
      case 3:
        return '2px 2px 16px 2px';
      default:
        return '2px';
    }
  };

  const getGridItemStyle = (index: number): React.CSSProperties => {
    const borderRadius = getCornerRadius(index);

    if (totalCount === 1) {
      return {
        gridColumn: 'span 2',
        gridRow: 'span 2',
        width: '100%',
        height: '100%',
        borderRadius,
      };
    }
    if (totalCount === 2) {
      return {
        gridRow: 'span 2',
        borderRadius,
      };
    }
    if (totalCount === 3 && index === 2) {
      return {
        gridColumn: 'span 2',
        gridRow: '2',
        borderRadius,
      };
    }
    return {
      borderRadius,
    };
  };

  return (
    <div
      style={{
        width: `${mediaWidth}px`,
        height: `${mediaHeight}px`,
        display: 'grid',
        gridTemplateColumns: totalCount === 1 ? '1fr' : '1fr 1fr',
        gridTemplateRows: totalCount === 1 ? '1fr' : '1fr 1fr',
        margin: 0,
        padding: 0,
        position: 'relative',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {displayItems.map((item, index) => {
        const isLastWithOverlay = index === 3 && extraCount > 0;
        const cellRadius = getCornerRadius(index);

        const isVideo = item.type === AttachmentType.Video || AttachmentHelper.isVideo(item);
        const isSilent = Boolean(forceSilent || AttachmentHelper.isSilentVideo(item));
        const fileSizeBytes = item.fileSizeBytes || 0;
        const isDownloaded = Boolean(item.isDownloaded);

        // 🟢 Логика Варианта Б:
        // Если видео весит <= 100 МБ (или без звука / GIF) -> автовоспроизводится в ленте без звука (muted)
        const isOver100MB = fileSizeBytes > AUTO_PLAY_SIZE_LIMIT;
        const shouldAutoPlayInline = isVideo && (isSilent || !isOver100MB);

        // Оверлей со стрелкой/кнопкой Play отображается только для видео со звуком тяжелее 100 МБ
        const showHeavyVideoOverlay = isVideo && !isSilent && isOver100MB;

        const durationFormatted = AttachmentHelper.formatDuration(item.durationSeconds);
        const durationStr = durationFormatted && durationFormatted.length > 0 ? durationFormatted : 'Video';
        const displayImageUrl = AttachmentHelper.getDisplayImageUrl(item) || '';

        return (
          <div
            key={item.id || index}
            onClick={() => onMediaClick?.(item)}
            style={{
              ...getGridItemStyle(index),
              margin: '1px',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer',
              backgroundColor: 'transparent',
            }}
          >
            {/* 1. СТАТИЧЕСКАЯ ПОДЛОЖКА (Для фото или для видео > 100 МБ) */}
            {!shouldAutoPlayInline && (
              <CachedImageItem
                imageUrl={displayImageUrl}
                altText={item.fileName}
                cornerRadius={cellRadius}
                onDimensionsLoaded={(nw, nh) => onImageDimensionsLoaded?.(item, nw, nh)}
              />
            )}

            {/* 2. ИНЛАЙН-ПЛЕЕР ДЛЯ ВИДЕО <= 100 МБ И ДЛЯ GIF (Без звука, автоплей) */}
            {shouldAutoPlayInline && (
              <TelegramInlinePlayer
                sourceUrl={item.url}
                thumbnailUrl={displayImageUrl}
                cornerRadius={cellRadius}
                onDimensionsLoaded={(nw, nh) => onImageDimensionsLoaded?.(item, nw, nh)}
              />
            )}

            {/* 3. ПЛАШКА ДЛИТЕЛЬНОСТИ ДЛЯ ИНЛАЙН-ВИДЕО СО ЗВУКОМ (≤ 100 МБ) */}
            {shouldAutoPlayInline && isVideo && !isSilent && (
              <div
                style={{
                  position: 'absolute',
                  top: 6,
                  left: 6,
                  backgroundColor: BRUSHES.videoLabelTagBg,
                  borderRadius: 4,
                  padding: '3px 6px',
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  zIndex: 2,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill={BRUSHES.videoPlayIcon}
                  style={{ marginRight: 4, flexShrink: 0, display: 'block' }}
                >
                  <path d={MATERIAL_ICONS.videoOutline} />
                </svg>
                <span
                  style={{
                    color: BRUSHES.videoPlayLabel,
                    fontSize: 11,
                    fontWeight: 600,
                    lineHeight: '14px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {durationStr}
                </span>
              </div>
            )}

            {/* 4. ОВЕРЛЕЙ И КНОПКА PLAY / DOWNLOAD ДЛЯ ВИДЕО ТЯЖЕЛЕЕ 100 МБ */}
            {showHeavyVideoOverlay && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: cellRadius,
                  backgroundColor: BRUSHES.videoOverlayBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              >
                {/* Верхняя плашка: "Video 01:24 • ⬇ 125 MB" */}
                <div
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: 6,
                    backgroundColor: BRUSHES.videoLabelTagBg,
                    borderRadius: 4,
                    padding: '3px 6px',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill={BRUSHES.videoPlayIcon}
                    style={{ marginRight: 4, flexShrink: 0, display: 'block' }}
                  >
                    <path d={MATERIAL_ICONS.videoOutline} />
                  </svg>

                  <span
                    style={{
                      color: BRUSHES.videoPlayLabel,
                      fontSize: 11,
                      fontWeight: 600,
                      lineHeight: '14px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {durationStr}
                  </span>

                  {/* Вес файла и стрелочка */}
                  <div style={{ display: 'flex', alignItems: 'center', marginLeft: 6 }}>
                    <span
                      style={{
                        color: BRUSHES.videoPlayLabel,
                        fontSize: 11,
                        opacity: 0.6,
                        marginRight: 5,
                        lineHeight: '14px',
                      }}
                    >
                      •
                    </span>

                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill={BRUSHES.videoPlayIcon}
                      style={{ marginRight: 2, flexShrink: 0, display: 'block' }}
                    >
                      <path d={MATERIAL_ICONS.arrowDown} />
                    </svg>

                    <span
                      style={{
                        color: BRUSHES.videoPlayLabel,
                        fontSize: 10.5,
                        fontWeight: 600,
                        lineHeight: '14px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.fileSizeStr}
                    </span>
                  </div>
                </div>

                {/* Центральная кнопка: Play (если скачано) / Скачать (если не скачано) */}
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: BRUSHES.videoLabelTagBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  {!isDownloaded ? (
                    <svg
                      width="26"
                      height="26"
                      viewBox="0 0 24 24"
                      fill={BRUSHES.videoPlayIcon}
                      style={{ display: 'block' }}
                    >
                      <path d={MATERIAL_ICONS.arrowDown} />
                    </svg>
                  ) : (
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill={BRUSHES.videoPlayIcon}
                      style={{ marginLeft: 2, display: 'block' }}
                    >
                      <path d={MATERIAL_ICONS.play} />
                    </svg>
                  )}
                </div>
              </div>
            )}

            {/* 5. ИКОНКА GIF В УГЛУ (Только для реальных GIF / беззвучных видео) */}
            {isSilent && (
              <div
                style={{
                  position: 'absolute',
                  top: 6,
                  left: 6,
                  backgroundColor: BRUSHES.gifTagBg,
                  borderRadius: 4,
                  padding: '2px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  zIndex: 2,
                }}
              >
                <span
                  style={{
                    color: '#FFFFFF',
                    fontSize: 10.5,
                    fontWeight: 'bold',
                    lineHeight: '12px',
                  }}
                >
                  GIF
                </span>
              </div>
            )}

            {/* 6. ОВЕРЛЕЙ «+X ФОТО» ДЛЯ АЛЬБОМОВ */}
            {isLastWithOverlay && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: cellRadius,
                  backgroundColor: BRUSHES.moreMediaOverlayBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  zIndex: 3,
                }}
              >
                <span
                  style={{
                    color: '#FFFFFF',
                    fontSize: 24,
                    fontWeight: 'bold',
                  }}
                >
                  +{extraCount}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const CachedImageItem: React.FC<{
  imageUrl: string;
  altText?: string;
  cornerRadius: string;
  onDimensionsLoaded?: (naturalWidth: number, naturalHeight: number) => void;
}> = ({ imageUrl, altText, cornerRadius, onDimensionsLoaded }) => {
  const initialUrl = imageUrl.startsWith('blob:')
    ? imageUrl
    : UrlHelper.normalize(imageUrl, BASE_SERVER_URL);

  const [resolvedImage, setResolvedImage] = useState(() => ({
    source: initialUrl, src: mediaCacheService.getKnownMediaUrl(initialUrl),
  }));
  const src = resolvedImage.source === initialUrl ? resolvedImage.src : mediaCacheService.getKnownMediaUrl(initialUrl);

  useEffect(() => {
    let isCancelled = false;
    if (initialUrl && !initialUrl.startsWith('blob:') && !initialUrl.startsWith('data:')) {
      mediaCacheService.getCachedMediaUrl(initialUrl).then(async cachedUrl => {
        if (isCancelled || !cachedUrl || cachedUrl === mediaCacheService.getKnownMediaUrl(initialUrl) && cachedUrl === src) return;
        // Keep the currently decoded image visible until its cached replacement is ready.
        const image = new Image();
        image.src = cachedUrl;
        await image.decode();
        if (!isCancelled) setResolvedImage({source: initialUrl, src: cachedUrl});
      }).catch(() => {
        // The existing server image remains visible if the cached replacement fails.
      });
    }
    return () => { isCancelled = true; };
  }, [initialUrl]);

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const nw = e.currentTarget.naturalWidth;
      const nh = e.currentTarget.naturalHeight;
      if (nw > 0 && nh > 0) {
        onDimensionsLoaded?.(nw, nh);
      }
    },
    [onDimensionsLoaded]
  );

  return (
    <img
      src={src}
      alt={altText || ''}
      loading="lazy"
      onLoad={handleLoad}
      onError={() => {
        if (src !== initialUrl && !initialUrl.startsWith('blob:')) {
          setResolvedImage({source: initialUrl, src: initialUrl});
        }
      }}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
        borderRadius: cornerRadius,
      }}
    />
  );
};

export default MediaAlbumGrid;