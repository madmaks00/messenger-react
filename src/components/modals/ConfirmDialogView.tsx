import { DialogFrame } from './DialogFrame';
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { getAvatarColor, normalizeAvatarUrl } from '../../utils/helpers';

export interface ConfirmDialogProps {
  isOpen: boolean;
  targetTitle?: string;
  targetId?: number;
  targetAvatarColor?: string;
  targetAvatar?: string | null;
  avatar?: string | null;
  targetIcon?: string;
  icon?: string;
  targetIconColor?: string;
  iconColor?: string;
  dialogMessage: string;
  message?: string;
  checkboxText?: string | null;
  confirmButtonText?: string;
  onCancel: () => void;
  onConfirm: (isCheckboxChecked: boolean) => void;
}

export const ConfirmDialogView: React.FC<ConfirmDialogProps> = ({
  isOpen,
  targetTitle,
  targetId,
  targetAvatarColor,
  targetAvatar,
  avatar,
  targetIcon,
  icon,
  targetIconColor,
  iconColor,
  dialogMessage,
  message,
  checkboxText,
  confirmButtonText = 'Delete',
  onCancel,
  onConfirm,
}) => {
  const [isChecked, setIsChecked] = useState(false);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isActive, setIsActive] = useState(false); // 🟢 Управляет фазой анимации (появление / исчезновение)
  const [avatarError, setAvatarError] = useState(false);

  const rawAvatar = targetAvatar || avatar || null;
  const resolvedAvatar = normalizeAvatarUrl(rawAvatar);
  const resolvedIcon = resolvedAvatar ? null : targetIcon || icon || null;
  const resolvedIconColor = targetIconColor || iconColor || '#1E9BEB';
  const resolvedMessage = dialogMessage || message || '';

  // 🟢 Замораживаем данные, чтобы при исчезновении модалка не дергалась
  const cachedData = useRef({
    title: targetTitle,
    id: targetId,
    avatarColor: targetAvatarColor,
    avatar: resolvedAvatar,
    icon: resolvedIcon,
    iconColor: resolvedIconColor,
    message: resolvedMessage,
    checkbox: checkboxText,
    buttonText: confirmButtonText,
  });

  if (isOpen) {
    cachedData.current = {
      title: targetTitle,
    id: targetId,
    avatarColor: targetAvatarColor,
      avatar: resolvedAvatar,
      icon: resolvedIcon,
      iconColor: resolvedIconColor,
      message: resolvedMessage,
      checkbox: checkboxText,
      buttonText: confirmButtonText,
    };
  }

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (isOpen) {
      setIsChecked(false);
      setIsRendered(true);
      setAvatarError(false);

      // Запуск плавной анимации появления в следующем кадре отрисовки
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsActive(true);
        });
      });
    } else if (isRendered) {
      // Плавное исчезновение
      setIsActive(false);
      timer = setTimeout(() => {
        setIsRendered(false);
      }, 100);
    }

    return () => clearTimeout(timer);
  }, [isOpen, isRendered]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isRendered) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRendered, onCancel]);

  if (!isRendered) return null;

  const currentData = cachedData.current;
  const isDestructive =
    currentData.buttonText?.toLowerCase().includes('delete') ||
    currentData.buttonText?.toLowerCase().includes('leave') ||
    currentData.buttonText?.toLowerCase().includes('clear') ||
    currentData.buttonText?.toLowerCase().includes('block');

  const hasValidAvatar = Boolean(currentData.avatar && !avatarError);

  const content = (
    <DialogFrame isOpen={isOpen} kind="confirm">
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        boxSizing: 'border-box',
        padding: 16,
        opacity: isActive ? 1 : 0,
        transition: 'opacity 0.18s ease-out',
      }}
    >
      <style>{`
        .app-dialog-confirm .btn-close-modal {
          width: 28px !important;
          height: 28px !important;
          padding: 0 !important;
          border-radius: 50% !important;
          background-color: transparent !important;
          color: #7D8494 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          border: none !important;
          outline: none !important;
          transition: background-color 0.15s ease, color 0.15s ease !important;
        }
        .app-dialog-confirm .btn-close-modal:hover {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: #FFFFFF !important;
        }

        .app-dialog-confirm .btn-cancel-modal {
          height: 36px;
          padding: 0 16px;
          background-color: transparent !important;
          border: none;
          border-radius: 8px;
          color: #7D8494 !important;
          font-weight: 500;
          font-size: 13.5px;
          cursor: pointer;
          outline: none;
          transition: background-color 0.15s ease, color 0.15s ease !important;
        }
        .app-dialog-confirm .btn-cancel-modal:hover {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: #FFFFFF !important;
        }

        .app-dialog-confirm .btn-primary-modal {
          height: 36px;
          padding: 0 22px;
          background-color: #1E9BEB !important;
          border: none;
          border-radius: 8px;
          color: #FFFFFF !important;
          font-weight: 600;
          font-size: 13.5px;
          cursor: pointer;
          outline: none;
          transition: opacity 0.15s ease !important;
        }
        .app-dialog-confirm .btn-primary-modal:hover {
          opacity: 0.9 !important;
        }

        .app-dialog-confirm .btn-danger-modal {
          height: 36px;
          padding: 0 22px;
          background-color: #E74C3C !important;
          border: none;
          border-radius: 8px;
          color: #FFFFFF !important;
          font-weight: 600;
          font-size: 13.5px;
          cursor: pointer;
          outline: none;
          transition: opacity 0.15s ease !important;
        }
        .app-dialog-confirm .btn-danger-modal:hover {
          opacity: 0.9 !important;
        }
      `}</style>

      {/* 🟢 КАРТОЧКА С АНИМАЦИЕЙ ZOOM + FADE */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380,
          maxWidth: 'calc(100vw - 32px)',
          backgroundColor: '#161A23',
          borderRadius: 14,
          padding: '20px 22px 18px 22px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
          border: '1px solid #2A3342',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          transform: isActive ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(8px)',
          opacity: isActive ? 1 : 0,
          transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease-out',
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {/* Keep the avatar space stable while the image loads or is unavailable. */}
            {(currentData.avatar || !currentData.icon) && (
              <div style={{ width: 46, height: 46, borderRadius: 23, flexShrink: 0,
                background: currentData.avatarColor || getAvatarColor(currentData.id), position: 'relative', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#FFFFFF', fontSize: 20, fontWeight: 500 }}>
                <span>{(currentData.title || 'Chat').charAt(0).toUpperCase()}</span>
                {hasValidAvatar && (
                  <img key={currentData.avatar} src={currentData.avatar!} alt=""
                    onError={() => setAvatarError(true)}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                      objectFit: 'cover', display: 'block' }} />
                )}
              </div>
            )}

            {/* Иконка действия (веник / урна) */}
            {!currentData.avatar && currentData.icon && (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill={currentData.iconColor || '#1E9BEB'}
                style={{ flexShrink: 0 }}
              >
                <path d={currentData.icon} />
              </svg>
            )}

            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: '#FFFFFF',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {currentData.title || 'Confirmation'}
            </span>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="btn-close-modal"
            title="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* MESSAGE */}
        <div style={{ fontSize: 15, color: '#FFFFFF', lineHeight: '22px', marginBottom: 20, wordBreak: 'break-word' }}>
          {currentData.message}
        </div>

        {/* CHECKBOX */}
        {currentData.checkbox && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              marginBottom: 24,
              fontSize: 14.5,
              color: '#FFFFFF',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: isDestructive ? '#E74C3C' : '#1E9BEB', cursor: 'pointer' }}
            />
            <span style={{ color: '#E2E8F0' }}>{currentData.checkbox}</span>
          </label>
        )}

        {/* BUTTONS */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            className="btn-cancel-modal"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => onConfirm(isChecked)}
            className={isDestructive ? 'btn-danger-modal' : 'btn-primary-modal'}
          >
            {currentData.buttonText}
          </button>
        </div>
      </div>
    </div>
    </DialogFrame>
  );

  return typeof document !== 'undefined' ? ReactDOM.createPortal(content, document.body) : content;
};

export default ConfirmDialogView;