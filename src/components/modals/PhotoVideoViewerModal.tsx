import React, { useEffect, useState } from 'react';
import { IAttachment } from '../../types/models';
import { AttachmentType } from '../../types/enums';

interface PhotoVideoViewerModalProps {
  mediaList: IAttachment[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export const PhotoVideoViewerModal: React.FC<PhotoVideoViewerModalProps> = ({
  mediaList,
  initialIndex,
  isOpen,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, mediaList.length]);

  if (!isOpen || mediaList.length === 0) return null;

  const currentMedia = mediaList[currentIndex] || mediaList[0];
  const isVideo = currentMedia.type === AttachmentType.Video;

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : mediaList.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < mediaList.length - 1 ? prev + 1 : 0));
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentMedia.url;
    link.download = currentMedia.fileName || 'media';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={backdropStyle} onClick={onClose}>
      {/* ВЕРХНЯЯ ПАНЕЛЬ ДЕЙСТВИЙ */}
      <div style={topBarStyle} onClick={(e) => e.stopPropagation()}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{currentMedia.fileName}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {mediaList.length > 1 ? `${currentIndex + 1} of ${mediaList.length} • ` : ''}
            {currentMedia.fileSizeStr}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={handleDownload} style={headerBtnStyle} title="Download">
            ⬇
          </button>
          <button onClick={onClose} style={headerBtnStyle} title="Close">
            ✕
          </button>
        </div>
      </div>

      {/* СТРЕЛКА НАЗАД */}
      {mediaList.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          style={{ ...navArrowBtnStyle, left: 24 }}
        >
          ‹
        </button>
      )}

      {/* МЕДИА-КОНТЕНТ */}
      <div style={mediaWrapperStyle} onClick={(e) => e.stopPropagation()}>
        {isVideo ? (
          <video
            key={currentMedia.url}
            src={currentMedia.url}
            controls
            autoPlay
            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 8 }}
          />
        ) : (
          <img
            key={currentMedia.url}
            src={currentMedia.url}
            alt={currentMedia.fileName}
            style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }}
          />
        )}
      </div>

      {/* СТРЕЛКА ВПЕРЕД */}
      {mediaList.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          style={{ ...navArrowBtnStyle, right: 24 }}
        >
          ›
        </button>
      )}
    </div>
  );
};

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.92)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backdropFilter: 'blur(8px)',
};

const topBarStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  padding: '16px 24px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: '#FFFFFF',
  background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
  zIndex: 10,
};

const headerBtnStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.12)',
  border: 'none',
  color: '#FFFFFF',
  width: 36,
  height: 36,
  borderRadius: 18,
  fontSize: 16,
  cursor: 'pointer',
};

const navArrowBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 48,
  height: 48,
  borderRadius: 24,
  background: 'rgba(255, 255, 255, 0.1)',
  border: 'none',
  color: '#FFFFFF',
  fontSize: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  zIndex: 10,
};

const mediaWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
};