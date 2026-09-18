import { IMessage, IAttachment } from './models';

export interface IMessageLayoutModel {
  id: number;
  serverId: number;
  senderId: number;
  senderName: string;
  senderAvatar: string | null;
  text: string;
  timestamp: string;
  isMyMessage: boolean;
  isGroupMessage: boolean;
  isChannel: boolean;
  isRead: boolean;
  isSentToServer: boolean;
  isEdited: boolean;
  isPinned: boolean;
  isDeletedForMe: boolean;
  isSelected: boolean;
  isForwarded: boolean;
  forwardedFromUserId: number;
  forwardedFromName: string;
  forwardedFromAvatar: string | null;
  viewsCount: number;

  // Вложения по категориям
  repliedMessages: any[];
  previewMedia: IAttachment[];
  documents: IAttachment[];
  audios: IAttachment[];
  voices: IAttachment[];

  isAlbum: boolean;
  mediaCount: number;
  isCallMessage: boolean;
  callTitle: string;
  callArrowKind: string;
  callArrowColor: string;
  callTimeAndDuration: string;
  isMediaOnly: boolean;
  hasAudio: boolean;
  isSilentVideo: boolean;

  // Геометрические расчеты лейаута
  yOffset: number;
  totalHeight: number;
  mediaWidth: number;
  mediaHeight: number;

  sourceMessage: IMessage;
}