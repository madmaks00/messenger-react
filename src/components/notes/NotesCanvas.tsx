import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  mdiPalette,
  mdiShapePlus,
  mdiBrush,
  mdiEraser,
  mdiCursorDefaultOutline,
  mdiContentSaveOutline,
  mdiImagePlus,
  mdiUndo,
  mdiRedo,
  mdiCogOutline,
  mdiFormatText,
  mdiSquareOutline,
  mdiRectangleOutline,
  mdiTriangleOutline,
  mdiEllipseOutline,
  mdiVectorLine,
  mdiVectorPolyline,
  mdiContentCopy,
  mdiDeleteOutline,
  mdiPaletteOutline,
  mdiVectorSquare,
  mdiFormatLineWeight,
  mdiChevronRight,
  mdiFormatSize,
  mdiFormatColorText,
  mdiFormatColorFill,
  mdiFormatFont,
} from '@mdi/js';
import { useNotesStore } from '../../stores/notesStore';
import { NoteShapeType } from '../../types/enums';

const MdiIcon: React.FC<{ path: string; size?: number; color?: string; style?: React.CSSProperties }> = ({
  path,
  size = 20,
  color = 'currentColor',
  style,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill={color}
    style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle', ...style }}
  >
    <path d={path} />
  </svg>
);

// 🟢 Конвертер цвета: превращает WPF #AARRGGBB в CSS rgba()
function wpfColorToCss(colorStr: string | null | undefined): string {
  if (!colorStr) return 'transparent';
  const clean = colorStr.trim();
  if (clean === '' || clean.toLowerCase() === 'transparent') return 'transparent';

  if (clean.startsWith('#') && clean.length === 9) {
    const aa = clean.substring(1, 3);
    const rr = clean.substring(3, 5);
    const gg = clean.substring(5, 7);
    const bb = clean.substring(7, 9);
    const alpha = parseInt(aa, 16) / 255;
    return `rgba(${parseInt(rr, 16)}, ${parseInt(gg, 16)}, ${parseInt(bb, 16)}, ${alpha.toFixed(3)})`;
  }

  return clean;
}

// 🟢 Устраняет ошибку 431: понимает JPEG с "9j/" и без ведущего слэша
function formatBase64DataUrl(base64: string | null | undefined): string {
  if (!base64) return '';
  const trimmed = base64.trim();
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  // JPEG (начинается с 9j/ или /9j/)
  if (trimmed.startsWith('9j/') || trimmed.startsWith('/9j/') || trimmed.startsWith('9j') || trimmed.startsWith('/9j')) {
    return `data:image/jpeg;base64,${trimmed}`;
  }
  // PNG
  if (trimmed.startsWith('iVBORw0K') || trimmed.startsWith('iVBOR')) {
    return `data:image/png;base64,${trimmed}`;
  }
  // GIF
  if (trimmed.startsWith('R0lGOD')) {
    return `data:image/gif;base64,${trimmed}`;
  }
  // WebP
  if (trimmed.startsWith('UklGR')) {
    return `data:image/webp;base64,${trimmed}`;
  }
  // Универсальный fallback
  return `data:image/jpeg;base64,${trimmed}`;
}

// 🟢 Очищает префикс data:image/... перед сохранением для C# WPF Convert.FromBase64String
function stripDataUrlPrefix(urlOrBase64: string | null | undefined): string | null {
  if (!urlOrBase64) return null;
  return urlOrBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '').trim();
}

const DEFAULT_PALETTE_ROW1 = ['#000000', '#808080', '#FFFFFF', '#FF0000', '#FFA500'];
const DEFAULT_PALETTE_ROW2 = ['#FFFF00', '#008000', '#90EE90', '#0000FF', '#FF00FF'];

const SHAPE_FILL_OPTIONS = [
  { name: 'Прозрачный', color: 'transparent' },
  { name: 'Черный', color: '#000000' },
  { name: 'Белый', color: '#FFFFFF' },
  { name: 'Красный', color: '#FF0000' },
  { name: 'Оранжевый', color: '#FF8C00' },
  { name: 'Желтый', color: '#FFFF00' },
  { name: 'Зеленый', color: '#00FF00' },
  { name: 'Синий', color: '#0000FF' },
  { name: 'Фиолетовый', color: '#800080' },
];

const SHAPE_STROKE_OPTIONS = [
  { name: 'Черный', color: '#000000' },
  { name: 'Белый', color: '#FFFFFF' },
  { name: 'Красный', color: '#FF0000' },
  { name: 'Оранжевый', color: '#FF8C00' },
  { name: 'Желтый', color: '#FFFF00' },
  { name: 'Зеленый', color: '#00FF00' },
  { name: 'Синий', color: '#0000FF' },
  { name: 'Фиолетовый', color: '#800080' },
];

const SHAPE_THICKNESS_OPTIONS = [1, 2, 3, 5, 8, 12];
const TEXT_FONT_SIZES = [12, 14, 16, 20, 24, 32, 40, 48];
const TEXT_COLOR_OPTIONS = [
  { name: 'Белый', color: '#FFFFFF' },
  { name: 'Черный', color: '#000000' },
  { name: 'Красный', color: '#FF0000' },
  { name: 'Оранжевый', color: '#FF8C00' },
  { name: 'Желтый', color: '#FFFF00' },
  { name: 'Зеленый', color: '#00FF00' },
  { name: 'Синий', color: '#0000FF' },
  { name: 'Фиолетовый', color: '#800080' },
];
const TEXT_BG_OPTIONS = [
  { name: 'Прозрачный', color: 'transparent' },
  { name: 'Темный', color: '#1A202C' },
  { name: 'Белый', color: '#FFFFFF' },
  { name: 'Красный', color: '#FF0000' },
  { name: 'Синий', color: '#0000FF' },
];

interface ChildElementDto {
  id: string;
  elementType: 'Shape' | 'TextBox' | 'Image';
  shapeType?: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fillHex: string;
  strokeHex: string;
  strokeThickness: number;
  text?: string;
  fontSize?: number;
  foregroundHex?: string;
  backgroundHex?: string;
  isBold?: boolean;
  isItalic?: boolean;
  pointsData?: string;
  base64Data?: string;
}

interface CanvasStroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

interface CanvasState {
  strokes: CanvasStroke[];
  elements: ChildElementDto[];
  bgType: 'Grid' | 'Solid' | 'Image';
  bgColor: string;
  bgImage: string | null;
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

function distToSegment(p: { x: number; y: number }, v: { x: number; y: number }, w: { x: number; y: number }): number {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
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
    customBrushColorHex,
    isColorPickerOpen,
    setNoteTool,
    selectShape,
    resetShapeTool,
    setBrushSize,
    setBrushColor,
    setCustomColorHex,
    openCustomColorPicker,
    closeColorPicker,
    saveCurrentNoteInkData,
  } = useNotesStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [strokes, setStrokes] = useState<CanvasStroke[]>([]);
  const [elements, setElements] = useState<ChildElementDto[]>([]);
  const [bgType, setBgType] = useState<'Grid' | 'Solid' | 'Image'>('Grid');
  const [bgColor, setBgColor] = useState<string>('#00000000');
  const [bgImage, setBgImage] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const isInteracting = useRef(false);
  const currentPoints = useRef<{ x: number; y: number }[]>([]);
  const hasErasedInBatch = useRef(false);

  const isDraggingElement = useRef(false);
  const dragElementStart = useRef({ mouseX: 0, mouseY: 0, elLeft: 0, elTop: 0 });

  const activeHandle = useRef<ResizeHandle | null>(null);
  const resizeStart = useRef({ mouseX: 0, mouseY: 0, left: 0, top: 0, width: 0, height: 0 });

  const [isBgSettingsOpen, setIsBgSettingsOpen] = useState(false);
  const [isPenPopoverOpen, setIsPenPopoverOpen] = useState(false);
  const [isShapePopoverOpen, setIsShapePopoverOpen] = useState(false);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; element: ChildElementDto } | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const clipboardRef = useRef<ChildElementDto | null>(null);

  const historyRef = useRef<{
    past: CanvasState[];
    present: CanvasState;
    future: CanvasState[];
  }>({
    past: [],
    present: { strokes: [], elements: [], bgType: 'Grid', bgColor: '#00000000', bgImage: null },
    future: [],
  });

  const syncStateFromPresent = (state: CanvasState) => {
    setStrokes(state.strokes);
    setElements(state.elements);
    setBgType(state.bgType);
    setBgColor(state.bgColor);
    setBgImage(state.bgImage);
  };

  const pushSnapshot = useCallback((newState: CanvasState) => {
    historyRef.current.past.push(JSON.parse(JSON.stringify(historyRef.current.present)));
    historyRef.current.present = JSON.parse(JSON.stringify(newState));
    historyRef.current.future = [];
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.past.length === 0) return;
    const previous = historyRef.current.past.pop()!;
    historyRef.current.future.unshift(JSON.parse(JSON.stringify(historyRef.current.present)));
    historyRef.current.present = previous;
    syncStateFromPresent(previous);
  }, []);

  const redo = useCallback(() => {
    if (historyRef.current.future.length === 0) return;
    const next = historyRef.current.future.shift()!;
    historyRef.current.past.push(JSON.parse(JSON.stringify(historyRef.current.present)));
    historyRef.current.present = next;
    syncStateFromPresent(next);
  }, []);

  // 🟢 Отрисовка мазков с корректным парсингом цвета
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = wpfColorToCss(stroke.color); // Преобразуем цвет в валидный для Canvas
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

  // 🟢 Загрузка холста с распаковкой Base64 и нормализацией цветов WPF
  useEffect(() => {
    if (selectedNote?.inkData) {
      try {
        let jsonStr = selectedNote.inkData;

        if (typeof jsonStr === 'string' && !jsonStr.trim().startsWith('{')) {
          try {
            jsonStr = decodeURIComponent(escape(atob(jsonStr)));
          } catch {
            jsonStr = atob(jsonStr);
          }
        }

        const pkg = JSON.parse(jsonStr);

        const rawStrokes = pkg.strokes || pkg.Strokes || [];
        const parsedStrokes: CanvasStroke[] = rawStrokes.map((s: any) => ({
          color: wpfColorToCss(s.color || s.Color || '#000000'),
          width: s.width || s.Width || 3,
          points: (s.points || s.Points || []).map((p: any) => ({
            x: p.x ?? p.X ?? 0,
            y: p.y ?? p.Y ?? 0,
          })),
        }));

        const rawElements = pkg.elements || pkg.Children || [];
        const parsedElements: ChildElementDto[] = rawElements.map((el: any, idx: number) => ({
          id: el.id || `el_${idx}_${Date.now()}`,
          elementType: el.elementType || el.ElementType || 'Shape',
          shapeType: el.shapeType || el.ShapeType || 'Rectangle',
          left: el.left ?? el.Left ?? 0,
          top: el.top ?? el.Top ?? 0,
          width: el.width ?? el.Width ?? 100,
          height: el.height ?? el.Height ?? 80,
          fillHex: wpfColorToCss(el.fillHex || el.FillHex || '#00000000'),
          strokeHex: wpfColorToCss(el.strokeHex || el.StrokeHex || '#FFFFFFFF'),
          strokeThickness: el.strokeThickness ?? el.StrokeThickness ?? 2,
          text: el.text ?? el.Text ?? '',
          fontSize: el.fontSize ?? el.FontSize ?? 16,
          foregroundHex: wpfColorToCss(el.foregroundHex || el.ForegroundHex || '#FFFFFFFF'),
          backgroundHex: wpfColorToCss(el.backgroundHex || el.BackgroundHex || '#00000000'),
          isBold: Boolean(el.isBold ?? el.IsBold),
          isItalic: Boolean(el.isItalic ?? el.IsItalic),
          pointsData: el.pointsData || el.PointsData,
          base64Data: el.base64Data || el.Base64Data, // Сохраняем сырой Base64
        }));

        const initialState: CanvasState = {
          strokes: parsedStrokes,
          elements: parsedElements,
          bgType: pkg.bgType || pkg.BackgroundType || 'Grid',
          bgColor: wpfColorToCss(pkg.bgColor || pkg.BackgroundColorHex || '#00000000'),
          bgImage: pkg.bgImage || pkg.BackgroundImageBase64 || null,
        };

        syncStateFromPresent(initialState);
        historyRef.current = { past: [], present: initialState, future: [] };
      } catch (err) {
        console.error('[NotesCanvas] Ошибка распаковки InkData:', err);
        syncStateFromPresent({ strokes: [], elements: [], bgType: 'Grid', bgColor: '#00000000', bgImage: null });
      }
    } else {
      syncStateFromPresent({ strokes: [], elements: [], bgType: 'Grid', bgColor: '#00000000', bgImage: null });
      historyRef.current = {
        past: [],
        present: { strokes: [], elements: [], bgType: 'Grid', bgColor: '#00000000', bgImage: null },
        future: [],
      };
    }
  }, [selectedNote?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT') {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (isCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (isCtrl && e.key.toLowerCase() === 'c') {
        if (selectedId) {
          const el = elements.find((item) => item.id === selectedId);
          if (el) {
            clipboardRef.current = JSON.parse(JSON.stringify(el));
            e.preventDefault();
          }
        }
      } else if (isCtrl && e.key.toLowerCase() === 'v') {
        if (clipboardRef.current) {
          e.preventDefault();
          const clone: ChildElementDto = {
            ...JSON.parse(JSON.stringify(clipboardRef.current)),
            id: `el_${Date.now()}`,
            left: clipboardRef.current.left + 20,
            top: clipboardRef.current.top + 20,
          };
          const nextElements = [...elements, clone];
          setElements(nextElements);
          setSelectedId(clone.id);
          pushSnapshot({ ...historyRef.current.present, elements: nextElements });
          clipboardRef.current.left += 20;
          clipboardRef.current.top += 20;
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          e.preventDefault();
          const nextElements = elements.filter((item) => item.id !== selectedId);
          setElements(nextElements);
          setSelectedId(null);
          pushSnapshot({ ...historyRef.current.present, elements: nextElements });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, elements, undo, redo, pushSnapshot]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setContextMenu(null);
    setActiveSubmenu(null);

    if (e.button === 2) {
      isPanning.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (e.button !== 0) return;

    const rect = containerRef.current?.getBoundingClientRect();
    const canvasX = e.clientX - (rect?.left || 0) - panOffset.x;
    const canvasY = e.clientY - (rect?.top || 0) - panOffset.y;

    if (noteEditMode === 'Shape' && selectedShape !== NoteShapeType.None) {
      let shapeTypeName = 'Rectangle';
      let w = 150;
      let h = 80;

      switch (selectedShape) {
        case NoteShapeType.Square:
          shapeTypeName = 'Square';
          w = 80;
          h = 80;
          break;
        case NoteShapeType.Ellipse:
          shapeTypeName = 'Ellipse';
          w = 100;
          h = 60;
          break;
        case NoteShapeType.Triangle:
          shapeTypeName = 'Polygon';
          w = 100;
          h = 100;
          break;
        case NoteShapeType.Line:
          shapeTypeName = 'Line';
          w = 120;
          h = 80;
          break;
        case NoteShapeType.Polyline:
          shapeTypeName = 'Polyline';
          w = 150;
          h = 50;
          break;
      }

      const newEl: ChildElementDto = {
        id: `el_${Date.now()}`,
        elementType: selectedShape === NoteShapeType.Text ? 'TextBox' : 'Shape',
        shapeType: shapeTypeName,
        left: canvasX,
        top: canvasY,
        width: selectedShape === NoteShapeType.Text ? 160 : w,
        height: selectedShape === NoteShapeType.Text ? 45 : h,
        fillHex: '#00000000',
        strokeHex: brushColor,
        strokeThickness: brushSize,
        text: selectedShape === NoteShapeType.Text ? 'Текст' : '',
        fontSize: 16,
        foregroundHex: '#FFFFFFFF',
        backgroundHex: '#00000000',
      };

      const nextElements = [...elements, newEl];
      setElements(nextElements);
      setSelectedId(newEl.id);
      resetShapeTool();
      setIsShapePopoverOpen(false);
      pushSnapshot({ ...historyRef.current.present, elements: nextElements });
      return;
    }

    if (noteEditMode === 'Ink') {
      isInteracting.current = true;
      currentPoints.current = [{ x: canvasX, y: canvasY }];
      return;
    }

    if (noteEditMode === 'Eraser') {
      isInteracting.current = true;
      hasErasedInBatch.current = false;
      eraseAtPoint(canvasX, canvasY);
      return;
    }

    if (noteEditMode === 'Select') {
      setSelectedId(null);
    }
  };

  const eraseAtPoint = (cx: number, cy: number) => {
    const eraserRadius = Math.max(14, brushSize * 2);
    let hitAny = false;

    const remainingStrokes = strokes.filter((stroke) => {
      if (stroke.points.length === 1) {
        const hit = Math.hypot(stroke.points[0].x - cx, stroke.points[0].y - cy) <= eraserRadius;
        if (hit) hitAny = true;
        return !hit;
      }

      for (let i = 0; i < stroke.points.length - 1; i++) {
        const dist = distToSegment({ x: cx, y: cy }, stroke.points[i], stroke.points[i + 1]);
        if (dist <= eraserRadius + stroke.width / 2) {
          hitAny = true;
          return false;
        }
      }
      return true;
    });

    if (hitAny) {
      hasErasedInBatch.current = true;
      setStrokes(remainingStrokes);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    const canvasX = e.clientX - (rect?.left || 0) - panOffset.x;
    const canvasY = e.clientY - (rect?.top || 0) - panOffset.y;

    if (activeHandle.current && selectedId) {
      const handle = activeHandle.current;
      const { mouseX, mouseY, left, top, width, height } = resizeStart.current;
      const dx = e.clientX - mouseX;
      const dy = e.clientY - mouseY;

      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== selectedId) return el;

          let newL = left;
          let newT = top;
          let newW = width;
          let newH = height;

          if (handle.includes('e')) newW = Math.max(20, width + dx);
          if (handle.includes('s')) newH = Math.max(20, height + dy);
          if (handle.includes('w')) {
            const potentialW = width - dx;
            if (potentialW > 20) {
              newW = potentialW;
              newL = left + dx;
            }
          }
          if (handle.includes('n')) {
            const potentialH = height - dy;
            if (potentialH > 20) {
              newH = potentialH;
              newT = top + dy;
            }
          }

          return { ...el, left: newL, top: newT, width: newW, height: newH };
        })
      );
      return;
    }

    if (isDraggingElement.current && selectedId) {
      const dx = e.clientX - dragElementStart.current.mouseX;
      const dy = e.clientY - dragElementStart.current.mouseY;
      setElements((prev) =>
        prev.map((el) =>
          el.id === selectedId
            ? { ...el, left: dragElementStart.current.elLeft + dx, top: dragElementStart.current.elTop + dy }
            : el
        )
      );
      return;
    }

    if (isInteracting.current && noteEditMode === 'Ink') {
      currentPoints.current.push({ x: canvasX, y: canvasY });

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && currentPoints.current.length >= 2) {
        const p1 = currentPoints.current[currentPoints.current.length - 2];
        const p2 = currentPoints.current[currentPoints.current.length - 1];
        ctx.beginPath();
        ctx.strokeStyle = wpfColorToCss(brushColor);
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      return;
    }

    if (isInteracting.current && noteEditMode === 'Eraser') {
      eraseAtPoint(canvasX, canvasY);
    }
  };

  const handleMouseUp = () => {
    if (isPanning.current) isPanning.current = false;

    if (activeHandle.current) {
      activeHandle.current = null;
      pushSnapshot({ ...historyRef.current.present, elements });
      return;
    }

    if (isDraggingElement.current) {
      isDraggingElement.current = false;
      pushSnapshot({ ...historyRef.current.present, elements });
      return;
    }

    if (isInteracting.current && noteEditMode === 'Ink') {
      isInteracting.current = false;
      if (currentPoints.current.length > 1) {
        const newStrokes = [...strokes, { points: [...currentPoints.current], color: brushColor, width: brushSize }];
        setStrokes(newStrokes);
        pushSnapshot({ ...historyRef.current.present, strokes: newStrokes });
      }
      currentPoints.current = [];
      return;
    }

    if (isInteracting.current && noteEditMode === 'Eraser') {
      isInteracting.current = false;
      if (hasErasedInBatch.current) {
        hasErasedInBatch.current = false;
        pushSnapshot({ ...historyRef.current.present, strokes });
      }
    }
  };

  const handleResizeStart = (e: React.MouseEvent, handle: ResizeHandle, el: ChildElementDto) => {
    e.stopPropagation();
    e.preventDefault();
    activeHandle.current = handle;
    resizeStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      left: el.left,
      top: el.top,
      width: el.width,
      height: el.height,
    };
  };

  const handleElementMouseDown = (e: React.MouseEvent, el: ChildElementDto) => {
    if (e.button === 2) {
      e.stopPropagation();
      e.preventDefault();
      setSelectedId(el.id);
      const rect = containerRef.current?.getBoundingClientRect();
      setContextMenu({
        x: e.clientX - (rect?.left || 0),
        y: e.clientY - (rect?.top || 0),
        element: el,
      });
      setActiveSubmenu(null);
      return;
    }

    if (e.button !== 0 || noteEditMode !== 'Select') return;
    e.stopPropagation();
    setSelectedId(el.id);
    isDraggingElement.current = true;
    dragElementStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      elLeft: el.left,
      elTop: el.top,
    };
  };

  // 🟢 Сохранение: формирует пакет для C# WPF и ASP.NET Core
  const handleSave = () => {
    const pkg = {
      Strokes: historyRef.current.present.strokes.map((s) => ({
        Color: s.color,
        Width: s.width,
        Points: s.points.map((p) => ({ X: p.x, Y: p.y })),
      })),
      strokes: historyRef.current.present.strokes,
      Children: historyRef.current.present.elements.map((el) => ({
        ElementType: el.elementType,
        ShapeType: el.shapeType,
        Left: el.left,
        Top: el.top,
        Width: el.width,
        Height: el.height,
        FillHex: el.fillHex,
        StrokeHex: el.strokeHex,
        StrokeThickness: el.strokeThickness,
        Text: el.text,
        FontSize: el.fontSize,
        ForegroundHex: el.foregroundHex,
        BackgroundHex: el.backgroundHex,
        IsBold: el.isBold,
        IsItalic: el.isItalic,
        Base64Data: stripDataUrlPrefix(el.base64Data), // Очищаем для C# WPF Convert.FromBase64String
      })),
      elements: historyRef.current.present.elements,
      BackgroundType: historyRef.current.present.bgType,
      BackgroundColorHex: historyRef.current.present.bgColor,
      BackgroundImageBase64: stripDataUrlPrefix(historyRef.current.present.bgImage),
    };

    const jsonStr = JSON.stringify(pkg);
    const base64Str = btoa(unescape(encodeURIComponent(jsonStr)));
    saveCurrentNoteInkData(base64Str);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const rawBase64 = stripDataUrlPrefix(dataUrl);

      const newImg: ChildElementDto = {
        id: `img_${Date.now()}`,
        elementType: 'Image',
        left: 80 - panOffset.x,
        top: 80 - panOffset.y,
        width: 320,
        height: 220,
        fillHex: '#00000000',
        strokeHex: '#00000000',
        strokeThickness: 0,
        base64Data: rawBase64 || '',
      };
      const nextElements = [...elements, newImg];
      setElements(nextElements);
      setSelectedId(newImg.id);
      pushSnapshot({ ...historyRef.current.present, elements: nextElements });
      setNoteTool('Select');
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateSelectedElement = (updater: (el: ChildElementDto) => Partial<ChildElementDto>) => {
    if (!contextMenu) return;
    const nextElements = elements.map((el) => (el.id === contextMenu.element.id ? { ...el, ...updater(el) } : el));
    setElements(nextElements);
    pushSnapshot({ ...historyRef.current.present, elements: nextElements });
    setContextMenu(null);
    setActiveSubmenu(null);
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
        backgroundColor: bgType === 'Solid' ? bgColor : '#11141B',
        backgroundImage:
          bgType === 'Grid'
            ? 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)'
            : bgType === 'Image' && bgImage
            ? `url(${formatBase64DataUrl(bgImage)})`
            : 'none',
        backgroundSize: bgType === 'Grid' ? '40px 40px' : 'cover',
        cursor: isPanning.current
          ? 'all-scroll'
          : noteEditMode === 'Eraser'
          ? 'crosshair'
          : noteEditMode === 'Ink'
          ? 'crosshair'
          : 'default',
        userSelect: 'none',
      }}
    >
      <style>{`
        .wpf-tool-btn {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: transparent;
          border: none;
          color: #94A3B8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition: all 0.15s ease;
        }
        .wpf-tool-btn:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          color: #F8FAFC !important;
        }
        .wpf-tool-btn:active {
          transform: scale(0.95);
          background: rgba(255, 255, 255, 0.05) !important;
        }
        .wpf-tool-btn.active {
          background: #3B82F6 !important;
          color: #FFFFFF !important;
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.5);
        }

        .wpf-shape-btn {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: #94A3B8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition: all 0.15s ease;
        }
        .wpf-shape-btn:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          color: #FFFFFF !important;
        }
        .wpf-shape-btn:active {
          transform: scale(0.95);
        }

        .wpf-color-swatch {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .wpf-color-swatch:hover {
          transform: scale(1.18);
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
        }

        .wpf-save-btn {
          transition: all 0.15s ease;
        }
        .wpf-save-btn:hover {
          opacity: 0.92;
          transform: scale(1.05);
          box-shadow: 0 0 14px rgba(96, 165, 250, 0.6);
        }
        .wpf-save-btn:active {
          transform: scale(0.95);
        }

        .wpf-canvas-element-hover {
          transition: outline 0.12s ease;
        }
        .wpf-canvas-element-hover:hover {
          outline: 1px dashed rgba(59, 130, 246, 0.5);
        }

        .wpf-menu-item-row {
          padding: 8px 15px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          border-radius: 6px;
          margin: 1px 4px;
          transition: background-color 0.12s ease;
          color: #FFFFFF;
          font-size: 14px;
        }
        .wpf-menu-item-row:hover {
          background-color: #232A3B;
        }

        .wpf-menu-parent-row {
          padding: 8px 10px 8px 15px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-radius: 6px;
          margin: 1px 4px;
          position: relative;
          color: #FFFFFF;
          font-size: 14px;
          transition: background-color 0.12s ease;
        }
        .wpf-menu-parent-row:hover {
          background-color: #232A3B;
        }
      `}</style>

      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleImageUpload} />

      {/* ВИРТУАЛЬНЫЙ СЛОЙ ХОЛСТА (3000x3000px) */}
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

        {elements.map((el) => {
          const isSelected = selectedId === el.id;

          return (
            <div
              key={el.id}
              className="wpf-canvas-element-hover"
              onMouseDown={(e) => handleElementMouseDown(e, el)}
              style={{
                position: 'absolute',
                left: el.left,
                top: el.top,
                width: el.width,
                height: el.height,
                cursor: noteEditMode === 'Select' ? 'move' : 'default',
                boxSizing: 'border-box',
              }}
            >
              {/* 🟢 РЕНДЕР КАРТИНКИ ЧЕРЕЗ formatBase64DataUrl (устраняет HTTP 431) */}
              {el.elementType === 'Image' && el.base64Data && (
                <img
                  src={formatBase64DataUrl(el.base64Data)}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    pointerEvents: 'none',
                  }}
                />
              )}

              {/* РЕНДЕР ТЕКСТА */}
              {el.elementType === 'TextBox' && (
                <textarea
                  defaultValue={el.text}
                  onChange={(e) => {
                    el.text = e.target.value;
                  }}
                  onBlur={() => pushSnapshot({ ...historyRef.current.present, elements })}
                  style={{
                    width: '100%',
                    height: '100%',
                    background: el.backgroundHex || 'transparent',
                    border: '1px dashed rgba(120,120,120,0.5)',
                    color: el.foregroundHex || '#FFFFFF',
                    fontSize: el.fontSize || 16,
                    fontWeight: el.isBold ? 'bold' : 'normal',
                    fontStyle: el.isItalic ? 'italic' : 'normal',
                    resize: 'none',
                    outline: 'none',
                    padding: 4,
                    boxSizing: 'border-box',
                  }}
                />
              )}

              {/* РЕНДЕР ФИГУР */}
              {el.elementType === 'Shape' && (
                <svg
                  width="100%"
                  height="100%"
                  style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}
                >
                  {(el.shapeType === 'Rectangle' || el.shapeType === 'Square') && (
                    <rect
                      x={el.strokeThickness / 2}
                      y={el.strokeThickness / 2}
                      width={Math.max(1, el.width - el.strokeThickness)}
                      height={Math.max(1, el.height - el.strokeThickness)}
                      fill={el.fillHex}
                      stroke={el.strokeHex}
                      strokeWidth={el.strokeThickness}
                    />
                  )}

                  {el.shapeType === 'Ellipse' && (
                    <ellipse
                      cx={el.width / 2}
                      cy={el.height / 2}
                      rx={Math.max(1, el.width / 2 - el.strokeThickness / 2)}
                      ry={Math.max(1, el.height / 2 - el.strokeThickness / 2)}
                      fill={el.fillHex}
                      stroke={el.strokeHex}
                      strokeWidth={el.strokeThickness}
                    />
                  )}

                  {(el.shapeType === 'Polygon' || el.shapeType === 'Triangle') && (
                    <polygon
                      points={`${el.width / 2},${el.strokeThickness / 2} ${el.strokeThickness / 2},${el.height - el.strokeThickness / 2} ${el.width - el.strokeThickness / 2},${el.height - el.strokeThickness / 2}`}
                      fill={el.fillHex}
                      stroke={el.strokeHex}
                      strokeWidth={el.strokeThickness}
                      strokeLinejoin="round"
                    />
                  )}

                  {el.shapeType === 'Line' && (
                    <line
                      x1={0}
                      y1={0}
                      x2={el.width}
                      y2={el.height}
                      stroke={el.strokeHex}
                      strokeWidth={el.strokeThickness}
                      strokeLinecap="round"
                    />
                  )}

                  {el.shapeType === 'Polyline' && (
                    <polyline
                      points={`0,0 ${el.width * 0.33},${el.height} ${el.width * 0.66},0 ${el.width},${el.height}`}
                      fill="none"
                      stroke={el.strokeHex}
                      strokeWidth={el.strokeThickness}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </svg>
              )}

              {/* 8 ТОЧЕК МАСШТАБИРОВАНИЯ */}
              {isSelected && noteEditMode === 'Select' && (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      inset: -2,
                      border: '1.5px dashed #3B82F6',
                      pointerEvents: 'none',
                    }}
                  />
                  {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as ResizeHandle[]).map((handle) => {
                    const posStyle: React.CSSProperties = {
                      position: 'absolute',
                      width: 8,
                      height: 8,
                      backgroundColor: '#FFFFFF',
                      border: '1.5px solid #3B82F6',
                      borderRadius: 1,
                      boxSizing: 'border-box',
                      zIndex: 10,
                    };

                    if (handle.includes('n')) posStyle.top = -4;
                    if (handle.includes('s')) posStyle.bottom = -4;
                    if (handle.includes('w')) posStyle.left = -4;
                    if (handle.includes('e')) posStyle.right = -4;
                    if (handle === 'n' || handle === 's') posStyle.left = 'calc(50% - 4px)';
                    if (handle === 'w' || handle === 'e') posStyle.top = 'calc(50% - 4px)';

                    const cursorMap: Record<ResizeHandle, string> = {
                      nw: 'nwse-resize',
                      se: 'nwse-resize',
                      ne: 'nesw-resize',
                      sw: 'nesw-resize',
                      n: 'ns-resize',
                      s: 'ns-resize',
                      w: 'ew-resize',
                      e: 'ew-resize',
                    };

                    return (
                      <div
                        key={handle}
                        onMouseDown={(e) => handleResizeStart(e, handle, el)}
                        style={{ ...posStyle, cursor: cursorMap[handle] }}
                      />
                    );
                  })}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ОСТРОВ 2: КИСТЬ И ПАЛИТРА */}
      {isPenPopoverOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 75,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(22, 26, 35, 0.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
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
              style={{ width: 70, accentColor: '#3B82F6', cursor: 'pointer' }}
            />
          </div>

          <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.2)' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
            {DEFAULT_PALETTE_ROW1.map((c) => (
              <div
                key={c}
                className="wpf-color-swatch"
                onClick={() => setBrushColor(c)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  background: c,
                  cursor: 'pointer',
                  border: brushColor === c ? '2px solid #3B82F6' : '1px solid rgba(255,255,255,0.2)',
                  boxSizing: 'border-box',
                }}
              />
            ))}
            <div
              className="wpf-color-swatch"
              onClick={() => openCustomColorPicker(1)}
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                background: customColor1,
                cursor: 'pointer',
                border: '1px dashed #FFF',
                boxSizing: 'border-box',
              }}
              title="Custom 1"
            />
            {DEFAULT_PALETTE_ROW2.map((c) => (
              <div
                key={c}
                className="wpf-color-swatch"
                onClick={() => setBrushColor(c)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  background: c,
                  cursor: 'pointer',
                  border: brushColor === c ? '2px solid #3B82F6' : '1px solid rgba(255,255,255,0.2)',
                  boxSizing: 'border-box',
                }}
              />
            ))}
            <div
              className="wpf-color-swatch"
              onClick={() => openCustomColorPicker(2)}
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                background: customColor2,
                cursor: 'pointer',
                border: '1px dashed #FFF',
                boxSizing: 'border-box',
              }}
              title="Custom 2"
            />
          </div>

          <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.2)' }} />

          <div
            className="wpf-color-swatch"
            onClick={() => openCustomColorPicker(1)}
            title="Custom HEX Color"
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MdiIcon path={mdiPalette} size={18} color="#FFF" />
          </div>
        </div>
      )}

      {/* ОСТРОВ 3: ВЫБОР ФИГУР */}
      {isShapePopoverOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 75,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(22, 26, 35, 0.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 24,
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            zIndex: 30,
          }}
        >
          <button onClick={() => selectShape(NoteShapeType.Text)} className="wpf-shape-btn" title="Текст">
            <MdiIcon path={mdiFormatText} size={20} color="#FFF" />
          </button>
          <button onClick={() => selectShape(NoteShapeType.Square)} className="wpf-shape-btn" title="Квадрат">
            <MdiIcon path={mdiSquareOutline} size={20} color="#FFF" />
          </button>
          <button onClick={() => selectShape(NoteShapeType.Rectangle)} className="wpf-shape-btn" title="Прямоугольник">
            <MdiIcon path={mdiRectangleOutline} size={20} color="#FFF" />
          </button>
          <button onClick={() => selectShape(NoteShapeType.Triangle)} className="wpf-shape-btn" title="Треугольник">
            <MdiIcon path={mdiTriangleOutline} size={20} color="#FFF" />
          </button>
          <button onClick={() => selectShape(NoteShapeType.Ellipse)} className="wpf-shape-btn" title="Овал">
            <MdiIcon path={mdiEllipseOutline} size={20} color="#FFF" />
          </button>
          <button onClick={() => selectShape(NoteShapeType.Line)} className="wpf-shape-btn" title="Линия">
            <MdiIcon path={mdiVectorLine} size={20} color="#FFF" />
          </button>
          <button onClick={() => selectShape(NoteShapeType.Polyline)} className="wpf-shape-btn" title="Полилиния">
            <MdiIcon path={mdiVectorPolyline} size={20} color="#FFF" />
          </button>
        </div>
      )}

      {/* ОСТРОВ 1: ГЛАВНАЯ ПАНЕЛЬ ИНСТРУМЕНТОВ */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(22, 26, 35, 0.85)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 28,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          zIndex: 30,
        }}
      >
        <button
          onClick={() => setIsBgSettingsOpen(!isBgSettingsOpen)}
          className="wpf-tool-btn"
          title="Настройки фона холста"
        >
          <MdiIcon path={mdiCogOutline} size={22} color="currentColor" />
        </button>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />

        <button onClick={undo} className="wpf-tool-btn" title="Undo (Ctrl+Z)">
          <MdiIcon path={mdiUndo} size={22} color="currentColor" />
        </button>
        <button onClick={redo} className="wpf-tool-btn" title="Redo (Ctrl+Y)">
          <MdiIcon path={mdiRedo} size={22} color="currentColor" />
        </button>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />

        <button
          onClick={() => setNoteTool('Select')}
          className={`wpf-tool-btn ${noteEditMode === 'Select' ? 'active' : ''}`}
          title="Выбор / Курсор"
        >
          <MdiIcon path={mdiCursorDefaultOutline} size={22} color="currentColor" />
        </button>

        <button
          onClick={() => setNoteTool('Ink')}
          className={`wpf-tool-btn ${noteEditMode === 'Ink' ? 'active' : ''}`}
          title="Кисть"
        >
          <MdiIcon path={mdiBrush} size={22} color="currentColor" />
        </button>

        <button
          onClick={() => setNoteTool('Eraser')}
          className={`wpf-tool-btn ${noteEditMode === 'Eraser' ? 'active' : ''}`}
          title="Ластик"
        >
          <MdiIcon path={mdiEraser} size={22} color="currentColor" />
        </button>

        <button
          onClick={() => setIsPenPopoverOpen(!isPenPopoverOpen)}
          className={`wpf-tool-btn ${isPenPopoverOpen ? 'active' : ''}`}
          title="Палитра"
        >
          <MdiIcon path={mdiPalette} size={22} color="currentColor" />
        </button>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />

        <button
          onClick={() => setIsShapePopoverOpen(!isShapePopoverOpen)}
          className={`wpf-tool-btn ${isShapePopoverOpen ? 'active' : ''}`}
          title="Фигуры"
        >
          <MdiIcon path={mdiShapePlus} size={22} color="currentColor" />
        </button>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />

        <button onClick={() => fileInputRef.current?.click()} className="wpf-tool-btn" title="Вставить изображение">
          <MdiIcon path={mdiImagePlus} size={22} color="currentColor" />
        </button>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />

        <button
          onClick={handleSave}
          className="wpf-save-btn"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #60A5FA, #2563EB)',
            border: 'none',
            color: '#FFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Сохранить заметку"
        >
          <MdiIcon path={mdiContentSaveOutline} size={20} color="#FFF" />
        </button>
      </div>

      {/* Настройки фона */}
      {isBgSettingsOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: '30%',
            background: '#161A23',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 18,
            padding: 15,
            zIndex: 40,
            width: 250,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 'bold', color: '#FFF', textAlign: 'center' }}>Фон холста</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setBgType('Grid');
                  pushSnapshot({ ...historyRef.current.present, bgType: 'Grid' });
                }}
                className="wpf-shape-btn"
                style={{ flex: 1, padding: 6, background: '#22FFFFFF', border: 'none', color: '#FFF', borderRadius: 4, width: 'auto' }}
              >
                Сетка
              </button>
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (ev) => {
                    const file = (ev.target as HTMLInputElement).files?.[0];
                    if (file) {
                      const r = new FileReader();
                      r.onload = () => {
                        const imgBase = r.result as string;
                        setBgImage(imgBase);
                        setBgType('Image');
                        pushSnapshot({ ...historyRef.current.present, bgType: 'Image', bgImage: imgBase });
                      };
                      r.readAsDataURL(file);
                    }
                  };
                  input.click();
                }}
                className="wpf-shape-btn"
                style={{ flex: 1, padding: 6, background: '#22FFFFFF', border: 'none', color: '#FFF', borderRadius: 4, width: 'auto' }}
              >
                Картинка...
              </button>
            </div>
            <span style={{ fontSize: 12, color: '#7D8494', textAlign: 'center' }}>Заливка цветом</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
              {['#000000', '#808080', '#FFFFFF', '#FF0000', '#FFA500', '#FFFF00', '#008000', '#90EE90', '#0000FF', '#FF00FF'].map((c) => (
                <div
                  key={c}
                  className="wpf-color-swatch"
                  onClick={() => {
                    setBgColor(c);
                    setBgType('Solid');
                    pushSnapshot({ ...historyRef.current.present, bgType: 'Solid', bgColor: c });
                  }}
                  style={{ width: 28, height: 28, borderRadius: 14, background: c, cursor: 'pointer' }}
                />
              ))}
            </div>
            <button
              onClick={() => {
                setBgType('Grid');
                setBgImage(null);
                pushSnapshot({ ...historyRef.current.present, bgType: 'Grid', bgImage: null });
              }}
              style={{ background: 'transparent', border: 'none', color: '#FF3B30', fontSize: 12, cursor: 'pointer', padding: '4px 0' }}
            >
              Сбросить фон
            </button>
          </div>
        </div>
      )}

      {/* Поповер выбора цвета кастомной кисти */}
      {isColorPickerOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 140,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1E232E',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 12,
            padding: 15,
            zIndex: 40,
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 'bold', color: '#FFF' }}>Choose Custom Color</span>
            <input
              type="color"
              value={customBrushColorHex.length === 7 ? customBrushColorHex : '#FF0000'}
              onChange={(e) => setCustomColorHex(e.target.value)}
              style={{ width: 160, height: 40, cursor: 'pointer', background: 'transparent', border: 'none' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#888' }}>HEX:</span>
              <input
                type="text"
                value={customBrushColorHex}
                onChange={(e) => setCustomColorHex(e.target.value)}
                style={{
                  width: 90,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 4,
                  color: '#FFF',
                  padding: '4px 6px',
                  fontFamily: 'monospace',
                }}
              />
              <button
                onClick={closeColorPicker}
                style={{
                  background: '#3B82F6',
                  border: 'none',
                  borderRadius: 4,
                  color: '#FFF',
                  padding: '4px 10px',
                  cursor: 'pointer',
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* КОНТЕКСТНОЕ МЕНЮ (1 в 1 с WPF) */}
      {contextMenu && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: Math.min(contextMenu.x, (containerRef.current?.clientWidth || 800) - 240),
            top: Math.min(contextMenu.y, (containerRef.current?.clientHeight || 600) - 260),
            background: '#1C212D',
            border: '1px solid #2A303C',
            borderRadius: 12,
            padding: '4px 0',
            zIndex: 100,
            minWidth: 220,
            boxShadow: '0 15px 35px rgba(0,0,0,0.6)',
            color: '#FFFFFF',
            fontSize: 14,
          }}
        >
          {contextMenu.element.elementType === 'Shape' && (
            <>
              {/* 1. Цвет заливки */}
              <div
                onMouseEnter={() => setActiveSubmenu('fill')}
                className="wpf-menu-parent-row"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <MdiIcon path={mdiPaletteOutline} size={18} color="#FFFFFF" />
                  <span>Цвет заливки</span>
                </div>
                <MdiIcon path={mdiChevronRight} size={18} color="#7D8494" />

                {activeSubmenu === 'fill' && (
                  <div style={submenuContainerStyle}>
                    {SHAPE_FILL_OPTIONS.map((item) => (
                      <div
                        key={item.color}
                        onClick={() => updateSelectedElement(() => ({ fillHex: item.color }))}
                        className="wpf-menu-item-row"
                      >
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 7,
                            backgroundColor: item.color,
                            border: '1px solid rgba(255,255,255,0.4)',
                          }}
                        />
                        <span>{item.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Цвет контура */}
              <div
                onMouseEnter={() => setActiveSubmenu('stroke')}
                className="wpf-menu-parent-row"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <MdiIcon path={mdiVectorSquare} size={18} color="#FFFFFF" />
                  <span>Цвет контура</span>
                </div>
                <MdiIcon path={mdiChevronRight} size={18} color="#7D8494" />

                {activeSubmenu === 'stroke' && (
                  <div style={submenuContainerStyle}>
                    {SHAPE_STROKE_OPTIONS.map((item) => (
                      <div
                        key={item.color}
                        onClick={() => updateSelectedElement(() => ({ strokeHex: item.color }))}
                        className="wpf-menu-item-row"
                      >
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 7,
                            backgroundColor: item.color,
                            border: '1px solid rgba(255,255,255,0.4)',
                          }}
                        />
                        <span>{item.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Толщина контура */}
              <div
                onMouseEnter={() => setActiveSubmenu('thickness')}
                className="wpf-menu-parent-row"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <MdiIcon path={mdiFormatLineWeight} size={18} color="#FFFFFF" />
                  <span>Толщина контура</span>
                </div>
                <MdiIcon path={mdiChevronRight} size={18} color="#7D8494" />

                {activeSubmenu === 'thickness' && (
                  <div style={submenuContainerStyle}>
                    {SHAPE_THICKNESS_OPTIONS.map((th) => (
                      <div
                        key={th}
                        onClick={() => updateSelectedElement(() => ({ strokeThickness: th }))}
                        className="wpf-menu-item-row"
                        style={{
                          fontWeight: contextMenu.element.strokeThickness === th ? 'bold' : 'normal',
                          color: contextMenu.element.strokeThickness === th ? '#3B82F6' : '#FFFFFF',
                        }}
                      >
                        <span>{th} px</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={separatorStyle} />

              <div
                onMouseEnter={() => setActiveSubmenu(null)}
                onClick={() => {
                  const clone: ChildElementDto = {
                    ...JSON.parse(JSON.stringify(contextMenu.element)),
                    id: `el_${Date.now()}`,
                    left: contextMenu.element.left + 20,
                    top: contextMenu.element.top + 20,
                  };
                  const nextElements = [...elements, clone];
                  setElements(nextElements);
                  setSelectedId(clone.id);
                  pushSnapshot({ ...historyRef.current.present, elements: nextElements });
                  setContextMenu(null);
                }}
                className="wpf-menu-item-row"
              >
                <MdiIcon path={mdiContentCopy} size={18} color="#FFFFFF" />
                <span>Копировать фигуру</span>
              </div>

              <div
                onMouseEnter={() => setActiveSubmenu(null)}
                onClick={() => {
                  const nextElements = elements.filter((el) => el.id !== contextMenu.element.id);
                  setElements(nextElements);
                  setSelectedId(null);
                  pushSnapshot({ ...historyRef.current.present, elements: nextElements });
                  setContextMenu(null);
                }}
                className="wpf-menu-item-row"
                style={{ color: '#FF3B30' }}
              >
                <MdiIcon path={mdiDeleteOutline} size={18} color="#FF3B30" />
                <span>Удалить фигуру</span>
              </div>
            </>
          )}

          {contextMenu.element.elementType === 'TextBox' && (
            <>
              {/* Размер шрифта */}
              <div
                onMouseEnter={() => setActiveSubmenu('fontSize')}
                className="wpf-menu-parent-row"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <MdiIcon path={mdiFormatSize} size={18} color="#FFFFFF" />
                  <span>Размер шрифта</span>
                </div>
                <MdiIcon path={mdiChevronRight} size={18} color="#7D8494" />

                {activeSubmenu === 'fontSize' && (
                  <div style={submenuContainerStyle}>
                    {TEXT_FONT_SIZES.map((sz) => (
                      <div
                        key={sz}
                        onClick={() => updateSelectedElement(() => ({ fontSize: sz }))}
                        className="wpf-menu-item-row"
                        style={{
                          fontWeight: (contextMenu.element.fontSize || 16) === sz ? 'bold' : 'normal',
                          color: (contextMenu.element.fontSize || 16) === sz ? '#3B82F6' : '#FFFFFF',
                        }}
                      >
                        <span>{sz} pt</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Цвет текста */}
              <div
                onMouseEnter={() => setActiveSubmenu('textColor')}
                className="wpf-menu-parent-row"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <MdiIcon path={mdiFormatColorText} size={18} color="#FFFFFF" />
                  <span>Цвет текста</span>
                </div>
                <MdiIcon path={mdiChevronRight} size={18} color="#7D8494" />

                {activeSubmenu === 'textColor' && (
                  <div style={submenuContainerStyle}>
                    {TEXT_COLOR_OPTIONS.map((item) => (
                      <div
                        key={item.color}
                        onClick={() => updateSelectedElement(() => ({ foregroundHex: item.color }))}
                        className="wpf-menu-item-row"
                      >
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 7,
                            backgroundColor: item.color,
                            border: '1px solid rgba(255,255,255,0.4)',
                          }}
                        />
                        <span>{item.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Фон блока */}
              <div
                onMouseEnter={() => setActiveSubmenu('textBg')}
                className="wpf-menu-parent-row"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <MdiIcon path={mdiFormatColorFill} size={18} color="#FFFFFF" />
                  <span>Фон блока</span>
                </div>
                <MdiIcon path={mdiChevronRight} size={18} color="#7D8494" />

                {activeSubmenu === 'textBg' && (
                  <div style={submenuContainerStyle}>
                    {TEXT_BG_OPTIONS.map((item) => (
                      <div
                        key={item.color}
                        onClick={() => updateSelectedElement(() => ({ backgroundHex: item.color }))}
                        className="wpf-menu-item-row"
                      >
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 7,
                            backgroundColor: item.color,
                            border: '1px solid rgba(255,255,255,0.4)',
                          }}
                        />
                        <span>{item.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Стиль текста */}
              <div
                onMouseEnter={() => setActiveSubmenu('textStyle')}
                className="wpf-menu-parent-row"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <MdiIcon path={mdiFormatFont} size={18} color="#FFFFFF" />
                  <span>Стиль текста</span>
                </div>
                <MdiIcon path={mdiChevronRight} size={18} color="#7D8494" />

                {activeSubmenu === 'textStyle' && (
                  <div style={submenuContainerStyle}>
                    <div
                      onClick={() => updateSelectedElement((el) => ({ isBold: !el.isBold }))}
                      className="wpf-menu-item-row"
                      style={{
                        fontWeight: 'bold',
                        color: contextMenu.element.isBold ? '#3B82F6' : '#FFFFFF',
                      }}
                    >
                      <span>Полужирный (Bold)</span>
                    </div>
                    <div
                      onClick={() => updateSelectedElement((el) => ({ isItalic: !el.isItalic }))}
                      className="wpf-menu-item-row"
                      style={{
                        fontStyle: 'italic',
                        color: contextMenu.element.isItalic ? '#3B82F6' : '#FFFFFF',
                      }}
                    >
                      <span>Курсив (Italic)</span>
                    </div>
                  </div>
                )}
              </div>

              <div style={separatorStyle} />

              <div
                onMouseEnter={() => setActiveSubmenu(null)}
                onClick={() => {
                  const clone: ChildElementDto = {
                    ...JSON.parse(JSON.stringify(contextMenu.element)),
                    id: `el_${Date.now()}`,
                    left: contextMenu.element.left + 20,
                    top: contextMenu.element.top + 20,
                  };
                  const nextElements = [...elements, clone];
                  setElements(nextElements);
                  setSelectedId(clone.id);
                  pushSnapshot({ ...historyRef.current.present, elements: nextElements });
                  setContextMenu(null);
                }}
                className="wpf-menu-item-row"
              >
                <MdiIcon path={mdiContentCopy} size={18} color="#FFFFFF" />
                <span>Копировать блок</span>
              </div>

              <div
                onMouseEnter={() => setActiveSubmenu(null)}
                onClick={() => {
                  const nextElements = elements.filter((el) => el.id !== contextMenu.element.id);
                  setElements(nextElements);
                  setSelectedId(null);
                  pushSnapshot({ ...historyRef.current.present, elements: nextElements });
                  setContextMenu(null);
                }}
                className="wpf-menu-item-row"
                style={{ color: '#FF3B30' }}
              >
                <MdiIcon path={mdiDeleteOutline} size={18} color="#FF3B30" />
                <span>Удалить текст</span>
              </div>
            </>
          )}

          {contextMenu.element.elementType === 'Image' && (
            <>
              <div
                onClick={() => {
                  const clone: ChildElementDto = {
                    ...JSON.parse(JSON.stringify(contextMenu.element)),
                    id: `img_${Date.now()}`,
                    left: contextMenu.element.left + 20,
                    top: contextMenu.element.top + 20,
                  };
                  const nextElements = [...elements, clone];
                  setElements(nextElements);
                  setSelectedId(clone.id);
                  pushSnapshot({ ...historyRef.current.present, elements: nextElements });
                  setContextMenu(null);
                }}
                className="wpf-menu-item-row"
              >
                <MdiIcon path={mdiContentCopy} size={18} color="#FFFFFF" />
                <span>Копировать картинку</span>
              </div>

              <div
                onClick={() => {
                  const nextElements = elements.filter((el) => el.id !== contextMenu.element.id);
                  setElements(nextElements);
                  setSelectedId(null);
                  pushSnapshot({ ...historyRef.current.present, elements: nextElements });
                  setContextMenu(null);
                }}
                className="wpf-menu-item-row"
                style={{ color: '#FF3B30' }}
              >
                <MdiIcon path={mdiDeleteOutline} size={18} color="#FF3B30" />
                <span>Удалить картинку</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const submenuContainerStyle: React.CSSProperties = {
  position: 'absolute',
  left: '100%',
  top: -4,
  background: '#1C212D',
  border: '1px solid #2A303C',
  borderRadius: 12,
  padding: '4px 0',
  minWidth: 180,
  boxShadow: '0 15px 35px rgba(0,0,0,0.6)',
  zIndex: 110,
};

const separatorStyle: React.CSSProperties = {
  height: 1,
  background: '#2A303C',
  margin: '4px 8px',
};

export default NotesCanvas;