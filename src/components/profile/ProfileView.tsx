import React, { useEffect, useState, useCallback, useRef } from 'react';
import { IAttachment, IMessage, IUser } from '../../types/models';
import { MainTab } from '../../types/enums';
import { useProfileView, ProfileServices, RightContainerType } from './useProfileView';
import { ProfileLeftColumn } from './ProfileLeftColumn';
import { ProfileRightStories } from './ProfileRightStories';
import { ProfileRightSharedMedia } from './ProfileRightSharedMedia';
import { ProfileRightEditProfile } from './ProfileRightEditProfile';
import { ProfileRightSettings } from './ProfileRightSettings';
import { ProfileRightGroup } from './ProfileRightGroup';
import { getAvatarColor, getFirstLetter } from './profileView.utils';
import { Theme } from './profile.theme';
import { Icons } from './ProfileIcons';
import { useStoriesStore } from '../../stores/storiesStore';
import { useNavigationStore } from '../../stores/navigationStore';
import { userSession } from '../../services/userSession';
import { useChatStore } from '../../stores/chatStore';
import { useCallsStore } from '../../stores/callsStore';
import { useSidebarChatsStore } from '../../stores/sidebarChatsStore';
import { chatService } from '../../services/chat.service';
import { eventBus } from '../../services/eventBus';

export interface ProfileViewProps {
  isOpen: boolean;
  user: any;
  isOwnProfile: boolean;
  isGroupProfile?: boolean;
  currentUserId?: number;
  initialTab?: RightContainerType;
  onClose: () => void;
  onStartChat?: (userId: number) => void;
  onCallUser?: (user: any) => void;
  services?: Partial<ProfileServices>;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  isOpen,
  user,
  isGroupProfile = false,
  currentUserId = 0,
  initialTab = 'stories',
  onClose,
  onStartChat,
  onCallUser,
  services = {},
}) => {
  const navStore = useNavigationStore();

  const effectiveIsOpen = navStore.isProfileOpen ?? isOpen;
  const effectiveIsGroupProfile = navStore.isProfileOpen ? navStore.isGroupProfile : isGroupProfile;

  const candidateUser = navStore.isProfileOpen ? (navStore.profileUser || user) : (user || navStore.profileUser);
  const sessionUserId = Number(userSession.userId || currentUserId || 0);
  const profileUserId = Number(candidateUser?.id || (candidateUser as any)?.userId || 0);

  // Ownership depends on the active account, regardless of how the profile was opened.
  // Group IDs use a separate namespace and must never grant personal profile controls.
  const effectiveIsOwnProfile = Boolean(
    !effectiveIsGroupProfile && sessionUserId > 0 && profileUserId === sessionUserId
  );

  const effectiveUser = candidateUser;
  const effectiveInitialTab = navStore.profileInitialTab || initialTab;

  const [isRendered, setIsRendered] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAnimateClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setIsRendered(false);

    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      navStore.closeProfile();
      onClose();
      setIsClosing(false);
    }, 200);
  }, [isClosing, onClose, navStore]);

  useEffect(() => {
    if (effectiveIsOpen) {
      setIsClosing(false);
      const raf = requestAnimationFrame(() => {
        setIsRendered(true);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsRendered(false);
      setIsClosing(false);
    }
  }, [effectiveIsOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleAnimateClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAnimateClose]);

  const vm = useProfileView(
    effectiveIsOpen,
    effectiveUser,
    effectiveIsOwnProfile,
    effectiveIsGroupProfile,
    sessionUserId,
    handleAnimateClose,
    services,
    onStartChat,
    onCallUser,
    effectiveInitialTab
  );

  const {
    isExpanded,
    activeRightContainer,
    activeContextMenu,
    setActiveContextMenu,
    isMemberPermissionsOpen,
    setIsMemberPermissionsOpen,
    editingMember,
    permIsAdmin,
    setPermIsAdmin,
    permCanSendText,
    setPermCanSendText,
    permCanSendMedia,
    setPermCanSendMedia,
    permCanPinMessages,
    setPermCanPinMessages,
    groupDetails,
    toggleItemSelection,
    setIsSelectionMode,
    handleSaveMemberPermissions,
  } = vm;

  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveContextMenu(null);
    };
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setActiveContextMenu(null); };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('click', handleGlobalClick);
    return () => { window.removeEventListener('click', handleGlobalClick); window.removeEventListener('keydown', handleKey); };
  }, [setActiveContextMenu]);

  if (!effectiveIsOpen) return null;

  // 1. «Chat» (Написать)
  const handleStartChatSafe = (userId: number) => {
    handleAnimateClose();
    useNavigationStore.getState().switchTab(MainTab.Chats);

    const targetSearchResult = {
      id: userId,
      nickName: effectiveUser.nickName || effectiveUser.username || 'User',
      username: effectiveUser.username,
      avatar: effectiveUser.avatar,
      avatarPath: effectiveUser.avatarPath,
      isGroup: effectiveIsGroupProfile,
      memberCount: vm.membersCount, onlineCount: 0, isTyping: false, isChannel: Boolean(vm.groupDetails?.isChannel), isSecretChat: false, adminId: vm.groupDetails?.adminId || 0,
      isOnline: Boolean(effectiveUser.isOnline),
      lastSeen: effectiveUser.lastSeen,
    };

    useChatStore.getState().selectChatUser(targetSearchResult);
    if (effectiveIsGroupProfile) return;
    onStartChat?.(userId);
    services.onStartChat?.(userId);
  };

  // 2. «Call» (Звонок)
  const handleCallUserSafe = (targetUser: IUser) => {
    if (!effectiveIsGroupProfile && (vm.isBlockedByMe || vm.isBlockedByThem)) return;
    handleAnimateClose();

    useCallsStore.getState().startCall({
      id: targetUser.id,
      nickName: targetUser.nickName || targetUser.username || 'User',
      username: targetUser.username,
      avatar: targetUser.avatar,
      avatarPath: targetUser.avatarPath,
      isGroup: effectiveIsGroupProfile,
      isOnline: Boolean(targetUser.isOnline),
      lastSeen: targetUser.lastSeen,
    });

    if (effectiveIsGroupProfile) return;
    onCallUser?.(targetUser);
    services.onCallUser?.(targetUser);
  };

  // 3. «Notification» (Mute/Unmute)
  const handleToggleMuteSafe = async (targetId: number) => {
    const previous = vm.isObservedUserMuted;
    const apply = (isMuted: boolean) => {
      vm.setIsObservedUserMuted(isMuted);
      useSidebarChatsStore.setState(state => ({ allChats: state.allChats.map(chat =>
        effectiveIsGroupProfile ? chat.isGroup && Number(chat.groupId ?? chat.id) === targetId ? { ...chat, isMuted } : chat
          : !chat.isGroup && Number(chat.userId ?? chat.id) === targetId ? { ...chat, isMuted } : chat) }));
      if (effectiveIsGroupProfile) eventBus.emit('GroupMuteStatusChangedMessage', { groupId: targetId, isMuted });
      else eventBus.emit('UserMuteStatusChangedMessage', { userId: targetId, isMuted });
    };
    apply(!previous);
    try {
      const result = await chatService.toggleMuteChatAsync(effectiveIsGroupProfile ? null : targetId, effectiveIsGroupProfile ? targetId : null);
      if (result === null) apply(previous); else apply(result);
    } catch { apply(previous); }
    if (!effectiveIsGroupProfile) services.onToggleMute?.(targetId);
  };

  const handleRevokeInviteSafe = async (groupId: number) => {
    const success = await vm.services.revokeInviteLink(groupId);
    if (success) await vm.loadGroupDetails(groupId);
    return success;
  };
  const handleGenerateInviteSafe = async (groupId: number) => {
    const result = await vm.services.generateInviteLink(groupId);
    if (result) await vm.loadGroupDetails(groupId);
    return result;
  };

  const isVisible = isRendered && !isClosing;

  return (
    <div
      onClick={handleAnimateClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: Theme.OverlayBackdrop,
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        userSelect: 'none',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
      }}
    >
      <style>{`
        .wpf-scroll-viewer {
          overflow-y: auto !important;
          overflow-x: hidden !important;
          scrollbar-width: thin;
          scrollbar-color: var(--surface-hover, rgba(255, 255, 255, 0.3)) transparent;
          transition: scrollbar-color 0.3s ease;
        }
        .wpf-scroll-viewer:hover {
          scrollbar-color: var(--surface-hover, rgba(255, 255, 255, 0.5)) transparent;
        }
        .wpf-scroll-viewer::-webkit-scrollbar {
          width: 4px !important;
          height: 4px !important;
        }
        .wpf-scroll-viewer::-webkit-scrollbar-track {
          background: transparent !important;
        }
        .wpf-scroll-viewer::-webkit-scrollbar-thumb {
          background: var(--surface-hover, rgba(255, 255, 255, 0.25)) !important;
          border-radius: 3px !important;
          transition: background 0.2s ease !important;
        }
        .wpf-scroll-viewer:hover::-webkit-scrollbar-thumb {
          background: var(--surface-hover, rgba(255, 255, 255, 0.45)) !important;
        }
        .wpf-scroll-viewer::-webkit-scrollbar-thumb:hover {
          background: var(--surface-hover, rgba(255, 255, 255, 0.7)) !important;
        }
        .wpf-scroll-viewer::-webkit-scrollbar-button {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      `}</style>

      {/* 🟢 КАРТОЧКА ПРОФИЛЯ: ПЛАВНАЯ АНИМАЦИЯ 1 В 1 С WPF (SetCardWidth 250ms QuarticEase) */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          fontFamily: '"Segoe UI", sans-serif',
          width: isExpanded ? 888 : 365,
          height: 720,
          backgroundColor: Theme.ProfileCardBackground,
          borderRadius: 16,
          boxShadow: '0 20px 60px var(--shadow-colour, rgba(0, 0, 0, 0.6))',
          display: 'flex',
          overflow: 'hidden',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1)' : 'scale(0.96)',
          boxSizing: 'border-box',
          transition:
            'width 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
        }}
      >
        {/* ЛЕВАЯ КОЛОНКА (365px, ЖЕСТКИЙ ФИКСИРОВАННЫЙ РАЗМЕР БЕЗ СЖАТИЯ) */}
        <div style={{ width: 365, minWidth: 365, maxWidth: 365, height: '100%', flexShrink: 0 }}>
          <ProfileLeftColumn
            vm={vm}
            isOwnProfile={effectiveIsOwnProfile}
            isGroupProfile={effectiveIsGroupProfile}
            onClose={handleAnimateClose}
            onStartChat={handleStartChatSafe}
            onCallUser={handleCallUserSafe}
            onToggleMute={handleToggleMuteSafe}
            onToggleBlockUser={vm.handleToggleBlockUser}
            onRevokeInviteLink={handleRevokeInviteSafe}
            onCreateInviteLink={handleGenerateInviteSafe}
          />
        </div>

        {/* ПРАВАЯ КОЛОНКА (523px, ПЛАВНО ВЫЕЗЖАЕТ ИЗ-ПОД МАСКИ С ОФСЕТОМ 20px И ОПАСИТИ) */}
        <div
          style={{
            width: 523,
            minWidth: 523,
            maxWidth: 523,
            height: '100%',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: Theme.ProfileCardBackground,
            position: 'relative',
            overflow: 'hidden',
            boxSizing: 'border-box',
            opacity: isExpanded ? 1 : 0,
            transform: isExpanded ? 'translateX(0)' : 'translateX(25px)',
            transition: 'opacity 0.2s ease 0.04s, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: isExpanded ? 'auto' : 'none',
          }}
        >
          {activeRightContainer === 'stories' && (
            <ProfileRightStories
              vm={vm}
              isOwnProfile={effectiveIsOwnProfile}
              onClose={handleAnimateClose}
              onCreateNewStory={effectiveIsGroupProfile ? vm.createGroupStory : services.createNewStory || ((file) => { void useStoriesStore.getState().createNewStory(file); })}
              onOpenStoryViewer={services.openStoryViewer || ((story) => { void useStoriesStore.getState().openStoryViewer(story); })}
              onEditStory={effectiveIsGroupProfile ? ((storyId) => {
                const story = vm.activeStories.find(s => s.id === storyId);
                if (story?.canManage) void useStoriesStore.getState().editStory(story);
              }) : services.editStory || ((storyId) => {
                const story = vm.activeStories.find((s) => s.id === storyId);
                if (story) void useStoriesStore.getState().editStory(story);
              })}
              onDeleteStory={services.deleteStory || (async (storyId) => {
                const story = vm.activeStories.find((s) => s.id === storyId);
                if (story) {
                  await useStoriesStore.getState().deleteStory(story);
                  return true;
                }
                return false;
              })}
            />
          )}

          {activeRightContainer === 'sharedMedia' && (
            <ProfileRightSharedMedia
              vm={vm}
              onClose={handleAnimateClose}
              onForwardMessages={services.onForwardMessages || ((msgs) => vm.services.onForwardMessages(msgs))}
              onDeleteMessage={services.onDeleteMessage || ((msg) => vm.services.onDeleteMessage(msg))}
              onDeleteMessages={services.onDeleteMessages || ((messages) => vm.services.onDeleteMessages(messages))}
              onOpenFile={services.onOpenFile || ((att) => vm.services.onOpenFile(att))}
            />
          )}

          {activeRightContainer === 'editProfile' && (
            <ProfileRightEditProfile
              vm={vm}
              onClose={handleAnimateClose}
            />
          )}

          {activeRightContainer === 'settings' && (
            <ProfileRightSettings
              vm={vm}
              onClose={handleAnimateClose}
              onTerminateSession={services.terminateDeviceSession || (async () => false)}
              onTerminateOtherSessions={services.terminateOtherSessions || (async () => false)}
              onUnblockUser={vm.handleToggleBlockUser}
            />
          )}

          {(activeRightContainer === 'members' || activeRightContainer === 'editGroup') && (
            <ProfileRightGroup
              vm={vm}
              onClose={handleAnimateClose}
              onLeaveGroup={() => services.leaveGroup?.(effectiveUser.id)}
              onKickMember={async (memberId) => { await vm.services.kickMember(effectiveUser.id, memberId); await vm.loadGroupDetails(effectiveUser.id); }}
              onUnbanMember={async (memberId) => { await vm.services.unbanMember(effectiveUser.id, memberId); await vm.loadGroupDetails(effectiveUser.id); }}
            />
          )}
        </div>
      </div>

      {isMemberPermissionsOpen && editingMember && (
        <div
          onClick={() => setIsMemberPermissionsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: Theme.OverlayBackdrop,
            zIndex: 6000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 380,
              backgroundColor: Theme.ProfileCardBackground,
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 20px 60px var(--shadow-colour, rgba(0,0,0,0.6))',
              border: `1px solid ${Theme.ProfileLeftPanelBorder}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: getAvatarColor(editingMember.id),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: Theme.MainWindowText,
                    fontWeight: 'bold',
                  }}
                >
                  {getFirstLetter(editingMember.name)}
                </div>
                <div>
                  <div style={{ color: Theme.MainWindowText, fontWeight: 'bold', fontSize: 16 }}>{editingMember.name}</div>
                  <div style={{ color: Theme.ProfileSectionLabel, fontSize: 12 }}>User Permissions</div>
                </div>
              </div>
              <button onClick={() => setIsMemberPermissionsOpen(false)} style={iconBtnStyle}>
                <Icons.Close size={18} color={Theme.ProfileSectionLabel} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
              <label style={toggleLabelStyle}>
                <div>
                  <div style={{ color: Theme.MainWindowText, fontSize: 14, fontWeight: 600 }}>Is Administrator</div>
                  <div style={{ color: Theme.ProfileSectionLabel, fontSize: 11.5 }}>Grant full admin rights</div>
                </div>
                <input
                  type="checkbox"
                  disabled={!groupDetails?.isOwner}
                  checked={permIsAdmin}
                  onChange={(e) => setPermIsAdmin(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: Theme.AppAccent }}
                />
              </label>
              <div style={{ height: 1, backgroundColor: Theme.ProfileLeftPanelBorder }} />
              <label style={toggleLabelStyle}>
                <span style={{ color: Theme.MainWindowText, fontSize: 14, fontWeight: 600 }}>Send Messages</span>
                <input
                  type="checkbox"
                  checked={permCanSendText}
                  onChange={(e) => setPermCanSendText(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: Theme.AppAccent }}
                />
              </label>
              <label style={toggleLabelStyle}>
                <span style={{ color: Theme.MainWindowText, fontSize: 14, fontWeight: 600 }}>Send Media</span>
                <input
                  type="checkbox"
                  checked={permCanSendMedia}
                  onChange={(e) => setPermCanSendMedia(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: Theme.AppAccent }}
                />
              </label>
              <label style={toggleLabelStyle}>
                <span style={{ color: Theme.MainWindowText, fontSize: 14, fontWeight: 600 }}>Pin Messages</span>
                <input
                  type="checkbox"
                  checked={permCanPinMessages}
                  onChange={(e) => setPermCanPinMessages(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: Theme.AppAccent }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setIsMemberPermissionsOpen(false)} style={secondaryBtnStyle}>
                Cancel
              </button>
              <button onClick={handleSaveMemberPermissions} style={primaryBtnStyle}>
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* КОНТЕКСТНОЕ МЕНЮ ПКМ */}
      {activeContextMenu && (
        <div role="menu" aria-label="Действия с сообщением"
          onClick={(e) => e.stopPropagation()}
          style={{
            ...dropdownMenuStyle,
            position: 'fixed',
            left: Math.max(8, Math.min(activeContextMenu.x, window.innerWidth - 248)),
            top: Math.max(8, Math.min(activeContextMenu.y, window.innerHeight - 208)),
            zIndex: 7000,
          }}
        >
          <div
            onClick={() => {
              if (activeContextMenu.item) vm.jumpToSharedItem(activeContextMenu.item);
              setActiveContextMenu(null);
            }}
            style={dropdownItemStyle}
          >
            Перейти к сообщению
          </div>

          <div
            onClick={() => {
              if (activeContextMenu.item) {
                const item = activeContextMenu.item;
                const isAtt = 'type' in item;
                const msg = isAtt ? (item as any).message : (item as IMessage);
                if (msg) {
                  vm.services.onForwardMessages([msg]);
                }
              }
              setActiveContextMenu(null);
            }}
            style={dropdownItemStyle}
          >
            Переслать
          </div>

          <div
            onClick={() => {
              setIsSelectionMode(true);
              toggleItemSelection(activeContextMenu.item);
              setActiveContextMenu(null);
            }}
            style={dropdownItemStyle}
          >
            Выделить
          </div>

          <div
            onClick={() => {
              if (activeContextMenu.item) {
                const item = activeContextMenu.item;
                const isAtt = 'type' in item;
                const msg = isAtt ? (item as any).message : (item as IMessage);
                if (msg) {
                  vm.services.onDeleteMessage(msg);
                }
              }
              setActiveContextMenu(null);
            }}
            style={{ ...dropdownItemStyle, color: Theme.ProfileDestructiveAction }}
          >
            Удалить
          </div>
        </div>
      )}
    </div>
  );
};

const iconBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  background: 'transparent',
  border: 'none',
  color: Theme.ProfileSectionLabel,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 8,
  background: Theme.AppAccent,
  color: '#FFF',
  border: 'none',
  fontSize: 14,
  fontWeight: 'bold',
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 8,
  background: Theme.ProfileActionButtonBg,
  color: Theme.ProfileSectionLabel,
  border: `1px solid ${Theme.ProfileActionButtonBorder}`,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const toggleLabelStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: Theme.MainWindowText,
  fontSize: 14,
  cursor: 'pointer',
};

const dropdownMenuStyle: React.CSSProperties = {
  width: 200,
  backgroundColor: Theme.SidebarContextMenuBg,
  border: `1px solid ${Theme.SidebarContextMenuBorder}`,
  borderRadius: 8,
  padding: '6px 0',
  boxShadow: '0 10px 30px var(--shadow-colour, rgba(0,0,0,0.5))',
};

const dropdownItemStyle: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: 13,
  color: Theme.MainWindowText,
  cursor: 'pointer',
};