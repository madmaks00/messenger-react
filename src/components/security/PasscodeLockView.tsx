import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SecurityService } from '../../services/security.service';
import { useAuthStore } from '../../stores/authStore';

// =========================================================================
// ИКОНКИ MATERIAL DESIGN (1:1 PackIconKind)
// =========================================================================
const Icons = {
  LockOutline: ({ size = 56, color = 'var(--link-colour, #1E9BEB)' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.89,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z" />
    </svg>
  ),
  CheckBold: ({ size = 56, color = 'var(--success-text, #4CAF50)' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" />
    </svg>
  ),
  CloseBold: ({ size = 56, color = 'var(--danger-text, #FF5252)' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M20 6.91L17.09 4L12 9.09L6.91 4L4 6.91L9.09 12L4 17.09L6.91 20L12 14.91L17.09 20L20 17.09L14.91 12L20 6.91Z" />
    </svg>
  ),
};

interface PasscodeLockViewProps {
  isLocked: boolean;
  onUnlock: () => void;
}

export const PasscodeLockView: React.FC<PasscodeLockViewProps> = ({ isLocked, onUnlock }) => {
  const { logOut } = useAuthStore();
  const [passcode, setPasscode] = useState('');
  const [hasError, setHasError] = useState(false);

  // Иконка и цвет
  const [iconKind, setIconKind] = useState<'LockOutline' | 'CheckBold' | 'CloseBold'>('LockOutline');
  const [iconColor, setIconColor] = useState<string>('#1E9BEB');

  // Флаги анимаций (1:1 TransformGroup)
  const [rotateActive, setRotateActive] = useState(false);
  const [pulseActive, setPulseActive] = useState(false);
  const [shakeActive, setShakeActive] = useState(false);
  const [scaleDownActive, setScaleDownActive] = useState(false);
  const [scaleUpActive, setScaleUpActive] = useState(false);

  const isAnimatingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // =========================================================================
  // 1:1 AnimateSuccessAndUnlock()
  // =========================================================================
  const animateSuccessAndUnlock = useCallback(async () => {
    setRotateActive(true);

    await new Promise((r) => setTimeout(r, 130));
    setIconKind('CheckBold');
    setIconColor('#4CAF50');
    setPulseActive(true);

    await new Promise((r) => setTimeout(r, 350));

    setPasscode('');
    if (inputRef.current) inputRef.current.value = '';

    onUnlock();

    setIconKind('LockOutline');
    setIconColor('var(--accent-primary, #1E9BEB)');
    setRotateActive(false);
    setPulseActive(false);
  }, [onUnlock]);

  // =========================================================================
  // 1:1 AnimateFailureAndReset()
  // =========================================================================
  const animateFailureAndReset = useCallback(async () => {
    setHasError(true);
    setIconKind('CloseBold');
    setIconColor('#FF5252');

    setShakeActive(true);
    await new Promise((r) => setTimeout(r, 300));
    setShakeActive(false);

    setScaleDownActive(true);
    await new Promise((r) => setTimeout(r, 100));
    setScaleDownActive(false);

    setIconKind('LockOutline');
    setIconColor('var(--accent-primary, #1E9BEB)');

    setScaleUpActive(true);
    await new Promise((r) => setTimeout(r, 120));
    setScaleUpActive(false);

    setPasscode('');
    if (inputRef.current) inputRef.current.value = '';
    focusInput();
  }, [focusInput]);

  // =========================================================================
  // 1:1 PasscodeHiddenInput_TextChanged (ЕДИНСТВЕННЫЙ ИСТОЧНИК ВВОДА)
  // =========================================================================
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isAnimatingRef.current) return;

    const filtered = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPasscode(filtered);

    if (hasError) {
      setHasError(false);
    }

    if (filtered.length === 4) {
      isAnimatingRef.current = true;
      try {
        const isCorrect = await SecurityService.verifyPasscode(filtered);
        if (isCorrect) {
          await animateSuccessAndUnlock();
        } else {
          await animateFailureAndReset();
        }
      } finally {
        isAnimatingRef.current = false;
      }
    }
  };

  // Фокусировка при открытии/сбросе
  useEffect(() => {
    if (isLocked) {
      setPasscode('');
      if (inputRef.current) inputRef.current.value = '';
      setHasError(false);
      setIconKind('LockOutline');
      setIconColor('var(--accent-primary, #1E9BEB)');
      setRotateActive(false);
      setPulseActive(false);
      setShakeActive(false);
      setScaleDownActive(false);
      setScaleUpActive(false);
      isAnimatingRef.current = false;

      const timer = setTimeout(() => {
        focusInput();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isLocked, focusInput]);

  if (!isLocked) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--surface-recessed, #0C1017)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
      }}
    >
      <style>{`
        :root {
          --wpf-cubic-inout: cubic-bezier(0.645, 0.045, 0.355, 1);
          --wpf-cubic-in: cubic-bezier(0.32, 0, 0.67, 0);
          --wpf-cubic-out: cubic-bezier(0.33, 1, 0.68, 1);
        }

        /* 1:1 Вращение 360° за 200 мс */
        @keyframes wpfRotate360 {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .anim-rotate-success {
          animation: wpfRotate360 200ms var(--wpf-cubic-inout) forwards;
        }

        /* 1:1 Пульс 1.0 -> 1.25 -> 1.0 (200 мс) */
        @keyframes wpfPulseScale {
          0% { transform: scale(1); }
          50% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        .anim-pulse-scale {
          animation: wpfPulseScale 200ms ease-out forwards;
        }

        /* 1:1 Тряска (-8px / +8px, 270 мс) */
        @keyframes wpfShakeTranslate {
          0% { transform: translateX(0px); }
          8.33% { transform: translateX(-8px); }
          25% { transform: translateX(8px); }
          41.66% { transform: translateX(-8px); }
          58.33% { transform: translateX(8px); }
          75% { transform: translateX(-8px); }
          91.66% { transform: translateX(8px); }
          100% { transform: translateX(0px); }
        }
        .anim-shake-translate {
          animation: wpfShakeTranslate 270ms linear forwards;
        }

        /* 1:1 Схлопывание в ноль за 100 мс */
        @keyframes wpfScaleDown {
          from { transform: scale(1); }
          to { transform: scale(0); }
        }
        .anim-scale-down {
          animation: wpfScaleDown 100ms var(--wpf-cubic-in) forwards;
        }

        /* 1:1 Восстановление в 1.0 за 120 мс */
        @keyframes wpfScaleUp {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }
        .anim-scale-up {
          animation: wpfScaleUp 120ms var(--wpf-cubic-out) forwards;
        }

        /* Кнопка Log Out */
        .wpf-passcode-logout-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0;
          outline: none;
        }

        .wpf-passcode-logout-btn .btn-text {
          color: #7A8490;
          font-size: 14px;
          transition: color 0.2s ease;
        }

        .wpf-passcode-logout-btn .underline-border {
          height: 1px;
          width: 100%;
          background-color: #7A8490;
          margin-top: 1px;
          transform: scaleX(0);
          transform-origin: center;
          transition: transform 0.2s var(--wpf-cubic-in), background-color 0.2s ease;
        }

        .wpf-passcode-logout-btn:hover .btn-text {
          color: #FFFFFF;
        }

        .wpf-passcode-logout-btn:hover .underline-border {
          background-color: #FFFFFF;
          transform: scaleX(1);
          transition: transform 0.25s var(--wpf-cubic-out);
        }
      `}</style>

      {/* 
        Скрытый инпут растянут на весь экран поверх фона.
        Клик в ЛЮБУЮ точку экрана автоматически держит фокус на вводе.
      */}
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={passcode}
        onChange={handleInputChange}
        autoFocus
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          opacity: 0,
          zIndex: 1,
          cursor: 'default',
          border: 'none',
          outline: 'none',
        }}
      />

      {/* Интерфейс (pointerEvents: none, чтобы клики проходили в полноэкранный инпут) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        {/* ИКОНКА ЗАМКА */}
        <div
          style={{
            width: 64,
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 15,
          }}
        >
          <div className={shakeActive ? 'anim-shake-translate' : ''}>
            <div className={rotateActive ? 'anim-rotate-success' : ''}>
              <div
                className={
                  pulseActive
                    ? 'anim-pulse-scale'
                    : scaleDownActive
                    ? 'anim-scale-down'
                    : scaleUpActive
                    ? 'anim-scale-up'
                    : ''
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transformOrigin: 'center center',
                }}
              >
                {iconKind === 'CheckBold' && <Icons.CheckBold size={56} color={iconColor} />}
                {iconKind === 'CloseBold' && <Icons.CloseBold size={56} color={iconColor} />}
                {iconKind === 'LockOutline' && <Icons.LockOutline size={56} color={iconColor} />}
              </div>
            </div>
          </div>
        </div>

        {/* ЗАГОЛОВОК */}
        <div
          style={{
            color: 'var(--text-body, #FFFFFF)',
            fontSize: 20,
            fontWeight: 'bold',
            marginBottom: 25,
            textAlign: 'center',
          }}
        >
          Enter Local Passcode
        </div>

        {/* ТОЧКИ-ИНДИКАТОРЫ */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 15 }}>
          {[0, 1, 2, 3].map((index) => {
            const isFilled = passcode.length > index;
            return (
              <div
                key={index}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  margin: '0 8px',
                  boxSizing: 'border-box',
                  border: '2px solid var(--border-primary, #222836)',
                  backgroundColor: isFilled ? 'var(--accent-primary, #1E9BEB)' : 'transparent',
                  transition: 'background-color 0.1s ease',
                }}
              />
            );
          })}
        </div>

        {/* СООБЩЕНИЕ ОБ ОШИБКЕ */}
        <div
          style={{
            color: 'var(--danger-text, #FF5252)',
            fontSize: 13.5,
            fontWeight: 600,
            height: 20,
            marginBottom: 0,
            visibility: hasError ? 'visible' : 'hidden',
            textAlign: 'center',
          }}
        >
          Incorrect passcode
        </div>

        {/* КНОПКА ВЫХОДА (pointerEvents: auto и zIndex: 10 для кликабельности) */}
        <button
          onClick={() => void logOut()}
          className="wpf-passcode-logout-btn"
          style={{
            marginTop: 10,
            pointerEvents: 'auto',
            zIndex: 10,
          }}
        >
          <span className="btn-text">Log Out</span>
          <div className="underline-border" />
        </button>
      </div>
    </div>
  );
};

export default PasscodeLockView;