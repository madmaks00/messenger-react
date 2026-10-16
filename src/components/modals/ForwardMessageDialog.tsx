import { DialogFrame } from './DialogFrame';
import React, { useState, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { getAvatarColor, normalizeAvatarUrl } from '../../utils/helpers';

export interface ForwardMessageDialogProps {
  isOpen?: boolean;
  onCancel?: () => void;
  onConfirm?: (chatIds?: any) => void;
}

export const ForwardMessageDialog: React.FC<ForwardMessageDialogProps> = ({
  isOpen: propIsOpen,
  onCancel: propOnCancel,
  onConfirm: propOnConfirm,
}) => {
  const store = useChatStore();

  const isDialogOpen = propIsOpen !== undefined ? propIsOpen : store.isForwardDialogOpen;
  const cancelForward = propOnCancel || store.cancelForward;
  const confirmForward = propOnConfirm || store.confirmForward;

  const {
    forwardChatList,
    toggleSelectForwardChat,
  } = store;

  const [isRendered, setIsRendered] = useState(isDialogOpen);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [cachedList, setCachedList] = useState(forwardChatList);

  useEffect(() => {
    if (isDialogOpen && forwardChatList.length > 0) {
      setCachedList(forwardChatList);
    }
  }, [isDialogOpen, forwardChatList]);

  useEffect(() => {
    if (isDialogOpen) {
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
        cancelForward();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRendered, cancelForward]);

  if (!isRendered) return null;

  const displayList = isDialogOpen ? forwardChatList : cachedList;
  const hasSelected = displayList.some((c) => c.isSelected);

  return (
    <DialogFrame isOpen={isDialogOpen} kind="forward">
    <div
      onClick={cancelForward}
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
        .app-dialog-forward .btn-close {
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
        .app-dialog-forward .btn-close:hover {
          background-color: var(--surface-hover, rgba(255, 255, 255, 0.08)) !important;
          color: #FFFFFF !important;
        }
        .app-dialog-forward .btn-close:active {
          background-color: var(--surface-hover, rgba(255, 255, 255, 0.16)) !important;
        }

        .app-dialog-forward .btn-cancel {
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
        .app-dialog-forward .btn-cancel:hover {
          background-color: var(--surface-hover, rgba(255, 255, 255, 0.08)) !important;
          color: #FFFFFF !important;
        }
        .app-dialog-forward .btn-cancel:active {
          background-color: var(--surface-hover, rgba(255, 255, 255, 0.14)) !important;
        }

        .app-dialog-forward .btn-primary {
          height: 34px;
          padding: 0 18px;
          background-color: var(--accent-primary, #1E9BEB) !important;
          border: none;
          border-radius: 7px;
          color: #FFFFFF !important;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          outline: none;
          transition: opacity 0.15s ease, background-color 0.15s ease !important;
        }
        .app-dialog-forward .btn-primary:hover:not(:disabled) {
          opacity: 0.9 !important;
        }
        .app-dialog-forward .btn-primary:active:not(:disabled) {
          opacity: 0.8 !important;
        }
        .app-dialog-forward .btn-primary:disabled {
          background-color: var(--surface-hover, #232A3B) !important;
          color: var(--surface-hover, #4B5563) !important;
          cursor: default !important;
          opacity: 1 !important;
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 340,
          maxWidth: '92vw',
          backgroundColor: 'var(--surface-panel, #161A23)',
          borderRadius: 12,
          padding: '10px 0',
          boxShadow: '0 20px 50px var(--shadow-colour, rgba(0, 0, 0, 0.65))',
          border: '1px solid var(--border-primary, #2A3342)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '82vh',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            margin: '5px 20px 15px',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-body, #FFFFFF)' }}>
            Forward to...
          </span>


        </div>

        <div
          className="wpf-scroll-viewer"
          style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: 300,
            margin: '0 0 10px',
            padding: 0,
            boxSizing: 'border-box',
          }}
        >
          {displayList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '25px 10px', color: 'var(--text-secondary, #7D8494)', fontSize: 13.5 }}>
              No chats available
            </div>
          ) : (
            displayList.map((item) => {
              const chat = item.chat;
              const uniqueKey = chat.isSecretChat
                ? `s_${chat.secretChatId || chat.id}`
                : chat.isGroup
                ? `g_${chat.groupId || chat.id}`
                : `u_${chat.userId || chat.id}`;

              const isSelected = item.isSelected;
              const avatarSrc = normalizeAvatarUrl(chat.avatarPath || (chat as any).avatar);
              const displayName = (chat.isGroup ? chat.groupName : chat.nickName) || 'Chat';
              const chatType = chat.isChannel ? 'Channel' : chat.isGroup ? 'Group' : 'Personal';

              return (
                <div
                  className={`forward-row ${isSelected ? 'selected' : ''}`}
                  key={uniqueKey}
                  onClick={() => toggleSelectForwardChat(uniqueKey)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 15px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--surface-accent, rgba(30, 155, 235, 0.12))' : 'transparent',
                    border: 'none',
                    marginBottom: 2,
                    transition: 'background-color 0.12s ease, border-color 0.12s ease',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--surface-hover, rgba(255, 255, 255, 0.05))';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ position: 'relative', width: 40, height: 40, marginRight: 12, flexShrink: 0 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: getAvatarColor(chat.isGroup ? (chat.groupId || 0) : Number(chat.userId || chat.id || 0)),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                        fontWeight: 'bold',
                        fontSize: 13.5,
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      <span>{displayName.charAt(0).toUpperCase()}</span>
                      {avatarSrc && (
                        <img
                          src={avatarSrc}
                          alt=""
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      )}
                    </div>

                    {(
                      <div
                        className="forward-check"
                        style={{
                          position: 'absolute',
                          bottom: -2,
                          right: -2,
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          backgroundColor: '#22C55E',
                          border: '2px solid var(--border-primary, #161B26)',
                          color: 'var(--text-body, #FFFFFF)',
                          fontSize: 9.5,
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transform: isSelected ? 'scale(1)' : 'scale(0)',
                        }}
                      >
                        ✓
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        color: 'var(--text-body, #FFFFFF)',
                        fontSize: 15,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        transition: 'color 0.12s ease',
                      }}
                    >
                      {displayName}
                    </div>
                    <div style={{ color: 'var(--text-secondary, #7D8494)', fontSize: 12, marginTop: 2 }}>{chatType}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginRight: 10 }}>
          <button
            type="button"
            onClick={cancelForward}
            className="btn-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirmForward()}
            disabled={!hasSelected}
            className="btn-primary"
          >
            Forward
          </button>
        </div>
      </div>
    </div>
    </DialogFrame>
  );
};

export default ForwardMessageDialog;