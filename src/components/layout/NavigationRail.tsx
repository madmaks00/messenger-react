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
import { MainTab } from '../../types/enums';
import { BASE_SERVER_URL } from '../../services/apiClient';

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

// Конвертер цвета аватарки точно из WPF AvatarColorConverter
const AVATAR_COLORS = ['#E17076', '#7BC862', '#65AADD', '#A695E7', '#EE7AE9', '#6EC9CB', '#FAA774'];
const getAvatarColor = (id: number = 0) => AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];

// ✅ СТАЛО: умная функция, которая понимает и серверный URL, и чистый Base64 из C#
const normalizeAvatarUrl = (url?: string | null) => {
  if (!url) return null;
  // Если уже готовая data-ссылка или web-ссылка
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Если это чистый Base64 из C# (начинается с характерных заголовков JPEG/PNG или длинная строка)
  if (url.startsWith('/9j/') || url.startsWith('iVBOR') || url.startsWith('R0lGOD') || url.length > 200) {
    return `data:image/jpeg;base64,${url}`;
  }
  // Если это относительный путь с сервера (/uploads/...)
  return `${BASE_SERVER_URL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
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

  const avatarSrc = normalizeAvatarUrl(currentUser?.avatar || currentUser?.avatarPath);

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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 20, flexShrink: 0 }}>
        {/* Логотип SendVariant */}
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

        {/* Аватарка: 54x54 круглая рамка #1E9BEB */}
        <div style={{ position: 'relative', width: 54, height: 54 }}>
          <div
            onClick={openProfile}
            title="Open Profile"
            style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              border: '2px solid #1E9BEB',
              backgroundColor: getAvatarColor(currentUser?.id || 0),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
              position: 'relative',
              boxSizing: 'border-box',
            }}
          >
            {/* Слой 1: Инициалы пользователя (всегда под фото, как в WPF) */}
            <div
              style={{
                color: '#FFFFFF',
                fontSize: 18,
                fontWeight: 'bold',
                userSelect: 'none',
              }}
            >
              {(currentUser?.nickName || currentUser?.username || 'U').charAt(0).toUpperCase()}
            </div>

            {/* Слой 2: Фото пользователя (скрывается при 404, не ломая интерфейс) */}
            {avatarSrc && (
              <img
                src={avatarSrc}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  borderRadius: 27,
                  objectFit: 'cover',
                }}
              />
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

      {/* ================= ЦЕНТР: ВКЛАДКИ ================= */}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10, flex: 1 }}>
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

        <div style={railDividerStyle} />

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

        <div style={railDividerStyle} />

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

      {/* ================= НИЗ: ДЕЙСТВИЯ ================= */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 20, marginTop: 'auto', flexShrink: 0 }}>
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

        {currentTab === MainTab.Notes && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('CreateNewNote'))}
            title="Create Note"
            style={navActionBtnStyle}
          >
            <Icon path={mdiFileDocumentPlusOutline} size="24px" />
          </button>
        )}

        {currentTab === MainTab.Tasks && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('CreateNewTaskList'))}
            title="Create Task List"
            style={navActionBtnStyle}
          >
            <Icon path={mdiClipboardPlusOutline} size="24px" />
          </button>
        )}

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