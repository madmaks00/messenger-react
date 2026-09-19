import React, { useState, useRef, useMemo, useEffect } from 'react';
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
import { MessagePreviewHelper } from '../../utils/helpers';
import { IChatListItem, IUserSearchResult } from '../../types/models';
import { LastMessageType } from '../../types/enums';
import { chatService } from '../../services/chat.service';
import { BASE_SERVER_URL } from '../../services/apiClient';

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

const AVATAR_COLORS = ['#E17076', '#7BC862', '#65AADD', '#A695E7', '#EE7AE9', '#6EC9CB', '#FAA774'];
const getAvatarColor = (id: number = 0) => AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];

// 🟢 Поддержка Base64, Blob, относительных и абсолютных ссылок с сервера
const normalizeAvatarUrl = (url?: string | null): string | null => {
  if (!url) return null;

  // Если уже готовый data-uri или blob
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  // Если полный внешний URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Если это Base64 из C# byte[]
  if (
    url.startsWith('/9j/') ||
    url.startsWith('iVBOR') ||
    url.startsWith('R0lGOD') ||
    url.startsWith('PHN2Zy') ||
    url.length > 200
  ) {
    return `data:image/jpeg;base64,${url}`;
  }

  // Относительный путь к файлу на бэкенде
  return `${BASE_SERVER_URL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
};

const getChatKey = (item: IChatListItem) => {
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

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { containerRef } = useSmoothScroll<HTMLDivElement>({ friction: 0.78, wheelMultiplier: 0.15 });
  const [scrollTop, setScrollTop] = useState(0);

  const isSearchActive = isSearchInputFocused || searchText.length > 0;

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
  const viewportHeight = 650;
  const firstIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 2);
  const lastIndex = Math.min(filteredChats.length - 1, Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + 2);
  const visibleChats = filteredChats.slice(firstIndex, lastIndex + 1);

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
        width: 340,
        height: '100%',
        backgroundColor: 'var(--bg-list)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* РЯД 0: ШАПКА "Chats" */}
      <div
        style={{
          height: 46,
          margin: '7px 6px 5px 15px',
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
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <MdiIcon path={mdiChatOutline} size={28} color="#FFFFFF" style={{ marginRight: 10 }} />
          <span style={{ fontSize: 25, fontWeight: 800, color: '#FFFFFF' }}>Chats</span>
        </div>
      </div>

      {/* РЯД 1: СТРОКА ПОИСКА */}
      <div
        style={{
          padding: '0 6px 10px 6px',
          zIndex: 15,
          transform: isSearchActive ? 'translateY(-52px)' : 'translateY(0)',
          transition: isSearchActive ? `transform 250ms ${CUBIC_EASE_OUT}` : `transform 220ms ${CUBIC_EASE_OUT}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: 40,
            backgroundColor: isSearchInputFocused ? 'var(--sidebar-search-focus-bg)' : 'var(--sidebar-search-bg)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            border: '1.2px solid transparent',
            boxSizing: 'border-box',
          }}
        >
          <MdiIcon path={mdiMagnify} size={18} color="var(--text-muted)" style={{ marginRight: 10 }} />

          <input
            ref={searchInputRef}
            type="text"
            placeholder={isChatSearchMode ? 'Search in messages...' : 'Search Chat'}
            value={searchText}
            onFocus={() => setIsSearchInputFocused(true)}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && handleCloseSearch()}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--sidebar-search-text)',
              fontSize: 14,
              width: '100%',
              fontFamily: 'Segoe UI, sans-serif',
            }}
          />

          <button
            onClick={handleCloseSearch}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              opacity: isSearchActive ? 1 : 0,
              pointerEvents: isSearchActive ? 'auto' : 'none',
              transition: isSearchActive ? 'opacity 200ms ease-out' : 'opacity 100ms ease-out',
            }}
          >
            <MdiIcon path={mdiCloseCircle} size={18} color="var(--text-muted)" />
          </button>
        </div>
      </div>

      {/* РЯД 2: ПАПКИ ЧАТОВ */}
      {chatFolders.length > 1 && (
        <div
          style={{
            height: 45,
            minHeight: 45,
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            opacity: isSearchActive ? 0 : 1,
            pointerEvents: isSearchActive ? 'none' : 'auto',
            transition: isSearchActive ? 'opacity 150ms ease-out' : 'opacity 200ms ease-out',
            flexShrink: 0,
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

      {/* РЯД 3: СПИСОК ЧАТОВ */}
      <div
        ref={containerRef}
        className="wpf-scroll-viewer"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        style={{
          flex: 1,
          position: 'relative',
          opacity: isSearchActive ? 0 : 1,
          pointerEvents: isSearchActive ? 'none' : 'auto',
          transition: isSearchActive ? 'opacity 150ms ease-out' : 'opacity 200ms ease-out',
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
              const isSelected = selectedChatUser?.id === (chat.isGroup ? chat.groupId : chat.userId);
              const isHovered = hoveredChatKey === key;

              const [preview] = MessagePreviewHelper.formatPreview(
                chat.lastMessage,
                chat.lastMessageType,
                chat.userId,
                0,
                chat.isLastMessageDeletedForMe
              );

              const msgIcon = getLastMessageIcon(chat.lastMessageType);

              // 🟢 Читаем и avatarPath, и avatar (Base64) из C#
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
                    right: 8,
                    height: `${ITEM_HEIGHT}px`,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 15px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--chat-item-active)' : isHovered ? 'var(--chat-item-hover)' : 'transparent',
                    boxSizing: 'border-box',
                    transition: 'background-color 0.12s ease',
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
                      {/* Буква-заглушка */}
                      <span>{((chat.isGroup ? chat.groupName : chat.nickName) || 'U').charAt(0).toUpperCase()}</span>

                      {/* 🟢 Фотография/аватарка поверх заглушки */}
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
                  <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      {chat.isSecretChat && <MdiIcon path={mdiLock} size={15} color="#FFFFFF" />}
                      <span style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {chat.isGroup ? chat.groupName : chat.nickName}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {msgIcon && <MdiIcon path={msgIcon} size={14} color="var(--text-muted)" />}
                      <span style={{ color: 'var(--text-muted)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {chat.isTyping ? <span style={{ color: 'var(--app-accent)' }}>typing...</span> : preview}
                      </span>
                    </div>
                  </div>

                  {/* Время и бейдж */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
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

      {/* ================= РЕЗУЛЬТАТЫ ПОИСКА ================= */}
      <div
        className="wpf-scroll-viewer"
        style={{
          position: 'absolute',
          top: 54,
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
        {/* БЛОК 1: НЕДАВНИЕ ПОИСКИ */}
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

        {/* БЛОК 2: ГЛОБАЛЬНЫЙ ПОИСК */}
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

                {/* БЛОК 3: НАЙДЕННЫЕ СООБЩЕНИЯ */}
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
  const avatarSrc = normalizeAvatarUrl(user.avatarPath || user.avatar);

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