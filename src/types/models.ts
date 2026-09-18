import {
  AttachmentType,
  Gender,
  LastMessageType,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from './enums';

// =========================================================================
// 1. ATTACHMENT
// =========================================================================
export interface IAttachment {
  id: number;
  messageId: number;
  type: AttachmentType;
  fileName: string;
  fileSizeStr: string;
  fileSizeBytes: number;
  url: string;
  thumbnailUrl?: string | null;
  localImagePath?: string | null;
  localThumbnailPath?: string | null;
  fileHash?: string | null;
  hasAudio: boolean;
  width: number;
  height: number;
  durationSeconds: number;
  waveform?: string | null;
  isSelected?: boolean;
}

export class AttachmentHelper {
  public static isPhoto(att: IAttachment): boolean {
    return att.type === AttachmentType.Photo;
  }

  public static isVideo(att: IAttachment): boolean {
    return att.type === AttachmentType.Video;
  }

  public static isAudio(att: IAttachment): boolean {
    return att.type === AttachmentType.Audio;
  }

  public static isVoice(att: IAttachment): boolean {
    return att.type === AttachmentType.Voice;
  }

  public static isDocument(att: IAttachment): boolean {
    return att.type === AttachmentType.Document;
  }

  public static isSilentVideo(att: IAttachment): boolean {
    return att.type === AttachmentType.Video && !att.hasAudio;
  }

  public static isNormalVideo(att: IAttachment): boolean {
    return att.type === AttachmentType.Video && att.hasAudio;
  }

  public static isOverAutoDownloadLimit(att: IAttachment): boolean {
    return att.fileSizeBytes > 50 * 1024 * 1024; // > 50 MB
  }

  public static formatDuration(durationSeconds: number): string {
    if (durationSeconds <= 0) return '';
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    const seconds = durationSeconds % 60;

    const pad = (num: number) => num.toString().padStart(2, '0');
    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${minutes}:${pad(seconds)}`;
  }

  public static getDisplayImageUrl(att: IAttachment): string | null {
    if (att.type === AttachmentType.Photo) {
      return att.localImagePath || att.url || null;
    }
    if (att.type === AttachmentType.Video) {
      return att.localThumbnailPath || att.thumbnailUrl || att.url || null;
    }
    return att.localImagePath || att.url || null;
  }
}

// =========================================================================
// 2. MESSAGE
// =========================================================================
export const CALL_SECRET_PREFIX = '\u200B\u200B\u200B_CALL:';

export interface IMessage {
  id: number;
  serverId: number;
  senderId: number;
  receiverId?: number | null;
  groupId?: number | null;
  isMyMessage: boolean;
  isSentToServer: boolean;
  text: string;
  isRead: boolean;
  timestamp: string; // ISO String
  noteId?: number | null;
  isDeleted: boolean;
  deletedForUsers?: string | null;
  isDeletedForMe: boolean;
  replyToMessageIds?: string | null;
  isPinned: boolean;
  forwardedFromName?: string | null;
  forwardedFromUserId?: number | null;
  editedAt?: string | null;
  senderAvatar?: string | null;
  forwardedFromAvatar?: string | null;
  localImagePath?: string | null;
  senderName?: string | null;
  isSelected?: boolean;
  secretChatId?: string | null;
  viewsCount: number;
  attachments?: IAttachment[];
  repliedMessages?: IMessage[];
}

export class MessageHelper {
  public static isEdited(m: IMessage): boolean {
    return Boolean(m.editedAt) && !m.isDeletedForMe && !m.isDeleted;
  }

  public static isGroupMessage(m: IMessage): boolean {
    return Boolean(m.groupId && m.groupId > 0);
  }

  public static isForwarded(m: IMessage): boolean {
    return Boolean(m.forwardedFromName && m.forwardedFromName.length > 0);
  }

  public static isSecretChat(m: IMessage): boolean {
    return Boolean(m.secretChatId && m.secretChatId.length > 0);
  }

  public static isJoinLink(m: IMessage): boolean {
    return Boolean(m.text && m.text.toLowerCase().includes('/join/g'));
  }

  public static isCallMessage(m: IMessage): boolean {
    if (!m.text) return false;
    const lower = m.text.toLowerCase();
    return (
      m.text.startsWith(CALL_SECRET_PREFIX) ||
      m.text.startsWith('_CALL:') ||
      lower.includes('_call:')
    );
  }

  public static getCallTitle(m: IMessage): string {
    if (!this.isCallMessage(m)) return '';
    const cleanText = m.text.replace(/\u200B/g, '');
    const parts = cleanText.split(':');
    const status = parts.length > 1 ? parts[1].toUpperCase() : '';

    if (m.isMyMessage) {
      return status === 'CANCELED' || status === 'MISSED'
        ? 'Canceled call'
        : 'Outgoing call';
    } else {
      return status === 'CANCELED' || status === 'MISSED'
        ? 'Missed call'
        : 'Incoming call';
    }
  }

  public static getCallTimeAndDuration(m: IMessage): string {
    if (!this.isCallMessage(m)) return '';
    const parts = m.text.split(':');
    const durationStr = parts.length > 2 ? parts[2] : '0';
    const date = new Date(m.timestamp);
    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    const seconds = parseInt(durationStr, 10);
    let durationText = '';
    if (!isNaN(seconds) && seconds > 0) {
      if (seconds < 60) {
        durationText = `, ${seconds} seconds`;
      } else if (seconds < 3600) {
        durationText = `, ${Math.floor(seconds / 60)} min ${seconds % 60} s`;
      } else {
        durationText = `, ${Math.floor(seconds / 3600)} h ${Math.floor(
          (seconds % 3600) / 60
        )} min`;
      }
    }
    return `${timeStr}${durationText}`;
  }

  public static getCallArrowKind(m: IMessage): 'ArrowTopRight' | 'ArrowBottomLeft' | 'Phone' {
    if (!this.isCallMessage(m)) return 'Phone';
    const parts = m.text.split(':');
    const status = parts.length > 1 ? parts[1] : '';

    if (status === 'CANCELED' || status === 'MISSED') return 'ArrowBottomLeft';
    return m.isMyMessage ? 'ArrowTopRight' : 'ArrowBottomLeft';
  }

  public static getCallArrowColor(m: IMessage): string {
    if (!this.isCallMessage(m)) return '#FFFFFF';
    const parts = m.text.split(':');
    const status = parts.length > 1 ? parts[1] : '';
    return status === 'CANCELED' || status === 'MISSED' ? '#FF595A' : '#B0C4DE';
  }

  private static isImageOrVideo(a: IAttachment): boolean {
    if (a.type === AttachmentType.Photo || a.type === AttachmentType.Video) return true;
    if (!a.fileName) return false;
    const lower = a.fileName.toLowerCase();
    return (
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.mp4') ||
      lower.endsWith('.mov') ||
      lower.endsWith('.avi') ||
      lower.endsWith('.mkv') ||
      lower.endsWith('.gif')
    );
  }

  public static getPreviewMedia(m: IMessage): IAttachment[] {
    return (m.attachments || []).filter(this.isImageOrVideo).slice(0, 4);
  }

  public static getDocuments(m: IMessage): IAttachment[] {
    return (m.attachments || []).filter((a) => !this.isImageOrVideo(a));
  }

  public static isMediaOnly(m: IMessage): boolean {
    const docs = this.getDocuments(m);
    const hasReplies = Boolean(m.repliedMessages && m.repliedMessages.length > 0);
    return (
      (!m.text || m.text.trim().length === 0) &&
      docs.length === 0 &&
      !hasReplies &&
      !this.isForwarded(m)
    );
  }

  public static isAlbum(m: IMessage): boolean {
    return this.getPreviewMedia(m).length > 1;
  }

  public static getPreviewText(m: IMessage): string {
    if (this.isCallMessage(m)) return this.getCallTitle(m);
    if (m.text && m.text.trim().length > 0) return m.text;

    if (m.attachments && m.attachments.length > 0) {
      const type = m.attachments[0].type;
      switch (type) {
        case AttachmentType.Voice:
          return '🎤 Voice message';
        case AttachmentType.Audio:
          return '🎵 Music';
        case AttachmentType.Photo:
          return '📷 Photo';
        case AttachmentType.Video:
          return '🎥 Video';
        default:
          return '📄 Document';
      }
    }
    return 'Message';
  }
}

// =========================================================================
// 3. CHAT LIST ITEM & FOLDERS
// =========================================================================
export interface IChatListItem {
  id: number;
  isSecretChat: boolean;
  secretChatId?: string | null;
  keyFingerprint?: string | null;
  isOnline: boolean;
  isTyping: boolean;
  isChannel: boolean;
  adminId: number;
  memberCount: number;
  onlineCount: number;
  lastMessage?: string | null;
  lastMessageType: LastMessageType;
  rawLastMessage?: string | null;
  lastAttachmentType?: AttachmentType | null;
  lastMessageSenderId?: number | null;
  isLastAttachmentGif: boolean;
  isLastMessageDeletedForMe: boolean;
  lastSeen: string;
  lastMessageTime: string;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  isBlocked: boolean;
  avatarPath?: string | null;
  nickName?: string | null;
  groupName?: string | null;
  groupDescription: string;
  isPublic: boolean;
  groupLink: string;
  groupId?: number | null;
  userId?: number | null;
  username?: string | null;
  folderIds: number[];
}

export class ChatListItemHelper {
  public static isGroup(item: IChatListItem): boolean {
    return Boolean(item.groupId && item.groupId > 0);
  }

  public static getDisplayName(item: IChatListItem): string {
    return (this.isGroup(item) ? item.groupName : item.nickName) || '';
  }

  public static getComputedId(item: IChatListItem): number {
    return this.isGroup(item) ? item.groupId ?? 0 : item.userId ?? 0;
  }
}

export interface IChatFolder {
  id: number;
  name: string;
  isSelected: boolean;
  isDragging: boolean;
  icon?: string | null;
  color?: string | null;
  orderIndex: number;
  isSystem: boolean;
}

export interface ISelectableChat {
  chat: IChatListItem;
  isSelected: boolean;
}

export class SelectableChatHelper {
  public static getDisplayName(item: ISelectableChat): string {
    return ChatListItemHelper.getDisplayName(item.chat);
  }
  public static getSortOrder(item: ISelectableChat): number {
    if (ChatListItemHelper.isGroup(item.chat)) {
      return item.chat.isChannel ? 3 : 2;
    }
    return 1;
  }
}

export interface IChannelPostView {
  id: number;
  messageId: number;
  userId: number;
  viewedAt: string;
}

export interface ISharedMediaGroup {
  title: string;
  items: IAttachment[];
}

export interface ISharedMessageGroup {
  title: string;
  items: IMessage[];
}

// =========================================================================
// 4. USER & AUTH
// =========================================================================
export interface IUser {
  id: number;
  avatarPath?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  nickName: string;
  username: string;
  description?: string | null;
  phone?: string | null;
  email: string;
  password?: string;
  gender?: Gender | null;
  birthday?: string | null;
  registrationDate: string;
  avatar?: string | null; // Base64
  token?: string | null;
  isOnline: boolean;
  lastSeen: string;
}

export class UserValidator {
  public static validate(user: Partial<IUser>): Record<string, string> {
    const errors: Record<string, string> = {};

    if (user.firstName && !/^[\p{L}\p{M}\s\-]*$/u.test(user.firstName)) {
      errors.firstName = 'First name must contain only letters';
    }

    if (user.lastName && !/^[\p{L}\p{M}\s\-]*$/u.test(user.lastName)) {
      errors.lastName = 'Last name must contain only letters';
    }

    if (!user.nickName || user.nickName.trim().length === 0) {
      errors.nickName = 'Nickname is required';
    } else if (user.nickName.length > 24) {
      errors.nickName = 'Nickname must be no more than 24 characters';
    }

    if (!user.username || user.username.trim().length === 0) {
      errors.username = 'Username is required';
    } else if (user.username.length < 3) {
      errors.username = 'Username must be at least 3 characters long';
    } else if (user.username.length > 16) {
      errors.username = 'Username must be no more than 16 characters';
    } else if (!/^(?=.*[a-zA-Z_])[a-zA-Z0-9_]*$/.test(user.username)) {
      errors.username = "Username must contain at least one letter or '_' and use only English letters/digits";
    }

    if (user.description && user.description.length > 160) {
      errors.description = 'Description must be no more than 160 characters';
    }

    if (user.phone && !/^(\+\d{9,14})?$/.test(user.phone)) {
      errors.phone = "Phone must start with '+' and be 10-15 digits long";
    }

    if (!user.email || user.email.trim().length === 0) {
      errors.email = 'Email is required';
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user.email)) {
      errors.email = 'Invalid email format (e.g., user@mail.com)';
    }

    if (user.password !== undefined) {
      if (user.password.length < 8) {
        errors.password = 'Password must be at least 8 characters long';
      } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/.test(user.password)) {
        errors.password = 'Must contain a digit, lowercase, uppercase letter';
      }
    }

    if (user.birthday) {
      const bdate = new Date(user.birthday);
      if (bdate > new Date()) {
        errors.birthday = 'Birthday cannot be in the future';
      } else if (bdate < new Date(1900, 0, 1)) {
        errors.birthday = 'Date is too old';
      }
    }

    return errors;
  }
}

export interface IUserSearchResult {
  id: number;
  username?: string | null;
  nickName: string;
  avatar?: string | null;
  avatarPath?: string | null;
  isOnline: boolean;
  lastSeen: string;
  isGroup: boolean;
  memberCount: number;
  onlineCount: number;
  isTyping: boolean;
  isChannel: boolean;
  adminId: number;
  isSecretChat: boolean;
  secretChatId?: string | null;
  keyFingerprint?: string | null;
}

// =========================================================================
// 5. STORIES
// =========================================================================
export interface IStory {
  id: number;
  userId: number;
  imagePath: string;
  description?: string | null;
  isPrivate: boolean;
  createdAt: string;
  viewsCount: number;
  likesCount: number;
  dislikesCount: number;
  commentsCount: number;
  hasViewed: boolean;
  myReaction?: number | null; // 0 = Like, 1 = Dislike, null = No reaction
  authorAvatar?: string | null;
  authorName: string;
}

export class StoryHelper {
  public static getTotalReactions(story: IStory): number {
    return story.likesCount + story.dislikesCount;
  }

  public static getLikePercentage(story: IStory): number {
    const total = this.getTotalReactions(story);
    return total > 0 ? Math.round((story.likesCount / total) * 100) : 0;
  }

  public static getDislikePercentage(story: IStory): number {
    const total = this.getTotalReactions(story);
    return total > 0 ? Math.round((story.dislikesCount / total) * 100) : 0;
  }

  public static hasReactions(story: IStory): boolean {
    return this.getTotalReactions(story) > 0;
  }
}

export interface IStoryComment {
  id: number;
  storyId: number;
  userId: number;
  userName: string;
  userAvatar?: string | null;
  text: string;
  createdAt: string;
  parentCommentId?: number | null;
  parentUserName?: string | null;
  likesCount: number;
  dislikesCount: number;
  myReaction?: number | null;
  replies: IStoryComment[];
  isRepliesExpanded: boolean;
  hasReplies: boolean;
  repliesCount: number;
}

export interface IStoryProgressItem {
  isActive: boolean;
  isPassed: boolean;
}

export interface IUserStoryGroup {
  userId: number;
  authorName: string;
  authorAvatar?: any;
  stories: IStory[];
}

// =========================================================================
// 6. GAMES
// =========================================================================
export interface IBoardCell {
  index: number;
  content: string;
  cellType: string;
  isSelected: boolean;
  isPossibleMove: boolean;
  isPossibleCapture: boolean;
}

export class BoardCellHelper {
  public static isTicTacToe(cell: IBoardCell): boolean {
    return cell.cellType === 'TicTacToe';
  }
  public static isCheckers(cell: IBoardCell): boolean {
    return cell.cellType === 'CheckersLight' || cell.cellType === 'CheckersDark';
  }
  public static isChess(cell: IBoardCell): boolean {
    return cell.cellType === 'ChessLight' || cell.cellType === 'ChessDark';
  }
  public static isWhiteChessPiece(cell: IBoardCell): boolean {
    return Boolean(cell.content && cell.content.startsWith('w'));
  }
  public static isBlackChessPiece(cell: IBoardCell): boolean {
    return Boolean(cell.content && cell.content.startsWith('b'));
  }

  public static getChessUnicode(content: string): string {
    switch (content) {
      case 'wK': return '♚';
      case 'wQ': return '♛';
      case 'wR': return '♜';
      case 'wB': return '♝';
      case 'wN': return '♞';
      case 'wP': return '♟';
      case 'bK': return '♚';
      case 'bQ': return '♛';
      case 'bR': return '♜';
      case 'bB': return '♝';
      case 'bN': return '♞';
      case 'bP': return '♟';
      default: return '';
    }
  }

  public static isX(c: IBoardCell) { return c.content === 'X'; }
  public static isO(c: IBoardCell) { return c.content === 'O'; }
  public static isRedPiece(c: IBoardCell) { return c.content === 'W' || c.content === 'WK'; }
  public static isBluePiece(c: IBoardCell) { return c.content === 'B' || c.content === 'BK'; }
  public static isKing(c: IBoardCell) { return c.content === 'WK' || c.content === 'BK'; }
  public static isShip(c: IBoardCell) { return c.content === 'S'; }
  public static isHit(c: IBoardCell) { return c.content === 'H'; }
  public static isDestroyed(c: IBoardCell) { return c.content === 'D'; }
  public static isMiss(c: IBoardCell) { return c.content === 'M'; }
}

export interface IGameItem {
  name: string;
  iconKind: string;
  internalId: string;
}

// =========================================================================
// 7. CACHE & REPOSITORY MODELS (SQLITE REPLACEMENT)
// =========================================================================
export interface ICachedBlockStatus {
  targetUserId: number;
  blockedByMe: boolean;
  blockedByThem: boolean;
}

export interface ICachedGroupDetail {
  id: number;
  description: string;
  isPublic: boolean;
  groupLink: string;
  canSendText: boolean;
  canSendMedia: boolean;
  canPinMessages: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  adminId: number;
}

export interface ICachedSecretChat {
  secretChatId: string;
  targetUserId: number;
  targetName: string;
  targetAvatar?: string | null;
  sharedKey?: string | null; // Base64
  localPrivateKeyBase64?: string | null;
  keyFingerprint: string;
  emojiFingerprint: string;
  isEstablished: boolean;
  lastMessage: string;
  lastMessageTime: string;
  createdAt: string;
}

export interface ISyncState {
  key: string;
  value: string;
}

// =========================================================================
// 8. TODO & NOTES
// =========================================================================
export interface ISelectableItem {
  text: string;
  isSelected: boolean;
  category: TaskCategory;
  priority: TaskPriority;
}

export interface ITodoTask {
  localId?: number;
  serverId: number;
  localListId: number;
  title: string;
  description: string;
  isCompleted: boolean;
  isImportant: boolean;
  dueDate?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  category: TaskCategory;
  isSynced: boolean;
  isEditing?: boolean;
}

export interface ITodoList {
  localId?: number;
  serverId: number;
  listName: string;
  iconKind: string;
  iconColor: string;
  uncompletedCount: number;
  priority: TaskPriority;
  status: TaskStatus;
  isSelected?: boolean;
  isEditing?: boolean;
  tasks?: ITodoTask[];
  isSynced: boolean;
  urgencyLevel: number;
  urgencyColor: string;
  editingName?: string;
}

export interface INote {
  id?: number;
  userId: number;
  title: string;
  iconKind: string;
  iconColor: string;
  editingName?: string;
  statusColor?: string;
  groupId?: number | null;
  thumbnail?: string | null;
  inkData?: string | null; // Base64 or stroke SVG points
  lastEditedTime: string;
  isEditing?: boolean;
  isSelected?: boolean;
}

// =========================================================================
// 9. MEDIA, GIFS & AUDIO
// =========================================================================
export interface ISavedGif {
  id?: number;
  serverId: number;
  url: string;
  thumbnailUrl?: string | null;
  width: number;
  height: number;
  savedAt: string;
}

export class SavedGifHelper {
  public static getDisplayWidth(gif: ISavedGif): number {
    if (gif.width > 0 && gif.height > 0) {
      const calculated = 95.0 * (gif.width / gif.height);
      return Math.min(Math.max(calculated, 65.0), 210.0);
    }
    return 110.0;
  }
}

export interface IAudioTrackModel {
  attachment: IAttachment;
  messageId: number;
  chatId: number;
  chatName: string;
  chatAvatar?: any;
  isGroup: boolean;
  isChannel: boolean;
  title: string;
  artist: string;
  durationStr: string;
  durationSeconds: number;
  coverArt?: string | null;
  isPlaying: boolean;
}

export interface IGroupMember {
  id: number;
  username: string;
  name: string;
  avatar?: string | null;
  isOnline: boolean;
  status: string;
  hasRole: boolean;
  roleName: string;
  roleColor: string;
  isCurrentUser: boolean;
  isBanned: boolean;
}

export interface IColorItem {
  name: string;
  hex: string;
}

export interface IAppSettings {
  jwtToken: string;
  lastUsername: string;
  selectedMicrophone: string;
  selectedSpeaker: string;
  selectedCamera: string;
}

export interface IApiSettings {
  serverUrl: string;
}