import React, { useState } from 'react';
import { IUser } from '../../types/models';
import {
  getAvatarColor,
  getFirstLetter,
  formatPhoneNumber,
  formatDate,
  normalizeImageSrc,
} from './profileView.utils';
import { useProfileView } from './useProfileView';
import { Icons } from './ProfileIcons';
import { Theme } from './profile.theme';

interface ProfileLeftColumnProps {
  vm: ReturnType<typeof useProfileView>;
  isOwnProfile: boolean;
  isGroupProfile: boolean;
  onClose: () => void;
  onStartChat: (userId: number) => void;
  onCallUser: (user: IUser) => void;
  onToggleMute: (userId: number) => void;
  onToggleBlockUser: (userId: number) => void;
  onRevokeInviteLink: (groupId: number) => void;
  onCreateInviteLink: (groupId: number) => void;
}

export const ProfileLeftColumn: React.FC<ProfileLeftColumnProps> = ({
  vm,
  isOwnProfile,
  isGroupProfile,
  onClose,
  onStartChat,
  onCallUser,
  onToggleMute,
  onToggleBlockUser,
  onRevokeInviteLink,
  onCreateInviteLink,
}) => {
  const {
    displayedUser,
    isExpanded,
    copiedKey,
    copyToClipboard,
    expandRightPanel,
    activeRightContainer,
    isObservedUserMuted,
    isBlockedByMe,
    isBlockedByThem,
    groupDetails,
    membersCount,
    adminsCount,
    blackListCount,
    handleOpenStoriesMenu,
    loadSharedMedia,
    handleShowMembers,
    setCurrentSettingsSubPanel,
  } = vm;

  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [hoveredCopyKey, setHoveredCopyKey] = useState<string | null>(null);

  const rawAvatar = isGroupProfile
    ? groupDetails?.avatar
    : (displayedUser.avatar || displayedUser.avatarPath);
  const avatarSrc = normalizeImageSrc(rawAvatar);
  const hasAvatar = Boolean(!avatarLoadError && avatarSrc);

  const renderCopyButton = (
    text: string,
    key: string,
    label: string,
    isAccent: boolean = false
  ) => {
    const isCopied = copiedKey === key;
    const isHovered = hoveredCopyKey === key;
    const textColor = isAccent ? Theme.AppAccent : Theme.MainWindowText;

    return (
      <div
        onClick={() => copyToClipboard(text, key)}
        onMouseEnter={() => setHoveredCopyKey(key)}
        onMouseLeave={() => setHoveredCopyKey(null)}
        title={`Click to copy ${label}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          color: textColor,
          fontSize: 14,
          fontWeight: 500,
          textDecoration: isHovered ? 'underline' : 'none',
        }}
      >
        <span>{text}</span>
        <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isCopied ? (
            <Icons.CheckBold size={14} color={Theme.AppAccent} />
          ) : (
            <div style={{ opacity: isHovered ? 1 : 0, transition: 'opacity 0.15s' }}>
              <Icons.ContentCopy size={13} color={Theme.ProfileSectionLabel} />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        width: 365,
        height: '100%',
        backgroundColor: Theme.ProfileLeftPanelBackground,
        borderRight: isExpanded ? `1px solid ${Theme.ProfileLeftPanelBorder}` : 'none',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* Кнопка закрытия карточки */}
      {!isExpanded && (
        <button
          onClick={onClose}
          title="Close Profile"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'transparent',
            border: 'none',
            color: Theme.ProfileSectionLabel,
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <Icons.Close size={18} color={Theme.ProfileSectionLabel} />
        </button>
      )}

      {/* 1. СТАТИЧНЫЙ ВЕРХ */}
      <div style={{ padding: '20px 20px 15px 20px', textAlign: 'center' }}>
        {/* Аватар 110x110 */}
        <div
          style={{
            width: 110,
            height: 110,
            borderRadius: 55,
            margin: '0 auto 12px',
            backgroundColor: getAvatarColor(isGroupProfile ? groupDetails?.id : displayedUser.id),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <span style={{ fontSize: 42, fontWeight: 'bold', color: Theme.MainWindowText, userSelect: 'none' }}>
            {getFirstLetter(isGroupProfile ? (groupDetails?.name || displayedUser.nickName) : displayedUser.nickName)}
          </span>

          {hasAvatar && (
            <img
              src={avatarSrc}
              alt=""
              onError={() => setAvatarLoadError(true)}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          )}
        </div>

        {/* Имя пользователя / Название группы */}
        <h3
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 'bold',
            color: Theme.MainWindowText,
            marginBottom: isGroupProfile ? 16 : 0,
          }}
        >
          {isGroupProfile ? (groupDetails?.name || displayedUser.nickName) : displayedUser.nickName}
        </h3>

        {/* Юзернейм (@username) */}
        {!isGroupProfile && displayedUser.username && (
          <div style={{ marginTop: 2, marginBottom: 16 }}>
            {renderCopyButton(`@${displayedUser.username}`, 'username', 'username', true)}
          </div>
        )}

        {/* ВЕРХНИЕ КНОПКИ ДЕЙСТВИЯ (ЧУЖОЙ ПРОФИЛЬ) */}
        {!isOwnProfile && !isGroupProfile && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 10 }}>
            <button onClick={() => onStartChat(displayedUser.id)} style={actionSquareBtnStyle}>
              <Icons.MessageTextOutline size={22} color={Theme.ProfileActionButtonText} style={{ marginBottom: 4 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: Theme.ProfileActionButtonText }}>Chat</span>
            </button>
            <button onClick={() => onToggleMute(displayedUser.id)} style={actionSquareBtnStyle}>
              {isObservedUserMuted ? (
                <Icons.BellOffOutline size={22} color={Theme.ProfileActionButtonText} style={{ marginBottom: 4 }} />
              ) : (
                <Icons.BellOutline size={22} color={Theme.ProfileActionButtonText} style={{ marginBottom: 4 }} />
              )}
              <span style={{ fontSize: 11, fontWeight: 600, color: Theme.ProfileActionButtonText }}>
                {isObservedUserMuted ? 'Unmute' : 'Mute'}
              </span>
            </button>
            <button
              onClick={() => onCallUser(displayedUser)}
              disabled={isBlockedByMe || isBlockedByThem}
              style={{
                ...actionSquareBtnStyle,
                opacity: isBlockedByMe || isBlockedByThem ? 0.5 : 1,
                cursor: isBlockedByMe || isBlockedByThem ? 'not-allowed' : 'pointer',
              }}
            >
              <Icons.PhoneOutline size={22} color={Theme.ProfileActionButtonText} style={{ marginBottom: 4 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: Theme.ProfileActionButtonText }}>Call</span>
            </button>
          </div>
        )}

        {/* ВЕРХНИЕ КНОПКИ ДЕЙСТВИЯ (СВОЙ ПРОФИЛЬ: 1:1 С WPF БЕЗ СИНЕЙ РАМКИ) */}
        {isOwnProfile && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 10 }}>
            <button
              onClick={() => expandRightPanel('stories')}
              style={{
                ...actionSquareBtnStyle,
                backgroundColor: activeRightContainer === 'stories' ? Theme.ProfileActionButtonBorder : Theme.ProfileActionButtonBg,
                borderColor: Theme.ProfileActionButtonBorder,
              }}
            >
              <Icons.PlayCircleOutline size={22} color={Theme.ProfileActionButtonText} style={{ marginBottom: 4 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: Theme.ProfileActionButtonText }}>Stories</span>
            </button>
            <button
              onClick={() => expandRightPanel('editProfile')}
              style={{
                ...actionSquareBtnStyle,
                backgroundColor: activeRightContainer === 'editProfile' ? Theme.ProfileActionButtonBorder : Theme.ProfileActionButtonBg,
                borderColor: Theme.ProfileActionButtonBorder,
              }}
            >
              <Icons.PencilOutline size={22} color={Theme.ProfileActionButtonText} style={{ marginBottom: 4 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: Theme.ProfileActionButtonText }}>Edit Info</span>
            </button>
            <button
              onClick={() => {
                setCurrentSettingsSubPanel('main');
                expandRightPanel('settings');
              }}
              style={{
                ...actionSquareBtnStyle,
                backgroundColor: activeRightContainer === 'settings' ? Theme.ProfileActionButtonBorder : Theme.ProfileActionButtonBg,
                borderColor: Theme.ProfileActionButtonBorder,
              }}
            >
              <Icons.CogOutline size={22} color={Theme.ProfileActionButtonText} style={{ marginBottom: 4 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: Theme.ProfileActionButtonText }}>Settings</span>
            </button>
          </div>
        )}
      </div>

      <div style={{ height: 1, backgroundColor: Theme.ProfileLeftPanelBorder, margin: '0 20px' }} />

      {/* 2. СКРОЛЛИРУЕМАЯ ИНФОРМАЦИЯ (1:1 XAML) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '15px 25px' }}>
        {/* 1. Full name (Иконка строго по центру строки, 1:1 с WPF VerticalAlignment="Center") */}
        {!isGroupProfile && (isOwnProfile || displayedUser.firstName || displayedUser.lastName) && (
          <div style={infoRowGridStyle}>
            <div style={infoIconWrapperStyle}>
              <Icons.AccountOutline size={22} color={Theme.ProfileInfoIconName} />
            </div>
            <div>
              <div style={labelStyle}>Full name</div>
              <div style={valueStyle}>
                {displayedUser.firstName || displayedUser.lastName ? (
                  `${displayedUser.firstName || ''} ${displayedUser.lastName || ''}`.trim()
                ) : (
                  <span style={notSetStyle}>Not set</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. About me / Description (Иконка выровнена по верху с отступом 6px, 1:1 с WPF VerticalAlignment="Top" Margin="0,6,15,0") */}
        <div style={infoRowGridStyle}>
          <div style={{ ...infoIconWrapperStyle, alignSelf: 'start', marginTop: 4 }}>
            <Icons.InformationOutline size={22} color={Theme.ProfileInfoIconAbout} />
          </div>
          <div>
            <div style={labelStyle}>{isGroupProfile ? 'Description' : 'About me'}</div>
            <div style={{ ...valueStyle, wordBreak: 'break-word' }}>
              {isGroupProfile ? (
                groupDetails?.description || <span style={notSetStyle}>No description provided</span>
              ) : (
                displayedUser.description || <span style={notSetStyle}>Not set</span>
              )}
            </div>
          </div>
        </div>

        {/* 3. Group Link & Type */}
        {isGroupProfile && (
          <div style={infoRowGridStyle}>
            <div style={infoIconWrapperStyle}>
              <Icons.LinkVariant size={22} color={Theme.AppAccent} />
            </div>
            <div>
              {groupDetails?.isPublic ? (
                <>
                  <div style={labelStyle}>Link</div>
                  {renderCopyButton(groupDetails.groupLink || `@${groupDetails.username || 'group'}`, 'groupLink', 'link', true)}
                </>
              ) : groupDetails?.isAdmin || groupDetails?.isOwner ? (
                <>
                  <div style={labelStyle}>Invite Link (Private)</div>
                  {groupDetails?.groupLink ? (
                    <div>
                      {renderCopyButton(groupDetails.groupLink, 'inviteLink', 'invite link', true)}
                      <div style={{ fontSize: 12, color: Theme.ProfileSectionLabel, marginTop: 2 }}>
                        {groupDetails.inviteLinkExpirationDisplay || 'Active invite link'}
                      </div>
                      <button
                        onClick={() => onRevokeInviteLink(displayedUser.id)}
                        style={{ background: 'none', border: 'none', color: Theme.ProfileDestructiveAction, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, marginTop: 4 }}
                      >
                        Revoke Link
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ color: Theme.ProfileSectionLabel, fontSize: 13, marginBottom: 4 }}>No active invite link</div>
                      <button
                        onClick={() => onCreateInviteLink(displayedUser.id)}
                        style={{ background: 'none', border: 'none', color: Theme.AppAccent, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', padding: 0 }}
                      >
                        Create Invite Link
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={labelStyle}>Group Type</div>
                  <div style={valueStyle}>Private Group</div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 4. Phone Number (Иконка строго по центру строки, текст белый) */}
        {!isGroupProfile && (isOwnProfile || displayedUser.phone) && (
          <div style={infoRowGridStyle}>
            <div style={infoIconWrapperStyle}>
              <Icons.PhoneSectionOutline size={22} color={Theme.ProfileInfoIconPhone} />
            </div>
            <div>
              <div style={labelStyle}>Phone Number</div>
              {displayedUser.phone && displayedUser.phone !== 'Not set' ? (
                renderCopyButton(formatPhoneNumber(displayedUser.phone), 'phone', 'Phone', false)
              ) : (
                <span style={notSetStyle}>Not set</span>
              )}
            </div>
          </div>
        )}

        {/* 5. Email Address (Иконка строго по центру строки, текст белый) */}
        {!isGroupProfile && (isOwnProfile || displayedUser.email) && (
          <div style={infoRowGridStyle}>
            <div style={infoIconWrapperStyle}>
              <Icons.EmailOutline size={22} color={Theme.ProfileInfoIconEmail} />
            </div>
            <div>
              <div style={labelStyle}>Email Address</div>
              {displayedUser.email && displayedUser.email !== 'Not set' ? (
                renderCopyButton(displayedUser.email, 'email', 'Email', false)
              ) : (
                <span style={notSetStyle}>Not set</span>
              )}
            </div>
          </div>
        )}

        {/* 6. Gender (Иконка строго по центру строки, честный знак ♂/♀) */}
        {!isGroupProfile && (isOwnProfile || (displayedUser.gender !== null && displayedUser.gender !== undefined)) && (
          <div style={infoRowGridStyle}>
            <div style={infoIconWrapperStyle}>
              <Icons.GenderMaleFemale size={22} color={Theme.ProfileInfoIconGender} />
            </div>
            <div>
              <div style={labelStyle}>Gender</div>
              <div style={valueStyle}>
                {displayedUser.gender === 0 || displayedUser.gender === 'Male' as any
                  ? 'Male'
                  : displayedUser.gender === 1 || displayedUser.gender === 'Female' as any
                  ? 'Female'
                  : <span style={notSetStyle}>Not set</span>}
              </div>
            </div>
          </div>
        )}

        {/* 7. Date of Birth (Иконка строго по центру строки, честный торт CakeVariant) */}
        {!isGroupProfile && (isOwnProfile || displayedUser.birthday) && (
          <div style={infoRowGridStyle}>
            <div style={infoIconWrapperStyle}>
              <Icons.CakeVariantOutline size={22} color={Theme.ProfileInfoIconBirthday} />
            </div>
            <div>
              <div style={labelStyle}>Date of Birth</div>
              <div style={valueStyle}>{formatDate(displayedUser.birthday)}</div>
            </div>
          </div>
        )}

        {/* 8. Member since (Для своего профиля: отступ снизу 20px) */}
        {isOwnProfile && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, margin: '0 0 20px 0', fontSize: 12, color: Theme.ProfileMetadataLabel }}>
            <Icons.CalendarBlankOutline size={14} color={Theme.ProfileMetadataLabel} />
            <span>Member since </span>
            <span style={{ color: Theme.ProfileMetadataValue, fontWeight: 600 }}>{formatDate(displayedUser.registrationDate)}</span>
          </div>
        )}

        {/* ПУНКТЫ СПИСКА ДЛЯ ЧУЖОГО ПРОФИЛЯ */}
        {!isOwnProfile && !isGroupProfile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ height: 1, backgroundColor: Theme.ProfileLeftPanelBorder, margin: '10px 0' }} />
            <button onClick={handleOpenStoriesMenu} style={menuListBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.PlayCircleOutline size={20} color={Theme.OtherProfileSharedMediaIcon} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>Stories</span>
              </div>
              <Icons.ChevronRight size={18} color={Theme.ProfileSectionLabel} />
            </button>
            <button onClick={() => loadSharedMedia('Pinned')} style={menuListBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.PinOutline size={20} color={Theme.OtherProfileSharedMediaIcon} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>Pinned Messages</span>
              </div>
              <Icons.ChevronRight size={18} color={Theme.ProfileSectionLabel} />
            </button>
            <button onClick={() => loadSharedMedia('Photos')} style={menuListBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.ImageOutline size={20} color={Theme.OtherProfileSharedMediaIcon} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>Photos</span>
              </div>
              <Icons.ChevronRight size={18} color={Theme.ProfileSectionLabel} />
            </button>
            <button onClick={() => loadSharedMedia('Videos')} style={menuListBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.VideoOutline size={20} color={Theme.OtherProfileSharedMediaIcon} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>Videos</span>
              </div>
              <Icons.ChevronRight size={18} color={Theme.ProfileSectionLabel} />
            </button>
            <button onClick={() => loadSharedMedia('GIFs')} style={menuListBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.FileGifBox size={20} color={Theme.OtherProfileSharedMediaIcon} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>GIFs</span>
              </div>
              <Icons.ChevronRight size={18} color={Theme.ProfileSectionLabel} />
            </button>
            <button onClick={() => loadSharedMedia('Audios')} style={menuListBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.MusicNoteOutline size={20} color={Theme.OtherProfileSharedMediaIcon} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>Audio files</span>
              </div>
              <Icons.ChevronRight size={18} color={Theme.ProfileSectionLabel} />
            </button>
            <button onClick={() => loadSharedMedia('Voice')} style={menuListBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.MicrophoneOutline size={20} color={Theme.OtherProfileSharedMediaIcon} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>Voice messages</span>
              </div>
              <Icons.ChevronRight size={18} color={Theme.ProfileSectionLabel} />
            </button>
            <button onClick={() => loadSharedMedia('Documents')} style={menuListBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.FileDocumentOutline size={20} color={Theme.OtherProfileSharedMediaIcon} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>Documents</span>
              </div>
              <Icons.ChevronRight size={18} color={Theme.ProfileSectionLabel} />
            </button>
            <button onClick={() => loadSharedMedia('Links')} style={menuListBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.LinkVariant size={20} color={Theme.OtherProfileSharedMediaIcon} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>Shared Links</span>
              </div>
              <Icons.ChevronRight size={18} color={Theme.ProfileSectionLabel} />
            </button>
            <button onClick={() => onToggleBlockUser(displayedUser.id)} style={menuListBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.BlockHelper size={20} color={Theme.ProfileDestructiveAction} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.ProfileDestructiveAction }}>
                  {isBlockedByMe ? 'Unblock User' : 'Block User'}
                </span>
              </div>
            </button>
          </div>
        )}

        {/* ПУНКТЫ УПРАВЛЕНИЯ ГРУППОЙ */}
        {isGroupProfile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ height: 1, backgroundColor: Theme.ProfileLeftPanelBorder, margin: '10px 0' }} />
            <button onClick={() => handleShowMembers('members')} style={menuListBtnStyle}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>Members ({membersCount})</span>
              <Icons.ChevronRight size={18} color={Theme.ProfileSectionLabel} />
            </button>
            <button onClick={() => handleShowMembers('admins')} style={menuListBtnStyle}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>Administrators ({adminsCount})</span>
              <Icons.ChevronRight size={18} color={Theme.ProfileSectionLabel} />
            </button>
            {(groupDetails?.isAdmin || groupDetails?.isOwner) && (
              <button onClick={() => handleShowMembers('blacklist')} style={menuListBtnStyle}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>Blacklist ({blackListCount})</span>
                <Icons.ChevronRight size={18} color={Theme.ProfileSectionLabel} />
              </button>
            )}
            {(groupDetails?.isAdmin || groupDetails?.isOwner) && (
              <button
                onClick={() => expandRightPanel('editGroup')}
                style={{ ...menuListBtnStyle, color: Theme.AppAccent }}
              >
                <span style={{ fontSize: 13.5, fontWeight: 'bold' }}>Manage Group</span>
                <Icons.ChevronRight size={18} color={Theme.AppAccent} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// 1:1 СТИЛИ WPF
// =========================================================================

const infoRowGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '22px 1fr',
  gap: 15,
  marginBottom: 20,
  alignItems: 'center', // 1:1 с WPF VerticalAlignment="Center" (иконка центрируется ровно между лейблом и значением)
};

const infoIconWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 'bold',
  color: Theme.ProfileSectionLabel,
  marginBottom: 4,
};

const valueStyle: React.CSSProperties = {
  color: Theme.MainWindowText,
  fontSize: 14,
  fontWeight: 500,
};

const notSetStyle: React.CSSProperties = {
  color: Theme.ProfileSectionLabel,
};

const actionSquareBtnStyle: React.CSSProperties = {
  height: 60,
  borderRadius: 8,
  border: `1px solid ${Theme.ProfileActionButtonBorder}`,
  backgroundColor: Theme.ProfileActionButtonBg,
  color: Theme.ProfileActionButtonText,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.15s ease-out',
};

const menuListBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: 'transparent',
  border: 'none',
  borderRadius: 8,
  color: Theme.MainWindowText,
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  boxSizing: 'border-box',
  transition: 'background-color 0.15s',
};