export const Theme = {
  // Акцент приложения (Color.Accent / AppAccentBrush)
  AppAccent: '#1E9BEB',

  // Основная карточка и оверлей
  OverlayBackdrop: 'rgba(0, 0, 0, 0.5)', // #80000000
  ProfileCardBackground: '#12161D',
  ProfileLeftPanelBackground: '#161A23',
  ProfileLeftPanelBorder: '#222836',

  // Текст и подписи
  MainWindowText: '#FFFFFF',
  ProfileSectionLabel: '#7A8490',
  ProfileMetadataLabel: '#7A8490',
  ProfileMetadataValue: '#A0ABB8',
  TextMuted: '#7D8494',

  // Кнопки действия (ProfileActionButton): активный фон и бордер 1:1 #2A303C
  ProfileActionButtonBg: '#1E232E',
  ProfileActionButtonText: '#FFFFFF',
  ProfileActionButtonBorder: '#2A303C',
  ProfileActionButtonActiveBg: '#2A303C',

  // Поля ввода
  ProfileInputText: '#FFFFFF',
  ProfileInputPlaceholder: 'rgba(255, 255, 255, 0.3)',
  ProfileInputContainerBg: '#161B26',
  ProfileInputContainerBorder: '#222836',
  ProfileValidationError: '#D32F2F',

  // Выпадающие списки
  ProfileComboBoxDropdownBg: '#171A21',
  ProfileComboBoxDropdownSelection: '#2A303C',
  ProfileComboBoxDropdownText: '#E8E8E8',

  // Цветные иконки секций левой панели (1:1 DefaultDark.xaml)
  ProfileInfoIconName: '#5865F2',
  ProfileInfoIconAbout: '#00AFF4',
  ProfileInfoIconPhone: '#3BA55C',
  ProfileInfoIconEmail: '#3BA55C',
  ProfileInfoIconGender: '#ED4245',
  ProfileInfoIconBirthday: '#FAA61A',
  OtherProfileSharedMediaIcon: '#8E9297',

  // Истории
  ProfileStoryViews: '#FFFFFF',
  ProfileStoryEditButtonBg: 'rgba(28, 33, 45, 0.7)',
  ProfileStoryDeleteButtonBg: 'rgba(255, 59, 48, 0.7)',
  ProfileNoStoriesIcon: '#2A303C',
  ProfileNoStoriesSubtitle: '#7A8490',

  // Блок General Info
  ProfileEditContainerBg: '#0C1017',
  ProfileEditGeneralBgStart: '#121824',
  ProfileEditGeneralBgEnd: '#0B0E14',
  ProfileEditGeneralBorder: '#1F2533',
  ProfileEditAvatarFallbackBg: '#800080',
  ProfileEditAvatarCameraOverlayBg: 'rgba(0, 0, 0, 0.6)',
  ProfileEditInputIcon: '#8B949E',

  // Устройства и сессии
  ProfileTerminateSessionsBg: '#2B1E1E',
  ProfileTerminateSessionsText: '#FF3B30',
  ProfileDeviceItemBg: '#1F2533',
  ProfileActiveDeviceBadgeBg: '#1A3F2B',
  ProfileActiveDeviceBadgeText: '#4CAF50',
  ProfileDestructiveAction: '#FF3B30',

  // Диалог черного списка
  ProfileBlockedDialogBg: '#1C212D',
  ProfileBlockedItemHoverBg: '#232A3B',
  ProfileBannedBadgeBg: '#FF3B30',
  ProfileBannedBadgeBorder: '#1C212D',

  // Группы
  GroupOwnerBadgeBg: '#2B213A',
  GroupOwnerBadgeText: '#B388FF',

  // Контекстное меню
  SidebarContextMenuBg: '#1C212D',
  SidebarContextMenuBorder: '#2A303C',
  SidebarMenuItemHighlight: '#232A3B',
} as const;