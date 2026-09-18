import React, { useRef, useState, useEffect, useCallback } from 'react';
import { eventBus } from '../../services/eventBus';

interface StoryEditorViewProps {
  isOpen: boolean;
  imageSource: string; // URL или Base64 исходного фото
  storyId?: number | null;
  initialDescription?: string;
  initialIsPrivate?: boolean;
  onClose: () => void;
}

const PALETTE_COLORS = [
  '#FFFFFF', '#FF3B30', '#007AFF', '#30B0C7', '#34C759', '#FFCC00',
  '#FF9500', '#AF52DE', '#FF2D55', '#A2845E', '#8E8E93', '#171717',
];

interface OverlayElement {
  id: string;
  type: 'text' | 'sticker';
  content: string;
  color?: string;
  x: number;
  y: number;
}

export const StoryEditorView: React.FC<StoryEditorViewProps> = ({
  isOpen,
  imageSource,
  storyId,
  initialDescription = '',
  initialIsPrivate = false,
  onClose,
}) => {
  const [mode, setMode] = useState<'drawing' | 'stickers'>('drawing');
  const [brushSize, setBrushSize] = useState(6);
  const [brushColor, setBrushColor] = useState('#FFFFFF');
  const [description, setDescription] = useState(initialDescription);
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate);
  const [overlayElements, setOverlayElements] = useState<OverlayElement[]>([]);

  // Перетаскивание стикеров и текста
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0, elX: 0, elY: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // 1. Сначала объявляем функцию очистки
  const clearDrawing = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setOverlayElements([]);
  }, []);

  // 2. Затем используем её в useEffect
  useEffect(() => {
    if (!isOpen) return;
    setDescription(initialDescription);
    setIsPrivate(initialIsPrivate);
    setOverlayElements([]);
    clearDrawing();
  }, [isOpen, initialDescription, initialIsPrivate, clearDrawing]);

  // Рисование на канвасе
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
    // 1. Перемещение стикера/текста
    if (draggedId) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setOverlayElements((prev) =>
        prev.map((el) =>
          el.id === draggedId ? { ...el, x: dragStart.current.elX + dx, y: dragStart.current.elY + dy } : el
        )
      );
      return;
    }

    // 2. Рисование кистью
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
      x: 80,
      y: 80,
    };
    setOverlayElements((prev) => [...prev, newText]);
    setMode('stickers');
  };

  const addSticker = (stickerType: string, color: string) => {
    const emojiMap: Record<string, string> = {
      Heart: '❤️',
      Star: '⭐',
      EmoticonCool: '😎',
      Fire: '🔥',
    };
    const newSticker: OverlayElement = {
      id: `sticker_${Date.now()}`,
      type: 'sticker',
      content: emojiMap[stickerType] || '⭐',
      color,
      x: 100,
      y: 100,
    };
    setOverlayElements((prev) => [...prev, newSticker]);
    setMode('stickers');
  };

  // Экспорт готовой истории (Merge фото + рисунок + стикеры)
  const handlePostStory = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 540;
    canvas.height = 580;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseImg = new Image();
    baseImg.crossOrigin = 'anonymous';
    baseImg.src = imageSource;

    baseImg.onload = () => {
      // 1. Рисуем фоновое фото
      ctx.drawImage(baseImg, 0, 0, 540, 580);

      // 2. Накладываем мазки пера
      if (canvasRef.current) {
        ctx.drawImage(canvasRef.current, 0, 0, 540, 580);
      }

      // 3. Накладываем текст и стикеры
      overlayElements.forEach((el) => {
        ctx.font = el.type === 'text' ? 'bold 20px "Segoe UI", sans-serif' : '40px sans-serif';
        ctx.fillStyle = el.color || '#FFFFFF';
        ctx.fillText(el.content, el.x, el.y + (el.type === 'text' ? 20 : 35));
      });

      const finalDataUrl = canvas.toDataURL('image/jpeg', 0.95);

      if (storyId) {
        eventBus.emit('UpdateStoryMessage' as any, {
          storyId,
          image: finalDataUrl,
          description,
          isPrivate,
        });
      } else {
        eventBus.emit('PostStoryMessage' as any, {
          image: finalDataUrl,
          description,
          isPrivate,
        });
      }

      onClose();
    };
  };

  // 3. Досрочный выход переносим сюда — после объявления всех функций
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(6px)',
        userSelect: 'none',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 920,
          height: 680,
          backgroundColor: '#1E2330',
          borderRadius: 16,
          border: '1px solid #334155',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          padding: 20,
          boxSizing: 'border-box',
        }}
      >
        {/* 1. ШАПКА РЕДАКТОРА */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#FFF', fontSize: 20, fontWeight: 'bold' }}>
            <span style={{ color: 'var(--app-accent, #3B82F6)' }}>🎨</span>
            <span>{storyId ? 'Edit Story' : 'Story Editor'}</span>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* 2. ОСНОВНАЯ ОБЛАСТЬ: ХОЛСТ СЛЕВА + ПАНЕЛЬ СПРАВА */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 310px', gap: 15, minHeight: 0 }}>
          {/* ЛЕВАЯ ЧАСТЬ: ИНТЕРАКТИВНЫЙ ХОЛСТ (540x580) */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            style={{
              position: 'relative',
              backgroundColor: '#0E1621',
              borderRadius: 12,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Фоновое фото */}
            <img
              src={imageSource}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
            />

            {/* Слой рисования (InkCanvas) */}
            <canvas
              ref={canvasRef}
              width={540}
              height={580}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: mode === 'drawing' ? 'auto' : 'none',
                cursor: mode === 'drawing' ? 'crosshair' : 'default',
              }}
            />

            {/* Слой наклеек и текста */}
            {overlayElements.map((el) => (
              <div
                key={el.id}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDraggedId(el.id);
                  dragStart.current = { x: e.clientX, y: e.clientY, elX: el.x, elY: el.y };
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
                      color: '#FFF',
                      fontSize: 20,
                      fontWeight: 'bold',
                      outline: 'none',
                      padding: 4,
                      width: 160,
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 40 }}>{el.content}</span>
                )}
              </div>
            ))}
          </div>

          {/* ПРАВАЯ ЧАСТЬ: ПАНЕЛЬ ИНСТРУМЕНТОВ */}
          <div
            style={{
              backgroundColor: '#161B26',
              border: '1px solid #334155',
              borderRadius: 12,
              padding: 15,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              {/* Переключатель режимов */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
                <button
                  onClick={() => setMode('drawing')}
                  style={mode === 'drawing' ? activeTabBtnStyle : inactiveTabBtnStyle}
                >
                  Drawing
                </button>
                <button
                  onClick={() => setMode('stickers')}
                  style={mode === 'stickers' ? activeTabBtnStyle : inactiveTabBtnStyle}
                >
                  Stickers & Text
                </button>
              </div>

              {/* ИНСТРУМЕНТЫ РИСОВАНИЯ */}
              {mode === 'drawing' && (
                <div>
                  <div style={toolLabelStyle}>BRUSH SIZE: {brushSize}px</div>
                  <input
                    type="range"
                    min={2}
                    max={36}
                    value={brushSize}
                    onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                    style={{ width: '100%', accentColor: '#3B82F6', marginBottom: 16 }}
                  />

                  <div style={toolLabelStyle}>COLOR PALETTE</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 16 }}>
                    {PALETTE_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setBrushColor(c)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: c,
                          border: brushColor === c ? '2px solid #FFF' : '1px solid rgba(255,255,255,0.2)',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>

                  <button onClick={clearDrawing} style={clearBtnStyle}>
                    🗑 Clear Drawing
                  </button>
                </div>
              )}

              {/* ИНСТРУМЕНТЫ СТИКЕРОВ И ТЕКСТА */}
              {mode === 'stickers' && (
                <div>
                  <div style={toolLabelStyle}>ELEMENTS</div>
                  <button onClick={addTextOverlay} style={addTextBtnStyle}>
                    ✍️ Add Text Overlay
                  </button>

                  <div style={{ ...toolLabelStyle, marginTop: 16 }}>STICKERS</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    <button onClick={() => addSticker('Heart', '#FF3B30')} style={stickerBtnStyle}>❤️</button>
                    <button onClick={() => addSticker('Star', '#FFCC00')} style={stickerBtnStyle}>⭐</button>
                    <button onClick={() => addSticker('EmoticonCool', '#34C759')} style={stickerBtnStyle}>😎</button>
                    <button onClick={() => addSticker('Fire', '#FF9500')} style={stickerBtnStyle}>🔥</button>
                  </div>
                </div>
              )}
            </div>

            {/* НИЖНЯЯ СЕКЦИЯ: ОПИСАНИЕ И КНОПКА ПУБЛИКАЦИИ */}
            <div>
              <div style={toolLabelStyle}>STORY CAPTION</div>
              <textarea
                rows={2}
                placeholder="Add caption or hashtags..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={captionInputStyle}
              />

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#FFF', fontSize: 12, cursor: 'pointer', marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                />
                <span>Keep private (Only me)</span>
              </label>

              <button onClick={handlePostStory} style={submitBtnStyle}>
                {storyId ? 'Save Changes' : 'Post Story'}
              </button>
              <button onClick={onClose} style={cancelBtnStyle}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#94A3B8',
  fontSize: 20,
  cursor: 'pointer',
};

const toolLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 'bold',
  color: '#64748B',
  marginBottom: 8,
};

const activeTabBtnStyle: React.CSSProperties = {
  padding: '8px 0',
  borderRadius: 8,
  backgroundColor: '#1E2330',
  color: 'var(--app-accent, #3B82F6)',
  border: '1px solid #334155',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const inactiveTabBtnStyle: React.CSSProperties = {
  padding: '8px 0',
  borderRadius: 8,
  backgroundColor: 'transparent',
  color: '#94A3B8',
  border: 'none',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const clearBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 0',
  borderRadius: 8,
  backgroundColor: 'rgba(239, 68, 68, 0.1)',
  border: 'none',
  color: '#EF4444',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const addTextBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  backgroundColor: '#1E2330',
  border: '1px solid #334155',
  color: '#FFF',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'left',
};

const stickerBtnStyle: React.CSSProperties = {
  height: 48,
  borderRadius: 8,
  backgroundColor: '#1E2330',
  border: '1px solid #334155',
  fontSize: 24,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const captionInputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#1E2330',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#FFF',
  fontSize: 12.5,
  padding: 8,
  resize: 'none',
  outline: 'none',
  boxSizing: 'border-box',
  marginBottom: 8,
};

const submitBtnStyle: React.CSSProperties = {
  width: '100%',
  height: 38,
  borderRadius: 10,
  backgroundColor: 'var(--app-accent, #3B82F6)',
  color: '#FFF',
  border: 'none',
  fontSize: 13.5,
  fontWeight: 'bold',
  cursor: 'pointer',
  marginBottom: 6,
};

const cancelBtnStyle: React.CSSProperties = {
  width: '100%',
  height: 34,
  background: 'transparent',
  border: 'none',
  color: '#64748B',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};