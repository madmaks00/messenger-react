import { useState, useEffect, useRef, useCallback } from 'react';

const SPLITTER_WIDTH = 6;
const MIN_EXPANDED_WIDTH = 180;
const NAV_COLUMN_WIDTH = 66;
const MIN_CHAT_WORKSPACE_WIDTH = 430;
const CHAT_PROPORTIONAL_THRESHOLD = 625;
const MAX_SIDEBAR_WIDTH = 1100;

export function useSidebarResize() {
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [sidebarOpacity, setSidebarOpacity] = useState(1);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const lastExpandedWidthRef = useRef(340);
  const isAutoCollapsedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(340);

  // ================= 1. АВТО-МАСШТАБИРОВАНИЕ ПРИ ИЗМЕНЕНИИ РАЗМЕРА ОКНА (Window_SizeChanged) =================
  useEffect(() => {
    const handleResize = () => {
      if (isDraggingRef.current) return;

      const totalWidth = window.innerWidth;
      const availableForContent = totalWidth - NAV_COLUMN_WIDTH;
      const maxAvailableSidebarWidth = availableForContent - MIN_CHAT_WORKSPACE_WIDTH;

      // Если окно слишком узкое — авто-схлопываем
      if (maxAvailableSidebarWidth < MIN_EXPANDED_WIDTH) {
        if (!isCollapsed) {
          setIsCollapsed(true);
          isAutoCollapsedRef.current = true;
          setSidebarWidth(SPLITTER_WIDTH);
          setSidebarOpacity(0);
        }
        return;
      }

      // Если место появилось — разворачиваем обратно
      if (isCollapsed && isAutoCollapsedRef.current) {
        setIsCollapsed(false);
        isAutoCollapsedRef.current = false;
        setSidebarOpacity(1);
      }

      if (isCollapsed) return;

      const baseSidebar = lastExpandedWidthRef.current >= MIN_EXPANDED_WIDTH ? lastExpandedWidthRef.current : 340;
      const baseThresholdTotal = baseSidebar + CHAT_PROPORTIONAL_THRESHOLD;

      // Формула 1 в 1 из C#: baseSidebar + ((availableForContent - baseThresholdTotal) * 0.30)
      let targetWidth = availableForContent > baseThresholdTotal
        ? baseSidebar + ((availableForContent - baseThresholdTotal) * 0.30)
        : Math.min(baseSidebar, maxAvailableSidebarWidth);

      targetWidth = Math.round(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_EXPANDED_WIDTH, targetWidth)));

      setSidebarWidth(targetWidth);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Начальный расчет при загрузке

    return () => window.removeEventListener('resize', handleResize);
  }, [isCollapsed]);

  // ================= 2. ПЕРЕТЯГИВАНИЕ СПЛИТТЕРА (DragDelta & DragCompleted) =================
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const deltaX = moveEvent.clientX - startXRef.current;
      let newWidth = startWidthRef.current + deltaX;

      const availableForContent = window.innerWidth - NAV_COLUMN_WIDTH;
      const maxAvailable = Math.min(MAX_SIDEBAR_WIDTH, availableForContent - MIN_CHAT_WORKSPACE_WIDTH);

      newWidth = Math.min(maxAvailable, newWidth);

      // Плавное растворение при уходе меньше 180px (как в C#)
      if (newWidth < MIN_EXPANDED_WIDTH) {
        const opacity = (newWidth - SPLITTER_WIDTH) / (MIN_EXPANDED_WIDTH - SPLITTER_WIDTH);
        setSidebarOpacity(Math.max(0, Math.min(1, opacity)));
      } else {
        setSidebarOpacity(1);
      }

      setSidebarWidth(Math.max(SPLITTER_WIDTH, newWidth));
    };

    const onMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);

      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      setSidebarWidth((currentWidth) => {
        const rounded = Math.round(currentWidth);
        if (rounded < MIN_EXPANDED_WIDTH) {
          // Схлопываем
          setIsCollapsed(true);
          setSidebarOpacity(0);
          return SPLITTER_WIDTH;
        } else {
          // Запоминаем ширину
          setIsCollapsed(false);
          isAutoCollapsedRef.current = false;
          lastExpandedWidthRef.current = rounded;
          setSidebarOpacity(1);
          return rounded;
        }
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [sidebarWidth]);

  // ================= 3. ДВОЙНОЙ КЛИК (MainSplitter_MouseDoubleClick) =================
  const onDoubleClick = useCallback(() => {
    if (isCollapsed) {
      // Развернуть
      setIsCollapsed(false);
      isAutoCollapsedRef.current = false;
      const target = Math.round(lastExpandedWidthRef.current >= MIN_EXPANDED_WIDTH ? lastExpandedWidthRef.current : 340);
      setSidebarWidth(target);
      setSidebarOpacity(1);
    } else {
      // Свернуть
      lastExpandedWidthRef.current = Math.round(sidebarWidth);
      setIsCollapsed(true);
      setSidebarWidth(SPLITTER_WIDTH);
      setSidebarOpacity(0);
    }
  }, [isCollapsed, sidebarWidth]);

  return {
    sidebarWidth,
    sidebarOpacity,
    isCollapsed,
    isDragging,
    isHovered,
    setIsHovered,
    onMouseDown,
    onDoubleClick,
  };
}