// src/stores/storyViewerStore.ts
import { create } from 'zustand';
import { apiClient } from '../services/apiClient';
import { userSession } from '../services/userSession';

export interface IStoryComment {
  id: number;
  storyId: number;
  userId: number;
  userName: string;
  userAvatar?: string | null;
  text: string;
  createdAt: string;
  parentCommentId?: number | null;
  likesCount: number;
  dislikesCount: number;
  myReaction?: number | null; // 0 = Like, 1 = Dislike
  replies?: IStoryComment[];
  isRepliesExpanded?: boolean;
}

export interface IStory {
  id: number;
  userId: number;
  userName: string;
  userAvatar?: string | null;
  imagePath: string;
  description?: string;
  createdAt: string;
  viewsCount: number;
  likesCount: number;
  dislikesCount: number;
  commentsCount: number;
  myReaction?: number | null;
  hasViewed: boolean;
}

interface StoryViewerState {
  isViewerOpen: boolean;
  isCommentsOpen: boolean;
  stories: IStory[];
  currentIndex: number;
  currentStory: IStory | null;
  currentComments: IStoryComment[];
  replyingToComment: IStoryComment | null;
  newCommentText: string;

  // Actions
  openViewer: (stories: IStory[], startIndex?: number) => void;
  closeViewer: () => void;
  nextStory: () => void;
  previousStory: () => void;
  toggleComments: () => void;
  setReplyingToComment: (comment: IStoryComment | null) => void;
  setNewCommentText: (text: string) => void;
  sendComment: () => Promise<void>;
  toggleStoryLike: () => Promise<void>;
  toggleStoryDislike: () => Promise<void>;
  toggleCommentLike: (comment: IStoryComment) => Promise<void>;
  toggleCommentDislike: (comment: IStoryComment) => Promise<void>;
}

export const useStoryViewerStore = create<StoryViewerState>((set, get) => ({
  isViewerOpen: false,
  isCommentsOpen: false,
  stories: [],
  currentIndex: 0,
  currentStory: null,
  currentComments: [],
  replyingToComment: null,
  newCommentText: '',

  openViewer: (stories, startIndex = 0) => {
    if (!stories || stories.length === 0) return;
    const idx = Math.max(0, Math.min(startIndex, stories.length - 1));
    const target = stories[idx];

    set({
      isViewerOpen: true,
      isCommentsOpen: false,
      stories,
      currentIndex: idx,
      currentStory: target,
      replyingToComment: null,
      newCommentText: '',
    });

    apiClient.post(`api/Stories/${target.id}/view`).catch(() => {});
    loadComments(target.id, set);
  },

  closeViewer: () => set({ isViewerOpen: false, currentStory: null, currentComments: [] }),

  nextStory: () => {
    const { currentIndex, stories } = get();
    if (currentIndex < stories.length - 1) {
      get().openViewer(stories, currentIndex + 1);
    } else {
      get().closeViewer();
    }
  },

  previousStory: () => {
    const { currentIndex, stories } = get();
    if (currentIndex > 0) {
      get().openViewer(stories, currentIndex - 1);
    }
  },

  toggleComments: () => set((state) => ({ isCommentsOpen: !state.isCommentsOpen })),
  setReplyingToComment: (comment) => set({ replyingToComment: comment }),
  setNewCommentText: (text) => set({ newCommentText: text }),

  sendComment: async () => {
    const { currentStory, newCommentText, replyingToComment } = get();
    if (!currentStory || !newCommentText.trim()) return;

    try {
      await apiClient.post(`api/Stories/${currentStory.id}/comments`, {
        text: newCommentText.trim(),
        parentCommentId: replyingToComment?.id || null,
      });

      set({ newCommentText: '', replyingToComment: null });
      loadComments(currentStory.id, set);
    } catch {}
  },

  toggleStoryLike: async () => {
    const { currentStory } = get();
    if (!currentStory) return;

    const isRemoving = currentStory.myReaction === 0;
    const nextReaction = isRemoving ? null : 0;
    const updated = {
      ...currentStory,
      likesCount: isRemoving ? currentStory.likesCount - 1 : currentStory.likesCount + 1,
      dislikesCount: currentStory.myReaction === 1 ? currentStory.dislikesCount - 1 : currentStory.dislikesCount,
      myReaction: nextReaction,
    };

    set({ currentStory: updated });
    apiClient.post(`api/Stories/${currentStory.id}/reaction`, { reaction: isRemoving ? -1 : 0 }).catch(() => {});
  },

  toggleStoryDislike: async () => {
    const { currentStory } = get();
    if (!currentStory) return;

    const isRemoving = currentStory.myReaction === 1;
    const nextReaction = isRemoving ? null : 1;
    const updated = {
      ...currentStory,
      dislikesCount: isRemoving ? currentStory.dislikesCount - 1 : currentStory.dislikesCount + 1,
      likesCount: currentStory.myReaction === 0 ? currentStory.likesCount - 1 : currentStory.likesCount,
      myReaction: nextReaction,
    };

    set({ currentStory: updated });
    apiClient.post(`api/Stories/${currentStory.id}/reaction`, { reaction: isRemoving ? -1 : 1 }).catch(() => {});
  },

  toggleCommentLike: async (comment) => {
    const isRemoving = comment.myReaction === 0;
    apiClient.post(`api/Stories/comments/${comment.id}/reaction`, { reaction: isRemoving ? -1 : 0 }).catch(() => {});
    loadComments(get().currentStory!.id, set);
  },

  toggleCommentDislike: async (comment) => {
    const isRemoving = comment.myReaction === 1;
    apiClient.post(`api/Stories/comments/${comment.id}/reaction`, { reaction: isRemoving ? -1 : 1 }).catch(() => {});
    loadComments(get().currentStory!.id, set);
  },
}));

function loadComments(storyId: number, set: any) {
  apiClient.get<IStoryComment[]>(`api/Stories/${storyId}/comments`).then((res) => {
    const flat = res.data || [];
    const topLevel = flat.filter((c) => !c.parentCommentId);
    topLevel.forEach((t) => {
      t.replies = flat.filter((r) => r.parentCommentId === t.id);
    });
    set({ currentComments: topLevel });
  }).catch(() => {});
}