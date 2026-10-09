import { create } from 'zustand';
import { signalRService } from '../services/signalr.service';
import { eventBus } from '../services/eventBus';
import { webRtcCallService } from '../services/webRtcCallService';
import { IUserSearchResult } from '../types/models';
import { userSession } from '../services/userSession';
import { useChatStore } from './chatStore';
import { userService } from '../services/user.service';

export interface GroupCallParticipant {
  userId: number;
  username: string;
  avatarPath?: string | null;
  isVideoOn?: boolean;
  isScreenSharing?: boolean;
  isMuted?: boolean;
}

export type WindowVisualState = 'normal' | 'maximized' | 'minimized';

export function getLocalUserProfile(): { id: number; name: string; avatar: string | null } {
  try {
    const chatState = useChatStore.getState();
    if (chatState.currentUserName && chatState.currentUserName !== 'Me' && chatState.currentUserName !== 'User' && chatState.currentUserName !== 'Вы') {
      return {
        id: Number(userSession.userId || 0),
        name: chatState.currentUserName,
        avatar: chatState.currentUserAvatar || null,
      };
    }
  } catch {}

  const anySession = userSession as any;
  if (anySession?.nickName || anySession?.username) {
    return {
      id: Number(userSession.userId || 0),
      name: anySession.nickName || anySession.username,
      avatar: anySession.avatarPath || anySession.avatar || null,
    };
  }

  for (const key of ['user_session_data', 'current_user', 'user', 'auth_user', 'profile']) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        const name = parsed.nickName || parsed.nickname || parsed.username || parsed.name;
        const avatar = parsed.avatarPath || parsed.avatar || null;
        const id = Number(parsed.userId || parsed.id || userSession.userId || 0);
        if (name && name !== 'Вы') {
          return { id, name, avatar };
        }
      }
    } catch {}
  }

  return {
    id: Number(userSession.userId || 0),
    name: '',
    avatar: null,
  };
}

interface CallsState {
  currentCallUserId: number;
  isIncomingCallVisible: boolean;
  isOutgoingCallVisible: boolean;
  isActiveCallVisible: boolean;
  currentCallUserName: string;
  callDurationText: string;
  currentCallUserAvatar: string | null;
  activeParticipants: GroupCallParticipant[];

  localUserId: number;
  localUserName: string;
  localUserAvatar: string | null;

  // 🟢 Раздельные реестры стримов
  localCameraStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  remoteCameraStreams: Map<number, MediaStream>;
  remoteScreenStreams: Map<number, MediaStream>;
  spotlightUserId: number | null;

  isWindowOpen: boolean;
  windowState: WindowVisualState;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;

  isGroupCall: boolean;
  currentGroupId: number;

  startCall: (targetUser: IUserSearchResult | any | null) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  setSpotlightUserId: (userId: number | null) => void;
  showCallWindow: () => void;
  closeCallWindow: () => void;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  restoreWindow: () => void;
  refreshLocalProfile: () => void;
}

let callTimer: ReturnType<typeof setInterval> | null = null;
let callSeconds: number = 0;
let isCaller: boolean = false;
let wasAnswered: boolean = false;
let callLogSent: boolean = false;

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

const initialMe = getLocalUserProfile();

export const useCallsStore = create<CallsState>((set, get) => ({
  currentCallUserId: 0,
  isIncomingCallVisible: false,
  isOutgoingCallVisible: false,
  isActiveCallVisible: false,
  currentCallUserName: '',
  callDurationText: '00:00',
  currentCallUserAvatar: null,
  activeParticipants: [],

  localUserId: initialMe.id,
  localUserName: initialMe.name,
  localUserAvatar: initialMe.avatar,

  localCameraStream: null,
  localScreenStream: null,
  remoteCameraStreams: new Map(),
  remoteScreenStreams: new Map(),
  spotlightUserId: null,

  isWindowOpen: false,
  windowState: 'normal',
  isMuted: false,
  isVideoOn: false,
  isScreenSharing: false,

  isGroupCall: false,
  currentGroupId: 0,

  refreshLocalProfile: () => {
    const me = getLocalUserProfile();
    set({
      localUserId: me.id,
      localUserName: me.name,
      localUserAvatar: me.avatar,
    });
  },

  showCallWindow: () => {
    const me = getLocalUserProfile();
    set({
      isWindowOpen: true,
      windowState: 'normal',
      localUserId: me.id,
      localUserName: me.name,
      localUserAvatar: me.avatar,
    });
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

  setSpotlightUserId: (userId) => {
    set({ spotlightUserId: userId });
  },

  toggleMute: () => {
    const next = !get().isMuted;
    webRtcCallService.setMute(next);
    set({ isMuted: next });

    const { isGroupCall, currentGroupId, isVideoOn, isScreenSharing } = get();
    if (isGroupCall && currentGroupId > 0) {
      signalRService.invokeAsync('UpdateGroupCallMediaState', currentGroupId, next, isVideoOn, isScreenSharing).catch(() => {});
    }
  },

  // 🟢 Камера и экран полностью независимы!
  toggleVideo: async () => {
    const { isVideoOn, isMuted, isScreenSharing, isGroupCall, currentGroupId } = get();
    if (isVideoOn) {
      await webRtcCallService.stopCamera();
      set({ isVideoOn: false, localCameraStream: null });
      if (isGroupCall && currentGroupId > 0) {
        signalRService.invokeAsync('UpdateGroupCallMediaState', currentGroupId, isMuted, false, isScreenSharing).catch(() => {});
      }
    } else {
      const track = await webRtcCallService.startCamera();
      if (track) {
        set({ isVideoOn: true, localCameraStream: webRtcCallService.localCameraStream });
        if (isGroupCall && currentGroupId > 0) {
          signalRService.invokeAsync('UpdateGroupCallMediaState', currentGroupId, isMuted, true, isScreenSharing).catch(() => {});
        }
      }
    }
  },

  toggleScreenShare: async () => {
    const { isScreenSharing, isMuted, isVideoOn, isGroupCall, currentGroupId } = get();
    if (isScreenSharing) {
      await webRtcCallService.stopScreenShare();
      set({ isScreenSharing: false, localScreenStream: null });
      if (isGroupCall && currentGroupId > 0) {
        signalRService.invokeAsync('UpdateGroupCallMediaState', currentGroupId, isMuted, isVideoOn, false).catch(() => {});
      }
    } else {
      const track = await webRtcCallService.startScreenShare();
      if (track) {
        set({ isScreenSharing: true, localScreenStream: webRtcCallService.localScreenStream });
        if (isGroupCall && currentGroupId > 0) {
          signalRService.invokeAsync('UpdateGroupCallMediaState', currentGroupId, isMuted, isVideoOn, true).catch(() => {});
        }
      }
    }
  },

  startCall: async (targetUser: IUserSearchResult | any | null) => {
    if (!targetUser) return;

    const targetId = Number(targetUser.id ?? targetUser.userId ?? targetUser.groupId ?? 0);
    if (targetId <= 0) return;

    const me = getLocalUserProfile();
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
      spotlightUserId: null,
      localUserId: me.id,
      localUserName: me.name,
      localUserAvatar: me.avatar,
    });

    webRtcCallService.setCallContext(isGroup, targetId, isGroup ? 0 : targetId);

    if (isGroup) {
      set({
        currentGroupId: targetId,
        currentCallUserId: targetId,
        currentCallUserName: `Группа: ${targetUser.nickName || targetUser.groupName || 'Group'}`,
        currentCallUserAvatar: targetUser.avatarPath || targetUser.avatar || null,
        isIncomingCallVisible: false,
        isOutgoingCallVisible: false,
        isActiveCallVisible: true,
        callDurationText: '00:00',
      });

      get().showCallWindow();
      startTimer(set);

      try {
        await webRtcCallService.initializeLocalCapture();
        await signalRService.startGroupCallAsync(targetId);
        await signalRService.joinGroupCallAsync(targetId);
      } catch (ex) {
        console.error('[CallsStore ERROR] Ошибка запуска группового звонка GroupId=', targetId, ex);
      }
    } else {
      set({
        currentCallUserId: targetId,
        currentGroupId: 0,
        currentCallUserName: targetUser.nickName || targetUser.username || 'User',
        currentCallUserAvatar: targetUser.avatarPath || targetUser.avatar || null,
        isIncomingCallVisible: false,
        isActiveCallVisible: false,
        isOutgoingCallVisible: true,
        callDurationText: '00:00',
      });

      get().showCallWindow();

      try {
        await signalRService.startCallAsync(targetId);
      } catch (ex) {
        console.error('[CallsStore ERROR] Ошибка отправки личного звонка UserId=', targetId, ex);
      }
    }
  },

  acceptCall: async () => {
    wasAnswered = true;
    const { isGroupCall, currentGroupId, currentCallUserId } = get();
    const me = getLocalUserProfile();

    set({
      isIncomingCallVisible: false,
      isActiveCallVisible: true,
      localUserId: me.id,
      localUserName: me.name,
      localUserAvatar: me.avatar,
    });

    try {
      await webRtcCallService.initializeLocalCapture();

      if (isGroupCall) {
        get().showCallWindow();
        startTimer(set);
        await signalRService.joinGroupCallAsync(currentGroupId);
      } else {
        await signalRService.answerCallAsync(currentCallUserId, true);
        await webRtcCallService.initializeWebRTCAsync();
        startTimer(set);
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
        localCameraStream: null,
        localScreenStream: null,
        remoteCameraStreams: new Map(),
        remoteScreenStreams: new Map(),
        spotlightUserId: null,
        isVideoOn: false,
        isScreenSharing: false,
        activeParticipants: [],
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

webRtcCallService.onLocalStreamsUpdated = (cameraStream, screenStream) => {
  useCallsStore.setState({
    localCameraStream: cameraStream,
    localScreenStream: screenStream,
  });
};

webRtcCallService.onRemoteStreamsUpdated = (cameras, screens) => {
  useCallsStore.setState({
    remoteCameraStreams: new Map(cameras),
    remoteScreenStreams: new Map(screens),
  });
};

function startTimer(set: any) {
  if (callTimer !== null) return;
  callSeconds = 0;
  set({ callDurationText: '00:00' });

  callTimer = setInterval(() => {
    callSeconds++;
    const hours = Math.floor(callSeconds / 3600);
    const minutes = Math.floor((callSeconds % 3600) / 60);
    const seconds = callSeconds % 60;

    const formatted =
      hours >= 1
        ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    set({ callDurationText: formatted });
  }, 1000);
}

function resetAndStartTimer(set: any) {
  if (callTimer) {
    clearInterval(callTimer);
    callTimer = null;
  }
  callSeconds = 0;
  startTimer(set);
}

function stopTimer(set: any) {
  if (callTimer) {
    clearInterval(callTimer);
    callTimer = null;
  }
  callSeconds = 0;
  set({ callDurationText: '00:00' });
}

async function sendCallLogAsync(state: CallsState): Promise<void> {
  if (!isCaller || callLogSent || state.currentCallUserId === 0 || state.isGroupCall) return;
  callLogSent = true;

  const totalSeconds = wasAnswered ? Math.max(0, callSeconds) : 0;
  const status = !wasAnswered ? 'CANCELED' : 'SUCCESS';
  const messageText = `CALL:${status}:${totalSeconds}`;

  try {
    await signalRService.sendMessageAsync(state.currentCallUserId, null, null, messageText);
  } catch (ex) {
    console.error('[CallsStore] Ошибка отправки лога звонка:', ex);
  }
}

function extractCallTarget(data: any): any {
  if (!data) return null;
  if (data.targetUser) return data.targetUser;
  if (data.user) return data.user;
  if (data.group) return data.group;
  if (data.id || data.userId || data.groupId) return data;
  return null;
}

// Регистрация событий SignalR
eventBus.on('SyncTimerMessage' as any, () => {
  resetAndStartTimer(useCallsStore.setState);
});

eventBus.on('StartCallRequestMessage' as any, (data: any) => {
  const target = extractCallTarget(data);
  if (target) useCallsStore.getState().startCall(target);
});

eventBus.on('StartCallMessage' as any, (data: any) => {
  const target = extractCallTarget(data);
  if (target) useCallsStore.getState().startCall(target);
});

eventBus.on('StartGroupCallRequestMessage' as any, (data: any) => {
  const target = extractCallTarget(data);
  if (target) useCallsStore.getState().startCall(target);
});

eventBus.on('StartGroupCallMessage' as any, (data: any) => {
  const target = extractCallTarget(data);
  if (target) useCallsStore.getState().startCall(target);
});

eventBus.on('IncomingCallMessage' as any, (data: { callerId: number; callerName: string; callerAvatar: string | null }) => {
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
  const state = useCallsStore.getState();
  if (state.isGroupCall && state.currentGroupId === data.groupId && state.isActiveCallVisible) {
    return;
  }

  webRtcCallService.setCallContext(true, data.groupId, 0);

  useCallsStore.setState({
    isGroupCall: true,
    currentGroupId: data.groupId,
    currentCallUserId: data.groupId,
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
  if (data.accepted) {
    wasAnswered = true;
    useCallsStore.setState({
      isOutgoingCallVisible: false,
      isActiveCallVisible: true,
    });
    startTimer(useCallsStore.setState);

    try {
      await webRtcCallService.startCallAsync();
    } catch (ex) {
      console.error('[CallsStore ERROR] Сбой старта WebRTC:', ex);
    }
  } else {
    await sendCallLogAsync(useCallsStore.getState());
    useCallsStore.setState({ isOutgoingCallVisible: false });
    stopTimer(useCallsStore.setState);
    useCallsStore.getState().closeCallWindow();

    try {
      await webRtcCallService.cleanup();
    } catch (ex) {
      console.error('[CallsStore ERROR] Ошибка при отклонении вызова:', ex);
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
    startTimer(useCallsStore.setState);
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
  const myUserId = getLocalUserProfile().id;

  const mappedParticipants: GroupCallParticipant[] = (data.participants || [])
    .filter((p: any) => Number(p.userId ?? p.UserId) !== myUserId)
    .map((p: any) => {
      const uId = Number(p.userId ?? p.UserId);
      const rawAvatar = p.avatar ?? p.Avatar ?? p.avatarPath ?? p.AvatarPath ?? null;

      let avatarFinal = null;
      if (typeof rawAvatar === 'string' && rawAvatar.length > 50) {
        avatarFinal = rawAvatar.startsWith('data:') ? rawAvatar : `data:image/jpeg;base64,${rawAvatar}`;
      } else {
        avatarFinal = userService.getCachedUserAvatar(uId);
      }

      return {
        userId: uId,
        username: String(p.username ?? p.Username ?? userService.getCachedUserName(uId) ?? 'User'),
        avatarPath: avatarFinal,
        isVideoOn: Boolean(p.isVideoOn ?? p.IsVideoOn),
        isScreenSharing: Boolean(p.isScreenSharing ?? p.IsScreenSharing),
        isMuted: Boolean(p.isMuted ?? p.IsMuted),
      };
    });

  useCallsStore.setState({
    isOutgoingCallVisible: false,
    isIncomingCallVisible: false,
    isActiveCallVisible: true,
    activeParticipants: mappedParticipants,
  });
  startTimer(useCallsStore.setState);

  mappedParticipants.forEach((p) => {
    if (!p.avatarPath) {
      userService.getUserProfileAsync(p.userId).then((profile) => {
        if (profile) {
          useCallsStore.setState((state) => ({
            activeParticipants: state.activeParticipants.map((item) =>
              item.userId === p.userId
                ? { ...item, avatarPath: profile.avatarPath || profile.avatar || null, username: profile.nickName || profile.username }
                : item
            ),
          }));
        }
      });
    }
  });

  for (const p of mappedParticipants) {
    if (myUserId < p.userId) {
      try {
        await webRtcCallService.startCallWithPeerAsync(p.userId);
      } catch (ex) {
        console.error('[CallsStore ERROR] Ошибка подключения к пиру UserId=', p.userId, ex);
      }
    }
  }
});

eventBus.on('UserJoinedGroupCallMessage' as any, (data: { groupId: number; participant: any }) => {
  const myUserId = getLocalUserProfile().id;
  const pRaw = data.participant;
  const pUserId = Number(pRaw.userId ?? pRaw.UserId);

  if (pUserId === myUserId) return;

  const rawAvatar = pRaw.avatar ?? pRaw.Avatar ?? pRaw.avatarPath ?? pRaw.AvatarPath ?? null;
  let avatarFinal = null;
  if (typeof rawAvatar === 'string' && rawAvatar.length > 50) {
    avatarFinal = rawAvatar.startsWith('data:') ? rawAvatar : `data:image/jpeg;base64,${rawAvatar}`;
  } else {
    avatarFinal = userService.getCachedUserAvatar(pUserId);
  }

  const p: GroupCallParticipant = {
    userId: pUserId,
    username: String(pRaw.username ?? pRaw.Username ?? userService.getCachedUserName(pUserId) ?? 'User'),
    avatarPath: avatarFinal,
    isVideoOn: Boolean(pRaw.isVideoOn ?? pRaw.IsVideoOn),
    isScreenSharing: Boolean(pRaw.isScreenSharing ?? pRaw.IsScreenSharing),
    isMuted: Boolean(pRaw.isMuted ?? pRaw.IsMuted),
  };

  const current = useCallsStore.getState().activeParticipants;
  if (!current.some((x) => x.userId === p.userId)) {
    useCallsStore.setState({ activeParticipants: [...current, p] });
  }
  startTimer(useCallsStore.setState);

  if (myUserId < pUserId) {
    webRtcCallService.startCallWithPeerAsync(pUserId).catch((ex) => {
      console.error('[CallsStore ERROR] Ошибка подключения к новому участнику:', ex);
    });
  }
});

eventBus.on('UserLeftGroupCallMessage' as any, (data: { groupId: number; userId: number }) => {
  const current = useCallsStore.getState().activeParticipants;
  useCallsStore.setState({
    activeParticipants: current.filter((p) => p.userId !== data.userId),
  });
  webRtcCallService.removePeer(data.userId);
});

eventBus.on('UserMediaStateChangedMessage' as any, (data: { groupId: number; userId: number; isMuted: boolean; isVideoOn: boolean; isScreenSharing: boolean }) => {
  const current = useCallsStore.getState().activeParticipants;
  const myUserId = getLocalUserProfile().id;

  useCallsStore.setState({
    activeParticipants: current.map((p) =>
      p.userId === data.userId
        ? { ...p, isMuted: data.isMuted, isVideoOn: data.isVideoOn, isScreenSharing: data.isScreenSharing }
        : p
    ),
  });

  // 🟢 Сбрасываем сокет только для ЧУЖОГО пира (не для себя самого!)
  if (!data.isScreenSharing && data.userId !== myUserId) {
    webRtcCallService.removeScreenPeer(data.userId);
  }
});

eventBus.on('CallEndedMessage' as any, async () => {
  if (useCallsStore.getState().isGroupCall) return;

  await sendCallLogAsync(useCallsStore.getState());

  useCallsStore.setState({
    isIncomingCallVisible: false,
    isOutgoingCallVisible: false,
    isActiveCallVisible: false,
    currentCallUserAvatar: null,
    localCameraStream: null,
    localScreenStream: null,
    remoteCameraStreams: new Map(),
    remoteScreenStreams: new Map(),
    spotlightUserId: null,
    isVideoOn: false,
    isScreenSharing: false,
  });

  stopTimer(useCallsStore.setState);
  useCallsStore.getState().closeCallWindow();

  try {
    await webRtcCallService.cleanup();
  } catch (ex) {
    console.error('[CallsStore ERROR] Ошибка очистки ресурсов WebRTC:', ex);
  }
});