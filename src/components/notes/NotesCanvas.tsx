import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNotesStore } from '../../stores/notesStore';
import { NoteShapeType } from '../../types/enums';

const DEFAULT_PALETTE_ROW1 = ['#000000', '#808080', '#FFFFFF', '#FF0000', '#FFA500'];
const DEFAULT_PALETTE_ROW2 = ['#FFFF00', '#008000', '#90EE90', '#0000FF', '#FF00FF'];

interface CanvasElement {
  id: string;
  type: 'shape' | 'text' | 'image';
  shapeType?: NoteShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeThickness: number;
  text?: string;
  fontSize?: number;
  src?: string;
}

interface CanvasStroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export const NotesCanvas: React.FC = () => {
  const {
    selectedNote,
    noteEditMode,
    brushSize,
    brushColor,
    selectedShape,
    customColor1,
    customColor2,
    setNoteEditMode,
    setSelectedShape,
    setBrushSize,
    setBrushColor,
    setCustomColor,
    saveCurrentNoteInkData,
  } = useNotesStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Стейт холста
  const [strokes, setStrokes] = useState<CanvasStroke[]>([]);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [bgType, setBgType] = useState<'Grid' | 'Solid' | 'Image'>('Grid');
  const [bgColor, setBgColor] = useState('#000000');
  const [bgImage, setBgImage] = useState<string | null>(null);

  // Панорамирование (RMB)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Рисование (LMB)
  const isDrawing = useRef(false);
  const currentPoints = useRef<{ x: number; y: number }[]>([]);

  // Перемещение элементов
  const [draggedElementId, setDraggedElementId] = useState<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0, elX: 0, elY: 0 });

  // Стек Undo / Redo
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);

  // Сохранение снимка состояния для Undo
  const saveSnapshot = useCallback(() => {
    const state = JSON.stringify({ strokes, elements, bgType, bgColor, bgImage });
    undoStack.current.push(state);
    redoStack.current = [];
  }, [strokes, elements, bgType, bgColor, bgImage]);

  const undo = () => {
    if (undoStack.current.length <= 1) return;
    const current = undoStack.current.pop()!;
    redoStack.current.push(current);

    const prev = JSON.parse(undoStack.current[undoStack.current.length - 1]);
    setStrokes(prev.strokes || []);
    setElements(prev.elements || []);
    setBgType(prev.bgType || 'Grid');
    setBgColor(prev.bgColor || '#000000');
    setBgImage(prev.bgImage || null);
  };

  const redo = () => {
    if (redoStack.current.length === 0) return;
    const nextState = redoStack.current.pop()!;
    undoStack.current.push(nextState);

    const parsed = JSON.parse(nextState);
    setStrokes(parsed.strokes || []);
    setElements(parsed.elements || []);
    setBgType(parsed.bgType || 'Grid');
    setBgColor(parsed.bgColor || '#000000');
    setBgImage(parsed.bgImage || null);
  };

  // Перерисовка холста
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Отрисовка всех мазков пера
    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });
  }, [strokes]);

  // Загрузка состояния заметки
  useEffect(() => {
    if (selectedNote?.inkData) {
      try {
        const pkg = JSON.parse(selectedNote.inkData);
        if (pkg) {
          setStrokes(pkg.strokes || []);
          setElements(pkg.elements || []);
          setBgType(pkg.bgType || 'Grid');
          setBgColor(pkg.bgColor || '#000000');
          setBgImage(pkg.bgImage || null);
        }
      } catch {}
    } else {
      setStrokes([]);
      setElements([]);
      setBgType('Grid');
    }
  }, [selectedNote?.id]);

  // Мышь: начало действия
  const handleMouseDown = (e: React.MouseEvent) => {
    // 1. Панорамирование холста на ПКМ (RMB)
    if (e.button === 2) {
      isPanning.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (e.button !== 0) return;

    // 2. Вставка выбранной фигуры (с моментальным возвратом в режим Select)
    if (noteEditMode === 'Shape' && selectedShape !== NoteShapeType.None) {
      const rect = containerRef.current?.getBoundingClientRect();
      const x = e.clientX - (rect?.left || 0) - panOffset.x;
      const y = e.clientY - (rect?.top || 0) - panOffset.y;

      const newEl: CanvasElement = {
        id: `el_${Date.now()}`,
        type: selectedShape === NoteShapeType.Text ? 'text' : 'shape',
        shapeType: selectedShape,
        x,
        y,
        width: selectedShape === NoteShapeType.Text ? 160 : 120,
        height: selectedShape === NoteShapeType.Text ? 45 : 80,
        fill: 'transparent',
        stroke: brushColor,
        strokeThickness: brushSize,
        text: selectedShape === NoteShapeType.Text ? 'Text' : '',
        fontSize: 16,
      };

      setElements((prev) => [...prev, newEl]);
      setSelectedShape(NoteShapeType.None);
      setNoteEditMode('Select');
      saveSnapshot();
      return;
    }

    // 3. Рисование пером
    if (noteEditMode === 'Ink') {
      isDrawing.current = true;
      const rect = containerRef.current?.getBoundingClientRect();
      const pt = {
        x: e.clientX - (rect?.left || 0) - panOffset.x,
        y: e.clientY - (rect?.top || 0) - panOffset.y,
      };
      currentPoints.current = [pt];
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Панорамирование холста
    if (isPanning.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Перемещение элементов
    if (draggedElementId) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setElements((prev) =>
        prev.map((el) =>
          el.id === draggedElementId
            ? { ...el, x: dragStart.current.elX + dx, y: dragStart.current.elY + dy }
            : el
        )
      );
      return;
    }

    // Рисование
    if (isDrawing.current && noteEditMode === 'Ink') {
      const rect = containerRef.current?.getBoundingClientRect();
      const pt = {
        x: e.clientX - (rect?.left || 0) - panOffset.x,
        y: e.clientY - (rect?.top || 0) - panOffset.y,
      };
      currentPoints.current.push(pt);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && currentPoints.current.length >= 2) {
        const p1 = currentPoints.current[currentPoints.current.length - 2];
        const p2 = currentPoints.current[currentPoints.current.length - 1];
        ctx.beginPath();
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  };

  const handleMouseUp = () => {
    if (isPanning.current) {
      isPanning.current = false;
    }

    if (draggedElementId) {
      setDraggedElementId(null);
      saveSnapshot();
    }

    if (isDrawing.current) {
      isDrawing.current = false;
      if (currentPoints.current.length > 1) {
        setStrokes((prev) => [
          ...prev,
          { points: [...currentPoints.current], color: brushColor, width: brushSize },
        ]);
        saveSnapshot();
      }
    }
  };

  // Ручное и автоматическое сохранение холста
  const handleSave = () => {
    const pkg = JSON.stringify({ strokes, elements, bgType, bgColor, bgImage });
    saveCurrentNoteInkData(pkg);
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: bgType === 'Solid' ? bgColor : '#0E1621',
        backgroundImage:
          bgType === 'Grid'
            ? 'radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px)'
            : bgType === 'Image' && bgImage
            ? `url(${bgImage})`
            : 'none',
        backgroundSize: bgType === 'Grid' ? '40px 40px' : 'cover',
        cursor: isPanning.current ? 'all-scroll' : noteEditMode === 'Select' ? 'default' : 'crosshair',
        userSelect: 'none',
      }}
    >
      {/* СЛОЙ ПАНОРАМИРОВАНИЯ */}
      <div
        style={{
          position: 'absolute',
          left: panOffset.x,
          top: panOffset.y,
          width: 3000,
          height: 3000,
        }}
      >
        <canvas ref={canvasRef} width={3000} height={3000} style={{ position: 'absolute', inset: 0 }} />

        {/* ФИГУРЫ И ТЕКСТОВЫЕ БЛОКИ */}
        {elements.map((el) => {
          if (el.type === 'text') {
            return (
              <div
                key={el.id}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDraggedElementId(el.id);
                  dragStart.current = { x: e.clientX, y: e.clientY, elX: el.x, elY: el.y };
                }}
                style={{
                  position: 'absolute',
                  left: el.x,
                  top: el.y,
                  width: el.width,
                  height: el.height,
                  cursor: 'move',
                }}
              >
                <textarea
                  defaultValue={el.text}
                  onChange={(e) => {
                    el.text = e.target.value;
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'transparent',
                    border: '1px dashed #64748B',
                    color: el.stroke,
                    fontSize: el.fontSize || 16,
                    resize: 'none',
                    outline: 'none',
                  }}
                />
              </div>
            );
          }

          return (
            <div
              key={el.id}
              onMouseDown={(e) => {
                e.stopPropagation();
                setDraggedElementId(el.id);
                dragStart.current = { x: e.clientX, y: e.clientY, elX: el.x, elY: el.y };
              }}
              style={{
                position: 'absolute',
                left: el.x,
                top: el.y,
                width: el.width,
                height: el.height,
                border: `${el.strokeThickness}px solid ${el.stroke}`,
                borderRadius: el.shapeType === NoteShapeType.Ellipse ? '50%' : el.shapeType === NoteShapeType.Square ? 0 : 4,
                backgroundColor: el.fill,
                cursor: 'move',
              }}
            />
          );
        })}
      </div>

      {/* ОСТРОВ 2: КИСТЬ / ПАЛИТРА С COLORWHEEL */}
      {noteEditMode === 'Ink' && (
        <div
          style={{
            position: 'absolute',
            bottom: 75,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1E2330',
            border: '1px solid #334155',
            borderRadius: 32,
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            zIndex: 30,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 'bold', color: '#94A3B8' }}>{brushSize}px</span>
            <input
              type="range"
              min={1}
              max={20}
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
              style={{ width: 70, accentColor: '#3B82F6' }}
            />
          </div>

          <div style={{ width: 1, height: 36, background: '#334155' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
            {DEFAULT_PALETTE_ROW1.map((c) => (
              <div
                key={c}
                onClick={() => setBrushColor(c)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  background: c,
                  cursor: 'pointer',
                  border: brushColor === c ? '2px solid #3B82F6' : '1px solid rgba(255,255,255,0.2)',
                }}
              />
            ))}
            <div
              onClick={() => setBrushColor(customColor1)}
              style={{ width: 24, height: 24, borderRadius: 12, background: customColor1, cursor: 'pointer', border: '1px dashed #FFF' }}
              title="Custom 1"
            />
            {DEFAULT_PALETTE_ROW2.map((c) => (
              <div
                key={c}
                onClick={() => setBrushColor(c)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  background: c,
                  cursor: 'pointer',
                  border: brushColor === c ? '2px solid #3B82F6' : '1px solid rgba(255,255,255,0.2)',
                }}
              />
            ))}
            <div
              onClick={() => setBrushColor(customColor2)}
              style={{ width: 24, height: 24, borderRadius: 12, background: customColor2, cursor: 'pointer', border: '1px dashed #FFF' }}
              title="Custom 2"
            />
          </div>
        </div>
      )}

      {/* ОСТРОВ 3: ВЫБОР ФИГУР */}
      {noteEditMode === 'Shape' && (
        <div
          style={{
            position: 'absolute',
            bottom: 75,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1E2330',
            border: '1px solid #334155',
            borderRadius: 24,
            padding: '6px 12px',
            display: 'flex',
            gap: 8,
            zIndex: 30,
          }}
        >
          <button onClick={() => setSelectedShape(NoteShapeType.Text)} style={shapeBtnStyle}>Текст</button>
          <button onClick={() => setSelectedShape(NoteShapeType.Rectangle)} style={shapeBtnStyle}>Прямоугольник</button>
          <button onClick={() => setSelectedShape(NoteShapeType.Ellipse)} style={shapeBtnStyle}>Круг</button>
          <button onClick={() => setSelectedShape(NoteShapeType.Line)} style={shapeBtnStyle}>Линия</button>
        </div>
      )}

      {/* ОСТРОВ 1: ГЛАВНАЯ ПАНЕЛЬ ИНСТРУМЕНТОВ */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1E2330',
          border: '1px solid #334155',
          borderRadius: 28,
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          zIndex: 30,
        }}
      >
        <button onClick={undo} style={toolIconBtnStyle} title="Undo (Ctrl+Z)">↩</button>
        <button onClick={redo} style={toolIconBtnStyle} title="Redo (Ctrl+Y)">↪</button>

        <div style={{ width: 1, height: 24, background: '#334155' }} />

        <button
          onClick={() => setNoteEditMode('Select')}
          style={{ ...toolIconBtnStyle, color: noteEditMode === 'Select' ? '#3B82F6' : '#FFF' }}
          title="Select"
        >
          ↖
        </button>
        <button
          onClick={() => setNoteEditMode('Ink')}
          style={{ ...toolIconBtnStyle, color: noteEditMode === 'Ink' ? '#3B82F6' : '#FFF' }}
          title="Brush"
        >
          🖌
        </button>
        <button
          onClick={() => setNoteEditMode('Eraser')}
          style={{ ...toolIconBtnStyle, color: noteEditMode === 'Eraser' ? '#3B82F6' : '#FFF' }}
          title="Eraser"
        >
          ⌫
        </button>
        <button
          onClick={() => setNoteEditMode('Shape')}
          style={{ ...toolIconBtnStyle, color: noteEditMode === 'Shape' ? '#3B82F6' : '#FFF' }}
          title="Shapes"
        >
          ⬡
        </button>

        <div style={{ width: 1, height: 24, background: '#334155' }} />

        <button
          onClick={() => setBgType((prev) => (prev === 'Grid' ? 'Solid' : 'Grid'))}
          style={toolIconBtnStyle}
          title="Toggle Grid/Solid"
        >
          ▦
        </button>

        <button
          onClick={handleSave}
          style={{
            background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
            border: 'none',
            borderRadius: 18,
            width: 36,
            height: 36,
            color: '#FFF',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
          title="Save Note"
        >
          💾
        </button>
      </div>
    </div>
  );
};

const toolIconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#FFFFFF',
  fontSize: 16,
  cursor: 'pointer',
  padding: '6px 10px',
  borderRadius: 8,
};

const shapeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#FFF',
  fontSize: 12,
  padding: '6px 10px',
  cursor: 'pointer',
};