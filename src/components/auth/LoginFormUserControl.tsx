import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { authService } from '../../services/auth.service';
import { userService } from '../../services/user.service';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUser.username || !loginUser.password || loading) return;

    setLoading(true);
    await login(authService, userService);
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
      {showLogo && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              color: '#FFF',
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.35)',
            }}
          >
            💬
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: 25 }}>
        <h2 style={{ fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', margin: '0 0 4px 0' }}>{title}</h2>
        <div style={{ fontSize: 13, color: '#A0AAB8' }}>{subtitle}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 15 }}>
        <div>
          <label style={{ fontSize: 12, color: '#A0AAB8', display: 'block', marginBottom: 4 }}>Username or Email</label>
          <input
            type="text"
            required
            value={loginUser.username || ''}
            onChange={(e) => setLoginField('username', e.target.value)}
            style={cleanInputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: '#A0AAB8', display: 'block', marginBottom: 4 }}>Password</label>
          <input
            type="password"
            required
            value={loginUser.password || ''}
            onChange={(e) => setLoginField('password', e.target.value)}
            style={cleanInputStyle}
          />
        </div>
      </div>

      <div style={{ minHeight: 22, color: '#FF4D4D', fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 10 }}>
        {loginErrorMessage}
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          height: 50,
          borderRadius: 10,
          backgroundColor: 'var(--app-accent, #3B82F6)',
          color: '#FFFFFF',
          border: 'none',
          fontSize: 16,
          fontWeight: 'bold',
          cursor: loading ? 'wait' : 'pointer',
          boxShadow: '0 5px 20px rgba(59, 130, 246, 0.4)',
        }}
      >
        {loading ? 'Logging in...' : 'Log In'}
      </button>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 18, fontSize: 14 }}>
        <span style={{ color: '#A0AAB8' }}>Don't have an account?</span>
        <span
          onClick={onSwitchToRegister}
          style={{ color: 'var(--app-accent, #3B82F6)', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Sign Up
        </span>
      </div>
    </form>
  );
};

const cleanInputStyle: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
  color: '#FFFFFF',
  fontSize: 15,
  padding: '8px 0',
  outline: 'none',
  boxSizing: 'border-box',
};