import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export const CALL_RESIZE_EDGES = ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'] as const;
export type CallResizeEdge = typeof CALL_RESIZE_EDGES[number];
type Bounds = { x: number; y: number; width: number; height: number };
type Interaction = { pointerId: number; x: number; y: number; bounds: Bounds; edge?: CallResizeEdge };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

function fitBounds(bounds: Bounds, minWidth: number, minHeight: number): Bounds {
  const view = viewport();
  const width = clamp(bounds.width, Math.min(minWidth, view.width), view.width);
  const height = clamp(bounds.height, Math.min(minHeight, view.height), view.height);
  return { width, height, x: clamp(bounds.x, 0, view.width - width), y: clamp(bounds.y, 0, view.height - height) };
}

function centeredBounds(width: number, height: number): Bounds {
  const view = viewport();
  width = Math.min(width, view.width);
  height = Math.min(height, view.height);
  return { width, height, x: (view.width - width) / 2, y: (view.height - height) / 2 };
}

export function useCallWindowBounds({ isOpen, windowState, defaultWidth, defaultHeight, minWidth, minHeight }: {
  isOpen: boolean;
  windowState: 'normal' | 'minimized' | 'maximized';
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
}) {
  const [bounds, setBounds] = useState(() => centeredBounds(defaultWidth, defaultHeight));
  const [interactionCursor, setInteractionCursor] = useState<string | null>(null);
  const interaction = useRef<Interaction | null>(null);
  const wasOpen = useRef(false);
  const wasResized = useRef(false);

  useEffect(() => {
    if (isOpen) {
      if (!wasOpen.current) wasResized.current = false;
      setBounds(current => wasResized.current
        ? fitBounds(current, minWidth, minHeight)
        : centeredBounds(defaultWidth, defaultHeight));
    }
    wasOpen.current = isOpen;
  }, [isOpen, defaultWidth, defaultHeight, minWidth, minHeight]);

  useEffect(() => {
    const stop = () => { interaction.current = null; setInteractionCursor(null); };
    stop();
    const move = (event: PointerEvent) => {
      const start = interaction.current;
      if (!start || event.pointerId !== start.pointerId) return;
      const view = viewport();
      const rect = fitBounds(start.bounds, minWidth, minHeight);
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (!start.edge) {
        setBounds({ ...rect, x: clamp(rect.x + dx, 0, view.width - rect.width), y: clamp(rect.y + dy, 0, view.height - rect.height) });
        return;
      }
      wasResized.current = true;
      const minimumWidth = Math.min(minWidth, view.width), minimumHeight = Math.min(minHeight, view.height);
      let left = rect.x, top = rect.y, right = rect.x + rect.width, bottom = rect.y + rect.height;
      if (start.edge.includes('e')) right = clamp(right + dx, left + minimumWidth, view.width);
      if (start.edge.includes('s')) bottom = clamp(bottom + dy, top + minimumHeight, view.height);
      if (start.edge.includes('w')) left = clamp(left + dx, 0, right - minimumWidth);
      if (start.edge.includes('n')) top = clamp(top + dy, 0, bottom - minimumHeight);
      setBounds({ x: left, y: top, width: right - left, height: bottom - top });
    };
    const finish = (event: PointerEvent) => {
      if (event.pointerId === interaction.current?.pointerId) stop();
    };
    const resizeViewport = () => { stop(); setBounds(current => fitBounds(current, minWidth, minHeight)); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('blur', stop);
    window.addEventListener('resize', resizeViewport);
    return () => {
      interaction.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('blur', stop);
      window.removeEventListener('resize', resizeViewport);
    };
  }, [isOpen, windowState, minWidth, minHeight]);

  const beginInteraction = (event: ReactPointerEvent<HTMLElement>, edge?: CallResizeEdge) => {
    if (!isOpen || windowState !== 'normal' || !event.isPrimary || event.button !== 0) return;
    if (!edge && (event.target as Element).closest('button')) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    interaction.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, bounds, edge };
    setInteractionCursor(edge ? `${edge}-resize` : 'move');
  };

  return { bounds, interactionCursor, beginInteraction };
}
