import React, { useEffect, useState } from 'react';
import { useStoryViewerStore } from '../../stores/storyViewerStore';
import { normalizeImageSrc, getAvatarColor, getFirstLetter } from '../profile/profileView.utils';
import { Theme } from '../profile/profile.theme';

// =========================================================================
// ТОЧНЫЕ ВЕКТОРНЫЕ ИКОНКИ MATERIAL DESIGN (1:1 PackIconData из WPF XAML)
// =========================================================================
const Mdi = {
  Close: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 20} height={props.size || 20} viewBox="0 0 24 24" fill={props.color || 'currentColor'}>
      <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
    </svg>
  ),
  PencilOutline: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill={props.color || '#FFFFFF'}>
      <path d="M14.06,9L15,9.94L5.92,19H5V18.08L14.06,9M17.66,3C17.41,3 17.15,3.1 16.96,3.29L15.13,5.12L18.88,8.87L20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18.17,3.09 17.92,3 17.66,3M14.06,6.19L3,17.25V21H6.75L17.81,9.94L14.06,6.19Z" />
    </svg>
  ),
  DeleteOutline: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill={props.color || '#FF3B30'}>
      <path d="M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19M8,9H16V19H8V9M15.5,4L14.5,3H9.5L8.5,4H5V6H19V4H15.5Z" />
    </svg>
  ),
  ChevronLeft: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 28} height={props.size || 28} viewBox="0 0 24 24" fill={props.color || '#FFFFFF'}>
      <path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z" />
    </svg>
  ),
  ChevronRight: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 28} height={props.size || 28} viewBox="0 0 24 24" fill={props.color || '#FFFFFF'}>
      <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" />
    </svg>
  ),
  Heart: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill={props.color || '#FF3B30'}>
      <path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z" />
    </svg>
  ),
  HeartOutline: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill={props.color || '#FFFFFF'}>
      <path d="M12.1,18.55L12,18.65L11.89,18.55C7.14,14.24 4,11.39 4,8.5C4,6.5 5.5,5 7.5,5C9.04,5 10.54,6 11.07,7.36H12.93C13.46,6 14.96,5 16.5,5C18.5,5 20,6.5 20,8.5C20,11.39 16.86,14.24 12.1,18.55M16.5,3C14.76,3 13.09,3.81 12,5.08C10.91,3.81 9.24,3 7.5,3C4.42,3 2,5.41 2,8.5C2,12.27 5.4,15.36 10.55,20.03L12,21.35L13.45,20.03C18.6,15.36 22,12.27 22,8.5C22,5.41 19.58,3 16.5,3Z" />
    </svg>
  ),
  ThumbDown: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill={props.color || '#FF3B30'}>
      <path d="M1,14C1,15.1 1.9,16 3,16H9.31L8.36,20.57C8.34,20.67 8.33,20.77 8.33,20.88C8.33,21.3 8.5,21.67 8.77,21.94L9.83,23L16.41,16.41C16.78,16.05 17,15.55 17,15V5C17,3.89 16.1,3 15,3H6C5.17,3 4.46,3.5 4.16,4.22L1.14,11.27C1.05,11.5 1,11.74 1,12V14M23,3H19V15H23V3Z" />
    </svg>
  ),
  // 🟢 КАНОНИЧНЫЙ ВЕКТОР MDI THUMBDOWN-OUTLINE (исправлена обрезка)
  ThumbDownOutline: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 13} height={props.size || 13} viewBox="0 0 24 24" fill={props.color || 'currentColor'}>
      <path d="M19,15V3H23V15H19M15,3A2,2 0 0,1 17,5V15C17,15.55 16.78,16.05 16.41,16.41L9.83,23L8.77,21.94C8.5,21.67 8.33,21.3 8.33,20.88L8.36,20.57L9.31,16H3C1.89,16 1,15.1 1,14V13.91L1,12C1,11.74 1.05,11.5 1.14,11.27L4.16,4.22C4.46,3.5 5.17,3 6,3H15M15,5H6L3,12V14H9.31L8.36,20.57L9.83,22.04L15,16.87V5Z" />
    </svg>
  ),
  ThumbUp: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 13} height={props.size || 13} viewBox="0 0 24 24" fill={props.color || Theme.AppAccent}>
      <path d="M23,10C23,8.89 22.1,8 21,8H14.68L15.64,3.43C15.66,3.33 15.67,3.22 15.67,3.11C15.67,2.7 15.5,2.32 15.23,2.05L14.17,1L7.59,7.58C7.22,7.95 7,8.45 7,9V19A2,2 0 0,0 9,21H18C18.83,21 19.54,20.5 19.84,19.78L22.86,12.73C22.95,12.5 23,12.26 23,12V10M1,21H5V9H1V21Z" />
    </svg>
  ),
  // 🟢 КАНОНИЧНЫЙ ВЕКТОР MDI THUMBUP-OUTLINE
  ThumbUpOutline: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 13} height={props.size || 13} viewBox="0 0 24 24" fill={props.color || 'currentColor'}>
      <path d="M5,9V21H1V9H5M9,21A2,2 0 0,1 7,19V9C7,8.45 7.22,7.95 7.59,7.59L14.17,1L15.23,2.06C15.5,2.33 15.67,2.7 15.67,3.11L14.64,8H21C22.11,8 23,8.9 23,10V12C23,12.26 22.95,12.5 22.86,12.73L19.84,19.78C19.54,20.5 18.83,21 18,21H9M9,19H18L21,12V10H13.34L14.47,4.6L9,10.07V19Z" />
    </svg>
  ),
  CommentTextOutline: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill={props.color || '#FFFFFF'}>
      <path d="M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2M20,16H5.17L4,17.17V4H20V16M7,7H17V9H7V7M7,11H14V13H7V11Z" />
    </svg>
  ),
  CommentTextMultipleOutline: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 20} height={props.size || 20} viewBox="0 0 24 24" fill={props.color || Theme.AppAccent}>
      <path d="M3,4H1V18A2,2 0 0,0 3,20H17V18H3V4M21,2H7A2,2 0 0,0 5,4V16A2,2 0 0,0 7,18H21A2,2 0 0,0 23,16V4A2,2 0 0,0 21,2M21,16H7V4H21V16M9,6V8H19V6H9M9,10V12H16V10H9Z" />
    </svg>
  ),
  CommentOutline: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 42} height={props.size || 42} viewBox="0 0 24 24" fill={props.color || '#4E5D6C'}>
      <path d="M9,22A1,1 0 0,1 8,21V18H4A2,2 0 0,1 2,16V4C2,2.89 2.9,2 4,2H20A2,2 0 0,1 22,4V16A2,2 0 0,1 20,18H13.9L10.2,21.71C10,21.9 9.75,22 9.5,22V22H9M10,16V19.08L13.08,16H20V4H4V16H10Z" />
    </svg>
  ),
  ReplyOutline: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 13} height={props.size || 13} viewBox="0 0 24 24" fill={props.color || 'currentColor'}>
      <path d="M10,9V5L3,12L10,19V14.9C15,14.9 18.5,16.5 21,20C20,15 17,10 10,9Z" />
    </svg>
  ),
  Reply: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill={props.color || Theme.AppAccent}>
      <path d="M10,9V5L3,12L10,19V14.9C15,14.9 18.5,16.5 21,20C20,15 17,10 10,9Z" />
    </svg>
  ),
  ChevronDown: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 14} height={props.size || 14} viewBox="0 0 24 24" fill={props.color || Theme.AppAccent}>
      <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" />
    </svg>
  ),
  ChevronUp: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 14} height={props.size || 14} viewBox="0 0 24 24" fill={props.color || Theme.AppAccent}>
      <path d="M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z" />
    </svg>
  ),
  Send: (props: { size?: number; color?: string }) => (
    <svg width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill={props.color || Theme.AppAccent}>
      <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" />
    </svg>
  ),
};

export const StoryViewerView: React.FC = () => {
  const {
    isViewerOpen,
    isCommentsOpen,
    isOwnStory,
    stories,
    currentIndex,
    currentStory,
    currentComments,
    storiesProgressList,
    replyingToComment,
    newCommentText,
    hasPreviousStory,
    hasNextStory,
    closeViewer,
    nextStory,
    previousStory,
    toggleComments,
    editCurrentStory,
    deleteCurrentStory,
    setReplyingToComment,
    cancelReply,
    setNewCommentText,
    sendComment,
    toggleStoryLike,
    toggleStoryDislike,
    toggleCommentLike,
    toggleCommentDislike,
    toggleReplies,
  } = useStoryViewerStore();

  const [windowWidth, setWindowWidth] = useState<number>(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isViewerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowRight') void nextStory();
      if (e.key === 'ArrowLeft') void previousStory();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isViewerOpen, closeViewer, nextStory, previousStory]);

  if (!isViewerOpen || !currentStory) return null;

  const isSmallScreen = windowWidth < 1000;
  const cardWidth = isSmallScreen ? 360 : 420;
  const cardHeight = isSmallScreen ? 620 : 720;

  const authorAvatarUrl = normalizeImageSrc(currentStory.authorAvatar);
  const storyImageUrl = normalizeImageSrc(currentStory.imagePath);

  return (
    <div
      onClick={closeViewer}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        zIndex: 8000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
      }}
    >
      {/* 🟢 ПОДСВЕТКА ФОНА 1 В 1 С WPF XAML */}
      <style>{`
        /* 1. Верхние кнопки шапки (Edit, Delete, Close) */
        .wpf-story-btn-edit {
          width: 32px;
          height: 32px;
          border-radius: 16px;
          background-color: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition: background-color 0.15s ease;
        }
        .wpf-story-btn-edit:hover {
          background-color: rgba(255, 255, 255, 0.19) !important;
        }
        .wpf-story-btn-edit:active {
          background-color: rgba(255, 255, 255, 0.28) !important;
        }

        .wpf-story-btn-delete {
          width: 32px;
          height: 32px;
          border-radius: 16px;
          background-color: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition: background-color 0.15s ease;
        }
        .wpf-story-btn-delete:hover {
          background-color: rgba(255, 59, 48, 0.19) !important;
        }
        .wpf-story-btn-delete:active {
          background-color: rgba(255, 59, 48, 0.3) !important;
        }

        .wpf-story-btn-close {
          width: 32px;
          height: 32px;
          border-radius: 16px;
          background-color: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition: background-color 0.15s ease;
        }
        .wpf-story-btn-close:hover {
          background-color: rgba(255, 255, 255, 0.19) !important;
        }
        .wpf-story-btn-close:active {
          background-color: rgba(255, 255, 255, 0.28) !important;
        }

        /* 2. Чипсы реакций внизу (Like, Dislike, Comments) */
        .wpf-story-reaction-btn {
          height: 36px;
          min-width: 64px;
          padding: 0 14px;
          border-radius: 18px;
          background-color: rgba(0, 0, 0, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.15);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s ease;
        }
        .wpf-story-reaction-btn:hover {
          background-color: rgba(0, 0, 0, 0.7) !important;
        }
        .wpf-story-reaction-btn:active {
          background-color: rgba(0, 0, 0, 0.85) !important;
        }

        /* 3. Стрелки навигации слева/справа */
        .wpf-story-nav-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 44px;
          height: 44px;
          border-radius: 22px;
          background-color: rgba(0, 0, 0, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.15);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          z-index: 30;
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }
        .wpf-story-nav-btn:hover {
          background-color: rgba(0, 0, 0, 0.8) !important;
          border-color: #1E9BEB !important;
        }
        .wpf-story-nav-btn:active {
          background-color: rgba(0, 0, 0, 0.95) !important;
        }

        /* 4. Кнопки действий внутри комментариев (1:1 CommentActionButtonStyle) */
        .wpf-comment-act-btn {
          height: 22px;
          padding: 1px 4px;
          border-radius: 4px;
          background-color: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s ease;
        }
        .wpf-comment-act-btn:hover {
          background-color: rgba(255, 255, 255, 0.1) !important;
        }
        .wpf-comment-act-btn:active {
          background-color: rgba(255, 255, 255, 0.19) !important;
        }

        /* 5. Кнопка отправки комментария (Send) */
        .wpf-comment-send-btn {
          width: 32px;
          height: 32px;
          border-radius: 16px;
          background-color: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s ease;
        }
        .wpf-comment-send-btn:hover {
          background-color: rgba(255, 255, 255, 0.15) !important;
        }
        .wpf-comment-send-btn:active {
          background-color: rgba(255, 255, 255, 0.25) !important;
        }

        /* 6. Кнопка закрытия панели комментариев */
        .wpf-comments-close-btn {
          width: 30px;
          height: 30px;
          border-radius: 15px;
          background-color: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s ease;
        }
        .wpf-comments-close-btn:hover {
          background-color: rgba(255, 255, 255, 0.12) !important;
        }
        .wpf-comments-close-btn:hover svg {
          fill: #FFFFFF !important;
        }
        .wpf-comments-close-btn:active {
          background-color: rgba(255, 255, 255, 0.19) !important;
        }
      `}</style>

      {/* КАРТОЧКА СТОРИЗ СТАТИЧНА ПО ЦЕНТРУ */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* ================= 1. ПЛЕЕР ИСТОРИИ (PlayerCardBorder) ================= */}
        <div style={{ position: 'relative', width: cardWidth, height: cardHeight, flexShrink: 0 }}>
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#17212B',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 40px 80px rgba(0, 0, 0, 0.7)',
              position: 'relative',
            }}
          >
            {/* Изображение истории (1:1 XAML Stretch="Uniform") */}
            <img
              src={storyImageUrl}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />

            {/* Градиенты затемнения сверху и снизу (1:1 XAML) */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 140, background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 220, background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', pointerEvents: 'none' }} />

            {/* Клик-зоны навигации */}
            <div onClick={() => void previousStory()} style={{ position: 'absolute', top: 60, bottom: 90, left: 0, width: '35%', cursor: 'pointer', zIndex: 5 }} />
            <div onClick={() => void nextStory()} style={{ position: 'absolute', top: 60, bottom: 90, right: 0, width: '35%', cursor: 'pointer', zIndex: 5 }} />

            {/* ШАПКА: ПОЛОСКИ ПРОГРЕССА И АВТОР (1:1 XAML) */}
            <div style={{ position: 'absolute', top: 12, left: 14, right: 14, zIndex: 10 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                {storiesProgressList.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 1.5,
                      backgroundColor:
                        item.isActive
                          ? '#FFFFFF'
                          : item.isPassed
                          ? 'rgba(255, 255, 255, 0.6)'
                          : 'rgba(255, 255, 255, 0.3)',
                    }}
                  />
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: getAvatarColor(currentStory.userId),
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: 15,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <span>{getFirstLetter(currentStory.authorName)}</span>
                    {authorAvatarUrl && (
                      <img
                        src={authorAvatarUrl}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                  </div>
                  <div style={{ marginLeft: 10, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: 'bold' }}>{currentStory.authorName}</span>
                    <span style={{ color: '#B0FFFFFF', fontSize: 11, marginTop: 1 }}>
                      {new Date(currentStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Кнопки управления справа с мягкой подсветкой фона */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {isOwnStory && (
                    <>
                      {/* Кнопка Редактировать (PencilOutline) */}
                      <button
                        onClick={editCurrentStory}
                        title="Edit Story"
                        className="wpf-story-btn-edit"
                        style={{ marginRight: 4 }}
                      >
                        <Mdi.PencilOutline size={18} color="#FFFFFF" />
                      </button>

                      {/* Кнопка Удалить (DeleteOutline) */}
                      <button
                        onClick={deleteCurrentStory}
                        title="Delete Story"
                        className="wpf-story-btn-delete"
                        style={{ marginRight: 6 }}
                      >
                        <Mdi.DeleteOutline size={18} color="#FF3B30" />
                      </button>
                    </>
                  )}

                  {/* Кнопка Закрыть (Close) */}
                  <button
                    onClick={closeViewer}
                    title="Close"
                    className="wpf-story-btn-close"
                  >
                    <Mdi.Close size={20} color="#FFFFFF" />
                  </button>
                </div>
              </div>
            </div>

            {/* НИЖНЯЯ ПАНЕЛЬ: ОПИСАНИЕ И КНОПКИ РЕАКЦИЙ */}
            <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, zIndex: 10 }}>
              {currentStory.description && (
                <div
                  style={{
                    color: '#FFFFFF',
                    fontSize: 14.5,
                    marginBottom: 14,
                    maxHeight: 80,
                    overflowY: 'auto',
                    lineHeight: '18px',
                    wordBreak: 'break-word',
                  }}
                >
                  {currentStory.description}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex' }}>
                  {/* Кнопка Like */}
                  <button
                    onClick={() => void toggleStoryLike()}
                    className="wpf-story-reaction-btn"
                    style={{ marginRight: 8 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {currentStory.myReaction === 0 ? (
                        <Mdi.Heart size={18} color="#FF3B30" />
                      ) : (
                        <Mdi.HeartOutline size={18} color="#FFFFFF" />
                      )}
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#FFFFFF', marginLeft: 6 }}>
                        {currentStory.likesCount}
                      </span>
                    </div>
                  </button>

                  {/* Кнопка Dislike */}
                  <button
                    onClick={() => void toggleStoryDislike()}
                    className="wpf-story-reaction-btn"
                    style={{ marginRight: 8 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {currentStory.myReaction === 1 ? (
                        <Mdi.ThumbDown size={18} color={Theme.AppAccent} />
                      ) : (
                        <Mdi.ThumbDownOutline size={18} color="#FFFFFF" />
                      )}
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#FFFFFF', marginLeft: 6 }}>
                        {currentStory.dislikesCount}
                      </span>
                    </div>
                  </button>
                </div>

                {/* Кнопка Комментариев (CommentsCount) */}
                <button
                  onClick={toggleComments}
                  className="wpf-story-reaction-btn"
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Mdi.CommentTextOutline size={18} color="#FFFFFF" />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#FFFFFF', marginLeft: 6 }}>
                      {currentStory.commentsCount}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Стрелки навигации слева/справа */}
          {hasPreviousStory && (
            <button
              onClick={() => void previousStory()}
              className="wpf-story-nav-btn"
              style={{ left: -60 }}
              title="Previous Story"
            >
              <Mdi.ChevronLeft size={28} color="#FFFFFF" />
            </button>
          )}
          {hasNextStory && (
            <button
              onClick={() => void nextStory()}
              className="wpf-story-nav-btn"
              style={{ right: -60 }}
              title="Next Story"
            >
              <Mdi.ChevronRight size={28} color="#FFFFFF" />
            </button>
          )}
        </div>

        {/* ================= 2. ВЫДВИЖНАЯ ПАНЕЛЬ КОММЕНТАРИЕВ СПРАВА ================= */}
        {isCommentsOpen && (
          <div
            style={{
              position: 'absolute',
              left: '100%',
              marginLeft: 40,
              top: 0,
              width: 360,
              height: cardHeight,
              backgroundColor: Theme.ProfileCardBackground,
              borderRadius: 16,
              boxShadow: '0 40px 80px rgba(0, 0, 0, 0.6)',
              display: 'grid',
              gridTemplateRows: 'auto 1fr auto',
              overflow: 'hidden',
              animation: 'slideInComments 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <style>{`
              @keyframes slideInComments {
                from { opacity: 0; transform: translateX(30px); }
                to { opacity: 1; transform: translateX(0); }
              }
            `}</style>

            {/* Шапка комментариев */}
            <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${Theme.ProfileLeftPanelBorder}` }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Mdi.CommentTextMultipleOutline size={20} color={Theme.AppAccent} />
                <span style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16, marginLeft: 8 }}>
                  Comments
                </span>
              </div>
              <button
                onClick={toggleComments}
                className="wpf-comments-close-btn"
                title="Close Comments"
              >
                <Mdi.Close size={18} color="#7F9CA4" />
              </button>
            </div>

            {/* Список комментариев */}
            <div className="wpf-scroll-viewer" style={{ overflowY: 'auto', padding: '12px 14px' }}>
              {currentComments.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 40 }}>
                  <Mdi.CommentOutline size={42} color="#4E5D6C" />
                  <span style={{ color: '#8F9CA4', fontSize: 14, fontWeight: 600, marginTop: 10 }}>
                    No comments yet
                  </span>
                  <span style={{ color: '#62707E', fontSize: 12, marginTop: 3 }}>
                    Be the first to leave a comment
                  </span>
                </div>
              ) : (
                currentComments.map((comment) => (
                  <div key={comment.id} style={{ margin: '4px 0 8px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                      {/* 🟢 Аватарка: идеальный круг 32x32px 1:1 с WPF */}
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: getAvatarColor(comment.userId),
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: 12.5,
                          flexShrink: 0,
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        <span>{getFirstLetter(comment.userName)}</span>
                        {comment.userAvatar && (
                          <img
                            src={normalizeImageSrc(comment.userAvatar)}
                            alt=""
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        )}
                      </div>

                      {/* 🟢 Пузырь комментария: CornerRadius="0,10,10,10", Padding="10,6,10,6" */}
                      <div
                        style={{
                          flex: 1,
                          marginLeft: 8,
                          backgroundColor: Theme.ProfileInputContainerBg,
                          border: `1px solid ${Theme.ProfileInputContainerBorder}`,
                          borderRadius: '0 10px 10px 10px',
                          padding: '6px 10px',
                        }}
                      >
                        {/* Имя и время */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: Theme.AppAccent }}>
                            {comment.userName}
                          </span>
                          <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.38)' }}>
                            {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Текст */}
                        <div style={{ color: '#F5F5F5', fontSize: 13, lineHeight: '17px', wordBreak: 'break-word', marginTop: 1 }}>
                          {comment.text}
                        </div>

                        {/* 🟢 Кнопки реакций и "Ответить": строго #70FFFFFF в покое, #80FFFFFF текст */}
                        <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
                          {/* Лайк (#70FFFFFF в покое, AppAccent при активности) */}
                          <button
                            onClick={() => void toggleCommentLike(comment)}
                            className="wpf-comment-act-btn"
                            style={{ marginRight: 8 }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {comment.myReaction === 0 ? (
                                <Mdi.ThumbUp size={13} color={Theme.AppAccent} />
                              ) : (
                                <Mdi.ThumbUpOutline size={13} color="rgba(255, 255, 255, 0.44)" />
                              )}
                              {comment.likesCount > 0 && (
                                <span style={{ color: 'rgba(255, 255, 255, 0.63)', fontSize: 11, marginLeft: 3 }}>
                                  {comment.likesCount}
                                </span>
                              )}
                            </div>
                          </button>

                          {/* Дизлайк (#70FFFFFF в покое, #FF3B30 при активности) */}
                          <button
                            onClick={() => void toggleCommentDislike(comment)}
                            className="wpf-comment-act-btn"
                            style={{ marginRight: 10 }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {comment.myReaction === 1 ? (
                                <Mdi.ThumbDown size={13} color="#FF3B30" />
                              ) : (
                                <Mdi.ThumbDownOutline size={13} color="rgba(255, 255, 255, 0.44)" />
                              )}
                              {comment.dislikesCount > 0 && (
                                <span style={{ color: 'rgba(255, 255, 255, 0.63)', fontSize: 11, marginLeft: 3 }}>
                                  {comment.dislikesCount}
                                </span>
                              )}
                            </div>
                          </button>

                          {/* Кнопка "Ответить" (#70FFFFFF иконка, #80FFFFFF текст) */}
                          <button
                            onClick={() => setReplyingToComment(comment)}
                            className="wpf-comment-act-btn"
                          >
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <Mdi.ReplyOutline size={13} color="rgba(255, 255, 255, 0.44)" />
                              <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 11, fontWeight: 500, marginLeft: 4 }}>
                                Ответить
                              </span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Ответы (YouTube Style) */}
                    {comment.hasReplies && (
                      <button
                        onClick={() => toggleReplies(comment.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          marginLeft: 52,
                          marginTop: 2,
                          padding: '2px 4px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {comment.isRepliesExpanded ? (
                            <Mdi.ChevronUp size={14} color={Theme.AppAccent} />
                          ) : (
                            <Mdi.ChevronDown size={14} color={Theme.AppAccent} />
                          )}
                          <span style={{ color: Theme.AppAccent, fontSize: 12, fontWeight: 600, marginLeft: 4 }}>
                            {comment.isRepliesExpanded ? 'Скрыть ответы' : `Посмотреть ответы (${comment.repliesCount})`}
                          </span>
                        </div>
                      </button>
                    )}

                    {/* Вложенные ответы с левой направляющей линией */}
                    {comment.isRepliesExpanded && comment.replies && (
                      <div style={{ marginLeft: 44, borderLeft: '2px solid rgba(255,255,255,0.15)', paddingLeft: 10, marginTop: 4 }}>
                        {comment.replies.map((reply) => (
                          <div key={reply.id} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                backgroundColor: Theme.AppAccent,
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                fontSize: 11.5,
                                flexShrink: 0,
                                overflow: 'hidden',
                                position: 'relative',
                              }}
                            >
                              {getFirstLetter(reply.userName)}
                              {reply.userAvatar && (
                                <img
                                  src={normalizeImageSrc(reply.userAvatar)}
                                  alt=""
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              )}
                            </div>

                            <div
                              style={{
                                flex: 1,
                                marginLeft: 8,
                                backgroundColor: Theme.ProfileDeviceItemBg,
                                border: `1px solid ${Theme.ProfileInputContainerBorder}`,
                                borderRadius: '0 10px 10px 10px',
                                padding: '5px 10px',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: Theme.AppAccent }}>
                                  {reply.userName}
                                </span>
                                <span style={{ fontSize: 10.5, color: 'rgba(255, 255, 255, 0.38)' }}>
                                  {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>

                              <div style={{ color: '#F5F5F5', fontSize: 12.5, lineHeight: '16px', wordBreak: 'break-word' }}>
                                {reply.text}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
                                <button
                                  onClick={() => void toggleCommentLike(reply)}
                                  className="wpf-comment-act-btn"
                                  style={{ marginRight: 6 }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                    {reply.myReaction === 0 ? (
                                      <Mdi.ThumbUp size={12} color={Theme.AppAccent} />
                                    ) : (
                                      <Mdi.ThumbUpOutline size={12} color="rgba(255, 255, 255, 0.44)" />
                                    )}
                                    {reply.likesCount > 0 && (
                                      <span style={{ color: 'rgba(255, 255, 255, 0.63)', fontSize: 10.5, marginLeft: 3 }}>
                                        {reply.likesCount}
                                      </span>
                                    )}
                                  </div>
                                </button>

                                <button
                                  onClick={() => void toggleCommentDislike(reply)}
                                  className="wpf-comment-act-btn"
                                  style={{ marginRight: 8 }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                    {reply.myReaction === 1 ? (
                                      <Mdi.ThumbDown size={12} color="#FF3B30" />
                                    ) : (
                                      <Mdi.ThumbDownOutline size={12} color="rgba(255, 255, 255, 0.44)" />
                                    )}
                                    {reply.dislikesCount > 0 && (
                                      <span style={{ color: 'rgba(255, 255, 255, 0.63)', fontSize: 10.5, marginLeft: 3 }}>
                                        {reply.dislikesCount}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Форма ввода комментария */}
            <div>
              {replyingToComment && (
                <div
                  style={{
                    backgroundColor: Theme.ProfileLeftPanelBackground,
                    borderTop: `1px solid ${Theme.ProfileLeftPanelBorder}`,
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                    <div style={{ marginRight: 8, display: 'flex', alignItems: 'center' }}>
                      <Mdi.Reply size={16} color={Theme.AppAccent} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ color: Theme.AppAccent, fontSize: 12, fontWeight: 600 }}>
                        Replying to {replyingToComment.userName}
                      </span>
                      <span
                        style={{
                          color: Theme.ProfileSectionLabel,
                          fontSize: 11.5,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 240,
                        }}
                      >
                        {replyingToComment.text}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={cancelReply}
                    className="wpf-comment-act-btn"
                    title="Cancel Reply"
                    style={{ width: 24, height: 24 }}
                  >
                    <Mdi.Close size={14} color={Theme.ProfileSectionLabel} />
                  </button>
                </div>
              )}

              <div
                style={{
                  backgroundColor: Theme.ProfileLeftPanelBackground,
                  padding: 12,
                  borderBottomLeftRadius: 16,
                  borderBottomRightRadius: 16,
                  borderTop: `1px solid ${Theme.ProfileLeftPanelBorder}`,
                }}
              >
                <div
                  style={{
                    backgroundColor: Theme.ProfileInputContainerBg,
                    borderRadius: 20,
                    border: `1px solid ${Theme.ProfileInputContainerBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '2px 4px 2px 14px',
                  }}
                >
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void sendComment()}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#FFFFFF',
                      fontSize: 13.5,
                      fontFamily: "'Segoe UI', sans-serif",
                    }}
                  />
                  <button
                    onClick={() => void sendComment()}
                    className="wpf-comment-send-btn"
                    title="Send comment"
                  >
                    <Mdi.Send size={16} color={Theme.AppAccent} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryViewerView;