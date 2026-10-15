import { beginMessageSend } from '../services/messageSendCoordinator';
import { isMessageTextTooLong } from '../utils/messageTextLimit';
import { userPresenceState, parsePresence } from '../services/userPresenceState';
import { create } from 'zustand';
import {
  IMessage,
  IUserSearchResult,
  IAttachment,
  ISelectableChat,
  ISavedGif,
  IChatListItem,
  MessageHelper,
} from '../types/models';
import { LastMessageType, AttachmentType } from '../types/enums';
import { apiClient, BASE_SERVER_URL } from '../services/apiClient';
import { UrlHelper } from '../utils/helpers';
import { chatService } from '../services/chat.service';
import { userService } from '../services/user.service';
import { gifService } from '../services/gif.service';
import { signalRService } from '../services/signalr.service';
import { secretChatCrypto } from '../services/secretChatCrypto.service';
import { userSession } from '../services/userSession';
import { eventBus } from '../services/eventBus';
import { useSidebarChatsStore } from './sidebarChatsStore';
import { useMessageInputStore } from './messageInputStore';
import { useEmojiStore } from './emojiStore';
import { useMusicPlayerStore } from './musicPlayerStore';
import { mediaCacheService } from '../services/mediaCache.service';
import { mediaDimensionsCache } from '../utils/mediaDimensionsCache';
import { getLocalDatabase } from '../db/localDb';
import { IAudioTrackModel, AudioMetadataHelper } from '../types/audio.types';
import { AudioConverterHelper } from '../utils/audioConverters';
import { audioPlayerService } from '../services/audioPlayer.service';
import { MessagePreviewHelper } from '../utils/messagePreviewHelper';

export function getMessageReplyText(msg: IMessage | any): string {
  if (!msg) return '';

  const text = (msg.text || '').trim();
  if (text.length > 0) {
    return text;
  }

  const attachments: IAttachment[] = msg.attachments || [];
  if (attachments.length > 0) {
    const first = attachments[0];
    const fileName = (first.fileName || '').toLowerCase();
    const url = (first.url || '').toLowerCase();

    const isGif =
      first.fileSizeStr === 'GIF' ||
      fileName.endsWith('.gif') ||
      url.endsWith('.gif') ||
      Boolean(first.isSilentVideo) ||
      (fileName.endsWith('.mp4') && first.fileSizeStr === 'GIF');

    if (isGif) return 'GIF';

    if (
      first.type === AttachmentType.Photo ||
      (!first.type && (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png') || fileName.endsWith('.webp') || fileName.endsWith('.bmp'))) ||
      (!first.type && first.url && !fileName.endsWith('.mp4'))
    ) {
      return 'Photo';
    }

    if (
      first.type === AttachmentType.Video ||
      fileName.endsWith('.mp4') ||
      fileName.endsWith('.mov') ||
      fileName.endsWith('.avi') ||
      fileName.endsWith('.mkv') ||
      url.endsWith('.mp4')
    ) {
      return 'Video';
    }

    if (first.type === AttachmentType.Voice || fileName.startsWith('voice_')) {
      return 'Voice message';
    }

    if (
      first.type === AttachmentType.Audio ||
      fileName.endsWith('.mp3') ||
      fileName.endsWith('.wav') ||
      fileName.endsWith('.flac') ||
      fileName.endsWith('.m4a') ||
      fileName.endsWith('.aac') ||
      fileName.endsWith('.ogg') ||
      fileName.endsWith('.opus')
    ) {
      return 'Music';
    }

    return first.fileName || 'Document';
  }

  if (msg.previewText && msg.previewText.trim().length > 0) {
    return msg.previewText;
  }

  return 'Message';
}

interface ChatState {
  selectedChatUser: IUserSearchResult | null;
  currentChatMessages: IMessage[];
  pinnedMessages: IMessage[];
  chatSearchResults: IMessage[];
  forwardChatList: ISelectableChat[];
  isChatSearching: boolean;
  isChatSearchMode: boolean;
  chatSearchText: string;
  isChatLoading: boolean;
  isHistoryLoading: boolean;
  isLoadingOlder: boolean;
  isScrolledToBottom: boolean;
  unreadCountInActiveChat: number;

  currentUserName: string;
  currentUserAvatar: string | null;

  isPinDialogOpen: boolean;
  pinDialogTitle: string;
  pinDialogActionText: string;
  pinForAllText: string;
  canPinForAll: boolean;
  messageToPin: IMessage | null;
  openPinDialog: (msg: IMessage) => void;
  cancelPin: () => void;
  confirmPin: (pinForAll: boolean) => Promise<void>;

  isForwardDialogOpen: boolean;
  messagesToForward: IMessage[];
  openForwardDialog: (messages: IMessage[]) => void;
  cancelForward: () => void;
  toggleSelectForwardChat: (uniqueKey: string) => void;
  confirmForward: () => Promise<void>;

  isConfirmDialogOpen: boolean;
  confirmDialogTitle: string;
  confirmDialogMessage: string;
  confirmDialogCheckboxText: string | null;
  confirmDialogButtonText: string;
  messagesPendingDeletion: IMessage[];
  openDeleteDialog: (msg: IMessage) => void;
  openDeleteMessagesDialog: (messages: IMessage[]) => void;
  openDeleteSelectedDialog: () => void;
  closeConfirmDialog: () => void;
  confirmDelete: (deleteForAll: boolean) => Promise<void>;

  isCurrentChatJoined: boolean;
  isBlockedByMe: boolean;
  isBlockedByThem: boolean;
  canSendText: boolean;
  canSendMedia: boolean;
  canPinMessages: boolean;
  canWriteMessages: boolean;

  isSelectionMode: boolean;
  selectedCount: number;

  ensureMyProfileLoadedAsync: () => Promise<void>;
  selectChatUser: (target: IUserSearchResult | null) => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  ensureMessageLoadedAsync: (messageId: number, source?: IMessage) => Promise<IMessage | null>;
  startSecretChat: () => Promise<void>;
  sendMessage: (
    text: string,
    attachments: IAttachment[],
    editingMessage: IMessage | null,
    replies: IMessage[]
  ) => Promise<void>;
  editMessage: (localId: number, serverId: number, text: string) => Promise<void>;
  deleteMessage: (msg: IMessage, deleteForAll: boolean) => Promise<void>;
  togglePinMessage: (msg: IMessage, pinForAll: boolean) => Promise<void>;
  toggleSelectMessage: (msg: IMessage) => void;
  toggleRowSelection: (msg: IMessage) => void;
  clearSelection: () => void;
  replySelected: () => void;
  forwardSelected: () => void;
  deleteSelected: () => void;

  startSearch: () => void;
  exitSearch: () => void;
  onChatSearchTextChanged: (query: string) => void;
  jumpToSearchedMessage: (targetMsg: IMessage) => Promise<void>;

  markAsRead: () => Promise<void>;
  trackVisiblePosts: (serverIds: number[]) => void;
  sendTyping: (text?: string) => void;
  syncPermissionsWithInput: () => void;
  triggerDeltaSync: () => Promise<void>;
  updateAttachmentDimensions: (messageId: number, width: number, height: number) => void;
  toggleAudio: (clickedAtt: IAttachment) => void;
  seekAudio: (seconds: number) => void;
}

const alreadyTrackedPostIds = new Set<number>();
let activeChatTypingTimer: ReturnType<typeof setTimeout> | null = null;
let typingDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let deltaSyncInterval: ReturnType<typeof setInterval> | null = null;
let chatSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

let currentChatLoadAbortController: AbortController | null = null;
let currentChatLoadSequence = 0;
let lastLoadedChatKey: string | null = null;

function getChatKey(target: IUserSearchResult | null): string {
  if (!target) return '';
  if (target.isSecretChat) return `s_${target.secretChatId || target.id}`;
  if (target.isGroup) return `g_${target.id}`;
  return `u_${target.id}`;
}

function computeCanWriteMessages(
  target: IUserSearchResult | null,
  isBlockedByMe: boolean,
  isBlockedByThem: boolean,
  isCurrentChatJoined: boolean,
  canSendText: boolean,
  currentUserId: number
): boolean {
  if (!target) return false;
  if (isBlockedByMe || isBlockedByThem) return false;
  if (target.isGroup && !isCurrentChatJoined) return false;
  if (!target.isGroup && !target.isChannel) return true;

  if (target.isChannel) {
    return target.adminId === currentUserId;
  }

  if (target.isGroup) {
    const isGroupAdmin = target.adminId === currentUserId;
    if (!isGroupAdmin && !canSendText) return false;
  }

  return true;
}

function resolveSessionUser(): { name: string; avatar: string | null } {
  try {
    const raw =
      localStorage.getItem('user_session_data') ||
      localStorage.getItem('current_user') ||
      localStorage.getItem('user');
    if (raw) {
      const parsed = JSON.parse(raw);
      const name = parsed.nickName || parsed.nickname || parsed.username || parsed.name || '';
      const avatar = parsed.avatarPath || parsed.avatar || null;
      return { name, avatar };
    }
  } catch {}

  const anySession = userSession as any;
  return {
    name: anySession?.nickName || anySession?.username || '',
    avatar: anySession?.avatarPath || null,
  };
}

function enrichMessage(
  msg: IMessage,
  currentUserId: number,
  currentUserName: string,
  currentUserAvatar: string | null,
  targetChat: IUserSearchResult | null
): IMessage {
  const isMy = Number(msg.senderId) === Number(currentUserId) || Boolean(msg.isMyMessage);
  const opponentAvatar = !targetChat?.isGroup
    ? targetChat?.avatarPath || (targetChat as any)?.avatar || null
    : null;

  const opponentName = !targetChat?.isGroup
    ? targetChat?.nickName || (targetChat as any)?.groupName || (targetChat as any)?.username || 'User'
    : msg.senderName || 'User';

  let fixedAttachments = msg.attachments;
  if (fixedAttachments && fixedAttachments.length > 0) {
    fixedAttachments = fixedAttachments.map((att) => {
      if (att.url && att.url.startsWith('blob:') && att.fileName) {
        const cleanName = att.fileName.replace(/^.*[\\/]/, '');
        return {
          ...att,
          url: UrlHelper.normalize(`uploads/attachments/${cleanName}`, BASE_SERVER_URL),
        };
      }
      return att;
    });
  }

  return {
    ...msg,
    attachments: fixedAttachments,
    isMyMessage: isMy,
    isSelected: Boolean(msg.isSelected),
    viewsCount: msg.viewsCount > 0 ? msg.viewsCount : 1,
    senderName: isMy
      ? (currentUserName && currentUserName !== 'Me' ? currentUserName : resolveSessionUser().name || 'Me')
      : (msg.senderName && msg.senderName !== 'User' ? msg.senderName : (targetChat?.isGroup ? `User ${msg.senderId}` : opponentName)),
    senderAvatar: isMy
      ? currentUserAvatar
      : (msg.senderAvatar || opponentAvatar),
  };
}

function resolveMessagePreview(
  msg: IMessage,
  _currentUserId: number,
  _isGroup: boolean,
  _isChannel: boolean
): [string, LastMessageType] {
  const text = (msg.text || '').trim();
  const attachments = msg.attachments || [];

  if (attachments.length > 0) {
    const first = attachments[0];
    const isGif =
      first.fileSizeStr === 'GIF' ||
      first.fileName?.toLowerCase().endsWith('.gif') ||
      Boolean(first.isSilentVideo);

    if (isGif) {
      return [text || 'GIF', LastMessageType.Gif];
    }
    if (first.type === AttachmentType.Photo) {
      return [text || 'Photo', LastMessageType.Photo];
    }
    if (first.type === AttachmentType.Video) {
      return [text || 'Video', LastMessageType.Video];
    }
    if (first.type === AttachmentType.Voice) {
      return [text || 'Voice message', LastMessageType.Voice];
    }
    if (first.type === AttachmentType.Audio) {
      return [text || 'Music', LastMessageType.Audio];
    }
    return [text || first.fileName || 'Document', LastMessageType.Document];
  }

  if (text) {
    return [text, LastMessageType.Text];
  }

  return ['', LastMessageType.None];
}

export const useChatStore = create<ChatState>((set, get) => ({
  selectedChatUser: null,
  currentChatMessages: [],
  pinnedMessages: [],
  chatSearchResults: [],
  forwardChatList: [],
  isChatSearching: false,
  isChatSearchMode: false,
  chatSearchText: '',
  isChatLoading: false,
  isHistoryLoading: false,
  isLoadingOlder: false,
  isScrolledToBottom: true,
  unreadCountInActiveChat: 0,

  currentUserName: resolveSessionUser().name,
  currentUserAvatar: resolveSessionUser().avatar,

  isPinDialogOpen: false,
  pinDialogTitle: '',
  pinDialogActionText: 'Pin',
  pinForAllText: 'Also apply for everyone',
  canPinForAll: true,
  messageToPin: null,

  openPinDialog: (msg: IMessage) => {
    if (!msg) return;
    const isUnpinning = msg.isPinned;
    const targetChat = get().selectedChatUser;
    const isGroup = Boolean(targetChat?.isGroup);
    const nickName = targetChat?.nickName || 'User';

    set({
      messageToPin: msg,
      isPinDialogOpen: true,
      pinDialogTitle: isUnpinning ? 'Do you want to unpin this message?' : 'Do you want to pin this message?',
      pinDialogActionText: isUnpinning ? 'Unpin' : 'Pin',
      pinForAllText: isGroup ? 'Also apply for everyone' : `Also apply for ${nickName}`,
      canPinForAll: true,
    });
  },

  cancelPin: () => {
    set({ isPinDialogOpen: false, messageToPin: null });
  },

  confirmPin: async (pinForAll: boolean) => {
    const { messageToPin, togglePinMessage } = get();
    set({ isPinDialogOpen: false, messageToPin: null });
    if (messageToPin) {
      await togglePinMessage(messageToPin, pinForAll);
    }
  },

  isForwardDialogOpen: false,
  messagesToForward: [],

  openForwardDialog: (messages: IMessage[]) => {
    if (!messages || messages.length === 0) return;

    const allChats = useSidebarChatsStore.getState().allChats || [];
    const currentUserId = Number(userSession.userId || 0);

    const sortedChats = allChats
      .filter((c) => !c.isChannel || (c.isChannel && c.adminId === currentUserId))
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return timeB - timeA;
      })
      .map((c) => ({
        chat: c,
        isSelected: false,
      }));

    set({
      messagesToForward: [...messages],
      forwardChatList: sortedChats,
      isForwardDialogOpen: true,
    });
  },

  cancelForward: () => {
    set({ isForwardDialogOpen: false, messagesToForward: [], forwardChatList: [] });
  },

  toggleSelectForwardChat: (uniqueKey: string) => {
    set((state) => ({
      forwardChatList: state.forwardChatList.map((item) => {
        const c = item.chat;
        const key = c.isSecretChat
          ? `s_${c.secretChatId || c.id}`
          : c.isGroup
          ? `g_${c.groupId || c.id}`
          : `u_${c.userId || c.id}`;

        return key === uniqueKey ? { ...item, isSelected: !item.isSelected } : item;
      }),
    }));
  },

  confirmForward: async () => {
    const { forwardChatList, messagesToForward, selectedChatUser, currentUserName, currentUserAvatar } = get();
    const selectedChats = forwardChatList.filter((c) => c.isSelected);
    set({ isForwardDialogOpen: false, messagesToForward: [], forwardChatList: [] });

    if (selectedChats.length === 0 || messagesToForward.length === 0) return;

    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );

    for (const target of selectedChats) {
      const isGroup = Boolean(target.chat.isGroup);
      const rId = isGroup ? null : Number(target.chat.userId || target.chat.id);
      const gId = isGroup ? Number(target.chat.groupId || target.chat.id) : null;

      const isCurrentActiveChat = Boolean(
        selectedChatUser &&
        ((isGroup && selectedChatUser.isGroup && Number(selectedChatUser.id) === gId) ||
         (!isGroup && !selectedChatUser.isGroup && Number(selectedChatUser.id) === rId))
      );

      for (const msg of messagesToForward) {
        const originalSender = msg.forwardedFromName || msg.senderName || 'User';
        const originalAvatar = msg.forwardedFromAvatar || msg.senderAvatar || null;
        const originalUserId = Number(msg.forwardedFromUserId || msg.senderId || 0);

        const localTempId = Date.now() + Math.floor(Math.random() * 100000);

        const clonedAttachments: IAttachment[] = (msg.attachments || []).map((a, idx) => ({
          ...a,
          id: idx + 1,
          messageId: 0,
        }));

        const optimisticMsg: IMessage = {
          id: localTempId,
          serverId: 0,
          senderId: currentUserId,
          senderName: currentUserName || 'Me',
          senderAvatar: currentUserAvatar,
          receiverId: rId,
          groupId: gId,
          text: msg.text || '',
          timestamp: new Date().toISOString(),
          isMyMessage: true,
          isSentToServer: false,
          isRead: false,
          isDeleted: false,
          isDeletedForMe: false,
          isPinned: false,
          viewsCount: 1,
          forwardedFromName: originalSender,
          forwardedFromAvatar: originalAvatar,
          forwardedFromUserId: originalUserId,
          attachments: clonedAttachments,
          repliedMessages: [],
        };

        if (isCurrentActiveChat) {
          set((state) => ({
            currentChatMessages: [...state.currentChatMessages, optimisticMsg],
          }));
        }

        chatService.saveMessageLocallyAsync(optimisticMsg).catch(() => {});

        const [fwdPreview, fwdType] = resolveMessagePreview(optimisticMsg, currentUserId, isGroup, false);

        useSidebarChatsStore.getState().updateSidebar(
          rId,
          gId,
          fwdPreview || 'Forwarded message',
          false,
          fwdType
        );

        (async () => {
          try {
            const attachmentDtos = clonedAttachments.map((a) => ({
              type: a.type,
              fileName: a.fileName,
              fileSizeStr: a.fileSizeStr,
              url: a.url,
              thumbnailUrl: a.thumbnailUrl === a.url ? null : a.thumbnailUrl,
              fileHash: a.fileHash,
              hasAudio: Boolean(a.hasAudio),
              width: a.width || 0,
              height: a.height || 0,
              durationSeconds: a.durationSeconds || 0,
              waveform: a.waveform || '',
            }));

            const realId = await signalRService.sendMessageAsync(
              rId,
              gId,
              null,
              msg.text || '',
              null,
              originalSender,
              originalAvatar,
              originalUserId,
              attachmentDtos.length > 0 ? (attachmentDtos as any) : null
            );

        if (realId && realId > 0) {
              set((state) => ({
                currentChatMessages: state.currentChatMessages.map((m) =>
                  m.id === localTempId ? { ...m, serverId: realId, isSentToServer: true } : m
                ),
              }));
              void chatService.markAsSentAsync(localTempId, realId, clonedAttachments as any, msg.text || '');
            }
          } catch (err) {
            console.error('[ChatStore ERROR] Ошибка при фоновой пересылке:', err);
          }
        })();
      }
    }

    get().clearSelection();
  },

  isConfirmDialogOpen: false,
  confirmDialogTitle: '',
  confirmDialogMessage: '',
  confirmDialogCheckboxText: null,
  confirmDialogButtonText: 'Delete',
  messagesPendingDeletion: [],

  openDeleteDialog: (msg: IMessage) => get().openDeleteMessagesDialog([msg]),

  openDeleteSelectedDialog: () => get().openDeleteMessagesDialog(get().currentChatMessages.filter(message => message.isSelected)),

  openDeleteMessagesDialog: (messages: IMessage[]) => {
    const targets = Array.from(new Map(messages.map(message => [message.serverId > 0 ? `s_${message.serverId}` : `l_${message.id}`, message])).values());
    if (!targets.length) return;
    const selected = get().selectedChatUser;
    const ownId = Number(userSession.userId || 0);
    const hasOwn = targets.some(message => Number(message.senderId) === ownId);
    set({ messagesPendingDeletion: targets, isConfirmDialogOpen: true,
      confirmDialogTitle: selected?.nickName || 'Delete Messages',
      confirmDialogMessage: targets.length === 1 ? 'Do you want to delete this message?' : `Do you want to delete ${targets.length} message(s)?`,
      confirmDialogCheckboxText: hasOwn ? selected?.isGroup ? 'Delete for everyone' : `Also delete for ${selected?.nickName || 'User'}` : null,
      confirmDialogButtonText: 'Delete',
    });
  },

  closeConfirmDialog: () => {
    set({
      isConfirmDialogOpen: false,
      messagesPendingDeletion: [],
      confirmDialogCheckboxText: null,
    });
  },

  confirmDelete: async (deleteForAll: boolean) => {
    const { messagesPendingDeletion, selectedChatUser } = get();
    if (messagesPendingDeletion.length === 0) return;

    const targets = [...messagesPendingDeletion];
    set({
      isConfirmDialogOpen: false,
      messagesPendingDeletion: [],
      confirmDialogCheckboxText: null,
    });

    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );

    const currentReplies = useMessageInputStore.getState().replyingToMessages || [];
    if (currentReplies.length > 0) {
      const remainingReplies = currentReplies.filter((rep) => {
        const rId = Number(rep.id || 0);
        const rServerId = Number(rep.serverId || 0);
        return !targets.some((t) =>
          (t.id && rId > 0 && t.id === rId) ||
          (t.serverId && rServerId > 0 && t.serverId === rServerId)
        );
      });
      if (remainingReplies.length !== currentReplies.length) {
        useMessageInputStore.setState({ replyingToMessages: remainingReplies });
      }
    }

    const currentEdit = useMessageInputStore.getState().editingMessage;
    if (currentEdit) {
      const eId = Number(currentEdit.id || 0);
      const eServerId = Number(currentEdit.serverId || 0);
      const isEditDeleted = targets.some((t) =>
        (t.id && eId > 0 && t.id === eId) ||
        (t.serverId && eServerId > 0 && t.serverId === eServerId)
      );
      if (isEditDeleted) {
        useMessageInputStore.getState().cancelEdit();
      }
    }

    set((state) => {
      let updated = [...state.currentChatMessages];

      for (const msg of targets) {
        const isMy = msg.isMyMessage || Number(msg.senderId) === currentUserId;

        if ((isMy && deleteForAll) || !isMy || (Boolean(msg.forwardedFromName) && !deleteForAll)) {
          updated = updated.filter(
            (m) =>
              !(
                (msg.id && m.id === msg.id) ||
                (msg.serverId && msg.serverId > 0 && m.serverId === msg.serverId)
              )
          );
        } else if (isMy && !deleteForAll) {
          updated = updated.map((m) => {
            const isMatch =
              (msg.id && m.id === msg.id) ||
              (msg.serverId && msg.serverId > 0 && m.serverId === msg.serverId);

            if (isMatch) {
              return {
                ...m,
                attachments: [],
                text: 'This message was deleted',
                editedAt: undefined,
                isDeletedForMe: true,
                isSelected: false,
              };
            }
            return m;
          });
        }
      }

      updated = updated.map((m) => {
        if (m.repliedMessages && m.repliedMessages.length > 0) {
          const remaining = m.repliedMessages.filter((rep: any) => {
            const rId = Number(rep.id || 0);
            const rServerId = Number(rep.serverId || 0);
            return !targets.some((t) =>
              (t.id && rId > 0 && t.id === rId) ||
              (t.serverId && rServerId > 0 && t.serverId === rServerId)
            );
          });
          if (remaining.length !== m.repliedMessages.length) {
            return { ...m, repliedMessages: remaining };
          }
        }
        return m;
      });

      const updatedPins = state.pinnedMessages.filter(
        (p) =>
          !targets.some(
            (t) =>
              (t.id && p.id === t.id) ||
              (t.serverId && t.serverId > 0 && p.serverId === t.serverId)
          )
      );

      const updatedSearch = state.chatSearchResults.filter(
        (s) =>
          !targets.some(
            (t) =>
              (t.id && s.id === t.id) ||
              (t.serverId && t.serverId > 0 && s.serverId === t.serverId)
          )
      );

      return {
        currentChatMessages: updated.map((m) => ({ ...m, isSelected: false })),
        pinnedMessages: updatedPins,
        chatSearchResults: updatedSearch,
        isSelectionMode: false,
        selectedCount: 0,
      };
    });

    try {
      for (const msg of targets) {
        const serverMsgId = msg.serverId > 0 ? msg.serverId : msg.id;
        await chatService.deleteMessageLocallyAsync(msg.id, msg.serverId, currentUserId, deleteForAll);
        eventBus.emit('MessageDeletedMessage' as any, { serverId: serverMsgId, isForAll: deleteForAll });
      }
    } catch (err) {
      console.error('[ChatStore ERROR] Ошибка при локальном удалении сообщений:', err);
    }

    (async () => {
      for (const msg of targets) {
        const isMy = msg.isMyMessage || Number(msg.senderId) === currentUserId;
        if (msg.serverId > 0 && (isMy || !deleteForAll)) {
          try {
            await signalRService.deleteMessageAsync(msg.serverId, deleteForAll);
          } catch (err) {
            console.error(`[ChatStore ERROR] Ошибка SignalR удаления сообщения ${msg.serverId}:`, err);
          }
        }
      }
    })();

    const lastTarget = targets[targets.length - 1];
    if (lastTarget || selectedChatUser) {
      const sidebarUserId =
        selectedChatUser && !selectedChatUser.isGroup
          ? selectedChatUser.id
          : lastTarget?.senderId === currentUserId
          ? lastTarget?.receiverId
          : lastTarget?.senderId;

      const sidebarGroupId =
        selectedChatUser && selectedChatUser.isGroup ? selectedChatUser.id : lastTarget?.groupId;

      eventBus.emit('SidebarUpdateAfterDeletionMessage' as any, {
        userId: sidebarUserId,
        groupId: sidebarGroupId,
      });
    }
  },

  isCurrentChatJoined: true,
  isBlockedByMe: false,
  isBlockedByThem: false,
  canSendText: true,
  canSendMedia: true,
  canPinMessages: true,
  canWriteMessages: true,

  isSelectionMode: false,
  selectedCount: 0,

  toggleSelectMessage: (msg: IMessage) => {
    if (!msg) return;
    const targetId = Number(msg.id || 0);
    const targetServerId = Number(msg.serverId || 0);

    set((state) => {
      const msgs = state.currentChatMessages.map((m) => {
        const mId = Number(m.id || 0);
        const mServerId = Number(m.serverId || 0);
        const isMatch =
          (targetId > 0 && mId === targetId) ||
          (targetServerId > 0 && mServerId === targetServerId) ||
          (targetServerId > 0 && mId === targetServerId) ||
          (targetId > 0 && mServerId === targetId);

        return isMatch ? { ...m, isSelected: !m.isSelected } : m;
      });

      const selectedCount = msgs.filter((m) => m.isSelected).length;
      return {
        currentChatMessages: msgs,
        isSelectionMode: selectedCount > 0,
        selectedCount,
      };
    });
  },

  toggleRowSelection: (msg: IMessage) => {
    if (get().isSelectionMode) {
      get().toggleSelectMessage(msg);
    }
  },

  clearSelection: () => {
    set((state) => ({
      currentChatMessages: state.currentChatMessages.map((m) => ({ ...m, isSelected: false })),
      isSelectionMode: false,
      selectedCount: 0,
    }));
  },

  replySelected: () => {
    const { currentChatMessages, currentUserName, selectedChatUser, clearSelection } = get();
    const selected = currentChatMessages.filter((m) => m.isSelected);
    if (selected.length === 0) return;

    for (const msg of selected) {
      let authorName: string;
      if (msg.isMyMessage) {
        authorName = currentUserName || 'Me';
      } else if (selectedChatUser && !selectedChatUser.isGroup) {
        authorName = selectedChatUser.nickName || 'User';
      } else {
        authorName = msg.senderName && msg.senderName !== 'User' ? msg.senderName : currentUserName || 'Me';
      }

      useMessageInputStore.getState().addReplyMessage({
        ...msg,
        senderName: authorName,
        text: getMessageReplyText(msg),
      });
    }

    clearSelection();
    eventBus.emit('FocusMessageInputMessage' as any, undefined);
  },

  forwardSelected: () => {
    const selected = get().currentChatMessages.filter((m) => m.isSelected);
    if (selected.length === 0) return;
    get().openForwardDialog(selected);
  },

  deleteSelected: () => {
    get().openDeleteSelectedDialog();
  },

  ensureMyProfileLoadedAsync: async () => {
    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );
    if (currentUserId <= 0) return;

    const { name: localName, avatar: localAvatar } = resolveSessionUser();
    if (localName && localName !== 'Me') {
      set((state) => ({
        currentUserName: localName,
        currentUserAvatar: localAvatar,
        currentChatMessages: state.currentChatMessages.map((m) =>
          m.isMyMessage ? { ...m, senderName: localName, senderAvatar: localAvatar || m.senderAvatar } : m
        ),
        pinnedMessages: state.pinnedMessages.map((p) =>
          p.isMyMessage ? { ...p, senderName: localName, senderAvatar: localAvatar || p.senderAvatar } : p
        ),
      }));
    }

    try {
      const res = await apiClient
        .get<any>(`api/Users/${currentUserId}`)
        .catch(() => apiClient.get<any>(`api/User/${currentUserId}`));
      if (res && res.data) {
        const u = res.data;
        const freshName = u.nickName || u.username || localName || 'User';
        const freshAvatar = u.avatarPath || u.avatar || localAvatar;
        set((state) => ({
          currentUserName: freshName,
          currentUserAvatar: freshAvatar,
          currentChatMessages: state.currentChatMessages.map((m) =>
            m.isMyMessage ? { ...m, senderName: freshName, senderAvatar: freshAvatar || m.senderAvatar } : m
          ),
          pinnedMessages: state.pinnedMessages.map((p) =>
            p.isMyMessage ? { ...p, senderName: freshName, senderAvatar: freshAvatar || p.senderAvatar } : p
          ),
        }));
      }
    } catch (e) {
      console.warn('[ChatStore] Ошибка фоновой загрузки профиля:', e);
    }
  },

  syncPermissionsWithInput: () => {
    const s = get();
    useMessageInputStore.getState().syncChatPermissions({
      isGroup: Boolean(s.selectedChatUser?.isGroup),
      isChannel: Boolean(s.selectedChatUser?.isChannel),
      isAdmin: Boolean(
        s.selectedChatUser &&
          (s.selectedChatUser.adminId === userSession.userId ||
            (s.selectedChatUser as any).adminId === userSession.userId)
      ),
      isCurrentChatJoined: s.isCurrentChatJoined,
      isBlockedByMe: s.isBlockedByMe,
      isBlockedByThem: s.isBlockedByThem,
      canSendText: s.canSendText,
      canSendMedia: s.canSendMedia,
      canWriteMessages: s.canWriteMessages,
    });
  },

  triggerDeltaSync: async () => {
    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );
    if (currentUserId <= 0) return;

    try {
      const count = await chatService.syncDeltaAsync(currentUserId);
      const sentCount = await chatService.syncUnsentMessagesAsync(signalRService);
      if (Number(userSession.userId) !== currentUserId) return;
      if (count > 0 || sentCount > 0) {
        const { selectedChatUser, currentChatMessages, currentUserName, currentUserAvatar } = get();
        if (selectedChatUser) {
          const targetUserId = selectedChatUser.isGroup ? null : selectedChatUser.id;
          const groupId = selectedChatUser.isGroup ? selectedChatUser.id : null;
          const secretChatId = selectedChatUser.isSecretChat ? selectedChatUser.secretChatId : null;

          const takeCount = Math.max(30, currentChatMessages.length);
          const updated = await chatService.getLocalMessagesAsync(
            currentUserId,
            targetUserId,
            groupId,
            secretChatId,
            takeCount
          );

          if (getChatKey(get().selectedChatUser) === getChatKey(selectedChatUser)) {
            // 🟢 Обогащаем имена авторов при Delta-синхронизации
            if (selectedChatUser.isGroup && updated.length > 0) {
              await userService.enrichMessagesWithSendersAsync(updated, currentUserId);
            }
            await userService.enrichForwardedMessagesAsync(updated, currentUserId);

            const enriched = updated.map((m) =>
              enrichMessage(m, currentUserId, currentUserName, currentUserAvatar, selectedChatUser)
            );
            set({ currentChatMessages: enriched });
          }
        }
      }
    } catch (e) {
      console.warn('[ChatStore] Ошибка фонового Delta Sync:', e);
    }
  },

  startSecretChat: async () => {
    const { selectedChatUser } = get();
    if (!selectedChatUser || selectedChatUser.isGroup) return;

    const targetUserId = Number(selectedChatUser.id);
    const targetName = selectedChatUser.nickName;
    const targetAvatar = selectedChatUser.avatarPath || (selectedChatUser as any).avatar || null;

    console.info(`🔐 [SECRET] Создание нового секретного чата с UserId=${targetUserId}`);

    await chatService.removeCachedSecretChatByTargetUserAsync(targetUserId);

    const { secretChatId, publicKeyBase64, privateKeyBase64 } =
      await secretChatCrypto.createOutgoingHandshake(targetUserId);

    const cachedChat = {
      secretChatId,
      targetUserId,
      targetName,
      targetAvatar,
      localPrivateKeyBase64: privateKeyBase64,
      isEstablished: false,
      lastMessage: '🔒 Ожидание подключения собеседника...',
      lastMessageTime: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await chatService.saveCachedSecretChatAsync(cachedChat as any);
    await signalRService.requestSecretChatAsync(targetUserId, secretChatId, publicKeyBase64);

    const secretChatListItem: IChatListItem = {
      id: targetUserId,
      userId: targetUserId,
      groupId: null,
      nickName: targetName,
      groupName: '',
      avatarPath: targetAvatar,
      isGroup: false,
      isChannel: false,
      isSecretChat: true,
      secretChatId,
      keyFingerprint: '',
      lastMessage: '🔒 Ожидание подключения собеседника...',
      lastMessageType: LastMessageType.None,
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
      isBlocked: false,
      isOnline: false,
      isTyping: false,
      adminId: 0,
      memberCount: 0,
      onlineCount: 0,
      lastSeen: new Date().toISOString(),
      groupDescription: '',
      isPublic: false,
      groupLink: '',
      folderIds: [],
      isLastAttachmentGif: false,
      isLastMessageDeletedForMe: false,
    };

    eventBus.emit('SecretChatCreatedMessage' as any, { secretChat: secretChatListItem });

    const newTarget: IUserSearchResult = {
      id: targetUserId,
      nickName: targetName,
      avatarPath: targetAvatar,
      isSecretChat: true,
      secretChatId,
      keyFingerprint: undefined,
      memberCount: 0, onlineCount: 0, isTyping: false, isChannel: false, adminId: 0,
      isGroup: false,
      isOnline: Boolean(selectedChatUser.isOnline),
      lastSeen: selectedChatUser.lastSeen,
    };

    set({
      selectedChatUser: newTarget,
      currentChatMessages: [],
      pinnedMessages: [],
    });

    useSidebarChatsStore.setState({
      selectedChatUser: newTarget,
      currentSidebarChat: secretChatListItem,
    });
  },

  selectChatUser: async (target) => {
    if (!target) {
      if (currentChatLoadAbortController) {
        currentChatLoadAbortController.abort();
        currentChatLoadAbortController = null;
      }
      lastLoadedChatKey = null;
      if (deltaSyncInterval) {
        clearInterval(deltaSyncInterval);
        deltaSyncInterval = null;
      }
      set({
        selectedChatUser: null,
        currentChatMessages: [],
        pinnedMessages: [],
        canWriteMessages: false,
        isHistoryLoading: false,
        isSelectionMode: false,
        selectedCount: 0,
      });
      useMessageInputStore.getState().cancelReply();
      useMessageInputStore.getState().cancelEdit();
      get().syncPermissionsWithInput();
      return;
    }

    const newChatKey = getChatKey(target);
    if (lastLoadedChatKey === newChatKey && !get().isChatSearchMode) {
      eventBus.emit('FocusMessageInputMessage' as any, undefined);
      return;
    }
    lastLoadedChatKey = newChatKey;

    if (currentChatLoadAbortController) {
      currentChatLoadAbortController.abort();
      currentChatLoadAbortController = null;
    }
    const abortController = new AbortController();
    currentChatLoadAbortController = abortController;
    const thisLoadSequence = ++currentChatLoadSequence;

    if (get().isChatSearchMode) {
      get().exitSearch();
    }

    alreadyTrackedPostIds.clear();

    const targetUserId = target.isGroup ? null : Number(target.id ?? (target as any).userId ?? 0);
    const groupId = target.isGroup ? Number(target.id ?? (target as any).groupId ?? 0) : null;
    const targetId = target.isGroup ? (groupId ?? 0) : (targetUserId ?? 0);

    const existingSidebarChat = useSidebarChatsStore
      .getState()
      .allChats.find((c) => (target.isGroup ? c.groupId === targetId : Number(c.userId || c.id) === targetId));

    const isOnlineInitial = existingSidebarChat ? existingSidebarChat.isOnline : Boolean(target.isOnline);
    const lastSeenInitial = existingSidebarChat
      ? existingSidebarChat.lastSeen
      : target.lastSeen || new Date().toISOString();

    const normalizedTarget: IUserSearchResult = {
      ...target,
      id: targetId,
      isGroup: Boolean(target.isGroup),
      isOnline: !target.isGroup ? userPresenceState.get(Number(target.id))?.isOnline ?? isOnlineInitial : isOnlineInitial,
      lastSeen: !target.isGroup ? userPresenceState.get(Number(target.id))?.lastSeen ?? lastSeenInitial : lastSeenInitial,
    };

    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );

    const isJoined = !normalizedTarget.isGroup || true;
    const canWrite = computeCanWriteMessages(normalizedTarget, false, false, isJoined, true, currentUserId);

    set({
      selectedChatUser: normalizedTarget,
      isHistoryLoading: true,
      isLoadingOlder: false,
      currentChatMessages: [],
      pinnedMessages: [],
      isSelectionMode: false,
      selectedCount: 0,
      isBlockedByMe: false,
      isBlockedByThem: false,
      canSendText: true,
      canSendMedia: true,
      canPinMessages: true,
      isCurrentChatJoined: isJoined,
      canWriteMessages: canWrite,
    });
    useMessageInputStore.getState().cancelReply();
    useMessageInputStore.getState().cancelEdit();
    get().syncPermissionsWithInput();

    void get().ensureMyProfileLoadedAsync();

    const secretChatId = normalizedTarget.isSecretChat ? normalizedTarget.secretChatId : null;

    try {
      if (secretChatId) {
        const cachedSecret = await chatService.getCachedSecretChatAsync(secretChatId);
        if (cachedSecret && cachedSecret.isEstablished) {
          if (cachedSecret.keyFingerprint) {
            normalizedTarget.keyFingerprint = cachedSecret.keyFingerprint;
          }
          if (cachedSecret.sharedKey) {
            secretChatCrypto.restoreSessionFromProtectedState(
              secretChatId,
              typeof cachedSecret.sharedKey === 'string' ? cachedSecret.sharedKey : ''
            );
          }
        }
      }

      const [cached, pinned] = await Promise.all([
        chatService.getLocalMessagesAsync(currentUserId, targetUserId, groupId, secretChatId, 30),
        chatService.getLocalPinnedMessagesAsync(currentUserId, targetUserId, groupId, secretChatId),
      ]);

      if (abortController.signal.aborted || thisLoadSequence !== currentChatLoadSequence) return;
      if (getChatKey(get().selectedChatUser) !== newChatKey) return;

      // 🟢 1. Гарантированно подписываем активный чат-группу в SignalR
      if (normalizedTarget.isGroup && targetId > 0) {
        void signalRService.subscribeToGroupAsync(targetId);
      }

      // 🟢 2. Обогащаем сообщения групп реальными авторами (как в C# UserService)
      if (normalizedTarget.isGroup) {
        if (cached && cached.length > 0) {
          await userService.enrichMessagesWithSendersAsync(cached, currentUserId);
        }
        if (pinned && pinned.length > 0) {
          await userService.enrichMessagesWithSendersAsync(pinned, currentUserId);
        }
      }
      if (cached && cached.length > 0) {
        await userService.enrichForwardedMessagesAsync(cached, currentUserId);
      }

      const { currentUserName, currentUserAvatar } = get();
      const resolvedName = currentUserName && currentUserName !== 'Me' ? currentUserName : resolveSessionUser().name || 'Me';
      const resolvedAvatar = currentUserAvatar || resolveSessionUser().avatar;

      const enrichedCached = (cached || []).map((m) =>
        enrichMessage(m, currentUserId, resolvedName, resolvedAvatar, normalizedTarget)
      );
      const enrichedPinned = (pinned || []).map((p) =>
        enrichMessage(p, currentUserId, resolvedName, resolvedAvatar, normalizedTarget)
      );

      set({
        selectedChatUser: normalizedTarget,
        currentChatMessages: enrichedCached,
        pinnedMessages: enrichedPinned,
        isHistoryLoading: false,
      });

      void get().markAsRead();
      void get().triggerDeltaSync();

      if (deltaSyncInterval) clearInterval(deltaSyncInterval);
      deltaSyncInterval = setInterval(() => {
        void get().triggerDeltaSync();
        void useSidebarChatsStore.getState().syncOnlineStatuses();
      }, 3500);

      if (!normalizedTarget.isGroup && targetUserId && !normalizedTarget.isSecretChat) {
        chatService.getCachedBlockStatusAsync(targetUserId).then((cachedBlock) => {
          if (cachedBlock && Number(get().selectedChatUser?.id) === targetUserId) {
            const byMe = Boolean(cachedBlock.blockedByMe);
            const byThem = Boolean(cachedBlock.blockedByThem);

            set({
              isBlockedByMe: byMe,
              isBlockedByThem: byThem,
              canWriteMessages: computeCanWriteMessages(
                get().selectedChatUser,
                byMe,
                byThem,
                get().isCurrentChatJoined,
                get().canSendText,
                currentUserId
              ),
            });
            get().syncPermissionsWithInput();
          }
        }).catch(() => {});

        (async () => {
          try {
            let blockStatus: any = null;
            if ((userService as any)?.getBlockStatusAsync) {
              blockStatus = await (userService as any).getBlockStatusAsync(targetUserId);
            } else {
              const res = await apiClient.get<any>(`api/Users/block-status/${targetUserId}`);
              blockStatus = res.data;
            }

            if (blockStatus && Number(get().selectedChatUser?.id) === targetUserId) {
              const byMe = Boolean(blockStatus.blockedByMe ?? blockStatus.BlockedByMe);
              const byThem = Boolean(blockStatus.blockedByThem ?? blockStatus.BlockedByThem);

              set({
                isBlockedByMe: byMe,
                isBlockedByThem: byThem,
                canWriteMessages: computeCanWriteMessages(
                  get().selectedChatUser,
                  byMe,
                  byThem,
                  get().isCurrentChatJoined,
                  get().canSendText,
                  currentUserId
                ),
              });
              get().syncPermissionsWithInput();
              await chatService.saveCachedBlockStatusAsync(targetUserId, byMe, byThem);
            }
          } catch (e) {
            console.warn('[ChatStore] Ошибка верификации статуса блокировки:', e);
          }
        })();

        const presenceTicket = userPresenceState.capture();
        apiClient
          .get<any>(`api/Users/${targetUserId}`)
          .catch(() => apiClient.get<any>(`api/User/${targetUserId}`))
          .then((res) => {
            if (abortController.signal.aborted || thisLoadSequence !== currentChatLoadSequence) return;
            if (res && res.data) {
              const fresh = res.data;
              const status=parsePresence(fresh);
              if(status)useSidebarChatsStore.getState().applyPresence(targetUserId!,status,presenceTicket);
              const curr=get().selectedChatUser;
              if(curr && !curr.isGroup && Number(curr.id)===Number(targetUserId))set({selectedChatUser:{...curr,avatar:fresh.avatar||curr.avatar,avatarPath:fresh.avatarPath||curr.avatarPath}});

            }
          })
          .catch(() => {});
      }

      chatService.syncUnsentMessagesAsync(signalRService).then((sent) => {
        if (sent > 0 && !abortController.signal.aborted && thisLoadSequence === currentChatLoadSequence) {
          chatService
            .getLocalMessagesAsync(currentUserId, targetUserId, groupId, secretChatId, 30)
            .then(async (updated) => {
              if (!abortController.signal.aborted && thisLoadSequence === currentChatLoadSequence) {
                if (normalizedTarget.isGroup && updated) {
                  await userService.enrichMessagesWithSendersAsync(updated, currentUserId);
                }
                const refreshed = (updated || []).map((m) =>
                  enrichMessage(m, currentUserId, resolvedName, resolvedAvatar, normalizedTarget)
                );
                set({ currentChatMessages: refreshed });
              }
            });
        }
      });
    } catch (e) {
      if (abortController.signal.aborted || thisLoadSequence !== currentChatLoadSequence) return;
      console.error('[ChatStore ERROR] Ошибка загрузки чата:', e);
      set({ isHistoryLoading: false });
    }
  },

  sendTyping: (text?: string) => {
    const { selectedChatUser } = get();
    if (!selectedChatUser || selectedChatUser.isSecretChat) return;
    if (text !== undefined && text.trim().length === 0) return;

    if (!typingDebounceTimer) {
      const rId = selectedChatUser.isGroup
        ? null
        : Number(selectedChatUser.id ?? (selectedChatUser as any).userId ?? 0);
      const gId = selectedChatUser.isGroup
        ? Number(selectedChatUser.id ?? (selectedChatUser as any).groupId ?? 0)
        : null;

      if ((rId && rId > 0) || (gId && gId > 0)) {
        signalRService.sendTypingAsync(rId, gId).catch((err) => {
          console.warn('[ChatStore] Ошибка отправки typing:', err);
        });
      }

      typingDebounceTimer = setTimeout(() => {
        typingDebounceTimer = null;
      }, 2000);
    }
  },

  loadOlderMessages: async () => {
    const { selectedChatUser, currentChatMessages, isHistoryLoading, isLoadingOlder, currentUserName, currentUserAvatar } = get();
    if (!selectedChatUser || currentChatMessages.length === 0 || isHistoryLoading || isLoadingOlder) return;

    set({ isLoadingOlder: true });
    const oldestTime = currentChatMessages[0].timestamp;
    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );

    const activeKeyBefore = getChatKey(selectedChatUser);

    try {
      const older = await chatService.getLocalMessagesAsync(
        currentUserId,
        selectedChatUser.isGroup ? null : selectedChatUser.id,
        selectedChatUser.isGroup ? selectedChatUser.id : null,
        selectedChatUser.isSecretChat ? selectedChatUser.secretChatId : null,
        30,
        oldestTime,
        currentChatMessages[0].serverId || 0
      );

      if (older && older.length > 0 && getChatKey(get().selectedChatUser) === activeKeyBefore) {
        if (selectedChatUser.isGroup) {
          await userService.enrichMessagesWithSendersAsync(older, currentUserId);
        }
        await userService.enrichForwardedMessagesAsync(older, currentUserId);

        const resolvedName = currentUserName && currentUserName !== 'Me' ? currentUserName : resolveSessionUser().name || 'Me';
        const resolvedAvatar = currentUserAvatar || resolveSessionUser().avatar;
        const enriched = older.map((m) =>
          enrichMessage(m, currentUserId, resolvedName, resolvedAvatar, selectedChatUser)
        );
        const unique = new Map<string, IMessage>();
        for (const message of [...get().currentChatMessages, ...enriched]) unique.set(message.serverId > 0 ? `s_${message.serverId}` : `l_${message.id}`, message);
        set({currentChatMessages: Array.from(unique.values()).sort((a,b) => new Date(a.timestamp).getTime()-new Date(b.timestamp).getTime() || a.serverId-b.serverId)});
      }
    } catch (err) {
      console.error('[ChatStore ERROR] Ошибка подгрузки старых сообщений:', err);
    } finally {
      set({ isLoadingOlder: false });
    }
  },

  ensureMessageLoadedAsync: async (messageId: number, source?: IMessage) => {
    if (messageId <= 0 || !get().selectedChatUser) return null;
    const key = getChatKey(get().selectedChatUser);
    if (get().isHistoryLoading) await new Promise<void>(resolve => {
      const unsubscribe = useChatStore.subscribe(state => {
        if (!state.isHistoryLoading || getChatKey(state.selectedChatUser) !== key) { unsubscribe(); resolve(); }
      });
    });
    if (getChatKey(get().selectedChatUser) !== key) return null;
    const matches = (message: IMessage) => source?.serverId && source.serverId > 0 ? Number(message.serverId) === Number(source.serverId) : Number(message.serverId) === messageId || Number(message.id) === messageId;
    const existing = get().currentChatMessages.find(matches);
    if (existing) return existing;
    try {
      const selected = get().selectedChatUser!;
      const local = source || await chatService.getLocalMessageByIdAsync(messageId);
      const serverId = local?.serverId && local.serverId > 0 ? local.serverId : messageId;
      const ownId = Number(userSession.userId || 0);
      let context = await chatService.getMessageContextAsync(serverId);
      if (getChatKey(get().selectedChatUser) !== key) return null;
      context = context.filter(message => !message.isDeleted && !message.isDeletedForMe && (selected.isGroup ? message.groupId === selected.id : !message.groupId &&
        ((message.senderId === ownId && message.receiverId === selected.id) || (message.senderId === selected.id && message.receiverId === ownId))));
      if (!context.some(matches)) return null;
      if (selected.isGroup) await userService.enrichMessagesWithSendersAsync(context, ownId);
      await userService.enrichForwardedMessagesAsync(context, ownId);
      if (getChatKey(get().selectedChatUser) !== key) return null;
      const name = get().currentUserName || resolveSessionUser().name || 'User';
      const avatar = get().currentUserAvatar || resolveSessionUser().avatar;
      const enriched = context.map(message => enrichMessage(message, ownId, name, avatar, selected));
      set(state => {
        const unique = new Map<string, IMessage>();
        for (const message of [...state.currentChatMessages, ...enriched]) {
          const identity = message.serverId > 0 ? `s_${message.serverId}` : `l_${message.id}`;
          if (!unique.has(identity)) unique.set(identity, message);
        }
        return {currentChatMessages: Array.from(unique.values()).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime() || a.serverId-b.serverId)};
      });
      return get().currentChatMessages.find(matches) || null;
    } catch (error) { console.error('[ChatStore] Cannot load message context:', error); return null; }
  },

  sendMessage: async (text, attachments, editingMessage, replies) => {
    if (isMessageTextTooLong(text)) return;
    const { selectedChatUser, currentUserName, currentUserAvatar } = get();
    if (!selectedChatUser) return;

    if (editingMessage) {
      await get().editMessage(editingMessage.id, editingMessage.serverId, text);
      return;
    }

    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );
    const localTempId = Date.now() + Math.floor(Math.random() * 100000);

    if (typingDebounceTimer) {
      clearTimeout(typingDebounceTimer);
      typingDebounceTimer = null;
    }

    if (selectedChatUser.isSecretChat && selectedChatUser.secretChatId) {
      try {
        const secretChatId = selectedChatUser.secretChatId;
        let session = secretChatCrypto.getSession(secretChatId);

        if (!session || !session.isEstablished) {
          const cachedChat = await chatService.getCachedSecretChatAsync(secretChatId);
          if (cachedChat?.sharedKey) {
            secretChatCrypto.restoreSessionFromProtectedState(
              secretChatId,
              typeof cachedChat.sharedKey === 'string' ? cachedChat.sharedKey : ''
            );
            session = secretChatCrypto.getSession(secretChatId);
          }
        }

        let replyTextForPayload: string | null = null;
        let replySenderForPayload: string | null = null;

        if (replies.length > 0) {
          const firstReply = replies[0];
          replyTextForPayload = firstReply.text;
          replySenderForPayload = firstReply.senderName || 'User';
        }

        const secretMessage: IMessage = {
          id: localTempId,
          serverId: 0,
          senderId: currentUserId,
          receiverId: Number(selectedChatUser.id),
          secretChatId,
          senderName: currentUserName,
          senderAvatar: currentUserAvatar,
          text: text || '',
          timestamp: new Date().toISOString(),
          isMyMessage: true,
          isSentToServer: true,
          isRead: false,
          isDeleted: false,
          isDeletedForMe: false,
          isPinned: false,
          viewsCount: 1,
          attachments: attachments || [],
          replyToMessageIds: replyTextForPayload ? `sec::${replySenderForPayload}::${replyTextForPayload}` : null,
          repliedMessages: replies.map((r) => ({ ...r, text: getMessageReplyText(r) })),
        };

        set((state) => ({ currentChatMessages: [...state.currentChatMessages, secretMessage] }));
        await chatService.saveMessageLocallyAsync(secretMessage);

        const secretAttachmentDtos = (attachments || []).map((a) => ({
          type: a.type,
          fileName: a.fileName,
          fileSizeStr: a.fileSizeStr,
          url: a.url,
          thumbnailUrl: a.thumbnailUrl || a.url,
          fileHash: a.fileHash,
          hasAudio: Boolean(a.hasAudio),
          width: a.width || 0,
          height: a.height || 0,
          durationSeconds: a.durationSeconds || 0,
        }));

        const payloadDto = {
          text: text || '',
          replyText: replyTextForPayload,
          replySender: replySenderForPayload,
          attachments: secretAttachmentDtos.length > 0 ? secretAttachmentDtos : null,
        };

        const payloadJson = JSON.stringify(payloadDto);

        const { ciphertextBase64, nonceBase64, tagBase64, sequenceNumber, updatedProtectedState } =
          await secretChatCrypto.encryptText(secretChatId, payloadJson);

        const cached = await chatService.getCachedSecretChatAsync(secretChatId);
        const [secretPreviewText, secretMessageType] = MessagePreviewHelper.formatPreviewFromMessage(
          secretMessage,
          currentUserId,
          false,
          false
        );

        if (cached) {
          cached.sharedKey = updatedProtectedState;
          cached.lastMessage = secretPreviewText;
          cached.lastMessageTime = new Date().toISOString();
          await chatService.saveCachedSecretChatAsync(cached);
        }

        useSidebarChatsStore.getState().updateSidebar(
          Number(selectedChatUser.id),
          null,
          secretPreviewText,
          false,
          secretMessageType,
          secretChatId
        );

        (async () => {
          try {
            await signalRService.sendSecretMessageAsync(
              Number(selectedChatUser.id),
              secretChatId,
              ciphertextBase64,
              nonceBase64,
              tagBase64,
              sequenceNumber
            );
          } catch (ex) {
            console.error('❌ [SECRET ERROR] Ошибка отправки секретного сообщения:', ex);
          }
        })();
      } catch (ex) {
        console.error('❌ [SECRET ERROR] Критический сбой при отправке сообщения в секретный чат:', ex);
      }
      return;
    }

    (attachments || []).forEach((att) => {
      const isGif = att.fileSizeStr === 'GIF' || att.fileName?.toLowerCase().endsWith('.gif');
      const validUrl = att.url && !att.url.startsWith('blob:') ? att.url : '';
      if (isGif && validUrl) {
        const savedItem = {
          serverId: 0,
          url: validUrl,
          thumbnailUrl: att.thumbnailUrl && !att.thumbnailUrl.startsWith('blob:') ? att.thumbnailUrl : validUrl,
          width: att.width || 320,
          height: att.height || 240,
          savedAt: new Date().toISOString(),
        };
        void gifService.saveGifAsync(savedItem);
        useEmojiStore.getState().addSavedGifLocally(savedItem);
      }
    });

    const initialAttachments: IAttachment[] = (attachments || []).map((a) => {
      const cached = mediaDimensionsCache.get(a.url) || mediaDimensionsCache.get(a.fileName);
      return {
        ...a,
        width: a.width > 0 ? a.width : (cached?.width || 0),
        height: a.height > 0 ? a.height : (cached?.height || 0),
      };
    });

    const replyIds = replies.map((r) => r.serverId || r.id).filter(Boolean).join(',');

    const newMsg: IMessage = {
      id: localTempId,
      serverId: 0,
      senderId: currentUserId,
      senderName: currentUserName,
      senderAvatar: currentUserAvatar,
      receiverId: selectedChatUser.isGroup ? null : selectedChatUser.id,
      groupId: selectedChatUser.isGroup ? selectedChatUser.id : null,
      text,
      timestamp: new Date().toISOString(),
      isMyMessage: true,
      isSentToServer: false,
      isRead: false,
      isDeleted: false,
      isDeletedForMe: false,
      isPinned: false,
      viewsCount: 1,
      replyToMessageIds: replyIds || null,
      attachments: initialAttachments,
      repliedMessages: replies.map((r) => ({
        ...r,
        text: getMessageReplyText(r),
      })),
    };

    set((state) => ({ currentChatMessages: [...state.currentChatMessages, newMsg] }));

    (newMsg.attachments || []).forEach((att) => {
      const ext = (att.fileName || '').slice((att.fileName || '').lastIndexOf('.')).toLowerCase();
      const isVoice = att.type === AttachmentType.Voice || Boolean(att.waveform) || (att.fileName && att.fileName.toLowerCase().startsWith('voice_'));
      const isAudio = att.type === AttachmentType.Audio || ['.mp3', '.flac', '.m4a', '.aac', '.wma', '.opus', '.wav', '.ogg'].includes(ext);

      if (isAudio && !isVoice) {
        const interlocutorAvatar =
          selectedChatUser?.avatarPath ||
          (selectedChatUser as any)?.avatar ||
          (selectedChatUser as any)?.Avatar ||
          (selectedChatUser as any)?.AvatarPath ||
          useSidebarChatsStore.getState().allChats.find((c) =>
            selectedChatUser?.isGroup
              ? Boolean(c.isGroup && (c.groupId === selectedChatUser.id || c.id === selectedChatUser.id))
              : Boolean(!c.isGroup && Number(c.userId || c.id) === Number(selectedChatUser?.id))
          )?.avatarPath || null;

        const track = AudioMetadataHelper.createAudioTrackFromAttachment(
          att,
          newMsg,
          selectedChatUser?.nickName || (selectedChatUser as any)?.groupName || 'Chat',
          interlocutorAvatar,
          Boolean(selectedChatUser?.isGroup),
          Boolean(selectedChatUser?.isChannel)
        );
        useMusicPlayerStore.getState().addTrackIfMatchesChat(track);
      }
    });


    const [sidebarPreviewText, sidebarMessageType] = resolveMessagePreview(
      newMsg,
      currentUserId,
      Boolean(selectedChatUser.isGroup),
      Boolean(selectedChatUser.isChannel)
    );

    useSidebarChatsStore.getState().updateSidebar(
      newMsg.receiverId,
      newMsg.groupId,
      sidebarPreviewText,
      false,
      sidebarMessageType
    );

    (async () => {
      const token = userSession.token;
      const release = beginMessageSend(currentUserId, localTempId);
      if (!release) return;
      try {
        await chatService.saveMessageLocallyAsync(newMsg);
        let finalAttachments = [...initialAttachments];

        const filesToUpload: File[] = [];
        const fileIndices: number[] = [];
        initialAttachments.forEach((att, idx) => {
          if (att.rawFile) {
            filesToUpload.push(att.rawFile);
            fileIndices.push(idx);
          }
        });

        if (filesToUpload.length > 0) {
          const uploadedResults = await chatService.uploadAttachmentsAsync(filesToUpload);

          if (!uploadedResults || uploadedResults.length !== filesToUpload.length) {
            throw new Error('Attachment upload did not complete; message remains pending.');
          }
          if (uploadedResults.length > 0) {
            uploadedResults.forEach((upDto, i) => {
              const targetIdx = fileIndices[i];
              if (targetIdx !== undefined && finalAttachments[targetIdx]) {
                const targetAtt = finalAttachments[targetIdx];
                const rawFile = targetAtt.rawFile;

                const fullServerUrl = UrlHelper.normalize(upDto.url, BASE_SERVER_URL);
                const fullThumbUrl = upDto.thumbnailUrl
                  ? UrlHelper.normalize(upDto.thumbnailUrl, BASE_SERVER_URL)
                  : fullServerUrl;

                if (rawFile) {
                  mediaCacheService.cacheMediaFile(fullServerUrl, rawFile);
                }

                targetAtt.fileName = upDto.fileName;
                targetAtt.url = fullServerUrl;
                targetAtt.thumbnailUrl = fullThumbUrl;
                targetAtt.fileHash = upDto.fileHash;
                if (upDto.width > 0) targetAtt.width = upDto.width;
                if (upDto.height > 0) targetAtt.height = upDto.height;

                mediaDimensionsCache.set(fullServerUrl, { width: targetAtt.width, height: targetAtt.height });
                mediaDimensionsCache.set(upDto.fileName, { width: targetAtt.width, height: targetAtt.height });

                const isGif = targetAtt.fileSizeStr === 'GIF' || targetAtt.fileName?.toLowerCase().endsWith('.gif');
                if (isGif && fullServerUrl) {
                  const savedItem = {
                    serverId: 0,
                    url: fullServerUrl,
                    thumbnailUrl: fullThumbUrl || fullServerUrl,
                    width: targetAtt.width || 320,
                    height: targetAtt.height || 240,
                    savedAt: new Date().toISOString(),
                  };
                  void gifService.saveGifAsync(savedItem);
                  useEmojiStore.getState().addSavedGifLocally(savedItem);
                }
              }
            });

            set((state) => ({
              currentChatMessages: state.currentChatMessages.map((m) =>
                m.id === localTempId
                  ? { ...m, attachments: finalAttachments.map((a) => ({ ...a })) }
                  : m
              ),
            }));

            try {
              const db = getLocalDatabase(userSession.userId);
              await db.messages
                .update(localTempId, {
                  // Keep the original files until a server acknowledgement is received.
                  attachments: finalAttachments.map(a => ({ ...a })),
                })
                .catch(() => {});
            } catch {}
          }
        }

        const uploadedDtos = finalAttachments.map((a) => ({
          type: a.type,
          fileName: a.fileName,
          fileSizeStr: a.fileSizeStr,
          url: a.url,
          thumbnailUrl: a.thumbnailUrl || a.url,
          fileHash: a.fileHash,
          hasAudio: Boolean(a.hasAudio),
          width: a.width || 0,
          height: a.height || 0,
          durationSeconds: a.durationSeconds || 0,
          waveform: a.waveform || '',
        }));

        if (userSession.userId !== currentUserId || userSession.token !== token) return;
        const realId = await signalRService.sendMessageAsync(
          newMsg.receiverId ?? null,
          newMsg.groupId ?? null,
          null,
          text,
          replyIds || null,
          null,
          null,
          null,
          uploadedDtos.length > 0 ? (uploadedDtos as any) : null
        );

        if (realId <= 0) {
          const failure = await chatService.recordSendFailureAsync(localTempId, realId);
          set((state) => ({ currentChatMessages: state.currentChatMessages.map(m => m.id === localTempId ? { ...m, ...failure } : m) }));
          return;
        }
        if (realId && realId > 0) {
          set((state) => ({
            currentChatMessages: state.currentChatMessages.map((m) =>
              m.id === localTempId
                ? {
                    ...m,
                    serverId: realId,
                    isSentToServer: true,
                    attachments: finalAttachments.map((a) => ({ ...a })),
                  }
                : m
            ),
          }));

          await chatService.markAsSentAsync(localTempId, realId, finalAttachments as any, text);

        }
      } catch (err) {
        if (userSession.userId === currentUserId && userSession.token === token) {
          const failure = await chatService.recordSendFailureAsync(localTempId, 0);
          set((state) => ({ currentChatMessages: state.currentChatMessages.map(m => m.id === localTempId ? { ...m, ...failure } : m) }));
        }
        console.error('[ChatStore ERROR] Ошибка отправки:', err);
      } finally { release(); }
    })();
  },

  editMessage: async (localId, serverId, text) => {
    if (isMessageTextTooLong(text)) return;
    await chatService.updateMessageLocallyAsync(localId, serverId, text);
    set((state) => ({
      currentChatMessages: state.currentChatMessages.map((m) =>
        (localId > 0 && m.id === localId) || (serverId > 0 && m.serverId === serverId)
          ? { ...m, text, editedAt: new Date().toISOString() }
          : m
      ),
    }));

    if (serverId > 0) {
      await signalRService.editMessageAsync(serverId, text);
    }
  },

  deleteMessage: async (msg, _deleteForAll) => {
    get().openDeleteDialog(msg);
  },

  togglePinMessage: async (msg, pinForAll) => {
    const isPinned = !msg.isPinned;
    await chatService.setMessagePinLocallyAsync(msg.id, msg.serverId, isPinned);

    const { selectedChatUser, currentUserName, currentUserAvatar } = get();
    const currentUserId = Number(userSession.userId || 0);
    const resolvedName = currentUserName && currentUserName !== 'Me' ? currentUserName : resolveSessionUser().name || 'Me';
    const resolvedAvatar = currentUserAvatar || resolveSessionUser().avatar;

    const enrichedMsg = enrichMessage({ ...msg, isPinned }, currentUserId, resolvedName, resolvedAvatar, selectedChatUser);

    set((state) => {
      let newPins = isPinned
        ? [...state.pinnedMessages, enrichedMsg]
        : state.pinnedMessages.filter((p) => p.id !== msg.id && p.serverId !== msg.serverId);

      newPins.sort((a, b) => {
        const idA = Number(a.serverId && a.serverId > 0 ? a.serverId : (a.id || 0));
        const idB = Number(b.serverId && b.serverId > 0 ? b.serverId : (b.id || 0));
        if (idA > 0 && idB > 0 && idA !== idB) return idA - idB;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });

      return {
        currentChatMessages: state.currentChatMessages.map((m) => (m.id === msg.id ? { ...m, isPinned } : m)),
        pinnedMessages: newPins,
      };
    });

    if (msg.serverId > 0) {
      await signalRService.setPinAsync(msg.serverId, pinForAll, isPinned);
    }
  },

  startSearch: () => {
    const { selectedChatUser, isChatSearchMode } = get();
    if (!selectedChatUser) return;

    if (isChatSearchMode) {
      get().exitSearch();
      return;
    }

    set({
      isChatSearchMode: true,
      chatSearchText: '',
      chatSearchResults: [],
      isChatSearching: false,
    });

    eventBus.emit('FocusSearchBoxMessage' as any, undefined);
  },

  exitSearch: () => {
    set({
      isChatSearchMode: false,
      chatSearchText: '',
      chatSearchResults: [],
      isChatSearching: false,
    });

    eventBus.emit('EndSearchBoxMessage' as any, undefined);
  },

  onChatSearchTextChanged: (query: string) => {
    if (chatSearchDebounceTimer) {
      clearTimeout(chatSearchDebounceTimer);
      chatSearchDebounceTimer = null;
    }

    set({ chatSearchText: query });

    const { isChatSearchMode, selectedChatUser } = get();
    if (!isChatSearchMode || !selectedChatUser || !query.trim()) {
      set({ chatSearchResults: [], isChatSearching: false });
      return;
    }

    const searchVal = query.trim();
    set({ isChatSearching: true });

    chatSearchDebounceTimer = setTimeout(async () => {
      try {
        const currentUserId = Number(
          userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
        );

        const { currentUserName, currentUserAvatar } = get();

        const groupId = selectedChatUser.isGroup ? selectedChatUser.id : null;
        const otherUserId = !selectedChatUser.isGroup ? selectedChatUser.id : null;

        let serverResults = await chatService.searchMessagesAsync(searchVal, groupId, otherUserId);

        let results: IMessage[] = [];
        if (serverResults && serverResults.length > 0) {
          results = serverResults;
        } else {
          results = await chatService.searchLocalMessagesAsync(
            searchVal,
            currentUserId,
            otherUserId,
            groupId,
            50
          );
        }

        results = results.filter((msg) => !msg.isCallMessage && !MessageHelper.isCallMessage(msg));

        const seen = new Set<string>();
        const uniqueResults: IMessage[] = [];

        for (const msg of results) {
          const key = msg.serverId > 0 ? `s_${msg.serverId}` : `l_${msg.id}_${msg.timestamp}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueResults.push(msg);
          }
        }

        const myActualName = currentUserName && currentUserName !== 'Me' ? currentUserName : resolveSessionUser().name || 'You';
        const myActualAvatar = currentUserAvatar || resolveSessionUser().avatar;

        for (const msg of uniqueResults) {
          msg.isMyMessage = msg.senderId === currentUserId;
          msg.senderName = msg.isMyMessage ? myActualName : selectedChatUser.nickName;
          msg.senderAvatar = msg.isMyMessage
            ? myActualAvatar
            : selectedChatUser.avatarPath || (selectedChatUser as any).avatar;
        }

        set({
          chatSearchResults: uniqueResults,
          isChatSearching: false,
        });
      } catch (err) {
        console.error('[ChatStore ERROR] Ошибка при поиске по сообщениям чата:', err);
        set({ isChatSearching: false });
      }
    }, 250);
  },

  jumpToSearchedMessage: async (targetMsg: IMessage) => {
    if (!targetMsg) return;
    const key = getChatKey(get().selectedChatUser);
    const loaded = await get().ensureMessageLoadedAsync(targetMsg.serverId > 0 ? targetMsg.serverId : targetMsg.id, targetMsg);
    if (!loaded || getChatKey(get().selectedChatUser) !== key) return;
    eventBus.emit('ScrollToMessageRequestMessage' as any, {
      messageId: loaded.serverId > 0 ? loaded.serverId : loaded.id,
      localId: loaded.id, serverId: loaded.serverId,
    });
  },

  markAsRead: async () => {
    const { selectedChatUser } = get();
    if (!selectedChatUser) return;

    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );
    const targetUserId = selectedChatUser.isGroup ? null : Number(selectedChatUser.id);
    const targetGroupId = selectedChatUser.isGroup ? Number(selectedChatUser.id) : null;
    const secretChatId = selectedChatUser.isSecretChat ? selectedChatUser.secretChatId : null;

    eventBus.emit('ActiveChatUnreadResetMessage' as any, {
      userId: targetUserId,
      targetUserId,
      groupId: targetGroupId,
      targetGroupId,
      secretChatId,
    });

    set((state) => ({
      currentChatMessages: state.currentChatMessages.map((m) =>
        !m.isMyMessage && !m.isRead ? { ...m, isRead: true } : m
      ),
      unreadCountInActiveChat: 0,
    }));

    try {
      if (secretChatId) {
        await chatService.markSecretMessagesAsReadLocallyAsync(secretChatId);
        if (targetUserId) {
          await signalRService.markSecretChatAsReadAsync(targetUserId, secretChatId);
        }
        return;
      }

      if (targetUserId) {
        await chatService.markIncomingMessagesAsReadLocallyAsync(targetUserId, currentUserId);
      }

      const maxOutgoingReadId = await signalRService.markChatAsReadAsync(targetUserId, targetGroupId);

      if (maxOutgoingReadId > 0 && targetUserId) {
        set((state) => ({
          currentChatMessages: state.currentChatMessages.map((m) =>
            m.isMyMessage && !m.isRead && m.serverId > 0 && m.serverId <= maxOutgoingReadId
              ? { ...m, isRead: true }
              : m
          ),
        }));

        await chatService.markMessagesAsReadLocallyAsync(currentUserId, targetUserId, maxOutgoingReadId);
      }
    } catch (e) {
      console.error('[ChatStore ERROR] Ошибка прочтения:', e);
    }
  },

  trackVisiblePosts: (serverIds) => {
    const { selectedChatUser } = get();
    if (!selectedChatUser?.isChannel) return;

    const unviewed = serverIds.filter((id) => id > 0 && !alreadyTrackedPostIds.has(id));
    if (unviewed.length === 0) return;

    unviewed.forEach((id) => alreadyTrackedPostIds.add(id));
    signalRService.trackPostViewsAsync(unviewed);
  },

  updateAttachmentDimensions: (messageId: number, width: number, height: number) => {
    if (width <= 0 || height <= 0) return;

    set((state) => {
      let modified = false;

      const newMessages = state.currentChatMessages.map((m) => {
        const currentId = Number(m.id || 0);
        const currentServerId = Number(m.serverId || 0);
        const isMatch = messageId > 0 && (currentId === messageId || currentServerId === messageId);

        if (isMatch && m.attachments && m.attachments.length > 0) {
          const att = m.attachments[0];

          mediaDimensionsCache.set(att.url, { width, height });
          mediaDimensionsCache.set(att.fileName, { width, height });

          if (att.width !== width || att.height !== height) {
            modified = true;
            return {
              ...m,
              attachments: m.attachments.map((a, idx) =>
                idx === 0 ? { ...a, width, height } : a
              ),
            };
          }
        }
        return m;
      });

      if (!modified) return state;

      const updatedTarget = newMessages.find((m) => {
        const currentId = Number(m.id || 0);
        const currentServerId = Number(m.serverId || 0);
        return messageId > 0 && (currentId === messageId || currentServerId === messageId);
      });

      if (updatedTarget && updatedTarget.id) {
        try {
          const db = getLocalDatabase(userSession.userId);
          db.messages.update(updatedTarget.id, {
            attachments: updatedTarget.attachments,
          }).catch(() => {});
        } catch {}
      }

      return { currentChatMessages: newMessages };
    });
  },

  toggleAudio: (clickedAtt: IAttachment) => {
    if (!clickedAtt) return;

    const isVoice =
      clickedAtt.type === AttachmentType.Voice ||
      (Boolean(clickedAtt.waveform) && String(clickedAtt.waveform).trim().length > 0) ||
      (Boolean(clickedAtt.fileName) && clickedAtt.fileName.toLowerCase().startsWith('voice_'));

    if (isVoice) {
      if (clickedAtt.url && clickedAtt.url.startsWith('blob:') && clickedAtt.fileName) {
        const cleanName = clickedAtt.fileName.replace(/^.*[\\/]/, '');
        clickedAtt.url = UrlHelper.normalize(`uploads/attachments/${cleanName}`, BASE_SERVER_URL);
      }

      audioPlayerService.togglePlay(clickedAtt, BASE_SERVER_URL);
      return;
    }

    const { currentChatMessages, selectedChatUser } = get();
    const audioTracks: IAudioTrackModel[] = [];
    let targetTrack: IAudioTrackModel | null = null;

    const audioExtensions = new Set(['.mp3', '.flac', '.m4a', '.aac', '.wma', '.opus', '.wav', '.ogg']);

    const interlocutorAvatar =
      selectedChatUser?.avatarPath ||
      (selectedChatUser as any)?.avatar ||
      (selectedChatUser as any)?.Avatar ||
      (selectedChatUser as any)?.AvatarPath ||
      useSidebarChatsStore.getState().allChats.find((c) =>
        selectedChatUser?.isGroup
          ? Boolean(c.isGroup && (c.groupId === selectedChatUser.id || c.id === selectedChatUser.id))
          : Boolean(!c.isGroup && Number(c.userId || c.id) === Number(selectedChatUser?.id))
      )?.avatarPath || null;

    if (currentChatMessages && currentChatMessages.length > 0) {
      for (const msg of currentChatMessages) {
        if (!msg.attachments || msg.attachments.length === 0) continue;

        for (const att of msg.attachments) {
          const isAttVoice =
            att.type === AttachmentType.Voice ||
            (Boolean(att.waveform) && String(att.waveform).trim().length > 0) ||
            (Boolean(att.fileName) && att.fileName.toLowerCase().startsWith('voice_'));
          if (isAttVoice) continue;

          const ext = (att.fileName || '').slice((att.fileName || '').lastIndexOf('.')).toLowerCase();
          const isAudio = att.type === AttachmentType.Audio || audioExtensions.has(ext);

          if (isAudio) {
            const track = AudioMetadataHelper.createAudioTrackFromAttachment(
              att,
              msg,
              selectedChatUser?.nickName || (selectedChatUser as any)?.groupName || 'Chat',
              interlocutorAvatar,
              Boolean(selectedChatUser?.isGroup),
              Boolean(selectedChatUser?.isChannel)
            );

            audioTracks.push(track);

            const isTarget =
              att === clickedAtt ||
              AudioConverterHelper.isSameAttachment(att, clickedAtt) ||
              (Boolean(att.url) && Boolean(clickedAtt.url) && att.url.toLowerCase() === clickedAtt.url.toLowerCase()) ||
              (Boolean(att.fileHash) && Boolean(clickedAtt.fileHash) && att.fileHash === clickedAtt.fileHash) ||
              (Boolean(att.fileName) &&
                Boolean(clickedAtt.fileName) &&
                att.fileName.toLowerCase() === clickedAtt.fileName.toLowerCase() &&
                msg.id === (clickedAtt as any).messageId);

            if (isTarget) {
              targetTrack = track;
            }
          }
        }
      }
    }

    if (!targetTrack) {
      targetTrack = AudioMetadataHelper.createAudioTrackFromAttachment(
        clickedAtt,
        null,
        selectedChatUser?.nickName || (selectedChatUser as any)?.groupName || 'Chat',
        interlocutorAvatar,
        Boolean(selectedChatUser?.isGroup),
        Boolean(selectedChatUser?.isChannel)
      );
      audioTracks.unshift(targetTrack);
    }

    eventBus.emit('PlayPlaylistMessage' as any, { tracks: audioTracks, selectedTrack: targetTrack });
  },

  seekAudio: (seconds: number) => {
    audioPlayerService.seek(seconds);
  },
}));

// ================= ВСЕ СЛУШАТЕЛИ EVENTBUS =================

eventBus.on('StartSecretChatRequest' as any, () => {
  void useChatStore.getState().startSecretChat();
});

eventBus.on('TriggerSelectMessageMessage' as any, ({ message }: { message: IMessage }) => {
  useChatStore.getState().toggleSelectMessage(message);
});

eventBus.on('TriggerForwardMessageMessage' as any, ({ message }: { message: IMessage }) => {
  useChatStore.getState().openForwardDialog([message]);
});

eventBus.on('TriggerForwardMessagesMessage' as any, ({ messages }: { messages: IMessage[] }) => {
  useChatStore.getState().openForwardDialog(messages);
});

eventBus.on('TriggerDeleteMessageMessage' as any, ({ message }: { message: IMessage }) => {
  useChatStore.getState().openDeleteDialog(message);
});

eventBus.on('GifPickedMessage' as any, async ({ gif }: { gif: ISavedGif }) => {
  if (!gif || !gif.url) return;

  const { selectedChatUser, sendMessage } = useChatStore.getState();
  if (!selectedChatUser) return;

  const fileName = gif.url.split('/').pop()?.split('?')[0] || 'animation.mp4';

  const gifAtt: IAttachment = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    messageId: 0,
    type: AttachmentType.Video,
    fileName,
    fileSizeStr: 'GIF',
    fileSizeBytes: 0,
    url: gif.url,
    thumbnailUrl: gif.thumbnailUrl || gif.url,
    hasAudio: false,
    width: gif.width || 320,
    height: gif.height || 240,
    durationSeconds: 0,
    isSilentVideo: true,
  };

  await sendMessage('', [gifAtt], null, []);
});

eventBus.on('SelectChatUserMessage' as any, async (data: any) => {
  const target = data && typeof data === 'object' && 'target' in data ? data.target : data;
  await useChatStore.getState().selectChatUser(target ?? null);
});

eventBus.on('ChatSearchQueryChangedMessage', ({ query }) => {
  if (useChatStore.getState().isChatSearchMode) {
    useChatStore.getState().onChatSearchTextChanged(query);
  }
});

eventBus.on('EndSearchBoxMessage', () => {
  if (useChatStore.getState().isChatSearchMode) {
    useChatStore.setState({
      isChatSearchMode: false,
      chatSearchText: '',
      chatSearchResults: [],
      isChatSearching: false,
    });
  }
});

eventBus.on('UserTypingMessage' as any, ({ senderId, groupId }: { senderId: number; groupId: number | null }) => {
  const { selectedChatUser } = useChatStore.getState();
  if (!selectedChatUser || selectedChatUser.isSecretChat) return;

  const activeId = Number(selectedChatUser.id ?? (selectedChatUser as any).userId ?? 0);
  const isCurrent = groupId
    ? selectedChatUser.isGroup && activeId === Number(groupId)
    : !selectedChatUser.isGroup && (activeId === Number(senderId) || activeId === Number(senderId));

  if (isCurrent) {
    useChatStore.setState({
      selectedChatUser: { ...selectedChatUser, isTyping: true },
    });

    if (activeChatTypingTimer) clearTimeout(activeChatTypingTimer);
    activeChatTypingTimer = setTimeout(() => {
      const current = useChatStore.getState().selectedChatUser;
      if (current) {
        useChatStore.setState({
          selectedChatUser: { ...current, isTyping: false },
        });
      }
      activeChatTypingTimer = null;
    }, 4000);
  }
});

eventBus.on('MessageInputTextChangedMessage' as any, ({ text }: { text: string }) => {
  useChatStore.getState().sendTyping(text);
});

eventBus.on('ReceiveMessage' as any, async (incoming: IMessage) => {
  const currentUserId = Number(
    userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
  );
  const { selectedChatUser, currentUserName, currentUserAvatar } = useChatStore.getState();
  const isMy = Number(incoming.senderId) === Number(currentUserId);
  incoming.isMyMessage = isMy;

  if (isMy) {
    incoming.senderName = currentUserName;
    incoming.senderAvatar = currentUserAvatar;
  } else {
    if (!incoming.groupId && selectedChatUser && !selectedChatUser.isGroup) {
      incoming.senderName = selectedChatUser.nickName || (selectedChatUser as any).groupName || 'User';
      incoming.senderAvatar = selectedChatUser.avatarPath || (selectedChatUser as any).avatar;
    } else if (incoming.groupId && !incoming.senderName) {
      // 🟢 Обогащаем сообщение автора в группе реальными данными
      await userService.enrichMessagesWithSendersAsync([incoming], currentUserId);
    }
  }

  const activeChatId = selectedChatUser
    ? Number(selectedChatUser.id ?? (selectedChatUser as any).userId ?? 0)
    : 0;

  const isFromCurrentChat = Boolean(
    selectedChatUser && activeChatId > 0 &&
    (incoming.groupId
      ? selectedChatUser.isGroup && activeChatId === Number(incoming.groupId)
      : !selectedChatUser.isGroup && !selectedChatUser.isSecretChat && (activeChatId === Number(incoming.senderId) || activeChatId === Number(incoming.receiverId)))
  );

  if (isFromCurrentChat) {
    if (activeChatTypingTimer) {
      clearTimeout(activeChatTypingTimer);
      activeChatTypingTimer = null;
    }
    if (selectedChatUser?.isTyping) {
      useChatStore.setState({ selectedChatUser: { ...selectedChatUser, isTyping: false } });
    }
  }

  const isChatOpen = isFromCurrentChat;

  if (isMy) {
    let matched = false;

    useChatStore.setState((state) => {
      const updated = state.currentChatMessages.map((m) => {
        if (
          (incoming.serverId > 0 && m.serverId === incoming.serverId) ||
          (m.serverId === 0 && m.isMyMessage && (m.text === incoming.text || m.id === incoming.id))
        ) {
          matched = true;
          const mergedAttachments = (m.attachments || []).map((att, idx) => {
            const inc = incoming.attachments?.[idx];
            const rawIncUrl = inc?.url || (inc as any)?.Url || '';
            const normalizedIncUrl = rawIncUrl ? UrlHelper.normalize(rawIncUrl, BASE_SERVER_URL) : '';

            return {
              ...att,
              ...(inc || {}),
              url: normalizedIncUrl || (att.url && !att.url.startsWith('blob:') ? att.url : normalizedIncUrl),
              waveform: (inc?.waveform && String(inc.waveform).trim().length > 0) ? inc.waveform : att.waveform,
            };
          });

          return {
            ...m,
            serverId: incoming.serverId,
            isSentToServer: true,
            isRead: incoming.isRead,
            attachments: mergedAttachments.length > 0 ? mergedAttachments : (m.attachments || incoming.attachments),
          };
        }
        return m;
      });

      if (!matched && isChatOpen) {
        const alreadyExists = updated.some(
          (m) =>
            (incoming.serverId > 0 && m.serverId === incoming.serverId) ||
            (incoming.id > 0 && m.id === incoming.id) ||
            (m.text === incoming.text &&
              Math.abs(new Date(m.timestamp).getTime() - new Date(incoming.timestamp).getTime()) < 2000)
        );

        if (!alreadyExists) {
          return { currentChatMessages: [...updated, incoming] };
        }
      }

      return { currentChatMessages: updated };
    });

    if (!matched) {
      chatService.saveMessageLocallyAsync(incoming).catch((err) => {
        console.warn('[ChatStore] Ошибка локального сохранения синхронизированного сообщения:', err);
      });
    }
  } else {
    if (isChatOpen) {
      useChatStore.setState((state) => {
        const alreadyExists = state.currentChatMessages.some(
          (m) =>
            (incoming.serverId > 0 && m.serverId === incoming.serverId) ||
            (incoming.id > 0 && m.id === incoming.id)
        );
        if (alreadyExists) return state;

        return { currentChatMessages: [...state.currentChatMessages, incoming] };
      });

      if(useChatStore.getState().isScrolledToBottom)void useChatStore.getState().markAsRead();
    }
  }

  (incoming.attachments || []).forEach((att) => {
    const ext = (att.fileName || '').slice((att.fileName || '').lastIndexOf('.')).toLowerCase();
    const isVoice = att.type === AttachmentType.Voice || Boolean(att.waveform) || (att.fileName && att.fileName.toLowerCase().startsWith('voice_'));
    const isAudio = att.type === AttachmentType.Audio || ['.mp3', '.flac', '.m4a', '.aac', '.wma', '.opus', '.wav', '.ogg'].includes(ext);

    if (isAudio && !isVoice) {
      const interlocutorAvatar =
        selectedChatUser?.avatarPath ||
        (selectedChatUser as any)?.avatar ||
        (selectedChatUser as any)?.Avatar ||
        (selectedChatUser as any)?.AvatarPath ||
        useSidebarChatsStore.getState().allChats.find((c) =>
          selectedChatUser?.isGroup
            ? Boolean(c.isGroup && (c.groupId === selectedChatUser.id || c.id === selectedChatUser.id))
            : Boolean(!c.isGroup && Number(c.userId || c.id) === Number(selectedChatUser?.id))
        )?.avatarPath || null;

      const track = AudioMetadataHelper.createAudioTrackFromAttachment(
        att,
        incoming,
        selectedChatUser?.nickName || (selectedChatUser as any)?.groupName || 'Chat',
        interlocutorAvatar,
        Boolean(selectedChatUser?.isGroup),
        Boolean(selectedChatUser?.isChannel)
      );
      useMusicPlayerStore.getState().addTrackIfMatchesChat(track);
    }
  });

  const isGroupChat = Boolean(selectedChatUser?.isGroup || incoming.groupId);
  const isChannelChat = Boolean(selectedChatUser?.isChannel);

  const [previewText, messageType] = resolveMessagePreview(
    incoming,
    currentUserId,
    isGroupChat,
    isChannelChat
  );

  const sidebarUserId = isMy ? incoming.receiverId : incoming.senderId;
  const shouldIncrementUnread = !isMy && (!isChatOpen || !useChatStore.getState().isScrolledToBottom);

  useSidebarChatsStore.getState().updateSidebar(
    sidebarUserId,
    incoming.groupId,
    previewText,
    shouldIncrementUnread,
    messageType
  );
});

eventBus.on('MessagesWereReadMessage' as any, async (data: { readerId: number; maxReadId: number }) => {
  const { selectedChatUser } = useChatStore.getState();
  const currentUserId = Number(
    userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
  );

  if (selectedChatUser && !selectedChatUser.isGroup && selectedChatUser.id === data.readerId) {
    if (data.maxReadId > 0) {
      useChatStore.setState((state) => ({
        currentChatMessages: state.currentChatMessages.map((msg) =>
          msg.isMyMessage && !msg.isRead && msg.serverId > 0 && msg.serverId <= data.maxReadId
            ? { ...msg, isRead: true }
            : msg
        ),
      }));

      await chatService.markMessagesAsReadLocallyAsync(currentUserId, data.readerId, data.maxReadId);
    }
  }
});

eventBus.on('MessageEditedMessage' as any, ({ serverId, newText, attachments }: any) => {
  useChatStore.setState((state) => ({
    currentChatMessages: state.currentChatMessages.map((m) =>
      m.serverId === serverId
        ? {
            ...m,
            text: newText,
            editedAt: new Date().toISOString(),
            attachments: attachments || m.attachments,
          }
        : m
    ),
    pinnedMessages: state.pinnedMessages.map((p) =>
      p.serverId === serverId
        ? {
            ...p,
            text: newText,
            editedAt: new Date().toISOString(),
            attachments: attachments || p.attachments,
          }
        : p
    ),
  }));
});

eventBus.on('MessageDeletedMessage' as any, ({ serverId, isForAll }: { serverId: number; isForAll: boolean }) => {
  const currentReplies = useMessageInputStore.getState().replyingToMessages || [];
  if (currentReplies.length > 0) {
    const remaining = currentReplies.filter((rep) => {
      const rId = Number(rep.id || 0);
      const rServerId = Number(rep.serverId || 0);
      return rServerId !== serverId && rId !== serverId;
    });
    if (remaining.length !== currentReplies.length) {
      useMessageInputStore.setState({ replyingToMessages: remaining });
    }
  }

  const currentEdit = useMessageInputStore.getState().editingMessage;
  if (currentEdit) {
    const eId = Number(currentEdit.id || 0);
    const eServerId = Number(currentEdit.serverId || 0);
    if (eServerId === serverId || eId === serverId) {
      useMessageInputStore.getState().cancelEdit();
    }
  }

  useChatStore.setState((state) => {
    const updatedChatMessages = (isForAll
      ? state.currentChatMessages.filter((m) => m.serverId !== serverId && m.id !== serverId)
      : state.currentChatMessages.filter((m) => !(m.forwardedFromName && m.serverId === serverId)).map((m) =>
          m.serverId === serverId
            ? { ...m, isDeletedForMe: true, text: 'This message was deleted' }
            : m
        )
    ).map((m) => {
      if (m.repliedMessages && m.repliedMessages.length > 0) {
        const remaining = m.repliedMessages.filter((rep: any) => {
          const rId = Number(rep.id || 0);
          const rServerId = Number(rep.serverId || 0);
          return rServerId !== serverId && rId !== serverId;
        });
        if (remaining.length !== m.repliedMessages.length) {
          return { ...m, repliedMessages: remaining };
        }
      }
      return m;
    });

    const updatedPinned = state.pinnedMessages.filter((p) => p.serverId !== serverId && p.id !== serverId);

    return {
      currentChatMessages: updatedChatMessages,
      pinnedMessages: updatedPinned,
    };
  });
});

eventBus.on('MessagePinnedMessage' as any, ({ serverMessageId, isPinned }: { serverMessageId: number; isPinned: boolean }) => {
  useChatStore.setState((state) => {
    const updatedMessages = state.currentChatMessages.map((m) =>
      m.serverId === serverMessageId || m.id === serverMessageId ? { ...m, isPinned } : m
    );

    let updatedPins = [...state.pinnedMessages];
    if (isPinned) {
      const target = updatedMessages.find((m) => m.serverId === serverMessageId || m.id === serverMessageId);
      if (target && !updatedPins.some((p) => p.serverId === serverMessageId || p.id === serverMessageId)) {
        const currentUserId = Number(
          userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
        );
        const resolvedName = state.currentUserName && state.currentUserName !== 'Me' ? state.currentUserName : resolveSessionUser().name || 'Me';
        const resolvedAvatar = state.currentUserAvatar || resolveSessionUser().avatar;
        updatedPins.push(enrichMessage(target, currentUserId, resolvedName, resolvedAvatar, state.selectedChatUser));
      }
    } else {
      updatedPins = updatedPins.filter((p) => p.serverId !== serverMessageId && p.id !== serverMessageId);
    }

    updatedPins.sort((a, b) => {
      const idA = Number(a.serverId && a.serverId > 0 ? a.serverId : (a.id || 0));
      const idB = Number(b.serverId && b.serverId > 0 ? b.serverId : (b.id || 0));
      if (idA > 0 && idB > 0 && idA !== idB) return idA - idB;
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    return { currentChatMessages: updatedMessages, pinnedMessages: updatedPins };
  });
});

eventBus.on('MessageViewsUpdatedMessage' as any, ({ serverMessageId, viewsCount }: { serverMessageId: number; viewsCount: number }) => {
  useChatStore.setState((state) => ({
    currentChatMessages: state.currentChatMessages.map((m) =>
      m.serverId === serverMessageId ? { ...m, viewsCount } : m
    ),
  }));
});

eventBus.on('BlockStatusChangedMessage' as any, async (data: any) => {
  const { selectedChatUser } = useChatStore.getState();
  const targetId = Number(data.targetUserId || data.blockerId || 0);

  if (!selectedChatUser || selectedChatUser.isGroup || Number(selectedChatUser.id) !== targetId) {
    return;
  }

  if (data.isBlockedByMe !== undefined) {
    const byMe = Boolean(data.isBlockedByMe);
    const byThem = Boolean(data.isBlockedByThem ?? useChatStore.getState().isBlockedByThem);

    useChatStore.setState({
      isBlockedByMe: byMe,
      isBlockedByThem: byThem,
      canWriteMessages: !byMe && !byThem,
    });
    useChatStore.getState().syncPermissionsWithInput();
    await chatService.saveCachedBlockStatusAsync(targetId, byMe, byThem);
    return;
  }

  try {
    let status: any = null;
    if ((userService as any)?.getBlockStatusAsync) {
      status = await (userService as any).getBlockStatusAsync(targetId);
    } else {
      const res = await apiClient.get<any>(`api/Users/block-status/${targetId}`).catch(() => null);
      status = res?.data;
    }

    if (status) {
      const byMe = Boolean(status.blockedByMe ?? status.BlockedByMe);
      const byThem = Boolean(status.blockedByThem ?? status.BlockedByThem);

      useChatStore.setState({
        isBlockedByMe: byMe,
        isBlockedByThem: byThem,
        canWriteMessages: !byMe && !byThem,
      });
      useChatStore.getState().syncPermissionsWithInput();
      await chatService.saveCachedBlockStatusAsync(targetId, byMe, byThem);
    }
  } catch (err) {
    console.error('[ChatStore] Ошибка обработки статуса блокировки:', err);
  }
});

eventBus.on('ClearActiveChatMessagesMessage' as any, () => {
  useMessageInputStore.getState().cancelReply();
  useMessageInputStore.getState().cancelEdit();
  useChatStore.setState({
    currentChatMessages: [],
    pinnedMessages: [],
    selectedCount: 0,
    isSelectionMode: false,
  });
});

eventBus.on('ActiveChatRefreshRequestedMessage' as any, async () => {
  const { selectedChatUser, currentChatMessages, currentUserName, currentUserAvatar } = useChatStore.getState();
  if (selectedChatUser) {
    const currentUserId = Number(
      userSession.userId || JSON.parse(localStorage.getItem('user_session_data') || '{}').userId || 0
    );
    const targetUserId = selectedChatUser.isGroup ? null : selectedChatUser.id;
    const groupId = selectedChatUser.isGroup ? selectedChatUser.id : null;
    const secretChatId = selectedChatUser.isSecretChat ? selectedChatUser.secretChatId : null;

    const takeCount = Math.max(30, currentChatMessages.length);

    const [messages, pinned] = await Promise.all([
      chatService.getLocalMessagesAsync(currentUserId, targetUserId, groupId, secretChatId, takeCount),
      chatService.getLocalPinnedMessagesAsync(currentUserId, targetUserId, groupId, secretChatId),
    ]);

    if (getChatKey(useChatStore.getState().selectedChatUser) === getChatKey(selectedChatUser)) {
      if (selectedChatUser.isGroup) {
        if (messages && messages.length > 0) {
          await userService.enrichMessagesWithSendersAsync(messages, currentUserId);
        }
        if (pinned && pinned.length > 0) {
          await userService.enrichMessagesWithSendersAsync(pinned, currentUserId);
        }
      }
      if (messages && messages.length > 0) {
        await userService.enrichForwardedMessagesAsync(messages, currentUserId);
      }

      const resolvedName = currentUserName && currentUserName !== 'Me' ? currentUserName : resolveSessionUser().name || 'Me';
      const resolvedAvatar = currentUserAvatar || resolveSessionUser().avatar;

      const enrichedMessages = (messages || []).map((m) =>
        enrichMessage(m, currentUserId, resolvedName, resolvedAvatar, selectedChatUser)
      );
      const enrichedPinned = (pinned || []).map((p) =>
        enrichMessage(p, currentUserId, resolvedName, resolvedAvatar, selectedChatUser)
      );

      useChatStore.setState({ currentChatMessages: enrichedMessages, pinnedMessages: enrichedPinned });
    }
  }
});

eventBus.on('SignalRConnectedMessage' as any,()=>{void useChatStore.getState().triggerDeltaSync();});

eventBus.on('SyncTimerMessage' as any, () => {
  void useChatStore.getState().triggerDeltaSync();
});

// Слушатели E2EE секретных чатов
eventBus.on('SecretMessageReceivedMessage' as any, (data: any) => {
  const { selectedChatUser } = useChatStore.getState();
  if (
    selectedChatUser &&
    selectedChatUser.isSecretChat &&
    selectedChatUser.secretChatId === data.secretChatId
  ) {
    const incoming: IMessage = data.message || {
      id: Date.now(),
      serverId: 0,
      senderId: data.senderId,
      receiverId: Number(userSession.userId),
      secretChatId: data.secretChatId,
      text: data.ciphertext,
      timestamp: data.timestamp || new Date().toISOString(),
      isMyMessage: false,
      isSentToServer: true,
      isRead: false,
      isDeleted: false,
      isDeletedForMe: false,
      isPinned: false,
      viewsCount: 1,
      attachments: data.incomingAttachments || [],
      repliedMessages: data.replyText
        ? [{ senderName: data.replySender || 'User', text: data.replyText } as any]
        : [],
    };

    useChatStore.setState((state) => ({
      currentChatMessages: [...state.currentChatMessages, incoming],
    }));

    if (useChatStore.getState().isScrolledToBottom) {
      useChatStore.getState().markAsRead();
    }
  }
});

eventBus.on('UserProfileUpdatedMessage', ({ user }) => {
  if (!user || user.id <= 0) return;
  const name = user.nickName || user.username || 'User';
  const avatar = user.avatarPath || user.avatar || null;
  useChatStore.setState(state => {
    const selected = state.selectedChatUser;
    const update = (message: IMessage) => message.senderId === user.id
      ? { ...message, senderName: name, senderAvatar: avatar } : message;
    return {
      selectedChatUser: selected && !selected.isGroup && Number(selected.id) === user.id
        ? { ...selected, nickName: name, username: user.username, avatar: user.avatar ?? null, avatarPath: user.avatarPath || null } : selected,
      currentChatMessages: state.currentChatMessages.map(update), pinnedMessages: state.pinnedMessages.map(update),
      ...(user.id === userSession.userId ? { currentUserName: name, currentUserAvatar: avatar } : {}),
    };
  });
});

eventBus.on('SecretChatEstablishedMessage' as any, ({ secretChatId, keyFingerprint }: any) => {
  const { selectedChatUser } = useChatStore.getState();
  if (
    selectedChatUser &&
    selectedChatUser.isSecretChat &&
    selectedChatUser.secretChatId === secretChatId
  ) {
    useChatStore.setState({
      selectedChatUser: {
        ...selectedChatUser,
        keyFingerprint,
      },
    });
  }
});

eventBus.on('SecretChatWereReadMessage' as any, ({ secretChatId }: any) => {
  const { selectedChatUser } = useChatStore.getState();
  if (
    selectedChatUser &&
    selectedChatUser.isSecretChat &&
    selectedChatUser.secretChatId === secretChatId
  ) {
    useChatStore.setState((state) => ({
      currentChatMessages: state.currentChatMessages.map((m) =>
        m.isMyMessage && !m.isRead ? { ...m, isRead: true } : m
      ),
    }));
  }
});

eventBus.on('SecretChatDiscardedMessage' as any, ({ secretChatId }: any) => {
  const { selectedChatUser } = useChatStore.getState();
  if (selectedChatUser && selectedChatUser.secretChatId === secretChatId) {
    useChatStore.setState({
      selectedChatUser: null,
      currentChatMessages: [],
      pinnedMessages: [],
    });
    eventBus.emit('SelectChatUserMessage', { target: null });
  }
});
