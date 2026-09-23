import React, { useState } from 'react';
import { LoginFormUserControl } from './LoginFormUserControl';
import { RegisterFormUserControl } from './RegisterFormUserControl';
import { VerifyEmailFormUserControl } from './VerifyEmailFormUserControl';
import { useAuthStore } from '../../stores/authStore';

export const LoginView: React.FC = () => {
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const { isVerificationStep } = useAuthStore();

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#11141B',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      {/* 🟢 1. НЕОНОВЫЕ СФЕРЫ С BLUR EFFECT 200px (1 в 1 с WPF) */}
      <div
        style={{
          position: 'absolute',
          top: -235,
          left: -238,
          width: 600,
          height: 600,
          borderRadius: 300,
          backgroundColor: 'var(--app-accent, #1E9BEB)',
          opacity: 0.06,
          filter: 'blur(200px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -297,
          right: -222,
          width: 600,
          height: 600,
          borderRadius: 300,
          backgroundColor: '#8E44AD',
          opacity: 0.06,
          filter: 'blur(200px)',
          pointerEvents: 'none',
        }}
      />

      {/* 🟢 2. КАРТОЧКА ВХОДА (Ширина 400px, анимация GoToSignUp / GoToLogin) */}
      <div
        style={{
          position: 'absolute',
          width: 400,
          backgroundColor: '#161A23',
          borderRadius: 20,
          padding: '40px 35px',
          boxShadow: '0 10px 50px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          boxSizing: 'border-box',
          transform: isSignUpMode ? 'translateX(-40px)' : 'translateX(0)',
          opacity: isSignUpMode ? 0 : 1,
          visibility: isSignUpMode ? 'hidden' : 'visible',
          pointerEvents: isSignUpMode ? 'none' : 'auto',
          transition: isSignUpMode
            ? 'transform 0.25s cubic-bezier(0.32, 0, 0.67, 0), opacity 0.2s cubic-bezier(0.32, 0, 0.67, 0)'
            : 'transform 0.3s cubic-bezier(0.33, 1, 0.68, 1) 0.08s, opacity 0.25s cubic-bezier(0.33, 1, 0.68, 1) 0.08s',
        }}
      >
        <LoginFormUserControl onSwitchToRegister={() => setIsSignUpMode(true)} />
      </div>

      {/* 🟢 3. КАРТОЧКА РЕГИСТРАЦИИ (Ширина 600px, MaxHeight 800px) */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          maxHeight: 800,
          backgroundColor: '#161A23',
          borderRadius: 20,
          padding: '40px 35px 35px 35px',
          boxShadow: '0 10px 50px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          boxSizing: 'border-box',
          transform: !isSignUpMode ? 'translateX(40px)' : 'translateX(0)',
          opacity: !isSignUpMode ? 0 : 1,
          visibility: !isSignUpMode ? 'hidden' : 'visible',
          pointerEvents: !isSignUpMode ? 'none' : 'auto',
          transition: !isSignUpMode
            ? 'transform 0.25s cubic-bezier(0.32, 0, 0.67, 0), opacity 0.2s cubic-bezier(0.32, 0, 0.67, 0)'
            : 'transform 0.3s cubic-bezier(0.33, 1, 0.68, 1) 0.08s, opacity 0.25s cubic-bezier(0.33, 1, 0.68, 1) 0.08s',
        }}
      >
        {!isVerificationStep ? (
          <RegisterFormUserControl onSwitchToLogin={() => setIsSignUpMode(false)} />
        ) : (
          <VerifyEmailFormUserControl />
        )}
      </div>
    </div>
  );
};