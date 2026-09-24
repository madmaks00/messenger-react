import React, { useRef, useState, useEffect, useCallback } from 'react';
import { eventBus } from '../../services/eventBus';
import { Theme } from '../profile/profile.theme';
import { normalizeImageSrc } from '../profile/profileView.utils';

// =========================================================================
// ТОЧНЫЕ ВЕКТОРНЫЕ ИКОНКИ MATERIAL DESIGN (1:1 PackIconKind из XAML)
// =========================================================================
const MdiIcons = {
  ImageEditOutline: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill={props.color || 'currentColor'}>
      <path d="M21 3H3C1.9 3 1 3.9 1 5V19C1 20.1 1.9 21 3 21H21C22.1 21 23 20.1 23 19V5C23 3.9 22.1 3 21 3M5 17L8.5 12.5L11 15.5L14.5 11L19 17H5M21 5V19H3V5H21Z" />
    </svg>
  ),
  Close: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 20} height={props.size || 20} viewBox="0 0 24 24" fill={props.color || 'currentColor'}>
      <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
    </svg>
  ),
  Eraser: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill={props.color || 'currentColor'}>
      <path d="M16.24,3.56L21.19,8.5C21.97,9.29 21.97,10.55 21.19,11.34L12,20.53C10.44,22.09 7.91,22.09 6.34,20.53L2.81,17C2.03,16.21 2.03,14.95 2.81,14.16L13.41,3.56C14.2,2.78 15.46,2.78 16.24,3.56M4.22,15.58L7.76,19.11C8.54,19.9 9.8,19.9 10.59,19.11L14.12,15.58L9.17,10.63L4.22,15.58Z" />
    </svg>
  ),
  Text: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill={props.color || 'currentColor'}>
      <path d="M18.5,4L19.66,8.35L18.7,8.61C18.25,7.74 17.79,6.87 17.26,6.43C16.73,6 15.77,6 14.24,6H13V18H14.77C15.46,18 16.03,18.1 16.48,18.32V19.16H7.52V18.32C7.97,18.1 8.54,18 9.23,18H11V6H9.76C8.23,6 7.27,6 6.74,6.43C6.21,6.87 5.75,7.74 5.3,8.61L4.34,8.35L5.5,4H18.5Z" />
    </svg>
  ),
  Heart: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 26} height={props.size || 26} viewBox="0 0 24 24" fill={props.color || '#FF3B30'}>
      <path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z" />
    </svg>
  ),
  Star: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 26} height={props.size || 26} viewBox="0 0 24 24" fill={props.color || '#FFCC00'}>
      <path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z" />
    </svg>
  ),
  EmoticonCool: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 26} height={props.size || 26} viewBox="0 0 24 24" fill={props.color || '#34C759'}>
      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2M7.5 13H5.5C4.67 13 4 12.33 4 11.5V10.5C4 9.67 4.67 9 5.5 9H8.5C9.33 9 10 9.67 10 10.5V11.5C10 12.33 9.33 13 8.5 13M18.5 13H16.5C15.67 13 15 12.33 15 11.5V10.5C15 9.67 15.67 9 16.5 9H19.5C20.33 9 21 9.67 21 10.5V11.5C21 12.33 20.33 13 19.5 13M12 18C9.5 18 7.37 16.32 6.7 14H17.3C16.63 16.32 14.5 18 12 18Z" />
    </svg>
  ),
  Fire: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 26} height={props.size || 26} viewBox="0 0 24 24" fill={props.color || '#FF9500'}>
      <path d="M12 22C7.58 22 4 18.42 4 14C4 10.74 6 7.42 8.5 5C8.94 4.56 9.68 4.7 9.87 5.28C10.42 6.94 11.37 8.35 12.63 9.41C13.06 9.77 13.72 9.56 13.85 9.02C14.28 7.21 14.09 5.25 13.27 3.59C13 3.05 13.38 2.45 13.98 2.59C17.5 3.42 20 6.64 20 11.23C20 12.16 19.83 13.08 19.5 13.94C19.29 14.47 19.64 15.06 20.21 15.11C20.28 15.12 20.35 15.12 20.42 15.12C20.9 15.12 21.32 14.81 21.46 14.34C21.82 13.16 22 11.92 22 10.66C22 16.92 17.52 22 12 22Z" />
    </svg>
  ),
};

const STICKER_PATHS: Record<string, string> = {
  Heart: 'M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z',
  Star: 'M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z',
  EmoticonCool: 'M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2M7.5 13H5.5C4.67 13 4 12.33 4 11.5V10.5C4 9.67 4.67 9 5.5 9H8.5C9.33 9 10 9.67 10 10.5V11.5C10 12.33 9.33 13 8.5 13M18.5 13H16.5C15.67 13 15 12.33 15 11.5V10.5C15 9.67 15.67 9 16.5 9H19.5C20.33 9 21 9.67 21 10.5V11.5C21 12.33 20.33 13 19.5 13M12 18C9.5 18 7.37 16.32 6.7 14H17.3C16.63 16.32 14.5 18 12 18Z',
  Fire: 'M12 22C7.58 22 4 18.42 4 14C4 10.74 6 7.42 8.5 5C8.94 4.56 9.68 4.7 9.87 5.28C10.42 6.94 11.37 8.35 12.63 9.41C13.06 9.77 13.85 9.02C14.28 7.21 14.09 5.25 13.27 3.59C13 3.05 13.38 2.45 13.98 2.59C17.5 3.42 20 6.64 20 11.23C20 12.16 19.83 13.08 19.5 13.94C19.29 14.47 19.64 15.06 20.21 15.11C20.28 15.12 20.35 15.12 20.42 15.12C20.9 15.12 21.32 14.81 21.46 14.34C21.82 13.16 22 11.92 22 10.66C22 16.92 17.52 22 12 22Z',
};

const PALETTE_COLORS: readonly string[] = [
  '#FFFFFF', '#FF3B30', '#007AFF', '#30B0C7', '#34C759', '#FFCC00',
  '#FF9500', '#AF52DE', '#FF2D55', '#A2845E', '#8E8E93', '#171717',
];

export interface StoryEditorViewProps {
  isOpen: boolean;
  imageSource: string;
  storyId?: number | null;
  initialDescription?: string;
  initialIsPrivate?: boolean;
  onClose: () => void;
}

interface OverlayElement {
  id: string;
  type: 'text' | 'sticker';
  content: string;
  color: string;
  x: number;
  y: number;
}

// 🟢 Именованный экспорт: export const StoryEditorView
export const StoryEditorView: React.FC<StoryEditorViewProps> = ({
  isOpen,
  imageSource,
  storyId,
  initialDescription = '',
  initialIsPrivate = false,
  onClose,
}) => {
  const [mode, setMode] = useState<'drawing' | 'stickers'>('drawing');
  const [brushSize, setBrushSize] = useState<number>(6);
  const [brushColor, setBrushColor] = useState<string>('#FFFFFF');
  const [description, setDescription] = useState<string>(initialDescription);
  const [isPrivate, setIsPrivate] = useState<boolean>(initialIsPrivate);
  const [overlayElements, setOverlayElements] = useState<OverlayElement[]>([]);

  const normalizedImageSource = normalizeImageSrc(imageSource);

  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 420, height: 580 });

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; elX: number; elY: number }>({ x: 0, y: 0, elX: 0, elY: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef<boolean>(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const clearDrawing = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setOverlayElements([]);
  }, []);

  const updateAspectDimensions = useCallback((naturalW: number, naturalH: number) => {
    if (naturalW <= 0 || naturalH <= 0) return;
    const maxW = 540;
    const maxH = 580;
    const scale = Math.min(maxW / naturalW, maxH / naturalH);
    const w = Math.max(1, Math.round(naturalW * scale));
    const h = Math.max(1, Math.round(naturalH * scale));
    setCanvasSize({ width: w, height: h });
  }, []);

  useEffect(() => {
    if (!normalizedImageSource) return;

    const img = new Image();
    img.onload = () => {
      updateAspectDimensions(img.naturalWidth, img.naturalHeight);
    };
    img.src = normalizedImageSource;
  }, [normalizedImageSource, updateAspectDimensions]);

  useEffect(() => {
    if (!isOpen) return;
    setDescription(initialDescription || '');
    setIsPrivate(initialIsPrivate || false);
    setOverlayElements([]);
    clearDrawing();
    setMode('drawing');
    setBrushColor('#FFFFFF');
    setBrushSize(6);
  }, [isOpen, initialDescription, initialIsPrivate, clearDrawing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'drawing') return;
    isDrawing.current = true;
    const rect = canvasRef.current?.getBoundingClientRect();
    lastPoint.current = {
      x: e.clientX - (rect?.left || 0),
      y: e.clientY - (rect?.top || 0),
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedId) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setOverlayElements((prev) =>
        prev.map((el) =>
          el.id === draggedId ? { ...el, x: dragStartRef.current.elX + dx, y: dragStartRef.current.elY + dy } : el
        )
      );
      return;
    }

    if (!isDrawing.current || mode !== 'drawing') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !lastPoint.current) return;

    const rect = canvas.getBoundingClientRect();
    const currentPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    ctx.beginPath();
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.stroke();

    lastPoint.current = currentPoint;
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
    lastPoint.current = null;
    setDraggedId(null);
  };

  const addTextOverlay = () => {
    const newText: OverlayElement = {
      id: `text_${Date.now()}`,
      type: 'text',
      content: 'Type text...',
      color: '#FFFFFF',
      x: Math.min(80, Math.max(10, canvasSize.width / 2 - 80)),
      y: Math.min(80, Math.max(10, canvasSize.height / 2 - 20)),
    };
    setOverlayElements((prev) => [...prev, newText]);
    setMode('stickers');
  };

  const addSticker = (tag: string, color: string) => {
    const newSticker: OverlayElement = {
      id: `sticker_${Date.now()}`,
      type: 'sticker',
      content: tag,
      color,
      x: Math.min(100, Math.max(10, canvasSize.width / 2 - 25)),
      y: Math.min(100, Math.max(10, canvasSize.height / 2 - 25)),
    };
    setOverlayElements((prev) => [...prev, newSticker]);
    setMode('stickers');
  };

  // 🟢 1:1 RenderCanvasToJpeg
  const renderFinalCanvas = async (): Promise<string> => {
    return new Promise((resolve) => {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvasSize.width;
      exportCanvas.height = canvasSize.height;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return resolve(normalizedImageSource);

      const baseImg = new Image();

      baseImg.onload = () => {
        // 1. Отрисовка исходного фото
        ctx.drawImage(baseImg, 0, 0, canvasSize.width, canvasSize.height);

        // 2. Отрисовка мазков кисти
        if (canvasRef.current) {
          ctx.drawImage(canvasRef.current, 0, 0, canvasSize.width, canvasSize.height);
        }

        // 3. Отрисовка текста и векторных стикеров
        overlayElements.forEach((el) => {
          if (el.type === 'text') {
            ctx.font = 'bold 20px "Segoe UI", sans-serif';
            ctx.fillStyle = el.color || '#FFFFFF';
            ctx.fillText(el.content, el.x + 4, el.y + 24);
          } else if (el.type === 'sticker' && STICKER_PATHS[el.content]) {
            ctx.save();
            ctx.translate(el.x, el.y);
            const scale = 50 / 24;
            ctx.scale(scale, scale);
            ctx.fillStyle = el.color;
            ctx.fill(new Path2D(STICKER_PATHS[el.content]));
            ctx.restore();
          }
        });

        try {
          resolve(exportCanvas.toDataURL('image/jpeg', 0.95));
        } catch (e) {
          console.error('[StoryEditorView] Canvas export error:', e);
          resolve(normalizedImageSource);
        }
      };

      baseImg.onerror = () => {
        console.warn('[StoryEditorView] Base image failed to load into export canvas.');
        resolve(normalizedImageSource);
      };

      baseImg.src = normalizedImageSource;
    });
  };

  const handlePostStory = async () => {
    const finalDataUrl = await renderFinalCanvas();

    if (storyId) {
      eventBus.emit('UpdateStoryMessage', {
        storyId,
        image: finalDataUrl,
        description,
        isPrivate,
      });
    } else {
      eventBus.emit('PostStoryMessage', {
        image: finalDataUrl,
        description,
        isPrivate,
      });
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
      }}
    >
      {/* КАРТОЧКА РЕДАКТОРА */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 920,
          height: 680,
          backgroundColor: Theme.ProfileCardBackground,
          border: `1px solid ${Theme.ProfileInputContainerBorder}`,
          borderRadius: 16,
          boxShadow: '0 40px 80px rgba(0, 0, 0, 0.5)',
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
          padding: 20,
          boxSizing: 'border-box',
        }}
      >
        {/* 1. ШАПКА */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ marginRight: 10, display: 'flex', alignItems: 'center' }}>
              <MdiIcons.ImageEditOutline size={24} color={Theme.AppAccent} />
            </div>
            <span style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' }}>
              {storyId ? 'Edit Story' : 'Story Editor'}
            </span>
          </div>

          <button
            onClick={onClose}
            title="Close"
            style={{
              width: 32,
              height: 32,
              background: 'transparent',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <MdiIcons.Close size={20} color={Theme.ProfileSectionLabel} />
          </button>
        </div>

        {/* 2. ОСНОВНОЙ КОНТЕНТ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', minHeight: 0 }}>
          {/* ЛЕВАЯ ЧАСТЬ: ИНТЕРАКТИВНЫЙ ХОЛСТ */}
          <div
            style={{
              backgroundColor: '#0E1621',
              borderRadius: 12,
              overflow: 'hidden',
              marginRight: 15,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              style={{
                width: canvasSize.width,
                height: canvasSize.height,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              }}
            >
              <img
                src={normalizedImageSource}
                onLoad={(e) => updateAspectDimensions(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  pointerEvents: 'none',
                  display: 'block',
                }}
              />

              <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: mode === 'drawing' ? 'auto' : 'none',
                  cursor: mode === 'drawing' ? 'crosshair' : 'default',
                }}
              />

              {overlayElements.map((el) => (
                <div
                  key={el.id}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggedId(el.id);
                    dragStartRef.current = { x: e.clientX, y: e.clientY, elX: el.x, elY: el.y };
                  }}
                  style={{
                    position: 'absolute',
                    left: el.x,
                    top: el.y,
                    cursor: 'move',
                    userSelect: 'none',
                  }}
                >
                  {el.type === 'text' ? (
                    <input
                      type="text"
                      defaultValue={el.content}
                      onChange={(e) => { el.content = e.target.value; }}
                      style={{
                        background: 'transparent',
                        border: '1px dashed rgba(255,255,255,0.4)',
                        color: '#FFFFFF',
                        fontSize: 20,
                        fontWeight: 'bold',
                        outline: 'none',
                        padding: 4,
                        width: 160,
                        fontFamily: "'Segoe UI', sans-serif",
                      }}
                    />
                  ) : (
                    <div style={{ width: 50, height: 50 }}>
                      {el.content === 'Heart' && <MdiIcons.Heart size={50} color={el.color} />}
                      {el.content === 'Star' && <MdiIcons.Star size={50} color={el.color} />}
                      {el.content === 'EmoticonCool' && <MdiIcons.EmoticonCool size={50} color={el.color} />}
                      {el.content === 'Fire' && <MdiIcons.Fire size={50} color={el.color} />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ПРАВАЯ ЧАСТЬ: ПАНЕЛЬ ИНСТРУМЕНТОВ */}
          <div
            style={{
              backgroundColor: Theme.ProfileInputContainerBg,
              border: `1px solid ${Theme.ProfileInputContainerBorder}`,
              borderRadius: 12,
              padding: 15,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box',
            }}
          >
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <button
                  onClick={() => setMode('drawing')}
                  style={{
                    height: 36,
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    backgroundColor: mode === 'drawing' ? Theme.ProfileDeviceItemBg : 'transparent',
                    color: mode === 'drawing' ? Theme.AppAccent : Theme.ProfileSectionLabel,
                    transition: 'all 0.15s ease',
                  }}
                >
                  Drawing
                </button>
                <button
                  onClick={() => setMode('stickers')}
                  style={{
                    height: 36,
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    backgroundColor: mode === 'stickers' ? Theme.ProfileDeviceItemBg : 'transparent',
                    color: mode === 'stickers' ? Theme.AppAccent : Theme.ProfileSectionLabel,
                    transition: 'all 0.15s ease',
                  }}
                >
                  Stickers & Text
                </button>
              </div>

              {mode === 'drawing' && (
                <div>
                  <div style={modernLabelStyle}>BRUSH SIZE</div>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                    <input
                      type="range"
                      min={2}
                      max={36}
                      value={brushSize}
                      onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                      style={{ flex: 1, accentColor: Theme.AppAccent }}
                    />
                    <span style={{ color: Theme.ProfileSectionLabel, fontSize: 12, marginLeft: 8, width: 34 }}>
                      {brushSize}px
                    </span>
                  </div>

                  <div style={modernLabelStyle}>COLOR PALETTE</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, marginBottom: 12 }}>
                    {PALETTE_COLORS.map((c) => {
                      const isSelected = brushColor.toLowerCase() === c.toLowerCase();
                      return (
                        <button
                          key={c}
                          onClick={() => setBrushColor(c)}
                          style={{
                            width: 26,
                            height: 26,
                            margin: 2,
                            borderRadius: 13,
                            backgroundColor: c,
                            border: isSelected ? '2px solid #FFFFFF' : 'none',
                            outline: 'none',
                            cursor: 'pointer',
                            boxSizing: 'border-box',
                            padding: 0,
                          }}
                        />
                      );
                    })}
                  </div>

                  <button
                    onClick={clearDrawing}
                    style={{
                      height: 32,
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 8px',
                      marginBottom: 10,
                    }}
                  >
                    <MdiIcons.Eraser size={16} color="#FF3B30" />
                    <span style={{ color: '#FF3B30', fontSize: 12, fontWeight: 600, marginLeft: 8 }}>
                      Clear Drawing
                    </span>
                  </button>
                </div>
              )}

              {mode === 'stickers' && (
                <div>
                  <div style={modernLabelStyle}>ELEMENTS</div>
                  <button
                    onClick={addTextOverlay}
                    style={{
                      height: 36,
                      background: Theme.ProfileDeviceItemBg,
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 12px',
                      marginBottom: 6,
                      width: '100%',
                    }}
                  >
                    <MdiIcons.Text size={16} color={Theme.AppAccent} />
                    <span style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: 600, marginLeft: 10 }}>
                      Add Text Overlay
                    </span>
                  </button>

                  <div style={{ ...modernLabelStyle, marginTop: 10 }}>STICKERS</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', height: 70, marginBottom: 10 }}>
                    <button onClick={() => addSticker('Heart', '#FF3B30')} style={stickerButtonStyle} title="Heart">
                      <MdiIcons.Heart size={26} color="#FF3B30" />
                    </button>
                    <button onClick={() => addSticker('Star', '#FFCC00')} style={stickerButtonStyle} title="Star">
                      <MdiIcons.Star size={26} color="#FFCC00" />
                    </button>
                    <button onClick={() => addSticker('EmoticonCool', '#34C759')} style={stickerButtonStyle} title="EmoticonCool">
                      <MdiIcons.EmoticonCool size={26} color="#34C759" />
                    </button>
                    <button onClick={() => addSticker('Fire', '#FF9500')} style={stickerButtonStyle} title="Fire">
                      <MdiIcons.Fire size={26} color="#FF9500" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div style={{ height: 1, backgroundColor: Theme.ProfileInputContainerBorder, marginBottom: 10 }} />

              <div style={modernLabelStyle}>STORY CAPTION</div>

              <div
                style={{
                  backgroundColor: Theme.ProfileInputContainerBg,
                  border: `1px solid ${Theme.ProfileInputContainerBorder}`,
                  borderRadius: 10,
                  height: 62,
                  marginBottom: 10,
                  padding: '6px 10px',
                  boxSizing: 'border-box',
                }}
              >
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add caption or hashtags..."
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#FFFFFF',
                    fontSize: 12.5,
                    resize: 'none',
                    fontFamily: "'Segoe UI', sans-serif",
                    padding: 0,
                  }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  style={{ accentColor: Theme.AppAccent, width: 14, height: 14, margin: 0, marginRight: 8 }}
                />
                <span style={{ color: '#FFFFFF', fontSize: 12 }}>Keep private (Only me)</span>
              </label>

              <button
                onClick={handlePostStory}
                style={{
                  width: '100%',
                  height: 38,
                  borderRadius: 10,
                  backgroundColor: Theme.AppAccent,
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: 13.5,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  marginBottom: 6,
                }}
              >
                {storyId ? 'Save Changes' : 'Post Story'}
              </button>

              <button
                onClick={onClose}
                style={{
                  width: '100%',
                  height: 34,
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  color: Theme.ProfileSectionLabel,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 🟢 Дефолтный экспорт для совместимости с любым типом импорта
export default StoryEditorView;

const modernLabelStyle: React.CSSProperties = {
  color: Theme.ProfileSectionLabel,
  fontSize: 11,
  fontWeight: 'bold',
  marginBottom: 6,
  textTransform: 'uppercase',
};

const stickerButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};