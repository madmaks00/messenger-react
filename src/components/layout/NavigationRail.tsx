import React, { useState } from 'react';
import Icon from '@mdi/react';
import {
  mdiSendVariant,
  mdiChatOutline,
  mdiChat,
  mdiBookmarkOutline,
  mdiBookmark,
  mdiClipboardListOutline,
  mdiClipboardList,
  mdiGamepadVariantOutline,
  mdiGamepadVariant,
  mdiAccountSwitchOutline,
  mdiAccountSwitch,
  mdiPencilPlusOutline,
  mdiFolderPlusOutline,
  mdiFileDocumentPlusOutline,
  mdiClipboardPlusOutline,
  mdiWeatherNight,
  mdiWhiteBalanceSunny,
  mdiCogOutline,
  mdiPlus,
} from '@mdi/js';

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
        {/* 1. Статичный логотип SendVariant (-20° с подсветкой) */}
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
          <Icon path={mdiSendVariant} size="38px" />
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

          {/* Плюсик создания истории 20x20 */}
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
            <Icon path={mdiPlus} size="14px" />
          </button>
        </div>
      </div>

      {/* ================= ЦЕНТР: ВКЛАДКИ (50px) ================= */}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
        {/* 1. Чаты */}
        <div
          onClick={() => switchTab(MainTab.Chats)}
          onMouseEnter={() => setHoveredBtn('chats')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={getNavTabStyle(currentTab === MainTab.Chats)}
          title="Chats"
        >
          {currentTab === MainTab.Chats && <div style={activeBarIndicatorStyle} />}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: currentTab === MainTab.Chats ? '#1E9BEB' : hoveredBtn === 'chats' ? '#FFFFFF' : '#7D8494' }}>
              <Icon path={currentTab === MainTab.Chats ? mdiChat : mdiChatOutline} size="24px" />
            </span>
            {hasUnreadChats && <div style={unreadDotBadgeStyle} />}
          </div>
        </div>

        {/* Разделитель 2px */}
        <div style={railDividerStyle} />

        {/* 2. Заметки */}
        <div
          onClick={() => switchTab(MainTab.Notes)}
          onMouseEnter={() => setHoveredBtn('notes')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={getNavTabStyle(currentTab === MainTab.Notes)}
          title="Notes"
        >
          {currentTab === MainTab.Notes && <div style={activeBarIndicatorStyle} />}
          <span style={{ color: currentTab === MainTab.Notes ? '#1E9BEB' : hoveredBtn === 'notes' ? '#FFFFFF' : '#7D8494' }}>
            <Icon path={currentTab === MainTab.Notes ? mdiBookmark : mdiBookmarkOutline} size="24px" />
          </span>
        </div>

        {/* 3. Задачи */}
        <div
          onClick={() => switchTab(MainTab.Tasks)}
          onMouseEnter={() => setHoveredBtn('tasks')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={getNavTabStyle(currentTab === MainTab.Tasks)}
          title="Tasks"
        >
          {currentTab === MainTab.Tasks && <div style={activeBarIndicatorStyle} />}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: currentTab === MainTab.Tasks ? '#1E9BEB' : hoveredBtn === 'tasks' ? '#FFFFFF' : '#7D8494' }}>
              <Icon path={currentTab === MainTab.Tasks ? mdiClipboardList : mdiClipboardListOutline} size="24px" />
            </span>
            {hasDueTasks && <div style={unreadDotBadgeStyle} />}
          </div>
        </div>

        {/* 4. Игры */}
        <div
          onClick={() => switchTab(MainTab.Games)}
          onMouseEnter={() => setHoveredBtn('games')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={getNavTabStyle(currentTab === MainTab.Games)}
          title="Games"
        >
          {currentTab === MainTab.Games && <div style={activeBarIndicatorStyle} />}
          <span style={{ color: currentTab === MainTab.Games ? '#1E9BEB' : hoveredBtn === 'games' ? '#FFFFFF' : '#7D8494' }}>
            <Icon path={currentTab === MainTab.Games ? mdiGamepadVariant : mdiGamepadVariantOutline} size="24px" />
          </span>
        </div>

        {/* Разделитель 2px */}
        <div style={railDividerStyle} />

        {/* 5. Смена аккаунта */}
        <div
          onClick={() => switchTab(MainTab.AccountSwitch)}
          onMouseEnter={() => setHoveredBtn('acc')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={getNavTabStyle(currentTab === MainTab.AccountSwitch)}
          title="Switch Account"
        >
          {currentTab === MainTab.AccountSwitch && <div style={activeBarIndicatorStyle} />}
          <span style={{ color: currentTab === MainTab.AccountSwitch ? '#1E9BEB' : hoveredBtn === 'acc' ? '#FFFFFF' : '#7D8494' }}>
            <Icon path={currentTab === MainTab.AccountSwitch ? mdiAccountSwitch : mdiAccountSwitchOutline} size="24px" />
          </span>
        </div>
      </div>

      {/* ================= НИЗ: ДЕЙСТВИЯ (50px) ================= */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 20 }}>
        {/* Кнопка создания группы (Chats) */}
        {currentTab === MainTab.Chats && (
          <>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('OpenCreateGroupModal'))}
              title="Create Group"
              style={navActionBtnStyle}
            >
              <Icon path={mdiPencilPlusOutline} size="24px" />
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('OpenCreateFolderDialog'))}
              title="Create Folder"
              style={navActionBtnStyle}
            >
              <Icon path={mdiFolderPlusOutline} size="24px" />
            </button>
          </>
        )}

        {/* Кнопка создания заметки (Notes) */}
        {currentTab === MainTab.Notes && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('CreateNewNote'))}
            title="Create Note"
            style={navActionBtnStyle}
          >
            <Icon path={mdiFileDocumentPlusOutline} size="24px" />
          </button>
        )}

        {/* Кнопка создания списка задач (Tasks) */}
        {currentTab === MainTab.Tasks && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('CreateNewTaskList'))}
            title="Create Task List"
            style={navActionBtnStyle}
          >
            <Icon path={mdiClipboardPlusOutline} size="24px" />
          </button>
        )}

        {/* Переключатель темы (Moon / Sun с плавным переходом) */}
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
            <Icon path={isDarkTheme ? mdiWeatherNight : mdiWhiteBalanceSunny} size="24px" />
          </div>
        </button>

        {/* Настройки */}
        <button
          onClick={openProfile}
          title="Settings"
          style={navActionBtnStyle}
        >
          <Icon path={mdiCogOutline} size="24px" />
        </button>
      </div>
    </div>
  );
};

// Стили NavMenuButtonStyle
const getNavTabStyle = (isActive: boolean): React.CSSProperties => ({
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
  backgroundColor: '#E74C3C',
};

const railDividerStyle: React.CSSProperties = {
  height: 2,
  backgroundColor: '#1C212D',
  margin: '15px 25px',
};

const navActionBtnStyle: React.CSSProperties = {
  width: '100%',
  height: 50,
  background: 'transparent',
  border: 'none',
  color: '#7D8494',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  transition: 'color 0.15s ease',
};