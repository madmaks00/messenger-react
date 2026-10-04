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
      }, 120);
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

  const displayList = forwardChatList.length > 0 ? forwardChatList : cachedList;
  const hasSelected = displayList.some((c) => c.isSelected);

  return (
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
        .btn-close {
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
        .btn-close:hover {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: #FFFFFF !important;
        }
        .btn-close:active {
          background-color: rgba(255, 255, 255, 0.16) !important;
        }

        .btn-cancel {
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
        .btn-cancel:hover {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: #FFFFFF !important;
        }
        .btn-cancel:active {
          background-color: rgba(255, 255, 255, 0.14) !important;
        }

        .btn-primary {
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
          transition: opacity 0.15s ease, background-color 0.15s ease !important;
        }
        .btn-primary:hover:not(:disabled) {
          opacity: 0.9 !important;
        }
        .btn-primary:active:not(:disabled) {
          opacity: 0.8 !important;
        }
        .btn-primary:disabled {
          background-color: #232A3B !important;
          color: #4B5563 !important;
          cursor: default !important;
          opacity: 1 !important;
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 340,
          maxWidth: '92vw',
          backgroundColor: '#161B26',
          borderRadius: 12,
          padding: '16px 18px 14px 18px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
          border: '1px solid #2A3342',
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
            marginBottom: 12,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 600, color: '#FFFFFF' }}>
            Forward to...
          </span>

          <button
            type="button"
            onClick={cancelForward}
            className="btn-close"
            title="Close"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div
          className="wpf-scroll-viewer"
          style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: 280,
            margin: '0 -8px 14px 0',
            padding: '0 8px 0 0',
            boxSizing: 'border-box',
          }}
        >
          {displayList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '25px 10px', color: '#7D8494', fontSize: 13.5 }}>
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
                  key={uniqueKey}
                  onClick={() => toggleSelectForwardChat(uniqueKey)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '7px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(30, 155, 235, 0.12)' : 'transparent',
                    border: `1px solid ${isSelected ? 'rgba(30, 155, 235, 0.3)' : 'transparent'}`,
                    marginBottom: 3,
                    transition: 'background-color 0.12s ease, border-color 0.12s ease',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ position: 'relative', width: 36, height: 36, marginRight: 10, flexShrink: 0 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
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

                    {isSelected && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: -2,
                          right: -2,
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          backgroundColor: '#22C55E',
                          border: '2px solid #161B26',
                          color: '#FFFFFF',
                          fontSize: 9.5,
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transform: 'scale(1)',
                        }}
                      >
                        ✓
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        color: isSelected ? '#1E9BEB' : '#FFFFFF',
                        fontSize: 14,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        transition: 'color 0.12s ease',
                      }}
                    >
                      {displayName}
                    </div>
                    <div style={{ color: '#7D8494', fontSize: 11.5, marginTop: 1 }}>{chatType}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
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
  );
};

export default ForwardMessageDialog;