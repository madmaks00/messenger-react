import React, { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react';
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
import { getAvatarColor, normalizeAvatarUrl, formatChatSubtitle } from '../../utils/helpers';
import { userSession } from '../../services/userSession';
import { chatService } from '../../services/chat.service';
import { eventBus } from '../../services/eventBus';

const PALETTE = {
  bgChat: '#11141B',
  chatHeaderBg: '#161A23',
  chatHeaderBorder: '#1F2533',
  chatHeaderTitle: '#FFFFFF',
  accent: '#1E9BEB',
  accentMarker: '#5E92CE',
  tgCheckmark: '#80BFFF',
  textMuted: '#7D8494',
  activeButtonBg: 'rgba(255, 255, 255, 0.16)',
  pinnedPopupBg: '#1C212D',
  pinnedPopupBorder: '#2A303C',
  pinnedPopupHover: '#232A3B',
  contextMenuBg: '#1C212D',
  contextMenuBorder: '#2A303C',
  contextMenuHover: '#232A3B',
  contextMenuDivider: '#2A303C',
  destructive: '#FF3B30',
  emptyIconContainerBg: '#232A3B',
  scrollButtonBg: '#232A3B',
  scrollButtonBorder: '#2A303C',
  fogTop: 'rgba(17, 20, 27, 0)',
  fogMid: 'rgba(17, 20, 27, 0.8)',
  fogBottom: '#11141B',
};

const MdiIcon: React.FC<{ path: string; size?: number; color?: string; style?: React.CSSProperties }> = ({
  path,
  size = 20,
  color = 'currentColor',
  style,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill={color === 'inherit' ? 'currentColor' : color}
    style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle', ...style }}
  >
    <path d={path} />
  </svg>
);

export const ChatWorkspaceView: React.FC = () => {
  const {
    selectedChatUser,
    currentChatMessages = [],
    isHistoryLoading,
    isBlockedByThem,
    isSelectionMode,
    selectedCount,
    pinnedMessages = [],
    isChatSearchMode,
    togglePinMessage,
    deleteMessage,
    toggleSelectMessage,
    clearSelection,
    forwardMessages,
    markAsRead,
  } = useChatStore();

  const { togglePinChat, toggleMuteChat, clearChatHistory, deleteChat, currentSidebarChat } = useSidebarChatsStore();
  const { openProfile } = useNavigationStore();
  const { setEditMessage, addReplyMessage } = useMessageInputStore();

  const [isPinnedPopupOpen, setIsPinnedPopupOpen] = useState(false);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const isAtBottomRef = useRef(true);
  const animFrameRef = useRef<number | null>(null);

  // 🟢 1 В 1 С WPF: ЯКОРНОЕ ПОЗИЦИОНИРОВАНИЕ (anchorMsgId + anchorRelativeOffset)
  const isLoadingHistoryRef = useRef(false); // Аналог SmoothScrollViewerHelper.IsLoadingHistory
  const pendingAnchorRef = useRef<{ anchorMsgId: number; anchorRelativeOffset: number } | null>(null);
  const prevLastMessageIdRef = useRef<number | null>(null);
  const prevChatIdRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef<number>(0);

  // Закрытие попапов при клике вовне
  useEffect(() => {
    const handleOutside = () => {
      setIsPinnedPopupOpen(false);
      setIsHeaderMenuOpen(false);
    };
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, []);

  // ================= РАСЧЕТ ВЫСОТЫ И ЛЕЙАУТА (1 В 1 С TelegramVirtualizingPanel.cs) =================
  const { layoutItems, totalContentHeight } = useMemo(() => {
    const msgs = currentChatMessages || [];
    if (msgs.length === 0) return { layoutItems: [], totalContentHeight: 0 };

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
      const lastItem = items.length > 0 ? items[items.length - 1] : null;

      // 🟢 В WPF: TotalContentHeight = last.YOffset + last.TotalHeight + 82.0;
      const exactTotalHeight = lastItem ? Math.ceil(lastItem.yOffset + lastItem.totalHeight + 82.0) : 0;

      return {
        layoutItems: Array.isArray(items) ? items : [],
        totalContentHeight: exactTotalHeight,
      };
    } catch (err) {
      console.error('[ChatWorkspaceView] Layout calculation error:', err);
      return { layoutItems: [], totalContentHeight: 0 };
    }
  }, [currentChatMessages, selectedChatUser]);

  // Бинарный поиск видимых элементов
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

  // ================= V-SYNC ПЛАВНЫЙ СКРОЛЛ =================
  const scrollToOffsetAnimated = useCallback((targetOffset: number, onCompleted?: () => void) => {
    if (!scrollRef.current) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    let startOffset = scrollRef.current.scrollTop;
    const distance = targetOffset - startOffset;

    if (Math.abs(distance) < 5) {
      scrollRef.current.scrollTop = targetOffset;
      onCompleted?.();
      return;
    }

    if (Math.abs(distance) > 700) {
      startOffset = targetOffset - 500 * Math.sign(distance);
      scrollRef.current.scrollTop = startOffset;
    }

    const durationMs = 200.0;
    const startTime = performance.now();

    const frame = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);
      const easeOut = 1.0 - Math.pow(1.0 - progress, 3.0);

      if (scrollRef.current) {
        scrollRef.current.scrollTop = startOffset + (targetOffset - startOffset) * easeOut;
      }

      if (progress < 1.0) {
        animFrameRef.current = requestAnimationFrame(frame);
      } else {
        animFrameRef.current = null;
        if (scrollRef.current) scrollRef.current.scrollTop = targetOffset;
        onCompleted?.();
      }
    };
    animFrameRef.current = requestAnimationFrame(frame);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (!scrollRef.current) return;
    const maxScroll = Math.max(0, scrollRef.current.scrollHeight - scrollRef.current.clientHeight);
    scrollToOffsetAnimated(maxScroll, () => {
      isAtBottomRef.current = true;
      setShowScrollBottomBtn(false);
    });
  }, [scrollToOffsetAnimated]);

  // 🟢 1. АВТОСКРОЛЛ В САМЫЙ НИЗ ТОЛЬКО ПРИ ПЕРВОНАЧАЛЬНОМ ОТКРЫТИИ ЧАТА
  useLayoutEffect(() => {
    if (!scrollRef.current || !selectedChatUser) return;

    const chatId = selectedChatUser.id;
    const chatChanged = chatId !== prevChatIdRef.current;

    if (chatChanged && !isHistoryLoading && totalContentHeight > 0 && currentChatMessages.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setScrollTop(scrollRef.current.scrollHeight);
      isAtBottomRef.current = true;
      setShowScrollBottomBtn(false);
      prevChatIdRef.current = chatId;

      const lastMsg = currentChatMessages[currentChatMessages.length - 1];
      prevLastMessageIdRef.current = lastMsg ? (lastMsg.id || lastMsg.serverId) : null;
    }
  }, [selectedChatUser?.id, isHistoryLoading, totalContentHeight, currentChatMessages]);

  // 🟢 2. БЕСШОВНОЕ ВОССТАНОВЛЕНИЕ СКРОЛЛА (1 в 1 с WPF RefreshCanvasLayoutAsync)
  useLayoutEffect(() => {
    if (pendingAnchorRef.current && scrollRef.current && layoutItems.length > 0) {
      const { anchorMsgId, anchorRelativeOffset } = pendingAnchorRef.current;
      pendingAnchorRef.current = null;

      // Ищем сообщение-якорь в пересчитанном лейауте
      const anchorItem = layoutItems.find((m) => m.id === anchorMsgId || (m.serverId > 0 && m.serverId === anchorMsgId));

      if (anchorItem) {
        // Выставляем скролл ТОЧНО на новую позицию якоря со старым смещением
        const targetOffset = Math.max(0, anchorItem.yOffset + anchorRelativeOffset);
        scrollRef.current.scrollTop = targetOffset;
        setScrollTop(targetOffset);
      }
    }
  }, [layoutItems]);

  // 🟢 3. СКРОЛЛ ВНИЗ ТОЛЬКО ПРИ ДОБАВЛЕНИИ В КОНЕЦ (1 в 1 с WPF isAddedAtBottom)
  useEffect(() => {
    if (currentChatMessages.length === 0) {
      prevLastMessageIdRef.current = null;
      return;
    }

    const lastMsg = currentChatMessages[currentChatMessages.length - 1];
    const lastMsgId = lastMsg.id || lastMsg.serverId;

    // В WPF: bool isAddedAtBottom = e.NewStartingIndex >= Count - 1;
    const isAddedAtBottom = prevLastMessageIdRef.current !== null && lastMsgId !== prevLastMessageIdRef.current;
    prevLastMessageIdRef.current = lastMsgId;

    // ⛔ Если идет подгрузка старых сообщений наверх — НИКОГДА НЕ СКРОЛЛИМ ВНИЗ!
    if (isLoadingHistoryRef.current || pendingAnchorRef.current !== null) {
      return;
    }

    // 🟢 В WPF: bool shouldScroll = isAddedAtBottom && (_isAtBottom || isMyMessage);
    if (isAddedAtBottom) {
      const isMy = lastMsg.isMyMessage;
      if (isAtBottomRef.current || isMy) {
        scrollToBottom();
      }
    }
  }, [currentChatMessages, scrollToBottom]);

  // 🟢 4. ПОДГРУЗКА СТАРОЙ ИСТОРИИ (1 в 1 с WPF LoadOlderHistoryAsync)
  const handleLoadOlderHistory = async () => {
    if (
      isLoadingHistoryRef.current ||
      !scrollRef.current ||
      !selectedChatUser ||
      currentChatMessages.length === 0 ||
      layoutItems.length === 0
    ) {
      return;
    }

    isLoadingHistoryRef.current = true;

    try {
      const currentScrollOffset = scrollRef.current.scrollTop;

      // 1. В WPF: long anchorMsgId = FastChatPanel.GetFirstVisibleMessageId(currentScrollOffset);
      const firstVisible = layoutItems.find((m) => m.yOffset + m.totalHeight >= currentScrollOffset) || layoutItems[0];
      if (!firstVisible) {
        isLoadingHistoryRef.current = false;
        return;
      }

      const anchorMsgId = firstVisible.id || (firstVisible as any).serverId;
      const anchorRelativeOffset = currentScrollOffset - firstVisible.yOffset;

      // 2. В WPF: var oldMessages = await vm.GetOlderMessagesDataAsync();
      const oldestTime = currentChatMessages[0].timestamp;
      const older = await chatService.getLocalMessagesAsync(
        userSession.userId,
        selectedChatUser.isGroup ? null : selectedChatUser.id,
        selectedChatUser.isGroup ? selectedChatUser.id : null,
        selectedChatUser.isSecretChat ? selectedChatUser.secretChatId : null,
        30,
        oldestTime
      );

      // 3. В WPF: vm.CurrentChatMessages.Insert(0, msg); await RefreshCanvasLayoutAsync(anchorMsgId, anchorRelativeOffset);
      if (older && older.length > 0) {
        pendingAnchorRef.current = {
          anchorMsgId,
          anchorRelativeOffset,
        };

        useChatStore.setState((state) => ({
          currentChatMessages: [...older, ...state.currentChatMessages],
        }));
      }
    } catch (err) {
      console.error('[ChatWorkspaceView] Load older history error:', err);
    } finally {
      setTimeout(() => {
        isLoadingHistoryRef.current = false;
      }, 150);
    }
  };

  // 🟢 5. ОБРАБОТЧИК СКРОЛЛА (1 в 1 с WPF ChatScrollViewer_ScrollChanged)
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const currentScroll = target.scrollTop;
    const verticalChange = currentScroll - lastScrollTopRef.current;
    lastScrollTopRef.current = currentScroll;

    setScrollTop(currentScroll);

    const distanceFromBottom = target.scrollHeight - currentScroll - target.clientHeight;
    const atBottom = distanceFromBottom < 25;
    isAtBottomRef.current = atBottom;

    setShowScrollBottomBtn(distanceFromBottom > 60);

    if (atBottom) {
      markAsRead();
    }

    // 🟢 В WPF: if (e.VerticalChange < 0 && scrollViewer.VerticalOffset < 50 && !IsLoadingHistory)
    if (verticalChange < 0 && currentScroll < 80 && !isLoadingHistoryRef.current && !isHistoryLoading) {
      handleLoadOlderHistory();
    }
  };

  // Сохранение положения при изменении размера окна
  useEffect(() => {
    const handleResize = () => {
      if (scrollRef.current) {
        setViewportHeight(scrollRef.current.clientHeight);
        if (isAtBottomRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // ================= ЗАГЛУШКА: ЧАТ НЕ ВЫБРАН =================
  if (!selectedChatUser) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: PALETTE.bgChat }}>
        <div
          style={{
            padding: '10px 20px',
            borderRadius: 20,
            background: PALETTE.contextMenuBg,
            border: `1.2px solid ${PALETTE.contextMenuBorder}`,
            color: '#FFFFFF',
            fontSize: 15,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            userSelect: 'none',
          }}
        >
          <MdiIcon path={mdiMessageTextOutline} size={20} color={PALETTE.accent} />
          <span>Select a chat to start messaging</span>
        </div>
      </div>
    );
  }

  const msgs = currentChatMessages || [];

  const avatarRaw =
    selectedChatUser?.avatarPath ||
    (selectedChatUser as any)?.avatar ||
    (selectedChatUser as any)?.Avatar ||
    (selectedChatUser as any)?.AvatarPath ||
    (selectedChatUser as any)?.avatarUrl ||
    (selectedChatUser as any)?.photo ||
    currentSidebarChat?.avatarPath ||
    (currentSidebarChat as any)?.avatar ||
    (currentSidebarChat as any)?.Avatar;

  const avatarSrc = normalizeAvatarUrl(avatarRaw) || (typeof avatarRaw === 'string' && avatarRaw ? avatarRaw : null);
  const displayName = selectedChatUser?.nickName || currentSidebarChat?.nickName || (selectedChatUser as any)?.groupName || 'Chat';
  const firstLetter = (displayName || 'U').charAt(0).toUpperCase();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: PALETTE.bgChat, position: 'relative', overflow: 'hidden' }}>
      
      {/* ================= ШАПКА ЧАТА (54px) ================= */}
      <div
        style={{
          height: 54,
          minHeight: 54,
          background: PALETTE.chatHeaderBg,
          borderBottom: `1px solid ${PALETTE.chatHeaderBorder}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 5px 0 15px',
          zIndex: 100,
          userSelect: 'none',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {isSelectionMode ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={clearSelection}
                title="Cancel Selection"
                style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                <MdiIcon path={mdiClose} size={20} color="#FFFFFF" />
              </button>
              <span style={{ fontWeight: 'bold', fontSize: 18, color: '#FFFFFF' }}>
                Selected: {selectedCount}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 10 }}>
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
                style={{ ...headerActionBtnStyle, color: PALETTE.accent }}
              >
                <MdiIcon path={mdiShareOutline} size={18} color={PALETTE.accent} style={{ marginRight: 6 }} />
                <span>Forward</span>
              </button>

              <button
                onClick={() => {
                  const selected = msgs.filter((m) => m.isSelected);
                  selected.forEach((m) => deleteMessage(m, true));
                  clearSelection();
                }}
                style={{ ...headerActionBtnStyle, color: PALETTE.destructive }}
              >
                <MdiIcon path={mdiDeleteOutline} size={18} color={PALETTE.destructive} style={{ marginRight: 6 }} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div
              onClick={() => openProfile?.()}
              style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', minWidth: 0, flex: 1 }}
            >
              <div style={{ position: 'relative', width: 40, height: 40, marginRight: 12, flexShrink: 0 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: getAvatarColor(
                      selectedChatUser.id || (selectedChatUser as any).userId || currentSidebarChat?.userId || 0
                    ),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: 14,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <span>{firstLetter}</span>
                  {avatarSrc && (
                    <img
                      src={avatarSrc}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                </div>
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 1 }}>
                  {selectedChatUser.isSecretChat && (
                    <MdiIcon path={mdiLock} size={16} color={PALETTE.chatHeaderTitle} style={{ marginRight: 5 }} />
                  )}
                  <span style={{ color: PALETTE.chatHeaderTitle, fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </span>
                </div>

                <div style={{ fontSize: 12.5, lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 4 }}>
  {selectedChatUser.isTyping ? (
    <span style={{ color: PALETTE.accent, fontWeight: 600 }}>typing...</span>
  ) : selectedChatUser.isGroup && !selectedChatUser.isChannel ? (
    <>
      <span style={{ color: selectedChatUser.onlineCount ? PALETTE.accent : PALETTE.textMuted, fontWeight: 600 }}>
        {selectedChatUser.onlineCount || 0} online
      </span>
      <span style={{ color: PALETTE.textMuted }}>• {selectedChatUser.memberCount || 1} members</span>
    </>
  ) : selectedChatUser.isChannel ? (
    <span style={{ color: PALETTE.textMuted }}>{selectedChatUser.memberCount || 1} subscribers</span>
  ) : selectedChatUser.isSecretChat ? null : (
    /* 🟢 1 в 1 с ChatSubtitleConverter.cs и PersonalStatusText в XAML */
    <span style={{ color: selectedChatUser.isOnline ? PALETTE.accent : PALETTE.textMuted }}>
      {isBlockedByThem ? 'last seen a long time ago' : formatChatSubtitle(selectedChatUser as any)}
    </span>
  )}
</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ position: 'relative' }}>
                <HeaderIconButton
                  isActive={isPinnedPopupOpen}
                  title="Pinned Messages"
                  onClick={() => {
                    setIsPinnedPopupOpen((prev) => !prev);
                    setIsHeaderMenuOpen(false);
                  }}
                >
                  <div style={{ transform: 'rotate(45deg)', display: 'flex', alignItems: 'center' }}>
                    <MdiIcon path={mdiPin} size={22} />
                  </div>
                </HeaderIconButton>

                {isPinnedPopupOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 48,
                      minWidth: 270,
                      maxWidth: 350,
                      maxHeight: 380,
                      backgroundColor: PALETTE.pinnedPopupBg,
                      border: `1.2px solid ${PALETTE.pinnedPopupBorder}`,
                      borderRadius: 12,
                      padding: '6px 8px 2px 6px',
                      zIndex: 1000,
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 8px 25px rgba(0,0,0,0.45)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 8px 4px', borderBottom: `1px solid ${PALETTE.pinnedPopupBorder}`, margin: '0 0 6px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ transform: 'rotate(45deg)', display: 'flex' }}>
                          <MdiIcon path={mdiPinOutline} size={16} color={PALETTE.accent} />
                        </div>
                        <span style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 13.5 }}>Pinned Messages</span>
                      </div>
                      {pinnedMessages.length > 0 && (
                        <div style={{ background: PALETTE.accent, color: '#FFFFFF', borderRadius: 9, padding: '2px 7px', fontSize: 11, fontWeight: 'bold' }}>
                          {pinnedMessages.length}
                        </div>
                      )}
                    </div>

                    <div className="wpf-scroll-viewer" style={{ flex: 1, overflowY: 'auto', maxHeight: 300 }}>
                      {pinnedMessages.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '25px 15px', color: PALETTE.textMuted }}>
                          <MdiIcon path={mdiPinOffOutline} size={32} color={PALETTE.textMuted} style={{ marginBottom: 8 }} />
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
                              margin: '0 1px 4px 1px',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = PALETTE.pinnedPopupHover)}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <div style={{ width: 3, backgroundColor: PALETTE.accentMarker, borderRadius: 1.5 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                <span style={{ color: PALETTE.tgCheckmark, fontWeight: 'bold', fontSize: 12.5 }}>
                                  {pin.senderName || 'User'}
                                </span>
                                <span style={{ color: PALETTE.textMuted, fontSize: 11 }}>
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

              <HeaderIconButton
                isActive={isChatSearchMode}
                title="Search"
                onClick={() => {
                  const store = useChatStore.getState() as any;
                  if (typeof store.startChatSearch === 'function') store.startChatSearch();
                  else if (typeof store.enterSearch === 'function') store.enterSearch();
                  else if (typeof store.setIsChatSearchMode === 'function') store.setIsChatSearchMode(true);
                  eventBus.emit('FocusSearchBoxMessage' as any, undefined);
                }}
              >
                <MdiIcon path={mdiMagnify} size={22} />
              </HeaderIconButton>

              {!selectedChatUser.isChannel && (
                <HeaderIconButton
                  title="Call"
                  onClick={() => eventBus.emit('StartCallMessage' as any, { user: selectedChatUser })}
                >
                  <MdiIcon path={mdiPhoneOutline} size={24} />
                </HeaderIconButton>
              )}

              <div style={{ position: 'relative' }}>
                <HeaderIconButton
                  isActive={isHeaderMenuOpen}
                  title="More options"
                  onClick={() => {
                    setIsHeaderMenuOpen((prev) => !prev);
                    setIsPinnedPopupOpen(false);
                  }}
                >
                  <MdiIcon path={mdiDotsVertical} size={24} />
                </HeaderIconButton>

                {isHeaderMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 48,
                      minWidth: 180,
                      backgroundColor: PALETTE.contextMenuBg,
                      border: `1.2px solid ${PALETTE.contextMenuBorder}`,
                      borderRadius: 10,
                      padding: '4px 0',
                      zIndex: 1000,
                      boxShadow: '0 8px 25px rgba(0,0,0,0.45)',
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
                        if (currentSidebarChat) togglePinChat(currentSidebarChat);
                      }}
                    />

                    <HeaderMenuItem
                      icon={currentSidebarChat?.isMuted ? mdiBellOutline : mdiBellOffOutline}
                      text={currentSidebarChat?.isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        if (currentSidebarChat) toggleMuteChat(currentSidebarChat);
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

                    <div style={{ height: 1, backgroundColor: PALETTE.contextMenuDivider, margin: '4px 2px' }} />

                    <HeaderMenuItem
                      icon={mdiBroom}
                      text="Clear History"
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        if (currentSidebarChat) clearChatHistory(currentSidebarChat, false);
                      }}
                    />

                    <HeaderMenuItem
                      icon={mdiDeleteOutline}
                      text="Delete Chat"
                      isDestructive
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        if (currentSidebarChat) deleteChat(currentSidebarChat);
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

      {/* ================= ОБЛАСТЬ СООБЩЕНИЙ ================= */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        
        {isHistoryLoading && msgs.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5, color: PALETTE.textMuted }}>
            <div style={{ fontSize: 15 }}>Loading history...</div>
          </div>
        )}

        {!selectedChatUser.isSecretChat && msgs.length === 0 && !isHistoryLoading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5, userSelect: 'none', marginBottom: 50 }}>
            <div style={{ width: 100, height: 100, borderRadius: 50, background: PALETTE.emptyIconContainerBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <MdiIcon path={selectedChatUser.isChannel ? mdiBullhornOutline : mdiMessageTextOutline} size={50} color={PALETTE.accent} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 }}>
              {selectedChatUser.isChannel ? 'No posts yet' : 'No messages yet'}
            </div>
            <div style={{ fontSize: 14, color: PALETTE.textMuted }}>
              {selectedChatUser.isChannel ? 'When posts are published, they will appear here.' : 'Send a message to start the conversation'}
            </div>
          </div>
        )}

        {/* ВИРТУАЛИЗИРОВАННЫЙ СКРОЛЛЕР */}
        <div
          ref={scrollRef}
          className="wpf-scroll-viewer"
          onScroll={handleScroll}
          style={{
            position: 'absolute',
            inset: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
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

        {/* ================= ОБЪЕДИНЕННЫЙ НИЖНИЙ СТЕК ================= */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            pointerEvents: 'none',
          }}
        >
          {/* 1. Эффект тумана */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 100,
              background: `linear-gradient(to bottom, ${PALETTE.fogTop} 0%, ${PALETTE.fogMid} 40%, ${PALETTE.fogBottom} 100%)`,
              pointerEvents: 'none',
              zIndex: 5,
            }}
          />

          {/* 2. Кнопка спуска вниз */}
          <div
            style={{
              position: 'absolute',
              right: 34,
              bottom: 80,
              zIndex: 10,
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
                backgroundColor: PALETTE.scrollButtonBg,
                border: `1.2px solid ${PALETTE.scrollButtonBorder}`,
                color: '#FFFFFF',
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
          </div>

          {/* 3. Модульный инпут */}
          <div
            style={{
              margin: '0 30px 20px 30px',
              position: 'relative',
              zIndex: 10,
              pointerEvents: 'auto',
            }}
          >
            <MessageInputUserControl />
          </div>
        </div>

      </div>
    </div>
  );
};

const HeaderIconButton: React.FC<{
  isActive?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ isActive = false, title, onClick, children }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={title}
      style={{
        width: 44,
        height: 44,
        backgroundColor: isActive
          ? PALETTE.activeButtonBg
          : isHovered
          ? 'rgba(255, 255, 255, 0.08)'
          : 'transparent',
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
        WebkitTapHighlightColor: 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        padding: 0,
        color: isActive || isHovered ? '#FFFFFF' : PALETTE.textMuted,
        transition: 'background-color 0.15s ease, color 0.15s ease',
      }}
    >
      {children}
    </button>
  );
};

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
        padding: '7px 24px 7px 8px',
        margin: '1px 2px',
        borderRadius: 6,
        fontSize: 14,
        cursor: 'pointer',
        color: isDestructive ? PALETTE.destructive : '#FFFFFF',
        backgroundColor: isHovered ? PALETTE.contextMenuHover : 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'background-color 0.1s ease',
      }}
    >
      <div style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined, display: 'flex', alignItems: 'center' }}>
        <MdiIcon path={icon} size={20} color={isDestructive ? PALETTE.destructive : iconColor || '#FFFFFF'} />
      </div>
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
    </div>
  );
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