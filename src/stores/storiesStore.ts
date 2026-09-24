import { create } from 'zustand';
import { IStory, IUserStoryGroup } from '../types/models';
import { storiesService } from '../services/stories.service';
import { userSession } from '../services/userSession';
import { eventBus } from '../services/eventBus';
import { normalizeImageSrc } from '../components/profile/profileView.utils';

interface StoriesState {
  authorGroups: IUserStoryGroup[];
  storiesFeed: IStory[];
  myStories: IStory[];
  firstNewStory: IStory | null;
  hasUnviewedStories: boolean;
  isStoriesPanelExpanded: boolean;

  // Header Story Stack Getters
  firstAuthor: IStory | null;
  secondAuthor: IStory | null;
  hasSecondAuthor: boolean;
  extraAuthorsCount: number;
  hasExtraAuthors: boolean;

  distinctAuthorGroups: IUserStoryGroup[];
  firstAuthorGroup: IUserStoryGroup | null;
  secondAuthorGroup: IUserStoryGroup | null;
  hasSecondAuthorGroup: boolean;
  extraAuthorGroupsCount: number;
  hasExtraAuthorGroups: boolean;

  // Actions
  toggleStoriesPanel: () => void;
  loadStoriesFeed: () => Promise<void>;
  loadMyStories: () => Promise<void>;
  createNewStory: (file: File) => Promise<void>;
  postStory: (image: string, description: string, isPrivate: boolean) => Promise<boolean>;
  updateStory: (storyId: number, image: string | null | undefined, description: string, isPrivate: boolean) => Promise<boolean>;
  editStory: (story: IStory) => Promise<void>;
  deleteStory: (story: IStory) => Promise<void>;
  requestDeleteStoryWithConfirmation: (story: IStory) => void;
  openStoryViewer: (selectedStory: IStory) => Promise<void>;
  openUserStoryGroup: (group: IUserStoryGroup) => void;
  cleanupViewedStories: () => void;
  sortStories: (criterion: string) => void;
  recordStoryView: (storyId: number, authorUserId: number) => Promise<void>;
  reactToStory: (storyId: number, reactionType: number) => Promise<void>;
}

export const useStoriesStore = create<StoriesState>((set, get) => ({
  authorGroups: [],
  storiesFeed: [],
  myStories: [],
  firstNewStory: null,
  hasUnviewedStories: false,
  isStoriesPanelExpanded: false,

  firstAuthor: null,
  secondAuthor: null,
  hasSecondAuthor: false,
  extraAuthorsCount: 0,
  hasExtraAuthors: false,

  distinctAuthorGroups: [],
  firstAuthorGroup: null,
  secondAuthorGroup: null,
  hasSecondAuthorGroup: false,
  extraAuthorGroupsCount: 0,
  hasExtraAuthorGroups: false,

  toggleStoriesPanel: () => {
    const nextState = !get().isStoriesPanelExpanded;
    set({ isStoriesPanelExpanded: nextState });
    if (!nextState) {
      get().cleanupViewedStories();
    }
  },

  loadStoriesFeed: async () => {
    try {
      const feed = await storiesService.getStoriesFeedAsync();
      const rawFeed = feed || [];
      const unviewed = rawFeed.filter((s) => !s.hasViewed);

      set({
        storiesFeed: unviewed,
        hasUnviewedStories: unviewed.length > 0,
      });

      updateCalculatedFeedState(unviewed, set);
    } catch (e) {
      console.error('[StoriesStore] Ошибка загрузки ленты историй:', e);
    }
  },

  loadMyStories: async () => {
    const userId = userSession.userId;
    if (userId <= 0) return;

    try {
      const stories = await storiesService.getUserStoriesAsync(userId);
      set({ myStories: stories || [] });
    } catch (e) {
      console.error('[StoriesStore] Ошибка загрузки моих историй:', e);
    }
  },

  createNewStory: async (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        eventBus.emit('OpenStoryEditorMessage', {
          image: dataUrl,
          storyId: null,
          description: '',
          isPrivate: false,
        });
        resolve();
      };
      reader.onerror = (err) => {
        console.error('[StoriesStore] Ошибка чтения выбранного файла изображения:', err);
        reject(err);
      };
      reader.readAsDataURL(file);
    });
  },

  postStory: async (image: string, description: string, isPrivate: boolean) => {
    try {
      const createdStory = await storiesService.postStoryAsync(image, description, isPrivate);
      if (createdStory) {
        set((state) => ({
          myStories: [createdStory, ...state.myStories.filter((s) => s.id !== createdStory.id)],
        }));

        await get().loadMyStories();
        await get().loadStoriesFeed();
        return true;
      }
      return false;
    } catch (ex) {
      console.error('[StoriesStore ERROR] Ошибка публикации истории:', ex);
      return false;
    }
  },

  updateStory: async (storyId: number, image: string | null | undefined, description: string, isPrivate: boolean) => {
    try {
      const updatedStory = await storiesService.updateStoryAsync(storyId, image, description, isPrivate);
      if (updatedStory) {
        set((state) => ({
          myStories: state.myStories.map((s) => (s.id === storyId ? updatedStory : s)),
        }));

        await get().loadMyStories();
        await get().loadStoriesFeed();
        return true;
      }
      return false;
    } catch (ex) {
      console.error('[StoriesStore ERROR] Ошибка обновления истории:', ex);
      return false;
    }
  },

  // 🟢 1:1 С WPF StoriesViewModel.EditStory: скачивает изображение в память перед открытием редактора
  editStory: async (story: IStory) => {
    if (!story) return;

    const loadedDataUrl = await storiesService.getStoryImageDataUrlAsync(story.id, story.imagePath);

    eventBus.emit('OpenStoryEditorMessage', {
      image: loadedDataUrl || normalizeImageSrc(story.imagePath),
      storyId: story.id,
      description: story.description ?? '',
      isPrivate: story.isPrivate ?? false,
    });
  },

  // 🟢 ВЫЗОВ ОФИЦИАЛЬНОГО ДИАЛОГА ПОДТВЕРЖДЕНИЯ (ConfirmDialogView)
  requestDeleteStoryWithConfirmation: (story: IStory) => {
    if (!story) return;

    eventBus.emit('OpenConfirmDialogMessage', {
      title: 'Delete Story',
      message: 'Are you sure you want to delete this story?',
      confirmButtonText: 'Delete',
      onConfirmAction: async () => {
        await get().deleteStory(story);
      },
    });
  },

  deleteStory: async (story: IStory) => {
    if (!story) return;
    try {
      const success = await storiesService.deleteStoryAsync(story.id);
      if (success) {
        set((state) => ({ myStories: state.myStories.filter((s) => s.id !== story.id) }));
        await get().loadStoriesFeed();
      }
    } catch (e) {
      console.error('[StoriesStore] Ошибка при удалении истории:', e);
    }
  },

  openUserStoryGroup: (group) => {
    if (!group || group.stories.length === 0) return;
    const targetList = [...group.stories];
    const startIndex = targetList.findIndex((s) => !s.hasViewed);
    eventBus.emit('OpenStoryViewerMessage', {
      stories: targetList,
      startIndex: startIndex >= 0 ? startIndex : 0,
    });
  },

  openStoryViewer: async (selectedStory) => {
    if (!selectedStory) return;

    selectedStory.hasViewed = true;
    eventBus.emit('StoryViewedMessage', { storyId: selectedStory.id, userId: selectedStory.userId });

    let targetList: IStory[] = [];
    const currentUserId = userSession.userId;

    if (selectedStory.userId === currentUserId && get().myStories.length > 0) {
      targetList = [...get().myStories];
    } else {
      const group = get().authorGroups.find((g) => g.userId === selectedStory.userId);
      if (group && group.stories.some((s) => s.id === selectedStory.id)) {
        targetList = [...group.stories];
      } else {
        try {
          const userStories = await storiesService.getUserStoriesAsync(selectedStory.userId);
          if (userStories && userStories.length > 0) {
            targetList = userStories;
          }
        } catch (ex) {
          console.error('[StoriesStore ERROR] Ошибка при загрузке историй автора:', ex);
        }

        if (targetList.length === 0) {
          const feedAuthorStories = get().storiesFeed.filter((s) => s.userId === selectedStory.userId);
          targetList = feedAuthorStories.length > 0 ? feedAuthorStories : [selectedStory];
        }
      }
    }

    const startIndex = targetList.findIndex((s) => s.id === selectedStory.id);
    eventBus.emit('OpenStoryViewerMessage', {
      stories: targetList,
      startIndex: startIndex >= 0 ? startIndex : 0,
    });
  },

  sortStories: (criterion: string) => {
    const myStories = [...get().myStories];
    if (myStories.length === 0) return;

    const sorted = myStories.sort((a, b) => {
      switch (criterion) {
        case 'DateAsc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'ViewsDesc':
          return b.viewsCount - a.viewsCount;
        case 'ViewsAsc':
          return a.viewsCount - b.viewsCount;
        case 'LikesDesc':
          return b.likesCount - a.likesCount;
        case 'LikesAsc':
          return a.likesCount - b.likesCount;
        case 'DislikesDesc':
          return b.dislikesCount - a.dislikesCount;
        case 'DislikesAsc':
          return a.dislikesCount - b.dislikesCount;
        case 'CommentsDesc':
          return b.commentsCount - a.commentsCount;
        case 'CommentsAsc':
          return a.commentsCount - b.commentsCount;
        case 'DateDesc':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    set({ myStories: sorted });
  },

  cleanupViewedStories: () => {
    const remaining = get().storiesFeed.filter((s) => !s.hasViewed);
    set({
      storiesFeed: remaining,
      hasUnviewedStories: remaining.length > 0,
    });
    updateCalculatedFeedState(remaining, set);
  },

  recordStoryView: async (storyId: number, authorUserId: number) => {
    set((state) => {
      const feed = state.storiesFeed.map((s) => (s.id === storyId ? { ...s, hasViewed: true } : s));
      const groups = state.authorGroups.map((g) => {
        if (g.userId === authorUserId) {
          const updatedStories = g.stories.map((s) => (s.id === storyId ? { ...s, hasViewed: true } : s));
          return { ...g, stories: updatedStories };
        }
        return g;
      });

      return {
        storiesFeed: feed,
        authorGroups: groups,
        hasUnviewedStories: feed.some((s) => !s.hasViewed),
      };
    });

    try {
      await storiesService.recordStoryViewAsync(storyId);
    } catch (ex) {
      console.error('[StoriesStore ERROR] Ошибка записи просмотра истории.', ex);
    }
  },

  reactToStory: async (storyId: number, reactionType: number) => {
    try {
      await storiesService.reactToStoryAsync(storyId, reactionType);
    } catch (ex) {
      console.error('[StoriesStore ERROR] Ошибка реакции на историю.', ex);
    }
  },
}));

function updateCalculatedFeedState(feed: IStory[], set: any) {
  const distinctMap = new Map<number, IStory>();
  feed.forEach((s) => {
    if (!distinctMap.has(s.userId)) distinctMap.set(s.userId, s);
  });
  const distinct = Array.from(distinctMap.values());

  const groupsMap = new Map<number, IStory[]>();
  feed.forEach((s) => {
    const list = groupsMap.get(s.userId) || [];
    list.push(s);
    groupsMap.set(s.userId, list);
  });

  const groups: IUserStoryGroup[] = Array.from(groupsMap.entries()).map(([userId, stories]) => ({
    userId,
    authorName: stories[0].authorName,
    authorAvatar: stories[0].authorAvatar,
    stories: stories.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
  }));

  const unviewed = feed.find((s) => !s.hasViewed) || feed[0] || null;

  set({
    firstAuthor: distinct[0] || null,
    secondAuthor: distinct[1] || null,
    hasSecondAuthor: Boolean(distinct[1]),
    extraAuthorsCount: Math.max(0, distinct.length - 2),
    hasExtraAuthors: distinct.length > 2,
    firstNewStory: unviewed,
    authorGroups: groups,
    distinctAuthorGroups: groups,
    firstAuthorGroup: groups[0] || null,
    secondAuthorGroup: groups[1] || null,
    hasSecondAuthorGroup: Boolean(groups[1]),
    extraAuthorGroupsCount: Math.max(0, groups.length - 2),
    hasExtraAuthorGroups: groups.length > 2,
  });
}

// 🟢 Слушатели шины сообщений
eventBus.on('PostStoryMessage', async ({ image, description, isPrivate }) => {
  await useStoriesStore.getState().postStory(image, description, isPrivate);
});

eventBus.on('UpdateStoryMessage', async ({ storyId, image, description, isPrivate }) => {
  await useStoriesStore.getState().updateStory(storyId, image, description, isPrivate);
});

eventBus.on('RequestEditStoryMessage', async ({ story }) => {
  await useStoriesStore.getState().editStory(story);
});

// 🟢 Запрос на удаление вызывает диалог подтверждения
eventBus.on('RequestDeleteStoryMessage', ({ story }) => {
  useStoriesStore.getState().requestDeleteStoryWithConfirmation(story);
});

eventBus.on('StoryReactMessage', async ({ storyId, type }) => {
  await useStoriesStore.getState().reactToStory(storyId, type);
});

eventBus.on('StoryViewedMessage', async ({ storyId, userId }) => {
  await useStoriesStore.getState().recordStoryView(storyId, userId);
});

eventBus.on('StoryPostedMessage', async ({ userId }) => {
  await useStoriesStore.getState().loadStoriesFeed();
  if (userId === userSession.userId) {
    await useStoriesStore.getState().loadMyStories();
  }
});

// 🟢 РЕАЛЬНОЕ СИНХРОННОЕ УДАЛЕНИЕ ИЗ SIGNALR
eventBus.on('StoryDeletedMessage', ({ storyId, userId }) => {
  useStoriesStore.setState((state) => ({
    myStories: state.myStories.filter((s) => s.id !== storyId),
    storiesFeed: state.storiesFeed.filter((s) => s.id !== storyId),
  }));
  void useStoriesStore.getState().loadStoriesFeed();
  if (userId === userSession.userId) {
    void useStoriesStore.getState().loadMyStories();
  }
});