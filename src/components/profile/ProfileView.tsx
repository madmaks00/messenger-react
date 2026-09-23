import React, { useEffect } from 'react';
import { IAttachment, IMessage } from '../../types/models';
import { useProfileView, ProfileServices } from './useProfileView';
import { ProfileLeftColumn } from './ProfileLeftColumn';
import { ProfileRightStories } from './ProfileRightStories';
import { ProfileRightSharedMedia } from './ProfileRightSharedMedia';
import { ProfileRightEditProfile } from './ProfileRightEditProfile';
import { ProfileRightSettings } from './ProfileRightSettings';
import { ProfileRightGroup } from './ProfileRightGroup';
import { getAvatarColor, getFirstLetter } from './profileView.utils';
import { Theme } from './profile.theme';
import { Icons } from './ProfileIcons';

export interface ProfileViewProps {
  isOpen: boolean;
  user: any;
  isOwnProfile: boolean;
  isGroupProfile?: boolean;
  currentUserId?: number;
  onClose: () => void;
  onStartChat?: (userId: number) => void;
  onCallUser?: (user: any) => void;
  services?: Partial<ProfileServices>;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  isOpen,
  user,
  isOwnProfile,
  isGroupProfile = false,
  currentUserId = 0,
  onClose,
  onStartChat,
  onCallUser,
  services = {},
}) => {
  const vm = useProfileView(
    isOpen,
    user,
    isOwnProfile,
    isGroupProfile,
    currentUserId,
    onClose,
    services,
    onStartChat,
    onCallUser
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
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [setActiveContextMenu]);

  if (!isOpen) return null;

  const handleStartChatSafe = onStartChat || services.onStartChat || (() => {});
  const handleCallUserSafe = onCallUser || services.onCallUser || (() => {});
  const handleToggleMuteSafe = services.onToggleMute || (() => {});
  const handleToggleBlockSafe = services.toggleBlockUser || (async () => null);
  const handleRevokeInviteSafe = services.revokeInviteLink || (async () => false);
  const handleGenerateInviteSafe = services.generateInviteLink || (async () => null);

  return (
    <div
      onClick={onClose}
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
      }}
    >
      {/* КАРТОЧКА ПРОФИЛЯ (365px -> 888px при QuarticEase 250ms) */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isExpanded ? 888 : 365,
          height: 720,
          backgroundColor: Theme.ProfileCardBackground,
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
          display: 'grid',
          gridTemplateColumns: isExpanded ? '365px 1fr' : '365px',
          overflow: 'hidden',
          transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* ЛЕВАЯ КОЛОНКА */}
        <ProfileLeftColumn
          vm={vm}
          isOwnProfile={isOwnProfile}
          isGroupProfile={isGroupProfile}
          onClose={onClose}
          onStartChat={handleStartChatSafe}
          onCallUser={handleCallUserSafe}
          onToggleMute={handleToggleMuteSafe}
          onToggleBlockUser={handleToggleBlockSafe}
          onRevokeInviteLink={handleRevokeInviteSafe}
          onCreateInviteLink={handleGenerateInviteSafe}
        />

        {/* ПРАВАЯ КОЛОНКА */}
        {isExpanded && (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: Theme.ProfileCardBackground,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {activeRightContainer === 'stories' && (
              <ProfileRightStories
                vm={vm}
                isOwnProfile={isOwnProfile}
                onClose={onClose}
                onCreateNewStory={services.createNewStory || (async () => {})}
                onOpenStoryViewer={services.openStoryViewer || (() => {})}
                onEditStory={services.editStory || (() => {})}
                onDeleteStory={services.deleteStory || (async () => false)}
              />
            )}

            {activeRightContainer === 'sharedMedia' && (
              <ProfileRightSharedMedia
                vm={vm}
                onClose={onClose}
                onForwardMessages={services.onForwardMessages || (() => {})}
                onDeleteMessage={services.onDeleteMessage || (() => {})}
                onOpenFile={services.onOpenFile || (() => {})}
              />
            )}

            {activeRightContainer === 'editProfile' && (
              <ProfileRightEditProfile
                vm={vm}
                onClose={onClose}
              />
            )}

            {activeRightContainer === 'settings' && (
              <ProfileRightSettings
                vm={vm}
                onClose={onClose}
                onTerminateSession={services.terminateDeviceSession || (async () => false)}
                onTerminateOtherSessions={services.terminateOtherSessions || (async () => false)}
                onUnblockUser={services.toggleBlockUser || (async () => null)}
              />
            )}

            {(activeRightContainer === 'members' || activeRightContainer === 'editGroup') && (
              <ProfileRightGroup
                vm={vm}
                onClose={onClose}
                onLeaveGroup={() => services.leaveGroup?.(user.id)}
                onKickMember={(memberId) => services.kickMember?.(user.id, memberId)}
                onUnbanMember={(memberId) => services.unbanMember?.(user.id, memberId)}
              />
            )}
          </div>
        )}
      </div>

      {/* ДИАЛОГ НАСТРОЙКИ ПРАВ УЧАСТНИКА (MemberPermissionsOverlay) */}
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
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
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

      {/* КОНТЕКСТНОЕ МЕНЮ МЕДИАФАЙЛОВ */}
      {activeContextMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            ...dropdownMenuStyle,
            position: 'fixed',
            left: activeContextMenu.x,
            top: activeContextMenu.y,
            zIndex: 7000,
          }}
        >
          <div
            onClick={() => {
              if (activeContextMenu.item) {
                const id = 'message' in activeContextMenu.item
                  ? (activeContextMenu.item as IAttachment).message?.id
                  : (activeContextMenu.item as IMessage).id;
                if (id) services.onJumpToMessage?.(id, user.id);
              }
              setActiveContextMenu(null);
            }}
            style={dropdownItemStyle}
          >
            Перейти к сообщению
          </div>
          <div
            onClick={() => {
              if (activeContextMenu.item) {
                const msg = 'message' in activeContextMenu.item
                  ? (activeContextMenu.item as IAttachment).message
                  : (activeContextMenu.item as IMessage);
                if (msg) services.onForwardMessages?.([msg]);
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
                const msg = 'message' in activeContextMenu.item
                  ? (activeContextMenu.item as IAttachment).message
                  : (activeContextMenu.item as IMessage);
                if (msg) services.onDeleteMessage?.(msg);
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
  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
};

const dropdownItemStyle: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: 13,
  color: Theme.MainWindowText,
  cursor: 'pointer',
};