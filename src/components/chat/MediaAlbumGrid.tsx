import React, { useState, useEffect, useCallback } from 'react';
import { IAttachment, AttachmentHelper } from '../../types/models';
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

// Константы точных кистей WPF темы из DefaultDark.xaml
const BRUSHES = {
  videoOverlayBg: 'rgba(0, 0, 0, 0.125)', // #20000000
  videoLabelTagBg: 'rgba(0, 0, 0, 0.6)',   // #99000000
  videoPlayIcon: '#FFFFFF',                // #FFFFFF
  videoPlayLabel: '#FFFFFF',               // #FFFFFF
  gifTagBg: 'rgba(0, 0, 0, 0.5)',          // #80000000
  moreMediaOverlayBg: 'rgba(0, 0, 0, 0.7)',// #B3000000
};

// Векторы стандартных PackIcon Kind Material Design
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

  // Точный маппинг behaviors:GridCellHelper.CornerRadius и Triggers AlternationIndex из XAML:
  // WPF CornerRadius: TopLeft, TopRight, BottomRight, BottomLeft
  // CSS borderRadius: TopLeft TopRight BottomRight BottomLeft
  const getCornerRadius = (index: number): string => {
    if (totalCount === 1) {
      // DataTrigger Value="1" -> 16,16,16,16
      return '16px 16px 16px 16px';
    }
    if (totalCount === 2) {
      // MultiDataTrigger Value="2", AlternationIndex="0" -> 16,2,2,16
      // MultiDataTrigger Value="2", AlternationIndex="1" -> 2,16,16,2
      return index === 0 ? '16px 2px 2px 16px' : '2px 16px 16px 2px';
    }
    if (totalCount === 3) {
      // AlternationIndex="0" -> 16,2,2,2
      // AlternationIndex="1" -> 2,16,2,2
      // MultiDataTrigger Value="3", AlternationIndex="2" -> 2,2,16,16
      if (index === 0) return '16px 2px 2px 2px';
      if (index === 1) return '2px 16px 2px 2px';
      return '2px 2px 16px 16px';
    }
    // 4 фото: ячейки сетки 2x2
    // AlternationIndex="0" -> 16,2,2,2
    // AlternationIndex="1" -> 2,16,2,2
    // AlternationIndex="2" -> 2,2,2,16
    // AlternationIndex="3" -> 2,2,16,2
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

        // Строгий расчет статусов из моделей C# (AttachmentHelper)
        const isSilent = Boolean(forceSilent || AttachmentHelper.isSilentVideo(item));
        const isNormal = AttachmentHelper.isNormalVideo(item);
        const isOverLimit = AttachmentHelper.isOverAutoDownloadLimit(item);
        const isDownloaded = Boolean(item.isDownloaded);

        const durationFormatted = AttachmentHelper.formatDuration(item.durationSeconds);
        const durationStr = durationFormatted && durationFormatted.length > 0 ? durationFormatted : 'Video';
        const displayImageUrl = AttachmentHelper.getDisplayImageUrl(item) || '';

        return (
          <div
            key={item.id || index}
            onClick={() => onMediaClick?.(item)}
            style={{
              ...getGridItemStyle(index),
              margin: '1px', // Соответствует Margin="1" в XAML DataTemplate
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer',
              backgroundColor: 'transparent',
            }}
          >
            {/* 1. СТАТИЧЕСКАЯ ПОДЛОЖКА (ФОТО ИЛИ ВИДЕО) ЧЕРЕЗ ImageBrush */}
            {/* Visibility="{Binding IsSilentVideo, Converter={StaticResource InverseBooleanToVisibilityConverter}}" */}
            {!isSilent && (
              <CachedImageItem
                imageUrl={displayImageUrl}
                altText={item.fileName}
                cornerRadius={cellRadius}
                onDimensionsLoaded={(nw, nh) => onImageDimensionsLoaded?.(item, nw, nh)}
              />
            )}

            {/* 2. АВТОПРОИГРЫВАТЕЛЬ ДЛЯ GIF/ВИДЕО БЕЗ ЗВУКА */}
            {/* Visibility="{Binding IsSilentVideo, Converter={StaticResource BooleanToVisibilityConverter}}" */}
            {isSilent && (
              <TelegramInlinePlayer
                sourceUrl={item.url}
                thumbnailUrl={displayImageUrl}
                cornerRadius={cellRadius}
                onDimensionsLoaded={(nw, nh) => onImageDimensionsLoaded?.(item, nw, nh)}
              />
            )}

            {/* 3. ОВЕРЛЕЙ И КНОПКА PLAY / DOWNLOAD ДЛЯ ОБЫЧНОГО ВИДЕО СО ЗВУКОМ */}
            {/* Visibility="{Binding IsNormalVideo, Converter={StaticResource BooleanToVisibilityConverter}}" */}
            {isNormal && (
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
                }}
              >
                {/* 🟢 ВЕРХНЯЯ ПЛАШКА: "Video 01:24" И ЕСЛИ > 50 MB ДОБАВЛЯЕТСЯ "⬇ 78.4 MB" */}
                <div
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: 6,
                    backgroundColor: BRUSHES.videoLabelTagBg,
                    borderRadius: 4,
                    padding: '3px 6px', // Padding="6,3" (left/right 6, top/bottom 3)
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                >
                  {/* Иконка видеокамеры: Kind="VideoOutline" Width="14" Height="14" */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill={BRUSHES.videoPlayIcon}
                    style={{ marginRight: 4, flexShrink: 0, display: 'block' }}
                  >
                    <path d={MATERIAL_ICONS.videoOutline} />
                  </svg>

                  {/* Надпись: Video или Длительность (например, 02:15) */}
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

                  {/* Дополнительная плашка с весом файла и стрелкой, если видео > 50 МБ */}
                  {isOverLimit && (
                    <div style={{ display: 'flex', alignItems: 'center', marginLeft: 6 }}>
                      {/* Разделитель "•" */}
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

                      {/* materialDesign:PackIcon Kind="ArrowDown" Width="12" Height="12" */}
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill={BRUSHES.videoPlayIcon}
                        style={{ marginRight: 2, flexShrink: 0, display: 'block' }}
                      >
                        <path d={MATERIAL_ICONS.arrowDown} />
                      </svg>

                      {/* Текст размера файла */}
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
                  )}
                </div>

                {/* 🟢 ЦЕНТРАЛЬНАЯ КНОПКА: Play (если <= 50 МБ или уже скачано) / Стрелка Скачать (если > 50 МБ и не скачано) */}
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
                  {isOverLimit && !isDownloaded ? (
                    /* 2. Иконка СТРЕЛКА СКАЧАТЬ (если видео > 50 МБ и еще не скачано): Width="26" Height="26" */
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
                    /* 1. Иконка PLAY (для видео <= 50 МБ или уже скачанных файлов): Width="32" Height="32" Margin="2,0,0,0" */
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

            {/* 4. ИКОНКА GIF В УГЛУ */}
            {/* Visibility="{Binding IsSilentVideo, Converter={StaticResource BooleanToVisibilityConverter}}" */}
            {isSilent && (
              <div
                style={{
                  position: 'absolute',
                  top: 6,
                  left: 6,
                  backgroundColor: BRUSHES.gifTagBg,
                  borderRadius: 4,
                  padding: '2px 4px', // Padding="4,2" (left/right 4, top/bottom 2)
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  userSelect: 'none',
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

            {/* 5. ОВЕРЛЕЙ «+X ФОТО» ДЛЯ АЛЬБОМОВ */}
            {/* Visibility="{Binding ShowMoreOverlay, Converter={StaticResource BooleanToVisibilityConverter}}" */}
            {isLastWithOverlay && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: cellRadius,
                  backgroundColor: BRUSHES.moreMediaOverlayBg, // Background="#B3000000"
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  userSelect: 'none',
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

// Вспомогательный компонент статического изображения с декодированием и локальным кэшем
const CachedImageItem: React.FC<{
  imageUrl: string;
  altText?: string;
  cornerRadius: string;
  onDimensionsLoaded?: (naturalWidth: number, naturalHeight: number) => void;
}> = ({ imageUrl, altText, cornerRadius, onDimensionsLoaded }) => {
  const initialUrl = imageUrl.startsWith('blob:')
    ? imageUrl
    : UrlHelper.normalize(imageUrl, BASE_SERVER_URL);

  const [src, setSrc] = useState<string>(initialUrl);

  useEffect(() => {
    let isCancelled = false;
    if (initialUrl && !initialUrl.startsWith('blob:')) {
      mediaCacheService
        .getCachedMediaUrl(initialUrl)
        .then((cachedUrl) => {
          if (!isCancelled && cachedUrl) {
            setSrc(cachedUrl);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setSrc(initialUrl);
          }
        });
    } else {
      setSrc(initialUrl);
    }

    return () => {
      isCancelled = true;
    };
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
          setSrc(initialUrl);
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