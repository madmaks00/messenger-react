import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  mdiChatOutline,
  mdiMagnify,
  mdiCloseCircle,
  mdiMessageTextOutline,
  mdiPinOutline,
  mdiPin,
  mdiBellOffOutline,
  mdiBellOutline,
  mdiFolderPlusOutline,
  mdiFolderOutline,
  mdiCheck,
  mdiBlockHelper,
  mdiBroom,
  mdiDeleteOutline,
  mdiAccountGroup,
  mdiBullhornOutline,
  mdiLock,
  mdiCamera,
  mdiVideo,
  mdiAnimation,
  mdiMicrophone,
  mdiMusic,
  mdiFileDocumentOutline,
  mdiPhone,
  mdiChevronRight,
} from '@mdi/js';

import { useSidebarChatsStore } from '../../stores/sidebarChatsStore';
import { useChatFolderStore, IChatFolder } from '../../stores/chatFolderStore';
import { useChatStore } from '../../stores/chatStore';
import { useSearchStore } from '../../stores/searchStore';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import { resolveMdiIcon } from '../../utils/iconResolver';
import { MessagePreviewHelper, getAvatarColor, normalizeAvatarUrl } from '../../utils/helpers';
import { IChatListItem, IUserSearchResult } from '../../types/models';
import { LastMessageType } from '../../types/enums';
import { chatService } from '../../services/chat.service';

const ITEM_HEIGHT = 68;
const CUBIC_EASE_OUT = 'cubic-bezier(0.215, 0.61, 0.355, 1)';

const MdiIcon: React.FC<{ path: string; size?: number; color?: string; style?: React.CSSProperties }> = ({
  path,
  size = 18,
  color = 'currentColor',
  style,
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={{ display: 'inline-block', flexShrink: 0, ...style }}>
    <path d={path} />
  </svg>
);

const getChatKey = (item: any) => {
  if (!item) return '';
  if (item.isSecretChat) return `s_${item.secretChatId || item.id}`;
  if (item.isGroup) return `g_${item.groupId || item.id}`;
  return `u_${item.userId || item.id}`;
};

export const SidebarChatsView: React.FC = () => {
  const { allChats, openChat, togglePinChat, toggleMuteChat, deleteChat, clearChatHistory, selectedChatUser } = useSidebarChatsStore();
  const { chatFolders, selectedFolderId, selectFolder, toggleChatInFolder } = useChatFolderStore();
  const { isChatSearchMode, exitSearch } = useChatStore();

  const {
    searchText,
    isSearching,
    recentUsers,
    foundUsers,
    foundMessages,
    setSearchText,
    selectUser,
    clearRecentSearches,
    jumpToMessage,
  } = useSearchStore();

  const [isSearchInputFocused, setIsSearchInputFocused] = useState(false);
  const [hoveredChatKey, setHoveredChatKey] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; chat: IChatListItem } | null>(null);
  const [isFolderSubmenuOpen, setIsFolderSubmenuOpen] = useState(false);

  // Состояние оверлейного скроллбара
  const [isListHovered, setIsListHovered] = useState(false);
  const [isScrollDragging, setIsScrollDragging] = useState(false);
  const [isThumbHovered, setIsThumbHovered] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { containerRef } = useSmoothScroll<HTMLDivElement>({ friction: 0.78, wheelMultiplier: 0.15 });
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  const isSearchActive = isSearchInputFocused || searchText.length > 0;
  const hasFolders = chatFolders && chatFolders.length > 1;

  // Динамический замер высоты контейнера для точного позиционирования ползунка
  useEffect(() => {
    const updateViewport = () => {
      if (containerRef.current) {
        setViewportHeight(containerRef.current.clientHeight);
      }
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, [containerRef]);

  const handleCloseSearch = () => {
    setSearchText('');
    setIsSearchInputFocused(false);
    exitSearch();
    if (searchInputRef.current) searchInputRef.current.blur();
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        if (!searchText.trim()) handleCloseSearch();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [searchText]);

  const filteredChats = useMemo(() => {
    let result = allChats;
    if (selectedFolderId && selectedFolderId > 0) {
      const currentFolder = chatFolders.find((f) => f.id === selectedFolderId);
      if (currentFolder) {
        result = result.filter((c) => {
          const id = c.isGroup ? c.groupId : c.userId;
          return id && currentFolder.includedChatIds?.includes(id);
        });
      }
    }
    return result;
  }, [allChats, selectedFolderId, chatFolders]);

  const totalHeight = filteredChats.length * ITEM_HEIGHT;
  const firstIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 2);
  const lastIndex = Math.min(filteredChats.length - 1, Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + 2);
  const visibleChats = filteredChats.slice(firstIndex, lastIndex + 1);

  // Расчет плавающего ползунка (1 в 1 с WPF ScrollViewer)
  const isScrollable = totalHeight > viewportHeight;
  const thumbHeight = useMemo(() => {
    if (!isScrollable || viewportHeight <= 0) return 0;
    return Math.max(25, (viewportHeight / totalHeight) * viewportHeight);
  }, [isScrollable, viewportHeight, totalHeight]);

  const thumbTop = useMemo(() => {
    if (!isScrollable || totalHeight <= viewportHeight) return 0;
    const maxScroll = totalHeight - viewportHeight;
    const maxThumbTravel = viewportHeight - thumbHeight;
    return (scrollTop / maxScroll) * maxThumbTravel;
  }, [isScrollable, totalHeight, viewportHeight, thumbHeight, scrollTop]);

  // Перетаскивание кастомного ползунка мышкой
  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsScrollDragging(true);

    const startY = e.clientY;
    const startScrollTop = scrollTop;
    const scrollableRange = totalHeight - viewportHeight;
    const thumbTravelRange = viewportHeight - thumbHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (thumbTravelRange <= 0) return;
      const deltaY = moveEvent.clientY - startY;
      const scrollDelta = (deltaY / thumbTravelRange) * scrollableRange;
      if (containerRef.current) {
        containerRef.current.scrollTop = Math.max(0, Math.min(scrollableRange, startScrollTop + scrollDelta));
      }
    };

    const onMouseUp = () => {
      setIsScrollDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const getLastMessageIcon = (type: LastMessageType | undefined) => {
    switch (type) {
      case LastMessageType.Photo: return mdiCamera;
      case LastMessageType.Video: return mdiVideo;
      case LastMessageType.Gif: return mdiAnimation;
      case LastMessageType.Voice: return mdiMicrophone;
      case LastMessageType.Audio: return mdiMusic;
      case LastMessageType.Document: return mdiFileDocumentOutline;
      case LastMessageType.Call: return mdiPhone;
      default: return null;
    }
  };

  return (
    <div
      ref={searchContainerRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--bg-list)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* ================= РЯД 0: ШАПКА "Chats" ================= */}
      <div
        style={{
          height: 42,
          margin: '12px 6px 8px 15px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transform: isSearchActive ? 'translateY(-20px)' : 'translateY(0)',
          opacity: isSearchActive ? 0 : 1,
          transition: isSearchActive
            ? `transform 200ms ${CUBIC_EASE_OUT}, opacity 150ms ease-out`
            : `transform 220ms ${CUBIC_EASE_OUT}, opacity 180ms ease-out`,
          pointerEvents: isSearchActive ? 'none' : 'auto',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <MdiIcon path={mdiChatOutline} size={26} color="#FFFFFF" style={{ marginRight: 9 }} />
          <span style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.2px', lineHeight: 1 }}>Chats</span>
        </div>
      </div>

      {/* ================= РЯД 1: СТРОКА ПОИСКА (Height="40", CornerRadius="12", Padding="0,12") ================= */}
      <div
        style={{
          margin: hasFolders ? '0 6px 2px 6px' : '0 6px 8px 6px',
          zIndex: 15,
          transform: isSearchActive ? 'translateY(-52px)' : 'translateY(0)',
          transition: isSearchActive ? `transform 250ms ${CUBIC_EASE_OUT}` : `transform 220ms ${CUBIC_EASE_OUT}`,
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            height: 34,
            backgroundColor: isSearchInputFocused ? 'var(--sidebar-search-focus-bg)' : 'var(--sidebar-search-bg)',
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            border: '1.2px solid transparent',
            boxSizing: 'border-box',
            transition: 'background-color 0.15s ease',
          }}
        >
          <MdiIcon path={mdiMagnify} size={18} color="#8E95A5" style={{ marginRight: 10 }} />

          <input
            ref={searchInputRef}
            type="text"
            placeholder={isChatSearchMode ? 'Search in messages...' : 'Search Chat'}
            value={searchText}
            onFocus={() => setIsSearchInputFocused(true)}
            onBlur={() => setIsSearchInputFocused(false)}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && handleCloseSearch()}
            className="wpf-search-input"
            style={{
              flex: 1,
              minWidth: 0,
              width: '100%',
              height: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#FFFFFF',
              fontSize: 14,
              padding: 0,
              margin: 0,
              fontFamily: "'Segoe UI', -apple-system, sans-serif",
            }}
          />

          {isSearchActive && (
            <button
              onClick={handleCloseSearch}
              style={{
                width: 24,
                height: 24,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginLeft: 4,
              }}
            >
              <MdiIcon path={mdiCloseCircle} size={18} color="#8E95A5" />
            </button>
          )}
        </div>
      </div>

      {/* ================= РЯД 2: ПАПКИ ЧАТОВ ================= */}
      {hasFolders && (
        <div
          style={{
            height: 45,
            minHeight: 45,
            display: 'flex',
            alignItems: 'center',
            padding: '5px 10px 0 10px',
            marginBottom: 4,
            opacity: isSearchActive ? 0 : 1,
            pointerEvents: isSearchActive ? 'none' : 'auto',
            transition: isSearchActive ? 'opacity 150ms ease-out' : 'opacity 200ms ease-out',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          {chatFolders.map((folder: IChatFolder) => {
            const isSelected = selectedFolderId === folder.id;
            const folderIconPath = resolveMdiIcon(folder.icon, mdiFolderOutline);

            return (
              <div
                key={folder.id}
                onClick={() => selectFolder(folder.id)}
                style={{
                  position: 'relative',
                  height: 35,
                  padding: folder.isSystem ? '0 12px' : '0 12px 0 6px',
                  marginRight: 4,
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: isSelected ? '#FFFFFF' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxSizing: 'border-box',
                }}
              >
                {!folder.isSystem && (
                  <MdiIcon path={folderIconPath} size={16} color={folder.color || '#FFFFFF'} style={{ opacity: isSelected ? 1 : 0.6 }} />
                )}
                <span>{folder.name}</span>
                {isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 3,
                      borderRadius: 1.5,
                      backgroundColor: folder.isSystem ? '#FFFFFF' : folder.color || '#FFFFFF',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ================= РЯД 3: СПИСОК ЧАТОВ + ОВЕРЛЕЙНЫЙ СКРОЛЛБАР ================= */}
      <div
        onMouseEnter={() => setIsListHovered(true)}
        onMouseLeave={() => setIsListHovered(false)}
        style={{
          flex: 1,
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          opacity: isSearchActive ? 0 : 1,
          pointerEvents: isSearchActive ? 'none' : 'auto',
          transition: isSearchActive ? 'opacity 150ms ease-out' : 'opacity 200ms ease-out',
        }}
      >
        {/* Контейнер скролла со скрытой нативной полосой */}
        <div
          ref={containerRef}
          className="wpf-scroll-viewer"
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          style={{
            width: '100%',
            height: '100%',
            overflowY: 'auto',
          }}
        >
          {filteredChats.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '140px 20px 0 20px' }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: 'var(--sidebar-search-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 15,
                }}
              >
                <MdiIcon path={mdiMessageTextOutline} size={40} color="var(--text-muted)" style={{ opacity: 0.5 }} />
              </div>
              <span style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>No Chats</span>
            </div>
          ) : (
            <div style={{ height: `${totalHeight}px`, position: 'relative', width: '100%' }}>
              {visibleChats.map((chat, idx) => {
                const actualIndex = firstIndex + idx;
                const topOffset = actualIndex * ITEM_HEIGHT;
                const key = getChatKey(chat);
                const isSelected = Boolean(
  selectedChatUser &&
  Boolean(chat.isGroup) === Boolean(selectedChatUser.isGroup) &&
  Boolean(chat.isSecretChat) === Boolean(selectedChatUser.isSecretChat) &&
  (chat.isSecretChat
    ? (chat.secretChatId || chat.id) === (selectedChatUser.secretChatId || selectedChatUser.id)
    : (chat.isGroup ? chat.groupId : chat.userId) === selectedChatUser.id)
);
                const isHovered = hoveredChatKey === key;

                const rawText = chat.lastMessage || (chat as any).rawLastMessage || '';
                const [preview, computedMsgType] = MessagePreviewHelper.formatPreview(
                  rawText,
                  (chat as any).lastAttachmentType ?? chat.lastMessageType,
                  (chat as any).lastMessageSenderId ?? chat.userId,
                  0,
                  chat.isLastMessageDeletedForMe,
                  chat.isGroup,
                  chat.isChannel,
                  (chat as any).isLastAttachmentGif
                );

                const msgIcon = getLastMessageIcon(chat.lastMessageType || computedMsgType);
                const avatarRaw = chat.avatarPath || (chat as any).avatar;
                const chatAvatarSrc = normalizeAvatarUrl(avatarRaw);

                return (
                  <div
                    key={key}
                    onClick={() => openChat(chat)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setIsFolderSubmenuOpen(false);
                      setContextMenu({ x: e.clientX, y: e.clientY, chat });
                    }}
                    onMouseEnter={() => setHoveredChatKey(key)}
                    onMouseLeave={() => setHoveredChatKey(null)}
                    style={{
                      position: 'absolute',
                      top: `${topOffset}px`,
                      left: 8,
                      right: 8, // 🟢 Фиксировано: 8px слева, 8px справа
                      height: `${ITEM_HEIGHT}px`,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 15px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'var(--chat-item-active)' : isHovered ? 'var(--chat-item-hover)' : 'transparent',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Аватар 46x46 */}
                    <div style={{ position: 'relative', width: 46, height: 46, marginRight: 12, flexShrink: 0 }}>
                      <div
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 23,
                          backgroundColor: getAvatarColor(chat.isGroup ? chat.groupId || 0 : chat.userId || 0),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFFFFF',
                          fontWeight: 600,
                          fontSize: 16,
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        <span>{((chat.isGroup ? chat.groupName : chat.nickName) || 'U').charAt(0).toUpperCase()}</span>

                        {chatAvatarSrc && (
                          <img
                            src={chatAvatarSrc}
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

                      {chat.isOnline && !chat.isGroup && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: '#4CAF50',
                            border: '2px solid var(--sidebar-search-bg)',
                          }}
                        />
                      )}

                      {chat.isGroup && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: -3,
                            right: -3,
                            width: 20,
                            height: 20,
                            borderRadius: 9,
                            backgroundColor: 'var(--app-accent)',
                            border: '2px solid var(--sidebar-search-bg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFFFFF',
                          }}
                        >
                          <MdiIcon path={chat.isChannel ? mdiBullhornOutline : mdiAccountGroup} size={12} color="#FFFFFF" />
                        </div>
                      )}
                    </div>

                    {/* Текстовая информация */}
                    <div style={{ flex: 1, minWidth: 0, marginRight: 10, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                        {chat.isSecretChat && <MdiIcon path={mdiLock} size={15} color="#FFFFFF" />}
                        <span
                          style={{
                            color: '#FFFFFF',
                            fontSize: 15,
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {chat.isGroup ? chat.groupName : chat.nickName}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {msgIcon && <MdiIcon path={msgIcon} size={14} color="var(--text-muted)" />}
                        <span
                          style={{
                            color: 'var(--text-muted)',
                            fontSize: 13,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            lineHeight: '1.2',
                          }}
                        >
                          {chat.isTyping ? <span style={{ color: 'var(--app-accent)' }}>typing...</span> : (preview || rawText || '')}
                        </span>
                      </div>
                    </div>

                    {/* Время и бейдж */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {chat.isMuted && <MdiIcon path={mdiBellOffOutline} size={14} color="var(--text-muted)" />}
                        {chat.isPinned && <MdiIcon path={mdiPin} size={14} color="var(--text-muted)" style={{ transform: 'rotate(45deg)' }} />}
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                          {chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>

                      {chat.unreadCount > 0 && (
                        <div
                          style={{
                            marginTop: 5,
                            backgroundColor: chat.isMuted ? '#6C757D' : 'var(--app-accent)',
                            color: '#FFFFFF',
                            borderRadius: 10,
                            minWidth: 20,
                            height: 20,
                            padding: '0 5px',
                            fontSize: 11,
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {chat.unreadCount}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 🟢 НАСТОЯЩИЙ ПЛАВАЮЩИЙ СКРОЛЛБАР ИЗ WPF App.xaml (HorizontalAlignment="Right", Width="4", Opacity 0 -> 1) */}
        {isScrollable && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 2,
              bottom: 0,
              width: 4,
              zIndex: 30,
              pointerEvents: isListHovered || isScrollDragging ? 'auto' : 'none',
            }}
          >
            <div
              onMouseDown={handleThumbMouseDown}
              onMouseEnter={() => setIsThumbHovered(true)}
              onMouseLeave={() => setIsThumbHovered(false)}
              style={{
                position: 'absolute',
                top: `${thumbTop}px`,
                right: 0,
                width: 4,
                height: `${thumbHeight}px`,
                borderRadius: 3,
                backgroundColor: isScrollDragging
                  ? 'rgba(255, 255, 255, 0.6)' // WPF: #99FFFFFF при перетаскивании
                  : isThumbHovered
                  ? 'rgba(255, 255, 255, 0.4)' // WPF: #66FFFFFF при наведении на ползунок
                  : 'rgba(255, 255, 255, 0.3)', // WPF: #4DFFFFFF в покое
                opacity: isListHovered || isScrollDragging ? 1 : 0,
                transition: isScrollDragging ? 'none' : 'opacity 0.2s ease, background-color 0.15s ease',
                cursor: 'pointer',
              }}
            />
          </div>
        )}
      </div>

      {/* ================= РЕЗУЛЬТАТЫ ПОИСКА ================= */}
      <div
        className="wpf-scroll-viewer"
        style={{
          position: 'absolute',
          top: 52,
          left: 0,
          right: 0,
          bottom: 0,
          padding: '0 12px',
          zIndex: 10,
          opacity: isSearchActive ? 1 : 0,
          transform: isSearchActive ? 'translateY(0)' : 'translateY(15px)',
          pointerEvents: isSearchActive ? 'auto' : 'none',
          visibility: isSearchActive ? 'visible' : 'hidden',
          transition: isSearchActive
            ? `opacity 200ms ease-out, transform 200ms ${CUBIC_EASE_OUT}`
            : 'opacity 120ms ease-out, transform 120ms ease-in, visibility 0ms 120ms',
        }}
      >
        {searchText.trim().length === 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 5px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 600 }}>Recent Searches</span>
              {recentUsers && recentUsers.length > 0 && (
                <button
                  onClick={clearRecentSearches}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {!recentUsers || recentUsers.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', margin: '20px 0' }}>
                No recent searches
              </div>
            ) : (
              recentUsers.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  onSelect={() => {
                    selectUser?.(user);
                    handleCloseSearch();
                  }}
                />
              ))
            )}
          </div>
        )}

        {searchText.trim().length > 0 && (
          <div style={{ marginTop: 6 }}>
            {isSearching ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '40px 0' }}>
                <div style={{ color: 'var(--app-accent)', fontSize: 15, fontWeight: 600 }}>Searching...</div>
              </div>
            ) : (
              <>
                <div style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, margin: '5px 0 12px 5px' }}>
                  Global Search
                </div>

                {(!foundUsers || foundUsers.length === 0) && (!foundMessages || foundMessages.length === 0) ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', margin: '40px 0' }}>
                    No results found
                  </div>
                ) : (
                  foundUsers?.map((user) => (
                    <UserCard
                      key={user.id}
                      user={user}
                      onSelect={() => {
                        selectUser?.(user);
                        handleCloseSearch();
                      }}
                    />
                  ))
                )}

                {foundMessages && foundMessages.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, margin: '5px 0 12px 5px' }}>
                      Messages
                    </div>
                    {foundMessages.map((msg: any) => (
                      <div
                        key={msg.id || msg.serverId}
                        onClick={() => {
                          jumpToMessage?.(msg);
                          handleCloseSearch();
                        }}
                        style={{
                          padding: '10px 12px',
                          marginBottom: 8,
                          backgroundColor: 'var(--sidebar-search-bg)',
                          borderRadius: 12,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 600 }}>{msg.senderName || 'Chat'}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>
                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ================= КОНТЕКСТНОЕ МЕНЮ ЧАТА ================= */}
      {contextMenu && (
        <div onClick={() => setContextMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              backgroundColor: 'var(--context-menu-bg)',
              border: '1px solid var(--context-menu-border)',
              borderRadius: 12,
              padding: '2px 0',
              minWidth: 220,
              boxShadow: '0 2px 15px rgba(0, 0, 0, 0.25)',
              zIndex: 1001,
            }}
          >
            <ContextRow
              icon={mdiPinOutline}
              rotate={45}
              text={contextMenu.chat.isPinned ? 'Unpin' : 'Pin'}
              onClick={() => {
                togglePinChat(contextMenu.chat, chatService);
                setContextMenu(null);
              }}
            />

            <ContextRow
              icon={contextMenu.chat.isMuted ? mdiBellOutline : mdiBellOffOutline}
              text={contextMenu.chat.isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
              onClick={() => {
                toggleMuteChat(contextMenu.chat, chatService);
                setContextMenu(null);
              }}
            />

            <div
              style={{ position: 'relative' }}
              onMouseEnter={() => setIsFolderSubmenuOpen(true)}
              onMouseLeave={() => setIsFolderSubmenuOpen(false)}
            >
              <ContextRow icon={mdiFolderPlusOutline} text="Add to folder" hasChevron />

              {isFolderSubmenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    left: '100%',
                    top: -4,
                    marginLeft: -4,
                    backgroundColor: 'var(--context-menu-bg)',
                    border: '1px solid var(--context-menu-border)',
                    borderRadius: 12,
                    padding: '2px 0',
                    minWidth: 180,
                    boxShadow: '0 2px 15px rgba(0, 0, 0, 0.25)',
                  }}
                >
                  {chatFolders.filter((f) => !f.isSystem).map((folder) => {
                    const isInFolder = folder.includedChatIds?.includes(contextMenu.chat.userId || contextMenu.chat.groupId || 0);
                    const folderIcon = resolveMdiIcon(folder.icon, mdiFolderOutline);

                    return (
                      <ContextRow
                        key={folder.id}
                        icon={folderIcon}
                        iconColor={folder.color}
                        text={folder.name}
                        checkMark={isInFolder}
                        onClick={async () => {
                          await toggleChatInFolder?.(folder.id, contextMenu.chat);
                          setContextMenu(null);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ height: 1, backgroundColor: 'var(--context-menu-border)', margin: '4px 0' }} />

            <ContextRow
              icon={mdiBroom}
              text="Clear History"
              onClick={() => {
                clearChatHistory(contextMenu.chat, chatService, false);
                setContextMenu(null);
              }}
            />

            <ContextRow
              icon={mdiDeleteOutline}
              text="Delete Chat"
              isDestructive
              onClick={() => {
                deleteChat(contextMenu.chat, chatService);
                setContextMenu(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const UserCard: React.FC<{ user: IUserSearchResult; onSelect: () => void }> = ({ user, onSelect }) => {
  const [isHovered, setIsHovered] = useState(false);
  const avatarSrc = normalizeAvatarUrl(user.avatarPath || (user as any).avatar);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '6px 10px',
        marginBottom: 8,
        backgroundColor: isHovered ? 'var(--chat-item-active)' : 'var(--sidebar-search-bg)',
        borderRadius: 12,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'background-color 0.15s ease',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: getAvatarColor(user.id),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          fontWeight: 'bold',
          fontSize: 16,
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <span>{(user.nickName || user.username || 'U').charAt(0).toUpperCase()}</span>
        {avatarSrc && (
          <img
            src={avatarSrc}
            alt=""
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.nickName || 'User'}
        </div>
        {user.username && (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            @{user.username.replace(/^@/, '')}
          </div>
        )}
      </div>
    </div>
  );
};

const ContextRow: React.FC<{
  icon: string;
  text: string;
  rotate?: number;
  iconColor?: string;
  isDestructive?: boolean;
  hasChevron?: boolean;
  checkMark?: boolean;
  onClick?: () => void;
}> = ({ icon, text, rotate, iconColor, isDestructive, hasChevron, checkMark, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '8px 10px 8px 15px',
        borderRadius: 6,
        fontSize: 14,
        cursor: 'pointer',
        color: isDestructive ? 'var(--destructive-action)' : '#FFFFFF',
        backgroundColor: isHovered ? 'var(--context-menu-hover)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'background-color 0.1s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {checkMark !== undefined && (
          <div style={{ width: 18, display: 'flex', alignItems: 'center' }}>
            {checkMark && <MdiIcon path={mdiCheck} size={18} color="var(--app-accent)" />}
          </div>
        )}
        <MdiIcon
          path={icon}
          size={18}
          color={isDestructive ? 'var(--destructive-action)' : iconColor || '#FFFFFF'}
          style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
        />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
      </div>

      {hasChevron && <MdiIcon path={mdiChevronRight} size={18} color="var(--text-muted)" style={{ marginLeft: 15 }} />}
    </div>
  );
};

export default SidebarChatsView;