import { create } from 'zustand';
import { signalRService } from '../services/signalr.service';
import { eventBus } from '../services/eventBus';
import { webRtcCallService } from '../services/webRtcCallService';
import { IUserSearchResult } from '../types/models';

export interface GroupCallParticipant {
  userId: number;
  username: string;
  avatarPath?: string | null;
}

export type WindowVisualState = 'normal' | 'maximized' | 'minimized';

interface CallsState {
  // Наблюдаемые свойства (UI State из CallsViewModel.cs)
  currentCallUserId: number;
  isIncomingCallVisible: boolean;
  isOutgoingCallVisible: boolean;
  isActiveCallVisible: boolean;
  currentCallUserName: string;
  callDurationText: string;
  currentCallUserAvatar: string | null;
  activeParticipants: GroupCallParticipant[];

  // Управление окном (аналог CallWindow.xaml.cs & IWindowService)
  isWindowOpen: boolean;
  windowState: WindowVisualState;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;

  // Внутреннее состояние
  isGroupCall: boolean;
  currentGroupId: number;

  // Команды
  startCall: (targetUser: IUserSearchResult | null) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  showCallWindow: () => void;
  closeCallWindow: () => void;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  restoreWindow: () => void;
}

let callTimer: ReturnType<typeof setInterval> | null = null;
let callStartTime: number = 0;
let isCaller: boolean = false;
let wasAnswered: boolean = false;
let callLogSent: boolean = false;

// 🟢 Привязка обработчика отправки сигналинга из C# CallsViewModel
webRtcCallService.sendSignalingData = (targetUserId: number, data: string) => {
  const { isGroupCall, currentGroupId, currentCallUserId } = useCallsStore.getState();
  if (isGroupCall) {
    signalRService.sendGroupCallWebRTCDataAsync(currentGroupId, targetUserId, data).catch((ex) => {
      console.error('[CallsStore ERROR] Ошибка отправки сигналинга Group WebRTC:', ex);
    });
  } else if (currentCallUserId !== 0) {
    signalRService.sendWebRTCDataAsync(currentCallUserId, data).catch((ex) => {
      console.error('[CallsStore ERROR] Ошибка отправки сигналинга WebRTC:', ex);
    });
  }
};

export const useCallsStore = create<CallsState>((set, get) => ({
  currentCallUserId: 0,
  isIncomingCallVisible: false,
  isOutgoingCallVisible: false,
  isActiveCallVisible: false,
  currentCallUserName: '',
  callDurationText: '00:00',
  currentCallUserAvatar: null,
  activeParticipants: [],

  isWindowOpen: false,
  windowState: 'normal',
  isMuted: false,
  isVideoOn: false,
  isScreenSharing: false,

  isGroupCall: false,
  currentGroupId: 0,

  showCallWindow: () => {
    set({ isWindowOpen: true, windowState: 'normal' });
  },

  closeCallWindow: () => {
    set({ isWindowOpen: false, windowState: 'normal' });
  },

  minimizeWindow: () => {
    set({ windowState: 'minimized' });
  },

  maximizeWindow: () => {
    set({ windowState: 'maximized' });
  },

  restoreWindow: () => {
    set({ windowState: 'normal' });
  },

  toggleMute: () => {
    const next = !get().isMuted;
    webRtcCallService.setMute(next);
    set({ isMuted: next });
  },

  toggleVideo: () => {
    set((state) => ({ isVideoOn: !state.isVideoOn }));
  },

  toggleScreenShare: () => {
    set((state) => ({ isScreenSharing: !state.isScreenSharing }));
  },

  startCall: async (targetUser: IUserSearchResult | null) => {
    if (!targetUser) return;

    const isGroup = Boolean(targetUser.isGroup);
    isCaller = true;
    wasAnswered = isGroup;
    callLogSent = false;

    set({
      activeParticipants: [],
      isGroupCall: isGroup,
      isMuted: false,
      isVideoOn: false,
      isScreenSharing: false,
    });

    webRtcCallService.setCallContext(isGroup, targetUser.id, targetUser.id);

    if (isGroup) {
      set({
        currentGroupId: targetUser.id,
        currentCallUserName: `Вызов группы ${targetUser.nickName || 'Group'}`,
        currentCallUserAvatar: targetUser.avatarPath || targetUser.avatar || null,
        isIncomingCallVisible: false,
        isOutgoingCallVisible: false,
        isActiveCallVisible: true,
      });

      get().showCallWindow();
      startTimer(set);

      try {
        await webRtcCallService.initializeLocalCapture();
        await signalRService.startGroupCallAsync(targetUser.id);
      } catch (ex) {
        console.error('[CallsStore ERROR] Ошибка запуска группового звонка GroupId=', targetUser.id, ex);
      }
    } else {
      set({
        currentCallUserId: targetUser.id,
        currentCallUserName: targetUser.nickName || 'User',
        currentCallUserAvatar: targetUser.avatarPath || targetUser.avatar || null,
        isIncomingCallVisible: false,
        isActiveCallVisible: false,
        isOutgoingCallVisible: true,
      });

      get().showCallWindow();

      try {
        await signalRService.startCallAsync(targetUser.id);
      } catch (ex) {
        console.error('[CallsStore ERROR] Ошибка отправки личного звонка UserId=', targetUser.id, ex);
      }
    }
  },

  acceptCall: async () => {
    wasAnswered = true;
    const { isGroupCall, currentGroupId, currentCallUserId } = get();

    set({
      isIncomingCallVisible: false,
      isActiveCallVisible: true,
    });

    try {
      if (isGroupCall) {
        get().showCallWindow();
        await signalRService.joinGroupCallAsync(currentGroupId);
      } else {
        await signalRService.answerCallAsync(currentCallUserId, true);
        await webRtcCallService.initializeWebRTCAsync();
      }
    } catch (ex) {
      console.error('[CallsStore ERROR] Сбой при принятии звонка:', ex);
    }
  },

  rejectCall: async () => {
    const { isGroupCall, currentGroupId, currentCallUserId } = get();
    await sendCallLogAsync(get());

    set({ isIncomingCallVisible: false });
    stopTimer(set);
    get().closeCallWindow();

    try {
      if (isGroupCall) {
        await signalRService.leaveGroupCallAsync(currentGroupId);
      } else {
        await signalRService.answerCallAsync(currentCallUserId, false);
      }
      await webRtcCallService.cleanup();
    } catch (ex) {
      console.error('[CallsStore ERROR] Ошибка отклонения звонка:', ex);
    }
  },

  endCall: async () => {
    const { isGroupCall, currentGroupId, currentCallUserId } = get();

    try {
      await sendCallLogAsync(get());

      set({
        isIncomingCallVisible: false,
        isOutgoingCallVisible: false,
        isActiveCallVisible: false,
        currentCallUserAvatar: null,
      });

      stopTimer(set);
      get().closeCallWindow();

      if (isGroupCall) {
        await signalRService.leaveGroupCallAsync(currentGroupId);
      } else if (currentCallUserId !== 0) {
        await signalRService.endCallAsync(currentCallUserId);
      }
      await webRtcCallService.cleanup();
    } catch (ex) {
      console.error('[CallsStore ERROR] Ошибка при завершении звонка:', ex);
    }
  },
}));

// ================= ТАЙМЕР ЗВОНКА (1 в 1 с CallTimer_Tick) =================
function startTimer(set: any) {
  stopTimer(set);
  callStartTime = Date.now();
  set({ callDurationText: '00:00' });

  callTimer = setInterval(() => {
    const elapsedSeconds = Math.floor((Date.now() - callStartTime) / 1000);
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;

    const formatted =
      hours >= 1
        ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

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

// ================= ОТПРАВКА СИСТЕМНОГО ЛОГА (1 в 1 с SendCallLogAsync) =================
async function sendCallLogAsync(state: CallsState): Promise<void> {
  if (!isCaller || callLogSent || state.currentCallUserId === 0 || state.isGroupCall) return;
  callLogSent = true;

  let totalSeconds = 0;
  if (wasAnswered && callStartTime > 0) {
    totalSeconds = Math.max(0, Math.floor((Date.now() - callStartTime) / 1000));
  }

  const status = !wasAnswered ? 'CANCELED' : 'SUCCESS';
  // В WPF: Message.CallSecretPrefix = "CALL:"
  const messageText = `CALL:${status}:${totalSeconds}`;

  try {
    await signalRService.sendMessageAsync(state.currentCallUserId, null, null, messageText);
  } catch (ex) {
    console.error('[CallsStore] Ошибка отправки лога звонка:', ex);
  }
}

// ================= РЕГИСТРАЦИЯ ХЭНДЛЕРОВ MESSENGER (RegisterCallHandlers) =================
eventBus.on('SyncTimerMessage' as any, () => {
  startTimer(useCallsStore.setState);
});

eventBus.on('StartCallRequestMessage' as any, (data: any) => {
  if (data?.targetUser || data?.user) {
    useCallsStore.getState().startCall(data.targetUser || data.user);
  }
});

eventBus.on('IncomingCallMessage' as any, (data: { callerId: number; callerName: string; callerAvatar: string | null }) => {
  console.info(`[CallsStore] Входящий личный звонок от CallerId=${data.callerId}, Name='${data.callerName}'`);
  webRtcCallService.setCallContext(false, 0, data.callerId);

  useCallsStore.setState({
    isGroupCall: false,
    currentCallUserId: data.callerId,
    currentCallUserName: data.callerName,
    currentCallUserAvatar: data.callerAvatar || null,
    isIncomingCallVisible: true,
    isOutgoingCallVisible: false,
    isActiveCallVisible: false,
  });
  useCallsStore.getState().showCallWindow();
});

eventBus.on('IncomingGroupCallMessage' as any, (data: { groupId: number; groupName: string; callerId: number; callerName: string; callerAvatar: string | null }) => {
  console.info(`[CallsStore] Входящий групповой звонок для GroupId=${data.groupId}, Name='${data.groupName}'`);
  webRtcCallService.setCallContext(true, data.groupId, 0);

  useCallsStore.setState({
    isGroupCall: true,
    currentGroupId: data.groupId,
    currentCallUserName: `Группа: ${data.groupName}`,
    currentCallUserAvatar: data.callerAvatar || null,
    isIncomingCallVisible: true,
    isOutgoingCallVisible: false,
    isActiveCallVisible: false,
    activeParticipants: [],
  });
  useCallsStore.getState().showCallWindow();
});

eventBus.on('CallResponseMessage' as any, async (data: { receiverId?: number; accepted: boolean }) => {
  console.info(`[CallsStore] Ответ на исходящий звонок: Accepted=${data.accepted}`);

  if (data.accepted) {
    wasAnswered = true;
    useCallsStore.setState({
      isOutgoingCallVisible: false,
      isActiveCallVisible: true,
    });
    try {
      await webRtcCallService.startCallAsync();
    } catch (ex) {
      console.error('[CallsStore ERROR] Сбой старта локального WebRTC звонка:', ex);
    }
  } else {
    await sendCallLogAsync(useCallsStore.getState());
    useCallsStore.setState({ isOutgoingCallVisible: false });
    stopTimer(useCallsStore.setState);
    useCallsStore.getState().closeCallWindow();

    try {
      await webRtcCallService.cleanup();
    } catch (ex) {
      console.error('[CallsStore ERROR] Ошибка очистки WebRTC при отклонении вызова:', ex);
    }
  }
});

eventBus.on('WebRTCDataMessage' as any, async (data: { senderId: number; data: string }) => {
  const state = useCallsStore.getState();
  if (state.isOutgoingCallVisible) {
    useCallsStore.setState({
      isOutgoingCallVisible: false,
      isActiveCallVisible: true,
    });
  }

  try {
    await webRtcCallService.processSignalingData(data.data);
  } catch (ex) {
    console.error('[CallsStore ERROR] Ошибка обработки WebRTC данных:', ex);
  }
});

eventBus.on('GroupCallWebRTCDataMessage' as any, async (data: { groupId: number; senderId: number; data: string }) => {
  try {
    await webRtcCallService.processSignalingDataFromPeer(data.senderId, data.data);
  } catch (ex) {
    console.error('[CallsStore ERROR] Ошибка обработки WebRTC данных пира SenderId=', data.senderId, ex);
  }
});

eventBus.on('GroupCallJoinedMessage' as any, async (data: { groupId: number; participants: any[] }) => {
  console.info('[CallsStore] Успешное присоединение к групповому звонку. Найдено пиров:', data.participants?.length ?? 0);

  const mappedParticipants: GroupCallParticipant[] = (data.participants || []).map((p: any) => ({
    userId: Number(p.userId ?? p.UserId),
    username: String(p.username ?? p.Username ?? 'User'),
    avatarPath: p.avatarPath ?? p.AvatarPath ?? null,
  }));

  useCallsStore.setState({
    isOutgoingCallVisible: false,
    isActiveCallVisible: true,
    activeParticipants: mappedParticipants,
  });
  startTimer(useCallsStore.setState);

  for (const p of mappedParticipants) {
    try {
      await webRtcCallService.startCallWithPeerAsync(p.userId);
    } catch (ex) {
      console.error('[CallsStore ERROR] Ошибка подключения к пиру UserId=', p.userId, ex);
    }
  }
});

eventBus.on('UserJoinedGroupCallMessage' as any, (data: { groupId: number; participant: any }) => {
  const pRaw = data.participant;
  const p: GroupCallParticipant = {
    userId: Number(pRaw.userId ?? pRaw.UserId),
    username: String(pRaw.username ?? pRaw.Username ?? 'User'),
    avatarPath: pRaw.avatarPath ?? pRaw.AvatarPath ?? null,
  };

  console.info(`[CallsStore] Пользователь UserId=${p.userId} присоединился к групповому звонку.`);

  const current = useCallsStore.getState().activeParticipants;
  if (!current.some((x) => x.userId === p.userId)) {
    useCallsStore.setState({ activeParticipants: [...current, p] });
  }
});

eventBus.on('UserLeftGroupCallMessage' as any, (data: { groupId: number; userId: number }) => {
  console.info(`[CallsStore] Пользователь UserId=${data.userId} вышел из группового звонка.`);

  const current = useCallsStore.getState().activeParticipants;
  useCallsStore.setState({
    activeParticipants: current.filter((p) => p.userId !== data.userId),
  });
  webRtcCallService.removePeer(data.userId);
});

eventBus.on('CallEndedMessage' as any, async () => {
  if (useCallsStore.getState().isGroupCall) return;

  console.info('[CallsStore] Собеседник завершил личный звонок.');
  await sendCallLogAsync(useCallsStore.getState());

  useCallsStore.setState({
    isIncomingCallVisible: false,
    isOutgoingCallVisible: false,
    isActiveCallVisible: false,
    currentCallUserAvatar: null,
  });

  stopTimer(useCallsStore.setState);
  useCallsStore.getState().closeCallWindow();

  try {
    await webRtcCallService.cleanup();
  } catch (ex) {
    console.error('[CallsStore ERROR] Ошибка очистки ресурсов WebRTC:', ex);
  }
});