import { signalRService } from './signalr.service';
import { webrtcAudioService } from './webrtcAudio.service';

const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:global.relay.metered.ca:80',
      username: '89be2ab655cfd86f90559864',
      credential: '1cmY7d+IfDcGNYvn',
    },
  ],
};

export class WebRtcCallService {
  private peerConnections: Map<number, RTCPeerConnection> = new Map();
  private remoteAudioElements: Map<number, HTMLAudioElement> = new Map();
  private localStream: MediaStream | null = null;
  private singleCallTargetId: number = 0;
  private isGroupCall: boolean = false;
  private currentGroupId: number = 0;
  private isMuted: boolean = false;

  public sendSignalingData: ((targetUserId: number, data: string) => void) | null = null;

  public setCallContext(isGroup: boolean, groupId: number, singleTargetId: number = 0): void {
    this.isGroupCall = isGroup;
    this.currentGroupId = groupId;
    this.singleCallTargetId = singleTargetId;
  }

  public async initializeLocalCapture(): Promise<MediaStream> {
    if (this.localStream) return this.localStream;
    this.localStream = await webrtcAudioService.getOptimizedAudioStream();
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted;
    });
    return this.localStream;
  }

  public setMute(muted: boolean): void {
    this.isMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public async initializeWebRTCAsync(): Promise<void> {
    const targetId = this.singleCallTargetId !== 0 ? this.singleCallTargetId : 1;
    await this.createPeerConnectionAsync(targetId);
  }

  public async createPeerConnectionAsync(targetUserId: number): Promise<RTCPeerConnection> {
    const existing = this.peerConnections.get(targetUserId);
    if (existing && existing.connectionState !== 'closed') {
      return existing;
    }

    const stream = await this.initializeLocalCapture();
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.invokeSignaling(targetUserId, JSON.stringify({ candidate: event.candidate }));
      }
    };

    pc.ontrack = (event) => {
      let audio = this.remoteAudioElements.get(targetUserId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        this.remoteAudioElements.set(targetUserId, audio);
      }
      audio.srcObject = event.streams[0] || new MediaStream([event.track]);
    };

    pc.onconnectionstatechange = () => {
      console.info(`[WebRtcCallService] Peer ID ${targetUserId} status:`, pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.removePeer(targetUserId);
      }
    };

    this.peerConnections.set(targetUserId, pc);
    return pc;
  }

  public async startCallAsync(): Promise<void> {
    const targetId = this.singleCallTargetId !== 0 ? this.singleCallTargetId : 1;
    await this.startCallWithPeerAsync(targetId);
  }

  public async startCallWithPeerAsync(targetUserId: number): Promise<void> {
    this.singleCallTargetId = targetUserId;
    const pc = await this.createPeerConnectionAsync(targetUserId);
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    await pc.setLocalDescription(offer);
    this.invokeSignaling(targetUserId, JSON.stringify({ sdp: offer }));
  }

  public async processSignalingData(data: string): Promise<void> {
    const targetId = this.singleCallTargetId !== 0 ? this.singleCallTargetId : 1;
    await this.processSignalingDataFromPeer(targetId, data);
  }

  public async processSignalingDataFromPeer(senderId: number, data: string): Promise<void> {
    this.singleCallTargetId = senderId;
    const pc = await this.createPeerConnectionAsync(senderId);

    try {
      const parsed = JSON.parse(data);

      if (parsed.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(parsed.sdp));
        if (parsed.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.invokeSignaling(senderId, JSON.stringify({ sdp: answer }));
        }
      } else if (parsed.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(parsed.candidate));
      }
    } catch {
      if (data.includes('v=0')) {
        const isOffer = !pc.localDescription;
        await pc.setRemoteDescription(
          new RTCSessionDescription({
            type: isOffer ? 'offer' : 'answer',
            sdp: data,
          })
        );
        if (isOffer) {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.invokeSignaling(senderId, answer.sdp || '');
        }
      } else {
        await pc.addIceCandidate(new RTCIceCandidate({ candidate: data, sdpMid: '0', sdpMLineIndex: 0 }));
      }
    }
  }

  public removePeer(userId: number): void {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      try {
        pc.close();
      } catch {}
      this.peerConnections.delete(userId);
    }

    const audio = this.remoteAudioElements.get(userId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      this.remoteAudioElements.delete(userId);
    }
    console.info(`[WebRtcCallService] Peer session closed: ${userId}`);
  }

  public async cleanup(): Promise<void> {
    this.peerConnections.forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });
    this.peerConnections.clear();

    this.remoteAudioElements.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
    });
    this.remoteAudioElements.clear();

    webrtcAudioService.stopStream();
    this.localStream = null;
    this.singleCallTargetId = 0;
    this.currentGroupId = 0;
    this.isGroupCall = false;
    this.isMuted = false;
  }

  private invokeSignaling(targetUserId: number, data: string): void {
    if (this.sendSignalingData) {
      this.sendSignalingData(targetUserId, data);
      return;
    }

    if (this.isGroupCall) {
      signalRService.sendGroupCallWebRTCDataAsync(this.currentGroupId, targetUserId, data).catch((err) => {
        console.error('[WebRtcCallService] Ошибка отправки group signaling:', err);
      });
    } else {
      signalRService.sendWebRTCDataAsync(targetUserId, data).catch((err) => {
        console.error('[WebRtcCallService] Ошибка отправки peer signaling:', err);
      });
    }
  }
}

export const webRtcCallService = new WebRtcCallService();
export default webRtcCallService;