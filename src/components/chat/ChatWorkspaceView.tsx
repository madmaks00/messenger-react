import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useMessageInputStore } from '../../stores/messageInputStore';
import { AsyncChatLayoutEngine } from '../../utils/chatLayoutEngine';
import { MessageItem } from './MessageItem';
import { userSession } from '../../services/userSession';

export const ChatWorkspaceView: React.FC = () => {
  const {
    selectedChatUser,
    currentChatMessages = [],
    isHistoryLoading,
    isSelectionMode,
    selectedCount,
    loadOlderMessages,
    togglePinMessage,
    deleteMessage,
    toggleSelectMessage,
    clearSelection,
    forwardMessages,
  } = useChatStore();

  const { setEditMessage, addReplyMessage } = useMessageInputStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  // Анимация плавного скролла
  const animFrameRef = useRef<number | null>(null);

  // 1. Безопасный расчет геометрического лейаута баблов
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
        ? AsyncChatLayoutEngine.calculateLayout(rawModels, 600)
        : null;

      if (!result) {
        return { layoutItems: [], totalContentHeight: 0 };
      }

      // Поддержка разных вариантов полей (layoutItems, items или просто массив)
      const items =
        result.layoutItems ||
        (result as any).items ||
        (Array.isArray(result) ? result : []);
      const height =
        result.totalContentHeight ??
        (result as any).totalHeight ??
        0;

      return {
        layoutItems: Array.isArray(items) ? items : [],
        totalContentHeight: typeof height === 'number' ? height : 0,
      };
    } catch (err) {
      console.error('[ChatWorkspaceView] Ошибка расчета лейаута:', err);
      return { layoutItems: [], totalContentHeight: 0 };
    }
  }, [currentChatMessages, selectedChatUser]);

  // 2. Определение видимого окна (Virtualizing Panel binary search)
  const visibleItems = useMemo(() => {
    const items = layoutItems || [];
    if (items.length === 0 || viewportHeight <= 0) return [];

    let low = 0;
    let high = items.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (items[mid].yOffset + items[mid].totalHeight < scrollTop) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    const firstIndex = Math.max(0, low - 3);

    low = 0;
    high = items.length - 1;
    const targetBottom = scrollTop + viewportHeight;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (items[mid].yOffset < targetBottom) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    const lastIndex = Math.min(items.length - 1, high + 3);

    return items.slice(firstIndex, lastIndex + 1);
  }, [layoutItems, scrollTop, viewportHeight]);

  // 3. Плавный V-Sync скролл к целевому смещению
  const scrollToOffsetAnimated = useCallback((targetOffset: number, durationMs: number = 240) => {
    if (!scrollRef.current) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const startOffset = scrollRef.current.scrollTop;
    const distance = targetOffset - startOffset;
    if (Math.abs(distance) < 5) {
      scrollRef.current.scrollTop = targetOffset;
      return;
    }

    const startTime = performance.now();

    const frame = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);
      const easeOut = 1.0 - Math.pow(1.0 - progress, 3.0);

      if (scrollRef.current) {
        scrollRef.current.scrollTop = startOffset + distance * easeOut;
      }

      if (progress < 1.0) {
        animFrameRef.current = requestAnimationFrame(frame);
      } else {
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(frame);
  }, []);

  const scrollToBottom = () => {
    if (!scrollRef.current) return;
    const maxScroll = Math.max(0, totalContentHeight - viewportHeight);
    scrollToOffsetAnimated(maxScroll);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);

    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    setShowScrollBottomBtn(distanceFromBottom > 80);

    // Догрузка старых сообщений при скролле к самому верху
    if (target.scrollTop < 50 && !isHistoryLoading) {
      loadOlderMessages();
    }
  };

  // Автоскролл вниз при смене чата
  useEffect(() => {
    if (scrollRef.current && totalContentHeight > 0) {
      scrollRef.current.scrollTop = totalContentHeight;
    }
  }, [selectedChatUser?.id, totalContentHeight]);

  useEffect(() => {
    const handleResize = () => {
      if (scrollRef.current) {
        setViewportHeight(scrollRef.current.clientHeight);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!selectedChatUser) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A', color: '#64748B' }}>
        <div style={{ padding: '10px 20px', borderRadius: 20, background: '#1E293B', fontSize: 15 }}>
          Select a chat to start messaging
        </div>
      </div>
    );
  }

  const msgs = currentChatMessages || [];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#0B141B', position: 'relative' }}>
      {/* 1. ШАПКА ЧАТА */}
      <div style={{ height: 54, background: '#1E293B', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', padding: '0 16px', zIndex: 10 }}>
        {isSelectionMode ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={clearSelection} style={iconBtnStyle}>✕</button>
              <span style={{ fontWeight: 'bold', fontSize: 16 }}>Selected: {selectedCount}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => forwardMessages(msgs.filter((m) => m.isSelected))} style={actionBtnStyle}>
                ↗ Forward
              </button>
              <button onClick={() => msgs.filter((m) => m.isSelected).forEach((m) => deleteMessage(m, true))} style={{ ...actionBtnStyle, color: '#EF4444' }}>
                🗑 Delete
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontWeight: 'bold' }}>
              {selectedChatUser.avatarPath ? (
                <img src={selectedChatUser.avatarPath} alt="" style={{ width: '100%', height: '100%', borderRadius: 20, objectFit: 'cover' }} />
              ) : (
                (selectedChatUser.nickName || 'U').charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 15, color: '#F8FAFC' }}>
                {selectedChatUser.isSecretChat && <span>🔒</span>}
                <span>{selectedChatUser.nickName || 'Chat'}</span>
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>
                {selectedChatUser.isTyping ? (
                  <span style={{ color: '#38BDF8', fontWeight: 600 }}>typing...</span>
                ) : selectedChatUser.isOnline ? (
                  <span style={{ color: '#38BDF8' }}>online</span>
                ) : selectedChatUser.isGroup ? (
                  `${selectedChatUser.memberCount || 1} members`
                ) : (
                  'last seen recently'
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. ВИРТУАЛИЗИРОВАННЫЙ СКРОЛЛЕР СООБЩЕНИЙ */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          position: 'relative',
          paddingBottom: 20,
        }}
      >
        {/* Карточка секретного чата E2EE при отсутствии сообщений */}
        {selectedChatUser.isSecretChat && msgs.length === 0 && (
          <div
            style={{
              maxWidth: 360,
              margin: '60px auto',
              background: '#1E293B',
              border: '1px solid #334155',
              borderRadius: 16,
              padding: '24px 20px',
              textAlign: 'center',
            }}
          >
            <div style={{ width: 54, height: 54, borderRadius: 27, background: '#166534', color: '#4ADE80', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              🔒
            </div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 8 }}>Secret Chat</div>
            <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'left', margin: '0 auto', maxWidth: 260 }}>
              <div>• End-to-end encryption (E2EE)</div>
              <div>• Leave no traces on server</div>
              <div>• Messages stored on device only</div>
            </div>
            {selectedChatUser.keyFingerprint && (
              <div style={{ marginTop: 16, padding: '8px 12px', background: '#0F172A', borderRadius: 8 }}>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#F8FAFC' }}>
                  {selectedChatUser.keyFingerprint}
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Encryption Key Fingerprint</div>
              </div>
            )}
          </div>
        )}

        {/* Общий виртуальный контейнер высоты */}
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

      {/* 3. КНОПКА БЫСТРОГО СПУСКА ВНИЗ */}
      {showScrollBottomBtn && (
        <button
          onClick={scrollToBottom}
          style={{
            position: 'absolute',
            right: 24,
            bottom: 80,
            width: 44,
            height: 44,
            borderRadius: 22,
            background: '#1E293B',
            border: '1.2px solid #475569',
            color: '#F8FAFC',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            zIndex: 30,
          }}
        >
          ↓
        </button>
      )}
    </div>
  );
};

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#FFF',
  fontSize: 18,
  cursor: 'pointer',
};

const actionBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#38BDF8',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};