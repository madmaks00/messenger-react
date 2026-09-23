import { useState, useEffect, useRef, useCallback } from 'react';
import { AttachmentType, PrivacyVisibility } from '../../types/enums';
import {
  DeviceSessionDto,
  PrivacySettingsDto,
  MemberPermissionsDto,
  GroupUpdateDto,
} from '../../types/dtos';
import {
  IUser,
  IStory,
  IAttachment,
  IMessage,
  ISharedMediaGroup,
  ISharedMessageGroup,
  IGroupMember,
} from '../../types/models';
import {
  groupAttachmentsByMonth,
  groupMessagesByMonth,
  matchesSharedCategory,
  isGifAttachment,
  UserValidator,
} from './profileView.utils';
import { userService } from '../../services/user.service';
import { groupService } from '../../services/group.service';
import { userSession } from '../../services/userSession';
import { SecurityService } from '../../services/security.service';

export interface ProfileServices {
  getUserProfile: (userId: number) => Promise<IUser | null>;
  getBlockStatus: (userId: number) => Promise<{ blockedByMe: boolean; blockedByThem: boolean } | null>;
  toggleBlockUser: (userId: number) => Promise<boolean | null>;
  updateProfile: (user: IUser) => Promise<IUser | null>;
  verifyPassword: (password: string) => Promise<boolean>;
  changePassword: (newPassword: string) => Promise<boolean>;
  getPrivacySettings: () => Promise<PrivacySettingsDto | null>;
  savePrivacySettings: (dto: PrivacySettingsDto) => Promise<boolean>;
  getDevices: () => Promise<DeviceSessionDto[] | null>;
  terminateDeviceSession: (deviceId: number) => Promise<boolean>;
  terminateOtherSessions: () => Promise<boolean>;
  getBlockedUsers: () => Promise<IUser[] | null>;
  verifyPasscode: (code: string) => boolean;
  savePasscode: (code: string | null) => void;
  isPasscodeSet: () => boolean;
  getCameras: () => string[];
  getMicrophones: () => string[];
  getSpeakers: () => string[];
  getUserStories: (userId: number) => Promise<IStory[] | null>;
  createNewStory: (file: File) => Promise<void>;
  editStory: (storyId: number) => void;
  deleteStory: (storyId: number) => Promise<boolean>;
  openStoryViewer: (story: IStory, allStories: IStory[]) => void;
  getSharedMediaMessages: (user1: number, user2: number) => Promise<IMessage[]>;
  getSharedPinnedMessages: (user1: number, user2: number) => Promise<IMessage[]>;
  getSharedLinkMessages: (user1: number, user2: number) => Promise<IMessage[]>;
  onStartChat: (userId: number) => void;
  onCallUser: (user: IUser) => void;
  onToggleMute: (userId: number) => void;
  onJumpToMessage: (messageId: number, targetUserId: number) => void;
  onForwardMessages: (messages: IMessage[]) => void;
  onDeleteMessage: (message: IMessage) => void;
  onOpenFile: (attachment: IAttachment) => void;
  onPlayAudio: (attachment: IAttachment) => void;
  onOpenPhotoGallery: (attachments: IAttachment[], index: number) => void;
  getGroupDetails: (groupId: number) => Promise<any>;
  getGroupMembers: (groupId: number) => Promise<IGroupMember[] | null>;
  getGroupAdministrators: (groupId: number) => Promise<IGroupMember[] | null>;
  getGroupBlacklist: (groupId: number) => Promise<IGroupMember[] | null>;
  generateInviteLink: (groupId: number) => Promise<{ link: string; expiration: string } | null>;
  revokeInviteLink: (groupId: number) => Promise<boolean>;
  updateGroupSettings: (groupId: number, payload: GroupUpdateDto) => Promise<boolean>;
  leaveGroup: (groupId: number) => Promise<boolean>;
  getMemberPermissions: (groupId: number, memberId: number) => Promise<MemberPermissionsDto | null>;
  saveMemberPermissions: (groupId: number, memberId: number, permissions: MemberPermissionsDto) => Promise<boolean>;
  kickMember: (groupId: number, memberId: number) => Promise<boolean>;
  banMember: (groupId: number, memberId: number) => Promise<boolean>;
  unbanMember: (groupId: number, memberId: number) => Promise<boolean>;
}

export type RightContainerType = 'stories' | 'sharedMedia' | 'editProfile' | 'settings' | 'members' | 'editGroup' | null;
export type SettingsSubPanelType = 'main' | 'privacy' | 'changePassword' | 'devices' | 'speakersCamera' | 'language' | 'blockedUsers' | 'passcodeSetup';

export function useProfileView(
  isOpen: boolean,
  user: IUser,
  isOwnProfile: boolean,
  isGroupProfile: boolean,
  currentUserId: number,
  onClose: () => void,
  customServices: Partial<ProfileServices> = {},
  onStartChatProp?: (userId: number) => void,
  onCallUserProp?: (user: any) => void
) {
  const effectiveUserId = currentUserId || (userSession as any)?.UserId || (userSession as any)?.userId || user?.id || 0;

  const services: ProfileServices = {
    getUserProfile: customServices.getUserProfile || ((id) => (userService as any)?.getUserProfileAsync?.(id) || Promise.resolve(null)),
    getBlockStatus: customServices.getBlockStatus || ((id) => (userService as any)?.GetBlockStatusAsync?.(id) || (userService as any)?.getBlockStatusAsync?.(id) || Promise.resolve(null)),
    toggleBlockUser: customServices.toggleBlockUser || ((id) => (userService as any)?.toggleBlockUserAsync?.(id) || Promise.resolve(null)),
    updateProfile: customServices.updateProfile || ((u) => (userService as any)?.updateProfileAsync?.(u) || Promise.resolve(null)),
    verifyPassword: customServices.verifyPassword || ((p) => (userService as any)?.verifyPasswordAsync?.(p) || Promise.resolve(false)),
    changePassword: customServices.changePassword || ((p) => (userService as any)?.changePasswordAsync?.(p) || Promise.resolve(false)),
    getPrivacySettings: customServices.getPrivacySettings || (() => (userService as any)?.getPrivacySettingsAsync?.() || Promise.resolve(null)),
    savePrivacySettings: customServices.savePrivacySettings || ((s) => (userService as any)?.savePrivacySettingsAsync?.(s) || Promise.resolve(true)),
    getDevices: customServices.getDevices || (() => (userService as any)?.getDevicesAsync?.() || Promise.resolve([])),
    terminateDeviceSession: customServices.terminateDeviceSession || ((id) => (userService as any)?.terminateDeviceSessionAsync?.(id) || Promise.resolve(true)),
    terminateOtherSessions: customServices.terminateOtherSessions || (() => (userService as any)?.terminateOtherSessionsAsync?.() || Promise.resolve(true)),
    getBlockedUsers: customServices.getBlockedUsers || (() => (userService as any)?.getBlacklistAsync?.() || Promise.resolve([])),
    verifyPasscode: customServices.verifyPasscode || ((code) => SecurityService.verifyPasscode(code)),
    savePasscode: customServices.savePasscode || ((code) => SecurityService.savePasscode(code)),
    isPasscodeSet: customServices.isPasscodeSet || (() => SecurityService.isPasscodeSet()),
    getCameras: customServices.getCameras || (() => ['Default Camera', 'Front HD WebCam']),
    getMicrophones: customServices.getMicrophones || (() => ['Default Microphone', 'Headset Mic']),
    getSpeakers: customServices.getSpeakers || (() => ['Default Speakers', 'Headphones']),
    getUserStories: customServices.getUserStories || (() => Promise.resolve([])),
    createNewStory: customServices.createNewStory || (async () => {}),
    editStory: customServices.editStory || (() => {}),
    deleteStory: customServices.deleteStory || (async () => true),
    openStoryViewer: customServices.openStoryViewer || (() => {}),
    getSharedMediaMessages: customServices.getSharedMediaMessages || (() => Promise.resolve([])),
    getSharedPinnedMessages: customServices.getSharedPinnedMessages || (() => Promise.resolve([])),
    getSharedLinkMessages: customServices.getSharedLinkMessages || (() => Promise.resolve([])),
    onStartChat: onStartChatProp || customServices.onStartChat || (() => {}),
    onCallUser: onCallUserProp || customServices.onCallUser || (() => {}),
    onToggleMute: customServices.onToggleMute || (() => {}),
    onJumpToMessage: customServices.onJumpToMessage || (() => {}),
    onForwardMessages: customServices.onForwardMessages || (() => {}),
    onDeleteMessage: customServices.onDeleteMessage || (() => {}),
    onOpenFile: customServices.onOpenFile || (() => {}),
    onPlayAudio: customServices.onPlayAudio || (() => {}),
    onOpenPhotoGallery: customServices.onOpenPhotoGallery || (() => {}),
    getGroupDetails: customServices.getGroupDetails || ((id) => (groupService as any)?.getGroupDetailsAsync?.(id) || Promise.resolve(null)),
    getGroupMembers: customServices.getGroupMembers || ((id) => (groupService as any)?.getGroupMembersAsync?.(id) || Promise.resolve([])),
    getGroupAdministrators: customServices.getGroupAdministrators || ((id) => (groupService as any)?.getGroupAdministratorsAsync?.(id) || Promise.resolve([])),
    getGroupBlacklist: customServices.getGroupBlacklist || ((id) => (groupService as any)?.getGroupBlacklistAsync?.(id) || Promise.resolve([])),
    generateInviteLink: customServices.generateInviteLink || ((id) => (groupService as any)?.generateInviteLinkAsync?.(id) || Promise.resolve(null)),
    revokeInviteLink: customServices.revokeInviteLink || ((id) => (groupService as any)?.revokeInviteLinkAsync?.(id) || Promise.resolve(true)),
    updateGroupSettings: customServices.updateGroupSettings || ((id, p) => (groupService as any)?.updateGroupSettingsAsync?.(id, p) || Promise.resolve(true)),
    leaveGroup: customServices.leaveGroup || ((id) => (groupService as any)?.leaveGroupAsync?.(id) || Promise.resolve(true)),
    getMemberPermissions: customServices.getMemberPermissions || ((gid, mid) => (groupService as any)?.getMemberPermissionsAsync?.(gid, mid) || Promise.resolve(null)),
    saveMemberPermissions: customServices.saveMemberPermissions || ((gid, mid, p) => (groupService as any)?.saveMemberPermissionsAsync?.(gid, mid, p) || Promise.resolve(true)),
    kickMember: customServices.kickMember || ((gid, mid) => (groupService as any)?.kickMemberAsync?.(gid, mid) || Promise.resolve(true)),
    banMember: customServices.banMember || ((gid, mid) => (groupService as any)?.banMemberAsync?.(gid, mid) || Promise.resolve(true)),
    unbanMember: customServices.unbanMember || ((gid, mid) => (groupService as any)?.unbanMemberAsync?.(gid, mid) || Promise.resolve(true)),
  };

  // 1. Состояние видимости правой колонки (888px при own profile, 365px при чужом)
  const [isExpanded, setIsExpanded] = useState<boolean>(isOwnProfile);
  const [activeRightContainer, setActiveRightContainer] = useState<RightContainerType>(isOwnProfile ? 'stories' : null);

  // 2. Отображаемый пользователь
  const [displayedUser, setDisplayedUser] = useState<IUser>(user);
  const [isObservedUserBlocked, setIsObservedUserBlocked] = useState<boolean>(false);
  const [isBlockedByMe, setIsBlockedByMe] = useState<boolean>(false);
  const [isBlockedByThem, setIsBlockedByThem] = useState<boolean>(false);
  const [isObservedUserMuted, setIsObservedUserMuted] = useState<boolean>(false);

  // 3. Истории
  const [activeStories, setActiveStories] = useState<IStory[]>([]);
  const [isStoriesLoading, setIsStoriesLoading] = useState<boolean>(false);
  const [storiesFilterOpen, setStoriesFilterOpen] = useState<boolean>(false);

  // 4. Редактирование профиля
  const [editUser, setEditUser] = useState<IUser>({ ...user });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // 5. Настройки
  const [currentSettingsSubPanel, setCurrentSettingsSubPanel] = useState<SettingsSubPanelType>('main');
  const [privacySettings, setPrivacySettings] = useState<PrivacySettingsDto>({
    fullNameVisibility: PrivacyVisibility.Everybody,
    genderVisibility: PrivacyVisibility.Everybody,
    descriptionVisibility: PrivacyVisibility.Everybody,
    lastSeenVisibility: PrivacyVisibility.Everybody,
    avatarVisibility: PrivacyVisibility.Everybody,
    emailVisibility: PrivacyVisibility.Everybody,
    phoneVisibility: PrivacyVisibility.Everybody,
    birthdayVisibility: PrivacyVisibility.Everybody,
  });

  const [passcodeButtonText, setPasscodeButtonText] = useState<string>('Setup Code');
  const [passcode1, setPasscode1] = useState<string>('');
  const [passcode2, setPasscode2] = useState<string>('');
  const [blockedUsersList, setBlockedUsersList] = useState<IUser[]>([]);

  // 6. Смена пароля
  const [isChangePasswordStep1, setIsChangePasswordStep1] = useState<boolean>(true);
  const [currentPasswordInput, setCurrentPasswordInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [passwordErrorMessage, setPasswordErrorMessage] = useState<string>('');

  // 7. Устройства и сессии
  const [currentDevice, setCurrentDevice] = useState<DeviceSessionDto | null>(null);
  const [otherDevices, setOtherDevices] = useState<DeviceSessionDto[]>([]);

  // 8. Оборудование
  const [availableCameras, setAvailableCameras] = useState<string[]>([]);
  const [availableMicrophones, setAvailableMicrophones] = useState<string[]>([]);
  const [availableSpeakers, setAvailableSpeakers] = useState<string[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');
  const [speakerVolume, setSpeakerVolume] = useState<number>(80);
  const [micSensitivity, setMicSensitivity] = useState<number>(50);

  // 9. Общие медиафайлы
  const [selectedSharedMediaType, setSelectedSharedMediaType] = useState<string>('Photos');
  const [sharedMediaTitle, setSharedMediaTitle] = useState<string>('Media');
  const [isSharedMediaLoading, setIsSharedMediaLoading] = useState<boolean>(false);
  const [sharedAttachmentGroups, setSharedAttachmentGroups] = useState<ISharedMediaGroup[]>([]);
  const [sharedPinnedGroups, setSharedPinnedGroups] = useState<ISharedMessageGroup[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedCount, setSelectedCount] = useState<number>(0);

  // 10. Группы
  const [groupDetails, setGroupDetails] = useState<any>(null);
  const [groupMembersPanelTitle, setGroupMembersPanelTitle] = useState<string>('Group Members');
  const [activeMembersList, setActiveMembersList] = useState<IGroupMember[]>([]);
  const [membersCount, setMembersCount] = useState<number>(0);
  const [adminsCount, setAdminsCount] = useState<number>(1);
  const [blackListCount, setBlackListCount] = useState<number>(0);

  const [editGroupName, setEditGroupName] = useState<string>('');
  const [editGroupDescription, setEditGroupDescription] = useState<string>('');
  const [editGroupAvatar, setEditGroupAvatar] = useState<string | null>(null);
  const [editGroupIsPublic, setEditGroupIsPublic] = useState<boolean>(false);
  const [editGroupLink, setEditGroupLink] = useState<string>('');
  const [groupCanSendText, setGroupCanSendText] = useState<boolean>(true);
  const [groupCanSendMedia, setGroupCanSendMedia] = useState<boolean>(true);
  const [groupCanPinMessages, setGroupCanPinMessages] = useState<boolean>(true);

  // Модалка прав участника
  const [isMemberPermissionsOpen, setIsMemberPermissionsOpen] = useState<boolean>(false);
  const [editingMember, setEditingMember] = useState<IGroupMember | null>(null);
  const [permIsAdmin, setPermIsAdmin] = useState<boolean>(false);
  const [permCanSendText, setPermCanSendText] = useState<boolean>(true);
  const [permCanSendMedia, setPermCanSendMedia] = useState<boolean>(true);
  const [permCanPinMessages, setPermCanPinMessages] = useState<boolean>(false);

  // 11. Буфер обмена (строго хук #62 useState, хук #63 useRef)
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 12. Контекстное меню
  const [activeContextMenu, setActiveContextMenu] = useState<{
    x: number;
    y: number;
    item: IAttachment | IMessage;
  } | null>(null);

  const copyToClipboard = useCallback((text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => {
      setCopiedKey(null);
    }, 1300);
  }, []);

  const loadOwnProfileData = useCallback(async () => {
    setIsStoriesLoading(true);
    try {
      const stories = await services.getUserStories(effectiveUserId);
      setActiveStories(stories || []);
      const privacy = await services.getPrivacySettings();
      if (privacy) setPrivacySettings(privacy);
      setPasscodeButtonText(services.isPasscodeSet() ? 'Change Code' : 'Setup Code');
    } finally {
      setIsStoriesLoading(false);
    }
  }, [effectiveUserId]);

  const loadOtherUserProfile = useCallback(async (userId: number) => {
    if (!userId) return;
    try {
      const prof = await services.getUserProfile(userId);
      if (prof) setDisplayedUser(prof);
      const blocks = await services.getBlockStatus(userId);
      if (blocks) {
        setIsBlockedByMe(blocks.blockedByMe);
        setIsBlockedByThem(blocks.blockedByThem);
        setIsObservedUserBlocked(blocks.blockedByMe);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadGroupDetails = useCallback(async (groupId: number) => {
    if (!groupId) return;
    try {
      const details = await services.getGroupDetails(groupId);
      if (details) {
        setGroupDetails(details);
        setEditGroupName(details.name || '');
        setEditGroupDescription(details.description || '');
        setEditGroupAvatar(details.avatar || null);
        setEditGroupIsPublic(details.isPublic || false);
        setEditGroupLink(details.groupLink || '');
        setGroupCanSendText(details.canSendText ?? true);
        setGroupCanSendMedia(details.canSendMedia ?? true);
        setGroupCanPinMessages(details.canPinMessages ?? true);
        setMembersCount(details.memberCount || 1);
        setAdminsCount(details.adminCount || 1);
        setBlackListCount(details.blackListCount || 0);
      }

      const members = await services.getGroupMembers(groupId);
      if (members) {
        setMembersCount(members.length);
        setActiveMembersList(members);
      }
      const admins = await services.getGroupAdministrators(groupId);
      if (admins) {
        setAdminsCount(admins.length);
      }
      const bans = await services.getGroupBlacklist(groupId);
      if (bans) {
        setBlackListCount(bans.length);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    setDisplayedUser(user);
    setEditUser({ ...user });
    setIsExpanded(isOwnProfile);

    if (isOwnProfile) {
      setActiveRightContainer('stories');
      loadOwnProfileData();
    } else if (isGroupProfile) {
      setActiveRightContainer(null);
      if (user?.id) loadGroupDetails(user.id);
    } else {
      setActiveRightContainer(null);
      if (user?.id) loadOtherUserProfile(user.id);
    }
  }, [isOpen, user, isOwnProfile, isGroupProfile, loadOwnProfileData, loadOtherUserProfile, loadGroupDetails]);

  const expandRightPanel = (containerName: RightContainerType) => {
    setActiveRightContainer(containerName);
    setIsExpanded(true);
  };

  const collapseRightPanel = () => {
    if (isOwnProfile) {
      onClose();
      return;
    }
    setIsExpanded(false);
    setActiveRightContainer(null);
  };

  const handleOpenStoriesMenu = async () => {
    expandRightPanel('stories');
    setIsStoriesLoading(true);
    try {
      const stories = await services.getUserStories(displayedUser.id);
      setActiveStories(stories || []);
    } finally {
      setIsStoriesLoading(false);
    }
  };

  const loadSharedMedia = async (mediaType: string) => {
    setSelectedSharedMediaType(mediaType);
    const titlesMap: Record<string, string> = {
      Photos: 'Photos',
      Videos: 'Videos',
      GIFs: 'GIFs',
      Audios: 'Audio files',
      Voice: 'Voice messages',
      Documents: 'Documents',
      Links: 'Shared Links',
      Pinned: 'Pinned Messages',
    };
    setSharedMediaTitle(titlesMap[mediaType] || 'Media');
    setIsSharedMediaLoading(true);
    expandRightPanel('sharedMedia');

    try {
      const myName = user.nickName || user.username || 'Me';
      const targetName = displayedUser.nickName || displayedUser.username || 'User';

      if (mediaType === 'Pinned') {
        const msgs = await services.getSharedPinnedMessages(effectiveUserId, displayedUser.id);
        setSharedPinnedGroups(groupMessagesByMonth(msgs, effectiveUserId, myName, targetName));
        setSharedAttachmentGroups([]);
      } else if (mediaType === 'Links') {
        const msgs = await services.getSharedLinkMessages(effectiveUserId, displayedUser.id);
        setSharedPinnedGroups(groupMessagesByMonth(msgs, effectiveUserId, myName, targetName));
        setSharedAttachmentGroups([]);
      } else {
        const messages = await services.getSharedMediaMessages(effectiveUserId, displayedUser.id);
        const attachments: IAttachment[] = [];
        messages.forEach((m) => {
          (m.attachments || []).forEach((a) => {
            const attClone = { ...a, message: m };
            if (matchesSharedCategory(attClone, mediaType)) {
              attachments.push(attClone);
            }
          });
        });
        setSharedAttachmentGroups(groupAttachmentsByMonth(attachments, effectiveUserId, myName, targetName));
        setSharedPinnedGroups([]);
      }
    } finally {
      setIsSharedMediaLoading(false);
    }
  };

  const updateSelectedCount = () => {
    let count = 0;
    sharedAttachmentGroups.forEach((g) => {
      count += g.items.filter((i) => i.isSelected).length;
    });
    sharedPinnedGroups.forEach((g) => {
      count += g.items.filter((i) => i.isSelected).length;
    });
    setSelectedCount(count);
    if (count === 0) setIsSelectionMode(false);
  };

  const toggleItemSelection = (item: IAttachment | IMessage) => {
    item.isSelected = !item.isSelected;
    updateSelectedCount();
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    sharedAttachmentGroups.forEach((g) => g.items.forEach((i) => (i.isSelected = false)));
    sharedPinnedGroups.forEach((g) => g.items.forEach((i) => (i.isSelected = false)));
    setSelectedCount(0);
  };

  const handleSharedItemClick = (item: IAttachment | IMessage) => {
    if (isSelectionMode) {
      toggleItemSelection(item);
      return;
    }

    if ('url' in item) {
      const att = item as IAttachment;
      if (att.type === AttachmentType.Photo || att.type === AttachmentType.Video || isGifAttachment(att)) {
        const allPhotos = sharedAttachmentGroups
          .flatMap((g) => g.items)
          .filter((a) => a.type === AttachmentType.Photo || isGifAttachment(a));
        const idx = Math.max(0, allPhotos.indexOf(att));
        services.onOpenPhotoGallery(allPhotos, idx);
      } else if (att.type === AttachmentType.Audio || att.type === AttachmentType.Voice) {
        services.onPlayAudio(att);
      } else {
        services.onOpenFile(att);
      }
    } else {
      const msg = item as IMessage;
      if (selectedSharedMediaType === 'Links') {
        const urlMatch = msg.text.match(/(https?:\/\/[^\s]+)|(www\.[^\s]+)|(t\.me\/[^\s]+)/i);
        if (urlMatch) {
          let url = urlMatch[0];
          if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
          window.open(url, '_blank');
        }
      } else {
        services.onJumpToMessage(msg.id, displayedUser.id);
      }
    }
  };

  const getSelectedMessagesList = (): IMessage[] => {
    const list: IMessage[] = [];
    sharedAttachmentGroups.forEach((g) => {
      g.items.forEach((a) => {
        if (a.isSelected && (a as any).message) list.push((a as any).message);
      });
    });
    sharedPinnedGroups.forEach((g) => {
      g.items.forEach((m) => {
        if (m.isSelected) list.push(m);
      });
    });
    return Array.from(new Set(list));
  };

  const validateEditProfile = (u: IUser): boolean => {
    const errors = UserValidator.validateForEditProfile(u);
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveEditProfile = async () => {
    if (!validateEditProfile(editUser)) return;
    const res = await services.updateProfile(editUser);
    if (res) {
      setDisplayedUser(res);
      setEditUser({ ...res });
    }
  };

  const handlePrivacyChange = async (key: keyof PrivacySettingsDto, val: PrivacyVisibility) => {
    const updated = { ...privacySettings, [key]: val };
    setPrivacySettings(updated);
    await services.savePrivacySettings(updated);
  };

  const handleVerifyCurrentPassword = async () => {
    setPasswordErrorMessage('');
    if (!currentPasswordInput) {
      setPasswordErrorMessage('Please enter your current password.');
      return;
    }
    const ok = await services.verifyPassword(currentPasswordInput);
    if (ok) {
      setIsChangePasswordStep1(false);
    } else {
      setPasswordErrorMessage('Invalid password. Please try again.');
    }
  };

  const handleSaveNewPassword = async () => {
    setPasswordErrorMessage('');
    if (!newPasswordInput) {
      setPasswordErrorMessage('Password cannot be empty.');
      return;
    }
    if (newPasswordInput.length < 8) {
      setPasswordErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/.test(newPasswordInput)) {
      setPasswordErrorMessage('Password must contain uppercase, lowercase letters and numbers.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordErrorMessage('Passwords do not match.');
      return;
    }
    const success = await services.changePassword(newPasswordInput);
    if (success) {
      setIsChangePasswordStep1(true);
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setCurrentSettingsSubPanel('main');
    } else {
      setPasswordErrorMessage('Failed to update password. Please try again.');
    }
  };

  const handleSavePasscode = () => {
    if (passcode1.length !== 4 || passcode1 !== passcode2) return;
    services.savePasscode(passcode1);
    setPasscodeButtonText('Change Code');
    setPasscode1('');
    setPasscode2('');
    setCurrentSettingsSubPanel('main');
  };

  const handleRemovePasscode = () => {
    services.savePasscode(null);
    setPasscodeButtonText('Setup Code');
  };

  const openDevicesSubPanel = async () => {
    const devs = await services.getDevices();
    if (devs) {
      setCurrentDevice(devs.find((d) => d.isCurrent) || null);
      setOtherDevices(devs.filter((d) => !d.isCurrent));
    }
    setCurrentSettingsSubPanel('devices');
  };

  const openSpeakersCameraSubPanel = () => {
    const cams = services.getCameras();
    const mics = services.getMicrophones();
    const spks = services.getSpeakers();
    setAvailableCameras(cams);
    setAvailableMicrophones(mics);
    setAvailableSpeakers(spks);
    setSelectedCamera(cams[0] || 'Default Camera');
    setSelectedMicrophone(mics[0] || 'Default Microphone');
    setSelectedSpeaker(spks[0] || 'Default Speakers');
    setCurrentSettingsSubPanel('speakersCamera');
  };

  const openBlockedUsersSubPanel = async () => {
    const blocked = await services.getBlockedUsers();
    setBlockedUsersList(blocked || []);
    setCurrentSettingsSubPanel('blockedUsers');
  };

  const handleSortStories = (criterion: string) => {
    const sorted = [...activeStories].sort((a, b) => {
      switch (criterion) {
        case 'DateAsc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'ViewsDesc':
          return b.viewsCount - a.viewsCount;
        case 'ViewsAsc':
          return a.viewsCount - b.viewsCount;
        case 'LikesDesc':
          return b.likesCount - a.likesCount;
        case 'LikesAsc':
          return a.likesCount - b.likesCount;
        case 'DislikesDesc':
          return b.dislikesCount - a.dislikesCount;
        case 'DislikesAsc':
          return a.dislikesCount - b.dislikesCount;
        case 'CommentsDesc':
          return b.commentsCount - a.commentsCount;
        case 'CommentsAsc':
          return a.commentsCount - b.commentsCount;
        case 'DateDesc':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    setActiveStories(sorted);
    setStoriesFilterOpen(false);
  };

  const handleShowMembers = async (type: 'members' | 'admins' | 'blacklist') => {
    if (type === 'members') {
      setGroupMembersPanelTitle('Group Members');
      const list = await services.getGroupMembers(user.id);
      setActiveMembersList(list || []);
    } else if (type === 'admins') {
      setGroupMembersPanelTitle('Administrators');
      const list = await services.getGroupAdministrators(user.id);
      setActiveMembersList(list || []);
    } else {
      setGroupMembersPanelTitle('Blacklist');
      const list = await services.getGroupBlacklist(user.id);
      setActiveMembersList(list || []);
    }
    expandRightPanel('members');
  };

  const handleOpenMemberPermissions = async (m: IGroupMember) => {
    if (!groupDetails?.isOwner && (m.roleName === 'Owner' || m.roleName === 'Admin')) return;
    const dto = await services.getMemberPermissions(user.id, m.id);
    if (dto) {
      setEditingMember(m);
      setPermIsAdmin(dto.isAdmin);
      setPermCanSendText(dto.canSendText);
      setPermCanSendMedia(dto.canSendMedia);
      setPermCanPinMessages(dto.canPinMessages);
      setIsMemberPermissionsOpen(true);
    }
  };

  const handleSaveMemberPermissions = async () => {
    if (!editingMember) return;
    const ok = await services.saveMemberPermissions(user.id, editingMember.id, {
      isAdmin: permIsAdmin,
      canSendText: permCanSendText,
      canSendMedia: permCanSendMedia,
      canPinMessages: permCanPinMessages,
    });
    if (ok) {
      setIsMemberPermissionsOpen(false);
      setEditingMember(null);
      handleShowMembers('members');
    }
  };

  const handleSaveGroupSettings = async () => {
    const payload: GroupUpdateDto = {
      name: editGroupName,
      description: editGroupDescription,
      avatar: editGroupAvatar,
      isPublic: editGroupIsPublic,
      groupLink: editGroupIsPublic ? editGroupLink.trim() : '',
      canSendText: groupCanSendText,
      canSendMedia: groupCanSendMedia,
      canPinMessages: groupCanPinMessages,
    };
    const ok = await services.updateGroupSettings(user.id, payload);
    if (ok) {
      await loadGroupDetails(user.id);
      collapseRightPanel();
    }
  };

  return {
    isExpanded,
    activeRightContainer,
    displayedUser,
    isObservedUserBlocked,
    isBlockedByMe,
    isBlockedByThem,
    isObservedUserMuted,
    setIsObservedUserMuted,
    activeStories,
    isStoriesLoading,
    storiesFilterOpen,
    setStoriesFilterOpen,
    editUser,
    setEditUser,
    editErrors,
    currentSettingsSubPanel,
    setCurrentSettingsSubPanel,
    privacySettings,
    passcodeButtonText,
    passcode1,
    setPasscode1,
    passcode2,
    setPasscode2,
    blockedUsersList,
    setBlockedUsersList,
    isChangePasswordStep1,
    setIsChangePasswordStep1,
    currentPasswordInput,
    setCurrentPasswordInput,
    newPasswordInput,
    setNewPasswordInput,
    confirmPasswordInput,
    setConfirmPasswordInput,
    passwordErrorMessage,
    currentDevice,
    otherDevices,
    setOtherDevices,
    availableCameras,
    availableMicrophones,
    availableSpeakers,
    selectedCamera,
    setSelectedCamera,
    selectedMicrophone,
    setSelectedMicrophone,
    selectedSpeaker,
    setSelectedSpeaker,
    speakerVolume,
    setSpeakerVolume,
    micSensitivity,
    setMicSensitivity,
    selectedSharedMediaType,
    sharedMediaTitle,
    isSharedMediaLoading,
    sharedAttachmentGroups,
    sharedPinnedGroups,
    isSelectionMode,
    setIsSelectionMode,
    selectedCount,
    groupDetails,
    groupMembersPanelTitle,
    activeMembersList,
    membersCount,
    adminsCount,
    blackListCount,
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
    copiedKey,
    activeContextMenu,
    setActiveContextMenu,
    copyToClipboard,
    expandRightPanel,
    collapseRightPanel,
    handleOpenStoriesMenu,
    loadSharedMedia,
    toggleItemSelection,
    handleCancelSelection,
    handleSharedItemClick,
    getSelectedMessagesList,
    handleSaveEditProfile,
    handlePrivacyChange,
    handleVerifyCurrentPassword,
    handleSaveNewPassword,
    handleSavePasscode,
    handleRemovePasscode,
    openDevicesSubPanel,
    openSpeakersCameraSubPanel,
    openBlockedUsersSubPanel,
    handleSortStories,
    handleShowMembers,
    handleOpenMemberPermissions,
    handleSaveMemberPermissions,
    handleSaveGroupSettings,
    loadGroupDetails,
    services,
  };
}