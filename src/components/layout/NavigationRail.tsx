import React from 'react';
import { useNavigationStore } from '../../stores/navigationStore';
import { useAuthStore } from '../../stores/authStore';
import { MainTab } from '../../types/enums';

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

  return (
    <div
      style={{
        width: 66,
        height: '100%',
        backgroundColor: '#0E1621',
        borderRight: '1px solid #17212B',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        userSelect: 'none',
        zIndex: 50,
      }}
    >
      {/* ================= ВЕРХ ================= */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 20 }}>
        {/* 1. Статичный логотип под углом -20° */}
        <div
          style={{
            fontSize: 28,
            color: 'var(--app-accent, #3B82F6)',
            transform: 'rotate(-20deg)',
            filter: 'drop-shadow(0 0 12px rgba(59, 130, 246, 0.45))',
            marginBottom: 24,
            cursor: 'default',
          }}
        >
          ➤
        </div>

        {/* 2. Аватарка пользователя с кнопкой создания истории */}
        <div style={{ position: 'relative', width: 54, height: 54 }}>
          <div
            onClick={openProfile}
            title="Open Profile"
            style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              border: '2px solid var(--app-accent, #3B82F6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
              backgroundColor: '#1E2330',
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
                  backgroundColor: '#2563EB',
                  color: '#FFF',
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

          {/* Плюсик создания истории */}
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
              backgroundColor: 'var(--app-accent, #3B82F6)',
              border: '2px solid #0E1621',
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* ================= ЦЕНТР: ВКЛАДКИ ================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 0' }}>
        {/* 1. Чаты */}
        <button
          onClick={() => switchTab(MainTab.Chats)}
          style={getNavTabStyle(currentTab === MainTab.Chats)}
          title="Chats"
        >
          {currentTab === MainTab.Chats && <div style={activeIndicatorStyle} />}
          <div style={{ position: 'relative' }}>
            <span style={{ fontSize: 20 }}>💬</span>
            {hasUnreadChats && <div style={unreadBadgeDotStyle} />}
          </div>
        </button>

        <div style={{ height: 2, backgroundColor: 'rgba(255, 255, 255, 0.06)', margin: '12px 20px' }} />

        {/* 2. Заметки */}
        <button
          onClick={() => switchTab(MainTab.Notes)}
          style={getNavTabStyle(currentTab === MainTab.Notes)}
          title="Saved Notes"
        >
          {currentTab === MainTab.Notes && <div style={activeIndicatorStyle} />}
          <span style={{ fontSize: 20 }}>🔖</span>
        </button>

        {/* 3. Задачи (Tasks) */}
        <button
          onClick={() => switchTab(MainTab.Tasks)}
          style={getNavTabStyle(currentTab === MainTab.Tasks)}
          title="Tasks"
        >
          {currentTab === MainTab.Tasks && <div style={activeIndicatorStyle} />}
          <div style={{ position: 'relative' }}>
            <span style={{ fontSize: 20 }}>📋</span>
            {hasDueTasks && <div style={unreadBadgeDotStyle} />}
          </div>
        </button>

        {/* 4. Игры */}
        <button
          onClick={() => switchTab(MainTab.Games)}
          style={getNavTabStyle(currentTab === MainTab.Games)}
          title="Games"
        >
          {currentTab === MainTab.Games && <div style={activeIndicatorStyle} />}
          <span style={{ fontSize: 20 }}>🎮</span>
        </button>

        <div style={{ height: 2, backgroundColor: 'rgba(255, 255, 255, 0.06)', margin: '12px 20px' }} />

        {/* 5. Смена аккаунта */}
        <button
          onClick={() => switchTab(MainTab.AccountSwitch)}
          style={getNavTabStyle(currentTab === MainTab.AccountSwitch)}
          title="Switch Account"
        >
          {currentTab === MainTab.AccountSwitch && <div style={activeIndicatorStyle} />}
          <span style={{ fontSize: 20 }}>👥</span>
        </button>
      </div>

      {/* ================= НИЗ: ДЕЙСТВИЯ, ТЕМА И НАСТРОЙКИ ================= */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 16, gap: 4 }}>
        {/* Кнопки контекстных действий для текущей вкладки */}
        {currentTab === MainTab.Chats && (
          <>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('OpenCreateGroupModal'))}
              title="Create Group"
              style={navActionBtnStyle}
            >
              ✏️
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('OpenCreateFolderDialog'))}
              title="Create Folder"
              style={navActionBtnStyle}
            >
              📁
            </button>
          </>
        )}

        {currentTab === MainTab.Notes && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('CreateNewNote'))}
            title="Create Note"
            style={navActionBtnStyle}
          >
            📝
          </button>
        )}

        {currentTab === MainTab.Tasks && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('CreateNewTaskList'))}
            title="Create Task List"
            style={navActionBtnStyle}
          >
            📑
          </button>
        )}

        {/* Тумблер темы Луна/Солнце с поворотом на 90 градусов */}
        <button
          onClick={toggleTheme}
          title={isDarkTheme ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={navActionBtnStyle}
        >
          <div
            style={{
              transition: 'transform 0.3s cubic-bezier(0, 0, 0.2, 1)',
              transform: isDarkTheme ? 'rotate(0deg)' : 'rotate(90deg)',
              fontSize: 18,
            }}
          >
            {isDarkTheme ? '🌙' : '☀️'}
          </div>
        </button>

        {/* Кнопка настроек */}
        <button
          onClick={openProfile}
          title="Settings"
          style={navActionBtnStyle}
        >
          ⚙️
        </button>
      </div>
    </div>
  );
};

// Стили
const getNavTabStyle = (isActive: boolean): React.CSSProperties => ({
  height: 50,
  width: '100%',
  background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  position: 'relative',
  color: isActive ? 'var(--app-accent, #3B82F6)' : '#8696A0',
  transition: 'background 0.15s, color 0.15s',
});

const activeIndicatorStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: 4,
  backgroundColor: 'var(--app-accent, #3B82F6)',
  borderTopRightRadius: 2,
  borderBottomRightRadius: 2,
};

const unreadBadgeDotStyle: React.CSSProperties = {
  position: 'absolute',
  top: -2,
  right: -4,
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: '#EF4444',
  border: '1px solid #0E1621',
};

const navActionBtnStyle: React.CSSProperties = {
  width: 46,
  height: 46,
  background: 'transparent',
  border: 'none',
  color: '#8696A0',
  fontSize: 18,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 8,
};