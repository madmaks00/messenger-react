import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IAttachment } from '../../types/models';

interface PhotoViewerViewProps {
  mediaList: IAttachment[];
  startIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export const PhotoViewerView: React.FC<PhotoViewerViewProps> = ({
  mediaList,
  startIndex,
  isOpen,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [zoom, setZoom] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  const [origDimensions, setOrigDimensions] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  // Рефы для отслеживания перетаскивания мыши
  const isMouseDownOnImage = useRef(false);
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const dragStartMouse = useRef({ x: 0, y: 0 });
  const dragStartTranslate = useRef({ x: 0, y: 0 });

  const resetTransform = useCallback(() => {
    setZoom(1.0);
    setTranslate({ x: 0, y: 0 });
    isMouseDownOnImage.current = false;
    isDragging.current = false;
    hasDragged.current = false;
  }, []);

  useEffect(() => {
    setCurrentIndex(Math.max(0, Math.min(startIndex, mediaList.length - 1)));
    resetTransform();
    setRotation(0);
  }, [startIndex, mediaList, resetTransform]);

  const currentAtt = mediaList[currentIndex];

  // Математика ApplyDiscordDimensions из C#
  const applyDiscordDimensions = useCallback((origW: number, origH: number, rot: number) => {
    if (origW <= 0 || origH <= 0) return;

    const containerW = window.innerWidth || 1200;
    const containerH = window.innerHeight || 800;

    const maxAllowedW = Math.max(200, containerW - 140);
    const maxAllowedH = Math.max(200, containerH - 140);

    const isRotatedSideways = (rot % 180) !== 0;
    const effectiveW = isRotatedSideways ? origH : origW;
    const effectiveH = isRotatedSideways ? origW : origH;

    let scale = Math.min(maxAllowedW / effectiveW, maxAllowedH / effectiveH);
    if (scale > 1.0) scale = 1.0;

    setDisplaySize({
      width: Math.round(effectiveW * scale),
      height: Math.round(effectiveH * scale),
    });
  }, []);

  // Загрузка реальных размеров картинки
  useEffect(() => {
    if (!currentAtt?.url) return;
    const img = new Image();
    img.src = currentAtt.url;
    img.onload = () => {
      setOrigDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      applyDiscordDimensions(img.naturalWidth, img.naturalHeight, rotation);
    };
  }, [currentAtt, rotation, applyDiscordDimensions]);

  // Клавиатурные шорткаты
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, mediaList.length]);

  if (!isOpen || !currentAtt) return null;

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((p) => p - 1);
      resetTransform();
    }
  };

  const handleNext = () => {
    if (currentIndex < mediaList.length - 1) {
      setCurrentIndex((p) => p + 1);
      resetTransform();
    }
  };

  // Поворот на 90° (BtnRotate_Click)
  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    setOrigDimensions({ width: origDimensions.height, height: origDimensions.width });
    resetTransform();
  };

  // Колесико мыши: Зум от 1.0 до 12.0
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomStep = e.deltaY < 0 ? 0.25 : -0.25;
    const newZoom = Math.max(1.0, Math.min(12.0, zoom + zoomStep));

    if (newZoom <= 1.0) {
      resetTransform();
    } else {
      setZoom(newZoom);
    }
  };

  // Мышь: начало зажатия
  const handleMouseDown = (e: React.MouseEvent) => {
    isMouseDownOnImage.current = true;
    hasDragged.current = false;
    dragStartMouse.current = { x: e.clientX, y: e.clientY };
    dragStartTranslate.current = { ...translate };

    if (zoom > 1.0) {
      isDragging.current = true;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current && zoom > 1.0 && isMouseDownOnImage.current) {
      const dx = e.clientX - dragStartMouse.current.x;
      const dy = e.clientY - dragStartMouse.current.y;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasDragged.current = true;
      }

      setTranslate({
        x: dragStartTranslate.current.x + dx,
        y: dragStartTranslate.current.y + dy,
      });
    }
  };

  // Клик без протяжки: переключение 1-Click зума
  const handleMouseUp = () => {
    if (!isMouseDownOnImage.current) return;
    isMouseDownOnImage.current = false;
    isDragging.current = false;

    if (!hasDragged.current) {
      if (zoom <= 1.0) {
        const targetZoom = origDimensions.width > 0 && displaySize.width > 0
          ? Math.max(2.0, origDimensions.width / displaySize.width)
          : 2.5;
        setZoom(targetZoom);
        setTranslate({ x: 0, y: 0 });
      } else {
        resetTransform();
      }
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = currentAtt.url;
    link.download = currentAtt.fileName || `Photo_${Date.now()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      onClick={onClose}
      onWheel={handleWheel}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#E6000000',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      {/* 1. ЗОНА ОТОБРАЖЕНИЯ ФОТО */}
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{
          width: `${displaySize.width}px`,
          height: `${displaySize.height}px`,
          cursor: zoom > 1.0 ? 'move' : 'pointer',
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${zoom}) rotate(${rotation}deg)`,
          transition: isDragging.current ? 'none' : 'transform 0.15s ease-out',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={currentAtt.url}
          alt={currentAtt.fileName}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
        />
      </div>

      {/* 2. БОКОВЫЕ СТРЕЛКИ (СТИЛЬ CleanNavArrowButtonStyle ИЗ XAML) */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); handlePrev(); }}
          style={{ ...cleanNavArrowBtnStyle, left: 12 }}
        >
          ‹
        </button>
      )}

      {currentIndex < mediaList.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); handleNext(); }}
          style={{ ...cleanNavArrowBtnStyle, right: 12 }}
        >
          ›
        </button>
      )}

      {/* 3. СЧЕТЧИК СВЕРХУ СЛЕВА (TxtCounter) */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 20,
          backgroundColor: '#80161A23',
          borderRadius: 8,
          padding: '6px 12px',
          color: '#DCDDDE',
          fontSize: 13.5,
          fontWeight: 600,
        }}
      >
        {currentIndex + 1} / {mediaList.length}
      </div>

      {/* 4. ПЛАВАЮЩИЙ ТУЛБАР ВНИЗУ (DiscordActionButtonStyle) */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#E61E222B',
          borderRadius: 20,
          padding: '5px 10px',
          border: '1px solid #313746',
          boxShadow: '0 8px 18px rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* Сброс зума (Fit) */}
        <button onClick={resetTransform} style={discordActionButtonStyle} title="Fit to Screen (Reset)">
          ⛶
        </button>

        {/* Поворот 90° */}
        <button onClick={handleRotate} style={discordActionButtonStyle} title="Rotate 90°">
          ↻
        </button>

        {/* Скачать оригинал */}
        <button onClick={handleDownload} style={discordActionButtonStyle} title="Download Original Image">
          ⬇
        </button>
      </div>
    </div>
  );
};

const cleanNavArrowBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'transparent',
  border: 'none',
  width: 56,
  height: 90,
  color: 'rgba(255, 255, 255, 0.45)',
  fontSize: 46,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'color 0.2s, transform 0.2s',
};

const discordActionButtonStyle: React.CSSProperties = {
  backgroundColor: '#CC1E222B',
  border: '1px solid #3E4556',
  borderRadius: 19,
  width: 38,
  height: 38,
  color: '#FFFFFF',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
};