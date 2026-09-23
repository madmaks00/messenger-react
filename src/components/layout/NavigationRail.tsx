import React, { useState } from 'react';
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
import { useNotesStore } from '../../stores/notesStore';
import { useTodoStore } from '../../stores/todoStore';
import { MainTab } from '../../types/enums';
import { getAvatarColor, normalizeAvatarUrl } from '../../utils/helpers';

interface MdiIconProps {
  path: string;
  size?: number | string;
  color?: string;
  style?: React.CSSProperties;
}

const Icon: React.FC<MdiIconProps> = ({ path, size = '24px', color = 'currentColor', style }) => {
  const pixelSize = typeof size === 'number' ? `${size}px` : size;
  return (
    <svg
      viewBox="0 0 24 24"
      width={pixelSize}
      height={pixelSize}
      fill={color}
      style={{ display: 'inline-block', flexShrink: 0, ...style }}
    >
      <path d={path} />
    </svg>
  );
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

  const avatarSrc = normalizeAvatarUrl(currentUser?.avatarPath || (currentUser as any)?.avatar);

  return (
    <div
      style={{
        width: 66,
        height: '100%',
        backgroundColor: '#0F1319',
        borderRight: '1px solid #1E232F',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        position: 'relative',
        zIndex: 50,
        boxSizing: 'border-box',
      }}
    >
      {/* ================= ВЕРХ ================= */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 20,
          flexShrink: 0,
        }}
      >
        {/* 1. Логотип SendVariant */}
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
            width: 38,
            height: 38,
          }}
        >
          <Icon path={mdiSendVariant} size="38px" />
        </div>

        {/* 2. Аватарка */}
        <div style={{ position: 'relative', width: 54, height: 54, marginBottom: 22 }}>
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
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: getAvatarColor(currentUser?.id || 0),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <span
                style={{
                  color: '#FFFFFF',
                  fontSize: 18,
                  fontWeight: 'bold',
                  userSelect: 'none',
                }}
              >
                {(currentUser?.nickName || currentUser?.username || 'U').charAt(0).toUpperCase()}
              </span>

              {avatarSrc && (
                <img
                  src={avatarSrc}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
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
          </div>

          {/* Плюсик на аватарке */}
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

      {/* ================= ЦЕНТР: ВКЛАДКИ ================= */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
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
            <span style={{ color: currentTab === MainTab.Chats ? '#1E9BEB' : hoveredBtn === 'chats' ? '#FFFFFF' : '#7D8494', transition: 'color 0.15s ease' }}>
              <Icon path={currentTab === MainTab.Chats ? mdiChat : mdiChatOutline} size="24px" />
            </span>
            {hasUnreadChats && <div style={unreadDotBadgeStyle} />}
          </div>
        </div>

        <div style={railDividerStyle} />

        {/* 2. Избранное / Заметки */}
        <div
          onClick={() => switchTab(MainTab.Notes)}
          onMouseEnter={() => setHoveredBtn('notes')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={getNavTabStyle(currentTab === MainTab.Notes)}
          title="Notes"
        >
          {currentTab === MainTab.Notes && <div style={activeBarIndicatorStyle} />}
          <span style={{ color: currentTab === MainTab.Notes ? '#1E9BEB' : hoveredBtn === 'notes' ? '#FFFFFF' : '#7D8494', transition: 'color 0.15s ease' }}>
            <Icon path={currentTab === MainTab.Notes ? mdiBookmark : mdiBookmarkOutline} size="24px" />
          </span>
        </div>

        {/* 3. Задачи (Tasks) */}
        <div
          onClick={() => switchTab(MainTab.Tasks)}
          onMouseEnter={() => setHoveredBtn('tasks')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={getNavTabStyle(currentTab === MainTab.Tasks)}
          title="Tasks"
        >
          {currentTab === MainTab.Tasks && <div style={activeBarIndicatorStyle} />}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: currentTab === MainTab.Tasks ? '#1E9BEB' : hoveredBtn === 'tasks' ? '#FFFFFF' : '#7D8494', transition: 'color 0.15s ease' }}>
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
          <span style={{ color: currentTab === MainTab.Games ? '#1E9BEB' : hoveredBtn === 'games' ? '#FFFFFF' : '#7D8494', transition: 'color 0.15s ease' }}>
            <Icon path={currentTab === MainTab.Games ? mdiGamepadVariant : mdiGamepadVariantOutline} size="24px" />
          </span>
        </div>

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
          <span style={{ color: currentTab === MainTab.AccountSwitch ? '#1E9BEB' : hoveredBtn === 'acc' ? '#FFFFFF' : '#7D8494', transition: 'color 0.15s ease' }}>
            <Icon path={currentTab === MainTab.AccountSwitch ? mdiAccountSwitch : mdiAccountSwitchOutline} size="24px" />
          </span>
        </div>
      </div>

      {/* ================= НИЗ: ДЕЙСТВИЯ С АНИМАЦИЕЙ ПОДСВЕТКИ ================= */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingBottom: 16, marginTop: 'auto', flexShrink: 0 }}>
        {currentTab === MainTab.Chats && (
          <>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('OpenCreateGroupModal'))}
              onMouseEnter={() => setHoveredBtn('create_group')}
              onMouseLeave={() => setHoveredBtn(null)}
              title="Create Group"
              style={getActionButtonStyle(hoveredBtn === 'create_group')}
            >
              <Icon path={mdiPencilPlusOutline} size="22px" />
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('OpenCreateFolderDialog'))}
              onMouseEnter={() => setHoveredBtn('create_folder')}
              onMouseLeave={() => setHoveredBtn(null)}
              title="Create Folder"
              style={getActionButtonStyle(hoveredBtn === 'create_folder')}
            >
              <Icon path={mdiFolderPlusOutline} size="22px" />
            </button>
          </>
        )}

        {/* 🟢 Вызов createNewNote() строго напрямую (без дублирования) */}
        {currentTab === MainTab.Notes && (
          <button
            onClick={() => useNotesStore.getState().createNewNote()}
            onMouseEnter={() => setHoveredBtn('create_note')}
            onMouseLeave={() => setHoveredBtn(null)}
            title="Create Note"
            style={getActionButtonStyle(hoveredBtn === 'create_note')}
          >
            <Icon path={mdiFileDocumentPlusOutline} size="22px" />
          </button>
        )}

        {currentTab === MainTab.Tasks && (
          <button
            onClick={() => useTodoStore.getState().createNewTaskList()}
            onMouseEnter={() => setHoveredBtn('create_task')}
            onMouseLeave={() => setHoveredBtn(null)}
            title="Create Task List"
            style={getActionButtonStyle(hoveredBtn === 'create_task')}
          >
            <Icon path={mdiClipboardPlusOutline} size="22px" />
          </button>
        )}

        {/* Переключатель темы */}
        <button
          onClick={toggleTheme}
          onMouseEnter={() => setHoveredBtn('theme')}
          onMouseLeave={() => setHoveredBtn(null)}
          title={isDarkTheme ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={getActionButtonStyle(hoveredBtn === 'theme')}
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
            <Icon path={isDarkTheme ? mdiWeatherNight : mdiWhiteBalanceSunny} size="22px" />
          </div>
        </button>

        {/* Настройки профиля */}
        <button
          onClick={openProfile}
          onMouseEnter={() => setHoveredBtn('settings')}
          onMouseLeave={() => setHoveredBtn(null)}
          title="Settings"
          style={getActionButtonStyle(hoveredBtn === 'settings')}
        >
          <Icon path={mdiCogOutline} size="22px" />
        </button>
      </div>
    </div>
  );
};

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
  borderRadius: 2,
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

// 🟢 Стиль нижней кнопки с подсветкой и эффектом ховера
const getActionButtonStyle = (isHovered: boolean): React.CSSProperties => ({
  width: 44,
  height: 44,
  borderRadius: 12,
  background: isHovered ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
  border: 'none',
  color: isHovered ? '#FFFFFF' : '#7D8494',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  transition: 'background-color 0.15s ease, color 0.15s ease, transform 0.1s ease',
  transform: isHovered ? 'scale(1.05)' : 'scale(1)',
  outline: 'none',
});

export default NavigationRail;