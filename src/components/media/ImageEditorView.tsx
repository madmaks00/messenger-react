import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ImageEditorViewProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onDone: (croppedDataUrl: string) => void;
}

export const ImageEditorView: React.FC<ImageEditorViewProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onDone,
}) => {
  const [rotation, setRotation] = useState(0);

  // Координаты и размеры рамки кропа
  const [cropBox, setCropBox] = useState({ x: 100, y: 100, width: 250, height: 250 });
  const [imageBounds, setImageBounds] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const isDraggingBox = useRef(false);
  const isResizingCorner = useRef<string | null>(null);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, boxX: 0, boxY: 0, boxW: 0, boxH: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const initLayout = useCallback(() => {
    if (!imgRef.current || !containerRef.current) return;
    const img = imgRef.current;
    const container = containerRef.current;

    const contW = container.clientWidth;
    const contH = container.clientHeight;

    const isRot = rotation % 180 !== 0;
    const natW = isRot ? img.naturalHeight : img.naturalWidth;
    const natH = isRot ? img.naturalWidth : img.naturalHeight;

    const maxW = Math.max(100, contW - 120);
    const maxH = Math.max(100, contH - 140);

    const scale = Math.min(1.0, Math.min(maxW / natW, maxH / natH));
    const dispW = Math.round(natW * scale);
    const dispH = Math.round(natH * scale);

    const left = (contW - dispW) / 2;
    const top = (contH - dispH) / 2;

    setImageBounds({ x: left, y: top, width: dispW, height: dispH });

    // Начальный размер рамки кропа (55% от картинки по центру)
    const cw = Math.max(80, dispW * 0.55);
    const ch = Math.max(80, dispH * 0.55);
    setCropBox({
      x: left + (dispW - cw) / 2,
      y: top + (dispH - ch) / 2,
      width: cw,
      height: ch,
    });
  }, [rotation]);

  useEffect(() => {
    if (isOpen) {
      setRotation(0);
      initLayout();
    }
  }, [isOpen, imageSrc, initLayout]);

  if (!isOpen) return null;

  // Мышь: перемещение всей рамки кропа
  const handleBoxMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    isDraggingBox.current = true;
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      boxX: cropBox.x,
      boxY: cropBox.y,
      boxW: cropBox.width,
      boxH: cropBox.height,
    };
  };

  // Мышь: изменение размера за угловые скобки (TL, TR, BL, BR)
  const handleCornerMouseDown = (e: React.MouseEvent, corner: string) => {
    e.stopPropagation();
    isResizingCorner.current = corner;
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      boxX: cropBox.x,
      boxY: cropBox.y,
      boxW: cropBox.width,
      boxH: cropBox.height,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const dx = e.clientX - dragStart.current.mouseX;
    const dy = e.clientY - dragStart.current.mouseY;

    if (isDraggingBox.current) {
      const newX = Math.min(
        imageBounds.x + imageBounds.width - cropBox.width,
        Math.max(imageBounds.x, dragStart.current.boxX + dx)
      );
      const newY = Math.min(
        imageBounds.y + imageBounds.height - cropBox.height,
        Math.max(imageBounds.y, dragStart.current.boxY + dy)
      );
      setCropBox((prev) => ({ ...prev, x: newX, y: newY }));
    } else if (isResizingCorner.current) {
      const corner = isResizingCorner.current;
      let { boxX, boxY, boxW, boxH } = dragStart.current;

      if (corner === 'TL') {
        boxX = Math.min(boxX + boxW - 40, boxX + dx);
        boxY = Math.min(boxY + boxH - 40, boxY + dy);
        boxW = dragStart.current.boxW - dx;
        boxH = dragStart.current.boxH - dy;
      } else if (corner === 'TR') {
        boxY = Math.min(boxY + boxH - 40, boxY + dy);
        boxW = Math.max(40, dragStart.current.boxW + dx);
        boxH = dragStart.current.boxH - dy;
      } else if (corner === 'BL') {
        boxX = Math.min(boxX + boxW - 40, boxX + dx);
        boxW = dragStart.current.boxW - dx;
        boxH = Math.max(40, dragStart.current.boxH + dy);
      } else if (corner === 'BR') {
        boxW = Math.max(40, dragStart.current.boxW + dx);
        boxH = Math.max(40, dragStart.current.boxH + dy);
      }

      setCropBox({
        x: Math.max(imageBounds.x, boxX),
        y: Math.max(imageBounds.y, boxY),
        width: Math.min(imageBounds.width, Math.max(40, boxW)),
        height: Math.min(imageBounds.height, Math.max(40, boxH)),
      });
    }
  };

  const handleMouseUp = () => {
    isDraggingBox.current = false;
    isResizingCorner.current = null;
  };

  // Поворот на 90° (BtnRotate_Click)
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Сброс кропа на весь размер (BtnResetCrop_Click)
  const handleResetCrop = () => {
    setCropBox({
      x: imageBounds.x,
      y: imageBounds.y,
      width: imageBounds.width,
      height: imageBounds.height,
    });
  };

  // Квадрат 1:1 (BtnAspectRatio_Click)
  const handleAspectRatioSquare = () => {
    const minSide = Math.min(cropBox.width, cropBox.height);
    setCropBox((prev) => ({ ...prev, width: minSide, height: minSide }));
  };

  // Генерация итогового изображения (GetCroppedBitmap)
  const handleDone = () => {
    if (!imgRef.current) return;
    const img = imgRef.current;

    const isRot = rotation % 180 !== 0;
    const natW = isRot ? img.naturalHeight : img.naturalWidth;
    const natH = isRot ? img.naturalWidth : img.naturalHeight;

    const relX = (cropBox.x - imageBounds.x) / imageBounds.width;
    const relY = (cropBox.y - imageBounds.y) / imageBounds.height;
    const relW = cropBox.width / imageBounds.width;
    const relH = cropBox.height / imageBounds.height;

    const cropPixelX = Math.round(relX * natW);
    const cropPixelY = Math.round(relY * natH);
    const cropPixelW = Math.round(relW * natW);
    const cropPixelH = Math.round(relH * natH);

    const canvas = document.createElement('canvas');
    canvas.width = cropPixelW;
    canvas.height = cropPixelH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    const drawW = isRot ? canvas.height : canvas.width;
    const drawH = isRot ? canvas.width : canvas.height;

    ctx.drawImage(
      img,
      cropPixelX,
      cropPixelY,
      cropPixelW,
      cropPixelH,
      -drawW / 2,
      -drawH / 2,
      drawW,
      drawH
    );

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    onDone(dataUrl);
    onClose();
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#D90E1116',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      {/* 1. ХОЛСТ С ИЗОБРАЖЕНИЕМ И МАСКОЙ */}
      <div ref={containerRef} style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <img
          ref={imgRef}
          src={imageSrc}
          alt=""
          onLoad={initLayout}
          style={{
            position: 'absolute',
            left: imageBounds.x,
            top: imageBounds.y,
            width: imageBounds.width,
            height: imageBounds.height,
            transform: `rotate(${rotation}deg)`,
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />

        {/* Затемняющая маска с вырезом под рамку кропа */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <defs>
            <mask id="cropHoleMask">
              <rect width="100%" height="100%" fill="white" />
              <rect x={cropBox.x} y={cropBox.y} width={cropBox.width} height={cropBox.height} fill="black" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="#A6000000" mask="url(#cropHoleMask)" />
        </svg>

        {/* 2. РАМКА КАДРИРОВАНИЯ (CROP BOX) С 4 УГЛОВЫМИ СКОБКАМИ */}
        <div
          onMouseDown={handleBoxMouseDown}
          style={{
            position: 'absolute',
            left: cropBox.x,
            top: cropBox.y,
            width: cropBox.width,
            height: cropBox.height,
            border: '1px solid rgba(255, 255, 255, 0.4)',
            cursor: 'move',
            boxSizing: 'border-box',
          }}
        >
          {/* L-образные угловые скобки */}
          <div onMouseDown={(e) => handleCornerMouseDown(e, 'TL')} style={{ ...cornerHandleStyle, top: -2, left: -2, borderTop: '3px solid white', borderLeft: '3px solid white', cursor: 'nwse-resize' }} />
          <div onMouseDown={(e) => handleCornerMouseDown(e, 'TR')} style={{ ...cornerHandleStyle, top: -2, right: -2, borderTop: '3px solid white', borderRight: '3px solid white', cursor: 'nesw-resize' }} />
          <div onMouseDown={(e) => handleCornerMouseDown(e, 'BL')} style={{ ...cornerHandleStyle, bottom: -2, left: -2, borderBottom: '3px solid white', borderLeft: '3px solid white', cursor: 'nesw-resize' }} />
          <div onMouseDown={(e) => handleCornerMouseDown(e, 'BR')} style={{ ...cornerHandleStyle, bottom: -2, right: -2, borderBottom: '3px solid white', borderRight: '3px solid white', cursor: 'nwse-resize' }} />
        </div>
      </div>

      {/* 3. ПЛАВАЮЩИЙ ТУЛБАР ВНИЗУ СО СКРИНШОТА */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 26,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#D9161B23',
          border: '1px solid #2B313C',
          borderRadius: 22,
          padding: '6px 12px',
          boxShadow: '0 8px 22px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          zIndex: 10,
        }}
      >
        <button onClick={onClose} style={editorTextBtnStyle}>Cancel</button>

        <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />

        <button onClick={handleResetCrop} style={editorToolIconBtnStyle} title="Reset Crop">⛶</button>
        <button onClick={handleRotate} style={editorToolIconBtnStyle} title="Rotate 90°">↻</button>
        <button style={editorToolIconBtnStyle} title="Draw">🖌</button>
        <button onClick={handleAspectRatioSquare} style={editorToolIconBtnStyle} title="Aspect Ratio 1:1">⧉</button>

        <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />

        <button onClick={handleDone} style={{ ...editorTextBtnStyle, color: '#3E90F7' }}>Done</button>
      </div>
    </div>
  );
};

const cornerHandleStyle: React.CSSProperties = {
  position: 'absolute',
  width: 20,
  height: 20,
  backgroundColor: 'transparent',
};

const editorToolIconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  width: 36,
  height: 36,
  borderRadius: 18,
  color: '#D0D3D9',
  fontSize: 18,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const editorTextBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  fontSize: 13.5,
  fontWeight: 600,
  color: '#D0D3D9',
  padding: '6px 12px',
  cursor: 'pointer',
};