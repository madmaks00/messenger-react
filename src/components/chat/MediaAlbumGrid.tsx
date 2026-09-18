import React from 'react';
import { IAttachment } from '../../types/models';
import { AttachmentType } from '../../types/enums';

interface MediaAlbumGridProps {
  media: IAttachment[];
  mediaWidth: number;
  mediaHeight: number;
  onMediaClick?: (attachment: IAttachment) => void;
}

export const MediaAlbumGrid: React.FC<MediaAlbumGridProps> = ({
  media,
  mediaWidth,
  mediaHeight,
  onMediaClick,
}) => {
  if (!media || media.length === 0) return null;

  const totalCount = media.length;
  const displayItems = media.slice(0, 4);
  const extraCount = totalCount > 4 ? totalCount - 3 : 0;

  // Определение стилей скруглений углов для ячеек сетки (GridCellHelper.CornerRadius в C#)
  const getCornerRadius = (index: number): string => {
    if (totalCount === 1) return '16px';
    if (totalCount === 2) {
      return index === 0 ? '16px 2px 2px 16px' : '2px 16px 16px 2px';
    }
    if (totalCount === 3) {
      if (index === 0) return '16px 2px 2px 2px';
      if (index === 1) return '2px 16px 2px 2px';
      return '2px 2px 16px 16px';
    }
    // 4 и более
    switch (index) {
      case 0: return '16px 2px 2px 2px';
      case 1: return '2px 16px 2px 2px';
      case 2: return '2px 2px 2px 16px';
      case 3: return '2px 2px 16px 2px';
      default: return '4px';
    }
  };

  // Определение расположения в CSS Grid
  const getGridItemStyle = (index: number): React.CSSProperties => {
    const borderRadius = getCornerRadius(index);

    if (totalCount === 1) {
      return { gridColumn: 'span 2', gridRow: 'span 2', borderRadius };
    }
    if (totalCount === 2) {
      return { gridRow: 'span 2', borderRadius };
    }
    if (totalCount === 3 && index === 2) {
      return { gridColumn: 'span 2', borderRadius };
    }
    return { borderRadius };
  };

  return (
    <div
      style={{
        width: `${mediaWidth}px`,
        height: `${mediaHeight}px`,
        display: 'grid',
        gridTemplateColumns: totalCount === 1 ? '1fr' : '1fr 1fr',
        gridTemplateRows: totalCount === 1 ? '1fr' : '1fr 1fr',
        gap: '2px',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {displayItems.map((item, index) => {
        const isLastWithOverlay = index === 3 && extraCount > 0;
        const isVideo = item.type === AttachmentType.Video;
        const isSilent = item.isSilentVideo || !item.hasAudio;
        const isOverLimit = (item.fileSizeBytes || 0) > 50 * 1024 * 1024;

        return (
          <div
            key={item.id || index}
            onClick={() => onMediaClick?.(item)}
            style={{
              ...getGridItemStyle(index),
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer',
              backgroundColor: '#0F172A',
            }}
          >
            {/* 1. Автопроигрыватель для GIF / Видео без звука */}
            {isVideo && isSilent ? (
              <video
                src={item.url}
                poster={item.thumbnailUrl || undefined}
                autoPlay
                loop
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              /* 2. Статическое изображение / Превью видео */
              <img
                src={item.thumbnailUrl || item.url}
                alt={item.fileName}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}

            {/* 3. Бейдж GIF */}
            {isVideo && isSilent && (
              <div
                style={{
                  position: 'absolute',
                  top: 6,
                  left: 6,
                  background: 'rgba(0, 0, 0, 0.55)',
                  color: '#FFFFFF',
                  fontSize: 10,
                  fontWeight: 'bold',
                  padding: '2px 5px',
                  borderRadius: 4,
                  backdropFilter: 'blur(4px)',
                }}
              >
                GIF
              </div>
            )}

            {/* 4. Оверлей видео со звуком: длительность, размер и кнопка Play/Скачать */}
            {isVideo && !isSilent && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: 6,
                    background: 'rgba(0, 0, 0, 0.65)',
                    color: '#FFF',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 6px',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>🎥 {item.durationSeconds ? `${Math.floor(item.durationSeconds / 60)}:${(item.durationSeconds % 60).toString().padStart(2, '0')}` : 'Video'}</span>
                  {isOverLimit && (
                    <>
                      <span style={{ opacity: 0.6 }}>•</span>
                      <span>⬇ {item.fileSizeStr}</span>
                    </>
                  )}
                </div>

                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    background: 'rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFF',
                    backdropFilter: 'blur(6px)',
                  }}
                >
                  {isOverLimit && !item.isDownloaded ? '⬇' : '▶'}
                </div>
              </div>
            )}

            {/* 5. Оверлей «+X фото» для 4-го элемента */}
            {isLastWithOverlay && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.65)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontSize: 24,
                  fontWeight: 'bold',
                  backdropFilter: 'blur(2px)',
                }}
              >
                +{extraCount}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};