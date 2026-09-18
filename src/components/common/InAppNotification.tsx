// src/components/common/InAppNotification.tsx
import React from 'react';
import { useNotificationStore } from '../../stores/notificationStore';

export const InAppNotification: React.FC = () => {
  const { notifications, removeNotification } = useNotificationStore();

  if (notifications.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      {notifications.map((n) => (
        <div
          key={n.id}
          style={{
            width: 320,
            backgroundColor: '#1E2330',
            border: '1px solid #334155',
            borderRadius: 12,
            padding: '12px 14px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            pointerEvents: 'auto',
            animation: 'fadeIn 0.22s ease-out',
          }}
        >
          {/* Аватар */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#3B82F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFF',
              fontWeight: 'bold',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {n.avatar ? (
              <img src={n.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              n.title.charAt(0).toUpperCase()
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 'bold', color: '#FFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {n.title}
            </div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {n.message}
            </div>
          </div>

          <button
            onClick={() => removeNotification(n.id)}
            style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 14 }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};