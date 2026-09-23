import React, { useRef } from 'react';
import { getAvatarColor, getFirstLetter, normalizeImageSrc } from './profileView.utils';
import { useProfileView } from './useProfileView';
import { Theme } from './profile.theme';
import { Icons } from './ProfileIcons';

interface ProfileRightGroupProps {
  vm: ReturnType<typeof useProfileView>;
  onClose: () => void;
  onLeaveGroup: () => void;
  onKickMember: (memberId: number) => void;
  onUnbanMember: (memberId: number) => void;
}

export const ProfileRightGroup: React.FC<ProfileRightGroupProps> = ({
  vm,
  onClose,
  onLeaveGroup,
  onKickMember,
  onUnbanMember,
}) => {
  const {
    displayedUser,
    activeRightContainer,
    groupMembersPanelTitle,
    activeMembersList,
    groupDetails,
    editGroupName,
    setEditGroupName,
    editGroupDescription,
    setEditGroupDescription,
    editGroupAvatar,
    setEditGroupAvatar,
    editGroupIsPublic,
    setEditGroupIsPublic,
    editGroupLink,
    setEditGroupLink,
    groupCanSendText,
    setGroupCanSendText,
    groupCanSendMedia,
    setGroupCanSendMedia,
    groupCanPinMessages,
    setGroupCanPinMessages,
    collapseRightPanel,
    handleOpenMemberPermissions,
    handleSaveGroupSettings,
    handleShowMembers,
  } = vm;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleGroupAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setEditGroupAvatar(uploadEvent.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const targetGroupId = displayedUser?.id || groupDetails?.id || 0;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 1. СПИСОК УЧАСТНИКОВ / ЧЕРНЫЙ СПИСОК */}
      {activeRightContainer === 'members' && (
        <>
          <div style={rightHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={collapseRightPanel} style={iconBtnStyle} title="Back to Profile">
                <Icons.ArrowLeft size={20} color={Theme.ProfileSectionLabel} />
              </button>
              <span style={{ fontSize: 26, fontWeight: 800, color: Theme.MainWindowText }}>
                {groupMembersPanelTitle}
              </span>
            </div>
            <button onClick={onClose} style={iconBtnStyle} title="Close Profile">
              <Icons.Close size={20} color={Theme.ProfileSectionLabel} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 25px 24px 25px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activeMembersList.map((m) => (
                <div key={m.id} style={mediaRowCardStyle}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: getAvatarColor(m.id),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: Theme.MainWindowText,
                      fontWeight: 'bold',
                      flexShrink: 0,
                    }}
                  >
                    {getFirstLetter(m.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: Theme.MainWindowText, fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                    <div style={{ color: Theme.ProfileSectionLabel, fontSize: 12 }}>@{m.username}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {groupMembersPanelTitle === 'Blacklist' ? (
                      <button
                        onClick={async () => {
                          onUnbanMember(m.id);
                          handleShowMembers('blacklist');
                        }}
                        style={{ ...smallActionBtn, color: Theme.AppAccent }}
                      >
                        Unban
                      </button>
                    ) : (
                      <>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 'bold',
                            padding: '3px 8px',
                            borderRadius: 6,
                            backgroundColor:
                              m.roleName === 'Owner'
                                ? Theme.GroupOwnerBadgeBg
                                : m.roleName === 'Admin' || m.roleName === 'Administrator'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : 'rgba(255, 255, 255, 0.08)',
                            color:
                              m.roleName === 'Owner'
                                ? Theme.GroupOwnerBadgeText
                                : m.roleName === 'Admin' || m.roleName === 'Administrator'
                                ? '#10B981'
                                : Theme.ProfileSectionLabel,
                          }}
                        >
                          {m.roleName || 'Member'}
                        </span>

                        {!m.isCurrentUser && (groupDetails?.isAdmin || groupDetails?.isOwner) && (
                          <button onClick={() => handleOpenMemberPermissions(m)} style={smallActionBtn}>
                            Permissions
                          </button>
                        )}
                        {!m.isCurrentUser && (groupDetails?.isAdmin || groupDetails?.isOwner) && (
                          <button
                            onClick={() => {
                              onKickMember(m.id);
                              handleShowMembers('members');
                            }}
                            style={{ ...smallActionBtn, color: Theme.ProfileDestructiveAction }}
                          >
                            Remove
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 2. УПРАВЛЕНИЕ ГРУППОЙ */}
      {activeRightContainer === 'editGroup' && (
        <>
          <div style={rightHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={collapseRightPanel} style={iconBtnStyle} title="Back to Profile">
                <Icons.ArrowLeft size={20} color={Theme.ProfileSectionLabel} />
              </button>
              <span style={{ fontSize: 26, fontWeight: 800, color: Theme.MainWindowText }}>
                Manage Group
              </span>
            </div>
            <button onClick={onClose} style={iconBtnStyle} title="Close Profile">
              <Icons.Close size={20} color={Theme.ProfileSectionLabel} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 25px 24px 25px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={labelStyle}>GENERAL INFO</div>
              <div style={avatarSectionStyle}>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  title="Change group avatar"
                  style={{
                    width: 90,
                    height: 90,
                    borderRadius: 45,
                    border: `2px solid ${Theme.AppAccent}`,
                    overflow: 'hidden',
                    position: 'relative',
                    cursor: 'pointer',
                    flexShrink: 0,
                    backgroundColor: Theme.ProfileEditAvatarFallbackBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleGroupAvatarChange}
                  />
                  {editGroupAvatar ? (
                    <img src={normalizeImageSrc(editGroupAvatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 28, color: '#FFF', fontWeight: 'bold' }}>
                      {getFirstLetter(editGroupName)}
                    </span>
                  )}
                  <div style={cameraOverlayStyle}>
                    <Icons.PencilOutline size={22} color="#FFF" />
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={labelStyle}>GROUP NAME</div>
                  <input
                    type="text"
                    value={editGroupName}
                    onChange={(e) => setEditGroupName(e.target.value)}
                    style={cardInputStyle}
                  />
                </div>
              </div>

              <div>
                <div style={labelStyle}>DESCRIPTION</div>
                <textarea
                  rows={3}
                  value={editGroupDescription}
                  onChange={(e) => setEditGroupDescription(e.target.value)}
                  placeholder="Add an optional description for this group..."
                  style={{ ...cardInputStyle, resize: 'none' }}
                />
              </div>

              <div style={subPanelCardStyle}>
                <div style={labelStyle}>GROUP TYPE &amp; LINK</div>
                <div style={{ ...settingRowStyle, padding: '4px 0', border: 'none' }}>
                  <span style={{ color: Theme.MainWindowText, fontSize: 14 }}>Group Type</span>
                  <select
                    value={editGroupIsPublic ? 'public' : 'private'}
                    onChange={(e) => setEditGroupIsPublic(e.target.value === 'public')}
                    style={selectStyle}
                  >
                    <option value="private">Private</option>
                    <option value="public">Public</option>
                  </select>
                </div>

                {editGroupIsPublic ? (
                  <div style={{ marginTop: 12 }}>
                    <div style={labelStyle}>PUBLIC LINK</div>
                    <input
                      type="text"
                      value={editGroupLink}
                      onChange={(e) => setEditGroupLink(e.target.value)}
                      style={cardInputStyle}
                    />
                  </div>
                ) : (
                  <div style={{ marginTop: 12 }}>
                    <div style={labelStyle}>INVITE LINK</div>
                    {groupDetails?.groupLink ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: Theme.AppAccent, fontSize: 13, fontWeight: 600 }}>{groupDetails.groupLink}</span>
                        <button
                          onClick={() => vm.services.revokeInviteLink(targetGroupId)}
                          style={{ background: 'none', border: 'none', color: Theme.ProfileDestructiveAction, fontSize: 12, cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          Revoke
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => vm.services.generateInviteLink(targetGroupId)}
                        style={{ background: 'none', border: 'none', color: Theme.AppAccent, fontSize: 12.5, cursor: 'pointer', fontWeight: 'bold', padding: 0 }}
                      >
                        Generate Invite Link
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div style={subPanelCardStyle}>
                <div style={labelStyle}>DEFAULT MEMBER PERMISSIONS</div>
                <label style={toggleLabelStyle}>
                  <div>
                    <div style={{ color: Theme.MainWindowText, fontSize: 14, fontWeight: 600 }}>Send Text Messages</div>
                    <div style={{ color: Theme.ProfileSectionLabel, fontSize: 11.5 }}>Members can write text in chat</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={groupCanSendText}
                    onChange={(e) => setGroupCanSendText(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: Theme.AppAccent }}
                  />
                </label>
                <div style={{ height: 1, backgroundColor: Theme.ProfileLeftPanelBorder, margin: '8px 0' }} />
                <label style={toggleLabelStyle}>
                  <div>
                    <div style={{ color: Theme.MainWindowText, fontSize: 14, fontWeight: 600 }}>Send Media Files</div>
                    <div style={{ color: Theme.ProfileSectionLabel, fontSize: 11.5 }}>Photos, videos, files and documents</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={groupCanSendMedia}
                    onChange={(e) => setGroupCanSendMedia(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: Theme.AppAccent }}
                  />
                </label>
                <div style={{ height: 1, backgroundColor: Theme.ProfileLeftPanelBorder, margin: '8px 0' }} />
                <label style={toggleLabelStyle}>
                  <div>
                    <div style={{ color: Theme.MainWindowText, fontSize: 14, fontWeight: 600 }}>Pin Messages</div>
                    <div style={{ color: Theme.ProfileSectionLabel, fontSize: 11.5 }}>Members can pin messages</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={groupCanPinMessages}
                    onChange={(e) => setGroupCanPinMessages(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: Theme.AppAccent }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <button
                  onClick={onLeaveGroup}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${Theme.ProfileDestructiveAction}`,
                    color: Theme.ProfileDestructiveAction,
                    padding: '10px 18px',
                    borderRadius: 8,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  Delete Group
                </button>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={collapseRightPanel} style={secondaryBtnStyle}>
                    Cancel
                  </button>
                  <button onClick={handleSaveGroupSettings} style={primaryBtnStyle}>
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const rightHeaderStyle: React.CSSProperties = {
  height: 64,
  padding: '0 25px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
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
  padding: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 'bold',
  color: Theme.ProfileSectionLabel,
  marginBottom: 6,
};

const cardInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: Theme.ProfileInputContainerBg,
  border: `1px solid ${Theme.ProfileInputContainerBorder}`,
  borderRadius: 10,
  color: Theme.ProfileInputText,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  width: 130,
  padding: '6px 10px',
  background: Theme.ProfileComboBoxDropdownBg,
  border: `1px solid ${Theme.ProfileInputContainerBorder}`,
  borderRadius: 6,
  color: Theme.ProfileComboBoxDropdownText,
  fontSize: 13,
  outline: 'none',
};

const avatarSectionStyle: React.CSSProperties = {
  background: Theme.ProfileInputContainerBg,
  borderRadius: 12,
  padding: 16,
  display: 'flex',
  gap: 16,
  border: `1px solid ${Theme.ProfileInputContainerBorder}`,
};

const cameraOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundColor: Theme.ProfileEditAvatarCameraOverlayBg,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: 0.85,
};

const subPanelCardStyle: React.CSSProperties = {
  background: Theme.ProfileInputContainerBg,
  borderRadius: 12,
  border: `1px solid ${Theme.ProfileInputContainerBorder}`,
  padding: 16,
};

const settingRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const mediaRowCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 14px',
  background: Theme.ProfileInputContainerBg,
  border: `1px solid ${Theme.ProfileInputContainerBorder}`,
  borderRadius: 10,
};

const smallActionBtn: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  background: Theme.ProfileDeviceItemBg,
  color: '#FFF',
  border: 'none',
  fontSize: 12,
  cursor: 'pointer',
  fontWeight: 600,
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
  padding: '10px 18px',
  borderRadius: 8,
  background: 'transparent',
  color: Theme.ProfileSectionLabel,
  border: 'none',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const toggleLabelStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  cursor: 'pointer',
};