import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SecurityService } from '../../services/security.service';
import { useAuthStore } from '../../stores/authStore';

// =========================================================================
// ВЕКТОРНЫЕ ИКОНКИ MATERIAL DESIGN (1:1 PackIconKind из PasscodeLockView.xaml)
// =========================================================================
const Icons = {
  LockOutline: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 56} height={props.size || 56} viewBox="0 0 24 24" fill={props.color || '#1E9BEB'}>
      <path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.89,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z" />
    </svg>
  ),
  CheckBold: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 56} height={props.size || 56} viewBox="0 0 24 24" fill={props.color || '#4CAF50'}>
      <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" />
    </svg>
  ),
  CloseBold: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 56} height={props.size || 56} viewBox="0 0 24 24" fill={props.color || '#FF5252'}>
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
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Состояния анимации иконки замка (1:1 с WPF TransformGroup)
  const [iconKind, setIconKind] = useState<'LockOutline' | 'CheckBold' | 'CloseBold'>('LockOutline');
  const [iconColor, setIconColor] = useState<string>('#1E9BEB');
  const [iconRotate, setIconRotate] = useState<number>(0);
  const [iconScale, setIconScale] = useState<number>(1.0);
  const [iconTranslateX, setIconTranslateX] = useState<number>(0);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // 1:1 UserControl_IsVisibleChanged
  useEffect(() => {
    if (isLocked) {
      setPasscode('');
      setHasError(false);
      setIconKind('LockOutline');
      setIconColor('#1E9BEB');
      setIconRotate(0);
      setIconScale(1.0);
      setIconTranslateX(0);
      setIsRotating(false);
      setIsShaking(false);
      setIsAnimating(false);

      const timer = setTimeout(() => {
        focusInput();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isLocked, focusInput]);

  // 1:1 AnimateSuccessAndUnlock() из PasscodeLockView.xaml.cs
  const animateSuccessAndUnlock = useCallback(async () => {
    // Вращение на 360° за 200ms
    setIsRotating(true);
    setIconRotate(360);

    // Через 130ms смена иконки на CheckBold (#4CAF50) и масштабирование
    await new Promise((resolve) => setTimeout(resolve, 130));
    setIconKind('CheckBold');
    setIconColor('#4CAF50');
    setIconScale(1.25);

    await new Promise((resolve) => setTimeout(resolve, 100));
    setIconScale(1.0);

    // Пауза 350ms перед снятием блокировки
    await new Promise((resolve) => setTimeout(resolve, 350));

    setPasscode('');
    onUnlock();

    // Сброс иконки в исходное состояние
    setIconKind('LockOutline');
    setIconColor('#1E9BEB');
    setIconRotate(0);
    setIsRotating(false);
  }, [onUnlock]);

  // 1:1 AnimateFailureAndReset() из PasscodeLockView.xaml.cs
  const animateFailureAndReset = useCallback(async () => {
    setHasError(true);
    setIconKind('CloseBold');
    setIconColor('#FF5252');

    // Тряска замка влево-вправо (-8px / +8px, 45ms, 3 цикла)
    setIsShaking(true);

    await new Promise((resolve) => setTimeout(resolve, 300));
    setIsShaking(false);
    setIconTranslateX(0);

    // Масштабирование в 0 (100ms)
    setIconScale(0.0);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Возврат иконки замка и восстановление масштаба в 1.0 (120ms)
    setIconKind('LockOutline');
    setIconColor('#1E9BEB');
    setIconScale(1.0);

    await new Promise((resolve) => setTimeout(resolve, 120));

    setPasscode('');
    focusInput();
  }, [focusInput]);

  // 1:1 PasscodeHiddenInput_TextChanged
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isAnimating) return;

    const text = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPasscode(text);

    if (hasError) {
      setHasError(false);
    }

    if (text.length === 4) {
      setIsAnimating(true);
      const isCorrect = await SecurityService.verifyPasscode(text);

      if (isCorrect) {
        await animateSuccessAndUnlock();
      } else {
        await animateFailureAndReset();
      }

      setIsAnimating(false);
    }
  };

  if (!isLocked) return null;

  return (
    <div
      onClick={focusInput}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#0C1017', // DynamicResource PasscodeOverlay
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
      }}
    >
      <style>{`
        @keyframes wpfShakeAnimation {
          0% { transform: translateX(0px); }
          16% { transform: translateX(-8px); }
          33% { transform: translateX(8px); }
          50% { transform: translateX(-8px); }
          66% { transform: translateX(8px); }
          83% { transform: translateX(-8px); }
          100% { transform: translateX(0px); }
        }

        .wpf-passcode-logout-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0;
        }

        .wpf-passcode-logout-btn .btn-text {
          color: #7A8490; /* DynamicResource PasscodeHintBrush */
          font-size: 14px;
          transition: color 0.2s ease;
        }

        .wpf-passcode-logout-btn .underline-border {
          height: 1px;
          width: 100%;
          background-color: #7A8490; /* DynamicResource PasscodeHintBrush */
          margin-top: 1px;
          transform: scaleX(0);
          transform-origin: center;
          transition: transform 0.2s cubic-bezier(0, 0, 0.2, 1);
        }

        .wpf-passcode-logout-btn:hover .btn-text {
          color: #FFFFFF;
        }

        .wpf-passcode-logout-btn:hover .underline-border {
          background-color: #FFFFFF;
          transform: scaleX(1);
          transition: transform 0.25s cubic-bezier(0, 0, 0.2, 1);
        }
      `}</style>

      {/* Невидимый input для скрытого перехвата ввода (1:1 PasscodeHiddenInput) */}
      <input
        ref={inputRef}
        type="password"
        maxLength={4}
        value={passcode}
        onChange={handleInputChange}
        autoFocus
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          width: 0,
          height: 0,
          border: 'none',
          padding: 0,
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* 1. ИКОНКА ЗАМКА С АНИМАЦИЯМИ (1:1 XAML TransformGroup) */}
        <div
          style={{
            width: 64,
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 15,
            transform: `scale(${iconScale}) rotate(${iconRotate}deg) translateX(${iconTranslateX}px)`,
            transition: isShaking
              ? 'none'
              : isRotating
              ? 'transform 0.2s cubic-bezier(0.65, 0, 0.35, 1)'
              : 'transform 0.12s ease-out',
            animation: isShaking ? 'wpfShakeAnimation 0.27s ease-in-out' : 'none',
          }}
        >
          {iconKind === 'CheckBold' && <Icons.CheckBold size={56} color={iconColor} />}
          {iconKind === 'CloseBold' && <Icons.CloseBold size={56} color={iconColor} />}
          {iconKind === 'LockOutline' && <Icons.LockOutline size={56} color={iconColor} />}
        </div>

        {/* 2. ЗАГОЛОВОК */}
        <div
          style={{
            color: '#FFFFFF', // DynamicResource PasscodeHeaderBrush
            fontSize: 20,
            fontWeight: 'bold',
            marginBottom: 25,
            textAlign: 'center',
          }}
        >
          Enter Local Passcode
        </div>

        {/* 3. ТОЧКИ-ИНДИКАТОРЫ (1:1 StackPanel Margins & Ellipses) */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 15 }}>
          {[0, 1, 2, 3].map((index) => {
            const isFilled = passcode.length > index;
            return (
              <div
                key={index}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  margin: '0 8px',
                  boxSizing: 'border-box',
                  border: '2px solid #222836', // DynamicResource PasscodeDotStrokeBrush
                  backgroundColor: isFilled ? '#1E9BEB' : 'transparent', // DynamicResource AppAccentBrush
                  transition: 'background-color 0.1s ease',
                }}
              />
            );
          })}
        </div>

        {/* 4. СООБЩЕНИЕ ОБ ОШИБКЕ (1:1 Visibility="Hidden" с сохранением верстки) */}
        <div
          style={{
            color: '#FF5252',
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

        {/* 5. КНОПКА ВЫХОДА ИЗ АККАУНТА (1:1 ControlTemplate Triggers) */}
        <button
          onClick={() => void logOut()}
          className="wpf-passcode-logout-btn"
          style={{ marginTop: 10 }}
        >
          <span className="btn-text">Log Out</span>
          <div className="underline-border" />
        </button>
      </div>
    </div>
  );
};

export default PasscodeLockView;