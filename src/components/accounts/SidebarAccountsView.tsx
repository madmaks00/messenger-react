import React from 'react';
import { useAuthStore } from '../../stores/authStore';
import { authService } from '../../services/auth.service';
import { userService } from '../../services/user.service';
import { IUser } from '../../types/models';

export const SidebarAccountsView: React.FC = () => {
  const { savedAccounts, currentUser, switchAccount } = useAuthStore();

  const handleDoubleClick = (account: IUser) => {
    switchAccount(account, authService, userService);
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      {/* 1. ШАПКА: ЗАГОЛОВОК */}
      <div style={{ height: 52, padding: '0 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #1E293B' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 'bold', color: '#FFF' }}>
          <span>👥</span>
          <span>Accounts</span>
        </div>
      </div>

      {/* 2. СПИСОК АККАУНТОВ */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '15px 15px 20px 15px' }}>
        {savedAccounts.map((account) => {
          const isActive = currentUser?.id === account.id;

          return (
            <div
              key={account.id}
              onDoubleClick={() => handleDoubleClick(account)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 12,
                border: isActive ? '1.5px solid var(--app-accent, #3B82F6)' : '1.5px solid transparent',
                backgroundColor: isActive ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                cursor: 'pointer',
                marginBottom: 8,
                transition: 'background-color 0.15s',
                userSelect: 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                {/* Аватарка 46x46 */}
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: '#3B82F6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFF',
                    fontWeight: 'bold',
                    fontSize: 16,
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {account.avatar || account.avatarPath ? (
                    <img src={account.avatar || account.avatarPath!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    account.nickName.charAt(0).toUpperCase()
                  )}
                </div>

                {/* Информация об аккаунте */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {account.nickName}
                  </div>
                  <div style={{ fontSize: 13, color: isActive ? 'var(--app-accent, #38BDF8)' : '#94A3B8', fontWeight: isActive ? 600 : 'normal', marginTop: 1 }}>
                    @{account.username}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.85, marginTop: 2, fontSize: 12, color: '#94A3B8' }}>
                    <span>✉</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{account.email}</span>
                  </div>
                </div>
              </div>

              {/* Иконка активного аккаунта */}
              {isActive && (
                <span style={{ color: 'var(--app-accent, #3B82F6)', fontSize: 20, fontWeight: 'bold', marginLeft: 8 }}>
                  ✓
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};