import React, { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  mdiLock,
  mdiLockCheck,
  mdiCheck,
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
  mdiChevronDown,
} from '@mdi/js';

import { useChatStore } from '../../stores/chatStore';
import { useMessageInputStore } from '../../stores/messageInputStore';
import { useSidebarChatsStore } from '../../stores/sidebarChatsStore';
import { useNavigationStore } from '../../stores/navigationStore';
import { useVideoViewerStore } from '../../stores/videoViewerStore';
import { MessageInputUserControl } from './MessageInputUserControl';
import { MessageItem } from './MessageItem';
import { PhotoViewerView } from '../media/PhotoViewerView';
import { VideoViewerView } from '../media/VideoViewerView';
import { AsyncChatLayoutEngine } from '../../utils/chatLayoutEngine';
import { getAvatarColor, normalizeAvatarUrl, formatChatSubtitle } from '../../utils/helpers';
import { userSession } from '../../services/userSession';
import { chatService } from '../../services/chat.service';
import { eventBus } from '../../services/eventBus';
import { IAttachment, AttachmentHelper } from '../../types/models';
import { AttachmentType } from '../../types/enums';

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
  secretChatCardBg: '#1E293B',
  secretChatCardBorder: '#334155',
  secretChatBadgeBg: '#166534',
  secretChatBadgeIcon: '#4ADE80',
  secretChatFingerprintBg: '#0F172A',
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
    startSearch,
    exitSearch,
    togglePinMessage,
    deleteMessage,
    toggleSelectMessage,
    clearSelection,
    forwardMessages,
    markAsRead,
  } = useChatStore();

  const { togglePinChat, toggleMuteChat, clearChatHistory, deleteChat, currentSidebarChat } = useSidebarChatsStore();
  const { openUserProfile, openGroupProfile } = useNavigationStore();
  const { setEditMessage, addReplyMessage } = useMessageInputStore();

  const [isPinnedPopupOpen, setIsPinnedPopupOpen] = useState<boolean>(false);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState<boolean>(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState<boolean>(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);

  // Состояние просмотра фото
  const [photoViewerState, setPhotoViewerState] = useState<{
    isOpen: boolean;
    mediaList: IAttachment[];
    startIndex: number;
  }>({
    isOpen: false,
    mediaList: [],
    startIndex: 0,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [viewportHeight, setViewportHeight] = useState<number>(600);
  const isAtBottomRef = useRef<boolean>(true);
  const isScrollingToTargetRef = useRef<boolean>(false);
  const animFrameRef = useRef<number | null>(null);
  const isSmoothScrollingRef = useRef<boolean>(false);

  const isLoadingHistoryRef = useRef<boolean>(false);
  const pendingAnchorRef = useRef<{ anchorMsgId: number; anchorRelativeOffset: number } | null>(null);
  const prevChatIdRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef<number>(0);

  const prevTotalHeightRef = useRef<number>(0);
  const prevMessagesLengthRef = useRef<number>(0);
  const prevLastMsgIdRef = useRef<number | null>(null);

  // 1. Открытие полноэкранного просмотрщика фото
  const handleOpenPhotoGallery = useCallback((clickedAtt: IAttachment, clickedMsgId?: number) => {
    if (!clickedAtt) return;

    const allChatPhotos: IAttachment[] = [];
    let calculatedStartIndex = -1;
    const msgs = currentChatMessages || [];

    for (let mIdx = 0; mIdx < msgs.length; mIdx++) {
      const msg = msgs[mIdx];
      const msgId = Number(msg.id || msg.serverId || 0);
      const isTargetMsg = clickedMsgId && clickedMsgId > 0
        ? (msgId === clickedMsgId || (msg.serverId > 0 && msg.serverId === clickedMsgId))
        : false;

      const attachments = msg.attachments || [];
      for (let aIdx = 0; aIdx < attachments.length; aIdx++) {
        const att = attachments[aIdx];
        const isPhoto = att.type === AttachmentType.Photo || (!att.type && att.url && !att.hasAudio);

        if (isPhoto) {
          allChatPhotos.push(att);
          const currentPhotoIndex = allChatPhotos.length - 1;

          if (isTargetMsg && calculatedStartIndex === -1) {
            const isSame =
              att === clickedAtt ||
              (att.url && clickedAtt.url && att.url === clickedAtt.url) ||
              (att.fileHash && clickedAtt.fileHash && att.fileHash === clickedAtt.fileHash) ||
              (att.fileName && clickedAtt.fileName && att.fileName === clickedAtt.fileName);

            if (isSame) {
              calculatedStartIndex = currentPhotoIndex;
            }
          } else if (att === clickedAtt && calculatedStartIndex === -1) {
            calculatedStartIndex = currentPhotoIndex;
          }
        }
      }
    }

    if (calculatedStartIndex === -1) {
      for (let i = allChatPhotos.length - 1; i >= 0; i--) {
        const a = allChatPhotos[i];
        if (
          a === clickedAtt ||
          (a.url && clickedAtt.url && a.url === clickedAtt.url) ||
          (a.fileHash && clickedAtt.fileHash && a.fileHash === clickedAtt.fileHash)
        ) {
          calculatedStartIndex = i;
          break;
        }
      }
    }

    if (calculatedStartIndex === -1) {
      allChatPhotos.push(clickedAtt);
      calculatedStartIndex = allChatPhotos.length - 1;
    }

    setPhotoViewerState({
      isOpen: true,
      mediaList: allChatPhotos,
      startIndex: Math.max(0, calculatedStartIndex),
    });
  }, [currentChatMessages]);

  // 2. Универсальный диспетчер клика по медиа (фото -> галерея, видео -> VideoViewerView)
  const handleMediaItemClick = useCallback(
    (clickedAtt: IAttachment, clickedMsgId?: number) => {
      if (!clickedAtt) return;

      const isVideo = AttachmentHelper.isVideo(clickedAtt) || clickedAtt.type === AttachmentType.Video;
      const isSilent = AttachmentHelper.isSilentVideo(clickedAtt);

      // Видео со звуком -> открываем VideoViewerView (аналог MediaHelper.WatchVideo в C#)
      if (isVideo && !isSilent) {
        const senderName = selectedChatUser?.nickName || 'User';
        useVideoViewerStore.getState().open(
          clickedAtt.url,
          clickedAtt.fileName || 'Video',
          senderName
        );
        return;
      }

      // Фото или GIF -> открываем PhotoViewerView
      handleOpenPhotoGallery(clickedAtt, clickedMsgId);
    },
    [selectedChatUser, handleOpenPhotoGallery]
  );

  // 3. Открытие профиля текущего чата
  const handleOpenCurrentChatProfile = useCallback(() => {
    if (!selectedChatUser) return;

    const anyChat = selectedChatUser as any;
    const targetGroupId = Number(
      selectedChatUser.groupId ||
      anyChat.GroupId ||
      (selectedChatUser.isGroup ? selectedChatUser.id : 0) ||
      0
    );

    const targetUserId = Number(
      selectedChatUser.userId ||
      anyChat.UserId ||
      (!selectedChatUser.isGroup ? selectedChatUser.id : 0) ||
      0
    );

    if (selectedChatUser.isGroup && targetGroupId > 0) {
      void openGroupProfile({
        ...selectedChatUser,
        id: targetGroupId,
        groupId: targetGroupId,
      });
    } else if (!selectedChatUser.isGroup && targetUserId > 0) {
      useNavigationStore.setState({
        isProfileOpen: true,
        isOwnProfile: false,
        isGroupProfile: false,
        profileUser: {
          ...selectedChatUser,
          id: targetUserId,
          nickName: selectedChatUser.nickName,
          username: anyChat.username || selectedChatUser.nickName,
          avatarPath: selectedChatUser.avatarPath || anyChat.avatar,
          isOnline: selectedChatUser.isOnline,
        } as any,
      });

      void (openUserProfile as any)(targetUserId, selectedChatUser);
    }
  }, [selectedChatUser, openGroupProfile, openUserProfile]);

  useEffect(() => {
    const handleOutside = () => {
      setIsPinnedPopupOpen(false);
      setIsHeaderMenuOpen(false);
    };
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, []);

  // 4. Расчет разметки сообщений через Virtualizing Engine
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

      const items = Array.isArray(result) ? result : (result as any).items || (result as any).layoutItems || [];
      const lastItem = items.length > 0 ? items[items.length - 1] : null;

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

  const layoutItemsRef = useRef(layoutItems);
  layoutItemsRef.current = layoutItems;

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

  // 5. Плавная прокрутка к смещению (анимация CubicEaseOut)
  const scrollToOffsetAnimated = useCallback((targetOffset: number, onCompleted?: () => void) => {
    if (!scrollRef.current) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    let startOffset = scrollRef.current.scrollTop;
    const distance = Math.abs(targetOffset - startOffset);

    if (distance < 3) {
      scrollRef.current.scrollTop = targetOffset;
      onCompleted?.();
      return;
    }

    if (distance > 900) {
      startOffset = startOffset > targetOffset ? targetOffset + 450 : Math.max(0, targetOffset - 450);
      scrollRef.current.scrollTop = startOffset;
    }

    isSmoothScrollingRef.current = true;
    const durationMs = 240.0;
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
        isSmoothScrollingRef.current = false;
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
      prevLastMsgIdRef.current = lastMsg ? Number(lastMsg.id || lastMsg.serverId || 0) : null;
      prevMessagesLengthRef.current = currentChatMessages.length;
      prevTotalHeightRef.current = totalContentHeight;
    }
  }, [selectedChatUser?.id, isHistoryLoading, totalContentHeight, currentChatMessages]);

  useLayoutEffect(() => {
    if (pendingAnchorRef.current && scrollRef.current && layoutItems.length > 0) {
      const { anchorMsgId, anchorRelativeOffset } = pendingAnchorRef.current;
      pendingAnchorRef.current = null;

      const anchorItem = layoutItems.find((m) => m.id === anchorMsgId || (m.serverId > 0 && m.serverId === anchorMsgId));

      if (anchorItem) {
        const targetOffset = Math.max(0, anchorItem.yOffset + anchorRelativeOffset);
        scrollRef.current.scrollTop = targetOffset;
        setScrollTop(targetOffset);
      }
    }
  }, [layoutItems]);

  useLayoutEffect(() => {
    if (!scrollRef.current) return;

    const heightDiff = totalContentHeight - prevTotalHeightRef.current;
    prevTotalHeightRef.current = totalContentHeight;

    const msgs = currentChatMessages || [];
    const isCountIncreased = msgs.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = msgs.length;

    const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
    const lastMsgId = lastMsg ? Number(lastMsg.id || lastMsg.serverId || 0) : null;
    const isDifferentLastMsg = lastMsgId !== null && lastMsgId !== prevLastMsgIdRef.current;
    prevLastMsgIdRef.current = lastMsgId;

    if (isLoadingHistoryRef.current || pendingAnchorRef.current !== null || isScrollingToTargetRef.current) {
      return;
    }

    if (isCountIncreased && isDifferentLastMsg) {
      const isMy = Boolean(lastMsg?.isMyMessage);

      if (isAtBottomRef.current || isMy) {
        requestAnimationFrame(() => {
          scrollToBottom();
        });
        return;
      }
    }

    if (heightDiff > 0 && isAtBottomRef.current && !isScrollingToTargetRef.current && !isSmoothScrollingRef.current) {
      const maxScroll = Math.max(0, scrollRef.current.scrollHeight - scrollRef.current.clientHeight);
      scrollRef.current.scrollTop = maxScroll;
      setScrollTop(maxScroll);
    }
  }, [totalContentHeight, currentChatMessages, scrollToBottom]);

  const handleLoadOlderHistory = async () => {
    if (
      isLoadingHistoryRef.current ||
      isScrollingToTargetRef.current ||
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
      const firstVisible = layoutItems.find((m) => m.yOffset + m.totalHeight >= currentScrollOffset) || layoutItems[0];
      if (!firstVisible) {
        isLoadingHistoryRef.current = false;
        return;
      }

      const anchorMsgId = firstVisible.id || (firstVisible as any).serverId;
      const anchorRelativeOffset = currentScrollOffset - firstVisible.yOffset;

      const oldestTime = currentChatMessages[0].timestamp;
      const older = await chatService.getLocalMessagesAsync(
        userSession.userId,
        selectedChatUser.isGroup ? null : selectedChatUser.id,
        selectedChatUser.isGroup ? selectedChatUser.id : null,
        selectedChatUser.isSecretChat ? selectedChatUser.secretChatId : null,
        30,
        oldestTime
      );

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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const currentScroll = target.scrollTop;
    const verticalChange = currentScroll - lastScrollTopRef.current;
    lastScrollTopRef.current = currentScroll;

    setScrollTop(currentScroll);

    if (isScrollingToTargetRef.current || isSmoothScrollingRef.current) {
      return;
    }

    const distanceFromBottom = target.scrollHeight - currentScroll - target.clientHeight;
    const atBottom = distanceFromBottom < 30;
    isAtBottomRef.current = atBottom;

    setShowScrollBottomBtn(distanceFromBottom > 60);

    if (atBottom) {
      markAsRead();
    }

    if (verticalChange < 0 && currentScroll < 80 && !isLoadingHistoryRef.current && !isHistoryLoading) {
      handleLoadOlderHistory();
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (scrollRef.current) {
        setViewportHeight(scrollRef.current.clientHeight);
        if (isAtBottomRef.current && !isScrollingToTargetRef.current && !isSmoothScrollingRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 6. Подписка на событие ScrollToMessageRequestMessage
  useEffect(() => {
    const unbind = eventBus.on('ScrollToMessageRequestMessage' as any, async (payload: any) => {
      const msgId = Number(payload?.messageId ?? payload?.serverId ?? payload?.localId ?? 0);
      const pLocalId = Number(payload?.localId ?? 0);
      const pServerId = Number(payload?.serverId ?? 0);
      const pText = payload?.text;
      const pTime = payload?.timestamp ? new Date(payload.timestamp).getTime() : 0;

      const msgs = useChatStore.getState().currentChatMessages || [];

      let msgIndex = msgs.findIndex((m) => {
        const mLocalId = Number(m.id || 0);
        const mServerId = Number(m.serverId || 0);

        if (pServerId > 0 && mServerId > 0 && mServerId === pServerId) return true;
        if (pLocalId > 0 && mLocalId > 0 && mLocalId === pLocalId) return true;
        if (msgId > 0 && (mLocalId === msgId || (mServerId > 0 && mServerId === msgId))) return true;

        if (pText && m.text === pText && pTime > 0) {
          const mTime = new Date(m.timestamp).getTime();
          if (Math.abs(mTime - pTime) < 5000) return true;
        }

        return false;
      });

      if (msgIndex === -1 && msgId > 0) {
        await useChatStore.getState().ensureMessageLoadedAsync(msgId);
        const updatedMsgs = useChatStore.getState().currentChatMessages || [];
        msgIndex = updatedMsgs.findIndex((m) =>
          (Number(m.serverId) > 0 && Number(m.serverId) === msgId) || Number(m.id) === msgId
        );
      }

      if (msgIndex === -1) return;

      const targetMsg = (useChatStore.getState().currentChatMessages || [])[msgIndex];
      if (!targetMsg) return;

      const targetLocalId = Number(targetMsg.id);
      const targetServerId = Number(targetMsg.serverId);

      const currentLayout = layoutItemsRef.current || layoutItems || [];
      let targetLayout = currentLayout[msgIndex] || null;

      if (!targetLayout || Number(targetLayout.id) !== targetLocalId) {
        targetLayout = currentLayout.find((item: any) =>
          Number(item.id) === targetLocalId ||
          (targetServerId > 0 && Number(item.serverId) === targetServerId) ||
          (item.sourceMessage && (Number(item.sourceMessage.id) === targetLocalId || Number(item.sourceMessage.serverId) === targetServerId))
        ) || currentLayout[msgIndex];
      }

      if (!targetLayout || !scrollRef.current) return;

      isScrollingToTargetRef.current = true;
      isAtBottomRef.current = false;
      setShowScrollBottomBtn(true);

      const targetY = Number(targetLayout.yOffset ?? targetLayout.top ?? 0);
      const itemHeight = Number(targetLayout.totalHeight ?? targetLayout.height ?? 40);
      const viewportH = scrollRef.current.clientHeight || viewportHeight || 600;

      const centered = targetY - (viewportH / 2.0) + (itemHeight / 2.0);
      const maxScroll = Math.max(0, scrollRef.current.scrollHeight - viewportH);
      const finalOffset = Math.max(0, Math.min(centered, maxScroll));

      const highlightId = targetLocalId || targetServerId;

      scrollToOffsetAnimated(finalOffset, () => {
        setHighlightedMessageId(highlightId);

        setTimeout(() => {
          isScrollingToTargetRef.current = false;
        }, 120);

        setTimeout(() => {
          setHighlightedMessageId((curr) => (curr === highlightId ? null : curr));
        }, 1400);
      });
    });

    return () => unbind();
  }, [layoutItems, viewportHeight, scrollToOffsetAnimated]);

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
    currentSidebarChat?.avatarPath ||
    (currentSidebarChat as any)?.avatar;

  const avatarSrc = normalizeAvatarUrl(avatarRaw) || (typeof avatarRaw === 'string' && avatarRaw ? avatarRaw : null);
  const displayName = selectedChatUser?.nickName || currentSidebarChat?.nickName || (selectedChatUser as any)?.groupName || 'Chat';
  const firstLetter = (displayName || 'U').charAt(0).toUpperCase();

  const unreadCountInActiveChat = selectedChatUser.unreadCount || 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: PALETTE.bgChat, position: 'relative', overflow: 'hidden' }}>
      
      {/* 🟢 ШАПКА ЧАТА */}
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
              onClick={handleOpenCurrentChatProfile}
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
                  if (isChatSearchMode) {
                    exitSearch();
                  } else {
                    startSearch();
                  }
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
                        handleOpenCurrentChatProfile();
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

      {/* 🟢 ОБЛАСТЬ СООБЩЕНИЙ */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        
        {/* Заглушка 1: Загрузка истории чата */}
        {isHistoryLoading && msgs.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5, color: PALETTE.textMuted }}>
            <div style={{ fontSize: 15 }}>Loading history...</div>
          </div>
        )}

        {/* Заглушка 2: Пустой обычный чат или канал */}
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

        {/* Заглушка 3: Карточка Секретного Чата (Secret Chat Banner из XAML) */}
        {selectedChatUser.isSecretChat && msgs.length === 0 && !isHistoryLoading && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: PALETTE.secretChatCardBg,
              border: `1px solid ${PALETTE.secretChatCardBorder}`,
              borderRadius: 16,
              padding: '24px 20px',
              maxWidth: 380,
              width: '90%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 6,
              boxSizing: 'border-box',
              userSelect: 'none',
              marginBottom: 30,
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: PALETTE.secretChatBadgeBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <MdiIcon path={mdiLockCheck} size={32} color={PALETTE.secretChatBadgeIcon} />
            </div>

            <div style={{ color: '#F8FAFC', fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
              Secret Chat
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '5px 0', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <MdiIcon path={mdiCheck} size={16} color={PALETTE.secretChatBadgeIcon} style={{ marginRight: 8 }} />
                <span style={{ color: '#94A3B8', fontSize: 13 }}>End-to-end encryption (E2EE)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <MdiIcon path={mdiCheck} size={16} color={PALETTE.secretChatBadgeIcon} style={{ marginRight: 8 }} />
                <span style={{ color: '#94A3B8', fontSize: 13 }}>Leave no traces on server</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <MdiIcon path={mdiCheck} size={16} color={PALETTE.secretChatBadgeIcon} style={{ marginRight: 8 }} />
                <span style={{ color: '#94A3B8', fontSize: 13 }}>Messages stored on device only</span>
              </div>
            </div>

            {selectedChatUser.keyFingerprint ? (
              <div
                style={{
                  backgroundColor: PALETTE.secretChatFingerprintBg,
                  borderRadius: 8,
                  padding: '12px 16px',
                  marginTop: 15,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <span
                  style={{
                    color: '#F8FAFC',
                    fontSize: 14,
                    fontWeight: 'bold',
                    fontFamily: 'Consolas, monospace',
                    letterSpacing: '1px',
                  }}
                >
                  {selectedChatUser.keyFingerprint}
                </span>
                <span style={{ color: '#64748B', fontSize: 10.5, marginTop: 2 }}>
                  Encryption Key Fingerprint
                </span>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: PALETTE.secretChatFingerprintBg,
                  borderRadius: 8,
                  padding: '12px 16px',
                  marginTop: 15,
                  display: 'flex',
                  justifyContent: 'center',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ color: '#F59E0B', fontSize: 12.5, fontWeight: 600 }}>
                  Waiting for user to connect...
                </span>
              </div>
            )}
          </div>
        )}

        {/* 🟢 ВИРТУАЛИЗИРОВАННЫЙ СКРОЛЛЕР СООБЩЕНИЙ */}
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
            {(visibleItems || []).map((item) => {
              const isMsgHighlighted = Boolean(
                highlightedMessageId &&
                (Number(item.id) === Number(highlightedMessageId) ||
                  (Number(item.serverId) > 0 && Number(item.serverId) === Number(highlightedMessageId)))
              );

              return (
                <MessageItem
                  key={item.id || item.serverId}
                  model={item}
                  isHighlighted={isMsgHighlighted}
                  isSelectionMode={isSelectionMode}
                  onToggleSelect={toggleSelectMessage}
                  onReply={addReplyMessage}
                  onEdit={setEditMessage}
                  onPin={(msg) => togglePinMessage(msg, true)}
                  onDelete={(msg) => deleteMessage(msg, true)}
                  onForward={(msg) => forwardMessages([msg])}
                  onScrollToMessage={(id) => {
                    eventBus.emit('ScrollToMessageRequestMessage' as any, { messageId: id });
                  }}
                  onMediaClick={handleMediaItemClick}
                />
              );
            })}
          </div>
        </div>

        {/* 🟢 ОБЪЕДИНЕННЫЙ НИЖНИЙ СТЕК: ТУМАН, КНОПКА СКРОЛЛА И ПОЛЕ ВВОДА */}
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
          {/* Градиентный туман */}
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

          {/* Плавающая кнопка быстрого скролла вниз со счетчиком непрочитанных */}
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
            <div style={{ position: 'relative' }}>
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

              {unreadCountInActiveChat > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: -10,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: PALETTE.accent,
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
                    pointerEvents: 'none',
                  }}
                >
                  {unreadCountInActiveChat}
                </div>
              )}
            </div>
          </div>

          {/* Модульное поле ввода сообщений */}
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

      {/* Просмотрщик фото */}
      <PhotoViewerView
        isOpen={photoViewerState.isOpen}
        mediaList={photoViewerState.mediaList}
        startIndex={photoViewerState.startIndex}
        onClose={() => setPhotoViewerState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Полноэкранный видеоплеер (VideoViewerView из XAML) */}
      <VideoViewerView />
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
      <div style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined, display: 'flex' }}>
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