import React, { useState, useRef, useEffect } from 'react';
import { SecurityService } from '../../services/security.service';

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
  const [error, setError] = useState('');

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPasscode('');
      setRepeatPasscode('');
      setError('');
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (passcode.length !== 4 || repeatPasscode.length !== 4) {
      setError('Passcode must be exactly 4 digits');
      return;
    }

    if (passcode !== repeatPasscode) {
      setError('Passcodes do not match');
      return;
    }

    await SecurityService.setPasscode(passcode);
    onSuccess?.();
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 9900,
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
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          border: '1px solid #334155',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        {/* Иконка в шапке */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: '#161B26',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            margin: '0 auto 12px auto',
            color: 'var(--app-accent, #3B82F6)',
          }}
        >
          🔒
        </div>

        <h3 style={{ margin: '0 0 4px 0', color: '#FFF', fontSize: 18, fontWeight: 'bold' }}>
          Setup Passcode
        </h3>
        <p style={{ margin: '0 0 20px 0', color: '#94A3B8', fontSize: 12 }}>
          Enter a 4-digit code to lock the application
        </p>

        {/* ВВОД 4 ЦИФР */}
        <div style={{ textAlign: 'left', marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 'bold', color: '#64748B', display: 'block', marginBottom: 6 }}>
            ENTER 4 DIGITS
          </label>
          <div style={inputBoxWrapperStyle}>
            <input
              ref={firstInputRef}
              type="password"
              maxLength={4}
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value.replace(/\D/g, '').slice(0, 4));
                setError('');
              }}
              style={passcodeFieldStyle}
            />
          </div>
        </div>

        {/* ПОВТОР 4 ЦИФР */}
        <div style={{ textAlign: 'left', marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 'bold', color: '#64748B', display: 'block', marginBottom: 6 }}>
            REPEAT 4 DIGITS
          </label>
          <div style={inputBoxWrapperStyle}>
            <input
              type="password"
              maxLength={4}
              value={repeatPasscode}
              onChange={(e) => {
                setRepeatPasscode(e.target.value.replace(/\D/g, '').slice(0, 4));
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              style={passcodeFieldStyle}
            />
          </div>
        </div>

        {error && (
          <div style={{ color: '#FF5252', fontSize: 12.5, fontWeight: 600, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* КНОПКИ ДЕЙСТВИЯ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 38,
              borderRadius: 8,
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              height: 38,
              borderRadius: 8,
              backgroundColor: 'var(--app-accent, #3B82F6)',
              color: '#FFF',
              border: 'none',
              fontSize: 13.5,
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const inputBoxWrapperStyle: React.CSSProperties = {
  backgroundColor: '#161B26',
  border: '1px solid #334155',
  borderRadius: 10,
  height: 42,
  display: 'flex',
  alignItems: 'center',
  padding: '0 15px',
};

const passcodeFieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: '#FFFFFF',
  fontSize: 18,
  fontWeight: 'bold',
  letterSpacing: 4,
  textAlign: 'center',
};