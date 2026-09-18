import { create } from 'zustand';
import { IStory, IUserStoryGroup } from '../types/models';
import { apiClient } from '../services/apiClient';
import { userSession } from '../services/userSession';
import { eventBus } from '../services/eventBus';

interface StoriesState {
  authorGroups: IUserStoryGroup[];
  storiesFeed: IStory[];
  myStories: IStory[];
  firstNewStory: IStory | null;
  hasUnviewedStories: boolean;
  isStoriesPanelExpanded: boolean;

  // Header Stack Getters
  firstAuthor: IStory | null;
  secondAuthor: IStory | null;
  hasSecondAuthor: boolean;
  extraAuthorsCount: number;
  hasExtraAuthors: boolean;

  // Actions
  toggleStoriesPanel: () => void;
  loadStoriesFeed: () => Promise<void>;
  loadMyStories: () => Promise<void>;
  openUserStoryGroup: (group: IUserStoryGroup) => void;
  openStoryViewer: (selectedStory: IStory) => Promise<void>;
  deleteStory: (story: IStory) => Promise<void>;
  cleanupViewedStories: () => void;
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

  toggleStoriesPanel: () => {
    const nextState = !get().isStoriesPanelExpanded;
    set({ isStoriesPanelExpanded: nextState });
    if (!nextState) {
      get().cleanupViewedStories();
    }
  },

  loadStoriesFeed: async () => {
    try {
      const res = await apiClient.get<IStory[]>('api/Stories/feed');
      const feed = res.data || [];
      const unviewed = feed.filter((s) => !s.hasViewed);

      set({
        storiesFeed: unviewed,
        hasUnviewedStories: unviewed.length > 0,
      });

      updateHeaderAuthors(unviewed, set);
      updateAuthorGroups(unviewed, set);
    } catch (e) {
      console.error('[StoriesStore] Ошибка загрузки ленты историй:', e);
    }
  },

  loadMyStories: async () => {
    const userId = userSession.userId;
    if (userId <= 0) return;

    try {
      const res = await apiClient.get<IStory[]>(`api/Stories/user/${userId}`);
      set({ myStories: res.data || [] });
    } catch (e) {
      console.error('[StoriesStore] Ошибка загрузки моих историй:', e);
    }
  },

  openUserStoryGroup: (group) => {
    if (!group || group.stories.length === 0) return;
    const startIndex = group.stories.findIndex((s) => !s.hasViewed);
    eventBus.emit('OpenStoryViewerMessage' as any, {
      stories: group.stories,
      startIndex: startIndex >= 0 ? startIndex : 0,
    });
  },

  openStoryViewer: async (selectedStory) => {
    if (!selectedStory) return;

    selectedStory.hasViewed = true;
    let targetList: IStory[] = [];

    if (selectedStory.userId === userSession.userId) {
      targetList = get().myStories;
    } else {
      const group = get().authorGroups.find((g) => g.userId === selectedStory.userId);
      targetList = group ? group.stories : [selectedStory];
    }

    const idx = targetList.findIndex((s) => s.id === selectedStory.id);
    eventBus.emit('OpenStoryViewerMessage' as any, {
      stories: targetList,
      startIndex: idx >= 0 ? idx : 0,
    });
  },

  deleteStory: async (story) => {
    if (!story) return;
    try {
      await apiClient.delete(`api/Stories/${story.id}`);
      set((state) => ({ myStories: state.myStories.filter((s) => s.id !== story.id) }));
      get().loadStoriesFeed();
    } catch (e) {
      console.error('[StoriesStore] Ошибка удаления истории:', e);
    }
  },

  cleanupViewedStories: () => {
    const remaining = get().storiesFeed.filter((s) => !s.hasViewed);
    set({
      storiesFeed: remaining,
      hasUnviewedStories: remaining.length > 0,
    });
    updateHeaderAuthors(remaining, set);
    updateAuthorGroups(remaining, set);
  },
}));

function updateHeaderAuthors(feed: IStory[], set: any) {
  const distinctMap = new Map<number, IStory>();
  feed.forEach((s) => {
    if (!distinctMap.has(s.userId)) distinctMap.set(s.userId, s);
  });
  const distinct = Array.from(distinctMap.values());

  set({
    firstAuthor: distinct[0] || null,
    secondAuthor: distinct[1] || null,
    hasSecondAuthor: Boolean(distinct[1]),
    extraAuthorsCount: Math.max(0, distinct.length - 2),
    hasExtraAuthors: distinct.length > 2,
    firstNewStory: feed.find((s) => !s.hasViewed) || feed[0] || null,
  });
}

function updateAuthorGroups(feed: IStory[], set: any) {
  const map = new Map<number, IStory[]>();
  feed.forEach((s) => {
    const list = map.get(s.userId) || [];
    list.push(s);
    map.set(s.userId, list);
  });

  const groups: IUserStoryGroup[] = Array.from(map.entries()).map(([userId, stories]) => ({
    userId,
    authorName: stories[0].authorName,
    authorAvatar: stories[0].authorAvatar,
    stories,
  }));

  set({ authorGroups: groups });
}