import React, { useState } from 'react';
import { mdiAccountMultiple, mdiEmailOutline, mdiCheck } from '@mdi/js';

import { SidebarHeaderUserControl } from '../common/SidebarHeaderUserControl';
import { useAuthStore } from '../../stores/authStore';
import { authService } from '../../services/auth.service';
import { userService } from '../../services/user.service';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import { IUser } from '../../types/models';

export const SidebarAccountsView: React.FC = () => {
  const { savedAccounts, currentUser, switchAccount } = useAuthStore();
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const { containerRef } = useSmoothScroll<HTMLDivElement>({ friction: 0.78, wheelMultiplier: 0.15 });

  const handleDoubleClick = (account: IUser) => {
    switchAccount(account, authService, userService);
  };

  return (
    <div
      style={{
        width: 340,
        height: '100%',
        backgroundColor: 'var(--bg-list)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <SidebarHeaderUserControl title="Accounts" iconPath={mdiAccountMultiple} />

      <div ref={containerRef} className="wpf-scroll-viewer" style={{ flex: 1, padding: '10px 12px' }}>
        {savedAccounts.map((account: IUser) => {
          const isActive = currentUser?.id === account.id;
          const isHovered = hoveredId === account.id;

          return (
            <div
              key={account.id}
              onClick={() => handleDoubleClick(account)}
              onMouseEnter={() => setHoveredId(account.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 14,
                border: isActive
                  ? '1.5px solid var(--app-accent)'
                  : '1.5px solid transparent',
                backgroundColor: isActive
                  ? 'var(--accounts-active-bg)'
                  : isHovered
                  ? 'var(--sidebar-search-bg)'
                  : 'transparent',
                cursor: 'pointer',
                marginBottom: 8,
                boxSizing: 'border-box',
                transition: 'background-color 0.12s ease, border-color 0.12s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                {/* Аватар 46x46 */}
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: 'var(--app-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: 18,
                    overflow: 'hidden',
                    position: 'relative',
                    flexShrink: 0,
                  }}
                >
                  <span>{(account.nickName || 'U').charAt(0).toUpperCase()}</span>
                  {account.avatarPath && (
                    <img
                      src={account.avatarPath}
                      alt=""
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                </div>

                {/* Инфо */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {account.nickName}
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--app-accent)', fontWeight: 600, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    @{account.username?.replace(/^@/, '')}
                  </div>

                  {account.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, fontSize: 12, color: 'var(--text-muted)' }}>
                      <svg viewBox="0 0 24 24" width={13} height={13} fill="var(--text-muted)" style={{ flexShrink: 0 }}>
                        <path d={mdiEmailOutline} />
                      </svg>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {account.email}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Галочка активного */}
              {isActive && (
                <div style={{ marginLeft: 10, flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" width={22} height={22} fill="var(--app-accent)">
                    <path d={mdiCheck} />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SidebarAccountsView;