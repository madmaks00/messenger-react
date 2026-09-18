import type {
  IMessage,
  IChatListItem,
  IUserSearchResult,
  IUser,
  IGroupMember,
  IAttachment,
} from '../types/models';
import type { AttachmentDto } from '../types/dtos';
import { LastMessageType, MainTab } from '../types/enums';

// Реестр всех событий приложения (1-в-1 как в C# Messenger.Register)
export type AppEvents = {
  // Auth & Session
  RegistrationSuccessMessage: void;
  AuthFailedMessage: void;
  BeforeAccountSwitchMessage: void;
  AccountSwitchedMessage: { nickName: string };
  StartEmailVerificationMessage: { user: Partial<IUser> };
  EmailVerificationSuccessMessage: { authResult: any };
  CancelEmailVerificationMessage: void;
  UserProfileUpdatedMessage: { user: IUser };

  // Chat Navigation & Selection
  SelectChatUserMessage: { target: IUserSearchResult | null };
  SwitchTabMessage: { tab: MainTab };
  ClearActiveChatMessagesMessage: { deleteForAll?: boolean } | void;
  ClearMessageInputMessage: void;

  // Realtime Messages & Sidebar
  ReceiveMessage: IMessage;
  SidebarUpdateMessage: {
    userId?: number | null;
    groupId?: number | null;
    previewText: string;
    incrementUnread?: boolean;
    messageType?: LastMessageType;
    secretChatId?: string | null;
  };
  SidebarUpdateAfterDeletionMessage: { userId?: number | null; groupId?: number | null };
  SidebarUpdateForEditMessage: {
    userId?: number | null;
    groupId?: number | null;
    localId: number;
    serverId: number;
    newText: string;
  };
  ActiveChatUnreadResetMessage: {
    userId?: number | null;
    groupId?: number | null;
    secretChatId?: string | null;
  };
  MessageEditedMessage: { serverId: number; newText: string; attachments?: AttachmentDto[] | null };
  MessageDeletedMessage: { serverId: number; isForAll: boolean };
  MessagePinnedMessage: { serverMessageId: number; isPinned: boolean };
  MessageViewsUpdatedMessage: { serverMessageId: number; viewsCount: number };
  MessagesWereReadMessage: { readerId: number; maxReadId: number };
  ChatClearedForBothMessage: { blockerId: number };
  UserStatusChangedMessage: { userId: number; isOnline: boolean; lastSeen: string };
  UserTypingMessage: { senderId: number; groupId?: number | null };
  BlockStatusChangedMessage: { targetUserId: number; isBlocked: boolean };
  AttachmentProcessedMessage: {
    fileHash: string;
    fileName: string;
    url: string;
    thumbnailUrl?: string | null;
    width: number;
    height: number;
    hasAudio: boolean;
    finalType: number;
  };

  // Secret Chats (E2EE)
  SecretChatCreatedMessage: { chat: IChatListItem };
  SecretChatEstablishedMessage: { secretChatId: string; keyFingerprint: string };
  SecretChatDiscardedMessage: { senderId: number; secretChatId: string };
  SecretChatWereReadMessage: { secretChatId: string };
  SecretMessageReceivedMessage: {
    senderId: number;
    secretChatId: string;
    text: string;
    nonce: string;
    tag: string;
    timestamp: string;
    replyText?: string | null;
    replySender?: string | null;
    attachments?: AttachmentDto[] | null;
  };

  // Groups
  GroupCreatedMessage: { newChat: IChatListItem };
  GroupJoinedMessage: { groupId: number };
  UserJoinedGroupMessage: { groupId: number; member: IGroupMember; memberCount: number; onlineCount: number };
  UserLeftGroupMessage: { groupId: number; userId: number; memberCount: number; onlineCount: number };
  GroupUpdatedMessage: { groupId: number; newName: string; newAvatar?: string | null; newDescription?: string | null };
  GroupPermissionsChangedMessage: { groupId: number; canText: boolean; canMedia: boolean; canPin: boolean };
  KickedFromGroupMessage: { groupId: number };
  GroupInviteLinkUpdatedMessage: { groupId: number; inviteLink: string };
  GroupTypeUpdatedMessage: { groupId: number; isPublic: boolean; groupLink: string };
  GroupMuteStatusChangedMessage: { groupId: number; isMuted: boolean };
  GroupPinStatusChangedMessage: { groupId: number; isPinned: boolean };
  UserMuteStatusChangedMessage: { userId: number; isMuted: boolean };

  // Calls & WebRTC
  IncomingCallMessage: { callerId: number; callerName: string; callerAvatar?: string | null };
  CallResponseMessage: { receiverId: number; accepted: boolean };
  CallEndedMessage: { targetId: number };
  WebRTCDataMessage: { senderId: number; data: string };
  IncomingGroupCallMessage: { groupId: number; groupName: string; callerId: number; callerName: string; callerAvatar?: string | null };
  GroupCallJoinedMessage: { groupId: number; participants: any[] };
  UserJoinedGroupCallMessage: { groupId: number; participant: any };
  UserLeftGroupCallMessage: { groupId: number; userId: number };
  GroupCallWebRTCDataMessage: { groupId: number; senderId: number; data: string };
  SyncTimerMessage: void;

  // Notes & Stories
  NoteUpdatedMessage: { noteId: number };
  StoryPostedMessage: { userId: number; userName: string; userAvatar?: string | null };

  // Dialogs
  OpenConfirmDialogMessage: {
    title: string;
    message: string;
    avatar?: string | null;
    checkboxText?: string | null;
    confirmButtonText?: string;
    onConfirmAction: (isChecked?: boolean) => Promise<void> | void;
  };
};

type Handler<T> = (data: T) => void;

class EventBus {
  private handlers = new Map<keyof AppEvents, Set<Handler<any>>>();

  public on<K extends keyof AppEvents>(event: K, handler: Handler<AppEvents[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    // Возвращает функцию для мгновенной отписки
    return () => {
      this.off(event, handler);
    };
  }

  public off<K extends keyof AppEvents>(event: K, handler: Handler<AppEvents[K]>): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);
      if (eventHandlers.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  public emit<K extends keyof AppEvents>(event: K, data: AppEvents[K]): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          console.error(`[EventBus Error] Event: ${String(event)}`, err);
        }
      });
    }
  }

  public clear(): void {
    this.handlers.clear();
  }
}

export const eventBus = new EventBus();