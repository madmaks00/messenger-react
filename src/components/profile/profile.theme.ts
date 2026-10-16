export const Theme = {
  // Акцент приложения (Color.Accent / AppAccentBrush)
  AppAccent: 'var(--accent-primary, #1E9BEB)',

  // Основная карточка и оверлей
  OverlayBackdrop: 'rgba(0, 0, 0, 0.5)', // #80000000
  ProfileCardBackground: 'var(--surface-recessed, #12161D)',
  ProfileLeftPanelBackground: 'var(--surface-panel, #161A23)',
  ProfileLeftPanelBorder: 'var(--border-primary, #222836)',

  // Текст и подписи
  MainWindowText: 'var(--text-body, #FFFFFF)',
  ProfileSectionLabel: 'var(--text-secondary, #7A8490)',
  ProfileMetadataLabel: 'var(--text-secondary, #7A8490)',
  ProfileMetadataValue: 'var(--text-secondary, #A0ABB8)',
  TextMuted: 'var(--text-secondary, #7D8494)',

  // Кнопки действия (ProfileActionButton): активный фон и бордер 1:1 #2A303C
  ProfileActionButtonBg: 'var(--surface-control, #1E232E)',
  ProfileActionButtonText: 'var(--text-body, #FFFFFF)',
  ProfileActionButtonBorder: 'var(--border-primary, #2A303C)',
  ProfileActionButtonActiveBg: 'var(--surface-hover, #2A303C)',

  // Поля ввода
  ProfileInputText: 'var(--text-body, #FFFFFF)',
  ProfileInputPlaceholder: 'var(--text-secondary, rgba(255, 255, 255, 0.3))',
  ProfileInputContainerBg: 'var(--surface-panel, #161B26)',
  ProfileInputContainerBorder: 'var(--border-primary, #222836)',
  ProfileValidationError: '#D32F2F',

  // Выпадающие списки
  ProfileComboBoxDropdownBg: 'var(--surface-panel, #171A21)',
  ProfileComboBoxDropdownSelection: 'var(--surface-hover, #2A303C)',
  ProfileComboBoxDropdownText: 'var(--text-secondary, #E8E8E8)',

  // Цветные иконки секций и настроек (1:1 DefaultDark.xaml)
  ProfileInfoIconName: 'var(--link-colour, #5865F2)',
  ProfileInfoIconAbout: 'var(--link-colour, #00AFF4)',
  ProfileInfoIconPhone: 'var(--success-text, #3BA55C)',
  ProfileInfoIconEmail: 'var(--success-text, #3BA55C)',
  ProfileInfoIconGender: 'var(--danger-text, #ED4245)',
  ProfileInfoIconBirthday: 'var(--warning-text, #FAA61A)',
  RoomIconSpotlight: 'var(--link-colour, #00D2FF)', // RoomIconSpotlightBrush из DefaultDark.xaml
  OtherProfileSharedMediaIcon: 'var(--text-secondary, #8E9297)',

  // Истории
  ProfileStoryViews: '#FFFFFF',
  ProfileStoryEditButtonBg: 'rgba(28, 33, 45, 0.7)',
  ProfileStoryDeleteButtonBg: 'rgba(255, 59, 48, 0.7)',
  ProfileNoStoriesIcon: 'var(--text-secondary, #2A303C)',
  ProfileNoStoriesSubtitle: 'var(--text-secondary, #7A8490)',

  // Блок General Info
  ProfileEditContainerBg: 'var(--surface-recessed, #0C1017)',
  ProfileEditGeneralBgStart: 'var(--surface-panel, #121824)',
  ProfileEditGeneralBgEnd: 'var(--surface-recessed, #0B0E14)',
  ProfileEditGeneralBorder: 'var(--border-primary, #1F2533)',
  ProfileEditAvatarFallbackBg: '#800080',
  ProfileEditAvatarCameraOverlayBg: 'rgba(0, 0, 0, 0.6)',
  ProfileEditInputIcon: 'var(--text-secondary, #8B949E)',

  // Устройства и сессии
  ProfileTerminateSessionsBg: 'var(--surface-control, #2B1E1E)',
  ProfileTerminateSessionsText: 'var(--danger-text, #FF3B30)',
  ProfileDeviceItemBg: 'var(--surface-control, #1F2533)',
  ProfileActiveDeviceBadgeBg: 'var(--surface-hover, #1A3F2B)',
  ProfileActiveDeviceBadgeText: 'var(--success-text, #4CAF50)',
  ProfileDestructiveAction: '#FF3B30',

  // Диалог черного списка
  ProfileBlockedDialogBg: 'var(--surface-control, #1C212D)',
  ProfileBlockedItemHoverBg: 'var(--surface-hover, #232A3B)',
  ProfileBannedBadgeBg: '#FF3B30',
  ProfileBannedBadgeBorder: 'var(--border-primary, #1C212D)',

  // Группы
  GroupOwnerBadgeBg: 'var(--surface-hover, #2B213A)',
  GroupOwnerBadgeText: 'var(--violet-text, #B388FF)',

  // Контекстное меню
  SidebarContextMenuBg: 'var(--surface-control, #1C212D)',
  SidebarContextMenuBorder: 'var(--border-primary, #2A303C)',
  SidebarMenuItemHighlight: 'var(--surface-hover, #232A3B)',
} as const;