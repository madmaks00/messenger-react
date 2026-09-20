import React, { useState } from 'react';
import { mdiAccountSwitchOutline, mdiEmailOutline, mdiCheckCircle } from '@mdi/js';

import { SidebarHeaderUserControl } from '../common/SidebarHeaderUserControl';
import { useAuthStore } from '../../stores/authStore';
import { authService } from '../../services/auth.service';
import { userService } from '../../services/user.service';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import { normalizeAvatarUrl, getAvatarColor } from '../../utils/helpers';
import { IUser } from '../../types/models';

export const SidebarAccountsView: React.FC = () => {
  const { savedAccounts, currentUser, switchAccount } = useAuthStore();
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const { containerRef } = useSmoothScroll<HTMLDivElement>({ friction: 0.78, wheelMultiplier: 0.15 });

  const handleAccountSwitch = (account: IUser) => {
    switchAccount(account, authService, userService);
  };

  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        height: '100%',
        backgroundColor: '#161A23', // BgList
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. ШАПКА: ЗАГОЛОВОК (WPF: IconKind="AccountSwitchOutline") */}
      <SidebarHeaderUserControl title="Accounts" iconPath={mdiAccountSwitchOutline} />

      {/* 2. СПИСОК АККАУНТОВ (WPF: ScrollViewer Margin="15,0,15,20") */}
      <div
        ref={containerRef}
        className="wpf-scroll-viewer"
        style={{
          flex: 1,
          width: '100%',
          padding: '0 15px 20px 15px', // WPF: Margin="15,0,15,20"
          boxSizing: 'border-box',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {savedAccounts.map((account: IUser) => {
            const isActive = currentUser?.id === account.id;
            const isHovered = hoveredId === account.id;

            const avatarRaw =
              account.avatarPath ||
              (account as any).avatar ||
              (account as any).Avatar ||
              (account as any).avatarUrl;
            const avatarSrc = normalizeAvatarUrl(avatarRaw);
            const avatarBg = getAvatarColor(account.id || 0);
            const firstLetter = (account.nickName || account.username || 'U').charAt(0).toUpperCase();

            return (
              <div
                key={account.id}
                onClick={() => handleAccountSwitch(account)}
                onDoubleClick={() => handleAccountSwitch(account)}
                onMouseEnter={() => setHoveredId(account.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: 10, // WPF: Padding="10"
                  borderRadius: 12, // WPF: CornerRadius="12"
                  border: isActive
                    ? '1.5px solid rgba(30, 155, 235, 0.2)' // WPF: AccountsActiveItemBorderBrush (#331E9BEB)
                    : '1.5px solid transparent',
                  backgroundColor: isActive
                    ? 'rgba(30, 155, 235, 0.1)' // WPF: AccountsActiveItemBgBrush (#1A1E9BEB)
                    : isHovered
                    ? '#1C212D' // WPF: AccountsItemHoverBgBrush
                    : 'transparent',
                  cursor: 'pointer',
                  marginBottom: 6,
                  boxSizing: 'border-box',
                  transition: 'background-color 0.12s ease, border-color 0.12s ease',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
                  {/* Аватарка (WPF: Width="46" Height="46" VerticalAlignment="Top" Margin="0,2,15,0") */}
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      backgroundColor: avatarBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      fontWeight: 'bold', // WPF: FontWeight="Bold"
                      fontSize: 16, // WPF: FontSize="16"
                      overflow: 'hidden',
                      position: 'relative',
                      flexShrink: 0,
                      marginTop: 2, // WPF: Margin="0,2,15,0"
                      marginRight: 15,
                    }}
                  >
                    <span>{firstLetter}</span>
                    {avatarSrc && (
                      <img
                        src={avatarSrc}
                        alt=""
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                  </div>

                  {/* ИНФОРМАЦИЯ ОБ АККАУНТЕ */}
                  <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {/* NickName (WPF: FontSize="16" FontWeight="SemiBold" Margin="0,-2,6,2") */}
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 600, // WPF: SemiBold
                        color: '#FFFFFF', // AccountsItemNameBrush
                        marginTop: -2,
                        marginBottom: 2,
                        marginRight: 6,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.2,
                      }}
                    >
                      {account.nickName || account.username || 'User'}
                    </div>

                    {/* UsernameText (WPF: FontSize="13" Margin="0,0,0,1") */}
                    <div
                      style={{
                        fontSize: 13,
                        color: isActive ? '#1E9BEB' : '#7D8494', // WPF Trigger: AppAccentBrush : TextMuted
                        fontWeight: isActive ? 600 : 400, // WPF Trigger: SemiBold : Normal
                        marginBottom: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.2,
                      }}
                    >
                      @{account.username?.replace(/^@/, '')}
                    </div>

                    {/* Email (WPF: Orientation="Horizontal" Opacity="0.85") */}
                    {account.email && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          opacity: 0.85,
                          marginTop: 1,
                        }}
                      >
                        {/* materialDesign:PackIcon Kind="EmailOutline" Width="14" Height="14" Margin="0,0,6,0" */}
                        <svg
                          viewBox="0 0 24 24"
                          width={14}
                          height={14}
                          fill="#7D8494"
                          style={{ marginRight: 6, flexShrink: 0 }}
                        >
                          <path d={mdiEmailOutline} />
                        </svg>
                        <span
                          style={{
                            fontSize: 12, // WPF: FontSize="12"
                            color: '#7D8494', // TextMuted
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {account.email}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 🟢 Иконка галочки (WPF: Kind="CheckCircle" Width="24" Height="24" VerticalAlignment="Top" Margin="0,2,0,0") */}
                {isActive && (
                  <div
                    style={{
                      marginLeft: 10,
                      marginTop: 2, // WPF: Margin="0,2,0,0"
                      flexShrink: 0,
                      alignSelf: 'flex-start',
                    }}
                  >
                    <svg viewBox="0 0 24 24" width={24} height={24} fill="#1E9BEB">
                      <path d={mdiCheckCircle} />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SidebarAccountsView;