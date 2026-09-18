import React, { useState } from 'react';

interface PinMessageDialogProps {
  isOpen: boolean;
  pinDialogTitle?: string;
  pinForAllText?: string;
  canPinForAll?: boolean;
  actionText?: string;
  onCancel: () => void;
  onConfirm: (pinForAll: boolean) => void;
}

export const PinMessageDialog: React.FC<PinMessageDialogProps> = ({
  isOpen,
  pinDialogTitle = 'Do you want to pin this message?',
  pinForAllText = 'Pin for everyone',
  canPinForAll = true,
  actionText = 'Pin',
  onCancel,
  onConfirm,
}) => {
  const [pinForAll, setPinForAll] = useState(true);

  if (!isOpen) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 340,
          backgroundColor: '#1E2330',
          borderRadius: 12,
          padding: '20px 20px 12px 20px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
          border: '1px solid #334155',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: '#FFF', marginBottom: 20 }}>
          {pinDialogTitle}
        </div>

        {canPinForAll && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 25, fontSize: 15, color: '#E2E8F0' }}>
            <input
              type="checkbox"
              checked={pinForAll}
              onChange={(e) => setPinForAll(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#3B82F6' }}
            />
            <span>{pinForAllText}</span>
          </label>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '6px 15px' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(pinForAll)}
            style={{ background: 'transparent', border: 'none', color: 'var(--app-accent, #3B82F6)', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', padding: '6px 15px' }}
          >
            {actionText}
          </button>
        </div>
      </div>
    </div>
  );
};