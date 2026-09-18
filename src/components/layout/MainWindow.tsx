import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NavigationRail } from './NavigationRail';
import { SidebarChatsView } from '../sidebar/SidebarChatsView';
import { ChatWorkspaceView } from '../chat/ChatWorkspaceView';
import { MessageInputUserControl } from '../chat/MessageInputUserControl';
import { ProfileView } from '../profile/ProfileView';
import { PhotoViewerView } from '../media/PhotoViewerView';
import { VideoViewerView } from '../media/VideoViewerView';
import { CallModal } from '../modals/CallModal';
import { LoginView } from '../auth/LoginView';

import { useNavigationStore } from '../../stores/navigationStore';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import { useSidebarChatsStore } from '../../stores/sidebarChatsStore';
import { authService } from '../../services/auth.service';
import { userService } from '../../services/user.service';
import { chatService } from '../../services/chat.service';
import { eventBus } from '../../services/eventBus';
import { MainTab } from '../../types/enums';
import { IAttachment } from '../../types/models';

// Константы из MainWindow.xaml.cs
const SPLITTER_WIDTH = 6;
const MIN_EXPANDED_WIDTH = 180;
const NAV_COLUMN_WIDTH = 66;
const MIN_CHAT_WORKSPACE_WIDTH = 430;
const CHAT_PROPORTIONAL_THRESHOLD = 625;

export const MainWindow: React.FC = () => {
  const { currentTab, isProfileOpen, closeProfile } = useNavigationStore();
  const { currentUser, checkAuth } = useAuthStore();
  const { selectedChatUser } = useChatStore();
  const { loadChats } = useSidebarChatsStore();

  // Состояние сплиттера
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const lastExpandedWidth = useRef(340);
  const isDraggingSplitter = useRef(false);

  // Оверлеи просмотра медиа
  const [photoViewer, setPhotoViewer] = useState<{ isOpen: boolean; list: IAttachment[]; index: number }>({
    isOpen: false,
    list: [],
    index: 0,
  });
  const [videoViewer, setVideoViewer] = useState<{ isOpen: boolean; url: string; fileHeader?: string; senderMeta?: string }>({
    isOpen: false,
    url: '',
  });

  // 1. Инициализация входа в приложение
  useEffect(() => {
    checkAuth(authService, userService).then((isAuth) => {
      if (isAuth) {
        loadChats(chatService, true);
      }
    });
  }, [checkAuth, loadChats]);

  // 2. Регистрация глобальных сообщений EventBus (аналог WeakReferenceMessenger в MainWindow)
  useEffect(() => {
    const unbindPhoto = eventBus.on('OpenPhotoViewerMessage' as any, (data: any) => {
      if (data?.mediaList) {
        setPhotoViewer({ isOpen: true, list: data.mediaList, index: data.startIndex || 0 });
      }
    });

    const unbindVideo = eventBus.on('OpenVideoViewerRequestMessage' as any, (data: any) => {
      if (data?.videoUrl) {
        setVideoViewer({
          isOpen: true,
          url: data.videoUrl,
          fileHeader: data.fileName || 'Video',
          senderMeta: data.senderName || '',
        });
      }
    });

    return () => {
      unbindPhoto();
      unbindVideo();
    };
  }, []);

  // 3. Автоматический расчет пропорций окна (Window_SizeChanged из C#)
  const handleWindowResize = useCallback(() => {
    if (isDraggingSplitter.current) return;

    const totalWidth = window.innerWidth;
    const availableForContent = totalWidth - NAV_COLUMN_WIDTH;
    const maxAvailableSidebarWidth = availableForContent - MIN_CHAT_WORKSPACE_WIDTH;

    if (maxAvailableSidebarWidth < MIN_EXPANDED_WIDTH) {
      if (!isSidebarCollapsed) {
        setIsSidebarCollapsed(true);
      }
      return;
    }

    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
    }

    const baseSidebar = lastExpandedWidth.current >= MIN_EXPANDED_WIDTH ? lastExpandedWidth.current : 340;
    const baseThresholdTotal = baseSidebar + CHAT_PROPORTIONAL_THRESHOLD;

    const targetWidth = availableForContent > baseThresholdTotal
      ? baseSidebar + (availableForContent - baseThresholdTotal) * 0.30
      : Math.min(baseSidebar, maxAvailableSidebarWidth);

    setSidebarWidth(Math.round(targetWidth));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [handleWindowResize]);

  // 4. Перетаскивание сплиттера мышью (MainSplitter_DragDelta / MainSplitter_DragCompleted)
  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSplitter.current = true;
    const startX = e.clientX;
    const startWidth = isSidebarCollapsed ? 0 : sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingSplitter.current) return;
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(0, startWidth + deltaX);

      if (newWidth < MIN_EXPANDED_WIDTH) {
        setIsSidebarCollapsed(true);
      } else {
        setIsSidebarCollapsed(false);
        setSidebarWidth(Math.min(1100, newWidth));
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      isDraggingSplitter.current = false;
      const finalWidth = sidebarWidth;

      if (finalWidth < MIN_EXPANDED_WIDTH) {
        setIsSidebarCollapsed(true);
      } else {
        setIsSidebarCollapsed(false);
        lastExpandedWidth.current = finalWidth;
      }

      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Двойной клик по сплиттеру (MainSplitter_MouseDoubleClick)
  const handleSplitterDoubleClick = () => {
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
      setSidebarWidth(lastExpandedWidth.current);
    } else {
      lastExpandedWidth.current = sidebarWidth;
      setIsSidebarCollapsed(true);
    }
  };

  // Экран авторизации (LoginTransition)
  if (!currentUser) {
    return <LoginView />;
  }

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#0E1621',
        color: '#FFFFFF',
        fontFamily: 'Segoe UI, -apple-system, BlinkMacSystemFont, Roboto, sans-serif',
      }}
    >
      {/* КОЛОНКА 1: НАВИГАЦИОННАЯ ПАНЕЛЬ (66px) */}
      <NavigationRail />

      {/* КОЛОНКА 2: САЙДБАР С КОНТЕНТОМ */}
      <div
        style={{
          width: isSidebarCollapsed ? 0 : sidebarWidth,
          maxWidth: 1100,
          height: '100%',
          backgroundColor: '#111B21',
          overflow: 'hidden',
          transition: isDraggingSplitter.current ? 'none' : 'width 0.15s ease-out',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {currentTab === MainTab.Chats && <SidebarChatsView />}
        {currentTab === MainTab.AccountSwitch && (
          <div style={{ padding: 24, textAlign: 'center', color: '#8696A0' }}>
            <h3>Accounts</h3>
            <p>Saved profiles switcher</p>
          </div>
        )}
        {currentTab === MainTab.Notes && (
          <div style={{ padding: 24, textAlign: 'center', color: '#8696A0' }}>
            <h3>Notes</h3>
            <p>Saved notes and bookmarks</p>
          </div>
        )}
        {currentTab === MainTab.Tasks && (
          <div style={{ padding: 24, textAlign: 'center', color: '#8696A0' }}>
            <h3>Tasks</h3>
            <p>Task lists and checklists</p>
          </div>
        )}
        {currentTab === MainTab.Games && (
          <div style={{ padding: 24, textAlign: 'center', color: '#8696A0' }}>
            <h3>Games</h3>
            <p>Interactive mini-games</p>
          </div>
        )}
      </div>

      {/* СПЛИТТЕР (MainSplitter) */}
      <div
        onMouseDown={handleSplitterMouseDown}
        onDoubleClick={handleSplitterDoubleClick}
        title="Double click to toggle collapse"
        style={{
          width: SPLITTER_WIDTH,
          height: '100%',
          cursor: 'col-resize',
          backgroundColor: 'transparent',
          position: 'relative',
          userSelect: 'none',
          zIndex: 40,
        }}
      >
        {/* Индикатор линии при наведении */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            opacity: isDraggingSplitter.current ? 1 : 0,
            transition: 'opacity 0.15s',
          }}
        />
      </div>

      {/* КОЛОНКА 3: РАБОЧАЯ ОБЛАСТЬ ЧАТА ИЛИ ДРУГИХ ВКЛАДОК */}
      <div
        style={{
          flex: 1,
          height: '100%',
          backgroundColor: '#0B141B',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          borderLeft: '1px solid #17212B',
          minWidth: MIN_CHAT_WORKSPACE_WIDTH,
        }}
      >
        {currentTab === MainTab.Chats && (
          <>
            <ChatWorkspaceView />
            {selectedChatUser && (
              <div style={{ padding: '0 20px 16px 20px', zIndex: 20 }}>
                <MessageInputUserControl />
              </div>
            )}
          </>
        )}

        {currentTab !== MainTab.Chats && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
            <div style={{ padding: '16px 24px', background: '#1E293B', borderRadius: 12 }}>
              Workspace for {currentTab} is ready
            </div>
          </div>
        )}
      </div>

      {/* ================= ОВЕРЛЕИ И ДИАЛОГИ ================= */}
      {/* 1. Карточка профиля */}
      {isProfileOpen && (
        <ProfileView
          isOpen={isProfileOpen}
          user={currentUser}
          isOwnProfile={true}
          onClose={closeProfile}
        />
      )}

      {/* 2. Просмотрщик фото */}
      <PhotoViewerView
        isOpen={photoViewer.isOpen}
        mediaList={photoViewer.list}
        startIndex={photoViewer.index}
        onClose={() => setPhotoViewer((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* 3. Просмотрщик видео */}
      <VideoViewerView
        isOpen={videoViewer.isOpen}
        videoUrl={videoViewer.url}
        fileHeader={videoViewer.fileHeader}
        senderMeta={videoViewer.senderMeta}
        onClose={() => setVideoViewer((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* 4. Модалка звонка */}
      <CallModal />
    </div>
  );
};