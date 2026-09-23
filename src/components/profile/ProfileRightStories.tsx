import React from 'react';
import { IStory } from '../../types/models';
import { useProfileView } from './useProfileView';
import { Icons } from './ProfileIcons';
import { Theme } from './profile.theme';
import { normalizeImageSrc } from './profileView.utils';

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
  onDeleteStory,
}) => {
  const {
    activeStories,
    isStoriesLoading,
    storiesFilterOpen,
    setStoriesFilterOpen,
    handleSortStories,
    collapseRightPanel,
  } = vm;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '15px 25px 0 25px', boxSizing: 'border-box' }}>
      {/* ЕДИНАЯ ШАПКА В СТИЛЕ WPF (Margin="0,0,0,20") */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        {/* Слева: Кнопка Назад + Заголовок */}
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

        {/* Справа: Создание + Фильтры + Единый Крестик Закрытия */}
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
                  if (e.target.files?.[0]) onCreateNewStory(e.target.files[0]);
                }}
              />
            </label>
          )}

          {/* Кнопка фильтра историй с выпадающим меню сортировки */}
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

          <button onClick={onClose} style={{ ...iconBtnStyle, width: 32, height: 32 }} title="Close Profile">
            <Icons.Close size={20} color={Theme.TextMuted} />
          </button>
        </div>
      </div>

      {/* ОБЛАСТЬ КОНТЕНТА ИСТОРИЙ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {activeStories.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginRight: -12 }}>
            {activeStories.map((story) => (
              <div
                key={story.id}
                onClick={() => onOpenStoryViewer(story, activeStories)}
                style={{
                  width: 135,
                  height: 210,
                  borderRadius: 12,
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: 'pointer',
                  backgroundColor: Theme.ProfileInputContainerBg,
                  boxSizing: 'border-box',
                }}
              >
                <img
                  src={normalizeImageSrc(story.imagePath)}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    insetInline: 0,
                    height: 60,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: 8,
                    color: Theme.MainWindowText,
                    fontSize: 10.5,
                    fontWeight: 600,
                    gap: 3,
                  }}
                >
                  <span style={{ fontSize: 12 }}>👁</span>
                  <span>{story.viewsCount}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          !isStoriesLoading && (
            /* 1:1 воспроизведение VerticalAlignment="Center" Margin="0,60,0,0" */
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
    </div>
  );
};

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
  width: 220,
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