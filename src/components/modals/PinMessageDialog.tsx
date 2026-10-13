import { DialogFrame } from './DialogFrame';
import React, { useState, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';

export interface PinMessageDialogProps {
  isOpen?: boolean;
  onCancel?: () => void;
  onConfirm?: (pinForAll: boolean) => void;
}

export const PinMessageDialog: React.FC<PinMessageDialogProps> = ({
  isOpen: propIsOpen,
  onCancel: propOnCancel,
  onConfirm: propOnConfirm,
}) => {
  const store = useChatStore();

  const isDialogOpen = propIsOpen !== undefined ? propIsOpen : store.isPinDialogOpen;
  const cancelPin = propOnCancel || store.cancelPin;
  const confirmPin = propOnConfirm || store.confirmPin;

  const {
    pinDialogTitle,
    pinDialogActionText,
    pinForAllText,
    canPinForAll,
  } = store;

  const [pinForAll, setPinForAll] = useState(true);
  const [isRendered, setIsRendered] = useState(isDialogOpen);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (isDialogOpen) {
      setPinForAll(true);
      setIsRendered(true);
      setIsFadingOut(false);
    } else if (isRendered) {
      setIsFadingOut(true);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setIsFadingOut(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isDialogOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isRendered) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelPin();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRendered, cancelPin]);

  if (!isRendered) return null;

  return (
    <DialogFrame isOpen={isDialogOpen} kind="pin">
    <div
      onClick={cancelPin}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        boxSizing: 'border-box',
        padding: 16,
        opacity: isFadingOut ? 0 : 1,
        transition: 'opacity 0.12s ease-out',
      }}
    >
      <style>{`
        .app-dialog-pin .btn-close {
          width: 26px !important;
          height: 26px !important;
          padding: 0 !important;
          border-radius: 50% !important;
          background-color: transparent !important;
          color: #7D8494 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          border: none !important;
          outline: none !important;
          transition: background-color 0.15s ease, color 0.15s ease !important;
        }
        .app-dialog-pin .btn-close:hover {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: #FFFFFF !important;
        }
        .app-dialog-pin .btn-close:active {
          background-color: rgba(255, 255, 255, 0.16) !important;
        }

        .app-dialog-pin .btn-cancel {
          height: 34px;
          padding: 0 14px;
          background-color: transparent !important;
          border: none;
          border-radius: 7px;
          color: #7D8494 !important;
          font-weight: 500;
          font-size: 13px;
          cursor: pointer;
          outline: none;
          transition: background-color 0.15s ease, color 0.15s ease !important;
        }
        .app-dialog-pin .btn-cancel:hover {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: #FFFFFF !important;
        }
        .app-dialog-pin .btn-cancel:active {
          background-color: rgba(255, 255, 255, 0.14) !important;
        }

        .app-dialog-pin .btn-primary {
          height: 34px;
          padding: 0 18px;
          background-color: #1E9BEB !important;
          border: none;
          border-radius: 7px;
          color: #FFFFFF !important;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          outline: none;
          transition: opacity 0.15s ease !important;
        }
        .app-dialog-pin .btn-primary:hover {
          opacity: 0.9 !important;
        }
        .app-dialog-pin .btn-primary:active {
          opacity: 0.8 !important;
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 340,
          maxWidth: '92vw',
          backgroundColor: '#161A23',
          borderRadius: 12,
          padding: '16px 18px 14px 18px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
          border: '1px solid #2A3342',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 600, color: '#FFFFFF' }}>
            {pinDialogActionText === 'Unpin' ? 'Unpin Message' : 'Pin Message'}
          </span>

          <button
            type="button"
            onClick={cancelPin}
            className="btn-close"
            title="Close"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div style={{ fontSize: 14.5, color: '#FFFFFF', lineHeight: '21px', marginBottom: 14, wordBreak: 'break-word' }}>
          {pinDialogTitle || 'Do you want to pin this message?'}
        </div>

        {canPinForAll && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              cursor: 'pointer',
              marginBottom: 18,
              fontSize: 14,
              color: '#FFFFFF',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={pinForAll}
              onChange={(e) => setPinForAll(e.target.checked)}
              style={{ width: 17, height: 17, accentColor: '#1E9BEB', cursor: 'pointer' }}
            />
            <span style={{ color: '#E2E8F0' }}>{pinForAllText || 'Also apply for everyone'}</span>
          </label>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={cancelPin}
            className="btn-cancel"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => void confirmPin(pinForAll)}
            className="btn-primary"
          >
            {pinDialogActionText || 'Pin'}
          </button>
        </div>
      </div>
    </div>
    </DialogFrame>
  );
};

export default PinMessageDialog;