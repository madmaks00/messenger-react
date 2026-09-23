import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { authService } from '../../services/auth.service';
import { mdiEmailCheckOutline } from '@mdi/js';

export const VerifyEmailFormUserControl: React.FC = () => {
  const { registerUser, initializeSession, clearRegisterFields } = useAuthStore();

  const [verificationCode, setVerificationCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(60);

  const canResend = timerSeconds === 0;

  // 🟢 Таймер повторной отправки (1 в 1 с DispatcherTimer в WPF)
  useEffect(() => {
    if (timerSeconds <= 0) return;

    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerSeconds]);

  // 🟢 Подтверждение кода и завершение регистрации
  const handleConfirmAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.trim().length !== 6 || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await authService.registerAsync(registerUser as any, verificationCode.trim());
      if (res.isSuccess && res.token && res.user) {
        // 🟢 1 в 1 с AuthViewModel.cs EmailVerificationSuccessMessage handler
        useAuthStore.setState({ isVerificationStep: false });
        await initializeSession({ token: res.token, user: res.user });
        clearRegisterFields();
      } else {
        setErrorMessage(res.message || 'Invalid confirmation code.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An error occurred during confirmation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🟢 Повторная отправка кода
  const handleResend = async () => {
    if (!canResend || isSubmitting) return;
    setErrorMessage('');

    try {
      // 🟢 Исправлено: точные имена полей возвращаемого DTO (isSuccess и message)
      const { isSuccess, message } = await authService.requestVerificationCodeAsync(
        registerUser.email!,
        registerUser.username!
      );

      if (isSuccess) {
        setTimerSeconds(60);
      } else {
        setErrorMessage(message || 'Failed to resend confirmation code.');
      }
    } catch {
      setErrorMessage('Failed to resend confirmation code.');
    }
  };

  // 🟢 Кнопка возврата к форме регистрации (WPF BackToRegistrationCommand / CancelEmailVerificationMessage)
  const handleBackToForm = () => {
    useAuthStore.setState({ isVerificationStep: false });
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
    setVerificationCode(numericOnly);
    if (errorMessage) setErrorMessage('');
  };

  return (
    <div style={{ width: 380, margin: '0 auto', textAlign: 'center', userSelect: 'none' }}>
      {/* 🟢 Иконка PackIcon Kind="EmailCheckOutline" (70x70) */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 15 }}>
        <svg viewBox="0 0 24 24" width={70} height={70} fill="var(--app-accent, #1E9BEB)">
          <path d={mdiEmailCheckOutline} />
        </svg>
      </div>

      {/* Заголовок Verify Your Email */}
      <h2 style={{ fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', margin: '0 0 6px 0' }}>
        Verify Your Email
      </h2>

      {/* Подзаголовок */}
      <div style={{ fontSize: 13.5, color: '#7D8494' }}>
        We have sent a 6-digit confirmation code to:
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--app-accent, #1E9BEB)',
          margin: '2px 0 25px 0',
          wordBreak: 'break-all',
        }}
      >
        {registerUser.email}
      </div>

      <form onSubmit={handleConfirmAndRegister}>
        {/* Инпут 6-значного кода */}
        <div
          style={{
            position: 'relative',
            marginBottom: 15,
            borderBottom: '2px solid var(--app-accent, #1E9BEB)',
          }}
        >
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            placeholder={verificationCode.length === 0 ? 'Enter 6-digit code' : ''}
            value={verificationCode}
            onChange={handleCodeChange}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              fontSize: 24,
              fontWeight: 'bold',
              textAlign: 'center',
              letterSpacing: verificationCode.length > 0 ? 8 : 'normal',
              outline: 'none',
              caretColor: 'var(--app-accent, #1E9BEB)',
              padding: '6px 0',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Блок ошибки (MinHeight="22" как в WPF) */}
        <div
          style={{
            minHeight: 22,
            color: '#FF4D4D',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {errorMessage}
        </div>

        {/* Кнопка подтверждения (Height="50", CornerRadius="10") */}
        <button
          type="submit"
          disabled={isSubmitting || verificationCode.length !== 6}
          style={{
            width: '100%',
            height: 50,
            borderRadius: 10,
            backgroundColor: 'var(--app-accent, #1E9BEB)',
            color: '#FFFFFF',
            border: 'none',
            fontSize: 15,
            fontWeight: 'bold',
            cursor: verificationCode.length === 6 && !isSubmitting ? 'pointer' : 'default',
            opacity: verificationCode.length === 6 && !isSubmitting ? 1 : 0.6,
            boxShadow: '0 5px 20px rgba(30, 155, 235, 0.35)',
            transition: 'opacity 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          {isSubmitting ? 'Verifying...' : 'Confirm & Register'}
        </button>

        {/* Таймер / Повторная отправка Resend */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 20, fontSize: 13 }}>
          <span style={{ color: '#7D8494' }}>Didn't get the code? </span>
          <button
            type="button"
            onClick={handleResend}
            disabled={!canResend || isSubmitting}
            style={{
              background: 'transparent',
              border: 'none',
              color: canResend ? 'var(--app-accent, #1E9BEB)' : '#64748B',
              fontWeight: 'bold',
              cursor: canResend && !isSubmitting ? 'pointer' : 'default',
              padding: 0,
            }}
          >
            Resend
          </button>
          {!canResend && <span style={{ color: '#7D8494' }}>({timerSeconds}s)</span>}
        </div>

        {/* Кнопка возврата к форме (Back to form) */}
        <button
          type="button"
          onClick={handleBackToForm}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#7D8494',
            fontSize: 13,
            cursor: 'pointer',
            marginTop: 15,
            padding: 4,
          }}
        >
          Back to form
        </button>
      </form>
    </div>
  );
};