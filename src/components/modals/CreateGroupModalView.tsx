import React, { useState, useEffect, useRef, useCallback } from 'react';
import { groupService } from '../../services/group.service';
import { userSession } from '../../services/userSession';
import { eventBus } from '../../services/eventBus';
import { IChatListItem } from '../../types/models';
import { LastMessageType } from '../../types/enums';

interface CreateGroupModalViewProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated?: (chat: IChatListItem) => void;
}

export const CreateGroupModalView: React.FC<CreateGroupModalViewProps> = ({
  isOpen,
  onClose,
  onGroupCreated,
}) => {
  // ===================== Observable Properties (WPF State) =====================
  const [step, setStep] = useState<1 | 2>(1);
  const [isCreatingChannel, setIsCreatingChannel] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [newGroupDescription, setNewGroupDescription] = useState<string>('');
  const [isPublicGroup, setIsPublicGroup] = useState<boolean>(false);
  const [newGroupUsername, setNewGroupUsername] = useState<string>('');
  const [newGroupInviteLink, setNewGroupInviteLink] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Аватарка: бинарный вид (byte[] / base64) и ImageSource для превью
  const [avatarBytes, setAvatarBytes] = useState<Uint8Array | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  // Состояние фокуса для ModernTextBoxStyle
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Анимация модального окна (DialogOverlayFadeInStoryboard / DialogOverlayFadeOutStoryboard)
  const [isRendered, setIsRendered] = useState<boolean>(isOpen);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ===================== Сброс формы (ResetGroupCreation) =====================
  const resetGroupCreation = useCallback(() => {
    setNewGroupName('');
    setNewGroupDescription('');
    setIsCreatingChannel(false);
    setIsPublicGroup(false);
    setNewGroupUsername('');
    setNewGroupInviteLink('');
    setErrorMessage('');
    setAvatarBytes(null);
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }
    setAvatarPreviewUrl(null);
    setStep(1);
    setIsCopied(false);
    setFocusedField(null);
  }, [avatarPreviewUrl]);

  // Управление открытием/закрытием с учетом Storyboard-анимаций WPF
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsFadingOut(false);
      resetGroupCreation();
    } else if (isRendered) {
      setIsFadingOut(true);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setIsFadingOut(false);
        resetGroupCreation();
      }, 100); // 0:0:0.1 в WPF DialogOverlayFadeOutStoryboard
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Обработка Esc (IsCancel="True")
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isRendered) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRendered, onClose]);

  // ===================== SelectGroupAvatarCommand =====================
  const handleSelectAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      setAvatarBytes(new Uint8Array(buffer));

      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
      const preview = URL.createObjectURL(file);
      setAvatarPreviewUrl(preview);
    } catch (err) {
      console.error('[GroupCreationVM ERROR] Не удалось прочитать файл аватарки группы.', err);
    } finally {
      // Сброс значения инпута для возможности повторного выбора того же файла
      e.target.value = '';
    }
  };

  // ===================== CreateGroupCommand =====================
  const handleCreateGroup = async () => {
    setErrorMessage('');

    // 1. Валидация названия
    if (!newGroupName.trim()) {
      setErrorMessage('Please enter a group name.');
      return;
    }

    // 2. Валидация юзернейма публичной группы (1 в 1 с Regex в C#)
    if (isPublicGroup) {
      if (!newGroupUsername.trim()) {
        setErrorMessage('Please enter a username for the public group/channel.');
        return;
      }

      const cleanLink = newGroupUsername.trim().replace(/@/g, '').replace(/\s/g, '');
      if (cleanLink.length < 3) {
        setErrorMessage('Public link must be at least 3 characters long.');
        return;
      }

      const linkRegex = /^[a-zA-Z0-9_]+$/;
      if (!linkRegex.test(cleanLink)) {
        setErrorMessage('Public link can only contain letters, numbers, and underscores.');
        return;
      }
    }

    const isChannel = isCreatingChannel;
    const isPublic = isPublicGroup;
    const groupLink = isPublic ? newGroupUsername.trim().replace(/@/g, '').replace(/\s/g, '') : '';

    try {
      let avatarData: any = undefined;
      if (avatarBytes) {
        avatarData = Array.from(avatarBytes);
      }

      const result = await groupService.createGroupAsync({
        Name: newGroupName.trim(),
        Avatar: avatarData,
        MemberIds: [],
        IsChannel: isChannel,
        Description: newGroupDescription.trim(),
        IsPublic: isPublic,
        GroupLink: groupLink,
      } as any);

      if (result) {
        const link = (result as any).groupLink || (result as any).GroupLink || (isPublic ? `join/${groupLink}` : `join/${result.id}`);
        setNewGroupInviteLink(link);
        setStep(2);

        // 🟢 1 в 1 с WPF: Формируем ChatListItem для шины сообщений со всеми обязательными полями
        const newChat: IChatListItem = {
          id: result.id,
          groupId: result.id,
          groupName: newGroupName.trim(),
          nickName: newGroupName.trim(),
          avatar: avatarPreviewUrl,
          avatarPath: avatarPreviewUrl,
          isGroup: true,
          isChannel: isChannel,
          adminId: userSession.userId,
          lastMessage: isChannel ? 'Channel created' : 'Group created',
          lastMessageType: LastMessageType.None,
          rawLastMessage: null,
          lastAttachmentType: null,
          lastMessageSenderId: null,
          isLastAttachmentGif: false,
          isLastMessageDeletedForMe: false,
          lastSeen: new Date().toISOString(),
          lastMessageTime: new Date().toISOString(),
          memberCount: 1,
          onlineCount: isChannel ? 0 : 1,
          groupDescription: newGroupDescription.trim(),
          isPublic: isPublic,
          groupLink: link,
          isSecretChat: false,
          secretChatId: null,
          keyFingerprint: null,
          isOnline: false,
          isTyping: false,
          isPinned: false,
          isMuted: false,
          isBlocked: false,
          unreadCount: 0,
          userId: null,
          username: null,
          folderIds: [],
        };

        eventBus.emit('GroupCreatedMessage' as any, newChat);
        if (onGroupCreated) {
          onGroupCreated(newChat);
        }
      } else {
        setErrorMessage('Failed to create group. Please try again.');
      }
    } catch (ex: any) {
      console.error('[GroupCreationVM ERROR] Критический сбой при создании группы:', ex);
      setErrorMessage(`An error occurred: ${ex?.message || 'Unknown error'}`);
    }
  };

  // ===================== CopyToClipboardCommand =====================
  const handleCopyLink = () => {
    if (!newGroupInviteLink) return;
    navigator.clipboard.writeText(newGroupInviteLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // IsDefault="True" — создание группы по Enter в инпутах шага 1
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateGroup();
    }
  };

  if (!isRendered) return null;

  return (
    <div
      id="CreateGroupOverlay"
      onClick={onClose}
      style={{
        ...styles.overlay,
        opacity: isFadingOut ? 0 : 1,
        transition: isFadingOut ? 'opacity 0.1s ease-out' : 'opacity 0.12s ease-out',
      }}
    >
      <style>{`
      .btn-close {
          width: 28px !important;
          height: 28px !important;
          padding: 0 !important;
          border-radius: 50% !important;
          background-color: transparent !important;
          color: #7D8494 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
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
          background-color: transparent !important;
          color: #7D8494 !important;
          transition: background-color 0.15s ease, color 0.15s ease !important;
        }
        .btn-cancel:hover {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: #FFFFFF !important;
        }
        .btn-create {
          background-color: #1E9BEB !important;
          color: #FFFFFF !important;
          transition: opacity 0.15s ease !important;
        }
        .btn-create:hover {
          opacity: 0.9 !important;
        }
        .btn-create:active {
          opacity: 0.8 !important;
        }
      `}</style>

      {/* КАРТОЧКА ДИАЛОГА (Width: 410px, Background: #161A23) */}
      <div
        id="CreateGroupCard"
        onClick={(e) => e.stopPropagation()}
        style={styles.card}
      >
        {/* ================= ШАГ 1: ВВОД ДАННЫХ ================= */}
        {step === 1 && (
          <div id="Step1_Input" style={styles.stepContainer}>
            <div style={styles.headerRow}>
              <span style={styles.headerTitle}>
                {isCreatingChannel ? 'New Channel' : 'New Group'}
              </span>

              <button
                type="button"
                onClick={onClose}
                className="btn-close"
                style={styles.closeButton}
                title="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>

            <div style={styles.segmentedTrack}>
              <button
                type="button"
                onClick={() => setIsCreatingChannel(false)}
                style={{
                  ...styles.segmentedButton,
                  backgroundColor: !isCreatingChannel ? '#2E3646' : 'transparent',
                  color: !isCreatingChannel ? '#FFFFFF' : '#7D8494',
                }}
              >
                Group
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingChannel(true)}
                style={{
                  ...styles.segmentedButton,
                  backgroundColor: isCreatingChannel ? '#2E3646' : 'transparent',
                  color: isCreatingChannel ? '#FFFFFF' : '#7D8494',
                }}
              >
                Channel
              </button>
            </div>

            <div style={styles.avatarAndFieldsRow}>
              <div style={styles.nameRow}>
                <div
                  onClick={handleSelectAvatarClick}
                  style={styles.avatarCircle}
                  title="Select Group Picture"
                >
                  {avatarPreviewUrl ? (
                    <img
                      src={avatarPreviewUrl}
                      alt="Avatar"
                      style={styles.avatarImage}
                    />
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#7D8494">
                      <path d="M4 4h3l2-2h6l2 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2m8 3a5 5 0 0 0-5 5 5 5 0 0 0 5 5 5 5 0 0 0 5-5 5 5 0 0 0-5-5m0 2a3 3 0 0 1 3 3 3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1 3-3M20 7v3h-2V7h-3V5h3V2h2v3h3v2h-3z" />
                    </svg>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    style={{ display: 'none' }}
                  />
                </div>

                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    placeholder={isCreatingChannel ? 'Channel name' : 'Group name'}
                    style={{
                      ...styles.modernInput,
                      borderColor: focusedField === 'name' ? '#1E9BEB' : '#333E4A',
                      backgroundColor: focusedField === 'name' ? '#1F2633' : '#1C242F',
                    }}
                  />
                </div>
              </div>

              <input
                type="text"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                onKeyDown={handleInputKeyDown}
                onFocus={() => setFocusedField('description')}
                onBlur={() => setFocusedField(null)}
                placeholder="Description (optional)"
                style={{
                  ...styles.modernInput,
                  borderColor: focusedField === 'description' ? '#1E9BEB' : '#333E4A',
                  backgroundColor: focusedField === 'description' ? '#1F2633' : '#1C242F',
                }}
              />
            </div>

            <div style={styles.accessBlock}>
              <div style={styles.accessSectionLabel}>ACCESS TYPE</div>

              <div style={styles.accessCardsGrid}>
                <div
                  onClick={() => setIsPublicGroup(false)}
                  style={{
                    ...styles.accessCard,
                    borderColor: !isPublicGroup ? '#1E9BEB' : '#333E4A',
                    backgroundColor: !isPublicGroup ? 'rgba(30, 155, 235, 0.082)' : '#1C242F',
                  }}
                >
                  <div
                    style={{
                      ...styles.accessBadge,
                      backgroundColor: !isPublicGroup ? 'rgba(30, 155, 235, 0.133)' : 'rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={!isPublicGroup ? '#1E9BEB' : '#7D8494'}>
                      <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2m6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2M8.9 6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2H8.9V6M18 20H6V10h12v10z" />
                    </svg>
                  </div>
                  <div style={styles.accessCardTextCol}>
                    <div style={{ ...styles.accessCardTitle, color: !isPublicGroup ? '#1E9BEB' : '#FFFFFF' }}>
                      Private
                    </div>
                    <div style={styles.accessCardSubtitle}>Only via invite link</div>
                  </div>
                </div>

                <div
                  onClick={() => setIsPublicGroup(true)}
                  style={{
                    ...styles.accessCard,
                    borderColor: isPublicGroup ? '#1E9BEB' : '#333E4A',
                    backgroundColor: isPublicGroup ? 'rgba(30, 155, 235, 0.082)' : '#1C242F',
                  }}
                >
                  <div
                    style={{
                      ...styles.accessBadge,
                      backgroundColor: isPublicGroup ? 'rgba(30, 155, 235, 0.133)' : 'rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={isPublicGroup ? '#1E9BEB' : '#7D8494'}>
                      <path d="M17.9 17.39c-.26-.8-1.01-1.39-1.9-1.39h-1v-3a1 1 0 0 0-1-1H8v-2h2a1 1 0 0 0 1-1V7h2a2 2 0 0 0 2-2v-.41a7.984 7.984 0 0 1 2.9 12.8M11 19.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93m1-17.93c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10-4.48-10-10-10z" />
                    </svg>
                  </div>
                  <div style={styles.accessCardTextCol}>
                    <div style={{ ...styles.accessCardTitle, color: isPublicGroup ? '#1E9BEB' : '#FFFFFF' }}>
                      Public
                    </div>
                    <div style={styles.accessCardSubtitle}>Visible in search</div>
                  </div>
                </div>
              </div>

              {isPublicGroup && (
                <div style={styles.publicSuffixRow}>
                  <div style={styles.publicSuffixContainer}>
                    <span style={styles.publicSuffixPrefix}>join/</span>
                    <input
                      type="text"
                      value={newGroupUsername}
                      onChange={(e) => setNewGroupUsername(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      style={styles.publicSuffixInput}
                      placeholder="username"
                      autoFocus
                    />
                  </div>
                </div>
              )}
            </div>

            {errorMessage && (
              <div style={styles.errorText}>{errorMessage}</div>
            )}

            <div style={styles.footerRow}>
              <button
                type="button"
                onClick={onClose}
                className="btn-cancel"
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateGroup}
                className="btn-create"
                style={styles.createButton}
              >
                Create
              </button>
            </div>
          </div>
        )}

        {/* ================= ШАГ 2: УСПЕХ И ИНВАЙТ-ССЫЛКА ================= */}
        {step === 2 && (
          <div id="Step2_Success" style={styles.stepContainer}>
            <div style={styles.successContent}>
              <div style={styles.successIconBadge}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="#1E9BEB">
                  <path d="M9 20.42L2.79 14.21L5.62 11.38L9 14.77L18.88 4.88L21.71 7.71L9 20.42Z" />
                </svg>
              </div>

              <div style={styles.successTitle}>
                {isCreatingChannel ? 'Channel Created' : 'Group Created'}
              </div>

              <div style={styles.successSubtitle}>
                Share this link to invite people into your chat.
              </div>

              <div style={styles.inviteLinkContainer}>
                <span style={styles.inviteLinkText}>
                  {newGroupInviteLink}
                </span>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  style={styles.copyIconButton}
                  title="Copy link"
                >
                  {isCopied ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#1E9BEB">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#7D8494">
                      <path d="M19 21H8V7h11m0-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m-3-4H4a2 2 0 0 0-2 2v14h2V3h12V1z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div style={styles.footerRow}>
              <button
                type="button"
                onClick={onClose}
                className="btn-cancel"
                style={styles.cancelButton}
              >
                Done
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="btn-create"
                style={styles.createButton}
              >
                {isCopied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ===================== CSS Стили =====================
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 410,
    backgroundColor: '#161A23',
    borderRadius: 14,
    padding: '20px 22px',
    boxShadow: '0 4px 28px rgba(0, 0, 0, 0.35)',
    boxSizing: 'border-box',
    userSelect: 'none',
  },
  stepContainer: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#FFFFFF',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#7D8494',
  },
  segmentedTrack: {
    backgroundColor: '#11151D',
    borderRadius: 8,
    padding: 3,
    marginBottom: 16,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
  },
  segmentedButton: {
    border: 'none',
    borderRadius: 6,
    padding: '6px 0',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.15s ease, color 0.15s ease',
  },
  avatarAndFieldsRow: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: 16,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: '50%',
    backgroundColor: '#1C242F',
    border: '1px solid #333E4A',
    marginRight: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  modernInput: {
    width: '100%',
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    fontSize: 14,
    padding: '0 12px',
    color: '#FFFFFF',
    caretColor: '#1E9BEB',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s ease, background-color 0.15s ease',
  },
  accessBlock: {
    marginBottom: 18,
  },
  accessSectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#7D8494',
    marginLeft: 2,
    marginBottom: 8,
    letterSpacing: '0.5px',
  },
  accessCardsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  accessCard: {
    cursor: 'pointer',
    borderRadius: 10,
    padding: '10px 12px',
    borderWidth: 1,
    borderStyle: 'solid',
    display: 'flex',
    alignItems: 'center',
    transition: 'border-color 0.15s ease, background-color 0.15s ease',
  },
  accessBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    marginRight: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background-color 0.15s ease',
  },
  accessCardTextCol: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  accessCardTitle: {
    fontSize: 13,
    fontWeight: 600,
    lineHeight: '16px',
    transition: 'color 0.15s ease',
  },
  accessCardSubtitle: {
    fontSize: 11,
    color: '#7D8494',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  publicSuffixRow: {
    marginTop: 12,
  },
  publicSuffixContainer: {
    height: 40,
    backgroundColor: '#1C242F',
    border: '1px solid #333E4A',
    borderRadius: 8,
    padding: '0 12px',
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box',
  },
  publicSuffixPrefix: {
    color: '#7D8494',
    fontSize: 13.5,
    marginRight: 2,
    userSelect: 'none',
  },
  publicSuffixInput: {
    flex: 1,
    height: 36,
    background: 'transparent',
    border: 'none',
    color: '#FFFFFF',
    fontSize: 13.5,
    caretColor: '#1E9BEB',
    outline: 'none',
    padding: 0,
    fontFamily: 'inherit',
  },
  errorText: {
    color: '#FFCF6679',
    fontSize: 12,
    marginBottom: 12,
    marginLeft: 2,
  },
  footerRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  cancelButton: {
    height: 36,
    padding: '0 16px',
    background: 'transparent',
    border: 'none',
    borderRadius: 8,
    color: '#7D8494',
    fontWeight: 500,
    fontSize: 13.5,
    cursor: 'pointer',
    marginRight: 8,
    transition: 'background-color 0.15s ease, color 0.15s ease',
  },
  createButton: {
    height: 36,
    padding: '0 22px',
    backgroundColor: '#1E9BEB',
    border: 'none',
    borderRadius: 8,
    color: '#FFFFFF',
    fontWeight: 600,
    fontSize: 13.5,
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
  },
  successContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px 0 20px 0',
  },
  successIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(30, 155, 235, 0.082)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: 700,
    textAlign: 'center',
  },
  successSubtitle: {
    color: '#7D8494',
    fontSize: 13,
    textAlign: 'center',
    margin: '6px 0 18px 0',
  },
  inviteLinkContainer: {
    width: '100%',
    backgroundColor: '#161A23',
    border: '1px solid #333E4A',
    borderRadius: 8,
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxSizing: 'border-box',
  },
  inviteLinkText: {
    color: '#1E9BEB',
    fontSize: 13.5,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  copyIconButton: {
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    marginLeft: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};