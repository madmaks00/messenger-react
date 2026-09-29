import React, { useEffect, useState } from 'react';
import './theme/theme.css';

import { NavigationRail } from './components/layout/NavigationRail';
import { SidebarChatsView } from './components/sidebar/SidebarChatsView';
import { SidebarAccountsView } from './components/accounts/SidebarAccountsView';
import { SidebarNotesView } from './components/notes/SidebarNotesView';
import { SidebarTasksView } from './components/tasks/SidebarTasksView';
import { SidebarGamesView } from './components/games/SidebarGamesView';

import { ChatWorkspaceView } from './components/chat/ChatWorkspaceView';
import { AccountManagementContentView } from './components/accounts/AccountManagementContentView';
import { NotesWorkspaceView } from './components/notes/NotesWorkspaceView';
import { TasksWorkspaceView } from './components/tasks/TasksWorkspaceView';
import { GamesWorkspaceView } from './components/games/GamesWorkspaceView';
import { GameOverlayView } from './components/games/GameOverlayView';

import { ProfileView } from './components/profile/ProfileView';
import { PhotoViewerView } from './components/media/PhotoViewerView';
import { VideoViewerView } from './components/media/VideoViewerView';
import { ImageEditorView } from './components/media/ImageEditorView';
import { MusicPlayerView } from './components/media/MusicPlayerView';

// 🟢 1:1 C# WPF: Окно звонков CallWindow (CallWindow.xaml / CallsViewModel.cs)
import { CallWindow } from './components/modals/CallWindow';
import { InAppNotification } from './components/common/InAppNotification';

// Диалоги и оверлеи
import { ConfirmDialogView } from './components/modals/ConfirmDialogView';
import { CreateFolderDialog } from './components/modals/CreateFolderDialog';
import { PinMessageDialog } from './components/modals/PinMessageDialog';
import { ForwardMessageDialog } from './components/modals/ForwardMessageDialog';
import { JoinGroupDialog, JoinGroupPreviewData } from './components/modals/JoinGroupDialog';
import { CreateGroupModalView } from './components/modals/CreateGroupModalView';
import { StoryEditorView } from './components/stories/StoryEditorView';
import { StoryViewerView } from './components/stories/StoryViewerView';
import { PasscodeLockView } from './components/security/PasscodeLockView';
import { PasscodeSetupModalView } from './components/security/PasscodeSetupModalView';

import { useNavigationStore } from './stores/navigationStore';
import { useAuthStore } from './stores/authStore';
import { useSidebarChatsStore } from './stores/sidebarChatsStore';
import { useTodoStore } from './stores/todoStore';
import { useNotesStore } from './stores/notesStore';
import { useStoriesStore } from './stores/storiesStore';
import { useSidebarResize } from './hooks/useSidebarResize';
import { SecurityService } from './services/security.service';
import { authService } from './services/auth.service';
import { userService } from './services/user.service';
import { chatService } from './services/chat.service';
import { signalRService } from './services/signalr.service';
import { userSession } from './services/userSession';
import { eventBus } from './services/eventBus';
import { MainTab } from './types/enums';
import { IAttachment } from './types/models';

export const App: React.FC = () => {
  const { currentTab, isProfileOpen, closeProfile } = useNavigationStore();
  const { currentUser, checkAuth } = useAuthStore();
  const { loadChats } = useSidebarChatsStore();
  const { initialize: initTodo } = useTodoStore();
  const { initialize: initNotes } = useNotesStore();

  const {
    sidebarWidth,
    sidebarOpacity,
    isCollapsed,
    isDragging,
    isHovered,
    setIsHovered,
    onMouseDown,
    onDoubleClick,
  } = useSidebarResize();

  const [isAppLocked, setIsAppLocked] = useState(SecurityService.isPasscodeSet());
  const [isPasscodeSetupOpen, setIsPasscodeSetupOpen] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<any>({ isOpen: false });
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [pinDialog, setPinDialog] = useState<any>({ isOpen: false });
  const [forwardDialog, setForwardDialog] = useState<any>({ isOpen: false });
  const [joinGroupData, setJoinGroupData] = useState<JoinGroupPreviewData | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  const [photoViewer, setPhotoViewer] = useState<{ isOpen: boolean; list: IAttachment[]; index: number }>({
    isOpen: false,
    list: [],
    index: 0,
  });
  const [videoViewer, setVideoViewer] = useState<{
    isOpen: boolean;
    url: string;
    fileHeader?: string;
    senderMeta?: string;
  }>({ isOpen: false, url: '' });
  const [imageEditor, setImageEditor] = useState<{ isOpen: boolean; src: string; onDone?: (res: string) => void }>({
    isOpen: false,
    src: '',
  });

  // 🟢 1:1 WPF: Состояние редактора историй StoryEditorOverlay
  const [storyEditor, setStoryEditor] = useState<{
    isOpen: boolean;
    image: string;
    storyId?: number | null;
    description?: string;
    isPrivate?: boolean;
  }>({ isOpen: false, image: '', storyId: null, description: '', isPrivate: false });

  useEffect(() => {
    // 🟢 1. МГНОВЕННЫЙ СТАРТ СОКЕТА: не ждём checkAuth!
    // Токен уже есть в хранилище — начинаем WebSocket-рукопожатие сразу же:
    const token =
      userSession.token ||
      localStorage.getItem('auth_token') ||
      localStorage.getItem('jwt_token') ||
      (() => {
        try {
          return JSON.parse(localStorage.getItem('user_session_data') || '{}').token;
        } catch {
          return null;
        }
      })();

    if (token && !isAppLocked) {
      void signalRService.initAsync(token).catch((err) => {
        console.warn('[App] Ошибка раннего подключения к SignalR:', err);
      });
    }

    // 🟢 2. Проверка сессии и загрузка данных (ПАРАЛЛЕЛЬНО, не блокируя сокет)
    checkAuth(authService, userService).then(async (isAuth) => {
      if (isAuth && !isAppLocked) {
        // Загружаем чаты и истории параллельно через Promise.all
        await Promise.allSettled([
          loadChats(true),
          useStoriesStore.getState().loadStoriesFeed(),
          useStoriesStore.getState().loadMyStories(),
        ]);

        initTodo();
        initNotes();

        const currentUserId = useAuthStore.getState().currentUser?.id ?? userSession.userId ?? 0;
        if (currentUserId > 0) {
          chatService.syncDeltaAsync(currentUserId).then((count) => {
            if (count > 0) {
              void loadChats(false);
            }
          });
        }
      }
    });
  }, [isAppLocked]);

  useEffect(() => {
    const unbindAccountSwitched = eventBus.on('AccountSwitchedMessage' as any, async () => {
      await loadChats(true);
      initTodo();
      initNotes();
      void useStoriesStore.getState().loadStoriesFeed();
      void useStoriesStore.getState().loadMyStories();
    });

    const unbindProfileUpdated = eventBus.on('UserProfileUpdatedMessage', ({ user: updatedUser }) => {
      useAuthStore.setState((state) => {
        if (state.currentUser && state.currentUser.id === updatedUser.id) {
          return { currentUser: { ...state.currentUser, ...updatedUser } };
        }
        return state;
      });
    });

    const unbindConfirm = eventBus.on('OpenConfirmDialogMessage' as any, (data: any) => {
      setConfirmDialog({
        isOpen: true,
        targetTitle: data.title,
        targetAvatar: data.avatar,
        targetIcon: data.icon,
        targetIconColor: data.iconColor,
        dialogMessage: data.message,
        checkboxText: data.checkboxText,
        confirmButtonText: data.confirmButtonText,
        onConfirm: async (checked: boolean) => {
          await data.onConfirmAction?.(checked);
          setConfirmDialog({ isOpen: false });
        },
      });
    });

    const unbindCreateFolder = () => setIsCreateFolderOpen(true);
    const unbindCreateGroup = () => setIsCreateGroupOpen(true);
    const unbindPasscodeSetup = () => setIsPasscodeSetupOpen(true);

    window.addEventListener('OpenCreateFolderDialog', unbindCreateFolder);
    window.addEventListener('OpenCreateGroupModal', unbindCreateGroup);
    window.addEventListener('OpenPasscodeSetupModal', unbindPasscodeSetup);

    // 🟢 Поддержка обоих контрактов фото-галереи (WPF OpenPhotoGalleryMessage и web OpenPhotoViewerMessage)
    const handleOpenPhoto = (d: any) => {
      setPhotoViewer({
        isOpen: true,
        list: d.photos || d.mediaList || [],
        index: d.startIndex ?? d.index ?? 0,
      });
    };
    const unbindPhotoLegacy = eventBus.on('OpenPhotoViewerMessage' as any, handleOpenPhoto);
    const unbindPhotoGallery = eventBus.on('OpenPhotoGalleryMessage' as any, handleOpenPhoto);

    // 🟢 Видеоплеер
    const unbindVideo = eventBus.on('OpenVideoViewerRequestMessage' as any, (d: any) =>
      setVideoViewer({
        isOpen: true,
        url: d.videoUrl || d.url || d.pathToPlay || '',
        fileHeader: d.fileName || d.fileHeader,
        senderMeta: d.senderName || d.senderMeta,
      })
    );

    // 🟢 1:1 WPF: Редактор историй
    const unbindStoryEditor = eventBus.on('OpenStoryEditorMessage', (d) =>
      setStoryEditor({
        isOpen: true,
        image: d.image,
        storyId: d.storyId ?? null,
        description: d.description ?? '',
        isPrivate: d.isPrivate ?? false,
      })
    );

    return () => {
      unbindAccountSwitched();
      unbindProfileUpdated();
      unbindConfirm();
      unbindPhotoLegacy();
      unbindPhotoGallery();
      unbindVideo();
      unbindStoryEditor();
      window.removeEventListener('OpenCreateFolderDialog', unbindCreateFolder);
      window.removeEventListener('OpenCreateGroupModal', unbindCreateGroup);
      window.removeEventListener('OpenPasscodeSetupModal', unbindPasscodeSetup);
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-chat)',
        color: 'var(--text-primary)',
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
        position: 'relative',
        cursor: isDragging ? 'col-resize' : 'default',
        userSelect: isDragging ? 'none' : 'auto',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: 'var(--divider-color)',
          zIndex: 500,
        }}
      />

      <PasscodeLockView
        isLocked={isAppLocked}
        onUnlock={() => {
          setIsAppLocked(false);
          void loadChats(true);
          initTodo();
          initNotes();
          void useStoriesStore.getState().loadStoriesFeed();
          void useStoriesStore.getState().loadMyStories();
        }}
      />

      {/* КОЛОНКА 1: НАВИГАЦИЯ (66px) */}
      <div
        style={{
          width: 66,
          height: '100%',
          backgroundColor: 'var(--bg-nav)',
          borderRight: '1px solid var(--divider-color)',
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <NavigationRail />
      </div>

      {/* КОЛОНКА 2: САЙДБАР (SidebarColumn & MainSplitter) */}
      <div
        style={{
          width: sidebarWidth,
          minWidth: isCollapsed ? 6 : undefined,
          maxWidth: 1100,
          height: '100%',
          backgroundColor: 'var(--bg-list)',
          borderRight: '1px solid var(--divider-color)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          flexShrink: 0,
          overflow: 'hidden',
          transition: isDragging ? 'none' : 'width 0.15s ease-out',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            opacity: sidebarOpacity,
            display: isCollapsed ? 'none' : 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {currentTab === MainTab.Chats && <SidebarChatsView />}
          {currentTab === MainTab.AccountSwitch && <SidebarAccountsView />}
          {currentTab === MainTab.Notes && <SidebarNotesView />}
          {currentTab === MainTab.Tasks && <SidebarTasksView />}
          {currentTab === MainTab.Games && <SidebarGamesView />}

          <MusicPlayerView />
        </div>

        {/* СПЛИТТЕР */}
        <div
          onMouseDown={onMouseDown}
          onDoubleClick={onDoubleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          title="Двойной клик — скрыть/показать панель"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 6,
            height: '100%',
            cursor: 'col-resize',
            zIndex: 100,
            background: 'transparent',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 2,
              height: '100%',
              backgroundColor: 'var(--app-accent)',
              opacity: isHovered || isDragging ? 1 : 0,
              transition: isDragging ? 'none' : 'opacity 0.15s ease',
            }}
          />
        </div>
      </div>

      {/* КОЛОНКА 3: ОКНО ЧАТА / РАБОЧАЯ ОБЛАСТЬ */}
      <div
        style={{
          flex: 1,
          height: '100%',
          backgroundColor: 'var(--bg-chat)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          minWidth: 430,
        }}
      >
        {currentTab === MainTab.Chats && <ChatWorkspaceView />}
        {currentTab === MainTab.AccountSwitch && <AccountManagementContentView />}
        {currentTab === MainTab.Notes && <NotesWorkspaceView />}
        {currentTab === MainTab.Tasks && <TasksWorkspaceView />}
        {currentTab === MainTab.Games && (
          <>
            <GamesWorkspaceView />
            <GameOverlayView />
          </>
        )}
      </div>

      {/* ДИАЛОГИ И ОВЕРЛЕИ */}
      {isProfileOpen && currentUser && (
        <ProfileView
          isOpen={isProfileOpen}
          user={currentUser}
          isOwnProfile={true}
          initialTab={((useNavigationStore.getState() as any).profileTab as any) || 'stories'}
          onClose={closeProfile}
        />
      )}

      <PhotoViewerView
        isOpen={photoViewer.isOpen}
        mediaList={photoViewer.list}
        startIndex={photoViewer.index}
        onClose={() => setPhotoViewer((prev) => ({ ...prev, isOpen: false }))}
      />
      <VideoViewerView
        isOpen={videoViewer.isOpen}
        videoUrl={videoViewer.url}
        fileHeader={videoViewer.fileHeader}
        senderMeta={videoViewer.senderMeta}
        onClose={() => setVideoViewer((prev) => ({ ...prev, isOpen: false }))}
      />
      <ImageEditorView
        isOpen={imageEditor.isOpen}
        imageSrc={imageEditor.src}
        onClose={() => setImageEditor((p) => ({ ...p, isOpen: false }))}
        onDone={(res) => imageEditor.onDone?.(res)}
      />

      {/* 🟢 РЕДАКТОР ИСТОРИЙ (StoryEditorOverlay) */}
      <StoryEditorView
        isOpen={storyEditor.isOpen}
        imageSource={storyEditor.image}
        storyId={storyEditor.storyId}
        initialDescription={storyEditor.description}
        initialIsPrivate={storyEditor.isPrivate}
        onClose={() => setStoryEditor((p) => ({ ...p, isOpen: false }))}
      />

      <StoryViewerView />

      {/* 🟢 1:1 WPF ОКНО ЗВОНКА (CallWindow.xaml / CallWindow.xaml.cs) */}
      <CallWindow />

      <ConfirmDialogView
        isOpen={confirmDialog.isOpen}
        targetTitle={confirmDialog.targetTitle}
        targetAvatar={confirmDialog.targetAvatar}
        targetIcon={confirmDialog.targetIcon}
        targetIconColor={confirmDialog.targetIconColor}
        dialogMessage={confirmDialog.dialogMessage}
        checkboxText={confirmDialog.checkboxText}
        confirmButtonText={confirmDialog.confirmButtonText}
        onCancel={() => setConfirmDialog({ isOpen: false })}
        onConfirm={confirmDialog.onConfirm || (() => {})}
      />
      <CreateFolderDialog
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
      />
      <PinMessageDialog
        isOpen={pinDialog.isOpen}
        onCancel={() => setPinDialog({ isOpen: false })}
        onConfirm={(pinForAll) => pinDialog.onConfirm?.(pinForAll)}
      />
      <ForwardMessageDialog
        isOpen={forwardDialog.isOpen}
        onCancel={() => setForwardDialog({ isOpen: false })}
        onConfirm={(chatIds) => forwardDialog.onConfirm?.(chatIds)}
      />
      <JoinGroupDialog
        isOpen={Boolean(joinGroupData)}
        data={joinGroupData}
        onCancel={() => setJoinGroupData(null)}
        onConfirm={() => setJoinGroupData(null)}
      />
      <CreateGroupModalView
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
      />
      <PasscodeSetupModalView
        isOpen={isPasscodeSetupOpen}
        onClose={() => setIsPasscodeSetupOpen(false)}
      />

      <InAppNotification />
    </div>
  );
};

export default App;