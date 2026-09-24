import { apiClient, BASE_SERVER_URL } from './apiClient';
import { IStory, IStoryComment } from '../types/models';

export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const byteString = atob(parts[1]);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);

  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }

  return new Blob([uint8Array], { type: mime });
}

export class StoriesService {
  public async getStoriesFeedAsync(): Promise<IStory[] | null> {
    try {
      const response = await apiClient.get<IStory[]>('api/Stories/feed');
      return response.data || [];
    } catch (ex) {
      console.error('[StoriesService ERROR] Сбой загрузки ленты историй.', ex);
      return null;
    }
  }

  public async getUserStoriesAsync(userId: number): Promise<IStory[] | null> {
    try {
      const response = await apiClient.get<IStory[]>(`api/Stories/user/${userId}`);
      return response.data || [];
    } catch (ex) {
      console.error(`[StoriesService ERROR] Сбой загрузки историй для UserId=${userId}`, ex);
      return null;
    }
  }

  // 🟢 Загрузка картинки через защищенный API контроллер с гарантированным CORS
  public async getStoryImageDataUrlAsync(storyId: number, imagePath: string): Promise<string | null> {
    try {
      const response = await apiClient.get(`api/Stories/image/${storyId}`, { responseType: 'blob' });
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(response.data);
      });
    } catch {
      // Запасной путь через прямой URL файла
      try {
        let resolvedUrl = imagePath.trim();
        if (!resolvedUrl.startsWith('http://') && !resolvedUrl.startsWith('https://') && !resolvedUrl.startsWith('data:')) {
          const baseServer = (BASE_SERVER_URL || 'https://localhost:7214').replace(/\/+$/, '');
          const cleanPath = resolvedUrl.replace(/\\/g, '/').replace(/^\/+/, '');
          resolvedUrl = `${baseServer}/${cleanPath}`;
        }

        const response = await apiClient.get(resolvedUrl, { responseType: 'blob' });
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(response.data);
        });
      } catch (ex) {
        console.error('[StoriesService ERROR] Не удалось скачать изображение истории в DataURL.', ex);
        return null;
      }
    }
  }

  public async deleteStoryAsync(storyId: number): Promise<boolean> {
    try {
      const response = await apiClient.delete(`api/Stories/${storyId}`);
      return response.status >= 200 && response.status < 300;
    } catch (ex) {
      console.error(`[StoriesService ERROR] Сбой удаления истории StoryId=${storyId}`, ex);
      return false;
    }
  }

  public async postStoryAsync(image: string, description: string, isPrivate: boolean): Promise<IStory | null> {
    try {
      const formData = new FormData();
      const blob = dataUrlToBlob(image);
      formData.append('file', blob, 'story.jpg');
      formData.append('description', description || '');
      formData.append('isPrivate', isPrivate ? 'true' : 'false');

      // 🟢 Без ручного Content-Type: Axios сам установит boundary
      const response = await apiClient.post<IStory>('api/Stories/upload', formData);

      if (response.status >= 200 && response.status < 300) {
        return response.data;
      }
      return null;
    } catch (ex) {
      console.error('[StoriesService ERROR] Сбой публикации истории.', ex);
      return null;
    }
  }

  public async updateStoryAsync(
    storyId: number,
    image: string | null | undefined,
    description: string,
    isPrivate: boolean
  ): Promise<IStory | null> {
    try {
      const formData = new FormData();
      if (image && image.startsWith('data:')) {
        const blob = dataUrlToBlob(image);
        formData.append('file', blob, 'updated_story.jpg');
      }
      formData.append('description', description || '');
      formData.append('isPrivate', isPrivate ? 'true' : 'false');

      // 🟢 Без ручного Content-Type: правильный multipart boundary
      const response = await apiClient.put<IStory>(`api/Stories/${storyId}`, formData);

      if (response.status >= 200 && response.status < 300) {
        return response.data;
      }
      return null;
    } catch (ex) {
      console.error(`[StoriesService ERROR] Сбой обновления истории StoryId=${storyId}`, ex);
      return null;
    }
  }

  public async recordStoryViewAsync(storyId: number): Promise<boolean> {
    try {
      const response = await apiClient.post(`api/Stories/view/${storyId}`, null);
      return response.status >= 200 && response.status < 300;
    } catch (ex) {
      console.error(`[StoriesService ERROR] Сбой фиксации просмотра истории StoryId=${storyId}`, ex);
      return false;
    }
  }

  public async reactToStoryAsync(storyId: number, reactionType: number): Promise<boolean> {
    try {
      let response = await apiClient.post(`api/Stories/react/${storyId}/${reactionType}`, null);
      if (response.status < 200 || response.status >= 300) {
        response = await apiClient.post(`api/Stories/react/${storyId}?type=${reactionType}`, null);
      }
      return response.status >= 200 && response.status < 300;
    } catch (ex) {
      console.error(`[StoriesService ERROR] Сбой отправки реакции на историю StoryId=${storyId}`, ex);
      return false;
    }
  }

  public async getStoryCommentsAsync(storyId: number): Promise<IStoryComment[] | null> {
    try {
      const response = await apiClient.get<IStoryComment[]>(`api/Stories/${storyId}/comments`);
      return response.data || [];
    } catch (ex) {
      console.error(`[StoriesService ERROR] Сбой загрузки комментариев для StoryId=${storyId}`, ex);
      return null;
    }
  }

  public async addStoryCommentAsync(
    storyId: number,
    text: string,
    parentCommentId?: number | null
  ): Promise<boolean> {
    try {
      const payload = { text, parentCommentId: parentCommentId ?? null };
      const response = await apiClient.post(`api/Stories/comment/${storyId}`, payload);
      return response.status >= 200 && response.status < 300;
    } catch (ex) {
      console.error(`[StoriesService ERROR] Сбой добавления комментария к StoryId=${storyId}`, ex);
      return false;
    }
  }

  public async reactToCommentAsync(commentId: number, reactionType: number): Promise<boolean> {
    try {
      const response = await apiClient.post(`api/Stories/comment/react/${commentId}/${reactionType}`, null);
      return response.status >= 200 && response.status < 300;
    } catch (ex) {
      console.error(`[StoriesService ERROR] Сбой реакции на комментарий CommentId=${commentId}`, ex);
      return false;
    }
  }
}

export const storiesService = new StoriesService();