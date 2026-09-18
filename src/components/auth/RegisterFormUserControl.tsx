import React, { useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { authService } from '../../services/auth.service';
interface RegisterFormUserControlProps {
  title?: string;
  subtitle?: string;
  onSwitchToLogin: () => void;
}

const GENDER_OPTIONS = ['Not specified', 'Male', 'Female'];

export const RegisterFormUserControl: React.FC<RegisterFormUserControlProps> = ({
  title = 'Create Account',
  subtitle = 'Join MAKC messenger today',
  onSwitchToLogin,
}) => {
  const {
    registerUser,
    confirmPassword,
    registerErrorMessage,
    setRegisterField,
    setConfirmPassword,
    requestCodeAndGoToVerification,
  } = useAuthStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setRegisterField('avatar', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestCodeAndGoToVerification(authService);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Заголовок и подзаголовок */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', margin: '0 0 4px 0' }}>{title}</h2>
        <div style={{ fontSize: 13, color: '#A0AAB8' }}>{subtitle}</div>
      </div>

      {/* Скроллируемая область полей */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 6, maxHeight: 520 }}>
        {/* Аватарка + Имя + Фамилия + Дата рождения + Пол */}
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 20, marginBottom: 15, alignItems: 'start' }}>
          {/* Круг выбора аватара */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 110,
              height: 110,
              borderRadius: 55,
              border: '2px solid var(--app-accent, #3B82F6)',
              backgroundColor: '#1E2330',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {registerUser.avatar ? (
              <img src={registerUser.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 32, color: '#A0AAB8' }}>📷</span>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
            <div style={inputGroupStyle}>
              <label style={floatingHintStyle}>First Name</label>
              <input
                type="text"
                value={registerUser.firstName || ''}
                onChange={(e) => setRegisterField('firstName', e.target.value)}
                style={cleanInputUnderlineStyle}
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={floatingHintStyle}>Last Name</label>
              <input
                type="text"
                value={registerUser.lastName || ''}
                onChange={(e) => setRegisterField('lastName', e.target.value)}
                style={cleanInputUnderlineStyle}
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={floatingHintStyle}>Date of Birth</label>
              <input
                type="date"
                value={registerUser.birthday || ''}
                onChange={(e) => setRegisterField('birthday', e.target.value)}
                style={{ ...cleanInputUnderlineStyle, colorScheme: 'dark' }}
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={floatingHintStyle}>Gender</label>
              <select
                value={registerUser.gender || GENDER_OPTIONS[0]}
                onChange={(e) => setRegisterField('gender', e.target.value)}
                style={{ ...cleanInputUnderlineStyle, backgroundColor: '#1E2330', cursor: 'pointer' }}
              >
                {GENDER_OPTIONS.map((g) => (
                  <option key={g} value={g} style={{ background: '#1E2330', color: '#FFF' }}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Сетка основных учетных данных */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 10 }}>
          <div style={inputGroupStyle}>
            <label style={floatingHintStyle}>Nickname</label>
            <input
              type="text"
              required
              value={registerUser.nickName || ''}
              onChange={(e) => setRegisterField('nickName', e.target.value)}
              style={cleanInputUnderlineStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={floatingHintStyle}>Username</label>
            <input
              type="text"
              required
              value={registerUser.username || ''}
              onChange={(e) => setRegisterField('username', e.target.value)}
              style={cleanInputUnderlineStyle}
            />
          </div>

          <div style={{ ...inputGroupStyle, gridColumn: 'span 2' }}>
            <label style={floatingHintStyle}>Profile Description</label>
            <textarea
              rows={2}
              value={registerUser.description || ''}
              onChange={(e) => setRegisterField('description', e.target.value)}
              style={{ ...cleanInputUnderlineStyle, resize: 'none', height: 60 }}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={floatingHintStyle}>Phone Number</label>
            <input
              type="tel"
              value={registerUser.phone || ''}
              onChange={(e) => setRegisterField('phone', e.target.value)}
              style={cleanInputUnderlineStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={floatingHintStyle}>Email address</label>
            <input
              type="email"
              required
              value={registerUser.email || ''}
              onChange={(e) => setRegisterField('email', e.target.value)}
              style={cleanInputUnderlineStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={floatingHintStyle}>Password</label>
            <input
              type="password"
              required
              value={registerUser.password || ''}
              onChange={(e) => setRegisterField('password', e.target.value)}
              style={cleanInputUnderlineStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={floatingHintStyle}>Confirm Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={cleanInputUnderlineStyle}
            />
          </div>
        </div>
      </div>

      {/* Ошибка валидации и кнопка создания */}
      <div style={{ marginTop: 10 }}>
        <div style={{ minHeight: 22, color: '#FF4D4D', fontSize: 13.5, fontWeight: 600, textAlign: 'center', marginBottom: 8 }}>
          {registerErrorMessage}
        </div>

        <button
          type="submit"
          style={{
            width: '100%',
            height: 50,
            borderRadius: 10,
            backgroundColor: 'var(--app-accent, #3B82F6)',
            color: '#FFFFFF',
            border: 'none',
            fontSize: 16,
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 5px 20px rgba(59, 130, 246, 0.4)',
          }}
        >
          Create Account
        </button>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14, fontSize: 14 }}>
          <span style={{ color: '#A0AAB8' }}>Have another account?</span>
          <span
            onClick={onSwitchToLogin}
            style={{ color: 'var(--app-accent, #3B82F6)', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'none' }}
          >
            Log In
          </span>
        </div>
      </div>
    </form>
  );
};

const inputGroupStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
};

const floatingHintStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#A0AAB8',
  marginBottom: 4,
  fontWeight: 500,
};

const cleanInputUnderlineStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
  color: '#FFFFFF',
  fontSize: 15,
  padding: '6px 0',
  outline: 'none',
  transition: 'border-color 0.2s',
};