import { create } from 'zustand';
import { signalRService } from '../services/signalr.service';
import { eventBus } from '../services/eventBus';
import { IUserSearchResult } from '../types/models';

export interface GroupCallParticipant {
  userId: number;
  userName: string;
  avatar?: string | null;
}

interface CallsState {
  currentCallUserId: number;
  currentCallUserName: string;
  currentCallUserAvatar: string | null;
  isIncomingCallVisible: boolean;
  isOutgoingCallVisible: boolean;
  isActiveCallVisible: boolean;
  isGroupCall: boolean;
  currentGroupId: number;
  callDurationText: string;
  activeParticipants: GroupCallParticipant[];

  // Команды
  startCall: (targetUser: IUserSearchResult) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
}

let callTimer: ReturnType<typeof setInterval> | null = null;
let callStartTime: number = 0;
let isCaller = false;
let wasAnswered = false;
let callLogSent = false;

export const useCallsStore = create<CallsState>((set, get) => ({
  currentCallUserId: 0,
  currentCallUserName: '',
  currentCallUserAvatar: null,
  isIncomingCallVisible: false,
  isOutgoingCallVisible: false,
  isActiveCallVisible: false,
  isGroupCall: false,
  currentGroupId: 0,
  callDurationText: '00:00',
  activeParticipants: [],

  startCall: async (targetUser) => {
    if (!targetUser) return;

    isCaller = true;
    wasAnswered = targetUser.isGroup;
    callLogSent = false;

    if (targetUser.isGroup) {
      set({
        isGroupCall: true,
        currentGroupId: targetUser.id,
        currentCallUserName: `Вызов группы ${targetUser.nickName}`,
        currentCallUserAvatar: targetUser.avatarPath || null,
        isIncomingCallVisible: false,
        isOutgoingCallVisible: false,
        isActiveCallVisible: true,
        activeParticipants: [],
      });
      startTimer(set);
      await signalRService.startGroupCallAsync(targetUser.id);
    } else {
      set({
        isGroupCall: false,
        currentCallUserId: targetUser.id,
        currentCallUserName: targetUser.nickName,
        currentCallUserAvatar: targetUser.avatarPath || null,
        isIncomingCallVisible: false,
        isActiveCallVisible: false,
        isOutgoingCallVisible: true,
      });
      await signalRService.startCallAsync(targetUser.id);
    }
  },

  acceptCall: async () => {
    wasAnswered = true;
    const { isGroupCall, currentGroupId, currentCallUserId } = get();

    set({ isIncomingCallVisible: false, isActiveCallVisible: true });
    startTimer(set);

    if (isGroupCall) {
      await signalRService.joinGroupCallAsync(currentGroupId);
    } else {
      await signalRService.answerCallAsync(currentCallUserId, true);
    }
  },

  rejectCall: async () => {
    const { isGroupCall, currentGroupId, currentCallUserId } = get();
    sendCallLog(get());

    stopTimer(set);
    set({ isIncomingCallVisible: false });

    if (isGroupCall) {
      await signalRService.leaveGroupCallAsync(currentGroupId);
    } else {
      await signalRService.answerCallAsync(currentCallUserId, false);
    }
  },

  endCall: async () => {
    const { isGroupCall, currentGroupId, currentCallUserId } = get();
    sendCallLog(get());

    stopTimer(set);
    set({
      isIncomingCallVisible: false,
      isOutgoingCallVisible: false,
      isActiveCallVisible: false,
      currentCallUserAvatar: null,
      activeParticipants: [],
    });

    if (isGroupCall) {
      await signalRService.leaveGroupCallAsync(currentGroupId);
    } else if (currentCallUserId !== 0) {
      await signalRService.endCallAsync(currentCallUserId);
    }
  },
}));

function startTimer(set: any) {
  stopTimer(set);
  callStartTime = Date.now();
  set({ callDurationText: '00:00' });

  callTimer = setInterval(() => {
    const totalSec = Math.floor((Date.now() - callStartTime) / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    const formatted = hrs >= 1
      ? `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    set({ callDurationText: formatted });
  }, 1000);
}

function stopTimer(set: any) {
  if (callTimer) {
    clearInterval(callTimer);
    callTimer = null;
  }
  set({ callDurationText: '00:00' });
}

function sendCallLog(state: CallsState) {
  if (!isCaller || callLogSent || state.currentCallUserId === 0 || state.isGroupCall) return;
  callLogSent = true;

  let totalSeconds = 0;
  if (wasAnswered && callStartTime > 0) {
    totalSeconds = Math.max(0, Math.floor((Date.now() - callStartTime) / 1000));
  }

  const status = !wasAnswered ? 'CANCELED' : 'SUCCESS';
  const messageText = `CALL:${status}:${totalSeconds}`;

  signalRService.sendMessageAsync(state.currentCallUserId, null, null, messageText);
}

// 🟢 Регистрация обработчиков сообщений из WPF RegisterCallHandlers()
eventBus.on('IncomingCallMessage', ({ callerId, callerName, callerAvatar }) => {
  useCallsStore.setState({
    isGroupCall: false,
    currentCallUserId: callerId,
    currentCallUserName: callerName,
    currentCallUserAvatar: callerAvatar || null,
    isIncomingCallVisible: true,
  });
});

eventBus.on('IncomingGroupCallMessage', ({ groupId, groupName, callerAvatar }) => {
  useCallsStore.setState({
    isGroupCall: true,
    currentGroupId: groupId,
    currentCallUserName: `Группа: ${groupName}`,
    currentCallUserAvatar: callerAvatar || null,
    isIncomingCallVisible: true,
    activeParticipants: [],
  });
});

eventBus.on('CallResponseMessage', ({ accepted }) => {
  if (accepted) {
    wasAnswered = true;
    useCallsStore.setState({ isOutgoingCallVisible: false, isActiveCallVisible: true });
    startTimer(useCallsStore.setState);
  } else {
    sendCallLog(useCallsStore.getState());
    stopTimer(useCallsStore.setState);
    useCallsStore.setState({ isOutgoingCallVisible: false });
  }
});

eventBus.on('CallEndedMessage', () => {
  if (useCallsStore.getState().isGroupCall) return;
  sendCallLog(useCallsStore.getState());
  stopTimer(useCallsStore.setState);
  useCallsStore.setState({
    isIncomingCallVisible: false,
    isOutgoingCallVisible: false,
    isActiveCallVisible: false,
    currentCallUserAvatar: null,
  });
});

eventBus.on('GroupCallJoinedMessage', ({ participants }) => {
  useCallsStore.setState({
    isOutgoingCallVisible: false,
    isActiveCallVisible: true,
    activeParticipants: participants || [],
  });
  startTimer(useCallsStore.setState);
});

eventBus.on('UserJoinedGroupCallMessage', ({ participant }) => {
  const current = useCallsStore.getState().activeParticipants;
  if (!current.some((p) => p.userId === participant.userId)) {
    useCallsStore.setState({ activeParticipants: [...current, participant] });
  }
});

eventBus.on('UserLeftGroupCallMessage', ({ userId }) => {
  const current = useCallsStore.getState().activeParticipants;
  useCallsStore.setState({ activeParticipants: current.filter((p) => p.userId !== userId) });
});