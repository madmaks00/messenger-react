import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { authService } from '../../services/auth.service';
import { userService } from '../../services/user.service';
import { mdiSendVariant, mdiEye, mdiEyeOff } from '@mdi/js';

interface LoginFormUserControlProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  onSwitchToRegister: () => void;
}

export const LoginFormUserControl: React.FC<LoginFormUserControlProps> = ({
  title = 'Welcome Back',
  subtitle = 'Log in to continue to MAKC',
  showLogo = true,
  onSwitchToRegister,
}) => {
  const { loginUser, loginErrorMessage, setLoginField, login } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userFocused, setUserFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUser.username || !loginUser.password || loading) return;

    setLoading(true);
    try {
      await login(authService, userService);
    } finally {
      setLoading(false);
    }
  };

  const hasUsername = Boolean(loginUser.username && loginUser.username.length > 0);
  const hasPassword = Boolean(loginUser.password && loginUser.password.length > 0);
  const hasError = Boolean(loginErrorMessage && loginErrorMessage.length > 0);

  const isUserActive = userFocused || hasUsername;
  const isPassActive = passFocused || hasPassword;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
      {/* 🟢 ЛОГОТИП MAKC: ВЫРАВНИВАНИЕ ПО ОПТИЧЕСКОМУ ЦЕНТРУ */}
      {showLogo && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginBottom: 14,
          }}
        >
          {/* Контейнер самолетика с поворотом */}
          <div
            style={{
              position: 'relative',
              width: 72,
              height: 72,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: 'rotate(-20deg)',
              flexShrink: 0,
            }}
          >
            {/* Размытая неоновая тень */}
            <svg
              viewBox="0 0 24 24"
              width={64}
              height={64}
              style={{
                position: 'absolute',
                fill: 'var(--app-accent, #1E9BEB)',
                opacity: 0.35,
                filter: 'blur(14px)',
              }}
            >
              <path d={mdiSendVariant} />
            </svg>

            {/* Четкая иконка */}
            <svg
              viewBox="0 0 24 24"
              width={64}
              height={64}
              style={{
                position: 'relative',
                fill: 'var(--app-accent, #1E9BEB)',
                filter: 'drop-shadow(0 0 12px rgba(30, 155, 235, 0.8))',
              }}
            >
              <path d={mdiSendVariant} />
            </svg>
          </div>

          {/* Текст MAKC, смещенный строго в центр высоты повернутого самолетика */}
          <span
            style={{
              color: '#FFFFFF',
              fontSize: 48,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: '0.5px',
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
              transform: 'translateY(7px)', // Смещение вниз под оптический центр самолетика
            }}
          >
            MAKC
          </span>
        </div>
      )}

      {/* Заголовок и подзаголовок */}
      <h1 style={{ color: '#FFFFFF', fontSize: 28, fontWeight: 'bold', textAlign: 'center', margin: '0 0 4px 0' }}>
        {title}
      </h1>
      <div style={{ color: '#7D8494', fontSize: 14, textAlign: 'center', margin: '0 0 28px 0' }}>
        {subtitle}
      </div>

      {/* 🟢 ИНПУТ: USERNAME */}
      <div style={{ position: 'relative', marginBottom: 22 }}>
        <div
          style={{
            position: 'relative',
            borderBottom: `1px solid ${hasError ? '#FF4D4D' : '#232836'}`,
            padding: '16px 0 6px 0',
          }}
        >
          <label
            style={{
              position: 'absolute',
              left: 0,
              top: 16,
              fontSize: 15,
              color: hasError ? '#FF4D4D' : userFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.56)',
              transformOrigin: 'top left',
              transform: isUserActive ? 'translateY(-19px) scale(0.8)' : 'translateY(0) scale(1)',
              transition: 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), color 0.18s ease',
              pointerEvents: 'none',
            }}
          >
            Username
          </label>
          <input
            type="text"
            required
            value={loginUser.username || ''}
            onFocus={() => setUserFocused(true)}
            onBlur={() => setUserFocused(false)}
            onChange={(e) => setLoginField('username', e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              fontSize: 15,
              outline: 'none',
              caretColor: 'var(--app-accent, #1E9BEB)',
              boxSizing: 'border-box',
              padding: 0,
              margin: 0,
            }}
          />
          {/* Активная полоса снизу */}
          <div
            style={{
              position: 'absolute',
              bottom: -1,
              left: 0,
              right: 0,
              height: 2,
              backgroundColor: hasError ? '#FF4D4D' : 'var(--app-accent, #1E9BEB)',
              transform: userFocused || hasError ? 'scaleX(1)' : 'scaleX(0)',
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      </div>

      {/* 🟢 ИНПУТ: PASSWORD */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <div
          style={{
            position: 'relative',
            borderBottom: `1px solid ${hasError ? '#FF4D4D' : '#232836'}`,
            padding: '16px 30px 6px 0',
          }}
        >
          <label
            style={{
              position: 'absolute',
              left: 0,
              top: 16,
              fontSize: 15,
              color: hasError ? '#FF4D4D' : passFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.56)',
              transformOrigin: 'top left',
              transform: isPassActive ? 'translateY(-19px) scale(0.8)' : 'translateY(0) scale(1)',
              transition: 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), color 0.18s ease',
              pointerEvents: 'none',
            }}
          >
            Password
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={loginUser.password || ''}
            onFocus={() => setPassFocused(true)}
            onBlur={() => setPassFocused(false)}
            onChange={(e) => setLoginField('password', e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              fontSize: 15,
              outline: 'none',
              caretColor: 'var(--app-accent, #1E9BEB)',
              boxSizing: 'border-box',
              padding: 0,
              margin: 0,
            }}
          />
          {/* Кнопка скрытия/показа пароля */}
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: 0,
              bottom: 6,
              background: 'transparent',
              border: 'none',
              color: '#7D8494',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg viewBox="0 0 24 24" width={20} height={20} fill="#7D8494">
              <path d={showPassword ? mdiEyeOff : mdiEye} />
            </svg>
          </button>

          {/* Активная полоса снизу */}
          <div
            style={{
              position: 'absolute',
              bottom: -1,
              left: 0,
              right: 0,
              height: 2,
              backgroundColor: hasError ? '#FF4D4D' : 'var(--app-accent, #1E9BEB)',
              transform: passFocused || hasError ? 'scaleX(1)' : 'scaleX(0)',
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      </div>

      {/* Ссылка Forgot Password */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 15 }}>
        <button
          type="button"
          className="wpf-link-button"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--app-accent, #1E9BEB)',
            fontSize: 13,
            fontWeight: 'bold',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <span>Forgot password?</span>
        </button>
      </div>

      {/* Ошибка валидации / сервера */}
      <div
        style={{
          minHeight: 22,
          color: '#FF4D4D',
          fontSize: 13.5,
          fontWeight: 600,
          textAlign: 'center',
          marginBottom: 12,
          opacity: hasError ? 1 : 0,
          transition: 'opacity 0.15s ease',
        }}
      >
        {loginErrorMessage}
      </div>

      {/* Кнопка Log In */}
      <button
        type="submit"
        disabled={loading}
        style={{
          height: 50,
          borderRadius: 10,
          backgroundColor: 'var(--app-accent, #1E9BEB)',
          color: '#FFFFFF',
          border: 'none',
          fontSize: 16,
          fontWeight: 'bold',
          cursor: loading ? 'wait' : 'pointer',
          boxShadow: '0 5px 20px rgba(30, 155, 235, 0.4)',
          transition: 'box-shadow 0.2s ease, opacity 0.2s ease',
          opacity: loading ? 0.8 : 1,
        }}
      >
        {loading ? 'Logging in...' : 'Log In'}
      </button>

      {/* Переход к Sign Up */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 15 }}>
        <span style={{ color: '#7D8494', fontSize: 14 }}>Don't have an account?</span>
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="wpf-link-button"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--app-accent, #1E9BEB)',
            fontSize: 14,
            fontWeight: 'bold',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <span>Sign Up</span>
        </button>
      </div>
    </form>
  );
};