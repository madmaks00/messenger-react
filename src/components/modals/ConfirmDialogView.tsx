import React, { useState, useEffect } from 'react';

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
  targetIcon,
  targetIconColor = '#1E9BEB',
  dialogMessage,
  checkboxText,
  confirmButtonText = 'Delete',
  onCancel,
  onConfirm,
}) => {
  const [isChecked, setIsChecked] = useState(false);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsChecked(false);
      setIsRendered(true);
      setIsFadingOut(false);
    } else if (isRendered) {
      setIsFadingOut(true);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setIsFadingOut(false);
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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

  const isDestructive = confirmButtonText?.toLowerCase().includes('delete') ||
                        confirmButtonText?.toLowerCase().includes('leave') ||
                        confirmButtonText?.toLowerCase().includes('clear') ||
                        confirmButtonText?.toLowerCase().includes('block');

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        boxSizing: 'border-box',
        padding: 16,
        opacity: isFadingOut ? 0 : 1,
        transition: 'opacity 0.12s ease-out',
      }}
    >
      <style>{`
        .btn-close {
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
        .btn-close:hover {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: #FFFFFF !important;
        }
        .btn-close:active {
          background-color: rgba(255, 255, 255, 0.16) !important;
        }

        .btn-cancel {
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
        .btn-cancel:hover {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: #FFFFFF !important;
        }
        .btn-cancel:active {
          background-color: rgba(255, 255, 255, 0.14) !important;
        }

        .btn-primary {
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
        .btn-primary:hover {
          opacity: 0.9 !important;
        }
        .btn-primary:active {
          opacity: 0.8 !important;
        }

        .btn-danger {
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
        .btn-danger:hover {
          opacity: 0.9 !important;
        }
        .btn-danger:active {
          opacity: 0.8 !important;
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380,
          backgroundColor: '#161A23',
          borderRadius: 14,
          padding: '20px 22px 18px 22px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
          border: '1px solid #2A3342',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
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
            {targetIcon && (
              <svg width="22" height="22" viewBox="0 0 24 24" fill={targetIconColor} style={{ flexShrink: 0 }}>
                <path d="M19,20H4C2.89,20 2,19.1 2,18V6C2,4.89 2.89,4 4,4H10L12,6H19A2,2 0 0,1 21,8H21L4,8V18L6.14,10H23.21L20.93,18.5C20.7,19.37 19.92,20 19,20Z" />
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
              {targetTitle || 'Confirmation'}
            </span>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="btn-close"
            title="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div style={{ fontSize: 15, color: '#FFFFFF', lineHeight: '22px', marginBottom: 20, wordBreak: 'break-word' }}>
          {dialogMessage}
        </div>

        {checkboxText && (
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
            <span style={{ color: '#E2E8F0' }}>{checkboxText}</span>
          </label>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            className="btn-cancel"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => onConfirm(isChecked)}
            className={isDestructive ? 'btn-danger' : 'btn-primary'}
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialogView;