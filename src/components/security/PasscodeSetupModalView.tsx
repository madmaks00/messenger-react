import React, { useState, useRef, useEffect } from 'react';
import { SecurityService } from '../../services/security.service';
import { Theme } from '../profile/profile.theme';

interface PasscodeSetupModalViewProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PasscodeSetupModalView: React.FC<PasscodeSetupModalViewProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [passcode, setPasscode] = useState('');
  const [repeatPasscode, setRepeatPasscode] = useState('');

  const firstInputRef = useRef<HTMLInputElement>(null);

  // 1:1 UserControl_IsVisibleChanged: очистка и фокус первого поля при открытии
  useEffect(() => {
    if (isOpen) {
      setPasscode('');
      setRepeatPasscode('');
      const timer = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1:1 CancelPasscodeSetup_Click
  const handleCancel = () => {
    setPasscode('');
    setRepeatPasscode('');
    onClose();
  };

  // 1:1 SavePasscodeSetup_Click
  const handleSave = async () => {
    const p1 = passcode;
    const p2 = repeatPasscode;

    // В WPF: if (p1.Length != 4 || !int.TryParse(p1, out _) || p1 != p2) return;
    if (p1.length !== 4 || isNaN(Number(p1)) || p1 !== p2) {
      return;
    }

    await SecurityService.setPasscode(p1);
    setPasscode('');
    setRepeatPasscode('');
    onSuccess?.();
    onClose();
  };

  return (
    <div
      onClick={handleCancel}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#99000000', // DynamicResource ModalDimOverlayBrush
        zIndex: 9900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
      }}
    >
      {/* КАРТОЧКА МОДАЛЬНОГО ОКНА (Width="340" Background="#12161D" CornerRadius="16" Padding="24") */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 340,
          backgroundColor: Theme.ProfileCardBackground,
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 40px 80px rgba(0, 0, 0, 0.6)',
          border: `1px solid ${Theme.ProfileInputContainerBorder}`,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* ИКОНКА В ШАПКЕ (Border 48x48 CornerRadius="24" Background="#1F2533") */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: Theme.ProfileDeviceItemBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
          }}
        >
          <svg width={22} height={22} viewBox="0 0 24 24" fill={Theme.AppAccent}>
            <path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.89,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z" />
          </svg>
        </div>

        {/* ЗАГОЛОВОК */}
        <div
          style={{
            color: '#FFFFFF',
            fontSize: 18,
            fontWeight: 'bold',
            marginBottom: 4,
            textAlign: 'center',
          }}
        >
          Setup Passcode
        </div>

        {/* ПОДЗАГОЛОВОК */}
        <div
          style={{
            color: Theme.ProfileSectionLabel,
            fontSize: 12,
            marginBottom: 20,
            textAlign: 'center',
          }}
        >
          Enter a 4-digit code to lock the application
        </div>

        {/* СЕКЦИЯ: ВВОД 4 ЦИФР */}
        <div style={{ width: '100%', marginBottom: 14 }}>
          <div
            style={{
              color: Theme.ProfileSectionLabel,
              fontSize: 11,
              fontWeight: 'bold',
              margin: '0 0 6px 4px',
            }}
          >
            ENTER 4 DIGITS
          </div>
          <div
            style={{
              backgroundColor: Theme.ProfileInputContainerBg,
              border: `1px solid ${Theme.ProfileInputContainerBorder}`,
              borderRadius: 10,
              height: 42,
              display: 'flex',
              alignItems: 'center',
              padding: '0 15px',
              boxSizing: 'border-box',
            }}
          >
            <input
              ref={firstInputRef}
              type="password"
              maxLength={4}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#FFFFFF',
                fontSize: 18,
                fontWeight: 'bold',
                fontFamily: "'Segoe UI', sans-serif",
                textAlign: 'left',
              }}
            />
          </div>
        </div>

        {/* СЕКЦИЯ: ПОВТОР 4 ЦИФР */}
        <div style={{ width: '100%', marginBottom: 24 }}>
          <div
            style={{
              color: Theme.ProfileSectionLabel,
              fontSize: 11,
              fontWeight: 'bold',
              margin: '0 0 6px 4px',
            }}
          >
            REPEAT 4 DIGITS
          </div>
          <div
            style={{
              backgroundColor: Theme.ProfileInputContainerBg,
              border: `1px solid ${Theme.ProfileInputContainerBorder}`,
              borderRadius: 10,
              height: 42,
              display: 'flex',
              alignItems: 'center',
              padding: '0 15px',
              boxSizing: 'border-box',
            }}
          >
            <input
              type="password"
              maxLength={4}
              value={repeatPasscode}
              onChange={(e) => setRepeatPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={(e) => e.key === 'Enter' && void handleSave()}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#FFFFFF',
                fontSize: 18,
                fontWeight: 'bold',
                fontFamily: "'Segoe UI', sans-serif",
                textAlign: 'left',
              }}
            />
          </div>
        </div>

        {/* КНОПКИ ДЕЙСТВИЯ (Grid Columns: * 10 *) */}
        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            type="button"
            onClick={handleCancel}
            style={{
              height: 38,
              borderRadius: 8,
              background: 'transparent',
              border: 'none',
              color: Theme.ProfileSectionLabel,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => void handleSave()}
            style={{
              height: 38,
              borderRadius: 8,
              backgroundColor: Theme.AppAccent,
              color: '#FFFFFF',
              border: 'none',
              fontSize: 13.5,
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 0 12px rgba(30, 155, 235, 0.3)',
              transition: 'filter 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default PasscodeSetupModalView;