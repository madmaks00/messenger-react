import React, { useRef, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { authService } from '../../services/auth.service';
import { mdiCameraPlus, mdiEye, mdiEyeOff } from '@mdi/js';
import { type IUser } from '../../types/models';

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
    registerFieldErrors,
    setRegisterField,
    setRegisterUserBatch,
    setConfirmPassword,
    requestCodeAndGoToVerification,
  } = useAuthStore();

  const formRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

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

  // 🟢 Синхронизация автозаполнения Chrome перед отправкой запроса
  const syncAutofillFromDom = () => {
    if (!formRef.current) return;
    const form = formRef.current;
    const batch: Partial<IUser> = {};

    const getVal = (name: string): string => {
      const input = form.querySelector(`input[name="${name}"], textarea[name="${name}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
      return input ? input.value : '';
    };

    const firstName = getVal('firstName');
    const lastName = getVal('lastName');
    const nickName = getVal('nickName');
    const username = getVal('username');
    const phone = getVal('phone');
    const email = getVal('email');
    const password = getVal('password');
    const description = getVal('description');
    const birthday = getVal('birthday');

    if (firstName && firstName !== registerUser.firstName) batch.firstName = firstName;
    if (lastName && lastName !== registerUser.lastName) batch.lastName = lastName;
    if (nickName && nickName !== registerUser.nickName) batch.nickName = nickName;
    if (username && username !== registerUser.username) batch.username = username;
    if (phone && phone !== registerUser.phone) batch.phone = phone;
    if (email && email !== registerUser.email) batch.email = email;
    if (password && password !== registerUser.password) batch.password = password;
    if (description && description !== registerUser.description) batch.description = description;
    if (birthday && birthday !== registerUser.birthday) batch.birthday = birthday;

    if (Object.keys(batch).length > 0) {
      setRegisterUserBatch(batch);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    syncAutofillFromDom();

    setLoading(true);
    try {
      await requestCodeAndGoToVerification(authService);
    } finally {
      setLoading(false);
    }
  };

  const renderFloatingInput = (
    label: string,
    field: string,
    value: string,
    onChange: (val: string) => void,
    type: string = 'text',
    isPasswordBox: boolean = false,
    showPassToggle: boolean = false,
    onTogglePass?: () => void
  ) => {
    const isFocused = focusedField === field;
    const hasValue = Boolean(value && value.length > 0);
    // 🟢 Точечная ошибка: поле становится красным ТОЛЬКО если упала его личная валидация!
    const hasError = Boolean(registerFieldErrors[field]);
    const isFieldActive = isFocused || hasValue;

    return (
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <div
          style={{
            position: 'relative',
            borderBottom: `1px solid ${hasError ? '#FF4D4D' : '#232836'}`,
            padding: `13px ${isPasswordBox ? '30px' : '0'} 3px 0`,
          }}
        >
          <label
            style={{
              position: 'absolute',
              left: 0,
              top: 13,
              fontSize: 14.5,
              color: hasError ? '#FF4D4D' : isFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.56)',
              transformOrigin: 'top left',
              transform: isFieldActive ? 'translateY(-17px) scale(0.8)' : 'translateY(0) scale(1)',
              transition: 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), color 0.18s ease',
              pointerEvents: 'none',
            }}
          >
            {label}
          </label>
          <input
            name={field}
            type={type}
            value={value}
            onFocus={() => setFocusedField(field)}
            onBlur={() => setFocusedField(null)}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              fontSize: 14.5,
              outline: 'none',
              caretColor: 'var(--app-accent, #1E9BEB)',
              boxSizing: 'border-box',
              padding: 0,
              margin: 0,
            }}
          />
          {isPasswordBox && onTogglePass && (
            <button
              type="button"
              onClick={onTogglePass}
              style={{
                position: 'absolute',
                right: 0,
                bottom: 4,
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
              <svg viewBox="0 0 24 24" width={19} height={19} fill="#7D8494">
                <path d={showPassToggle ? mdiEyeOff : mdiEye} />
              </svg>
            </button>
          )}
          <div
            style={{
              position: 'absolute',
              bottom: -1,
              left: 0,
              right: 0,
              height: 2,
              backgroundColor: hasError ? '#FF4D4D' : 'var(--app-accent, #1E9BEB)',
              transform: isFocused || hasError ? 'scaleX(1)' : 'scaleX(0)',
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="makc-register-form"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* 🟢 ПОДАВЛЕНИЕ БЕЛОГО АВТОЗАПОЛНЕНИЯ В ХРОМЕ */}
      <style>{`
        .makc-register-form input:-webkit-autofill,
        .makc-register-form input:-webkit-autofill:hover,
        .makc-register-form input:-webkit-autofill:focus,
        .makc-register-form input:-webkit-autofill:active,
        .makc-register-form textarea:-webkit-autofill,
        .makc-register-form select:-webkit-autofill {
          -webkit-text-fill-color: #FFFFFF !important;
          caret-color: var(--app-accent, #1E9BEB) !important;
          -webkit-box-shadow: 0 0 0 1000px #141824 inset !important;
          box-shadow: 0 0 0 1000px #141824 inset !important;
          transition: background-color 5000000s ease-in-out 0s;
        }

        .makc-register-form div:has(input:-webkit-autofill) label {
          transform: translateY(-17px) scale(0.8) !important;
          color: rgba(255, 255, 255, 0.7) !important;
        }
      `}</style>

      {/* 🟢 ШАПКА */}
      <div style={{ flexShrink: 0, marginBottom: 14 }}>
        <h1 style={{ color: '#FFFFFF', fontSize: 26, fontWeight: 'bold', textAlign: 'center', margin: '0 0 2px 0' }}>
          {title}
        </h1>
        <div style={{ color: '#7D8494', fontSize: 13, textAlign: 'center', margin: 0 }}>
          {subtitle}
        </div>
      </div>

      {/* 🟢 ОБЛАСТЬ ПОЛЕЙ */}
      <div
        className="wpf-scroll-viewer"
        style={{
          flex: '1 1 auto',
          maxHeight: 'min(410px, calc(100vh - 240px))',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: 6,
          boxSizing: 'border-box',
        }}
      >
        {/* Аватар + Имя + Фамилия + Дата рождения + Пол */}
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14, marginBottom: 4, alignItems: 'start' }}>
          {/* Круг аватара */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 104,
                height: 104,
                borderRadius: 52,
                backgroundColor: '#232836',
                border: '2px solid var(--app-accent, #1E9BEB)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                boxSizing: 'border-box',
              }}
            >
              {registerUser.avatar ? (
                <img
                  src={registerUser.avatar}
                  alt="Avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <svg viewBox="0 0 24 24" width={38} height={38} fill="#7D8494">
                  <path d={mdiCameraPlus} />
                </svg>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {renderFloatingInput('First Name', 'firstName', registerUser.firstName || '', (v) => setRegisterField('firstName', v))}
            {renderFloatingInput('Last Name', 'lastName', registerUser.lastName || '', (v) => setRegisterField('lastName', v))}

            {/* DatePicker */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <div
                style={{
                  borderBottom: `1px solid ${registerFieldErrors.birthday ? '#FF4D4D' : '#232836'}`,
                  padding: '13px 0 3px 0',
                  position: 'relative',
                }}
              >
                <label
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 13,
                    fontSize: 14.5,
                    color: registerFieldErrors.birthday
                      ? '#FF4D4D'
                      : focusedField === 'birthday'
                      ? '#FFFFFF'
                      : 'rgba(255, 255, 255, 0.56)',
                    transformOrigin: 'top left',
                    transform: 'translateY(-17px) scale(0.8)',
                    pointerEvents: 'none',
                  }}
                >
                  Date of Birth
                </label>
                <input
                  name="birthday"
                  type="date"
                  value={registerUser.birthday || ''}
                  onFocus={() => setFocusedField('birthday')}
                  onBlur={() => setFocusedField(null)}
                  onChange={(e) => setRegisterField('birthday', e.target.value)}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: 14.5,
                    outline: 'none',
                    colorScheme: 'dark',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    padding: 0,
                    margin: 0,
                  }}
                />
              </div>
            </div>

            {/* ComboBox Gender */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <div style={{ borderBottom: '1px solid #232836', padding: '13px 0 3px 0', position: 'relative' }}>
                <label
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 13,
                    fontSize: 14.5,
                    color: focusedField === 'gender' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.56)',
                    transformOrigin: 'top left',
                    transform: 'translateY(-17px) scale(0.8)',
                    pointerEvents: 'none',
                  }}
                >
                  Gender
                </label>
                <select
                  name="gender"
                  value={registerUser.gender ?? GENDER_OPTIONS[0]}
                  onFocus={() => setFocusedField('gender')}
                  onBlur={() => setFocusedField(null)}
                  onChange={(e) => setRegisterField('gender', e.target.value)}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: 14.5,
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    padding: 0,
                    margin: 0,
                  }}
                >
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g} style={{ backgroundColor: '#1E2330', color: '#FFFFFF' }}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Сетка остальных полей */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {renderFloatingInput('Nickname', 'nickName', registerUser.nickName || '', (v) => setRegisterField('nickName', v))}
          {renderFloatingInput('Username', 'username', registerUser.username || '', (v) => setRegisterField('username', v))}

          {/* Description */}
          <div style={{ gridColumn: 'span 2', position: 'relative', marginBottom: 12 }}>
            <div
              style={{
                borderBottom: `1px solid ${registerFieldErrors.description ? '#FF4D4D' : '#232836'}`,
                padding: '13px 0 3px 0',
                position: 'relative',
              }}
            >
              <label
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 13,
                  fontSize: 14.5,
                  color: registerFieldErrors.description
                    ? '#FF4D4D'
                    : focusedField === 'description'
                    ? '#FFFFFF'
                    : 'rgba(255, 255, 255, 0.56)',
                  transformOrigin: 'top left',
                  transform:
                    focusedField === 'description' || registerUser.description
                      ? 'translateY(-17px) scale(0.8)'
                      : 'translateY(0) scale(1)',
                  transition: 'transform 0.18s ease, color 0.18s ease',
                  pointerEvents: 'none',
                }}
              >
                Profile Description
              </label>
              <textarea
                name="description"
                value={registerUser.description || ''}
                onFocus={() => setFocusedField('description')}
                onBlur={() => setFocusedField(null)}
                onChange={(e) => setRegisterField('description', e.target.value)}
                style={{
                  width: '100%',
                  height: 52,
                  background: 'transparent',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: 14.5,
                  outline: 'none',
                  resize: 'none',
                  boxSizing: 'border-box',
                  padding: 0,
                  margin: 0,
                }}
              />
            </div>
          </div>

          {renderFloatingInput('Phone Number', 'phone', registerUser.phone || '', (v) => setRegisterField('phone', v), 'tel')}
          {renderFloatingInput('Email address', 'email', registerUser.email || '', (v) => setRegisterField('email', v), 'email')}

          {renderFloatingInput(
            'Password',
            'password',
            registerUser.password || '',
            (v) => setRegisterField('password', v),
            showPassword ? 'text' : 'password',
            true,
            showPassword,
            () => setShowPassword(!showPassword)
          )}

          {renderFloatingInput(
            'Confirm Password',
            'confirmPassword',
            confirmPassword,
            (v) => setConfirmPassword(v),
            showConfirm ? 'text' : 'password',
            true,
            showConfirm,
            () => setShowConfirm(!showConfirm)
          )}
        </div>
      </div>

      {/* 🟢 ФУТЕР */}
      <div style={{ flexShrink: 0, marginTop: 10 }}>
        <div
          style={{
            minHeight: 18,
            color: '#FF4D4D',
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'center',
            marginBottom: 6,
            opacity: registerErrorMessage ? 1 : 0,
            transition: 'opacity 0.15s ease',
          }}
        >
          {registerErrorMessage}
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 10,
            backgroundColor: 'var(--app-accent, #1E9BEB)',
            color: '#FFFFFF',
            border: 'none',
            fontSize: 15.5,
            fontWeight: 'bold',
            cursor: loading ? 'wait' : 'pointer',
            boxShadow: '0 5px 20px rgba(30, 155, 235, 0.4)',
            opacity: loading ? 0.8 : 1,
            transition: 'opacity 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          {loading ? 'Creating...' : 'Create Account'}
        </button>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <span style={{ color: '#7D8494', fontSize: 13.5 }}>Have another account?</span>
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="wpf-link-button"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--app-accent, #1E9BEB)',
              fontSize: 13.5,
              fontWeight: 'bold',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <span>Log In</span>
          </button>
        </div>
      </div>
    </form>
  );
};