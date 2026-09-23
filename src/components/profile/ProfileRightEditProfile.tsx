import React, { useRef } from 'react';
import { Gender } from '../../types/enums';
import { getFirstLetter } from './profileView.utils';
import { useProfileView } from './useProfileView';
import { Theme } from './profile.theme';
import { Icons } from './ProfileIcons';

interface ProfileRightEditProfileProps {
  vm: ReturnType<typeof useProfileView>;
  onClose: () => void;
}

export const ProfileRightEditProfile: React.FC<ProfileRightEditProfileProps> = ({
  vm,
  onClose,
}) => {
  const {
    editUser,
    setEditUser,
    editErrors,
    displayedUser,
    handleSaveEditProfile,
  } = vm;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64 = uploadEvent.target?.result as string;
        setEditUser({ ...editUser, avatar: base64, avatarPath: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ШАПКА: Редактирование */}
      <div style={rightHeaderStyle}>
        <span style={{ fontSize: 26, fontWeight: 800, color: Theme.MainWindowText }}>Edit Profile</span>
        <button onClick={onClose} style={iconBtnStyle} title="Close Profile">
          <Icons.Close size={20} color={Theme.ProfileSectionLabel} />
        </button>
      </div>

      {/* ФОРМА */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 25px 20px 25px' }}>
        <div style={labelStyle}>GENERAL</div>

        {/* БЛОК С АВАТАРОМ И НИКОМ / ЮЗЕРНЕЙМОМ */}
        <div style={avatarSectionStyle}>
          {/* Кнопка смены аватара 120x120 */}
          <div
            onClick={() => fileInputRef.current?.click()}
            title="Click to change profile picture"
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
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
              onChange={handleAvatarChange}
            />
            {editUser.avatar || editUser.avatarPath ? (
              <img
                src={editUser.avatar || editUser.avatarPath || ''}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ fontSize: 36, color: '#FFF', fontWeight: 'bold' }}>
                {getFirstLetter(editUser.nickName)}
              </span>
            )}
            <div style={cameraOverlayStyle}>
              <Icons.PencilOutline size={26} color="#FFFFFF" />
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
            <div>
              <div style={labelStyle}>NICKNAME</div>
              <input
                type="text"
                value={editUser.nickName || ''}
                onChange={(e) => setEditUser({ ...editUser, nickName: e.target.value })}
                style={cardInputStyle}
              />
              {editErrors.nickName && <div style={errorStyle}>{editErrors.nickName}</div>}
            </div>

            <div>
              <div style={labelStyle}>USERNAME</div>
              <input
                type="text"
                value={editUser.username || ''}
                onChange={(e) => setEditUser({ ...editUser, username: e.target.value })}
                style={cardInputStyle}
              />
              {editErrors.username && <div style={errorStyle}>{editErrors.username}</div>}
            </div>
          </div>
        </div>

        {/* ОСТАЛЬНЫЕ ПОЛЯ РЕДАКТИРОВАНИЯ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={labelStyle}>ABOUT ME</div>
            <textarea
              rows={3}
              value={editUser.description || ''}
              onChange={(e) => setEditUser({ ...editUser, description: e.target.value })}
              style={{ ...cardInputStyle, resize: 'none' }}
            />
            {editErrors.description && <div style={errorStyle}>{editErrors.description}</div>}
          </div>

          <div>
            <div style={labelStyle}>PHONE</div>
            <input
              type="text"
              value={editUser.phone || ''}
              onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })}
              style={cardInputStyle}
            />
            {editErrors.phone && <div style={errorStyle}>{editErrors.phone}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={labelStyle}>FIRST NAME</div>
              <input
                type="text"
                value={editUser.firstName || ''}
                onChange={(e) => setEditUser({ ...editUser, firstName: e.target.value })}
                style={cardInputStyle}
              />
              {editErrors.firstName && <div style={errorStyle}>{editErrors.firstName}</div>}
            </div>
            <div>
              <div style={labelStyle}>LAST NAME</div>
              <input
                type="text"
                value={editUser.lastName || ''}
                onChange={(e) => setEditUser({ ...editUser, lastName: e.target.value })}
                style={cardInputStyle}
              />
              {editErrors.lastName && <div style={errorStyle}>{editErrors.lastName}</div>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={labelStyle}>GENDER</div>
              <select
                value={editUser.gender ?? Gender.Male}
                onChange={(e) => setEditUser({ ...editUser, gender: Number(e.target.value) as Gender })}
                style={selectStyle}
              >
                <option value={Gender.Male}>Male</option>
                <option value={Gender.Female}>Female</option>
              </select>
            </div>
            <div>
              <div style={labelStyle}>DATE OF BIRTH</div>
              <input
                type="date"
                value={editUser.birthday ? editUser.birthday.substring(0, 10) : ''}
                onChange={(e) => setEditUser({ ...editUser, birthday: e.target.value })}
                style={cardInputStyle}
              />
              {editErrors.birthday && <div style={errorStyle}>{editErrors.birthday}</div>}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 14 }}>
            <button
              onClick={() => {
                setEditUser({ ...displayedUser });
                setEditErrors({});
              }}
              style={secondaryBtnStyle}
            >
              Reset
            </button>
            <button
              onClick={handleSaveEditProfile}
              style={primaryBtnStyle}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
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
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 'bold',
  color: Theme.ProfileSectionLabel,
  marginBottom: 6,
};

const errorStyle: React.CSSProperties = {
  color: Theme.ProfileValidationError,
  fontSize: 11,
  marginTop: 4,
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
  width: '100%',
  padding: '10px 14px',
  background: Theme.ProfileComboBoxDropdownBg,
  border: `1px solid ${Theme.ProfileInputContainerBorder}`,
  borderRadius: 10,
  color: Theme.ProfileComboBoxDropdownText,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const avatarSectionStyle: React.CSSProperties = {
  background: `linear-gradient(135deg, ${Theme.ProfileEditGeneralBgStart} 0%, ${Theme.ProfileEditGeneralBgEnd} 100%)`,
  borderRadius: 12,
  padding: 16,
  display: 'flex',
  gap: 20,
  marginBottom: 16,
  border: `1px solid ${Theme.ProfileEditGeneralBorder}`,
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

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 24px',
  borderRadius: 10,
  background: Theme.AppAccent,
  color: '#FFF',
  border: 'none',
  fontSize: 14,
  fontWeight: 'bold',
  cursor: 'pointer',
  boxShadow: '0 0 15px rgba(30, 155, 235, 0.4)',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 10,
  background: 'transparent',
  color: Theme.ProfileSectionLabel,
  border: 'none',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};