import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGamesStore } from '../../stores/gamesStore';
import { ICanvasStroke } from '../../services/inkCanvas.service';

interface DrawingCanvasProps {
  width?: number;
  height?: number;
  readOnly?: boolean;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ width = 430, height = 350, readOnly = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { drawStrokes, setDrawStrokes, drawCanvasBackground, customBrushColor, drawingMode } = useGamesStore();
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeRef = useRef<ICanvasStroke | null>(null);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = drawCanvasBackground;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of drawStrokes) {
      if (stroke.points.length === 0) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;

      if (stroke.points.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color;
        ctx.fill();
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, [drawStrokes, drawCanvasBackground]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    setIsDrawing(true);
    const coords = getCoordinates(e);

    const color = drawingMode === 'erase' ? drawCanvasBackground : customBrushColor;
    const size = drawingMode === 'erase' ? 14 : 3;

    currentStrokeRef.current = {
      color,
      size,
      points: [coords],
    };

    setDrawStrokes([...drawStrokes, currentStrokeRef.current]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStrokeRef.current || readOnly) return;
    const coords = getCoordinates(e);
    currentStrokeRef.current.points.push(coords);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = currentStrokeRef.current.color;
    ctx.lineWidth = currentStrokeRef.current.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const points = currentStrokeRef.current.points;
    if (points.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(points[points.length - 2].x, points[points.length - 2].y);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    }
  };

  const handleMouseUp = () => {
    if (readOnly) return;
    setIsDrawing(false);
    currentStrokeRef.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        width: '100%',
        height: '100%',
        cursor: readOnly ? 'default' : drawingMode === 'erase' ? 'cell' : 'crosshair',
        backgroundColor: drawCanvasBackground,
        display: 'block',
      }}
    />
  );
};