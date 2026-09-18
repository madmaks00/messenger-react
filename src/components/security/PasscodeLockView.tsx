import React, { useState, useRef, useEffect } from 'react';
import { SecurityService } from '../../services/security.service';
import { useAuthStore } from '../../stores/authStore';

interface PasscodeLockViewProps {
  isLocked: boolean;
  onUnlock: () => void;
}

export const PasscodeLockView: React.FC<PasscodeLockViewProps> = ({ isLocked, onUnlock }) => {
  const { logOut } = useAuthStore();
  const [passcode, setPasscode] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [iconState, setIconState] = useState<'default' | 'success' | 'failure'>('default');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLocked) {
      setPasscode('');
      setHasError(false);
      setIconState('default');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isLocked]);

  if (!isLocked) return null;

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isAnimating) return;

    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPasscode(val);
    setHasError(false);

    if (val.length === 4) {
      setIsAnimating(true);
      const isCorrect = await SecurityService.verifyPasscode(val);

      if (isCorrect) {
        // Анимация успеха
        setIconState('success');
        setTimeout(() => {
          setPasscode('');
          setIsAnimating(false);
          setIconState('default');
          onUnlock();
        }, 500);
      } else {
        // Анимация ошибки и тряски
        setHasError(true);
        setIconState('failure');
        setTimeout(() => {
          setIconState('default');
          setPasscode('');
          setIsAnimating(false);
          inputRef.current?.focus();
        }, 700);
      }
    }
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#0A0E17',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      <style>{`
        @keyframes shakeLock {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        @keyframes spinLock {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.25); }
          100% { transform: rotate(360deg) scale(1); }
        }
      `}</style>

      {/* Скрытый input для перехвата ввода */}
      <input
        ref={inputRef}
        type="password"
        maxLength={4}
        value={passcode}
        onChange={handleInputChange}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
      />

      {/* 1. ИКОНКА ЗАМКА С АНИМАЦИЯМИ */}
      <div
        style={{
          width: 64,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 15,
          animation:
            iconState === 'failure'
              ? 'shakeLock 0.35s ease-in-out'
              : iconState === 'success'
              ? 'spinLock 0.45s ease-in-out'
              : 'none',
        }}
      >
        {iconState === 'success' ? (
          <span style={{ fontSize: 44, color: '#4CAF50' }}>✓</span>
        ) : iconState === 'failure' ? (
          <span style={{ fontSize: 44, color: '#FF5252' }}>✕</span>
        ) : (
          <span style={{ fontSize: 44, color: 'var(--app-accent, #3B82F6)' }}>🔒</span>
        )}
      </div>

      {/* 2. ЗАГОЛОВОК */}
      <h2 style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', margin: '0 0 25px 0' }}>
        Enter Local Passcode
      </h2>

      {/* 3. 4 ТОЧКИ-ИНДИКАТОРА */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 15 }}>
        {[0, 1, 2, 3].map((index) => {
          const isFilled = passcode.length > index;
          return (
            <div
              key={index}
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                border: '2px solid rgba(255, 255, 255, 0.4)',
                backgroundColor: isFilled ? 'var(--app-accent, #3B82F6)' : 'transparent',
                transition: 'background-color 0.15s ease',
              }}
            />
          );
        })}
      </div>

      {/* 4. СООБЩЕНИЕ ОБ ОШИБКЕ */}
      <div
        style={{
          height: 24,
          color: '#FF5252',
          fontSize: 13.5,
          fontWeight: 600,
          visibility: hasError ? 'visible' : 'hidden',
          marginBottom: 10,
        }}
      >
        Incorrect passcode
      </div>

      {/* 5. КНОПКА ВЫХОДА ИЗ АККАУНТА */}
      <button
        onClick={() => logOut()}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#94A3B8',
          fontSize: 14,
          cursor: 'pointer',
          padding: '6px 12px',
          textDecoration: 'underline',
        }}
      >
        Log Out
      </button>
    </div>
  );
};