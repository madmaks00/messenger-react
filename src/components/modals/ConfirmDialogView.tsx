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

  useEffect(() => {
    if (isOpen) {
      setIsChecked(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: Theme.OverlayBackdrop,
        zIndex: 10000, // 🟢 Строго выше ProfileView (5000) и StoryViewerView (8000)
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 340,
          backgroundColor: Theme.SidebarContextMenuBg, // #1C212D
          borderRadius: 12,
          padding: '24px 20px 16px 20px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)',
          border: `1px solid ${Theme.SidebarContextMenuBorder}`,
          boxSizing: 'border-box',
        }}
      >
        {/* 1. Шапка: Заголовок + иконка */}
        {targetTitle && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            {targetIcon && (
              <svg width={28} height={28} viewBox="0 0 24 24" fill={targetIconColor}>
                <path d="M19,20H4C2.89,20 2,19.1 2,18V6C2,4.89 2.89,4 4,4H10L12,6H19A2,2 0 0,1 21,8H21L4,8V18L6.14,10H23.21L20.93,18.5C20.7,19.37 19.92,20 19,20Z" />
              </svg>
            )}
            <div style={{ fontSize: 20, fontWeight: 600, color: '#FFFFFF' }}>
              {targetTitle}
            </div>
          </div>
        )}

        {/* 2. Текст вопроса */}
        <div style={{ fontSize: 16, color: '#FFFFFF', lineHeight: '22px', marginBottom: 20, wordBreak: 'break-word' }}>
          {dialogMessage}
        </div>

        {/* 3. Опциональный чекбокс */}
        {checkboxText && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 25, fontSize: 15, color: '#FFFFFF' }}>
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: Theme.AppAccent }}
            />
            <span>{checkboxText}</span>
          </label>
        )}

        {/* 4. Кнопки Cancel / Confirm */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#4A94E8',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '8px 16px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(isChecked)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#E74C3C',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '8px 16px',
            }}
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};