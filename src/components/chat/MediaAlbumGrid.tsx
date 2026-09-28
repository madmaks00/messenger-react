import React, { useState, useEffect } from 'react';
import { IAttachment } from '../../types/models';
import { AttachmentType } from '../../types/enums';
import { mediaCacheService } from '../../services/mediaCache.service';
import { BASE_SERVER_URL } from '../../services/apiClient';
import { UrlHelper } from '../../utils/helpers';

interface MediaAlbumGridProps {
  media: IAttachment[];
  mediaWidth: number;
  mediaHeight: number;
  onMediaClick?: (attachment: IAttachment) => void;
  onImageDimensionsLoaded?: (attachment: IAttachment, naturalWidth: number, naturalHeight: number) => void;
}

export const MediaAlbumGrid: React.FC<MediaAlbumGridProps> = ({
  media,
  mediaWidth,
  mediaHeight,
  onMediaClick,
  onImageDimensionsLoaded,
}) => {
  if (!media || media.length === 0) return null;

  const totalCount = media.length;
  const displayItems = media.slice(0, 4);
  const extraCount = totalCount > 4 ? totalCount - 3 : 0;

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
    switch (index) {
      case 0: return '16px 2px 2px 2px';
      case 1: return '2px 16px 2px 2px';
      case 2: return '2px 2px 2px 16px';
      case 3: return '2px 2px 16px 2px';
      default: return '4px';
    }
  };

  const getGridItemStyle = (index: number): React.CSSProperties => {
    const borderRadius = getCornerRadius(index);

    if (totalCount === 1) {
      return {
        gridColumn: '1',
        gridRow: '1',
        width: '100%',
        height: '100%',
        borderRadius,
      };
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
        gap: totalCount === 1 ? '0px' : '2px',
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
            {isVideo && isSilent ? (
              <CachedVideoItem item={item} onImageDimensionsLoaded={onImageDimensionsLoaded} />
            ) : (
              <CachedImageItem item={item} onImageDimensionsLoaded={onImageDimensionsLoaded} />
            )}

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

const CachedImageItem: React.FC<{
  item: IAttachment;
  onImageDimensionsLoaded?: (attachment: IAttachment, naturalWidth: number, naturalHeight: number) => void;
}> = ({ item, onImageDimensionsLoaded }) => {
  const rawUrl = item.thumbnailUrl || item.url || '';
  const initialUrl = rawUrl.startsWith('blob:') ? rawUrl : UrlHelper.normalize(rawUrl, BASE_SERVER_URL);
  const [src, setSrc] = useState<string>(initialUrl);

  useEffect(() => {
    let active = true;
    if (initialUrl && !initialUrl.startsWith('blob:')) {
      mediaCacheService.getCachedMediaUrl(initialUrl).then((cachedUrl) => {
        if (active && cachedUrl) setSrc(cachedUrl);
      });
    } else {
      setSrc(initialUrl);
    }
    return () => {
      active = false;
    };
  }, [initialUrl]);

  return (
    <img
      src={src}
      alt={item.fileName}
      loading="lazy"
      onLoad={(e) => {
        const nw = e.currentTarget.naturalWidth;
        const nh = e.currentTarget.naturalHeight;
        if (nw > 0 && nh > 0) {
          onImageDimensionsLoaded?.(item, nw, nh);
        }
      }}
      onError={() => {
        if (src !== initialUrl && !initialUrl.startsWith('blob:')) {
          setSrc(initialUrl);
        }
      }}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );
};

const CachedVideoItem: React.FC<{
  item: IAttachment;
  onImageDimensionsLoaded?: (attachment: IAttachment, naturalWidth: number, naturalHeight: number) => void;
}> = ({ item, onImageDimensionsLoaded }) => {
  const rawUrl = item.url || '';
  const initialUrl = rawUrl.startsWith('blob:') ? rawUrl : UrlHelper.normalize(rawUrl, BASE_SERVER_URL);
  const [src, setSrc] = useState<string>(initialUrl);

  useEffect(() => {
    let active = true;
    if (initialUrl && !initialUrl.startsWith('blob:')) {
      mediaCacheService.getCachedMediaUrl(initialUrl).then((cachedUrl) => {
        if (active && cachedUrl) setSrc(cachedUrl);
      });
    } else {
      setSrc(initialUrl);
    }
    return () => {
      active = false;
    };
  }, [initialUrl]);

  return (
    <video
      src={src}
      poster={item.thumbnailUrl ? UrlHelper.normalize(item.thumbnailUrl, BASE_SERVER_URL) : undefined}
      autoPlay
      loop
      muted
      playsInline
      onLoadedMetadata={(e) => {
        const vw = e.currentTarget.videoWidth;
        const vh = e.currentTarget.videoHeight;
        if (vw > 0 && vh > 0) {
          onImageDimensionsLoaded?.(item, vw, vh);
        }
      }}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
};