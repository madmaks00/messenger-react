import { mdiAccountMultipleOutline, mdiShieldAccountOutline, mdiAccountCancelOutline, mdiLockOutline } from '@mdi/js';
import { normalizeCallAvatar } from '../../utils/callAvatar';
import React, { useState, useRef, useEffect } from 'react';
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
    selectedSharedMediaType,
    groupMembersPanelTitle,
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [hoveredCopyKey, setHoveredCopyKey] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [displayedUser?.id]);

  const rawAvatar = isGroupProfile
    ? (groupDetails?.avatar || displayedUser.avatar || displayedUser.avatarPath)
    : (displayedUser.avatar || displayedUser.avatarPath);
  const avatarSrc = normalizeCallAvatar(rawAvatar);
  useEffect(() => setAvatarLoadError(false), [displayedUser.id, avatarSrc]);
  const inviteIsActive = Boolean(groupDetails?.groupLink && groupDetails?.isLinkActive && (!groupDetails.inviteLinkExpiration || new Date(groupDetails.inviteLinkExpiration).getTime() > Date.now()));
  const inviteMinutes = groupDetails?.inviteLinkExpiration ? Math.max(0, Math.floor((new Date(groupDetails.inviteLinkExpiration).getTime() - Date.now()) / 60000)) : null;
  const hasAvatar = Boolean(!avatarLoadError && avatarSrc);

  const profileInfoRowStyle = isGroupProfile ? { ...infoRowGridStyle, marginLeft: 25, marginRight: 25 } : infoRowGridStyle;
  const isStoriesActive = activeRightContainer === 'stories';
  const isSharedTabActive = (type: string) =>
    activeRightContainer === 'sharedMedia' && selectedSharedMediaType === type;
  const isMembersTabActive = (titleKeyword: string) =>
    activeRightContainer === 'members' &&
    groupMembersPanelTitle.toLowerCase().includes(titleKeyword.toLowerCase());
  const isEditGroupActive = activeRightContainer === 'editGroup';

  // 🟢 Рендер копируемого текста с симметричным балансиром для 100% центровки (1:1 TelegramCopyTextButtonStyle)
  const renderCopyButton = (
    text: string,
    key: string,
    label: string,
    isAccent: boolean = false,
    isCentered: boolean = false
  ) => {
    const isCopied = copiedKey === key;
    const isHovered = hoveredCopyKey === key;

    // 🟢 Точный цвет юзернейма из C# DefaultDark.xaml (TgAccent / OtherProfileInfoIconAtBrush = #00AFF4)
    const textColor = isAccent ? 'var(--link-colour, #00AFF4)' : Theme.MainWindowText;

    return (
      <div
        onClick={() => copyToClipboard(text, key)}
        onMouseEnter={() => setHoveredCopyKey(key)}
        onMouseLeave={() => setHoveredCopyKey(null)}
        title={`Click to copy ${label}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: isCentered ? 'center' : 'flex-start',
          cursor: 'pointer',
          color: textColor,
          fontSize: 14,
          fontWeight: 500,
          textDecoration: isHovered ? 'underline' : 'none',
          userSelect: 'none',
        }}
      >
        {/* 🟢 Левый балансир шириной 24px (1:1 LeftBalanceCol из WPF) для математической центровки текста */}
        {isCentered && (
          <div style={{ width: 24, height: 20, flexShrink: 0 }} aria-hidden="true" />
        )}

        <span>{text}</span>

        {/* Правый контейнер иконки (24px) */}
        <div
          style={{
            width: 24,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginLeft: 4,
          }}
        >
          {isCopied ? (
            <Icons.CheckBold size={14} color="var(--link-colour, #00AFF4)" />
          ) : (
            <div style={{ opacity: isHovered ? 1 : 0, transition: 'opacity 0.15s ease' }}>
              <Icons.ContentCopy size={13} color={Theme.ProfileSectionLabel} />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="profile-left-content"
      style={{
        width: '100%',
        minWidth: 0,
        height: '100%',
        minHeight: 0,
        backgroundColor: Theme.ProfileLeftPanelBackground,
        borderRight: isExpanded ? `1px solid ${Theme.ProfileLeftPanelBorder}` : 'none',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
        <button className="profile-left-close"
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

      {/* 1. СТАТИЧНЫЙ ВЕРХ */}
      <div style={{ padding: '20px 20px 15px 20px', textAlign: 'center', flexShrink: 0 }}>
        {/* Аватар 110x110 */}
        <div
          style={{
            width: 110,
            height: 110,
            borderRadius: 55,
            margin: '0 auto 12px',
            backgroundColor: getAvatarColor(displayedUser.id),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <span style={{ fontSize: 42, fontWeight: 'bold', color: '#FFFFFF', userSelect: 'none' }}>
            {getFirstLetter(isGroupProfile ? (groupDetails?.name || displayedUser.nickName) : displayedUser.nickName)}
          </span>

          {hasAvatar && (
            <img
              src={avatarSrc || undefined}
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

        {/* 🟢 Юзернейм (@username): строго по центру с левым балансиром и цветом #00AFF4 */}
        {!isGroupProfile && displayedUser.username && (
          <div style={{ marginTop: 2, marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            {renderCopyButton(`@${displayedUser.username}`, 'username', 'username', true, true)}
          </div>
        )}

        {/* ВЕРХНИЕ КНОПКИ ДЕЙСТВИЯ (ЧУЖОЙ ПРОФИЛЬ: CHAT, MUTE, CALL) */}
        {!isOwnProfile && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 10 }}>
            {/* 1. Chat */}
            <ActionSquareButton onClick={() => onStartChat(displayedUser.id)} title="Chat">
              <Icons.MessageTextOutline size={22} color={Theme.ProfileActionButtonText} style={{ marginBottom: 4 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: Theme.ProfileActionButtonText }}>Chat</span>
            </ActionSquareButton>

            {/* 2. Mute / Unmute */}
            <ActionSquareButton onClick={() => onToggleMute(displayedUser.id)} title={isObservedUserMuted ? 'Unmute' : 'Mute'}>
              {isObservedUserMuted ? (
                <Icons.BellOffOutline size={22} color={Theme.ProfileActionButtonText} style={{ marginBottom: 4 }} />
              ) : (
                <Icons.BellOutline size={22} color={Theme.ProfileActionButtonText} style={{ marginBottom: 4 }} />
              )}
              <span style={{ fontSize: 11, fontWeight: 600, color: Theme.ProfileActionButtonText }}>
                {isObservedUserMuted ? 'Unmute' : 'Mute'}
              </span>
            </ActionSquareButton>

            {/* 3. Call: 1:1 с WPF (всегда активно, проверяет блокировку при нажатии) */}
            <ActionSquareButton
              onClick={() => {
                if (!isGroupProfile && (isBlockedByMe || isBlockedByThem)) return;
                onCallUser(displayedUser);
              }}
              title={isBlockedByMe || isBlockedByThem ? 'User is blocked' : 'Call'}
            >
              <Icons.PhoneOutline size={22} color={Theme.ProfileActionButtonText} style={{ marginBottom: 4 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: Theme.ProfileActionButtonText }}>Call</span>
            </ActionSquareButton>
          </div>
        )}

        {/* ВЕРХНИЕ КНОПКИ ДЕЙСТВИЯ (СВОЙ ПРОФИЛЬ) */}
        {isOwnProfile && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 10 }}>
            <ActionSquareButton
              onClick={() => expandRightPanel('stories')}
              isActive={activeRightContainer === 'stories'}
            >
              <Icons.PlayCircleOutline size={22} color={Theme.ProfileActionButtonText} style={{ marginBottom: 4 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: Theme.ProfileActionButtonText }}>Stories</span>
            </ActionSquareButton>
            <ActionSquareButton
              onClick={() => expandRightPanel('editProfile')}
              isActive={activeRightContainer === 'editProfile'}
            >
              <Icons.PencilOutline size={22} color={Theme.ProfileActionButtonText} style={{ marginBottom: 4 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: Theme.ProfileActionButtonText }}>Edit Info</span>
            </ActionSquareButton>
            <ActionSquareButton
              onClick={() => {
                setCurrentSettingsSubPanel('main');
                expandRightPanel('settings');
              }}
              isActive={activeRightContainer === 'settings'}
            >
              <Icons.CogOutline size={22} color={Theme.ProfileActionButtonText} style={{ marginBottom: 4 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: Theme.ProfileActionButtonText }}>Settings</span>
            </ActionSquareButton>
          </div>
        )}
      </div>

      <div style={{ height: 1, backgroundColor: Theme.ProfileLeftPanelBorder, margin: '0 20px', flexShrink: 0 }} />

      {/* 2. СКРОЛЛИРУЕМАЯ ИНФОРМАЦИЯ */}
      <div
        ref={scrollRef}
        className="wpf-scroll-viewer"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: isGroupProfile ? '15px 0' : '15px 20px 15px 25px',
        }}
      >
        {/* Full name */}
        {!isGroupProfile && (isOwnProfile || displayedUser.firstName || displayedUser.lastName) && (
          <div style={profileInfoRowStyle}>
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

        {/* About me / Description */}
        <div style={profileInfoRowStyle}>
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

        {/* Group Link & Type */}
        {isGroupProfile && (
          <div style={profileInfoRowStyle}>
            <div style={infoIconWrapperStyle}>
              {groupDetails?.isPublic ? <Icons.LinkVariant size={22} color={Theme.AppAccent} /> : <ProfileIcon path={mdiLockOutline} size="22px" color={Theme.AppAccent} />}
            </div>
            <div>
              {groupDetails?.isPublic ? (
                <>
                  <div style={labelStyle}>Link</div>
                  {renderCopyButton(groupDetails.groupLink || `@${groupDetails.username || 'group'}`, 'groupLink', 'link', true, false)}
                </>
              ) : groupDetails?.isAdmin || groupDetails?.isOwner ? (
                <>
                  <div style={labelStyle}>Invite Link (Private)</div>
                  {inviteIsActive ? (
                    <div>
                      {renderCopyButton(groupDetails.groupLink, 'inviteLink', 'invite link', true, false)}
                      <div style={{ fontSize: 12, color: Theme.ProfileSectionLabel, marginTop: 2 }}>
                        {inviteMinutes === null ? 'Active invite link' : `Expires in ${Math.floor(inviteMinutes / 60)}h ${inviteMinutes % 60}m`}
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

        {/* Phone Number */}
        {!isGroupProfile && (isOwnProfile || displayedUser.phone) && (
          <div style={profileInfoRowStyle}>
            <div style={infoIconWrapperStyle}>
              <Icons.PhoneSectionOutline size={22} color={Theme.ProfileInfoIconPhone} />
            </div>
            <div>
              <div style={labelStyle}>Phone Number</div>
              {displayedUser.phone && displayedUser.phone !== 'Not set' ? (
                renderCopyButton(formatPhoneNumber(displayedUser.phone), 'phone', 'Phone', false, false)
              ) : (
                <span style={notSetStyle}>Not set</span>
              )}
            </div>
          </div>
        )}

        {/* Email Address */}
        {!isGroupProfile && (isOwnProfile || displayedUser.email) && (
          <div style={profileInfoRowStyle}>
            <div style={infoIconWrapperStyle}>
              <Icons.EmailOutline size={22} color={Theme.ProfileInfoIconEmail} />
            </div>
            <div>
              <div style={labelStyle}>Email Address</div>
              {displayedUser.email && displayedUser.email !== 'Not set' ? (
                renderCopyButton(displayedUser.email, 'email', 'Email', false, false)
              ) : (
                <span style={notSetStyle}>Not set</span>
              )}
            </div>
          </div>
        )}

        {/* Gender */}
        {!isGroupProfile && (isOwnProfile || (displayedUser.gender !== null && displayedUser.gender !== undefined)) && (
          <div style={profileInfoRowStyle}>
            <div style={infoIconWrapperStyle}>
              <Icons.GenderMaleFemale size={22} color={Theme.ProfileInfoIconGender} />
            </div>
            <div>
              <div style={labelStyle}>Gender</div>
              <div style={valueStyle}>
                {displayedUser.gender === 0 || (displayedUser.gender as any) === 'Male'
                  ? 'Male'
                  : displayedUser.gender === 1 || (displayedUser.gender as any) === 'Female'
                    ? 'Female'
                    : <span style={notSetStyle}>Not set</span>}
              </div>
            </div>
          </div>
        )}

        {/* Date of Birth */}
        {!isGroupProfile && (isOwnProfile || displayedUser.birthday) && (
          <div style={profileInfoRowStyle}>
            <div style={infoIconWrapperStyle}>
              <Icons.CakeVariantOutline size={22} color={Theme.ProfileInfoIconBirthday} />
            </div>
            <div>
              <div style={labelStyle}>Date of Birth</div>
              <div style={valueStyle}>{formatDate(displayedUser.birthday)}</div>
            </div>
          </div>
        )}

        {/* Member since */}
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

            <MenuTabButton
              onClick={handleOpenStoriesMenu}
              isActive={isStoriesActive}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.PlayCircleOutline
                  size={20}
                  color={Theme.OtherProfileSharedMediaIcon}
                />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>
                  Stories
                </span>
              </div>
              <Icons.ChevronRight
                size={18}
                color={Theme.ProfileSectionLabel}
              />
            </MenuTabButton>

            <MenuTabButton
              onClick={() => loadSharedMedia('Pinned')}
              isActive={isSharedTabActive('Pinned')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.PinOutline
                  size={20}
                  color={Theme.OtherProfileSharedMediaIcon}
                />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>
                  Pinned Messages
                </span>
              </div>
              <Icons.ChevronRight
                size={18}
                color={Theme.ProfileSectionLabel}
              />
            </MenuTabButton>

            <MenuTabButton
              onClick={() => loadSharedMedia('Photos')}
              isActive={isSharedTabActive('Photos')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.ImageOutline
                  size={20}
                  color={Theme.OtherProfileSharedMediaIcon}
                />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>
                  Photos
                </span>
              </div>
              <Icons.ChevronRight
                size={18}
                color={Theme.ProfileSectionLabel}
              />
            </MenuTabButton>

            <MenuTabButton
              onClick={() => loadSharedMedia('Videos')}
              isActive={isSharedTabActive('Videos')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.VideoOutline
                  size={20}
                  color={Theme.OtherProfileSharedMediaIcon}
                />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>
                  Videos
                </span>
              </div>
              <Icons.ChevronRight
                size={18}
                color={Theme.ProfileSectionLabel}
              />
            </MenuTabButton>

            <MenuTabButton
              onClick={() => loadSharedMedia('GIFs')}
              isActive={isSharedTabActive('GIFs')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.FileGifBox
                  size={20}
                  color={Theme.OtherProfileSharedMediaIcon}
                />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>
                  GIFs
                </span>
              </div>
              <Icons.ChevronRight
                size={18}
                color={Theme.ProfileSectionLabel}
              />
            </MenuTabButton>

            <MenuTabButton
              onClick={() => loadSharedMedia('Audios')}
              isActive={isSharedTabActive('Audios')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.MusicNoteOutline
                  size={20}
                  color={Theme.OtherProfileSharedMediaIcon}
                />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>
                  Audio files
                </span>
              </div>
              <Icons.ChevronRight
                size={18}
                color={Theme.ProfileSectionLabel}
              />
            </MenuTabButton>

            <MenuTabButton
              onClick={() => loadSharedMedia('Voice')}
              isActive={isSharedTabActive('Voice')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.MicrophoneOutline
                  size={20}
                  color={Theme.OtherProfileSharedMediaIcon}
                />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>
                  Voice messages
                </span>
              </div>
              <Icons.ChevronRight
                size={18}
                color={Theme.ProfileSectionLabel}
              />
            </MenuTabButton>

            <MenuTabButton
              onClick={() => loadSharedMedia('Documents')}
              isActive={isSharedTabActive('Documents')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.FileDocumentOutline
                  size={20}
                  color={Theme.OtherProfileSharedMediaIcon}
                />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>
                  Documents
                </span>
              </div>
              <Icons.ChevronRight
                size={18}
                color={Theme.ProfileSectionLabel}
              />
            </MenuTabButton>

            <MenuTabButton
              onClick={() => loadSharedMedia('Links')}
              isActive={isSharedTabActive('Links')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.LinkVariant
                  size={20}
                  color={Theme.OtherProfileSharedMediaIcon}
                />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.MainWindowText }}>
                  Shared Links
                </span>
              </div>
              <Icons.ChevronRight
                size={18}
                color={Theme.ProfileSectionLabel}
              />
            </MenuTabButton>

            <MenuTabButton onClick={() => onToggleBlockUser(displayedUser.id)} hoverBg="rgba(255, 59, 48, 0.12)">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icons.BlockHelper size={20} color={Theme.ProfileDestructiveAction} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: Theme.ProfileDestructiveAction }}>
                  {isBlockedByMe ? 'Unblock User' : 'Block User'}
                </span>
              </div>
            </MenuTabButton>
          </div>
        )}

        {isGroupProfile && <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginInline: 10 }}>
          <div role="separator" data-profile-divider="info-media" style={{ height: 1, backgroundColor: Theme.ProfileLeftPanelBorder, margin: '6px 10px 14px' }} />
          {([
            ['Stories', 'Stories', Icons.PlayCircleOutline],
            ['Pinned', 'Pinned Messages', Icons.PinOutline], ['Photos', 'Photos', Icons.ImageOutline],
            ['Videos', 'Videos', Icons.VideoOutline], ['GIFs', 'GIFs', Icons.FileGifBox],
            ['Audios', 'Audio files', Icons.MusicNoteOutline], ['Voice', 'Voice messages', Icons.MicrophoneOutline],
            ['Documents', 'Documents', Icons.FileDocumentOutline], ['Links', 'Shared Links', Icons.LinkVariant],
          ] as const).map(([type, label, MediaIcon]) => <MenuTabButton key={type} style={{ padding: '10px 8px', margin: '2px 0' }} onClick={() => type === 'Stories' ? handleOpenStoriesMenu() : loadSharedMedia(type)} isActive={type === 'Stories' ? isStoriesActive : isSharedTabActive(type)}>
            <div style={groupMenuContentStyle}><MediaIcon size={20} color={Theme.OtherProfileSharedMediaIcon} /><span>{label}</span></div>
            <Icons.ChevronRight size={18} color={Theme.ProfileSectionLabel} />
          </MenuTabButton>)}
        </div>}

        {/* Group menu uses the same icons, spacing and role visibility as WPF. */}
        {isGroupProfile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginInline: 10 }}>
            <div style={{ height: 1, backgroundColor: Theme.ProfileLeftPanelBorder, margin: '5px 10px 15px' }} />
            <MenuTabButton style={{ padding: '10px 8px', margin: '2px 0' }} onClick={() => handleShowMembers('members')} isActive={isMembersTabActive('members')}>
              <div style={groupMenuContentStyle}><ProfileIcon path={mdiAccountMultipleOutline} size="20px" color={Theme.OtherProfileSharedMediaIcon} />
                <span>Members <span style={{ color: Theme.ProfileSectionLabel }}>({membersCount})</span></span></div>
              <Icons.ChevronRight size={18} color={Theme.ProfileSectionLabel} />
            </MenuTabButton>
            <MenuTabButton style={{ padding: '10px 8px', margin: '2px 0' }} onClick={() => handleShowMembers('admins')} isActive={isMembersTabActive('administrators')}>
              <div style={groupMenuContentStyle}><ProfileIcon path={mdiShieldAccountOutline} size="20px" color={Theme.OtherProfileSharedMediaIcon} />
                <span>Administrators <span style={{ color: Theme.ProfileSectionLabel }}>({adminsCount})</span></span></div>
              <Icons.ChevronRight size={18} color={Theme.ProfileSectionLabel} />
            </MenuTabButton>
            {(groupDetails?.isAdmin || groupDetails?.isOwner) && <>
              <MenuTabButton style={{ padding: '10px 8px', margin: '2px 0' }} onClick={() => handleShowMembers('blacklist')} isActive={isMembersTabActive('blacklist')}>
                <div style={groupMenuContentStyle}><ProfileIcon path={mdiAccountCancelOutline} size="20px" color={Theme.MainWindowText} /><span>Blacklist ({blackListCount})</span></div>
                <Icons.ChevronRight size={18} color={Theme.ProfileSectionLabel} />
              </MenuTabButton>
              <MenuTabButton style={{ padding: '10px 8px', margin: '2px 0' }} onClick={() => expandRightPanel('editGroup')} isActive={isEditGroupActive} hoverBg="var(--surface-accent, rgba(30, 155, 235, 0.12))">
                <div style={groupMenuContentStyle}><Icons.CogOutline size={20} color={Theme.AppAccent} /><span style={{ fontWeight: 'bold' }}>Manage Group</span></div>
                <Icons.ChevronRight size={18} color={Theme.MainWindowText} />
              </MenuTabButton>
            </>}
          </div>
        )}
      </div>
    </div>
  );
};

interface MenuTabButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  isActive?: boolean;
  style?: React.CSSProperties;
  hoverBg?: string;
}

const MenuTabButton: React.FC<MenuTabButtonProps> = ({
  onClick,
  children,
  isActive = false,
  style,
  hoverBg = 'var(--surface-hover, rgba(255, 255, 255, 0.08))',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const currentBg = isActive
    ? isHovered
      ? 'var(--surface-hover, rgba(255, 255, 255, 0.18))'
      : 'var(--surface-hover, rgba(255, 255, 255, 0.14))'
    : isHovered
    ? hoverBg
    : 'transparent';

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        padding: '8px 10px',
        backgroundColor: currentBg,
        border: 'none',
        borderRadius: 8,
        color: Theme.MainWindowText,
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxSizing: 'border-box',
        transition: 'background-color 0.2s ease',
        ...style,
      }}
    >
      {children}
    </button>
  );
};

interface ActionSquareButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  isActive?: boolean;
  title?: string;
}

const ActionSquareButton: React.FC<ActionSquareButtonProps> = ({
  onClick,
  children,
  disabled = false,
  isActive = false,
  title,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const bgColor = isActive
    ? Theme.ProfileActionButtonBorder
    : isHovered && !disabled
      ? Theme.ProfileActionButtonBorder
      : Theme.ProfileActionButtonBg;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        height: 60,
        borderRadius: 8,
        border: `1px solid ${Theme.ProfileActionButtonBorder}`,
        backgroundColor: bgColor,
        color: Theme.ProfileActionButtonText,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
      }}
    >
      {children}
    </button>
  );
};

const infoRowGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '22px 1fr',
  gap: 15,
  marginBottom: 20,
  alignItems: 'center',
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
const groupMenuContentStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, fontSize: 13.5, fontWeight: 600 };

function ProfileIcon({ path, size, color }: { path: string; size: string; color: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}><path d={path} fill={color} /></svg>;
}
