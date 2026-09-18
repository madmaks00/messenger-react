import React, { useState } from 'react';

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
  targetIconColor = '#1E9BEB',
  dialogMessage,
  checkboxText,
  confirmButtonText = 'Delete',
  onCancel,
  onConfirm,
}) => {
  const [isChecked, setIsChecked] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 340,
          backgroundColor: '#1E2330',
          borderRadius: 12,
          padding: '24px 20px 16px 20px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
          border: '1px solid #334155',
        }}
      >
        {/* 1. Шапка: Аватар / Иконка + Заголовок */}
        {targetTitle && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            {targetIcon ? (
              <span style={{ fontSize: 26, color: targetIconColor }}>📁</span>
            ) : (
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: '#3B82F6',
                  color: '#FFF',
                  fontSize: 20,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {targetAvatar ? (
                  <img src={targetAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  targetTitle.charAt(0).toUpperCase()
                )}
              </div>
            )}
            <div style={{ fontSize: 20, fontWeight: 600, color: targetIcon ? targetIconColor : '#FFFFFF' }}>
              {targetTitle}
            </div>
          </div>
        )}

        {/* 2. Текст вопроса */}
        <div style={{ fontSize: 16, color: '#E2E8F0', lineHeight: '22px', marginBottom: 20 }}>
          {dialogMessage}
        </div>

        {/* 3. Опциональный чекбокс (напр. "Удалить для всех") */}
        {checkboxText && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 25, fontSize: 15, color: '#E2E8F0' }}>
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#3B82F6' }}
            />
            <span>{checkboxText}</span>
          </label>
        )}

        {/* 4. Кнопки Cancel / Confirm */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 15, fontWeight: 600, cursor: 'pointer', padding: '8px 16px' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(isChecked)}
            style={{ background: 'transparent', border: 'none', color: '#EF4444', fontSize: 15, fontWeight: 600, cursor: 'pointer', padding: '8px 16px' }}
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};