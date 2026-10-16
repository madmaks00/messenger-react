import React, { useRef, useState } from 'react';
import { normalizeCallAvatar } from '../../utils/callAvatar';
import { getAvatarColor, getFirstLetter } from './profileView.utils';
import { useProfileView } from './useProfileView';
import { Icons } from './ProfileIcons';
import './ProfileGroup.css';

interface ProfileRightGroupProps {
  vm: ReturnType<typeof useProfileView>;
  onClose: () => void;
  onLeaveGroup: () => void;
  onKickMember: (memberId: number) => void | Promise<unknown>;
  onUnbanMember: (memberId: number) => void | Promise<unknown>;
}

export const ProfileRightGroup: React.FC<ProfileRightGroupProps> = ({ vm, onClose, onLeaveGroup, onKickMember, onUnbanMember }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { displayedUser, activeRightContainer, groupMembersPanelTitle, activeMembersList, groupDetails,
    editGroupName, setEditGroupName, editGroupDescription, setEditGroupDescription, editGroupAvatar, setEditGroupAvatar,
    editGroupIsPublic, setEditGroupIsPublic, editGroupLink, setEditGroupLink, groupCanSendText, setGroupCanSendText,
    groupCanSendMedia, setGroupCanSendMedia, groupCanPinMessages, setGroupCanPinMessages, collapseRightPanel,
    handleOpenMemberPermissions, handleSaveGroupSettings, handleShowMembers } = vm;
  const groupId = displayedUser.id;
  const isBlacklist = groupMembersPanelTitle === 'Blacklist';
  const managing = activeRightContainer === 'editGroup';
  const inviteActive = Boolean(groupDetails?.isLinkActive && groupDetails?.groupLink);
  const title = managing ? 'Manage Group' : groupMembersPanelTitle;
  const save = async () => {
    if (saving) return;
    setSaving(true); setSaveError('');
    try { if (!await handleSaveGroupSettings()) setSaveError('Unable to save changes. Please check the group settings.'); }
    catch { setSaveError('Unable to save changes. Please try again.'); }
    finally { setSaving(false); }
  };
  return <div className="profile-group-shell" data-group-panel={managing ? 'manage' : isBlacklist ? 'blacklist' : 'members'}>
    <header className="profile-group-header">
      <div className="profile-group-heading">
        <button className="profile-group-icon-button" onClick={collapseRightPanel} title="Back to Profile"><Icons.ArrowLeft size={20} /></button>
        <h2>{title}</h2>
      </div>
      <button className="profile-group-icon-button" onClick={onClose} title="Close Profile"><Icons.Close size={20} /></button>
    </header>

    {!managing && <div className="wpf-scroll-viewer profile-group-scroll">
      {vm.isGroupMembersLoading ? <div className="profile-group-empty" role="status"><p>Loading members…</p></div> : activeMembersList.length === 0 ?
        <div className="profile-group-empty" role="status">
          <div className="profile-group-empty-icon"><Icons.BlockHelper size={34} color="var(--text-secondary, #46505f)" /></div>
          <h3>{isBlacklist ? 'No blocked members' : 'No members found'}</h3>
          <p>{isBlacklist ? "The group's blacklist is empty." : 'Members will appear here.'}</p>
        </div> : <div className="profile-group-members">{activeMembersList.map(member => {
          const role = member.roleName === 'Owner' ? 'owner' : member.roleName === 'Admin' || member.roleName === 'Administrator' ? 'admin' : '';
          const canModerate = !member.isCurrentUser && (groupDetails?.isOwner || (groupDetails?.isAdmin && !role));
          const avatar = normalizeCallAvatar(member.avatar);
          return <div key={member.id} className="profile-group-member">
            <div className="profile-group-member-avatar" style={{ backgroundColor: getAvatarColor(member.id) }}>{getFirstLetter(member.name)}
              {avatar && <img key={avatar} src={avatar} alt="" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />}
            </div>
            <div className="profile-group-member-info"><strong>{member.name}</strong><small>@{member.username}</small></div>
            <div className="profile-group-member-actions">
              {isBlacklist ? <button className="profile-group-button link" onClick={async () => { await onUnbanMember(member.id); await handleShowMembers('blacklist'); }}>Unban</button> : <>
                <span className={`profile-group-role ${role}`}>{member.roleName || 'Member'}</span>
                {canModerate && <>
                  <button className="profile-group-button" onClick={() => handleOpenMemberPermissions(member)}>Permissions</button>
                  <button className="profile-group-button danger" onClick={async () => { await onKickMember(member.id); await handleShowMembers('members'); }}>Remove</button>
                </>}
              </>}
            </div>
          </div>;
        })}</div>}
    </div>}

    {managing && <>
      <div className="wpf-scroll-viewer profile-group-scroll">
        <section className="profile-group-section">
          <div className="profile-group-general">
            <button className="profile-group-avatar" style={{ backgroundColor: getAvatarColor(groupId) }} onClick={() => fileInput.current?.click()} title="Change group avatar">
              {normalizeCallAvatar(editGroupAvatar) ? <img src={normalizeCallAvatar(editGroupAvatar) || undefined} alt="Group avatar" /> : <span className="profile-group-avatar-letter">{getFirstLetter(editGroupName)}</span>}
              <span className="profile-group-avatar-mark"><Icons.PencilOutline size={13} color="#fff" /></span>
            </button>
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={event => {
              const file = event.target.files?.[0]; if (!file) return;
              const reader = new FileReader(); reader.onload = () => setEditGroupAvatar(String(reader.result).split(',')[1]); reader.readAsDataURL(file);
              event.target.value = '';
            }} />
            <div><label className="profile-group-label" htmlFor="group-profile-name">Group name</label>
              <input id="group-profile-name" className="profile-group-field" value={editGroupName} onChange={event => setEditGroupName(event.target.value)} />
            </div>
          </div>
          <label className="profile-group-label" htmlFor="group-profile-description">Description</label>
          <textarea id="group-profile-description" className="profile-group-field" rows={3} value={editGroupDescription} onChange={event => setEditGroupDescription(event.target.value)} placeholder="Add a description for this group…" />
        </section>

        <section className="profile-group-section">
          <span className="profile-group-label">Group type</span>
          <div className="profile-group-type" role="group" aria-label="Group type">
            <button aria-pressed={!editGroupIsPublic} onClick={() => setEditGroupIsPublic(false)}>Private</button>
            <button aria-pressed={editGroupIsPublic} onClick={() => setEditGroupIsPublic(true)}>Public</button>
          </div>
          {editGroupIsPublic ? <><label className="profile-group-label" htmlFor="group-profile-link">Public link</label>
            <input id="group-profile-link" className="profile-group-field" value={editGroupLink} onChange={event => setEditGroupLink(event.target.value)} placeholder="Group link" /></> : <>
            <span className="profile-group-label">Invite link</span>
            {inviteActive ? <div className="profile-group-link-row"><span className="profile-group-link" title={groupDetails.groupLink}>{groupDetails.groupLink}</span>
              <button className="profile-group-button danger" onClick={async () => { if (await vm.services.revokeInviteLink(groupId)) await vm.loadGroupDetails(groupId); }}>Revoke</button>
            </div> : <><p className="profile-group-note">No active invite link</p>
              <button className="profile-group-button link" onClick={async () => { if (await vm.services.generateInviteLink(groupId)) await vm.loadGroupDetails(groupId); }}>Create Invite Link</button></>}
          </>}
        </section>

        <section className="profile-group-section">
          <span className="profile-group-label">Default member permissions</span>
          {([
            ['Send Text Messages', 'Members can write text in chat', groupCanSendText, setGroupCanSendText],
            ['Send Media Files', 'Photos, videos, files and documents', groupCanSendMedia, setGroupCanSendMedia],
            ['Pin Messages', 'Members can pin messages', groupCanPinMessages, setGroupCanPinMessages],
          ] as const).map(([label, description, checked, onChange]) => <label className="profile-group-permission" key={label}>
            <div><div className="profile-group-permission-title">{label}</div><p className="profile-group-note">{description}</p></div>
            <input className="profile-group-switch" type="checkbox" role="switch" checked={checked} onChange={event => onChange(event.target.checked)} />
          </label>)}
        </section>
      </div>
      {saveError && <div className="profile-group-error" role="alert">{saveError}</div>}
      <footer className="profile-group-footer">
        <button className="profile-group-button danger" onClick={onLeaveGroup}>Delete Group</button>
        <div className="profile-group-footer-actions">
          <button className="profile-group-button" onClick={collapseRightPanel} disabled={saving}>Cancel</button>
          <button className="profile-group-button primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </footer>
    </>}
  </div>;
};
