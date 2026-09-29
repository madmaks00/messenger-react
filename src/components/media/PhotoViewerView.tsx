import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IAttachment } from '../../types/models';

interface PhotoViewerViewProps {
  mediaList: IAttachment[];
  startIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = {
  backdrop: 'rgba(0, 0, 0, 0.9)',           // #E6000000 в WPF ARGB
  toolbarBg: 'rgba(30, 34, 43, 0.9)',        // #E61E222B в WPF ARGB
  toolbarBorder: '#313746',
  buttonBg: 'rgba(30, 34, 43, 0.8)',         // #CC1E222B в WPF ARGB
  buttonBorder: '#3E4556',
  accent: '#1E9BEB',                         // AppAccentBrush
  counterBg: 'rgba(22, 26, 35, 0.5)',        // #80161A23 в WPF ARGB
  counterText: '#DCDDDE',
  arrowDefault: 'rgba(255, 255, 255, 0.45)', // #73FFFFFF в WPF ARGB
  arrowHover: '#FFFFFF',
};

const ICONS = {
  close: 'M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z',
  chevronLeft: 'M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z',
  chevronRight: 'M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z',
  fitToScreen: 'M3,4V9H5V5H9V3H4A1,1 0 0,0 3,4M5,19V15H3V20A1,1 0 0,0 4,21H9V19H5M19,3H14V5H18V9H20V4A1,1 0 0,0 19,3M20,20V15H18V19H14V21H19A1,1 0 0,0 20,20Z',
  rotateRight: 'M13.5,2C8.8,2 5,5.8 5,10.5H2L5.8,14.3L9.6,10.5H6.5C6.5,6.6 9.6,3.5 13.5,3.5C17.4,3.5 20.5,6.6 20.5,10.5C20.5,14.4 17.4,17.5 13.5,17.5C12.1,17.5 10.7,17.1 9.6,16.3L8.1,17.8C9.6,19 11.5,19.7 13.5,19.7C18.6,19.7 22.8,15.5 22.8,10.4C22.8,5.3 18.6,2 13.5,2Z',
  download: 'M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z',
};

const SvgIcon: React.FC<{ path: string; size?: number; color?: string }> = ({
  path,
  size = 18,
  color = '#FFFFFF',
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill={color}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
  >
    <path d={path} />
  </svg>
);

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

  // 🟢 Адаптивный расчет размера под весь экран (Fit to Screen)
  const applyDiscordDimensions = useCallback((origW: number, origH: number, rot: number) => {
    if (origW <= 0 || origH <= 0) return;

    const containerW = window.innerWidth || 1200;
    const containerH = window.innerHeight || 800;

    // Оставляем по 70px безопасных отступов от краев экрана
    const maxAllowedW = Math.max(300, containerW - 140);
    const maxAllowedH = Math.max(300, containerH - 140);

    const isRotatedSideways = (rot % 180) !== 0;
    const effectiveOrigW = isRotatedSideways ? origH : origW;
    const effectiveOrigH = isRotatedSideways ? origW : origH;

    // Масштабируем так, чтобы фото заполнило максимум доступного места, не вылезая за границы
    const scale = Math.min(maxAllowedW / effectiveOrigW, maxAllowedH / effectiveOrigH);

    setDisplaySize({
      width: Math.round(effectiveOrigW * scale),
      height: Math.round(effectiveOrigH * scale),
    });
  }, []);

  // Первичная инициализация и чтение физических пикселей
  useEffect(() => {
    if (!currentAtt) return;

    // Если размеры уже закэшированы — открываем сразу в большом формате без задержки
    if (currentAtt.width && currentAtt.height && currentAtt.width > 0 && currentAtt.height > 0) {
      setOrigDimensions({ width: currentAtt.width, height: currentAtt.height });
      applyDiscordDimensions(currentAtt.width, currentAtt.height, rotation);
    }

    if (!currentAtt.url) return;
    const img = new Image();
    img.src = currentAtt.url;
    img.onload = () => {
      setOrigDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      applyDiscordDimensions(img.naturalWidth, img.naturalHeight, rotation);
    };
  }, [currentAtt, rotation, applyDiscordDimensions]);

  // Реакция на изменение размера окна браузера (1 в 1 с Window_SizeChanged в C#)
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      if (zoom <= 1.0 && origDimensions.width > 0) {
        applyDiscordDimensions(origDimensions.width, origDimensions.height, rotation);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, zoom, origDimensions, rotation, applyDiscordDimensions]);

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

  // Поворот на 90° (BtnRotate_Click в C#)
  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    setOrigDimensions({ width: origDimensions.height, height: origDimensions.width });
    resetTransform();
  };

  // Колесико мыши: зум от 1.0 до 12.0 (Image_MouseWheel в C#)
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

  // Клик по фото: 1-Click Toggle Zoom
  const handleMouseUp = () => {
    if (!isMouseDownOnImage.current) return;
    isMouseDownOnImage.current = false;
    isDragging.current = false;

    if (!hasDragged.current) {
      if (zoom <= 1.0) {
        setZoom(2.5);
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
        backgroundColor: COLORS.backdrop,
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

      {/* 2. БОКОВЫЕ СТРЕЛКИ НАВИГАЦИИ (CleanNavArrowButtonStyle) */}
      {currentIndex > 0 && (
        <NavArrowButton
          direction="left"
          onClick={(e) => { e.stopPropagation(); handlePrev(); }}
        />
      )}

      {currentIndex < mediaList.length - 1 && (
        <NavArrowButton
          direction="right"
          onClick={(e) => { e.stopPropagation(); handleNext(); }}
        />
      )}

      {/* 3. СЧЕТЧИК СВЕРХУ СЛЕВА (TxtCounter) */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 24,
          backgroundColor: COLORS.counterBg,
          borderRadius: 8,
          padding: '6px 12px',
          color: COLORS.counterText,
          fontSize: 13.5,
          fontWeight: 600,
          pointerEvents: 'none',
        }}
      >
        {currentIndex + 1} / {mediaList.length}
      </div>

      {/* 4. КНОПКА ЗАКРЫТЬ (КРЕСТИК) СВЕРХУ СПРАВА */}
      <div style={{ position: 'absolute', top: 20, right: 24 }}>
        <ToolbarButton
          icon={ICONS.close}
          title="Close (Esc)"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
        />
      </div>

      {/* 5. ПЛАВАЮЩИЙ ТУЛБАР ВНИЗУ */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: COLORS.toolbarBg,
          borderRadius: 20,
          padding: '5px 10px',
          border: `1px solid ${COLORS.toolbarBorder}`,
          boxShadow: '0 8px 18px rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* Сброс зума (FitToScreenOutline) */}
        <ToolbarButton
          icon={ICONS.fitToScreen}
          title="Fit to Screen (Reset)"
          onClick={resetTransform}
        />

        {/* Поворот 90° (RotateRight) */}
        <ToolbarButton
          icon={ICONS.rotateRight}
          title="Rotate 90°"
          onClick={handleRotate}
        />

        {/* Скачать оригинал (Download) */}
        <ToolbarButton
          icon={ICONS.download}
          title="Download Original Image"
          onClick={handleDownload}
        />
      </div>
    </div>
  );
};

const ToolbarButton: React.FC<{
  icon: string;
  title: string;
  onClick: (e: React.MouseEvent) => void;
}> = ({ icon, title, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      title={title}
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: isHovered ? COLORS.accent : COLORS.buttonBg,
        border: `1px solid ${isHovered ? COLORS.accent : COLORS.buttonBorder}`,
        color: '#FFFFFF',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        outline: 'none',
        transform: isPressed ? 'scale(0.92)' : 'scale(1)',
        transition: 'background-color 0.15s ease, border-color 0.15s ease, transform 0.1s ease',
      }}
    >
      <SvgIcon path={icon} size={18} color="#FFFFFF" />
    </button>
  );
};

const NavArrowButton: React.FC<{
  direction: 'left' | 'right';
  onClick: (e: React.MouseEvent) => void;
}> = ({ direction, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={{
        position: 'absolute',
        top: '50%',
        transform: `translateY(-50%) ${isPressed ? 'scale(0.95)' : isHovered ? 'scale(1.15)' : 'scale(1)'}`,
        left: direction === 'left' ? 16 : undefined,
        right: direction === 'right' ? 16 : undefined,
        width: 56,
        height: 90,
        backgroundColor: 'transparent',
        border: 'none',
        outline: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transition: 'transform 0.15s ease',
      }}
    >
      <SvgIcon
        path={direction === 'left' ? ICONS.chevronLeft : ICONS.chevronRight}
        size={46}
        color={isHovered ? COLORS.arrowHover : COLORS.arrowDefault}
      />
    </button>
  );
};