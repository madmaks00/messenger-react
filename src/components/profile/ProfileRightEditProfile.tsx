import React, { useRef, useState } from 'react';
import { Gender } from '../../types/enums';
import { getFirstLetter, normalizeImageSrc } from './profileView.utils';
import { useProfileView } from './useProfileView';
import { Theme } from './profile.theme';
import { Icons } from './ProfileIcons';
import { CloseButton } from './ProfileRightSettings';

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
    setEditErrors,
    displayedUser,
    handleSaveEditProfile,
  } = vm;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isAvatarHovered, setIsAvatarHovered] = useState(false);

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

  const editAvatarSrc = normalizeImageSrc(editUser.avatar || editUser.avatarPath);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ШАПКА */}
      <div style={rightHeaderStyle}>
        <span style={{ fontSize: 26, fontWeight: 800, color: Theme.MainWindowText }}>Edit Profile</span>
        <CloseButton onClick={onClose} />
      </div>

      {/* СКРОЛЛИРУЕМАЯ ФОРМА (1:1 XAML) */}
      <div className="wpf-scroll-viewer" style={{ flex: 1, padding: '0 25px 20px 25px' }}>
        <div style={labelStyle}>GENERAL</div>

        {/* 1. БЛОК С АВАТАРОМ И НИКОМ / ЮЗЕРНЕЙМОМ */}
        <div style={avatarSectionStyle}>
          <div
            onClick={() => fileInputRef.current?.click()}
            onMouseEnter={() => setIsAvatarHovered(true)}
            onMouseLeave={() => setIsAvatarHovered(false)}
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
              boxSizing: 'border-box',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
            {editAvatarSrc ? (
              <img
                src={editAvatarSrc}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ fontSize: 36, color: '#FFF', fontWeight: 'bold' }}>
                {getFirstLetter(editUser.nickName)}
              </span>
            )}

            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: Theme.ProfileEditAvatarCameraOverlayBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isAvatarHovered ? 1 : 0,
                transition: 'opacity 0.15s ease',
              }}
            >
              <Icons.CameraPlusOutline size={30} color="#FFFFFF" />
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
            <div>
              <div style={labelStyle}>NICKNAME</div>
              <div style={modernInputContainerStyle}>
                <div style={inputIconWrapperStyle}>
                  <Icons.BadgeAccountHorizontalOutline size={20} color={Theme.ProfileEditInputIcon} />
                </div>
                <input
                  type="text"
                  value={editUser.nickName || ''}
                  onChange={(e) => setEditUser({ ...editUser, nickName: e.target.value })}
                  style={{ ...cleanInputStyle, fontSize: 16, fontWeight: 'bold' }}
                />
              </div>
              {editErrors.nickName && <div style={errorStyle}>{editErrors.nickName}</div>}
            </div>

            <div>
              <div style={labelStyle}>USERNAME</div>
              <div style={modernInputContainerStyle}>
                <div style={inputIconWrapperStyle}>
                  <Icons.At size={18} color={Theme.ProfileEditInputIcon} />
                </div>
                <input
                  type="text"
                  value={editUser.username || ''}
                  onChange={(e) => setEditUser({ ...editUser, username: e.target.value })}
                  style={cleanInputStyle}
                />
              </div>
              {editErrors.username && <div style={errorStyle}>{editErrors.username}</div>}
            </div>
          </div>
        </div>

        {/* 2. ОСТАЛЬНЫЕ ПОЛЯ РЕДАКТИРОВАНИЯ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={labelStyle}>ABOUT ME</div>
            <div style={{ ...modernInputContainerStyle, height: 'auto', minHeight: 70, alignItems: 'start' }}>
              <div style={{ ...inputIconWrapperStyle, paddingTop: 10 }}>
                <Icons.InformationOutline size={18} color={Theme.ProfileInfoIconAbout} />
              </div>
              <textarea
                rows={3}
                value={editUser.description || ''}
                onChange={(e) => setEditUser({ ...editUser, description: e.target.value })}
                style={{
                  ...cleanInputStyle,
                  padding: '8px 15px 10px 0',
                  resize: 'none',
                  minHeight: 60,
                }}
              />
            </div>
            {editErrors.description && <div style={errorStyle}>{editErrors.description}</div>}
          </div>

          <div>
            <div style={labelStyle}>PHONE</div>
            <div style={modernInputContainerStyle}>
              <div style={inputIconWrapperStyle}>
                <Icons.PhoneSectionOutline size={18} color={Theme.ProfileInfoIconPhone} />
              </div>
              <input
                type="text"
                value={editUser.phone || ''}
                onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })}
                style={cleanInputStyle}
              />
            </div>
            {editErrors.phone && <div style={errorStyle}>{editErrors.phone}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={labelStyle}>FIRST NAME</div>
              <div style={modernInputContainerStyle}>
                <div style={inputIconWrapperStyle}>
                  <Icons.AccountOutline size={18} color={Theme.ProfileInfoIconName} />
                </div>
                <input
                  type="text"
                  value={editUser.firstName || ''}
                  onChange={(e) => setEditUser({ ...editUser, firstName: e.target.value })}
                  style={cleanInputStyle}
                />
              </div>
              {editErrors.firstName && <div style={errorStyle}>{editErrors.firstName}</div>}
            </div>

            <div>
              <div style={labelStyle}>LAST NAME</div>
              <div style={modernInputContainerStyle}>
                <div style={inputIconWrapperStyle}>
                  <Icons.AccountDetailsOutline size={18} color={Theme.ProfileInfoIconName} />
                </div>
                <input
                  type="text"
                  value={editUser.lastName || ''}
                  onChange={(e) => setEditUser({ ...editUser, lastName: e.target.value })}
                  style={cleanInputStyle}
                />
              </div>
              {editErrors.lastName && <div style={errorStyle}>{editErrors.lastName}</div>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={labelStyle}>GENDER</div>
              <div style={modernInputContainerStyle}>
                <div style={inputIconWrapperStyle}>
                  <Icons.GenderMaleFemale size={18} color={Theme.ProfileInfoIconGender} />
                </div>
                <select
                  value={editUser.gender ?? Gender.Male}
                  onChange={(e) => setEditUser({ ...editUser, gender: Number(e.target.value) as Gender })}
                  style={{
                    ...cleanInputStyle,
                    cursor: 'pointer',
                    backgroundColor: 'transparent',
                  }}
                >
                  <option value={Gender.Male} style={{ backgroundColor: Theme.ProfileComboBoxDropdownBg, color: Theme.ProfileComboBoxDropdownText }}>Male</option>
                  <option value={Gender.Female} style={{ backgroundColor: Theme.ProfileComboBoxDropdownBg, color: Theme.ProfileComboBoxDropdownText }}>Female</option>
                </select>
              </div>
            </div>

            <div>
              <div style={labelStyle}>DATE OF BIRTH</div>
              <div style={modernInputContainerStyle}>
                <div style={inputIconWrapperStyle}>
                  <Icons.CakeVariantOutline size={18} color={Theme.ProfileInfoIconBirthday} />
                </div>
                <input
                  type="date"
                  value={editUser.birthday ? editUser.birthday.substring(0, 10) : ''}
                  onChange={(e) => setEditUser({ ...editUser, birthday: e.target.value })}
                  style={{
                    ...cleanInputStyle,
                    cursor: 'pointer',
                  }}
                />
              </div>
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

const modernInputContainerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '42px 1fr',
  alignItems: 'center',
  height: 40,
  backgroundColor: Theme.ProfileInputContainerBg,
  border: `1px solid ${Theme.ProfileInputContainerBorder}`,
  borderRadius: 10,
  boxSizing: 'border-box',
};

const inputIconWrapperStyle: React.CSSProperties = {
  width: 42,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const cleanInputStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: Theme.ProfileInputText,
  fontSize: 14,
  padding: '0 15px 0 0',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
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