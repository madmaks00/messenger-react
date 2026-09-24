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
  mdiPencilOutline,
} from '@mdi/js';

import { SidebarHeaderUserControl } from '../common/SidebarHeaderUserControl';
import { CreateFolderDialog } from '../modals/CreateFolderDialog';

import { useSidebarChatsStore } from '../../stores/sidebarChatsStore';
import { useChatFolderStore } from '../../stores/chatFolderStore';
import { useChatStore } from '../../stores/chatStore';
import { useSearchStore } from '../../stores/searchStore';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import { resolveMdiIcon } from '../../utils/iconResolver';
import { MessagePreviewHelper, getAvatarColor, normalizeAvatarUrl } from '../../utils/helpers';
import { IChatListItem, IUserSearchResult, IChatFolder } from '../../types/models';
import { LastMessageType } from '../../types/enums';

const ITEM_HEIGHT = 68;
const CUBIC_EASE_OUT = 'cubic-bezier(0.215, 0.61, 0.355, 1)';
const DRAG_THRESHOLD = 5; // Порог начала перетаскивания в пикселях (WPF MinimumHorizontalDragDistance)

const MdiIcon: React.FC<{ path: string; size?: number; color?: string; style?: React.CSSProperties }> = ({
  path,
  size = 18,
  color = 'currentColor',
  style,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill={color}
    style={{ display: 'inline-block', flexShrink: 0, ...style }}
  >
    <path d={path} />
  </svg>
);

const getChatKey = (item: any): string => {
  if (!item) return '';
  if (item.isSecretChat) return `s_${item.secretChatId || item.id}`;
  if (item.isGroup) return `g_${item.groupId || item.id}`;
  return `u_${item.userId || item.id}`;
};

export const SidebarChatsView: React.FC = () => {
  const {
    allChats,
    openChat,
    togglePinChat,
    toggleMuteChat,
    deleteChat,
    clearChatHistory,
    blockUser,
    selectedChatUser,
    loadChats,
  } = useSidebarChatsStore();

  const {
    chatFolders,
    customFolders,
    selectedFolderId,
    selectFolder,
    toggleChatInFolder,
    openEditFolderDialog,
    confirmRemoveFolder,
    loadFoldersAsync,
    reorderFoldersLive,
    saveFoldersOrderAsync,
  } = useChatFolderStore();

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

  // Контекстные меню
  const [chatContextMenu, setChatContextMenu] = useState<{ x: number; y: number; chat: IChatListItem } | null>(null);
  const [isFolderSubmenuOpen, setIsFolderSubmenuOpen] = useState(false);
  const [folderContextMenu, setFolderContextMenu] = useState<{ x: number; y: number; folder: IChatFolder } | null>(null);

  // Скролл списка чатов
  const [isListHovered, setIsListHovered] = useState(false);
  const [isScrollDragging, setIsScrollDragging] = useState(false);
  const [isThumbHovered, setIsThumbHovered] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const foldersScrollRef = useRef<HTMLDivElement>(null);

  // =========================================================================
  // 🟢 LIVE DRAG & DROP FOLDERS (ТОЧНО КАК В C# WPF)
  // =========================================================================
  const [draggedFolderId, setDraggedFolderId] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);

  const isDraggingRef = useRef<boolean>(false);
  const justFinishedDragRef = useRef<boolean>(false);
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const draggedFolderRef = useRef<IChatFolder | null>(null);
  const dragOffsetRef = useRef<number>(0);
  const folderRefs = useRef<(HTMLDivElement | null)[]>([]);

  const { containerRef } = useSmoothScroll<HTMLDivElement>({ friction: 0.78, wheelMultiplier: 0.15 });
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  const isSearchActive = isSearchInputFocused || searchText.length > 0;
  const hasFolders = chatFolders && chatFolders.length > 1;

  useEffect(() => {
    loadFoldersAsync();
    loadChats(true);
  }, [loadFoldersAsync, loadChats]);

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

  // Глобальные обработчики перетаскивания (WPF element.CaptureMouse)
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!draggedFolderRef.current) return;

      const deltaX = e.clientX - dragStartPosRef.current.x;

      if (!isDraggingRef.current) {
        if (Math.abs(deltaX) > DRAG_THRESHOLD) {
          isDraggingRef.current = true;
          setDraggedFolderId(draggedFolderRef.current.id);
        } else {
          return;
        }
      }

      dragOffsetRef.current = deltaX;
      setDragOffset(deltaX);

      // 1. Автоматическая прокрутка панели папок (HandleAutoScroll)
      if (foldersScrollRef.current) {
        const rect = foldersScrollRef.current.getBoundingClientRect();
        const mouseXRel = e.clientX - rect.left;
        const scrollZone = 35;

        if (mouseXRel > rect.width - scrollZone) {
          const speed = (mouseXRel - (rect.width - scrollZone)) * 0.18;
          foldersScrollRef.current.scrollLeft += speed;
        } else if (mouseXRel < scrollZone) {
          const speed = (scrollZone - mouseXRel) * 0.18;
          foldersScrollRef.current.scrollLeft -= speed;
        }
      }

      // 2. Живой обмен позициями при смещении на 60% ширины соседа (CheckAndSwapLive)
      const currentList = useChatFolderStore.getState().chatFolders;
      const targetFolder = draggedFolderRef.current;
      const currentIndex = currentList.findIndex((f) => f.id === targetFolder.id);
      if (currentIndex === -1) return;

      // Движение вправо
if (deltaX > 0 && currentIndex < currentList.length - 1) {
  const nextEl = folderRefs.current[currentIndex + 1];
  if (nextEl) {
    const nextWidth = nextEl.offsetWidth + 4;
    if (deltaX >= nextWidth * 0.6) {
      reorderFoldersLive(currentIndex, currentIndex + 1);
      dragStartPosRef.current.x += nextWidth;
      dragOffsetRef.current -= nextWidth;
      setDragOffset(dragOffsetRef.current);
    }
  }
}
// Движение влево (🟢 теперь можно свапать вплоть до нулевого индекса!)
else if (deltaX < 0 && currentIndex > 0) {
  const prevEl = folderRefs.current[currentIndex - 1];
  if (prevEl) {
    const prevWidth = prevEl.offsetWidth + 4;
    if (-deltaX >= prevWidth * 0.6) {
      reorderFoldersLive(currentIndex, currentIndex - 1);
      // 🟢 Правильная математика без телепортации:
      dragStartPosRef.current.x -= prevWidth;
      dragOffsetRef.current += prevWidth;
      setDragOffset(dragOffsetRef.current);
    }
  }
}
    };

    const handleGlobalMouseUp = () => {
      if (draggedFolderRef.current) {
        if (isDraggingRef.current) {
          justFinishedDragRef.current = true;
          setTimeout(() => {
            justFinishedDragRef.current = false;
          }, 100);

          // Сохраняем порядок на сервере и рассылаем через SignalR
          saveFoldersOrderAsync();
        }

        draggedFolderRef.current = null;
        isDraggingRef.current = false;
        setDraggedFolderId(null);
        setDragOffset(0);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [reorderFoldersLive, saveFoldersOrderAsync]);

  const handleFolderMouseDown = (e: React.MouseEvent, folder: IChatFolder) => {
    if (e.button !== 0) return;

    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    draggedFolderRef.current = folder;
    isDraggingRef.current = false;
    dragOffsetRef.current = 0;
  };

  const handleFoldersWheel = (e: React.WheelEvent) => {
    if (foldersScrollRef.current) {
      e.preventDefault();
      const step = e.deltaY > 0 ? 100 : -100;
      foldersScrollRef.current.scrollBy({ left: step, behavior: 'smooth' });
    }
  };

  // Фильтрация чатов строго 1 в 1 с WPF FilterChats
  const filteredChats = useMemo(() => {
    const currentFolder = chatFolders.find((f) => f.id === selectedFolderId);

    if (!currentFolder || currentFolder.isSystem || currentFolder.id === 0) {
      return allChats;
    }

    return allChats.filter((chat) => {
      const ids = chat.folderIds ?? (chat as any).FolderIds;
      if (!Array.isArray(ids)) return false;
      return ids.some((id) => Number(id) === Number(currentFolder.id));
    });
  }, [allChats, selectedFolderId, chatFolders]);

  const totalHeight = filteredChats.length * ITEM_HEIGHT;
  const firstIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 2);
  const lastIndex = Math.min(filteredChats.length - 1, Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + 2);
  const visibleChats = filteredChats.slice(firstIndex, lastIndex + 1);

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
      {/* РЯД 0: ШАПКА "Chats" */}
      <SidebarHeaderUserControl
        title="Chats"
        iconPath={mdiChatOutline}
        style={{
          transform: isSearchActive ? 'translateY(-20px)' : 'translateY(0)',
          opacity: isSearchActive ? 0 : 1,
          transition: isSearchActive
            ? `transform 200ms ${CUBIC_EASE_OUT}, opacity 150ms ease-out`
            : `transform 220ms ${CUBIC_EASE_OUT}, opacity 180ms ease-out`,
          pointerEvents: isSearchActive ? 'none' : 'auto',
        }}
      />

      {/* РЯД 1: СТРОКА ПОИСКА */}
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
            height: 37,
            backgroundColor: 'var(--sidebar-search-bg)',
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            border: '1.2px solid transparent',
            boxSizing: 'border-box',
          }}
        >
          <MdiIcon path={mdiMagnify} size={18} color="#8E95A5" style={{ marginRight: 10 }} />

          <input
            ref={searchInputRef}
            type="search"
            role="searchbox"
            name="chat_search_query"
            id="chat_search_query"
            autoComplete="off"
            spellCheck={false}
            placeholder={isChatSearchMode ? 'Search in messages...' : 'Search Chat'}
            value={searchText}
            onFocus={() => setIsSearchInputFocused(true)}
            onBlur={() => setIsSearchInputFocused(false)}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && handleCloseSearch()}
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

      {/* РЯД 2: ПАПКИ ЧАТОВ С ЖИВЫМ ПЕРЕТАСКИВАНИЕМ (DRAG & DROP) */}
      {hasFolders && (
        <div
          ref={foldersScrollRef}
          onWheel={handleFoldersWheel}
          style={{
            height: 45,
            minHeight: 45,
            display: 'flex',
            alignItems: 'center',
            padding: '5px 10px 0 10px',
            marginBottom: 4,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            opacity: isSearchActive ? 0 : 1,
            pointerEvents: isSearchActive ? 'none' : 'auto',
            transition: isSearchActive ? 'opacity 150ms ease-out' : 'opacity 200ms ease-out',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          {chatFolders.map((folder: IChatFolder, idx: number) => {
            const isSelected = selectedFolderId === folder.id;
            const isDragging = draggedFolderId === folder.id;
            const folderIconPath = resolveMdiIcon(folder.icon, mdiFolderOutline);

            return (
              <div
                key={folder.id}
                ref={(el) => {
                  folderRefs.current[idx] = el;
                }}
                onMouseDown={(e) => handleFolderMouseDown(e, folder)}
                onClick={() => {
                  if (justFinishedDragRef.current || isDraggingRef.current) return;
                  selectFolder(folder);
                }}
                onContextMenu={(e) => {
                  if (folder.isSystem) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setChatContextMenu(null);
                  setFolderContextMenu({ x: e.clientX, y: e.clientY, folder });
                }}
                style={{
                  position: 'relative',
                  height: 35,
                  padding: folder.isSystem ? '0 12px' : '0 12px 0 6px',
                  marginRight: 4,
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: isSelected ? '#FFFFFF' : 'var(--text-muted)',
                  cursor: folder.isSystem ? 'pointer' : isDragging ? 'grabbing' : 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  maxWidth: 160,
                  boxSizing: 'border-box',
                  whiteSpace: 'nowrap',
                  zIndex: isDragging ? 100 : 1,
                  opacity: isDragging ? 0.9 : 1,
                  transform: isDragging ? `translateX(${dragOffset}px)` : 'translateX(0)',
                  transition: isDragging ? 'none' : 'transform 0.15s ease, opacity 0.15s ease',
                  willChange: isDragging ? 'transform' : 'auto',
                }}
              >
                {!folder.isSystem && (
                  <MdiIcon
                    path={folderIconPath}
                    size={16}
                    color={folder.color || '#FFFFFF'}
                    style={{ opacity: isSelected ? 1 : 0.6 }}
                  />
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{folder.name}</span>

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
                    : (chat.isGroup ? chat.groupId : Number(chat.userId || chat.id)) === Number(selectedChatUser.id))
                );
                const isHovered = hoveredChatKey === key;

                const rawText = chat.lastMessage || '';
                const msgIcon = getLastMessageIcon(chat.lastMessageType);
                const avatarRaw = chat.avatarPath || (chat as any).avatar;
                const chatAvatarSrc = normalizeAvatarUrl(avatarRaw);

                return (
                  <div
                    key={key}
                    onClick={() => openChat(chat)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setFolderContextMenu(null);
                      setIsFolderSubmenuOpen(false);
                      setChatContextMenu({ x: e.clientX, y: e.clientY, chat });
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
                    }}
                  >
                    {/* Аватар 46x46 */}
                    <div style={{ position: 'relative', width: 46, height: 46, marginRight: 12, flexShrink: 0 }}>
                      <div
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 23,
                          backgroundColor: getAvatarColor(chat.isGroup ? chat.groupId || 0 : Number(chat.userId || chat.id || 0)),
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

                      {/* Индикатор онлайна */}
                      {Boolean(chat.isOnline) && !chat.isGroup && (
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
                            zIndex: 10,
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

                    {/* Текстовая область */}
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
                          {chat.isTyping ? <span style={{ color: 'var(--app-accent)' }}>typing...</span> : (chat.lastMessage || '')}
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

        {/* Скроллбар */}
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
                  ? 'rgba(255, 255, 255, 0.6)'
                  : isThumbHovered
                  ? 'rgba(255, 255, 255, 0.4)'
                  : 'rgba(255, 255, 255, 0.3)',
                opacity: isListHovered || isScrollDragging ? 1 : 0,
                transition: isScrollDragging ? 'none' : 'opacity 0.2s ease, background-color 0.15s ease',
                cursor: 'pointer',
              }}
            />
          </div>
        )}
      </div>

      {/* РЕЗУЛЬТАТЫ ПОИСКА */}
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

      {/* КОНТЕКСТНОЕ МЕНЮ ЧАТА */}
      {chatContextMenu && (
        <div
          onMouseDown={() => setChatContextMenu(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: chatContextMenu.y,
              left: chatContextMenu.x,
              backgroundColor: 'var(--context-menu-bg)',
              border: '1px solid var(--context-menu-border)',
              borderRadius: 12,
              padding: '2px 0',
              minWidth: 220,
              boxShadow: '0 2px 15px rgba(0, 0, 0, 0.25)',
              zIndex: 1001,
            }}
          >
            {/* 1. PIN / UNPIN */}
            <ContextRow
              icon={mdiPinOutline}
              rotate={45}
              text={chatContextMenu.chat.isPinned ? 'Unpin' : 'Pin'}
              onClick={() => {
                togglePinChat(chatContextMenu.chat);
                setChatContextMenu(null);
              }}
            />

            {/* 2. MUTE / UNMUTE NOTIFICATIONS */}
            <ContextRow
              icon={chatContextMenu.chat.isMuted ? mdiBellOutline : mdiBellOffOutline}
              text={chatContextMenu.chat.isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
              onClick={() => {
                toggleMuteChat(chatContextMenu.chat);
                setChatContextMenu(null);
              }}
            />

            {/* 3. ADD TO FOLDER */}
            <div
              style={{ position: 'relative' }}
              onMouseEnter={() => setIsFolderSubmenuOpen(true)}
              onMouseLeave={() => setIsFolderSubmenuOpen(false)}
            >
              <ContextRow icon={mdiFolderPlusOutline} text="Add to folder" hasChevron />

              {isFolderSubmenuOpen && (
                <div
                  onMouseDown={(e) => e.stopPropagation()}
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
                  {customFolders.map((folder) => {
                    const ids = chatContextMenu.chat.folderIds ?? (chatContextMenu.chat as any).FolderIds;
                    const isInFolder = Array.isArray(ids) && ids.some((id) => Number(id) === Number(folder.id));
                    const folderIcon = resolveMdiIcon(folder.icon, mdiFolderOutline);

                    return (
                      <ContextRow
                        key={folder.id}
                        icon={folderIcon}
                        iconColor={folder.color || undefined}
                        text={folder.name}
                        checkMark={isInFolder}
                        onClick={async () => {
                          await toggleChatInFolder(folder.id, chatContextMenu.chat);
                          setChatContextMenu(null);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. BLOCK / UNBLOCK USER */}
            {!chatContextMenu.chat.isGroup && (
              <ContextRow
                icon={mdiBlockHelper}
                text={chatContextMenu.chat.isBlocked ? 'Unblock User' : 'Block User'}
                onClick={() => {
                  blockUser(chatContextMenu.chat);
                  setChatContextMenu(null);
                }}
              />
            )}

            <div style={{ height: 1, backgroundColor: 'var(--context-menu-border)', margin: '4px 0' }} />

            {/* 5. CLEAR HISTORY */}
            <ContextRow
              icon={mdiBroom}
              text="Clear History"
              onClick={() => {
                clearChatHistory(chatContextMenu.chat, false);
                setChatContextMenu(null);
              }}
            />

            {/* 6. DELETE CHAT */}
            <ContextRow
              icon={mdiDeleteOutline}
              text="Delete Chat"
              isDestructive
              onClick={() => {
                deleteChat(chatContextMenu.chat);
                setChatContextMenu(null);
              }}
            />
          </div>
        </div>
      )}

      {/* КОНТЕКСТНОЕ МЕНЮ ВКЛАДКИ ПАПКИ */}
      {folderContextMenu && (
        <div
          onMouseDown={() => setFolderContextMenu(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: folderContextMenu.y,
              left: folderContextMenu.x,
              backgroundColor: 'var(--context-menu-bg)',
              border: '1px solid var(--context-menu-border)',
              borderRadius: 12,
              padding: '2px 0',
              minWidth: 160,
              boxShadow: '0 2px 15px rgba(0, 0, 0, 0.25)',
              zIndex: 1001,
            }}
          >
            <ContextRow
              icon={mdiPencilOutline}
              text="Edit folder"
              onClick={() => {
                openEditFolderDialog(folderContextMenu.folder);
                setFolderContextMenu(null);
              }}
            />
            <ContextRow
              icon={mdiDeleteOutline}
              text="Remove"
              isDestructive
              onClick={() => {
                confirmRemoveFolder(folderContextMenu.folder);
                setFolderContextMenu(null);
              }}
            />
          </div>
        </div>
      )}

      {/* ДИАЛОГ СОЗДАНИЯ И РЕДАКТИРОВАНИЯ */}
      <CreateFolderDialog />
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

  const handleTrigger = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick?.();
  };

  return (
    <div
      onMouseDown={handleTrigger}
      onClick={handleTrigger}
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