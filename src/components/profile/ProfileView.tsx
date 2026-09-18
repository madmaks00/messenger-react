import React, { useState, useEffect, useRef } from 'react';
import { IUser, IUserSearchResult } from '../../types/models';
import { userService } from '../../services/user.service';
import { groupService } from '../../services/group.service';
import { userSession } from '../../services/userSession';

interface ProfileViewProps {
  isOpen: boolean;
  user: IUser | IUserSearchResult;
  isOwnProfile: boolean;
  isGroupProfile?: boolean;
  onClose: () => void;
  onStartChat?: (userId: number) => void;
  onCallUser?: (user: any) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  isOpen,
  user,
  isOwnProfile,
  isGroupProfile = false,
  onClose,
  onStartChat,
  onCallUser,
}) => {
  // Анимация раздвижения: 365px -> 888px
  const [isExpanded, setIsExpanded] = useState(isOwnProfile);
  const [activeTab, setActiveTab] = useState<'stories' | 'edit' | 'settings' | 'sharedMedia' | 'members' | 'manageGroup'>(
    isOwnProfile ? 'stories' : 'sharedMedia'
  );

  // Подразделы настроек
  const [settingsSubPanel, setSettingsSubPanel] = useState<
    'main' | 'privacy' | 'changePassword' | 'devices' | 'speakersCamera' | 'language' | 'blockedUsers' | 'passcode'
  >('main');

  // Данные профиля
  const [displayedUser, setDisplayedUser] = useState<any>(user);
  const [groupDetails, setGroupDetails] = useState<any>(null);
  const [membersList, setMembersList] = useState<any[]>([]);
  const [membersTitle, setMembersTitle] = useState('Members');

  // Модалка прав участника
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [permAdmin, setPermAdmin] = useState(false);
  const [permText, setPermText] = useState(true);
  const [permMedia, setPermMedia] = useState(true);
  const [permPin, setPermPin] = useState(false);

  // Скопированный текст со статусом галочки
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    setDisplayedUser(user);
    if (isGroupProfile && user.id) {
      groupService.getGroupDetailsAsync(user.id).then(setGroupDetails);
    }
  }, [user, isGroupProfile]);

  useEffect(() => {
    setIsExpanded(isOwnProfile);
  }, [isOwnProfile]);

  if (!isOpen) return null;

  const handleCopy = (text: string, fieldKey: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const openRightTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setIsExpanded(true);
  };

  const handleOpenMembers = async (type: 'members' | 'admins' | 'blacklist') => {
    if (!user.id) return;
    let list = [];
    if (type === 'members') {
      setMembersTitle('Members');
      list = (await groupService.getGroupMembersAsync(user.id)) || [];
    } else if (type === 'admins') {
      setMembersTitle('Administrators');
      list = (await groupService.getGroupAdministratorsAsync(user.id)) || [];
    } else {
      setMembersTitle('Blacklist');
      list = (await groupService.getGroupBlacklistAsync(user.id)) || [];
    }
    setMembersList(list);
    openRightTab('members');
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* КАРТОЧКА ПРОФИЛЯ (ШИРИНА 365px ИЛИ 888px) */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isExpanded ? 888 : 365,
          height: 720,
          backgroundColor: '#1E2330',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          display: 'grid',
          gridTemplateColumns: isExpanded ? '365px 1fr' : '365px',
          overflow: 'hidden',
          transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* ================= 1. ЛЕВАЯ КОЛОНКА (ОСНОВНАЯ) ================= */}
        <div
          style={{
            width: 365,
            height: '100%',
            backgroundColor: '#1A1E29',
            borderRight: isExpanded ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {/* Кнопка закрытия карточки (если правая панель скрыта) */}
          {!isExpanded && (
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontSize: 18,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          )}

          {/* СТАТИЧНЫЙ ВЕРХ */}
          <div style={{ padding: '24px 20px 15px 20px', textAlign: 'center' }}>
            {/* Аватар 110x110 */}
            <div
              style={{
                width: 110,
                height: 110,
                borderRadius: 55,
                margin: '0 auto 12px',
                backgroundColor: '#3B82F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 42,
                fontWeight: 'bold',
                color: '#FFF',
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              }}
            >
              {displayedUser.avatar || displayedUser.avatarPath ? (
                <img src={displayedUser.avatar || displayedUser.avatarPath} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (displayedUser.nickName || displayedUser.name || 'U').charAt(0).toUpperCase()
              )}
            </div>

            {/* Имя */}
            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 'bold', color: '#FFF' }}>
              {displayedUser.nickName || displayedUser.name}
            </h3>

            {/* Юзернейм с анимацией копирования */}
            {displayedUser.username && (
              <div
                onClick={() => handleCopy(`@${displayedUser.username}`, 'username')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 4,
                  color: 'var(--app-accent, #38BDF8)',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                <span>@{displayedUser.username}</span>
                <span style={{ fontSize: 12 }}>{copiedField === 'username' ? '✓' : '📋'}</span>
              </div>
            )}

            {/* КНОПКИ ДЕЙСТВИЯ (ЧУЖОЙ ПРОФИЛЬ: CHAT, CALL, MUTE) */}
            {!isOwnProfile && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 15 }}>
                <button onClick={() => onStartChat?.(displayedUser.id)} style={actionSquareBtnStyle}>
                  💬 <span style={{ fontSize: 11 }}>Chat</span>
                </button>
                <button onClick={() => onCallUser?.(displayedUser)} style={actionSquareBtnStyle}>
                  📞 <span style={{ fontSize: 11 }}>Call</span>
                </button>
                <button style={actionSquareBtnStyle}>
                  🔔 <span style={{ fontSize: 11 }}>Mute</span>
                </button>
              </div>
            )}

            {/* КНОПКИ ДЕЙСТВИЯ (СВОЙ ПРОФИЛЬ: STORIES, EDIT INFO, SETTINGS) */}
            {isOwnProfile && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 15 }}>
                <button onClick={() => openRightTab('stories')} style={actionSquareBtnStyle}>
                  ▶ <span style={{ fontSize: 11 }}>Stories</span>
                </button>
                <button onClick={() => openRightTab('edit')} style={actionSquareBtnStyle}>
                  ✏ <span style={{ fontSize: 11 }}>Edit Info</span>
                </button>
                <button onClick={() => openRightTab('settings')} style={actionSquareBtnStyle}>
                  ⚙ <span style={{ fontSize: 11 }}>Settings</span>
                </button>
              </div>
            )}
          </div>

          <div style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)', margin: '0 20px' }} />

          {/* СКРОЛЛИРУЕМАЯ ИНФОРМАЦИЯ */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
            {/* Описание / О себе */}
            <div style={{ marginBottom: 18 }}>
              <div style={labelStyle}>{isGroupProfile ? 'Description' : 'About me'}</div>
              <div style={{ color: '#FFF', fontSize: 14 }}>
                {displayedUser.description || groupDetails?.description || <span style={{ color: '#64748B' }}>Not set</span>}
              </div>
            </div>

            {/* Телефон */}
            {!isGroupProfile && displayedUser.phone && (
              <div style={{ marginBottom: 18 }}>
                <div style={labelStyle}>Phone Number</div>
                <div
                  onClick={() => handleCopy(displayedUser.phone, 'phone')}
                  style={{ color: '#FFF', fontSize: 14, cursor: 'pointer', display: 'flex', gap: 6 }}
                >
                  <span>{displayedUser.phone}</span>
                  {copiedField === 'phone' && <span style={{ color: '#38BDF8' }}>✓</span>}
                </div>
              </div>
            )}

            {/* Email */}
            {!isGroupProfile && displayedUser.email && (
              <div style={{ marginBottom: 18 }}>
                <div style={labelStyle}>Email Address</div>
                <div
                  onClick={() => handleCopy(displayedUser.email, 'email')}
                  style={{ color: '#FFF', fontSize: 14, cursor: 'pointer', display: 'flex', gap: 6 }}
                >
                  <span>{displayedUser.email}</span>
                  {copiedField === 'email' && <span style={{ color: '#38BDF8' }}>✓</span>}
                </div>
              </div>
            )}

            {/* Дата рождения */}
            {!isGroupProfile && displayedUser.birthday && (
              <div style={{ marginBottom: 18 }}>
                <div style={labelStyle}>Date of Birth</div>
                <div style={{ color: '#FFF', fontSize: 14 }}>{new Date(displayedUser.birthday).toLocaleDateString()}</div>
              </div>
            )}

            {/* ПУНКТЫ УПРАВЛЕНИЯ ГРУППОЙ */}
            {isGroupProfile && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button onClick={() => handleOpenMembers('members')} style={menuListBtnStyle}>
                  👥 Members ({groupDetails?.memberCount || 1})
                </button>
                <button onClick={() => handleOpenMembers('admins')} style={menuListBtnStyle}>
                  🛡 Administrators
                </button>
                <button onClick={() => handleOpenMembers('blacklist')} style={menuListBtnStyle}>
                  🚫 Blacklist
                </button>
                <button onClick={() => openRightTab('manageGroup')} style={{ ...menuListBtnStyle, color: '#38BDF8', fontWeight: 'bold' }}>
                  ⚙ Manage Group
                </button>
              </div>
            )}

            {/* ОБЩИЕ МЕДИАФАЙЛЫ ДЛЯ ДИАЛОГА */}
            {!isGroupProfile && !isOwnProfile && (
              <div style={{ marginTop: 15 }}>
                <div style={labelStyle}>SHARED MEDIA</div>
                <button onClick={() => openRightTab('sharedMedia')} style={menuListBtnStyle}>
                  🖼 Photos & Videos
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ================= 2. ПРАВАЯ КОЛОНКА (РАСШИРЕНИЕ) ================= */}
        {isExpanded && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#1E2330', position: 'relative' }}>
            {/* ШАПКА ПРАВОЙ ПАНЕЛИ */}
            <div style={{ height: 56, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: '#FFF' }}>
                {activeTab === 'stories' && 'Stories'}
                {activeTab === 'edit' && 'Edit Profile'}
                {activeTab === 'settings' && 'Settings'}
                {activeTab === 'sharedMedia' && 'Shared Media'}
                {activeTab === 'members' && membersTitle}
                {activeTab === 'manageGroup' && 'Manage Group'}
              </div>
              <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#FFF', fontSize: 20, cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            {/* КОНТЕНТ ВЫБРАННОЙ ВКЛАДКИ */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              {/* ВКЛАДКА 1: EDIT PROFILE */}
              {activeTab === 'edit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>NICKNAME</label>
                    <input
                      type="text"
                      value={displayedUser.nickName || ''}
                      onChange={(e) => setDisplayedUser({ ...displayedUser, nickName: e.target.value })}
                      style={cardInputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>USERNAME</label>
                    <input
                      type="text"
                      value={displayedUser.username || ''}
                      onChange={(e) => setDisplayedUser({ ...displayedUser, username: e.target.value })}
                      style={cardInputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>ABOUT ME</label>
                    <textarea
                      rows={3}
                      value={displayedUser.description || ''}
                      onChange={(e) => setDisplayedUser({ ...displayedUser, description: e.target.value })}
                      style={{ ...cardInputStyle, resize: 'none' }}
                    />
                  </div>
                  <button
                    onClick={() => userService.updateProfileAsync(displayedUser)}
                    style={{ ...actionSquareBtnStyle, height: 42, background: 'var(--app-accent, #3B82F6)', color: '#FFF', fontWeight: 'bold' }}
                  >
                    Save Changes
                  </button>
                </div>
              )}

              {/* ВКЛАДКА 2: SETTINGS & SUB-PANELS */}
              {activeTab === 'settings' && settingsSubPanel === 'main' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={() => setSettingsSubPanel('privacy')} style={menuListBtnStyle}>
                    🛡 Privacy & Security
                  </button>
                  <button onClick={() => setSettingsSubPanel('devices')} style={menuListBtnStyle}>
                    💻 Devices (Active Sessions)
                  </button>
                  <button onClick={() => setSettingsSubPanel('changePassword')} style={menuListBtnStyle}>
                    🔑 Change Password
                  </button>
                  <button onClick={() => setSettingsSubPanel('speakersCamera')} style={menuListBtnStyle}>
                    🔊 Speakers & Camera
                  </button>
                </div>
              )}

              {/* ПОДРАЗДЕЛ: PRIVACY */}
              {activeTab === 'settings' && settingsSubPanel === 'privacy' && (
                <div>
                  <button onClick={() => setSettingsSubPanel('main')} style={{ ...menuListBtnStyle, marginBottom: 12, color: '#38BDF8' }}>
                    ← Back to Settings
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={settingRowStyle}>
                      <span>Last Seen & Online</span>
                      <select style={selectStyle}><option>Everybody</option><option>Contacts</option><option>Nobody</option></select>
                    </div>
                    <div style={settingRowStyle}>
                      <span>Profile Photo</span>
                      <select style={selectStyle}><option>Everybody</option><option>Nobody</option></select>
                    </div>
                  </div>
                </div>
              )}

              {/* ВКЛАДКА 3: MEMBERS / ADMINS / BLACKLIST */}
              {activeTab === 'members' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {membersList.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: '#1A1E29',
                        borderRadius: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 18, background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                          {(m.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#FFF' }}>{m.name}</div>
                          <div style={{ fontSize: 12, color: '#94A3B8' }}>@{m.username}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => {
                            setEditingMember(m);
                            setPermAdmin(m.roleName === 'Admin' || m.roleName === 'Administrator');
                          }}
                          style={smallActionBtn}
                        >
                          Permissions
                        </button>
                        <button onClick={() => groupService.kickMemberAsync(user.id, m.id)} style={{ ...smallActionBtn, color: '#EF4444' }}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ВКЛАДКА 4: MANAGE GROUP */}
              {activeTab === 'manageGroup' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>GROUP NAME</label>
                    <input
                      type="text"
                      defaultValue={displayedUser.nickName || ''}
                      style={cardInputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>DESCRIPTION</label>
                    <textarea
                      rows={3}
                      defaultValue={groupDetails?.description || ''}
                      style={{ ...cardInputStyle, resize: 'none' }}
                    />
                  </div>
                  <button
                    onClick={() => groupService.leaveGroupAsync(user.id)}
                    style={{ ...smallActionBtn, height: 40, color: '#EF4444', border: '1px solid #EF4444', background: 'transparent' }}
                  >
                    Delete / Leave Group
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ================= ДИАЛОГ НАСТРОЙКИ ПРАВ УЧАСТНИКА ================= */}
      {editingMember && (
        <div
          onClick={() => setEditingMember(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 380, backgroundColor: '#1E2330', borderRadius: 16, padding: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
          >
            <h4 style={{ margin: '0 0 16px 0', color: '#FFF', fontSize: 16 }}>
              Edit Permissions: {editingMember.name}
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <label style={toggleLabelStyle}>
                <span>Administrator</span>
                <input type="checkbox" checked={permAdmin} onChange={(e) => setPermAdmin(e.target.checked)} />
              </label>
              <label style={toggleLabelStyle}>
                <span>Send Messages</span>
                <input type="checkbox" checked={permText} onChange={(e) => setPermText(e.target.checked)} />
              </label>
              <label style={toggleLabelStyle}>
                <span>Send Media</span>
                <input type="checkbox" checked={permMedia} onChange={(e) => setPermMedia(e.target.checked)} />
              </label>
              <label style={toggleLabelStyle}>
                <span>Pin Messages</span>
                <input type="checkbox" checked={permPin} onChange={(e) => setPermPin(e.target.checked)} />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setEditingMember(null)} style={smallActionBtn}>Cancel</button>
              <button
                onClick={() => {
                  groupService.saveMemberPermissionsAsync(user.id, editingMember.id, {
                    isAdmin: permAdmin,
                    canSendText: permText,
                    canSendMedia: permMedia,
                    canPinMessages: permPin,
                  });
                  setEditingMember(null);
                }}
                style={{ ...smallActionBtn, background: '#3B82F6', color: '#FFF' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 'bold',
  color: '#64748B',
  marginBottom: 4,
};

const actionSquareBtnStyle: React.CSSProperties = {
  height: 52,
  borderRadius: 8,
  border: '1px solid #334155',
  backgroundColor: '#1E2330',
  color: '#FFF',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  cursor: 'pointer',
};

const menuListBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'transparent',
  border: 'none',
  borderRadius: 8,
  color: '#FFF',
  textAlign: 'left',
  fontSize: 14,
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const cardInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: '#1A1E29',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#FFF',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const settingRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 14px',
  background: '#1A1E29',
  borderRadius: 8,
  color: '#FFF',
  fontSize: 14,
};

const selectStyle: React.CSSProperties = {
  background: '#1E2330',
  color: '#FFF',
  border: '1px solid #334155',
  borderRadius: 6,
  padding: '4px 8px',
  outline: 'none',
};

const toggleLabelStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: '#FFF',
  fontSize: 14,
  cursor: 'pointer',
};

const smallActionBtn: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  background: '#334155',
  color: '#FFF',
  border: 'none',
  fontSize: 12,
  cursor: 'pointer',
  fontWeight: 600,
};