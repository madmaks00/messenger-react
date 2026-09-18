import React, { useState, useRef, useMemo } from 'react';
import { useSidebarChatsStore } from '../../stores/sidebarChatsStore';
import { useChatFolderStore, IChatFolder } from '../../stores/chatFolderStore';
import { useChatStore } from '../../stores/chatStore';
import { MessagePreviewHelper } from '../../utils/helpers';
import { IChatListItem } from '../../types/models';
import { chatService } from '../../services/chat.service';

const ITEM_HEIGHT = 68;

export const SidebarChatsView: React.FC = () => {
  const { allChats, openChat, togglePinChat, toggleMuteChat, deleteChat, clearChatHistory } = useSidebarChatsStore();
  const { chatFolders, selectedFolderId, selectFolder, reorderFolders } = useChatFolderStore();
  const { selectChatUser } = useChatStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [draggedFolderIndex, setDraggedFolderIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; chat: IChatListItem } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // 1. Фильтрация чатов по выбранной папке и поисковому запросу
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

  // 2. Виртуализация списка чатов (68px на строку)
  const totalHeight = filteredChats.length * ITEM_HEIGHT;
  const viewportHeight = 600; // средний viewport
  const firstIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 2);
  const lastIndex = Math.min(filteredChats.length - 1, Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + 2);
  const visibleChats = filteredChats.slice(firstIndex, lastIndex + 1);

  // 3. Drag and Drop для вкладок папок
  const handleDragStart = (index: number) => {
    if (index === 0) return; // Системную папку "All Chats" двигать нельзя
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
    <div style={{ width: 340, height: '100%', background: '#111B21', borderRight: '1px solid #222E35', display: 'flex', flexDirection: 'column' }}>
      {/* СТРОКА ПОИСКА */}
      <div style={{ padding: '12px 14px 8px 14px' }}>
        <div style={{ background: '#202C33', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '6px 12px' }}>
          <span style={{ marginRight: 8, color: '#8696A0' }}>🔍</span>
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: '#E9EDEF', fontSize: 14, width: '100%' }}
          />
        </div>
      </div>

      {/* ВКЛАДКИ ПАПОК ЧАТОВ */}
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid #222E35', padding: '0 8px' }}>
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
                padding: '8px 14px',
                fontSize: 14,
                fontWeight: 600,
                color: isSelected ? '#53BDEB' : '#8696A0',
                borderBottom: isSelected ? '3px solid #53BDEB' : '3px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                userSelect: 'none',
              }}
            >
              {folder.name}
            </div>
          );
        })}
      </div>

      {/* ВИРТУАЛИЗИРОВАННЫЙ СПИСОК ЧАТОВ */}
      <div
        ref={containerRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
      >
        <div style={{ height: `${totalHeight}px`, position: 'relative', width: '100%' }}>
          {visibleChats.map((chat, idx) => {
            const actualIndex = firstIndex + idx;
            const topOffset = actualIndex * ITEM_HEIGHT;
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
                style={{
                  position: 'absolute',
                  top: `${topOffset}px`,
                  left: 0,
                  right: 0,
                  height: `${ITEM_HEIGHT}px`,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                }}
              >
                {/* Аватарка */}
                <div style={{ position: 'relative', width: 48, height: 48, marginRight: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 24, background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontWeight: 'bold', fontSize: 17, overflow: 'hidden' }}>
                    {chat.avatarPath ? (
                      <img src={chat.avatarPath} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      (chat.isGroup ? chat.groupName : chat.nickName || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  {chat.isOnline && (
                    <div style={{ position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, background: '#22C55E', border: '2px solid #111B21' }} />
                  )}
                </div>

                {/* Название и текст последнего сообщения */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <div style={{ color: '#E9EDEF', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {chat.isSecretChat && <span>🔒</span>}
                      <span>{chat.isGroup ? chat.groupName : chat.nickName}</span>
                    </div>
                    <div style={{ color: '#8696A0', fontSize: 11.5 }}>
                      {chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: '#8696A0', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
                      {chat.isTyping ? <span style={{ color: '#53BDEB' }}>typing...</span> : preview}
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {chat.isPinned && <span style={{ color: '#8696A0', fontSize: 12 }}>📌</span>}
                      {chat.unreadCount > 0 && (
                        <div style={{ background: chat.isMuted ? '#64748B' : '#53BDEB', color: '#111B21', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 'bold' }}>
                          {chat.unreadCount}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* КОНТЕКСТНОЕ МЕНЮ ЧАТА */}
      {contextMenu && (
        <div onClick={() => setContextMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              background: '#202C33',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '6px 0',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              zIndex: 1001,
              minWidth: 170,
            }}
          >
            <div style={sidebarMenuItemStyle} onClick={() => { togglePinChat(contextMenu.chat, chatService); setContextMenu(null); }}>
              📌 {contextMenu.chat.isPinned ? 'Unpin' : 'Pin'}
            </div>
            <div style={sidebarMenuItemStyle} onClick={() => { toggleMuteChat(contextMenu.chat, chatService); setContextMenu(null); }}>
              🔔 {contextMenu.chat.isMuted ? 'Unmute' : 'Mute'}
            </div>
            <div style={sidebarMenuItemStyle} onClick={() => { clearChatHistory(contextMenu.chat, chatService, false); setContextMenu(null); }}>
              🧹 Clear History
            </div>
            <div style={{ ...sidebarMenuItemStyle, color: '#EF4444' }} onClick={() => { deleteChat(contextMenu.chat, chatService); setContextMenu(null); }}>
              🗑 Delete Chat
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const sidebarMenuItemStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 13.5,
  cursor: 'pointer',
  color: '#E9EDEF',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};