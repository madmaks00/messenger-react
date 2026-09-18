import { AttachmentType, PrivacyVisibility } from './enums';

// --- CHATS & MESSAGES DTOS ---

export interface AttachmentDto {
  type: AttachmentType | number;
  fileName: string;
  fileSizeStr: string;
  url: string;
  thumbnailUrl?: string | null;
  fileHash?: string | null;
  hasAudio: boolean;
  width: number;
  height: number;
  waveform?: string | null;
  durationSeconds: number;
}

export interface ChatFolderCreateDto {
  name: string;
  color: string;
  icon: string;
}

export interface ChatFolderOrderDto {
  folderId: number;
  orderIndex: number;
}

export interface UploadChunkRequestDto {
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  totalFileSize: number;
  fileHash: string;
  fileName: string;
}

export interface ChunkUploadStatusDto {
  uploadId: string;
  isCompleted: boolean;
  uploadedChunks: number[];
  totalChunks: number;
  attachment?: AttachmentDto | null;
}

export interface MessageReceivedDto {
  serverId: number;
  senderId: number;
  receiverId?: number | null;
  groupId?: number | null;
  noteId?: number | null;
  text: string;
  replyToMessageIds?: string | null;
  forwardedFromName?: string | null;
  forwardedFromAvatar?: string | null;
  forwardedFromUserId?: number | null;
  attachments: AttachmentDto[];
}

export interface CachedGroupDetailDto {
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

export interface CachedBlockStatusDto {
  targetUserId: number;
  blockedByMe: boolean;
  blockedByThem: boolean;
}

export interface MetadataDeltaDto {
  changedGroups: CachedGroupDetailDto[];
  changedBlocks: CachedBlockStatusDto[];
  serverTimestamp: string;
}

export interface ResolvedEntityResult {
  type: 'User' | 'Group' | 'Channel' | string;
  id: number;
  username?: string | null;
  nickName?: string | null;
  avatar?: string | null; // Base64 data URL
  isGroup: boolean;
  isChannel: boolean;
  adminId: number;
}

export interface SecretMessagePayloadDto {
  text: string;
  replyText?: string | null;
  replySender?: string | null;
  attachments?: AttachmentDto[] | null;
}

// --- GAMES DTOS ---

export interface GameChatMessageDto {
  senderId: number;
  senderName: string;
  text: string;
  time: string;
  isSystem: boolean;
  isMine: boolean;
}

export interface GamePlayerDto {
  userId: number;
  nickName: string;
  symbol: string;
  score: number;
}

export interface GameRoomDto {
  roomId: string;
  gameType: string;
  hostUserId: number;
  isPlaying: boolean;
  players: GamePlayerDto[];
  board?: string[] | null;
  currentTurnUserId: number;
  whiteKingMoved: boolean;
  blackKingMoved: boolean;
  whiteRookA1Moved: boolean;
  whiteRookH1Moved: boolean;
  blackRookA8Moved: boolean;
  blackRookH8Moved: boolean;
  enPassantTarget?: number | null;
  isSetupPhase: boolean;
  player1Ready: boolean;
  player2Ready: boolean;
  drawPhase: number; // 0:Lobby, 1:Voting, 2:Drawing, 3:Rating, 4:Results
  proposedWords?: string[] | null;
  selectedWord?: string | null;
  phaseEndTimeUnix: number;
  currentDrawingUserId: number;
  currentDrawingBase64?: string | null;
  playerScores: Record<number, number>;
  roundScores: Record<number, number>;
}

// --- GROUPS DTOS ---

export interface GroupCallParticipantDto {
  userId: number;
  username: string;
  avatar?: string | null;
}

export interface GroupCreateResultDto {
  id: number;
  groupLink: string;
}

export interface GroupCreationDto {
  name: string;
  avatar?: string | null;
  memberIds: number[];
  isChannel: boolean;
  description: string;
  isPublic: boolean;
  groupLink: string;
}

export interface GroupDetailsDto {
  id: number;
  name: string;
  description: string;
  avatar?: string | null;
  isPublic: boolean;
  groupLink: string;
  canSendText: boolean;
  canSendMedia: boolean;
  canPinMessages: boolean;
  adminId: number;
  isOwner: boolean;
  isAdmin: boolean;
  isLinkActive: boolean;
  inviteLinkExpiration?: string | null;
}

export interface GroupJoinResultDto {
  groupId: number;
  groupName: string;
}

export interface GroupPreviewDto {
  id: number;
  name: string;
  description: string;
  avatar?: string | null;
  isChannel: boolean;
  memberCount: number;
  onlineCount: number;
}

export interface GroupUpdateDto {
  name: string;
  description: string;
  avatar?: string | null;
  isPublic: boolean;
  groupLink: string;
  canSendText: boolean;
  canSendMedia: boolean;
  canPinMessages: boolean;
}

export interface MemberPermissionsDto {
  isAdmin: boolean;
  canSendText: boolean;
  canSendMedia: boolean;
  canPinMessages: boolean;
}

export interface ResolvedEntityPayloadDto {
  id: number;
  username?: string | null;
  nickName?: string | null;
  avatar?: string | null;
  isGroup: boolean;
  isChannel: boolean;
  adminId: number;
  description?: string | null;
  isOnline: boolean;
  lastSeen: string;
}

export interface ResolvedEntityResponseDto {
  type: string;
  data: ResolvedEntityPayloadDto;
}

// --- AI DTOS ---

export interface AiParseTaskResultDto {
  title: string;
  dueDate?: string | null;
  category: string;
  priority: string;
}

export interface AiSubtaskDto {
  title: string;
  category: string;
  priority: string;
}

// --- AUTH & USER DTOS ---

export interface DeviceSessionDto {
  id: number;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  location: string;
  createdAt: string;
  lastActive: string;
  isPrimary: boolean;
  isCurrent: boolean;
}

export interface PrivacySettingsDto {
  fullNameVisibility: PrivacyVisibility;
  genderVisibility: PrivacyVisibility;
  descriptionVisibility: PrivacyVisibility;
  lastSeenVisibility: PrivacyVisibility;
  avatarVisibility: PrivacyVisibility;
  emailVisibility: PrivacyVisibility;
  phoneVisibility: PrivacyVisibility;
  birthdayVisibility: PrivacyVisibility;
}

export interface LoginResponse {
  token: string;
  id: number;
  username: string;
}

export interface AuthResponseDto {
  token?: string | null;
  user?: any | null; // типизируется моделью User
}

export interface AuthResult {
  isSuccess: boolean;
  message?: string | null;
  user?: any | null;
  token?: string | null;
}

// --- SECURITY DTOS ---

export interface SessionStateDto {
  secretChatId: string;
  targetUserId: number;
  sharedKeyBase64: string;
  sendChainBase64: string;
  recvChainBase64: string;
  sendSeq: number;
  recvSeq: number;
  keyFingerprint: string;
  emojiFingerprint: string;
}