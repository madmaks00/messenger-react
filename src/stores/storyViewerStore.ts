import { create } from 'zustand';
import { IStory, IStoryComment, IStoryProgressItem } from '../types/models';
import { storiesService } from '../services/stories.service';
import { userSession } from '../services/userSession';
import { eventBus } from '../services/eventBus';
import { useStoriesStore } from './storiesStore';

interface StoryViewerState {
  isViewerOpen: boolean;
  isCommentsOpen: boolean;
  isOwnStory: boolean;
  stories: IStory[];
  currentIndex: number;
  currentStory: IStory | null;
  currentComments: IStoryComment[];
  storiesProgressList: IStoryProgressItem[];
  replyingToComment: IStoryComment | null;
  newCommentText: string;
  hasPreviousStory: boolean;
  hasNextStory: boolean;

  // Actions (Matching StoryViewerViewModel.cs)
  openViewer: (stories: IStory[] | null | undefined, startIndex?: number) => void;
  closeViewer: () => void;
  nextStory: () => Promise<void>;
  previousStory: () => Promise<void>;
  toggleComments: () => void;
  editCurrentStory: () => void;
  deleteCurrentStory: () => void;
  setReplyingToComment: (comment: IStoryComment | null) => void;
  cancelReply: () => void;
  setNewCommentText: (text: string) => void;
  sendComment: () => Promise<void>;
  toggleStoryLike: () => Promise<void>;
  toggleStoryDislike: () => Promise<void>;
  toggleCommentLike: (comment: IStoryComment | null) => Promise<void>;
  toggleCommentDislike: (comment: IStoryComment | null) => Promise<void>;
  toggleReplies: (commentId: number) => void;
  loadCommentsFromServer: (storyId: number) => Promise<void>;
}

export const useStoryViewerStore = create<StoryViewerState>((set, get) => ({
  isViewerOpen: false,
  isCommentsOpen: false,
  isOwnStory: false,
  stories: [],
  currentIndex: 0,
  currentStory: null,
  currentComments: [],
  storiesProgressList: [],
  replyingToComment: null,
  newCommentText: '',
  hasPreviousStory: false,
  hasNextStory: false,

  openViewer: (storiesList, startIndex = 0) => {
    if (!storiesList || storiesList.length === 0) return;

    const safeIndex = startIndex < 0 || startIndex >= storiesList.length ? 0 : startIndex;
    const targetStory = storiesList[safeIndex];
    const currentUserId = userSession.userId;

    const progressList: IStoryProgressItem[] = storiesList.map((_, i) => ({
      isActive: i === safeIndex,
      isPassed: i < safeIndex,
    }));

    set({
      isViewerOpen: true,
      isCommentsOpen: false,
      stories: storiesList,
      currentIndex: safeIndex,
      currentStory: targetStory,
      isOwnStory: targetStory.userId === currentUserId,
      hasPreviousStory: safeIndex > 0,
      hasNextStory: safeIndex < storiesList.length - 1,
      storiesProgressList: progressList,
      currentComments: [],
      replyingToComment: null,
      newCommentText: '',
    });

    eventBus.emit('StoryViewedMessage', { storyId: targetStory.id, userId: targetStory.userId });
    void get().loadCommentsFromServer(targetStory.id);
  },

  closeViewer: () => {
    set({
      isViewerOpen: false,
      isCommentsOpen: false,
      currentStory: null,
      currentComments: [],
      storiesProgressList: [],
      newCommentText: '',
      replyingToComment: null,
    });
  },

  nextStory: async () => {
    const { currentIndex, stories } = get();
    if (currentIndex < stories.length - 1) {
      get().openViewer(stories, currentIndex + 1);
    } else {
      get().closeViewer();
    }
  },

  previousStory: async () => {
    const { currentIndex, stories } = get();
    if (currentIndex > 0) {
      get().openViewer(stories, currentIndex - 1);
    }
  },

  toggleComments: () => set((state) => ({ isCommentsOpen: !state.isCommentsOpen })),

  editCurrentStory: () => {
    const { currentStory } = get();
    if (!currentStory) return;
    get().closeViewer();
    eventBus.emit('RequestEditStoryMessage', { story: currentStory });
  },

  deleteCurrentStory: () => {
    const { currentStory } = get();
    if (!currentStory) return;
    get().closeViewer();
    eventBus.emit('RequestDeleteStoryMessage', { story: currentStory });
  },

  setReplyingToComment: (comment) => set({ replyingToComment: comment }),
  cancelReply: () => set({ replyingToComment: null }),
  setNewCommentText: (text) => set({ newCommentText: text }),

  // 🟢 Синхронизация счетчика комментариев с сервера
  loadCommentsFromServer: async (storyId: number) => {
    try {
      const flatComments = await storiesService.getStoryCommentsAsync(storyId);
      if (!flatComments || flatComments.length === 0) {
        set((state) => ({
          currentComments: [],
          currentStory: state.currentStory && state.currentStory.id === storyId
            ? { ...state.currentStory, commentsCount: 0 }
            : state.currentStory,
          stories: state.stories.map((s) => s.id === storyId ? { ...s, commentsCount: 0 } : s),
        }));
        return;
      }

      const topLevel = flatComments.filter((c) => !c.parentCommentId);
      topLevel.forEach((top) => {
        top.replies = flatComments.filter(
          (c) => c.parentCommentId === top.id || isChildOfComment(c, top.id, flatComments)
        );
        top.repliesCount = top.replies.length;
        top.hasReplies = top.repliesCount > 0;
      });

      set((state) => ({
        currentComments: topLevel,
        currentStory: state.currentStory && state.currentStory.id === storyId
          ? { ...state.currentStory, commentsCount: flatComments.length }
          : state.currentStory,
        stories: state.stories.map((s) => s.id === storyId ? { ...s, commentsCount: flatComments.length } : s),
      }));
    } catch (e) {
      console.error('[StoryViewerStore] Ошибка загрузки комментариев:', e);
    }
  },

  sendComment: async () => {
    const { currentStory, newCommentText, replyingToComment } = get();
    if (!currentStory || !newCommentText.trim()) return;

    const text = newCommentText.trim();
    const parentId = replyingToComment?.parentCommentId ?? replyingToComment?.id ?? null;

    set({ newCommentText: '', replyingToComment: null });

    try {
      const success = await storiesService.addStoryCommentAsync(currentStory.id, text, parentId);
      if (success) {
        set((state) => ({
          currentStory: state.currentStory
            ? { ...state.currentStory, commentsCount: state.currentStory.commentsCount + 1 }
            : null,
          stories: state.stories.map((s) => s.id === currentStory.id ? { ...s, commentsCount: s.commentsCount + 1 } : s),
        }));

        await get().loadCommentsFromServer(currentStory.id);
      }
    } catch (e) {
      console.error('[StoryViewerStore] Ошибка отправки комментария:', e);
    }
  },

  toggleStoryLike: async () => {
    const { currentStory } = get();
    if (!currentStory) return;

    const isRemoving = currentStory.myReaction === 0;
    const type = isRemoving ? -1 : 0;

    const updated = {
      ...currentStory,
      likesCount: isRemoving ? Math.max(0, currentStory.likesCount - 1) : currentStory.likesCount + 1,
      dislikesCount: currentStory.myReaction === 1 ? Math.max(0, currentStory.dislikesCount - 1) : currentStory.dislikesCount,
      myReaction: isRemoving ? null : 0,
    };

    set({ currentStory: updated });

    try {
      await storiesService.reactToStoryAsync(currentStory.id, type);
    } catch (e) {
      console.error('[StoryViewerStore] Ошибка лайка истории:', e);
    }
  },

  toggleStoryDislike: async () => {
    const { currentStory } = get();
    if (!currentStory) return;

    const isRemoving = currentStory.myReaction === 1;
    const type = isRemoving ? -1 : 1;

    const updated = {
      ...currentStory,
      dislikesCount: isRemoving ? Math.max(0, currentStory.dislikesCount - 1) : currentStory.dislikesCount + 1,
      likesCount: currentStory.myReaction === 0 ? Math.max(0, currentStory.likesCount - 1) : currentStory.likesCount,
      myReaction: isRemoving ? null : 1,
    };

    set({ currentStory: updated });

    try {
      await storiesService.reactToStoryAsync(currentStory.id, type);
    } catch (e) {
      console.error('[StoryViewerStore] Ошибка дизлайка истории:', e);
    }
  },

  toggleCommentLike: async (comment) => {
    if (!comment) return;

    const isRemoving = comment.myReaction === 0;
    const type = isRemoving ? -1 : 0;

    comment.likesCount = isRemoving ? Math.max(0, comment.likesCount - 1) : comment.likesCount + 1;
    if (comment.myReaction === 1) comment.dislikesCount = Math.max(0, comment.dislikesCount - 1);
    comment.myReaction = isRemoving ? null : 0;

    set((state) => ({ currentComments: [...state.currentComments] }));

    try {
      await storiesService.reactToCommentAsync(comment.id, type);
    } catch (e) {
      console.error('[StoryViewerStore] Ошибка лайка комментария:', e);
    }
  },

  toggleCommentDislike: async (comment) => {
    if (!comment) return;

    const isRemoving = comment.myReaction === 1;
    const type = isRemoving ? -1 : 1;

    comment.dislikesCount = isRemoving ? Math.max(0, comment.dislikesCount - 1) : comment.dislikesCount + 1;
    if (comment.myReaction === 0) comment.likesCount = Math.max(0, comment.likesCount - 1);
    comment.myReaction = isRemoving ? null : 1;

    set((state) => ({ currentComments: [...state.currentComments] }));

    try {
      await storiesService.reactToCommentAsync(comment.id, type);
    } catch (e) {
      console.error('[StoryViewerStore] Ошибка дизлайка комментария:', e);
    }
  },

  toggleReplies: (commentId: number) => {
    set((state) => ({
      currentComments: state.currentComments.map((c) =>
        c.id === commentId ? { ...c, isRepliesExpanded: !c.isRepliesExpanded } : c
      ),
    }));
  },
}));

function isChildOfComment(comment: IStoryComment, targetParentId: number, all: IStoryComment[]): boolean {
  if (!comment.parentCommentId) return false;
  if (comment.parentCommentId === targetParentId) return true;
  const parent = all.find((c) => c.id === comment.parentCommentId);
  if (!parent) return false;
  return isChildOfComment(parent, targetParentId, all);
}

// 🟢 Регистрация обработчиков сообщений (1:1 RegisterMessengerHandlers из StoryViewerViewModel.cs)
eventBus.on('OpenStoryViewerMessage', ({ stories, startIndex = 0 }) => {
  useStoryViewerStore.getState().openViewer(stories, startIndex);
});

eventBus.on('StoryViewedMessage', ({ storyId }) => {
  const current = useStoryViewerStore.getState().currentStory;
  if (current && current.id === storyId) {
    current.hasViewed = true;
  }
});

// 🟢 Синхронное обновление счетчиков комментариев из SignalR (WPF + React)
eventBus.on('StoryCommentAddedMessage', ({ storyId, commentsCount }) => {
  useStoryViewerStore.setState((state) => ({
    currentStory: state.currentStory?.id === storyId
      ? { ...state.currentStory, commentsCount }
      : state.currentStory,
    stories: state.stories.map((s) => s.id === storyId ? { ...s, commentsCount } : s),
  }));

  useStoriesStore.setState((state) => ({
    myStories: state.myStories.map((s) => s.id === storyId ? { ...s, commentsCount } : s),
    storiesFeed: state.storiesFeed.map((s) => s.id === storyId ? { ...s, commentsCount } : s),
  }));
});