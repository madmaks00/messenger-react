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
        backgroundColor: '#0A0E17',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* 1. Фоновые неоновые круги с блюром */}
      <div
        style={{
          position: 'absolute',
          top: -235,
          left: -238,
          width: 600,
          height: 600,
          borderRadius: 300,
          backgroundColor: '#3B82F6',
          opacity: 0.06,
          filter: 'blur(120px)',
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
          backgroundColor: '#8B5CF6',
          opacity: 0.06,
          filter: 'blur(120px)',
          pointerEvents: 'none',
        }}
      />

      {/* 2. КАРТОЧКА ВХОДА (LoginCard) */}
      <div
        style={{
          position: 'absolute',
          width: 400,
          backgroundColor: '#161B26',
          borderRadius: 20,
          padding: '40px 35px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          transform: isSignUpMode ? 'translateX(-40px)' : 'translateX(0)',
          opacity: isSignUpMode ? 0 : 1,
          pointerEvents: isSignUpMode ? 'none' : 'auto',
          transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s ease-in-out',
        }}
      >
        <LoginFormUserControl onSwitchToRegister={() => setIsSignUpMode(true)} />
      </div>

      {/* 3. КАРТОЧКА РЕГИСТРАЦИИ (SignUpCard) */}
      <div
        style={{
          position: 'absolute',
          width: 620,
          maxHeight: '90vh',
          backgroundColor: '#161B26',
          borderRadius: 20,
          padding: '35px 35px 30px 35px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          transform: !isSignUpMode ? 'translateX(40px)' : 'translateX(0)',
          opacity: !isSignUpMode ? 0 : 1,
          pointerEvents: !isSignUpMode ? 'none' : 'auto',
          transition: 'transform 0.3s cubic-bezier(0, 0, 0.2, 1), opacity 0.25s ease-in-out',
          boxSizing: 'border-box',
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