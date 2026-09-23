import React from 'react';
import { useAuthStore } from '../../stores/authStore';
import { LoginFormUserControl } from '../auth/LoginFormUserControl';
import { RegisterFormUserControl } from '../auth/RegisterFormUserControl';
import { VerifyEmailFormUserControl } from '../auth/VerifyEmailFormUserControl';

export const AccountManagementContentView: React.FC = () => {
  const { isAddingNewAccount, isVerificationStep, openRegistration, closeAccountManagement } = useAuthStore();

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        backgroundColor: '#11141B', // 🟢 Заменен на WPF #FF11141B
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {/* 1. КАРТОЧКА ВХОДА (ADD ACCOUNT) */}
      {!isAddingNewAccount ? (
        <div
          style={{
            width: 400,
            backgroundColor: '#161B26',
            borderRadius: 20,
            padding: '40px 30px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            animation: 'fadeIn 0.25s ease-out',
          }}
        >
          <LoginFormUserControl
            title="Add Account"
            subtitle="Connect another profile to MAKC"
            showLogo={true}
            onSwitchToRegister={openRegistration}
          />
        </div>
      ) : (
        /* 2. КАРТОЧКА РЕГИСТРАЦИИ (CREATE ACCOUNT) */
        <div
          style={{
            width: 600,
            maxHeight: '90vh',
            backgroundColor: '#161B26',
            borderRadius: 20,
            padding: '35px 35px 30px 35px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            animation: 'fadeIn 0.25s ease-out',
            boxSizing: 'border-box',
          }}
        >
          {!isVerificationStep ? (
            <RegisterFormUserControl
              title="Create Account"
              subtitle="Create and switch anytime"
              onSwitchToLogin={closeAccountManagement}
            />
          ) : (
            <VerifyEmailFormUserControl />
          )}
        </div>
      )}
    </div>
  );
};