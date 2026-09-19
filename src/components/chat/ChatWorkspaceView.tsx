import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  mdiLock,
  mdiPin,
  mdiPinOutline,
  mdiPinOffOutline,
  mdiMagnify,
  mdiPhoneOutline,
  mdiDotsVertical,
  mdiAccountOutline,
  mdiBellOutline,
  mdiBellOffOutline,
  mdiLockOutline,
  mdiBroom,
  mdiDeleteOutline,
  mdiBlockHelper,
  mdiClose,
  mdiReplyOutline,
  mdiShareOutline,
  mdiMessageTextOutline,
  mdiBullhornOutline,
  mdiLockCheck,
  mdiCheck,
  mdiChevronDown,
} from '@mdi/js';

import { useChatStore } from '../../stores/chatStore';
import { useMessageInputStore } from '../../stores/messageInputStore';
import { useSidebarChatsStore } from '../../stores/sidebarChatsStore';
import { useNavigationStore } from '../../stores/navigationStore';
import { MessageInputUserControl } from './MessageInputUserControl';
import { MessageItem } from './MessageItem';
import { AsyncChatLayoutEngine } from '../../utils/chatLayoutEngine';
import { getAvatarColor, normalizeAvatarUrl } from '../../utils/helpers';
import { userSession } from '../../services/userSession';
import { chatService } from '../../services/chat.service';
import { eventBus } from '../../services/eventBus';
import { IMessage } from '../../types/models';

const MdiIcon: React.FC<{ path: string; size?: number; color?: string; style?: React.CSSProperties }> = ({
  path,
  size = 20,
  color = 'currentColor',
  style,
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={{ display: 'inline-block', flexShrink: 0, ...style }}>
    <path d={path} />
  </svg>
);

export const ChatWorkspaceView: React.FC = () => {
  const {
    selectedChatUser,
    currentChatMessages = [],
    isChatLoading,
    isSelectionMode,
    selectedCount,
    pinnedMessages = [],
    isChatSearchMode,
    startChatSearch,
    loadOlderMessages,
    togglePinMessage,
    deleteMessage,
    toggleSelectMessage,
    clearSelection,
    forwardMessages,
  } = useChatStore();

  const { openChat, togglePinChat, toggleMuteChat, clearChatHistory, deleteChat, currentSidebarChat } = useSidebarChatsStore();
  const { openProfile } = useNavigationStore();
  const { setEditMessage, addReplyMessage } = useMessageInputStore();

  // Локальные состояния всплывающих меню и попапов (XAML Popups)
  const [isPinnedPopupOpen, setIsPinnedPopupOpen] = useState(false);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [unreadInChat, setUnreadInChat] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const isAtBottomRef = useRef(true);
  const animFrameRef = useRef<number | null>(null);

  // Закрытие попапов по клику вовне
  useEffect(() => {
    const handleOutsideClick = () => {
      setIsPinnedPopupOpen(false);
      setIsHeaderMenuOpen(false);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // ================= РАСЧЕТ ЛЕЙАУТА СООБЩЕНИЙ =================
  const { layoutItems, totalContentHeight } = useMemo(() => {
    const msgs = currentChatMessages || [];
    if (!msgs || msgs.length === 0) {
      return { layoutItems: [], totalContentHeight: 0 };
    }

    try {
      const rawModels = AsyncChatLayoutEngine?.createLayoutModels
        ? AsyncChatLayoutEngine.createLayoutModels(
            msgs,
            userSession.userId,
            selectedChatUser?.isGroup || false,
            selectedChatUser?.isChannel || false,
            selectedChatUser?.nickName
          )
        : [];

      const result = AsyncChatLayoutEngine?.calculateLayout
        ? AsyncChatLayoutEngine.calculateLayout(rawModels, scrollRef.current?.clientWidth || 600)
        : null;

      if (!result) return { layoutItems: [], totalContentHeight: 0 };

      const items = (result as any).items || (result as any).layoutItems || [];
      const height = (result as any).totalHeight ?? (result as any).totalContentHeight ?? 0;

      return {
        layoutItems: Array.isArray(items) ? items : [],
        totalContentHeight: typeof height === 'number' ? height : 0,
      };
    } catch (err) {
      console.error('[ChatWorkspaceView] Ошибка расчета лейаута:', err);
      return { layoutItems: [], totalContentHeight: 0 };
    }
  }, [currentChatMessages, selectedChatUser]);

  // Виртуализация: бинарный поиск диапазона отображаемых элементов
  const visibleItems = useMemo(() => {
    const items = layoutItems || [];
    if (items.length === 0 || viewportHeight <= 0) return [];

    let low = 0;
    let high = items.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (items[mid].yOffset + items[mid].totalHeight < scrollTop) low = mid + 1;
      else high = mid - 1;
    }
    const firstIndex = Math.max(0, low - 3);

    low = 0;
    high = items.length - 1;
    const targetBottom = scrollTop + viewportHeight;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (items[mid].yOffset < targetBottom) low = mid + 1;
      else high = mid - 1;
    }
    const lastIndex = Math.min(items.length - 1, high + 3);

    return items.slice(firstIndex, lastIndex + 1);
  }, [layoutItems, scrollTop, viewportHeight]);

  // ================= V-SYNC АНИМАЦИЯ СКРОЛЛА (Telegram-Style) =================
  const scrollToOffsetAnimated = useCallback((targetOffset: number, durationMs: number = 200, onCompleted?: () => void) => {
    if (!scrollRef.current) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const startOffset = scrollRef.current.scrollTop;
    const distance = targetOffset - startOffset;
    if (Math.abs(distance) < 5) {
      scrollRef.current.scrollTop = targetOffset;
      onCompleted?.();
      return;
    }

    const startTime = performance.now();
    const frame = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);
      const easeOut = 1.0 - Math.pow(1.0 - progress, 3.0); // CubicEaseOut

      if (scrollRef.current) {
        scrollRef.current.scrollTop = startOffset + distance * easeOut;
      }

      if (progress < 1.0) {
        animFrameRef.current = requestAnimationFrame(frame);
      } else {
        animFrameRef.current = null;
        onCompleted?.();
      }
    };
    animFrameRef.current = requestAnimationFrame(frame);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (!scrollRef.current) return;
    const maxScroll = Math.max(0, totalContentHeight - viewportHeight);
    scrollToOffsetAnimated(maxScroll, 200, () => {
      isAtBottomRef.current = true;
      setShowScrollBottomBtn(false);
      setUnreadInChat(0);
    });
  }, [totalContentHeight, viewportHeight, scrollToOffsetAnimated]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);

    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    const atBottom = distanceFromBottom < 20;
    isAtBottomRef.current = atBottom;

    setShowScrollBottomBtn(distanceFromBottom > 60);

    // Подгрузка старых сообщений при приближении к верху
    if (target.scrollTop < 50 && !isChatLoading) {
      loadOlderMessages?.();
    }
  };

  // Первоначальный спуск на дно при смене чата
  useEffect(() => {
    if (scrollRef.current && totalContentHeight > 0) {
      scrollRef.current.scrollTop = totalContentHeight;
      isAtBottomRef.current = true;
      setShowScrollBottomBtn(false);
    }
  }, [selectedChatUser?.id]);

  useEffect(() => {
    const handleResize = () => {
      if (scrollRef.current) setViewportHeight(scrollRef.current.clientHeight);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Слушатель события скролла к определенному сообщению (из поиска / закрепов)
  useEffect(() => {
    const unbind = eventBus.on('ScrollToMessageRequestMessage' as any, (data: any) => {
      const msgId = data?.messageId;
      if (!msgId || !layoutItems) return;
      const target = layoutItems.find((m) => m.id === msgId || m.serverId === msgId);
      if (target && scrollRef.current) {
        const centered = target.yOffset - viewportHeight / 2 + (target.totalHeight || 40) / 2;
        scrollToOffsetAnimated(Math.max(0, centered));
      }
    });
    return () => unbind();
  }, [layoutItems, viewportHeight, scrollToOffsetAnimated]);

  // ================= 1. ЗАГЛУШКА: ЧАТ НЕ ВЫБРАН (WarningBarBgBrush) =================
  if (!selectedChatUser) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-chat)' }}>
        <div
          style={{
            padding: '10px 20px',
            borderRadius: 20,
            background: 'var(--other-bubble-bg)',
            color: 'var(--text-primary)',
            fontSize: 15,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            userSelect: 'none',
          }}
        >
          <MdiIcon path={mdiMessageTextOutline} size={20} color="var(--app-accent)" />
          <span>Select a chat to start messaging</span>
        </div>
      </div>
    );
  }

  const msgs = currentChatMessages || [];
  const avatarSrc = normalizeAvatarUrl(selectedChatUser.avatarPath || (selectedChatUser as any).avatar);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-chat)', position: 'relative', overflow: 'hidden' }}>
      
      {/* ================= ШАПКА ЧАТА (Ровно 54px, ChatHeaderBackgroundBrush) ================= */}
      <div
        style={{
          height: 54,
          minHeight: 54,
          background: 'var(--chat-header-bg)',
          borderBottom: '1px solid var(--chat-header-border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          zIndex: 100,
          userSelect: 'none',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* А. РЕЖИМ ВЫДЕЛЕНИЯ (IsSelectionMode == true) */}
        {isSelectionMode ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={clearSelection}
                title="Cancel Selection"
                style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                <MdiIcon path={mdiClose} size={22} color="#FFFFFF" />
              </button>
              <span style={{ fontWeight: 'bold', fontSize: 18, color: '#FFFFFF' }}>
                Selected: {selectedCount}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => {
                  const selected = msgs.filter((m) => m.isSelected);
                  if (selected.length > 0) addReplyMessage(selected[0]);
                  clearSelection();
                }}
                style={headerActionBtnStyle}
              >
                <MdiIcon path={mdiReplyOutline} size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <span>Reply</span>
              </button>

              <button
                onClick={() => {
                  const selected = msgs.filter((m) => m.isSelected);
                  if (selected.length > 0) forwardMessages(selected);
                  clearSelection();
                }}
                style={{ ...headerActionBtnStyle, color: 'var(--app-accent)' }}
              >
                <MdiIcon path={mdiShareOutline} size={18} color="var(--app-accent)" style={{ marginRight: 6 }} />
                <span>Forward</span>
              </button>

              <button
                onClick={() => {
                  const selected = msgs.filter((m) => m.isSelected);
                  selected.forEach((m) => deleteMessage(m, true));
                  clearSelection();
                }}
                style={{ ...headerActionBtnStyle, color: '#FF3B30' }}
              >
                <MdiIcon path={mdiDeleteOutline} size={18} color="#FF3B30" style={{ marginRight: 6 }} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        ) : (
          /* Б. ОБЫЧНЫЙ РЕЖИМ ШАПКИ */
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            {/* Левая часть: кликабельный профиль собеседника */}
            <div
              onClick={() => openProfile?.()}
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', minWidth: 0, flex: 1 }}
            >
              {/* Аватарка 40x40 */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: getAvatarColor(selectedChatUser.id),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontWeight: 'bold',
                  fontSize: 14,
                  overflow: 'hidden',
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                <span>{(selectedChatUser.nickName || 'U').charAt(0).toUpperCase()}</span>
                {avatarSrc && (
                  <img
                    src={avatarSrc}
                    alt=""
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </div>

              {/* Имя и статус */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  {selectedChatUser.isSecretChat && <MdiIcon path={mdiLock} size={16} color="var(--chat-header-title)" />}
                  <span style={{ color: 'var(--chat-header-title)', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedChatUser.nickName || 'Chat'}
                  </span>
                </div>

                {/* Статусы собеседника (Group / Channel / Personal / Typing) */}
                <div style={{ fontSize: 12.5, lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {selectedChatUser.isTyping ? (
                    <span style={{ color: 'var(--app-accent)', fontWeight: 600 }}>typing...</span>
                  ) : selectedChatUser.isGroup && !selectedChatUser.isChannel ? (
                    <>
                      <span style={{ color: selectedChatUser.onlineCount ? 'var(--app-accent)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {selectedChatUser.onlineCount || 0} online
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>• {selectedChatUser.memberCount || 1} members</span>
                    </>
                  ) : selectedChatUser.isChannel ? (
                    <span style={{ color: 'var(--text-muted)' }}>{selectedChatUser.memberCount || 1} subscribers</span>
                  ) : selectedChatUser.isSecretChat ? null : selectedChatUser.isOnline ? (
                    <span style={{ color: 'var(--app-accent)' }}>online</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>
                      {selectedChatUser.lastSeen ? `last seen ${new Date(selectedChatUser.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'last seen recently'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Правая часть: кнопки действий */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
              {/* 1. Кнопка «Закрепленные сообщения» */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    setIsPinnedPopupOpen((prev) => !prev);
                    setIsHeaderMenuOpen(false);
                  }}
                  title="Pinned Messages"
                  style={{ ...headerIconBtnStyle, backgroundColor: isPinnedPopupOpen ? 'rgba(255,255,255,0.08)' : 'transparent' }}
                >
                  <div style={{ transform: 'rotate(45deg)', display: 'flex', alignItems: 'center' }}>
                    <MdiIcon path={mdiPin} size={22} color={isPinnedPopupOpen ? '#FFFFFF' : 'var(--text-muted)'} />
                  </div>
                </button>

                {/* Всплывающий попап закрепленных сообщений (PinnedPopup) */}
                {isPinnedPopupOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 48,
                      width: 320,
                      maxHeight: 380,
                      backgroundColor: 'var(--pinned-popup-bg, #1C212D)',
                      border: '1.2px solid var(--pinned-popup-border, #2A303C)',
                      borderRadius: 12,
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      padding: '8px 4px 8px 8px',
                      zIndex: 1000,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 8px 4px', borderBottom: '1px solid #2A303C' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ transform: 'rotate(45deg)' }}>
                          <MdiIcon path={mdiPinOutline} size={16} color="var(--app-accent)" />
                        </div>
                        <span style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 13.5 }}>Pinned Messages</span>
                      </div>
                      {pinnedMessages.length > 0 && (
                        <div style={{ background: 'var(--app-accent)', color: '#FFF', borderRadius: 9, padding: '2px 7px', fontSize: 11, fontWeight: 'bold' }}>
                          {pinnedMessages.length}
                        </div>
                      )}
                    </div>

                    <div className="wpf-scroll-viewer" style={{ flex: 1, overflowY: 'auto', maxHeight: 300, marginTop: 6 }}>
                      {pinnedMessages.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '25px 15px', color: 'var(--text-muted)' }}>
                          <MdiIcon path={mdiPinOffOutline} size={32} color="var(--text-muted)" style={{ marginBottom: 6 }} />
                          <div style={{ fontSize: 13, fontWeight: 600 }}>No pinned messages</div>
                        </div>
                      ) : (
                        pinnedMessages.map((pin: any) => (
                          <div
                            key={pin.id || pin.serverId}
                            onClick={() => {
                              eventBus.emit('ScrollToMessageRequestMessage' as any, { messageId: pin.serverId || pin.id });
                              setIsPinnedPopupOpen(false);
                            }}
                            style={{
                              padding: '6px 8px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              display: 'flex',
                              gap: 8,
                              marginBottom: 4,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#232A3B')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <div style={{ width: 3, backgroundColor: 'var(--app-accent)', borderRadius: 1.5 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                <span style={{ color: 'var(--app-accent)', fontWeight: 'bold', fontSize: 12.5 }}>{pin.senderName || 'User'}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                                  {pin.timestamp ? new Date(pin.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                              </div>
                              <div style={{ color: '#FFFFFF', fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {pin.text || pin.previewText || 'Attachment'}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Кнопка поиска в чате */}
              <button
                onClick={startChatSearch}
                title="Search"
                style={{ ...headerIconBtnStyle, backgroundColor: isChatSearchMode ? 'rgba(255,255,255,0.08)' : 'transparent' }}
              >
                <MdiIcon path={mdiMagnify} size={22} color={isChatSearchMode ? '#FFFFFF' : 'var(--text-muted)'} />
              </button>

              {/* 3. Кнопка звонка (скрыта в каналах) */}
              {!selectedChatUser.isChannel && (
                <button
                  onClick={() => eventBus.emit('StartCallMessage' as any, { user: selectedChatUser })}
                  title="Call"
                  style={headerIconBtnStyle}
                >
                  <MdiIcon path={mdiPhoneOutline} size={22} color="var(--text-muted)" />
                </button>
              )}

              {/* 4. Меню действий («три точки») */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    setIsHeaderMenuOpen((prev) => !prev);
                    setIsPinnedPopupOpen(false);
                  }}
                  title="More options"
                  style={{ ...headerIconBtnStyle, backgroundColor: isHeaderMenuOpen ? 'rgba(255,255,255,0.08)' : 'transparent' }}
                >
                  <MdiIcon path={mdiDotsVertical} size={22} color={isHeaderMenuOpen ? '#FFFFFF' : 'var(--text-muted)'} />
                </button>

                {/* Всплывающее контекстное меню шапки (HeaderMoreMenuPopup) */}
                {isHeaderMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 48,
                      width: 210,
                      backgroundColor: 'var(--context-menu-bg, #1C212D)',
                      border: '1.2px solid var(--context-menu-border, #2A303C)',
                      borderRadius: 10,
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      padding: '4px 0',
                      zIndex: 1000,
                    }}
                  >
                    <HeaderMenuItem
                      icon={mdiAccountOutline}
                      text="View Profile"
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        openProfile?.();
                      }}
                    />

                    {!selectedChatUser.isChannel && (
                      <HeaderMenuItem
                        icon={mdiPhoneOutline}
                        text="Call"
                        onClick={() => {
                          setIsHeaderMenuOpen(false);
                          eventBus.emit('StartCallMessage' as any, { user: selectedChatUser });
                        }}
                      />
                    )}

                    <HeaderMenuItem
                      icon={mdiPinOutline}
                      rotate={45}
                      text={currentSidebarChat?.isPinned ? 'Unpin Chat' : 'Pin Chat'}
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        if (currentSidebarChat) togglePinChat(currentSidebarChat, chatService);
                      }}
                    />

                    <HeaderMenuItem
                      icon={currentSidebarChat?.isMuted ? mdiBellOutline : mdiBellOffOutline}
                      text={currentSidebarChat?.isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        if (currentSidebarChat) toggleMuteChat(currentSidebarChat, chatService);
                      }}
                    />

                    {!selectedChatUser.isGroup && !selectedChatUser.isSecretChat && (
                      <HeaderMenuItem
                        icon={mdiLockOutline}
                        iconColor="#4CAF50"
                        text="Start Secret Chat"
                        onClick={() => {
                          setIsHeaderMenuOpen(false);
                          eventBus.emit('StartSecretChatRequest' as any, { user: selectedChatUser });
                        }}
                      />
                    )}

                    <div style={{ height: 1, backgroundColor: 'var(--context-menu-border, #2A303C)', margin: '4px 0' }} />

                    <HeaderMenuItem
                      icon={mdiBroom}
                      text="Clear History"
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        if (currentSidebarChat) clearChatHistory(currentSidebarChat, chatService, false);
                      }}
                    />

                    <HeaderMenuItem
                      icon={mdiDeleteOutline}
                      text="Delete Chat"
                      isDestructive
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        if (currentSidebarChat) deleteChat(currentSidebarChat, chatService);
                      }}
                    />

                    {!selectedChatUser.isGroup && !selectedChatUser.isChannel && (
                      <HeaderMenuItem
                        icon={mdiBlockHelper}
                        text="Block User"
                        isDestructive
                        onClick={() => {
                          setIsHeaderMenuOpen(false);
                          eventBus.emit('ToggleBlockUserMessage' as any, { userId: selectedChatUser.id });
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= ОБЛАСТЬ СООБЩЕНИЙ И СКРОЛЛЕР ================= */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Заглушка 1: Загрузка истории */}
        {isChatLoading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 15 }}>Loading history...</div>
          </div>
        )}

        {/* Заглушка 2: Пустой чат */}
        {!selectedChatUser.isSecretChat && msgs.length === 0 && !isChatLoading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5, userSelect: 'none' }}>
            <div style={{ width: 100, height: 100, borderRadius: 50, background: 'var(--empty-chat-icon-bg, #232A3B)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <MdiIcon path={selectedChatUser.isChannel ? mdiBullhornOutline : mdiMessageTextOutline} size={50} color="var(--app-accent)" />
            </div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--empty-chat-title, #FFFFFF)', marginBottom: 8 }}>
              {selectedChatUser.isChannel ? 'No posts yet' : 'No messages yet'}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {selectedChatUser.isChannel ? 'When posts are published, they will appear here.' : 'Send a message to start the conversation'}
            </div>
          </div>
        )}

        {/* Заглушка 3: Карточка секретного чата E2EE */}
        {selectedChatUser.isSecretChat && msgs.length === 0 && !isChatLoading && (
          <div
            style={{
              maxWidth: 380,
              margin: '60px auto',
              background: '#1E293B',
              border: '1px solid #334155',
              borderRadius: 16,
              padding: '24px 20px',
              textAlign: 'center',
              userSelect: 'none',
              zIndex: 6,
            }}
          >
            <div style={{ width: 60, height: 60, borderRadius: 30, background: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <MdiIcon path={mdiLockCheck} size={32} color="#4ADE80" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 10 }}>Secret Chat</div>
            <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'left', margin: '0 auto', maxWidth: 280, lineHeight: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
                <MdiIcon path={mdiCheck} size={16} color="#4ADE80" />
                <span>End-to-end encryption (E2EE)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
                <MdiIcon path={mdiCheck} size={16} color="#4ADE80" />
                <span>Leave no traces on server</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
                <MdiIcon path={mdiCheck} size={16} color="#4ADE80" />
                <span>Messages stored on device only</span>
              </div>
            </div>

            {selectedChatUser.keyFingerprint ? (
              <div style={{ marginTop: 15, padding: '12px 6px', background: '#0F172A', borderRadius: 8 }}>
                <div style={{ fontFamily: 'Consolas, monospace', fontWeight: 'bold', color: '#F8FAFC', fontSize: 14 }}>
                  {selectedChatUser.keyFingerprint}
                </div>
                <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>Encryption Key Fingerprint</div>
              </div>
            ) : (
              <div style={{ marginTop: 15, padding: '12px 6px', background: '#0F172A', borderRadius: 8, color: '#F59E0B', fontSize: 12.5, fontWeight: 600 }}>
                Waiting for user to connect...
              </div>
            )}
          </div>
        )}

        {/* Виртуализированный скроллер сообщений */}
        <div
          ref={scrollRef}
          className="wpf-scroll-viewer"
          onScroll={handleScroll}
          style={{
            width: '100%',
            height: '100%',
            overflowY: 'auto',
            position: 'relative',
            paddingBottom: 110, // место под поле ввода
            boxSizing: 'border-box',
          }}
        >
          <div style={{ height: `${totalContentHeight}px`, position: 'relative', width: '100%' }}>
            {(visibleItems || []).map((item) => (
              <MessageItem
                key={item.id || item.serverId}
                model={item}
                isSelectionMode={isSelectionMode}
                onToggleSelect={toggleSelectMessage}
                onReply={addReplyMessage}
                onEdit={setEditMessage}
                onPin={(msg) => togglePinMessage(msg, true)}
                onDelete={(msg) => deleteMessage(msg, true)}
                onForward={(msg) => forwardMessages([msg])}
                onScrollToMessage={(id) => {
                  const target = (layoutItems || []).find((m) => m.id === id || m.serverId === id);
                  if (target) scrollToOffsetAnimated(target.yOffset - viewportHeight / 2);
                }}
              />
            ))}
          </div>
        </div>

        {/* ================= НИЖНИЙ ГРАДИЕНТНЫЙ ТУМАН И КНОПКА СКРОЛЛА ================= */}
        {/* 1. Эффект тумана (ChatFogTopColor -> ChatFogBottomColor, Height=100) */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 100,
            background: 'linear-gradient(to bottom, rgba(17,20,27,0) 0%, rgba(17,20,27,0.8) 40%, rgba(17,20,27,1) 100%)',
            pointerEvents: 'none',
            zIndex: 15,
          }}
        />

        {/* 2. Плавающая кнопка быстрого спуска вниз с бейджем непрочитанных */}
        <div
          style={{
            position: 'absolute',
            right: 34,
            bottom: 85,
            zIndex: 25,
            opacity: showScrollBottomBtn ? 1 : 0,
            transform: showScrollBottomBtn ? 'translateY(0)' : 'translateY(25px)',
            pointerEvents: showScrollBottomBtn ? 'auto' : 'none',
            transition: 'opacity 0.22s ease-out, transform 0.22s cubic-bezier(0.215, 0.61, 0.355, 1)',
          }}
        >
          <button
            onClick={scrollToBottom}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'var(--scroll-bottom-bg, #232A3B)',
              border: '1.2px solid var(--scroll-bottom-border, #2A303C)',
              color: 'var(--scroll-bottom-icon, #FFFFFF)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            }}
          >
            <MdiIcon path={mdiChevronDown} size={30} color="#FFFFFF" />
          </button>

          {unreadInChat > 0 && (
            <div
              style={{
                position: 'absolute',
                top: -10,
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'var(--app-accent)',
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
              {unreadInChat}
            </div>
          )}
        </div>

        {/* 3. Поле ввода сообщения (MessageInputUserControl, Margin 30,0,30,20) */}
        <div
          style={{
            position: 'absolute',
            left: 30,
            right: 30,
            bottom: 20,
            zIndex: 20,
          }}
        >
          <MessageInputUserControl />
        </div>
      </div>
    </div>
  );
};

// Вспомогательный компонент строки контекстного меню шапки
const HeaderMenuItem: React.FC<{
  icon: string;
  text: string;
  rotate?: number;
  iconColor?: string;
  isDestructive?: boolean;
  onClick: () => void;
}> = ({ icon, text, rotate, iconColor, isDestructive, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '8px 12px',
        margin: '1px 2px',
        borderRadius: 6,
        fontSize: 14,
        cursor: 'pointer',
        color: isDestructive ? '#FF3B30' : '#FFFFFF',
        backgroundColor: isHovered ? 'var(--context-menu-hover, #232A3B)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'background-color 0.1s ease',
      }}
    >
      <div style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined, display: 'flex', alignItems: 'center' }}>
        <MdiIcon path={icon} size={20} color={isDestructive ? '#FF3B30' : iconColor || '#FFFFFF'} />
      </div>
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
    </div>
  );
};

const headerIconBtnStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  padding: 0,
  transition: 'background-color 0.15s ease',
};

const headerActionBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#FFFFFF',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  padding: '6px 12px',
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
};

export default ChatWorkspaceView;