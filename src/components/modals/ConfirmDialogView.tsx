import React, { useState, useEffect } from 'react';
import { Theme } from '../profile/profile.theme';

export interface ConfirmDialogProps {
  isOpen: boolean;
  targetTitle?: string;
  targetAvatar?: string | null;
  targetIcon?: string;
  targetIconColor?: string;
  dialogMessage: string;
  checkboxText?: string | null;
  confirmButtonText?: string;
  onCancel: () => void;
  onConfirm: (isCheckboxChecked: boolean) => void;
}

export const ConfirmDialogView: React.FC<ConfirmDialogProps> = ({
  isOpen,
  targetTitle,
  targetAvatar,
  targetIcon,
  targetIconColor = Theme.AppAccent,
  dialogMessage,
  checkboxText,
  confirmButtonText = 'Delete',
  onCancel,
  onConfirm,
}) => {
  const [isChecked, setIsChecked] = useState(false);
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  // Кэшируем содержимое, чтобы оно НЕ пропадало при сбросе пропсов родительским компонентом
  const [cached, setCached] = useState({
    targetTitle,
    targetAvatar,
    targetIcon,
    targetIconColor,
    dialogMessage,
    checkboxText,
    confirmButtonText,
  });

  const [cancelHovered, setCancelHovered] = useState(false);
  const [confirmHovered, setConfirmHovered] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (isOpen) {
      setIsChecked(false);
      setIsMounted(true);

      // Сохраняем свежие данные
      setCached({
        targetTitle,
        targetAvatar,
        targetIcon,
        targetIconColor: targetIconColor || Theme.AppAccent,
        dialogMessage,
        checkboxText,
        confirmButtonText: confirmButtonText || 'Delete',
      });

      // Старт плавной анимации появления
      timer = setTimeout(() => {
        setIsVisible(true);
      }, 16);
    } else {
      // Если закрытие вызвано извне (через проп isOpen = false)
      setIsVisible(false);
      timer = setTimeout(() => {
        setIsMounted(false);
      }, 160);
    }

    return () => clearTimeout(timer);
  }, [
    isOpen,
    targetTitle,
    targetAvatar,
    targetIcon,
    targetIconColor,
    dialogMessage,
    checkboxText,
    confirmButtonText,
  ]);

  // Плавный выход перед вызовом колбэка
  const handleClose = (callback: () => void) => {
    if (!isVisible) return;
    setIsVisible(false);
    setTimeout(() => {
      setIsMounted(false);
      callback();
    }, 160); // 160ms — оптимальное быстрое время растворения
  };

  if (!isMounted) return null;

  return (
    <div
      onClick={() => handleClose(onCancel)}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: Theme.OverlayBackdrop || 'rgba(0, 0, 0, 0.6)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        transition: 'opacity 0.16s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 340,
          backgroundColor: Theme.SidebarContextMenuBg || '#1C212D',
          borderRadius: 14,
          padding: '24px 20px 18px 20px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)',
          border: `1px solid ${Theme.SidebarContextMenuBorder || '#272E3F'}`,
          boxSizing: 'border-box',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(4px)',
          transition: isVisible
            ? 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease'
            : 'transform 0.16s ease-out, opacity 0.15s ease-out',
        }}
      >
        {/* 1. Шапка: Заголовок + иконка (берём из cached, чтобы не схлопывалось) */}
        {cached.targetTitle && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            {cached.targetIcon && (
              <svg width={28} height={28} viewBox="0 0 24 24" fill={cached.targetIconColor}>
                <path d="M19,20H4C2.89,20 2,19.1 2,18V6C2,4.89 2.89,4 4,4H10L12,6H19A2,2 0 0,1 21,8H21L4,8V18L6.14,10H23.21L20.93,18.5C20.7,19.37 19.92,20 19,20Z" />
              </svg>
            )}
            <div style={{ fontSize: 20, fontWeight: 600, color: '#FFFFFF' }}>
              {cached.targetTitle}
            </div>
          </div>
        )}

        {/* 2. Текст вопроса */}
        <div style={{ fontSize: 16, color: '#FFFFFF', lineHeight: '22px', marginBottom: 20, wordBreak: 'break-word' }}>
          {cached.dialogMessage}
        </div>

        {/* 3. Опциональный чекбокс */}
        {cached.checkboxText && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 25, fontSize: 15, color: '#FFFFFF' }}>
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: Theme.AppAccent }}
            />
            <span>{cached.checkboxText}</span>
          </label>
        )}

        {/* 4. Кнопки Cancel / Confirm */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={() => handleClose(onCancel)}
            onMouseEnter={() => setCancelHovered(true)}
            onMouseLeave={() => setCancelHovered(false)}
            style={{
              background: cancelHovered ? 'rgba(74, 148, 232, 0.14)' : 'transparent',
              border: 'none',
              borderRadius: 8,
              color: '#4A94E8',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '8px 16px',
              transition: 'background-color 0.15s ease',
            }}
          >
            Cancel
          </button>
          
          <button
            onClick={() => handleClose(() => onConfirm(isChecked))}
            onMouseEnter={() => setConfirmHovered(true)}
            onMouseLeave={() => setConfirmHovered(false)}
            style={{
              background: confirmHovered ? 'rgba(231, 76, 60, 0.16)' : 'transparent',
              border: 'none',
              borderRadius: 8,
              color: '#E74C3C',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '8px 16px',
              transition: 'background-color 0.15s ease',
            }}
          >
            {cached.confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};