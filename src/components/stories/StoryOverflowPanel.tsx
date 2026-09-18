import React, { useRef, useState, useLayoutEffect } from 'react';

interface StoryOverflowPanelProps {
  children: React.ReactNode[];
  itemWidth?: number; // ширина одной круглой истории с отступами (обычно 70px)
  overflowButtonWidth?: number; // ширина кнопки раскрытия/остатка
}

export const StoryOverflowPanel: React.FC<StoryOverflowPanelProps> = ({
  children,
  itemWidth = 70,
  overflowButtonWidth = 50,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(children.length);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const calculateFit = () => {
      const availableWidth = el.clientWidth;
      if (availableWidth <= 0) return;

      const totalItems = children.length;
      if (totalItems <= 1) {
        setVisibleCount(totalItems);
        return;
      }

      // Алгоритм MeasureOverride из C#:
      // Резервируем ширину под последний элемент (lastWidth)
      const availableForStories = Math.max(0, availableWidth - overflowButtonWidth);
      const maxCanFit = Math.floor(availableForStories / itemWidth);

      setVisibleCount(Math.min(totalItems - 1, maxCanFit));
    };

    calculateFit();

    const observer = new ResizeObserver(calculateFit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children.length, itemWidth, overflowButtonWidth]);

  const items = React.Children.toArray(children);
  const visibleChildren = items.slice(0, visibleCount);
  const lastChild = items[items.length - 1]; // последний элемент (резервный)

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {visibleChildren.map((child, idx) => (
        <div key={idx} style={{ flexShrink: 0, width: `${itemWidth}px` }}>
          {child}
        </div>
      ))}

      {/* Отрисовываем последний элемент, если не все истории влезли */}
      {visibleCount < items.length - 1 && lastChild && (
        <div style={{ flexShrink: 0, width: `${overflowButtonWidth}px` }}>
          {lastChild}
        </div>
      )}
    </div>
  );
};