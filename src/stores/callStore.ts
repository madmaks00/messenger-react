import { create } from 'zustand';
import { signalRService } from '../services/signalr.service';
import { webrtcAudioService } from '../services/webrtcAudio.service';
import { eventBus } from '../services/eventBus';

export type CallState = 'idle' | 'outgoing' | 'incoming' | 'connected';

interface CallStoreState {
  callState: CallState;
  targetUserId: number;
  targetUserName: string;
  targetUserAvatar: string | null;
  durationSeconds: number;
  isMuted: boolean;

  // Действия
  startCall: (userId: number, userName: string, userAvatar?: string | null) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
}

let peerConnection: RTCPeerConnection | null = null;
let durationInterval: ReturnType<typeof setInterval> | null = null;
let remoteAudioElement: HTMLAudioElement | null = null;

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const useCallStore = create<CallStoreState>((set, get) => ({
  callState: 'idle',
  targetUserId: 0,
  targetUserName: '',
  targetUserAvatar: null,
  durationSeconds: 0,
  isMuted: false,

  startCall: async (userId, userName, userAvatar = null) => {
    set({
      callState: 'outgoing',
      targetUserId: userId,
      targetUserName: userName,
      targetUserAvatar: userAvatar,
      durationSeconds: 0,
      isMuted: false,
    });

    try {
      const localStream = await webrtcAudioService.getOptimizedAudioStream();
      peerConnection = new RTCPeerConnection(RTC_CONFIG);

      localStream.getAudioTracks().forEach((track) => {
        peerConnection?.addTrack(track, localStream);
      });

      setupPeerListeners(userId);

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      await signalRService.startCallAsync(userId);
      await signalRService.sendWebRTCDataAsync(userId, JSON.stringify({ sdp: offer }));
    } catch (e) {
      console.error('[CallStore] Ошибка запуска звонка:', e);
      get().endCall();
    }
  },

  acceptCall: async () => {
    const { targetUserId } = get();
    set({ callState: 'connected', durationSeconds: 0 });

    try {
      const localStream = await webrtcAudioService.getOptimizedAudioStream();
      peerConnection = new RTCPeerConnection(RTC_CONFIG);

      localStream.getAudioTracks().forEach((track) => {
        peerConnection?.addTrack(track, localStream);
      });

      setupPeerListeners(targetUserId);

      await signalRService.answerCallAsync(targetUserId, true);
      startDurationTimer(set);
    } catch (e) {
      console.error('[CallStore] Ошибка принятия звонка:', e);
      get().endCall();
    }
  },

  rejectCall: async () => {
    const { targetUserId } = get();
    await signalRService.answerCallAsync(targetUserId, false);
    cleanup();
    set({ callState: 'idle', targetUserId: 0 });
  },

  endCall: async () => {
    const { targetUserId } = get();
    if (targetUserId > 0) {
      await signalRService.endCallAsync(targetUserId);
    }
    cleanup();
    set({ callState: 'idle', targetUserId: 0, durationSeconds: 0 });
  },

  toggleMute: () => {
    const isMuted = !get().isMuted;
    if (peerConnection) {
      peerConnection.getSenders().forEach((sender) => {
        if (sender.track) sender.track.enabled = !isMuted;
      });
    }
    set({ isMuted });
  },
}));

function setupPeerListeners(targetUserId: number) {
  if (!peerConnection) return;

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      signalRService.sendWebRTCDataAsync(targetUserId, JSON.stringify({ candidate: event.candidate }));
    }
  };

  peerConnection.ontrack = (event) => {
    if (!remoteAudioElement) {
      remoteAudioElement = new Audio();
      remoteAudioElement.autoplay = true;
    }
    remoteAudioElement.srcObject = event.streams[0];
  };
}

function startDurationTimer(set: any) {
  if (durationInterval) clearInterval(durationInterval);
  durationInterval = setInterval(() => {
    set((state: any) => ({ durationSeconds: state.durationSeconds + 1 }));
  }, 1000);
}

function cleanup() {
  if (durationInterval) {
    clearInterval(durationInterval);
    durationInterval = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  webrtcAudioService.stopStream();
  if (remoteAudioElement) {
    remoteAudioElement.srcObject = null;
    remoteAudioElement = null;
  }
}

// Связка входящих сигналов SignalR через EventBus
eventBus.on('IncomingCallMessage', ({ callerId, callerName, callerAvatar }) => {
  useCallStore.setState({
    callState: 'incoming',
    targetUserId: callerId,
    targetUserName: callerName,
    targetUserAvatar: callerAvatar || null,
    durationSeconds: 0,
  });
});

eventBus.on('CallResponseMessage', async ({ accepted }) => {
  if (accepted) {
    useCallStore.setState({ callState: 'connected' });
    startDurationTimer(useCallStore.setState);
  } else {
    useCallStore.getState().endCall();
  }
});

eventBus.on('CallEndedMessage', () => {
  cleanup();
  useCallStore.setState({ callState: 'idle', targetUserId: 0 });
});

eventBus.on('WebRTCDataMessage', async ({ senderId, data }) => {
  try {
    const payload = JSON.parse(data);
    if (payload.sdp && peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      if (payload.sdp.type === 'offer') {
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await signalRService.sendWebRTCDataAsync(senderId, JSON.stringify({ sdp: answer }));
      }
    } else if (payload.candidate && peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
    }
  } catch (e) {
    console.error('[Call WebRTC Signal]', e);
  }
});