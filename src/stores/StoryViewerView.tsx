// src/components/stories/StoryViewerView.tsx
import React, { useEffect } from 'react';
import { useStoryViewerStore } from '../../stores/storyViewerStore';

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
  } = useStoryViewerStore();

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

  return (
    <div
      onClick={closeViewer}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.94)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      {/* КАРТОЧКА ИСТОРИИ */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 420,
          height: 720,
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: '#0F172A',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 1. ПОЛОСКИ ПРОГРЕССА СВЕРХУ */}
        <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', gap: 4, zIndex: 10 }}>
          {stories.map((_, idx) => (
            <div
              key={idx}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 1.5,
                backgroundColor: idx < currentIndex ? '#FFF' : idx === currentIndex ? '#38BDF8' : 'rgba(255, 255, 255, 0.3)',
              }}
            />
          ))}
        </div>

        {/* 2. ШАПКА: АВАТАРКА + ИМЯ + ВРЕМЯ + ЗАКРЫТИЕ */}
        <div style={{ position: 'absolute', top: 22, left: 14, right: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#3B82F6', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {currentStory.userAvatar ? <img src={currentStory.userAvatar} alt="" style={{ width: '100%', height: '100%', borderRadius: 18, objectFit: 'cover' }} /> : currentStory.userName.charAt(0)}
            </div>
            <div>
              <div style={{ color: '#FFF', fontSize: 14, fontWeight: 'bold' }}>{currentStory.userName}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{new Date(currentStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
          <button onClick={closeViewer} style={{ background: 'transparent', border: 'none', color: '#FFF', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* 3. ФОТО ИСТОРИИ */}
        <img src={currentStory.imagePath} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

        {/* Зоны клика лево/право для переключения историй */}
        <div onClick={previousStory} style={{ position: 'absolute', top: 60, bottom: 80, left: 0, width: '30%', cursor: 'pointer' }} />
        <div onClick={nextStory} style={{ position: 'absolute', top: 60, bottom: 80, right: 0, width: '30%', cursor: 'pointer' }} />

        {/* 4. НИЖНЯЯ ПАНЕЛЬ РЕАКЦИЙ И КОММЕНТАРИЕВ */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 14px', background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
          {/* Лайк / Дизлайк */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={toggleStoryLike} style={storyActionBtn}>
              <span style={{ color: currentStory.myReaction === 0 ? '#38BDF8' : '#FFF' }}>👍</span>
              <span style={{ color: '#FFF', fontSize: 12 }}>{currentStory.likesCount}</span>
            </button>
            <button onClick={toggleStoryDislike} style={storyActionBtn}>
              <span style={{ color: currentStory.myReaction === 1 ? '#EF4444' : '#FFF' }}>👎</span>
              <span style={{ color: '#FFF', fontSize: 12 }}>{currentStory.dislikesCount}</span>
            </button>
          </div>

          {/* Комментарии */}
          <button onClick={toggleComments} style={storyActionBtn}>
            <span>💬</span>
            <span style={{ color: '#FFF', fontSize: 12 }}>{currentStory.commentsCount}</span>
          </button>
        </div>

        {/* 5. ВСПЛЫВАЮЩАЯ ШТОРКА КОММЕНТАРИЕВ */}
        {isCommentsOpen && (
          <div
            style={{
              position: 'absolute',
              inset: 'auto 0 0 0',
              height: '65%',
              background: '#1E2330',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
              padding: '12px 14px',
              boxShadow: '0 -10px 30px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>Comments</span>
              <button onClick={toggleComments} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Список комментариев */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
              {currentComments.map((comment) => (
                <div key={comment.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#38BDF8', fontSize: 12, fontWeight: 600 }}>{comment.userName}</span>
                    <span style={{ color: '#64748B', fontSize: 10 }}>{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div style={{ color: '#FFF', fontSize: 13, marginTop: 2 }}>{comment.text}</div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 11 }}>
                    <span onClick={() => setReplyingToComment(comment)} style={{ color: '#94A3B8', cursor: 'pointer' }}>Reply</span>
                    <span onClick={() => toggleCommentLike(comment)} style={{ color: comment.myReaction === 0 ? '#38BDF8' : '#94A3B8', cursor: 'pointer' }}>👍 {comment.likesCount}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Ввод комментария */}
            {replyingToComment && (
              <div style={{ fontSize: 11, color: '#38BDF8', marginBottom: 4 }}>
                Replying to {replyingToComment.userName} <span onClick={() => setReplyingToComment(null)} style={{ cursor: 'pointer', color: '#94A3B8' }}>✕</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Write a comment..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendComment()}
                style={{ flex: 1, background: '#161B26', border: '1px solid #334155', borderRadius: 8, padding: '6px 10px', color: '#FFF', outline: 'none', fontSize: 13 }}
              />
              <button onClick={sendComment} style={{ background: '#3B82F6', border: 'none', borderRadius: 8, color: '#FFF', padding: '0 12px', cursor: 'pointer' }}>➤</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const storyActionBtn: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.4)',
  border: 'none',
  borderRadius: 16,
  padding: '6px 12px',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
};