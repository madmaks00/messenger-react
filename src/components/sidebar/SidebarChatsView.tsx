import React, { useState, useRef, useMemo } from 'react';
import { useSidebarChatsStore } from '../../stores/sidebarChatsStore';
import { useChatFolderStore, IChatFolder } from '../../stores/chatFolderStore';
import { useChatStore } from '../../stores/chatStore';
import { MessagePreviewHelper } from '../../utils/helpers';
import { IChatListItem } from '../../types/models';
import { chatService } from '../../services/chat.service';

const ITEM_HEIGHT = 68;

// Векторные Material Design иконки сайдбара
const SidebarIcons = {
  Magnify: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5l-1.5 1.5l-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16A6.5 6.5 0 0 1 3 9.5A6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14S14 12 14 9.5S12 5 9.5 5z" />
    </svg>
  ),
  Pin: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ transform: 'rotate(45deg)' }}>
      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
    </svg>
  ),
  BellOff: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.84 22.73L19.11 21H18c-.55 0-1-.45-1-1v-.89L13.89 15.9c-.3.06-.6.1-.89.1c-2.76 0-5-2.24-5-5c0-.29.04-.59.1-.89L4.27 6.27L2 8.54l1.43 1.43C3.16 10.74 3 11.83 3 13v4l-2 2v1h15.73l2.84 2.84l1.27-1.11M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2M10.88 4.22c.36-.14.74-.22 1.12-.22c2.76 0 5 2.24 5 5v4.18l2 2V9a7 7 0 0 0-5.83-6.9v-.6a1.17 1.17 0 0 0-2.34 0v.6c-.66.11-1.3.33-1.89.65l1.94 1.47z" />
    </svg>
  ),
  Lock: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 17a2 2 0 0 0 2-2a2 2 0 0 0-2-2a2 2 0 0 0-2 2a2 2 0 0 0 2 2m6-9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h1V6a5 5 0 0 1 5-5a5 5 0 0 1 5 5v2h1m-6-5a3 3 0 0 0-3 3v2h6V6a3 3 0 0 0-3-3z" />
    </svg>
  ),
  GroupBadge: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 17v2H2v-2s0-4 7-4s7 4 7 4m-3.5-9.5A3.5 3.5 0 1 0 9 11a3.5 3.5 0 0 0 3.5-3.5m3.44 1.3a5.53 5.53 0 0 1 0 7.4A7.47 7.47 0 0 1 22 17v2h-4v-2c0-.77-.16-1.5-.44-2.17A5.5 5.5 0 0 0 16 11.5a5.7 5.7 0 0 0-.06-2.7z" />
    </svg>
  ),
  Broom: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.36 2.72l1.42 1.42l-5.68 5.68l-.71-.71l-1.42 1.42l2.83 2.83l-1.42 1.42l-.71-.71l-2.12 2.12c-.2.2-.45.33-.73.38L4.3 18.05c-.6.1-1.18-.3-1.28-.9c-.03-.18 0-.36.08-.52l1.47-6.54c.05-.28.18-.53.38-.73l7.78-7.78l1.41 1.42l-.7.71l1.41 1.41l.71-.71l4.11-2.69z" />
    </svg>
  ),
  Delete: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12z" />
    </svg>
  ),
};

// Палитра аватаров точно из конвертера WPF
const AVATAR_COLORS = ['#E17076', '#7BC862', '#65AADD', '#A695E7', '#EE7AE9', '#6EC9CB', '#FAA774'];
const getAvatarColor = (id: number = 0) => AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];

export const SidebarChatsView: React.FC = () => {
  const { allChats, openChat, togglePinChat, toggleMuteChat, deleteChat, clearChatHistory, selectedChatUser } = useSidebarChatsStore();
  const { chatFolders, selectedFolderId, selectFolder, reorderFolders } = useChatFolderStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredChatId, setHoveredChatId] = useState<number | null>(null);
  const [draggedFolderIndex, setDraggedFolderIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; chat: IChatListItem } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const filteredChats = useMemo(() => {
    let result = allChats;

    if (selectedFolderId && selectedFolderId > 0) {
      const currentFolder = chatFolders.find((f) => f.id === selectedFolderId);
      if (currentFolder) {
        result = result.filter((c) => {
          const id = c.isGroup ? c.groupId : c.userId;
          return id && currentFolder.includedChatIds.includes(id);
        });
      }
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => {
        const name = (c.isGroup ? c.groupName : c.nickName) || '';
        return name.toLowerCase().includes(q) || (c.lastMessage && c.lastMessage.toLowerCase().includes(q));
      });
    }

    return result;
  }, [allChats, selectedFolderId, searchQuery, chatFolders]);

  const totalHeight = filteredChats.length * ITEM_HEIGHT;
  const viewportHeight = 600;
  const firstIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 2);
  const lastIndex = Math.min(filteredChats.length - 1, Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + 2);
  const visibleChats = filteredChats.slice(firstIndex, lastIndex + 1);

  const handleDragStart = (index: number) => {
    if (index === 0) return;
    setDraggedFolderIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedFolderIndex === null || index === 0 || draggedFolderIndex === index) return;
    reorderFolders(draggedFolderIndex, index);
    setDraggedFolderIndex(index);
  };

  const handleContextMenu = (e: React.MouseEvent, chat: IChatListItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, chat });
  };

  return (
    <div
      style={{
        width: 340,
        height: '100%',
        backgroundColor: '#161A23', // BgList
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* 1. ПОЛЕ ПОИСКА (SidebarSearchInputBorderStyle: Height=40, Radius=12, Bg=#1C212D) */}
      <div style={{ padding: '8px 10px 4px 10px' }}>
        <div
          style={{
            height: 40,
            backgroundColor: '#1C212D',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            border: '1.2px solid transparent',
          }}
        >
          <span style={{ color: '#7D8494', display: 'flex', alignItems: 'center', marginRight: 10 }}>
            <SidebarIcons.Magnify />
          </span>
          <input
            type="text"
            placeholder="Search Chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#FFFFFF',
              fontSize: 14,
              width: '100%',
              fontFamily: 'Segoe UI, sans-serif',
            }}
          />
        </div>
      </div>

      {/* 2. ВКЛАДКИ ПАПОК (FolderTabStyle: Height=35, 14.5px SemiBold, без нижних границ) */}
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          padding: '0 10px',
          height: 45,
          alignItems: 'center',
          scrollbarWidth: 'none',
        }}
      >
        {chatFolders.map((folder: IChatFolder, idx: number) => {
          const isSelected = selectedFolderId === folder.id;
          return (
            <div
              key={folder.id}
              draggable={!folder.isSystem}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onClick={() => selectFolder(folder.id)}
              style={{
                position: 'relative',
                height: 35,
                padding: '6px 12px 0 12px',
                fontSize: 14.5,
                fontWeight: 600,
                color: isSelected ? '#FFFFFF' : '#7D8494',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span>{folder.name}</span>
              {isSelected && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 6,
                    right: 6,
                    height: 3,
                    borderRadius: 1.5,
                    backgroundColor: folder.color || '#FFFFFF',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 3. СПИСОК ЧАТОВ (ChatListItemStyle: Height=68, CornerRadius=12, Margin 8px) */}
      <div
        ref={containerRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
      >
        <div style={{ height: `${totalHeight}px`, position: 'relative', width: '100%' }}>
          {visibleChats.map((chat, idx) => {
            const actualIndex = firstIndex + idx;
            const topOffset = actualIndex * ITEM_HEIGHT;
            const isSelected = selectedChatUser?.id === (chat.isGroup ? chat.groupId : chat.userId);
            const isHovered = hoveredChatId === (chat.id || actualIndex);

            const [preview] = MessagePreviewHelper.formatPreview(
              chat.lastMessage,
              chat.lastMessageType,
              chat.userId,
              0,
              chat.isLastMessageDeletedForMe
            );

            return (
              <div
                key={chat.id || actualIndex}
                onClick={() => openChat(chat)}
                onContextMenu={(e) => handleContextMenu(e, chat)}
                onMouseEnter={() => setHoveredChatId(chat.id || actualIndex)}
                onMouseLeave={() => setHoveredChatId(null)}
                style={{
                  position: 'absolute',
                  top: `${topOffset}px`,
                  left: 8,
                  right: 8,
                  height: `${ITEM_HEIGHT}px`,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 15px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  backgroundColor: isSelected ? '#232836' : isHovered ? '#1C212D' : 'transparent',
                  transition: 'background-color 0.1s ease',
                  boxSizing: 'border-box',
                }}
              >
                {/* Аватарка (46x46, CornerRadius=23) */}
                <div style={{ position: 'relative', width: 46, height: 46, marginRight: 12, flexShrink: 0 }}>
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      backgroundColor: getAvatarColor(chat.userId || chat.groupId || 0),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      fontWeight: 600,
                      fontSize: 16,
                      overflow: 'hidden',
                    }}
                  >
                    {chat.avatarPath ? (
                      <img src={chat.avatarPath} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      ((chat.isGroup ? chat.groupName : chat.nickName) || 'U').charAt(0).toUpperCase()
                    )}
                  </div>

                  {/* Зеленый индикатор онлайна (12x12, Border=2 #1C212D) */}
                  {chat.isOnline && !chat.isGroup && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: '#4CAF50', // ActiveOnlineIndicatorBgBrush
                        border: '2px solid #1C212D',
                      }}
                    />
                  )}

                  {/* Бейдж группы */}
                  {chat.isGroup && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: -3,
                        right: -3,
                        width: 20,
                        height: 20,
                        borderRadius: 9,
                        backgroundColor: '#1E9BEB',
                        border: '2px solid #1C212D',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                      }}
                    >
                      <SidebarIcons.GroupBadge />
                    </div>
                  )}
                </div>

                {/* Название и последнее сообщение */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <div
                      style={{
                        color: '#FFFFFF', // ChatListItemNameTextBrush
                        fontSize: 15,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {chat.isSecretChat && <SidebarIcons.Lock />}
                      <span>{chat.isGroup ? chat.groupName : chat.nickName}</span>
                    </div>

                    {/* Время и иконки пина/звука */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {chat.isMuted && <span style={{ color: '#7D8494' }}><SidebarIcons.BellOff /></span>}
                      {chat.isPinned && <span style={{ color: '#7D8494' }}><SidebarIcons.Pin /></span>}
                      <span style={{ color: '#7D8494', fontSize: 12 }}>
                        {chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div
                      style={{
                        color: '#7D8494', // TextMuted
                        fontSize: 13,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 190,
                      }}
                    >
                      {chat.isTyping ? <span style={{ color: '#1E9BEB', fontWeight: 600 }}>typing...</span> : preview}
                    </div>

                    {/* Бейдж непрочитанных (ChatUnreadBadge) */}
                    {chat.unreadCount > 0 && (
                      <div
                        style={{
                          backgroundColor: chat.isMuted ? '#6C757D' : '#1E9BEB',
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
                          boxSizing: 'border-box',
                        }}
                      >
                        {chat.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. КОНТЕКСТНОЕ МЕНЮ (SidebarContextMenuStyle: Bg=#1C212D, Border=#2A303C, CornerRadius=12) */}
      {contextMenu && (
        <div onClick={() => setContextMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              backgroundColor: '#1C212D',
              border: '1px solid #2A303C',
              borderRadius: 12,
              padding: '4px 0',
              boxShadow: '0 15px 30px rgba(0, 0, 0, 0.4)',
              zIndex: 1001,
              minWidth: 200,
            }}
          >
            <div style={contextMenuItemStyle} onClick={() => { togglePinChat(contextMenu.chat, chatService); setContextMenu(null); }}>
              <SidebarIcons.Pin />
              <span>{contextMenu.chat.isPinned ? 'Unpin' : 'Pin'}</span>
            </div>
            <div style={contextMenuItemStyle} onClick={() => { toggleMuteChat(contextMenu.chat, chatService); setContextMenu(null); }}>
              <SidebarIcons.BellOff />
              <span>{contextMenu.chat.isMuted ? 'Unmute Notifications' : 'Mute Notifications'}</span>
            </div>
            <div style={{ height: 1, backgroundColor: '#2A303C', margin: '4px 0' }} />
            <div style={contextMenuItemStyle} onClick={() => { clearChatHistory(contextMenu.chat, chatService, false); setContextMenu(null); }}>
              <SidebarIcons.Broom />
              <span>Clear History</span>
            </div>
            <div
              style={{ ...contextMenuItemStyle, color: '#FF3B30' }}
              onClick={() => { deleteChat(contextMenu.chat, chatService); setContextMenu(null); }}
            >
              <SidebarIcons.Delete />
              <span>Delete Chat</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const contextMenuItemStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 14,
  cursor: 'pointer',
  color: '#FFFFFF',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  transition: 'background 0.1s ease',
};