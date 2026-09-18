import { useEffect, useRef } from 'react';

interface UseSmoothScrollOptions {
  friction?: number; // Коэффициент затухания (0.78 в C#)
  wheelMultiplier?: number; // Чувствительность колесика (0.15 в C#)
  enabled?: boolean;
}

export function useSmoothScroll<T extends HTMLElement>(options?: UseSmoothScrollOptions) {
  const containerRef = useRef<T | null>(null);
  const velocityRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  const friction = options?.friction ?? 0.78;
  const wheelMultiplier = options?.wheelMultiplier ?? 0.15;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    const onWheel = (e: WheelEvent) => {
      // Если контент не прокручивается, ничего не делаем
      if (el.scrollHeight <= el.clientHeight) return;

      e.preventDefault();
      velocityRef.current += e.deltaY * wheelMultiplier;

      if (!animFrameRef.current) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    const render = () => {
      if (!el || Math.abs(velocityRef.current) < 0.1) {
        velocityRef.current = 0;
        animFrameRef.current = null;
        return;
      }

      const maxScroll = el.scrollHeight - el.clientHeight;
      const targetOffset = el.scrollTop + velocityRef.current;

      el.scrollTop = Math.max(0, Math.min(maxScroll, targetOffset));
      velocityRef.current *= friction;

      animFrameRef.current = requestAnimationFrame(render);
    };

    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('wheel', onWheel);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [enabled, friction, wheelMultiplier]);

  const stopInertia = () => {
    velocityRef.current = 0;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  const adjustOffsetSilently = (targetOffset: number) => {
    stopInertia();
    if (containerRef.current) {
      containerRef.current.scrollTop = targetOffset;
    }
  };

  return { containerRef, stopInertia, adjustOffsetSilently };
}