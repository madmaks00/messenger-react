import React, { useState } from 'react';
import { useNavigationStore } from '../../stores/navigationStore';
import { useAuthStore } from '../../stores/authStore';
import { MainTab } from '../../types/enums';

// Векторные Material Design иконки из MainWindow.xaml
const Icons = {
  SendVariant: () => (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 20V4l19 8l-19 8zm2-3l11.85-5L5 7v3.5l6 1.5l-6 1.5V17z" />
    </svg>
  ),
  ChatOutline: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3c5.5 0 10 3.6 10 8c0 2.2-1.1 4.2-3 5.6V21l-3.2-1.6c-1.2.4-2.5.6-3.8.6c-5.5 0-10-3.6-10-8s4.5-8 10-8m0 2c-4.4 0-8 2.7-8 6s3.6 6 8 6c1.1 0 2.2-.2 3.2-.6l.6-.2l1.9 1v-2.2l.6-.5c1.1-.9 1.7-2.1 1.7-3.5c0-3.3-3.6-6-8-6z" />
    </svg>
  ),
  ChatFilled: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3c5.5 0 10 3.6 10 8c0 2.2-1.1 4.2-3 5.6V21l-3.2-1.6c-1.2.4-2.5.6-3.8.6c-5.5 0-10-3.6-10-8s4.5-8 10-8z" />
    </svg>
  ),
  BookmarkOutline: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3l7 3V5c0-1.1-.9-2-2-2m0 15l-5-2.18L7 18V5h10v13z" />
    </svg>
  ),
  BookmarkFilled: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3l7 3V5c0-1.1-.9-2-2-2z" />
    </svg>
  ),
  ClipboardListOutline: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-7-.25c.41 0 .75.34.75.75s-.34.75-.75.75s-.75-.34-.75-.75s.34-.75.75-.75M19 19H5V5h14v14M7 8h10v2H7V8m0 4h10v2H7v-2m0 4h7v2H7v-2z" />
    </svg>
  ),
  ClipboardListFilled: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-7-.25c.41 0 .75.34.75.75s-.34.75-.75.75s-.75-.34-.75-.75s.34-.75.75-.75M7 8h10v2H7V8m0 4h10v2H7v-2m0 4h7v2H7v-2z" />
    </svg>
  ),
  GamepadVariantOutline: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 6h10a6 6 0 0 1 6 6a6 6 0 0 1-6 6H7a6 6 0 0 1-6-6a6 6 0 0 1 6-6m0 2a4 4 0 0 0-4 4a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4a4 4 0 0 0-4-4H7m3 3v2h2v2H8v-2H6v-2h2V9h2m6 1a1 1 0 1 1-1 1a1 1 0 0 1 1-1m2 2a1 1 0 1 1-1 1a1 1 0 0 1 1-1m-2 2a1 1 0 1 1-1 1a1 1 0 0 1 1-1m-2-2a1 1 0 1 1-1 1a1 1 0 0 1 1-1z" />
    </svg>
  ),
  GamepadVariantFilled: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 6H7a6 6 0 0 0-6 6a6 6 0 0 0 6 6h10a6 6 0 0 0 6-6a6 6 0 0 0-6-6m-7 5v2h2v2H8v-2H6v-2h2V9h2m6 1a1 1 0 1 1-1 1a1 1 0 0 1 1-1m2 2a1 1 0 1 1-1 1a1 1 0 0 1 1-1m-2 2a1 1 0 1 1-1 1a1 1 0 0 1 1-1m-2-2a1 1 0 1 1-1 1a1 1 0 0 1 1-1z" />
    </svg>
  ),
  AccountSwitchOutline: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4a3 3 0 1 1-3 3a3 3 0 0 1 3-3m0 2a1 1 0 1 0 1 1a1 1 0 0 0-1-1m4 7a4 4 0 0 1 4 4v1H4v-1a4 4 0 0 1 4-4h8m-8 2a2 2 0 0 0-2 2h12a2 2 0 0 0-2-2H8m10-7h2v2h-2v2h-2V8h2V6z" />
    </svg>
  ),
  AccountSwitchFilled: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4a3 3 0 1 1-3 3a3 3 0 0 1 3-3m4 7a4 4 0 0 1 4 4v1H4v-1a4 4 0 0 1 4-4h8m10-7h2v2h-2v2h-2V8h2V6z" />
    </svg>
  ),
  PencilPlusOutline: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14.06 9l.94.94L5.92 19H5v-.92L14.06 9m3.6-6c-.25 0-.51.1-.7.29l-1.83 1.83l3.75 3.75l1.82-1.81c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.7-.29m-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75M19 13v3h3v2h-3v3h-2v-3h-3v-2h3v-3h2z" />
    </svg>
  ),
  FolderPlusOutline: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 19c0 .34.04.67.09 1H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6l2 2h8a2 2 0 0 1 2 2v5.81c-.61-.51-1.3-.9-2.09-1.14V8H4v10h9.09c-.05.33-.09.66-.09 1m7-4v3h3v2h-3v3h-2v-3h-3v-2h3v-3h2z" />
    </svg>
  ),
  FileDocumentPlusOutline: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h7.81c-.51-.61-.9-1.3-1.14-2.09H6V4h7v5h5v2.81c.71.18 1.36.49 1.94.92.04-.24.06-.49.06-.73l-6-6M18 15v3h-3v2h3v3h2v-3h3v-2h-3v-3h-2m-10 0v-2h5v2H8m0 4v-2h3.09c.12.72.37 1.39.72 2H8m0-8V9h8v2H8z" />
    </svg>
  ),
  ClipboardPlusOutline: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h7.81c-.51-.61-.9-1.3-1.14-2.09H5V5h14v6.81c.71.18 1.36.49 1.94.92.04-.24.06-.49.06-.73V5c0-1.1-.9-2-2-2m-7-.25c.41 0 .75.34.75.75s-.34.75-.75.75s-.75-.34-.75-.75s.34-.75.75-.75M18 15v3h-3v2h3v3h2v-3h3v-2h-3v-3h-2z" />
    </svg>
  ),
  Moon: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2A10 10 0 0 0 2 12A10 10 0 0 0 12 22A10 10 0 0 0 21.6 15.6A8.5 8.5 0 0 1 12 5.1A8.5 8.5 0 0 1 12.8 2.05A10 10 0 0 0 12 2Z" />
    </svg>
  ),
  Sun: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 7a5 5 0 1 0 0 10a5 5 0 0 0 0-10zm0-5a1 1 0 0 0-1 1v2a1 1 0 0 0 2 0V3a1 1 0 0 0-1-1zm0 18a1 1 0 0 0-1 1v2a1 1 0 0 0 2 0v-2a1 1 0 0 0-1-1zm8.66-14.66a1 1 0 0 0-1.41 0l-1.42 1.41a1 1 0 1 0 1.42 1.42l1.41-1.42a1 1 0 0 0 0-1.41zM6.17 17.83a1 1 0 0 0-1.41 0l-1.42 1.41a1 1 0 1 0 1.42 1.42l1.41-1.42a1 1 0 0 0 0-1.41zm14.49 4.17a1 1 0 0 0 0-1.41l-1.41-1.42a1 1 0 1 0-1.42 1.42l1.42 1.41a1 1 0 0 0 1.41 0zM4.75 6.17a1 1 0 0 0 0-1.41l-1.41-1.42a1 1 0 1 0-1.42 1.42l1.42 1.41a1 1 0 0 0 1.41 0zM22 11h-2a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2zM4 11H2a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2z" />
    </svg>
  ),
  CogOutline: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8zm0 6a2 2 0 1 1 0-4a2 2 0 0 1 0 4zm7.94-2.88l-1.37-.8l.1-.92a6.9 6.9 0 0 0 0-1.6l-.1-.92l1.37-.8a1 1 0 0 0 .36-1.37l-1.5-2.6a1 1 0 0 0-1.28-.43l-1.49.57l-.76-.53a7.1 7.1 0 0 0-1.38-.8l-.88-.34L14.3 2.1a1 1 0 0 0-1-.87h-3a1 1 0 0 0-1 .87l-.2 1.57l-.88.34a7.1 7.1 0 0 0-1.38.8l-.76.53l-1.49-.57a1 1 0 0 0-1.28.43l-1.5 2.6a1 1 0 0 0 .36 1.37l1.37.8l-.1.92a6.9 6.9 0 0 0 0 1.6l.1.92l-1.37.8a1 1 0 0 0-.36 1.37l1.5 2.6a1 1 0 0 0 1.28.43l1.49-.57l.76.53c.43.32.9.59 1.38.8l.88.34l.2 1.57a1 1 0 0 0 1 .87h3a1 1 0 0 0 1-.87l.2-1.57l.88-.34c.48-.21.95-.48 1.38-.8l.76-.53l1.49.57a1 1 0 0 0 1.28-.43l1.5-2.6a1 1 0 0 0-.36-1.37z" />
    </svg>
  ),
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
    </svg>
  ),
};

export const NavigationRail: React.FC = () => {
  const {
    currentTab,
    isDarkTheme,
    hasUnreadChats,
    hasDueTasks,
    switchTab,
    toggleTheme,
    openProfile,
  } = useNavigationStore();

  const { currentUser } = useAuthStore();
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  return (
    <div
      style={{
        width: 66,
        height: '100%',
        backgroundColor: '#0F1319', // BgNav в точности из WPF
        borderRight: '1px solid #1E232F', // DividerColor
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        userSelect: 'none',
        position: 'relative',
        zIndex: 50,
      }}
    >
      {/* ================= ВЕРХ ================= */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 20 }}>
        {/* 1. Статичный логотип SendVariant под углом -20° */}
        <div
          style={{
            color: '#1E9BEB',
            transform: 'rotate(-20deg)',
            filter: 'drop-shadow(0 0 15px rgba(30, 155, 235, 0.4))',
            marginBottom: 25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'default',
          }}
        >
          <Icons.SendVariant />
        </div>

        {/* 2. Аватарка пользователя 54x54 */}
        <div style={{ position: 'relative', width: 54, height: 54 }}>
          <div
            onClick={openProfile}
            title="Open Profile"
            style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              border: '2px solid #1E9BEB',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            {currentUser?.avatar ? (
              <img src={currentUser.avatar} alt="" style={{ width: 46, height: 46, borderRadius: 23, objectFit: 'cover' }} />
            ) : (
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: '#1E9BEB',
                  color: '#FFFFFF',
                  fontSize: 18,
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {(currentUser?.nickName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Кнопка создания истории (+) 20x20 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent('OpenCreateStoryMessage'));
            }}
            title="Create Story"
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: '#1E9BEB',
              border: '2px solid #0F1319',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <Icons.Plus />
          </button>
        </div>
      </div>

      {/* ================= ЦЕНТР: РАДИОКНОПКИ ТАБОВ (50px) ================= */}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
        {/* 1. Чаты */}
        <div
          onClick={() => switchTab(MainTab.Chats)}
          onMouseEnter={() => setHoveredBtn('chats')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={getNavButtonStyle(currentTab === MainTab.Chats)}
          title="Chats"
        >
          {currentTab === MainTab.Chats && <div style={activeBarIndicatorStyle} />}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: currentTab === MainTab.Chats ? '#1E9BEB' : hoveredBtn === 'chats' ? '#FFFFFF' : '#7D8494' }}>
              {currentTab === MainTab.Chats ? <Icons.ChatFilled /> : <Icons.ChatOutline />}
            </span>
            {hasUnreadChats && <div style={unreadDotBadgeStyle} />}
          </div>
        </div>

        {/* Разделитель 2px, margin 25, 15 */}
        <div style={railDividerStyle} />

        {/* 2. Заметки */}
        <div
          onClick={() => switchTab(MainTab.Notes)}
          onMouseEnter={() => setHoveredBtn('notes')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={getNavButtonStyle(currentTab === MainTab.Notes)}
          title="Notes"
        >
          {currentTab === MainTab.Notes && <div style={activeBarIndicatorStyle} />}
          <span style={{ color: currentTab === MainTab.Notes ? '#1E9BEB' : hoveredBtn === 'notes' ? '#FFFFFF' : '#7D8494' }}>
            {currentTab === MainTab.Notes ? <Icons.BookmarkFilled /> : <Icons.BookmarkOutline />}
          </span>
        </div>

        {/* 3. Задачи */}
        <div
          onClick={() => switchTab(MainTab.Tasks)}
          onMouseEnter={() => setHoveredBtn('tasks')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={getNavButtonStyle(currentTab === MainTab.Tasks)}
          title="Tasks"
        >
          {currentTab === MainTab.Tasks && <div style={activeBarIndicatorStyle} />}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: currentTab === MainTab.Tasks ? '#1E9BEB' : hoveredBtn === 'tasks' ? '#FFFFFF' : '#7D8494' }}>
              {currentTab === MainTab.Tasks ? <Icons.ClipboardListFilled /> : <Icons.ClipboardListOutline />}
            </span>
            {hasDueTasks && <div style={unreadDotBadgeStyle} />}
          </div>
        </div>

        {/* 4. Игры */}
        <div
          onClick={() => switchTab(MainTab.Games)}
          onMouseEnter={() => setHoveredBtn('games')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={getNavButtonStyle(currentTab === MainTab.Games)}
          title="Games"
        >
          {currentTab === MainTab.Games && <div style={activeBarIndicatorStyle} />}
          <span style={{ color: currentTab === MainTab.Games ? '#1E9BEB' : hoveredBtn === 'games' ? '#FFFFFF' : '#7D8494' }}>
            {currentTab === MainTab.Games ? <Icons.GamepadVariantFilled /> : <Icons.GamepadVariantOutline />}
          </span>
        </div>

        {/* Разделитель 2px */}
        <div style={railDividerStyle} />

        {/* 5. Смена аккаунта */}
        <div
          onClick={() => switchTab(MainTab.AccountSwitch)}
          onMouseEnter={() => setHoveredBtn('acc')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={getNavButtonStyle(currentTab === MainTab.AccountSwitch)}
          title="Switch Account"
        >
          {currentTab === MainTab.AccountSwitch && <div style={activeBarIndicatorStyle} />}
          <span style={{ color: currentTab === MainTab.AccountSwitch ? '#1E9BEB' : hoveredBtn === 'acc' ? '#FFFFFF' : '#7D8494' }}>
            {currentTab === MainTab.AccountSwitch ? <Icons.AccountSwitchFilled /> : <Icons.AccountSwitchOutline />}
          </span>
        </div>
      </div>

      {/* ================= НИЗ: КНОПКИ ДЕЙСТВИЙ (50px) ================= */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 20 }}>
        {/* Кнопки контекста для вкладок из NavActionButtonStyle */}
        {currentTab === MainTab.Chats && (
          <>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('OpenCreateGroupModal'))}
              title="Create Group"
              style={navActionBtnStyle}
            >
              <Icons.PencilPlusOutline />
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('OpenCreateFolderDialog'))}
              title="Create Folder"
              style={navActionBtnStyle}
            >
              <Icons.FolderPlusOutline />
            </button>
          </>
        )}

        {currentTab === MainTab.Notes && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('CreateNewNote'))}
            title="Create Note"
            style={navActionBtnStyle}
          >
            <Icons.FileDocumentPlusOutline />
          </button>
        )}

        {currentTab === MainTab.Tasks && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('CreateNewTaskList'))}
            title="Create Task List"
            style={navActionBtnStyle}
          >
            <Icons.ClipboardPlusOutline />
          </button>
        )}

        {/* Тумблер темы (Moon/Sun) */}
        <button
          onClick={toggleTheme}
          title={isDarkTheme ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={navActionBtnStyle}
        >
          <div
            style={{
              transition: 'transform 0.25s ease-out',
              transform: isDarkTheme ? 'rotate(0deg)' : 'rotate(-90deg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isDarkTheme ? <Icons.Moon /> : <Icons.Sun />}
          </div>
        </button>

        {/* Настройки */}
        <button
          onClick={openProfile}
          title="Settings"
          style={navActionBtnStyle}
        >
          <Icons.CogOutline />
        </button>
      </div>
    </div>
  );
};

// Стили, в точности повторяющие NavMenuButtonStyle из MainWindow.xaml
const getNavButtonStyle = (isActive: boolean): React.CSSProperties => ({
  height: 50,
  width: '100%',
  backgroundColor: isActive ? 'rgba(30, 155, 235, 0.1)' : 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  position: 'relative',
});

const activeBarIndicatorStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: 4,
  backgroundColor: '#1E9BEB',
  borderTopRightRadius: 2,
  borderBottomRightRadius: 2,
};

const unreadDotBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: -2,
  right: -4,
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: '#E74C3C', // UnreadBadgeBrush
};

const railDividerStyle: React.CSSProperties = {
  height: 2,
  backgroundColor: '#1C212D', // OtherBubbleBg
  margin: '15px 25px',
};

const navActionBtnStyle: React.CSSProperties = {
  width: '100%',
  height: 50,
  background: 'transparent',
  border: 'none',
  color: '#7D8494', // TextMuted
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  transition: 'color 0.15s ease',
};