import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { authService } from '../../services/auth.service';

export const VerifyEmailFormUserControl: React.FC = () => {
  const { registerUser, initializeSession, closeAccountManagement } = useAuthStore();

  const [verificationCode, setVerificationCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Таймер повторной отправки кода (ResendTimerSeconds)
  const [timerSeconds, setTimerSeconds] = useState(60);
  const canResend = timerSeconds === 0;

  useEffect(() => {
    if (timerSeconds > 0) {
      const interval = setInterval(() => setTimerSeconds((s) => s - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timerSeconds]);

  const handleConfirmAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.trim().length !== 6 || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await authService.registerAsync(registerUser, verificationCode.trim());
      if (res.isSuccess && res.token && res.user) {
        await initializeSession({ token: res.token, user: res.user });
      } else {
        setErrorMessage(res.message || 'Invalid confirmation code.');
      }
    } catch {
      setErrorMessage('An error occurred during confirmation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setErrorMessage('');
    try {
      await authService.requestVerificationCodeAsync(registerUser.email!, registerUser.username!);
      setTimerSeconds(60);
    } catch {
      setErrorMessage('Failed to resend confirmation code.');
    }
  };

  return (
    <div style={{ width: 380, margin: '0 auto', textAlign: 'center' }}>
      {/* Иконка EmailCheckOutline (70x70) */}
      <div style={{ fontSize: 56, color: 'var(--app-accent, #3B82F6)', marginBottom: 15 }}>
        ✉️
      </div>

      <h2 style={{ fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', margin: '0 0 6px 0' }}>
        Verify Your Email
      </h2>

      <div style={{ fontSize: 13.5, color: '#A0AAB8' }}>
        We have sent a 6-digit confirmation code to:
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-accent, #38BDF8)', margin: '2px 0 25px 0' }}>
        {registerUser.email}
      </div>

      <form onSubmit={handleConfirmAndRegister}>
        {/* Поле ввода 6-значного кода */}
        <div style={{ marginBottom: 15 }}>
          <input
            type="text"
            maxLength={6}
            placeholder="Enter 6-digit code"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              borderBottom: '2px solid var(--app-accent, #3B82F6)',
              color: '#FFFFFF',
              fontSize: 24,
              fontWeight: 'bold',
              textAlign: 'center',
              letterSpacing: 6,
              outline: 'none',
              padding: '6px 0',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Ошибка */}
        <div style={{ minHeight: 22, color: '#FF4D4D', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          {errorMessage}
        </div>

        {/* Кнопка подтверждения */}
        <button
          type="submit"
          disabled={isSubmitting || verificationCode.length !== 6}
          style={{
            width: '100%',
            height: 50,
            borderRadius: 10,
            backgroundColor: 'var(--app-accent, #3B82F6)',
            color: '#FFFFFF',
            border: 'none',
            fontSize: 15,
            fontWeight: 'bold',
            cursor: verificationCode.length === 6 ? 'pointer' : 'default',
            opacity: verificationCode.length === 6 ? 1 : 0.6,
          }}
        >
          {isSubmitting ? 'Verifying...' : 'Confirm & Register'}
        </button>

        {/* Повторная отправка с таймером */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 20, fontSize: 13 }}>
          <span style={{ color: '#A0AAB8' }}>Didn't get the code?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={!canResend}
            style={{
              background: 'transparent',
              border: 'none',
              color: canResend ? 'var(--app-accent, #38BDF8)' : '#64748B',
              fontWeight: 'bold',
              cursor: canResend ? 'pointer' : 'default',
              padding: 0,
            }}
          >
            Resend
          </button>
          {!canResend && <span style={{ color: '#A0AAB8' }}>({timerSeconds}s)</span>}
        </div>

        {/* Кнопка назад к заполнению формы */}
        <button
          type="button"
          onClick={closeAccountManagement}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#A0AAB8',
            fontSize: 13,
            cursor: 'pointer',
            marginTop: 15,
          }}
        >
          Back to form
        </button>
      </form>
    </div>
  );
};