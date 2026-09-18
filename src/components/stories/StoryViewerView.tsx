import React, { useEffect, useState, useRef } from 'react';
import { useStoryViewerStore, IStoryComment } from '../../stores/storyViewerStore';

export const StoryViewerView: React.FC = () => {
  const {
    isViewerOpen,
    isCommentsOpen,
    stories,
    currentIndex,
    currentStory,
    currentComments,
    replyingToComment,
    newCommentText,
    closeViewer,
    nextStory,
    previousStory,
    toggleComments,
    setReplyingToComment,
    setNewCommentText,
    sendComment,
    toggleStoryLike,
    toggleStoryDislike,
    toggleCommentLike,
    toggleCommentDislike,
  } = useStoryViewerStore();

  const [expandedComments, setExpandedComments] = useState<Record<number, boolean>>({});
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isViewerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowRight') nextStory();
      if (e.key === 'ArrowLeft') previousStory();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isViewerOpen, closeViewer, nextStory, previousStory]);

  if (!isViewerOpen || !currentStory) return null;

  const isSmallScreen = windowWidth < 1000;
  const cardWidth = isSmallScreen ? 360 : 420;
  const cardHeight = isSmallScreen ? 620 : 720;

  const toggleReplies = (commentId: number) => {
    setExpandedComments((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  return (
    <div
      onClick={closeViewer}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(6px)',
        userSelect: 'none',
      }}
    >
      {/* КАРТОЧКА ПРОСМОТРА + ВЫДВИЖНЫЕ КОММЕНТАРИИ */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isCommentsOpen ? 40 : 0,
          transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: isCommentsOpen ? 'translateX(-120px)' : 'translateX(0)',
        }}
      >
        {/* ================= 1. КАРТОЧКА ИСТОРИИ ================= */}
        <div style={{ position: 'relative', width: cardWidth, height: cardHeight }}>
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#17212B',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
              position: 'relative',
            }}
          >
            {/* Изображение истории (Uniform) */}
            <img
              src={currentStory.imagePath}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />

            {/* Градиенты затемнения сверху и снизу */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 140, background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 220, background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', pointerEvents: 'none' }} />

            {/* Клик-зоны для переключения */}
            <div onClick={previousStory} style={{ position: 'absolute', top: 60, bottom: 90, left: 0, width: '35%', cursor: 'pointer', zIndex: 5 }} />
            <div onClick={nextStory} style={{ position: 'absolute', top: 60, bottom: 90, right: 0, width: '35%', cursor: 'pointer', zIndex: 5 }} />

            {/* ШАПКА: ПОЛОСКИ ПРОГРЕССА И АВТОР */}
            <div style={{ position: 'absolute', top: 12, left: 14, right: 14, zIndex: 10 }}>
              {/* Полоски прогресса */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                {stories.map((_, idx) => (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 1.5,
                      backgroundColor:
                        idx < currentIndex
                          ? '#FFFFFF'
                          : idx === currentIndex
                          ? '#38BDF8'
                          : 'rgba(255, 255, 255, 0.3)',
                    }}
                  />
                ))}
              </div>

              {/* Автор и кнопка закрытия */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#3B82F6', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {currentStory.userAvatar ? (
                      <img src={currentStory.userAvatar} alt="" style={{ width: '100%', height: '100%', borderRadius: 19, objectFit: 'cover' }} />
                    ) : (
                      currentStory.userName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div style={{ color: '#FFF', fontSize: 13.5, fontWeight: 'bold' }}>{currentStory.userName}</div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                      {new Date(currentStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <button onClick={closeViewer} style={viewerCloseBtnStyle}>✕</button>
              </div>
            </div>

            {/* НИЖНЯЯ ПАНЕЛЬ: ОПИСАНИЕ И РЕАКЦИИ */}
            <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, zIndex: 10 }}>
              {currentStory.description && (
                <div style={{ color: '#FFF', fontSize: 14.5, marginBottom: 14, maxHeight: 80, overflowY: 'auto' }}>
                  {currentStory.description}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {/* Like */}
                  <button onClick={toggleStoryLike} style={reactionChipStyle}>
                    <span style={{ color: currentStory.myReaction === 0 ? '#EF4444' : '#FFF', fontSize: 16 }}>
                      {currentStory.myReaction === 0 ? '❤️' : '🤍'}
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#FFF' }}>{currentStory.likesCount}</span>
                  </button>

                  {/* Dislike */}
                  <button onClick={toggleStoryDislike} style={reactionChipStyle}>
                    <span style={{ color: currentStory.myReaction === 1 ? '#38BDF8' : '#FFF', fontSize: 16 }}>
                      👎
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#FFF' }}>{currentStory.dislikesCount}</span>
                  </button>
                </div>

                {/* Кнопка комментариев */}
                <button onClick={toggleComments} style={reactionChipStyle}>
                  <span>💬</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#FFF' }}>{currentStory.commentsCount}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Стрелки навигации слева/справа вне карточки */}
          {currentIndex > 0 && (
            <button onClick={previousStory} style={{ ...navCircleBtnStyle, left: -60 }}>
              ‹
            </button>
          )}
          {currentIndex < stories.length - 1 && (
            <button onClick={nextStory} style={{ ...navCircleBtnStyle, right: -60 }}>
              ›
            </button>
          )}
        </div>

        {/* ================= 2. ВЫДВИЖНАЯ ПАНЕЛЬ КОММЕНТАРИЕВ (360px) ================= */}
        {isCommentsOpen && (
          <div
            style={{
              width: 360,
              height: cardHeight,
              backgroundColor: '#1E2330',
              borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Шапка комментариев */}
            <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>
                <span style={{ color: 'var(--app-accent, #3B82F6)' }}>💬</span>
                <span>Comments</span>
              </div>
              <button onClick={toggleComments} style={viewerCloseBtnStyle}>✕</button>
            </div>

            {/* Список комментариев (YouTube Style) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
              {currentComments.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748B', marginTop: 100 }}>
                  <div style={{ fontSize: 36 }}>💬</div>
                  <div style={{ color: '#FFF', fontWeight: 600, marginTop: 8 }}>No comments yet</div>
                  <div style={{ fontSize: 12 }}>Be the first to leave a comment</div>
                </div>
              ) : (
                currentComments.map((comment) => (
                  <div key={comment.id} style={{ marginBottom: 12 }}>
                    {/* Главный комментарий */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#3B82F6', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 12, flexShrink: 0 }}>
                        {comment.userName.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, backgroundColor: '#161B26', border: '1px solid #334155', borderRadius: '0 10px 10px 10px', padding: '8px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#38BDF8' }}>{comment.userName}</span>
                          <span style={{ fontSize: 11, color: '#64748B' }}>
                            {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ color: '#F8FAFC', fontSize: 13, lineHeight: '17px' }}>{comment.text}</div>

                        {/* Кнопки лайка, дизлайка и ответа */}
                        <div style={{ display: 'flex', gap: 12, marginTop: 6, alignItems: 'center', fontSize: 11 }}>
                          <span onClick={() => toggleCommentLike(comment)} style={{ cursor: 'pointer', color: comment.myReaction === 0 ? '#38BDF8' : '#94A3B8' }}>
                            👍 {comment.likesCount > 0 && comment.likesCount}
                          </span>
                          <span onClick={() => toggleCommentDislike(comment)} style={{ cursor: 'pointer', color: comment.myReaction === 1 ? '#EF4444' : '#94A3B8' }}>
                            👎 {comment.dislikesCount > 0 && comment.dislikesCount}
                          </span>
                          <span onClick={() => setReplyingToComment(comment)} style={{ cursor: 'pointer', color: '#94A3B8', fontWeight: 600 }}>
                            Ответить
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Кнопка "Посмотреть ответы (N)" */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div
                        onClick={() => toggleReplies(comment.id)}
                        style={{
                          marginLeft: 42,
                          marginTop: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--app-accent, #38BDF8)',
                          cursor: 'pointer',
                        }}
                      >
                        {expandedComments[comment.id] ? '▲ Скрыть ответы' : `▼ Посмотреть ответы (${comment.replies.length})`}
                      </div>
                    )}

                    {/* Вложенные ответы с левой направляющей линией */}
                    {expandedComments[comment.id] && comment.replies && (
                      <div style={{ marginLeft: 42, borderLeft: '2px solid #334155', paddingLeft: 10, marginTop: 6 }}>
                        {comment.replies.map((reply) => (
                          <div key={reply.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            <div style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#3B82F6', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 11, flexShrink: 0 }}>
                              {reply.userName.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, backgroundColor: '#1E2330', border: '1px solid #334155', borderRadius: '0 8px 8px 8px', padding: '6px 8px' }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#38BDF8' }}>{reply.userName}</div>
                              <div style={{ color: '#F8FAFC', fontSize: 12 }}>{reply.text}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Панель ввода комментария */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: 12 }}>
              {replyingToComment && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#38BDF8', marginBottom: 6 }}>
                  <span>Replying to {replyingToComment.userName}</span>
                  <span onClick={() => setReplyingToComment(null)} style={{ cursor: 'pointer', color: '#94A3B8' }}>✕</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, background: '#161B26', border: '1px solid #334155', borderRadius: 20, padding: '4px 8px' }}>
                <input
                  type="text"
                  placeholder="Add a comment..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendComment()}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#FFF', fontSize: 13.5, outline: 'none', padding: '4px 8px' }}
                />
                <button
                  onClick={sendComment}
                  style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--app-accent, #3B82F6)', border: 'none', color: '#FFF', cursor: 'pointer' }}
                >
                  ➤
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const viewerCloseBtnStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.1)',
  border: 'none',
  color: '#FFFFFF',
  width: 32,
  height: 32,
  borderRadius: 16,
  fontSize: 16,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const reactionChipStyle: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.45)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: 18,
  padding: '6px 14px',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
};

const navCircleBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 44,
  height: 44,
  borderRadius: 22,
  background: 'rgba(0, 0, 0, 0.45)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  color: '#FFFFFF',
  fontSize: 28,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};