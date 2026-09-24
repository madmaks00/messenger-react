import React, { useState, useEffect } from 'react';
import { IStory } from '../../types/models';
import { useProfileView } from './useProfileView';
import { Icons } from './ProfileIcons';
import { Theme } from './profile.theme';
import { normalizeImageSrc } from './profileView.utils';
import { CloseButton } from './ProfileRightSettings';
import { useStoriesStore } from '../../stores/storiesStore';

interface ProfileRightStoriesProps {
  vm: ReturnType<typeof useProfileView>;
  isOwnProfile: boolean;
  onClose: () => void;
  onCreateNewStory: (file: File) => void;
  onOpenStoryViewer: (story: IStory, allStories: IStory[]) => void;
  onEditStory: (storyId: number) => void;
  onDeleteStory: (storyId: number) => void;
}

export const ProfileRightStories: React.FC<ProfileRightStoriesProps> = ({
  vm,
  isOwnProfile,
  onClose,
  onCreateNewStory,
  onOpenStoryViewer,
  onEditStory,
}) => {
  const {
    activeStories,
    isStoriesLoading,
    storiesFilterOpen,
    setStoriesFilterOpen,
    handleSortStories,
    collapseRightPanel,
  } = vm;

  // 🟢 Состояние контекстного меню ПКМ (1:1 StoryCardBorder.ContextMenu из XAML)
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    story: IStory;
  } | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '15px 25px 0 25px', boxSizing: 'border-box', position: 'relative' }}>
      {/* ЕДИНАЯ ШАПКА В СТИЛЕ WPF */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {!isOwnProfile && (
            <button
              onClick={collapseRightPanel}
              style={{ ...iconBtnStyle, width: 32, height: 32, marginRight: 8 }}
              title="Back to Profile"
            >
              <Icons.ArrowLeft size={20} color={Theme.ProfileSectionLabel} />
            </button>
          )}
          <span style={{ fontSize: 26, fontWeight: 800, color: Theme.MainWindowText, lineHeight: 1 }}>
            Stories
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isOwnProfile && (
            <label
              style={{ ...iconBtnStyle, width: 32, height: 32, cursor: 'pointer' }}
              title="Create Story"
            >
              <Icons.Plus size={20} color={Theme.AppAccent} />
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    onCreateNewStory(e.target.files[0]);
                    e.target.value = '';
                  }
                }}
              />
            </label>
          )}

          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setStoriesFilterOpen(!storiesFilterOpen);
              }}
              style={{ ...iconBtnStyle, width: 32, height: 32 }}
              title="Filter"
            >
              <Icons.FilterVariant size={20} color={Theme.ProfileMetadataLabel} />
            </button>

            {storiesFilterOpen && (
              <div style={dropdownMenuStyle}>
                <div onClick={() => handleSortStories('DateDesc')} style={dropdownItemStyle}>Date: Newest First</div>
                <div onClick={() => handleSortStories('DateAsc')} style={dropdownItemStyle}>Date: Oldest First</div>
                <div style={separatorStyle} />
                <div onClick={() => handleSortStories('ViewsDesc')} style={dropdownItemStyle}>Views: Most First</div>
                <div onClick={() => handleSortStories('ViewsAsc')} style={dropdownItemStyle}>Views: Least First</div>
                <div style={separatorStyle} />
                <div onClick={() => handleSortStories('LikesDesc')} style={dropdownItemStyle}>Likes: Most First</div>
                <div onClick={() => handleSortStories('LikesAsc')} style={dropdownItemStyle}>Likes: Least First</div>
                <div style={separatorStyle} />
                <div onClick={() => handleSortStories('DislikesDesc')} style={dropdownItemStyle}>Dislikes: Most First</div>
                <div onClick={() => handleSortStories('DislikesAsc')} style={dropdownItemStyle}>Dislikes: Least First</div>
                <div style={separatorStyle} />
                <div onClick={() => handleSortStories('CommentsDesc')} style={dropdownItemStyle}>Comments: Most First</div>
                <div onClick={() => handleSortStories('CommentsAsc')} style={dropdownItemStyle}>Comments: Least First</div>
              </div>
            )}
          </div>

          <CloseButton onClick={onClose} />
        </div>
      </div>

      {/* ОБЛАСТЬ КОНТЕНТА ИСТОРИЙ */}
      <div className="wpf-scroll-viewer" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeStories.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginRight: -12 }}>
            {activeStories.map((story) => (
              <div
                key={story.id}
                onClick={() => onOpenStoryViewer(story, activeStories)}
                // 🟢 ПКМ: Открытие контекстного меню "Edit Story" и "Delete Story" (1:1 XAML)
                onContextMenu={(e) => {
                  if (isOwnProfile) {
                    e.preventDefault();
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      story,
                    });
                  }
                }}
                style={{
                  width: 135,
                  height: 210,
                  borderRadius: 12,
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: 'pointer',
                  backgroundColor: Theme.ProfileInputContainerBg,
                  boxSizing: 'border-box',
                  border: '1.5px solid transparent',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                {/* 1:1 XAML ImageBrush Stretch="UniformToFill" */}
                <img
                  src={normalizeImageSrc(story.imagePath)}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />

                {/* Нижняя градиентная подложка со счетчиком просмотров */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    insetInline: 0,
                    height: 60,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: 8,
                    color: '#FFFFFF',
                    fontSize: 10.5,
                    fontWeight: 600,
                    gap: 4,
                  }}
                >
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="#FFFFFF">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                  </svg>
                  <span>{story.viewsCount}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          !isStoriesLoading && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: 60,
                boxSizing: 'border-box',
              }}
            >
              <Icons.ImageMultipleOutline size={56} color={Theme.ProfileNoStoriesIcon} />

              <div
                style={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  color: Theme.MainWindowText,
                  margin: '15px 0 6px 0',
                  textAlign: 'center',
                }}
              >
                No stories yet
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: Theme.ProfileNoStoriesSubtitle,
                  textAlign: 'center',
                  maxWidth: 280,
                  lineHeight: 1.4,
                }}
              >
                Photos published by user will appear here
              </div>
            </div>
          )
        )}
      </div>

      {/* 🟢 КОНТЕКСТНОЕ МЕНЮ КАРТОЧКИ (1:1 XAML ContextMenu: Edit Story & Delete Story) */}
      {contextMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            ...dropdownMenuStyle,
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 9999,
          }}
        >
          <div
            onClick={() => {
              onEditStory(contextMenu.story.id);
              setContextMenu(null);
            }}
            style={dropdownItemStyle}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="#FFFFFF">
                <path d="M14.06,9L15,9.94L5.92,19H5V18.08L14.06,9M17.66,3C17.41,3 17.15,3.1 16.96,3.29L15.13,5.12L18.88,8.87L20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18.17,3.09 17.92,3 17.66,3M14.06,6.19L3,17.25V21H6.75L17.81,9.94L14.06,6.19Z" />
              </svg>
              <span>Edit Story</span>
            </div>
          </div>

          <div
            onClick={() => {
              const target = contextMenu.story;
              setContextMenu(null);
              useStoriesStore.getState().requestDeleteStoryWithConfirmation(target);
            }}
            style={{ ...dropdownItemStyle, color: '#FF3B30' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="#FF3B30">
                <path d="M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19M8,9H16V19H8V9M15.5,4L14.5,3H9.5L8.5,4H5V6H19V4H15.5Z" />
              </svg>
              <span>Delete Story</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileRightStories;

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};

const dropdownMenuStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  right: 0,
  width: 200,
  backgroundColor: Theme.SidebarContextMenuBg,
  border: `1px solid ${Theme.SidebarContextMenuBorder}`,
  borderRadius: 8,
  padding: '6px 0',
  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  zIndex: 1000,
};

const dropdownItemStyle: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: 13,
  color: Theme.MainWindowText,
  cursor: 'pointer',
};

const separatorStyle: React.CSSProperties = {
  height: 1,
  backgroundColor: 'rgba(255,255,255,0.08)',
  margin: '4px 0',
};