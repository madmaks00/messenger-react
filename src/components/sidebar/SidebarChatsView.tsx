import React, { useState, useRef, useMemo } from 'react';
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
import { LastMessageType } from '../../types/enums';
import { useSidebarChatsStore } from '../../stores/sidebarChatsStore';
import { useChatFolderStore, IChatFolder } from '../../stores/chatFolderStore';
import { useChatStore } from '../../stores/chatStore';
import { MessagePreviewHelper } from '../../utils/helpers';
import { IChatListItem } from '../../types/models';
import { chatService } from '../../services/chat.service';

const ITEM_HEIGHT = 68;

// 🟢 Нативный компонент векторной иконки MDI (1 в 1 PackIcon из WPF)
const MdiIcon: React.FC<{ path: string; size?: number | string; color?: string; style?: React.CSSProperties }> = ({
  path,
  size = 18,
  color = 'currentColor',
  style,
}) => {
  const s = typeof size === 'number' ? `${size}px` : size;
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill={color} style={{ display: 'inline-block', flexShrink: 0, ...style }}>
      <path d={path} />
    </svg>
  );
};

// Конвертер цвета аватарки из WPF AvatarColorConverter
const AVATAR_COLORS = ['#E17076', '#7BC862', '#65AADD', '#A695E7', '#EE7AE9', '#6EC9CB', '#FAA774'];
const getAvatarColor = (id: number = 0) => AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];

export const SidebarChatsView: React.FC = () => {
  const { allChats, openChat, togglePinChat, toggleMuteChat, deleteChat, clearChatHistory, selectedChatUser } = useSidebarChatsStore();
  const { chatFolders, selectedFolderId, selectFolder, reorderFolders, toggleChatInFolder } = useChatFolderStore();
  const { isChatSearchMode, exitSearch } = useChatStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredChatId, setHoveredChatId] = useState<number | null>(null);
  const [draggedFolderIndex, setDraggedFolderIndex] = useState<number | null>(null);

  // Контекстное меню
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; chat: IChatListItem } | null>(null);
  const [isFolderSubmenuOpen, setIsFolderSubmenuOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Фильтрация чатов по папке и поиску
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

  // Drag & drop вкладок папок
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
    setIsFolderSubmenuOpen(false);
    setContextMenu({ x: e.clientX, y: e.clientY, chat });
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
      style={{
        width: 340,
        height: '100%',
        backgroundColor: '#161A23', // BgList
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* ================= РЯД 0: ШАПКА САЙДБАРА (SidebarHeaderUserControl) ================= */}
      <div
        style={{
          height: 52,
          minHeight: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MdiIcon path={mdiChatOutline} size={22} color="#1E9BEB" />
          <span style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>Chats</span>
        </div>
      </div>

      {/* ================= РЯД 1: СТРОКА ПОИСКА (SearchBoxContainer: Margin="6,0,6,0") ================= */}
      <div style={{ padding: '0 6px 8px 6px', boxSizing: 'border-box' }}>
        <div
          style={{
            height: 40,
            backgroundColor: '#1C212D', // SidebarSearchInputBgBrush
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            border: '1.2px solid transparent',
            boxSizing: 'border-box',
          }}
        >
          <MdiIcon path={mdiMagnify} size={18} color="#7D8494" style={{ marginRight: 10 }} />
          <input
            type="text"
            placeholder={isChatSearchMode ? 'Search in messages...' : 'Search Chat'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#FFFFFF', // SidebarSearchInputTextBrush
              fontSize: 14,
              width: '100%',
              fontFamily: 'Segoe UI, sans-serif',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                exitSearch();
              }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
            >
              <MdiIcon path={mdiCloseCircle} size={18} color="#7D8494" />
            </button>
          )}
        </div>
      </div>

      {/* ================= РЯД 2: ПАПКИ ЧАТОВ (В точности как в WPF: скрыты, если папок <= 1) ================= */}
      {chatFolders.length > 1 && (
        <div
          style={{
            height: 45,
            minHeight: 45,
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            overflowX: 'auto',
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
                  padding: folder.isSystem ? '0 12px' : '0 12px 0 6px',
                  margin: '0 4px 0 0',
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: isSelected ? '#FFFFFF' : '#7D8494',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  maxWidth: 160,
                  boxSizing: 'border-box',
                }}
              >
                {!folder.isSystem && (
                  <MdiIcon
                    path={folder.icon || mdiFolderOutline}
                    size={16}
                    color={folder.color || '#FFFFFF'}
                    style={{ opacity: isSelected ? 1 : 0.6 }}
                  />
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{folder.name}</span>

                {/* 🟢 Нижняя полоска-индикатор активной папки (ActiveLine) */}
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

      {/* ================= РЯД 3: СЕКЦИЯ ЧАТОВ ================= */}
      <div
        ref={containerRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
      >
        {/* 🟢 ЗАГЛУШКА ПУСТОГО СПИСКА (NoChatsPanel: 1 в 1 из WPF) */}
        {filteredChats.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              margin: '140px 20px 0 20px',
              zIndex: 5,
            }}
          >
            {/* Круг 80x80 с иконкой MessageTextOutline */}
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#1C212D', // SidebarSearchInputBgBrush
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 15,
              }}
            >
              <MdiIcon path={mdiMessageTextOutline} size={40} color="#7D8494" style={{ opacity: 0.5 }} />
            </div>

            {/* Надпись No Chats */}
            <div style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>
              No Chats
            </div>
          </div>
        )}

        {/* СПИСОК ЧАТОВ (ChatItemTemplate: Height=68, Margin="8,0,0,0", Padding="15,10", Radius=12) */}
        {filteredChats.length > 0 && (
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

              const msgIcon = getLastMessageIcon(chat.lastMessageType);

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
                    right: 0,
                    height: `${ITEM_HEIGHT}px`,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 15px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#232836' : isHovered ? '#1C212D' : 'transparent',
                    boxSizing: 'border-box',
                    transition: 'background-color 0.12s ease',
                  }}
                >
                  {/* КОЛОНКА 0: АВАТАРКА (46x46) */}
                  <div style={{ position: 'relative', width: 46, height: 46, marginRight: 12, flexShrink: 0 }}>
                    <div
                      style={{
                        width: chat.avatarPath ? 44 : 46,
                        height: chat.avatarPath ? 44 : 46,
                        borderRadius: chat.avatarPath ? 22 : 23,
                        backgroundColor: getAvatarColor(chat.isGroup ? chat.groupId || 0 : chat.userId || 0),
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

                    {/* Онлайн-точка (12x12, Border=2 #1C212D) */}
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

                    {/* Бейдж группы/канала */}
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
                        <MdiIcon path={chat.isChannel ? mdiBullhornOutline : mdiAccountGroup} size={12} color="#FFFFFF" />
                      </div>
                    )}
                  </div>

                  {/* КОЛОНКА 1: ИМЯ И ПОСЛЕДНЕЕ СООБЩЕНИЕ */}
                  <div style={{ flex: 1, minWidth: 0, margin: '2px 10px 2px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      {chat.isSecretChat && <MdiIcon path={mdiLock} size={15} color="#FFFFFF" />}
                      <span
                        style={{
                          color: '#FFFFFF', // ChatListItemNameTextBrush
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
                      {msgIcon && <MdiIcon path={msgIcon} size={14} color="#7D8494" />}
                      <span
                        style={{
                          color: '#7D8494', // TextMuted
                          fontSize: 13,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontStyle: chat.lastMessageType === LastMessageType.Deleted ? 'italic' : 'normal',
                        }}
                      >
                        {chat.isTyping ? <span style={{ color: '#1E9BEB' }}>typing...</span> : preview}
                      </span>
                    </div>
                  </div>

                  {/* КОЛОНКА 2: ВРЕМЯ, ПИН И БЕЙДЖ НЕПРОЧИТАННЫХ */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {chat.isMuted && <MdiIcon path={mdiBellOffOutline} size={14} color="#7D8494" />}
                      {chat.isPinned && (
                        <div style={{ transform: 'rotate(45deg)', display: 'flex', alignItems: 'center' }}>
                          <MdiIcon path={mdiPin} size={14} color="#7D8494" />
                        </div>
                      )}
                      <span style={{ color: '#7D8494', fontSize: 12 }}>
                        {chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    {chat.unreadCount > 0 && (
                      <div
                        style={{
                          marginTop: 5,
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
              );
            })}
          </div>
        )}
      </div>

      {/* ================= КОНТЕКСТНОЕ МЕНЮ (SidebarContextMenuStyle: Bg=#1C212D, Border=#2A303C, Radius=12) ================= */}
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
              padding: '2px 0',
              boxShadow: '0 15px 30px rgba(0, 0, 0, 0.4)',
              zIndex: 1001,
              minWidth: 220,
            }}
          >
            {/* 1. Pin / Unpin */}
            <div
              style={menuItemStyle}
              onClick={() => {
                togglePinChat(contextMenu.chat, chatService);
                setContextMenu(null);
              }}
            >
              <div style={{ transform: 'rotate(45deg)', display: 'flex', alignItems: 'center' }}>
                <MdiIcon path={mdiPinOutline} size={18} color="#FFFFFF" />
              </div>
              <span>{contextMenu.chat.isPinned ? 'Unpin' : 'Pin'}</span>
            </div>

            {/* 2. Mute / Unmute */}
            <div
              style={menuItemStyle}
              onClick={() => {
                toggleMuteChat(contextMenu.chat, chatService);
                setContextMenu(null);
              }}
            >
              <MdiIcon path={contextMenu.chat.isMuted ? mdiBellOutline : mdiBellOffOutline} size={18} color="#FFFFFF" />
              <span>{contextMenu.chat.isMuted ? 'Unmute Notifications' : 'Mute Notifications'}</span>
            </div>

            {/* 3. Add to folder (подменю) */}
            <div
              style={{ ...menuItemStyle, position: 'relative' }}
              onMouseEnter={() => setIsFolderSubmenuOpen(true)}
              onMouseLeave={() => setIsFolderSubmenuOpen(false)}
            >
              <MdiIcon path={mdiFolderPlusOutline} size={18} color="#FFFFFF" />
              <span style={{ flex: 1 }}>Add to folder</span>
              <MdiIcon path={mdiChevronRight} size={18} color="#7D8494" />

              {/* Выпадающий список папок */}
              {isFolderSubmenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    left: '100%',
                    top: -4,
                    backgroundColor: '#1C212D',
                    border: '1px solid #2A303C',
                    borderRadius: 12,
                    padding: '2px 0',
                    boxShadow: '0 15px 30px rgba(0,0,0,0.4)',
                    minWidth: 180,
                  }}
                >
                  {chatFolders.filter((f) => !f.isSystem).map((folder) => {
                    const isInFolder = folder.includedChatIds?.includes(contextMenu.chat.userId || contextMenu.chat.groupId || 0);
                    return (
                      <div
                        key={folder.id}
                        style={{ ...menuItemStyle, display: 'flex', alignItems: 'center', gap: 8 }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          await toggleChatInFolder?.(folder.id, contextMenu.chat);
                          setContextMenu(null);
                        }}
                      >
                        <div style={{ width: 18, display: 'flex', alignItems: 'center' }}>
                          {isInFolder && <MdiIcon path={mdiCheck} size={18} color="#1E9BEB" />}
                        </div>
                        <MdiIcon path={folder.icon || mdiFolderOutline} size={16} color={folder.color || '#FFFFFF'} />
                        <span style={{ color: folder.color || '#FFFFFF' }}>{folder.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Block User (скрыт для групп и каналов) */}
            {!contextMenu.chat.isGroup && !contextMenu.chat.isChannel && (
              <div
                style={menuItemStyle}
                onClick={() => {
                  setContextMenu(null);
                }}
              >
                <MdiIcon path={mdiBlockHelper} size={18} color="#FFFFFF" />
                <span>{contextMenu.chat.isBlocked ? 'Unblock User' : 'Block User'}</span>
              </div>
            )}

            <div style={{ height: 1, backgroundColor: '#2A303C', margin: '4px 0' }} />

            {/* 5. Clear History */}
            <div
              style={menuItemStyle}
              onClick={() => {
                clearChatHistory(contextMenu.chat, chatService, false);
                setContextMenu(null);
              }}
            >
              <MdiIcon path={mdiBroom} size={18} color="#FFFFFF" />
              <span>Clear History</span>
            </div>

            {/* 6. Delete Chat (красный цвет #FF3B30) */}
            <div
              style={{ ...menuItemStyle, color: '#FF3B30' }}
              onClick={() => {
                deleteChat(contextMenu.chat, chatService);
                setContextMenu(null);
              }}
            >
              <MdiIcon path={mdiDeleteOutline} size={18} color="#FF3B30" />
              <span>Delete Chat</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const menuItemStyle: React.CSSProperties = {
  padding: '8px 15px 8px 10px',
  fontSize: 14,
  cursor: 'pointer',
  color: '#FFFFFF',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  transition: 'background-color 0.1s ease',
};