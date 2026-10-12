import { signalRService } from './signalr.service';

const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:global.relay.metered.ca:80?transport=udp',
      username: '89be2ab655cfd86f90559864',
      credential: '1cmY7d+IfDcGNYvn',
    },
    {
      urls: 'turn:global.relay.metered.ca:80?transport=tcp',
      username: '89be2ab655cfd86f90559864',
      credential: '1cmY7d+IfDcGNYvn',
    },
  ],
};

export class WebRtcCallService {
  private peerConnections: Map<number, RTCPeerConnection> = new Map();
  public remoteCameraStreams: Map<number, MediaStream> = new Map();
  private candidateQueue: Map<number, RTCIceCandidateInit[]> = new Map();
  private remoteAudioElements: Map<number, HTMLAudioElement> = new Map();

  private screenOutPeerConnections: Map<number, RTCPeerConnection> = new Map();

  private screenInPeerConnections: Map<number, RTCPeerConnection> = new Map();
  public remoteScreenStreams: Map<number, MediaStream> = new Map();

  private localAudioStream: MediaStream | null = null;
  public localCameraStream: MediaStream | null = null;
  public localCameraTrack: MediaStreamTrack | null = null;
  public localScreenStream: MediaStream | null = null;
  public localScreenTrack: MediaStreamTrack | null = null;

  private cameraOutPeerConnections = new Map<number, RTCPeerConnection>();
  private cameraInPeerConnections = new Map<number, RTCPeerConnection>();
  private cameraOutSessions = new Map<number, string>();
  private cameraInSessions = new Map<number, string>();
  private earlyCameraCandidates = new Map<string, RTCIceCandidateInit[]>();

  private videoMonitors = new Map<RTCPeerConnection, ReturnType<typeof setInterval>>();

  private capturePromise: Promise<MediaStream> | null = null;
  private peerCreation = new Map<number, Promise<RTCPeerConnection>>();
  private signalQueue = new Map<number, Promise<void>>();
  private generation = 0;
  private cameraRequest = 0;
  private offersInProgress = new Set<number>();
  private screenRequest = 0;
  private screenOutSessions = new Map<number, string>();
  private screenInSessions = new Map<number, string>();
  private earlyScreenCandidates = new Map<string, RTCIceCandidateInit[]>();

  private singleCallTargetId: number = 0;
  private isGroupCall: boolean = false;
  private currentGroupId: number = 0;
  private isMuted: boolean = false;

  public sendSignalingData: ((targetUserId: number, data: string) => void | Promise<void>) | null = null;
  public onRemoteMediaState: ((peerId: number, muted: boolean, camera: boolean, screen: boolean) => void) | null = null;
  public onRemoteStreamsUpdated: ((cameras: Map<number, MediaStream>, screens: Map<number, MediaStream>) => void) | null = null;
  public onLocalStreamsUpdated: ((camera: MediaStream | null, screen: MediaStream | null) => void) | null = null;

  public setCallContext(isGroup: boolean, groupId: number, singleTargetId: number = 0): void {
    console.log(`%c[WebRTC 📞 Context] isGroup=${isGroup}, groupId=${groupId}, singleTarget=${singleTargetId}`, 'color: #38BDF8; font-weight: bold;');
    this.isGroupCall = isGroup;
    this.currentGroupId = groupId;
    this.singleCallTargetId = singleTargetId;
  }

  public async initializeLocalCapture(): Promise<MediaStream> {
    if (this.capturePromise) return this.capturePromise;
    const generation = this.generation;
    const pending = this.captureAudio();
    this.capturePromise = pending;
    try {
      const stream = await pending;
      if (generation !== this.generation) {
        stream.getTracks().forEach(t => t.stop());
        if (this.localAudioStream === stream) this.localAudioStream = null;
        throw new Error('Call ended while opening the microphone');
      }
      this.localAudioStream = stream;
      return stream;
    } finally {
      if (this.capturePromise === pending) this.capturePromise = null;
    }
  }

  private async captureAudio(): Promise<MediaStream> {
    if (this.localAudioStream?.active) return this.localAudioStream;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      video: false,
    });
    stream.getAudioTracks().forEach(track => { track.enabled = !this.isMuted; });
    return stream;
  }

  public setMute(muted: boolean): void {
    this.isMuted = muted;
    if (this.localAudioStream) {
      this.localAudioStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    this.syncMediaState();
  }

  // ================= 1. КАМЕРА (H.264 @ 3.5 Mbps) =================

  public async startCamera(): Promise<MediaStreamTrack | null> {
    if (this.localCameraTrack?.readyState === 'live') return this.localCameraTrack;
    const request = ++this.cameraRequest;
    const generation = this.generation;
    try {
      console.log('%c[WebRTC 📷 Cam] Запуск камеры Full HD...', 'color: #3B82F6;');
      if (this.localCameraStream) {
        this.localCameraStream.getTracks().forEach((t) => t.stop());
        this.localCameraStream = null;
      }

      const camStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 }, frameRate: { ideal: 30 } },
        audio: false,
      });

      if (request !== this.cameraRequest || generation !== this.generation) {
        camStream.getTracks().forEach(t => t.stop());
        return null;
      }
      this.localCameraStream = camStream;
      const track = camStream.getVideoTracks()[0];
      if ('contentHint' in track) {
        track.contentHint = 'motion';
      }
      this.localCameraTrack = track;

      track.onended = () => { void this.stopCamera(); };

      for (const peerId of this.peerConnections.keys()) await this.startCameraCallWithPeerAsync(peerId);

      this.emitLocalStreams();
      this.syncMediaState();
      return track;
    } catch (e) {
      console.error('[WebRTC ❌ Cam] Ошибка включения камеры:', e);
      return null;
    }
  }

  public async stopCamera(): Promise<void> {
    ++this.cameraRequest;
    console.log('%c[WebRTC 🖥️ Camera Out] Остановка трансляции экрана...', 'color: #6B7280;');
    if (this.localCameraStream) {
      this.localCameraStream.getTracks().forEach((t) => { t.enabled = false; t.stop(); });
      this.localCameraStream = null;
    }

    if (this.localCameraTrack) {
      this.localCameraTrack.enabled = false;
      this.localCameraTrack.stop();
      this.localCameraTrack = null;
    }

    for (const [peerId, pc] of this.cameraOutPeerConnections.entries()) {
      try {
        console.log(`[WebRTC 🖥️ Camera Out] Закрытие сокета к пиру ${peerId}`);
        this.invokeSignaling(peerId, JSON.stringify({ isCamera: true, cameraDirection: 'out',
          cameraSessionId: this.cameraOutSessions.get(peerId), type: 'cameraStopped' }));
        pc.close();
      } catch {}
    }
    this.cameraOutSessions.clear();
    this.cameraOutPeerConnections.clear();

    this.emitLocalStreams();
    this.syncMediaState();
  }

  public removeCameraPeer(peerId: number): void {
    const inPc = this.cameraInPeerConnections.get(peerId);
    if (inPc) {
      console.log(`%c[WebRTC 🖥️ Camera In] Закрытие входящего экрана от ${peerId}`, 'color: #E11D48;');
      try { inPc.close(); } catch {}
      this.cameraInPeerConnections.delete(peerId);
    }
    this.cameraInSessions.delete(peerId);

    const stream = this.remoteCameraStreams.get(peerId);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      this.remoteCameraStreams.delete(peerId);
      this.notifyRemoteStreams();
    }
  }

  public async startCameraCallWithPeerAsync(targetUserId: number): Promise<void> {
    if (!this.localCameraTrack || this.localCameraTrack.readyState !== 'live') return;
    const existing = this.cameraOutPeerConnections.get(targetUserId);
    if (existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') return;
    const sessionId = crypto.randomUUID();
    this.cameraOutSessions.set(targetUserId, sessionId);
    try {
      console.log(`%c[WebRTC 🖥️ Camera Out] Создание H.264 Offer камеры к пиру ${targetUserId}`, 'color: #9B51E0;');
      const pc = await this.getOrCreateCameraOutPeerConnectionAsync(targetUserId, true);
      const offer = await pc.createOffer();

      const modifiedSdp = this.withVideoQuality(offer.sdp || '', false);
      await pc.setLocalDescription(new RTCSessionDescription({ type: offer.type, sdp: modifiedSdp }));

      this.invokeSignaling(
        targetUserId,
        JSON.stringify({
          isCamera: true,
          cameraDirection: 'out',
          cameraSessionId: sessionId,
          sdp: { type: offer.type, sdp: modifiedSdp },
        })
      );
    } catch (ex) {
      console.error(`[WebRTC ❌ Camera Out] Сбой создания Offer к ${targetUserId}:`, ex);
    }
  }

  private async getOrCreateCameraOutPeerConnectionAsync(targetUserId: number, forceRecreate: boolean = false): Promise<RTCPeerConnection> {
    const existing = this.cameraOutPeerConnections.get(targetUserId);
    if (!forceRecreate && existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
      return existing;
    }

    if (existing) {
      try { existing.close(); } catch {}
      this.cameraOutPeerConnections.delete(targetUserId);
    }

    console.log(`[WebRTC 🖥️ Camera Out] Новый сокет к пиру ${targetUserId} (H.264)`);
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);

    if (this.localCameraTrack && this.localCameraTrack.readyState === 'live') {
      const transceiver = pc.addTransceiver(this.localCameraTrack, {
        direction: 'sendonly',
        streams: [new MediaStream([this.localCameraTrack])],
      });
      this.applyH264CodecPreference(transceiver);
      void this.applySenderBitrate(transceiver, 4_500_000);
    }

    pc.onicecandidate = (event) => {
      if (this.cameraOutPeerConnections.get(targetUserId) === pc && event.candidate?.candidate) {
        this.invokeSignaling(
          targetUserId,
          JSON.stringify({
            isCamera: true,
            cameraDirection: 'out',
            cameraSessionId: this.cameraOutSessions.get(targetUserId),
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid || '0',
              sdpMLineIndex: event.candidate.sdpMLineIndex ?? 0,
            },
          })
        );
      }
    };

    this.cameraOutPeerConnections.set(targetUserId, pc);
    this.monitorVideoSender(pc, targetUserId, 'camera');
    return pc;
  }

  private async getOrCreateCameraInPeerConnectionAsync(senderId: number, forceRecreate: boolean = false): Promise<RTCPeerConnection> {
    const existing = this.cameraInPeerConnections.get(senderId);
    if (!forceRecreate && existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
      return existing;
    }

    if (existing) {
      try { existing.close(); } catch {}
      this.cameraInPeerConnections.delete(senderId);
    }

    console.log(`[WebRTC 🖥️ Camera In] Новый сокет приема H.264 камеры от пира ${senderId}`);
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);
    // The remote offer creates the receiving transceiver. Pre-creating one can leave it unassociated.

    pc.onicecandidate = (event) => {
      if (this.cameraInPeerConnections.get(senderId) === pc && event.candidate?.candidate) {
        this.invokeSignaling(
          senderId,
          JSON.stringify({
            isCamera: true,
            cameraDirection: 'in',
            cameraSessionId: this.cameraInSessions.get(senderId),
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid || '0',
              sdpMLineIndex: event.candidate.sdpMLineIndex ?? 0,
            },
          })
        );
      }
    };

    pc.ontrack = (event) => {
      console.log(`%c[WebRTC 🎬 Track In] Получен H.264 поток камеры от ${senderId}! TrackID=${event.track.id}`, 'color: #10B981; font-weight: bold;');
      const freshStream = new MediaStream([event.track]);
      this.remoteCameraStreams.set(Number(senderId), freshStream);
      this.notifyRemoteStreams();
    };

    this.cameraInPeerConnections.set(senderId, pc);
    return pc;
  }


  // ================= 2. ЭКРАН (H.264 @ 8.0 Mbps 60 FPS) =================

  public async startScreenShare(): Promise<MediaStreamTrack | null> {
    if (this.localScreenTrack?.readyState === 'live') return this.localScreenTrack;
    const request = ++this.screenRequest;
    const generation = this.generation;
    try {
      console.log('%c[WebRTC 🖥️ Screen Out] Запуск экрана на 60 FPS...', 'color: #9B51E0; font-weight: bold;');
      if (this.localScreenStream) {
        this.localScreenStream.getTracks().forEach((t) => t.stop());
        this.localScreenStream = null;
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
        },
        audio: false,
      });

      if (request !== this.screenRequest || generation !== this.generation) {
        screenStream.getTracks().forEach(t => t.stop());
        return null;
      }
      this.localScreenStream = screenStream;
      const track = screenStream.getVideoTracks()[0];

      if ('contentHint' in track) {
        track.contentHint = 'detail';
      }
      this.localScreenTrack = track;

      track.onended = () => {
        console.log('%c[WebRTC 🖥️ Screen Out] Трансляция остановлена в браузере', 'color: #F59E0B;');
        void this.stopScreenShare();
      };

      const activePeerIds = Array.from(this.peerConnections.keys());
      if (activePeerIds.length === 0 && this.singleCallTargetId > 0) {
        activePeerIds.push(this.singleCallTargetId);
      }

      for (const peerId of activePeerIds) {
        await this.startScreenCallWithPeerAsync(peerId);
      }

      this.emitLocalStreams();
      this.syncMediaState();
      return track;
    } catch (e) {
      console.error('[WebRTC ❌ Screen Out] Ошибка захвата экрана:', e);
      return null;
    }
  }

  public async stopScreenShare(): Promise<void> {
    ++this.screenRequest;
    console.log('%c[WebRTC 🖥️ Screen Out] Остановка трансляции экрана...', 'color: #6B7280;');
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((t) => { t.enabled = false; t.stop(); });
      this.localScreenStream = null;
    }

    if (this.localScreenTrack) {
      this.localScreenTrack.enabled = false;
      this.localScreenTrack.stop();
      this.localScreenTrack = null;
    }

    for (const [peerId, pc] of this.screenOutPeerConnections.entries()) {
      try {
        console.log(`[WebRTC 🖥️ Screen Out] Закрытие сокета к пиру ${peerId}`);
        this.invokeSignaling(peerId, JSON.stringify({ isScreen: true, screenDirection: 'out',
          screenSessionId: this.screenOutSessions.get(peerId), type: 'screenStopped' }));
        pc.close();
      } catch {}
    }
    this.screenOutSessions.clear();
    this.screenOutPeerConnections.clear();

    this.emitLocalStreams();
    this.syncMediaState();
  }

  public removeScreenPeer(peerId: number): void {
    const inPc = this.screenInPeerConnections.get(peerId);
    if (inPc) {
      console.log(`%c[WebRTC 🖥️ Screen In] Закрытие входящего экрана от ${peerId}`, 'color: #E11D48;');
      try { inPc.close(); } catch {}
      this.screenInPeerConnections.delete(peerId);
    }
    this.screenInSessions.delete(peerId);

    const stream = this.remoteScreenStreams.get(peerId);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      this.remoteScreenStreams.delete(peerId);
      this.notifyRemoteStreams();
    }
  }

  public async startScreenCallWithPeerAsync(targetUserId: number): Promise<void> {
    if (!this.localScreenTrack || this.localScreenTrack.readyState !== 'live') return;
    const existing = this.screenOutPeerConnections.get(targetUserId);
    if (existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') return;
    const sessionId = crypto.randomUUID();
    this.screenOutSessions.set(targetUserId, sessionId);
    try {
      console.log(`%c[WebRTC 🖥️ Screen Out] Создание H.264 Offer экрана к пиру ${targetUserId}`, 'color: #9B51E0;');
      const pc = await this.getOrCreateScreenOutPeerConnectionAsync(targetUserId, true);
      const offer = await pc.createOffer();

      const modifiedSdp = this.withVideoQuality(offer.sdp || '', true);
      await pc.setLocalDescription(new RTCSessionDescription({ type: offer.type, sdp: modifiedSdp }));

      this.invokeSignaling(
        targetUserId,
        JSON.stringify({
          isScreen: true,
          screenDirection: 'out',
          screenSessionId: sessionId,
          sdp: { type: offer.type, sdp: modifiedSdp },
        })
      );
    } catch (ex) {
      console.error(`[WebRTC ❌ Screen Out] Сбой создания Offer к ${targetUserId}:`, ex);
    }
  }

  private async getOrCreateScreenOutPeerConnectionAsync(targetUserId: number, forceRecreate: boolean = false): Promise<RTCPeerConnection> {
    const existing = this.screenOutPeerConnections.get(targetUserId);
    if (!forceRecreate && existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
      return existing;
    }

    if (existing) {
      try { existing.close(); } catch {}
      this.screenOutPeerConnections.delete(targetUserId);
    }

    console.log(`[WebRTC 🖥️ Screen Out] Новый сокет к пиру ${targetUserId} (H.264)`);
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);

    if (this.localScreenTrack && this.localScreenTrack.readyState === 'live') {
      const transceiver = pc.addTransceiver(this.localScreenTrack, {
        direction: 'sendonly',
        streams: [new MediaStream([this.localScreenTrack])],
      });
      this.applyH264CodecPreference(transceiver);
      void this.applySenderBitrate(transceiver, 8_000_000, 60);
    }

    pc.onicecandidate = (event) => {
      if (this.screenOutPeerConnections.get(targetUserId) === pc && event.candidate?.candidate) {
        this.invokeSignaling(
          targetUserId,
          JSON.stringify({
            isScreen: true,
            screenDirection: 'out',
            screenSessionId: this.screenOutSessions.get(targetUserId),
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid || '0',
              sdpMLineIndex: event.candidate.sdpMLineIndex ?? 0,
            },
          })
        );
      }
    };

    this.screenOutPeerConnections.set(targetUserId, pc);
    this.monitorVideoSender(pc, targetUserId, 'screen');
    return pc;
  }

  private async getOrCreateScreenInPeerConnectionAsync(senderId: number, forceRecreate: boolean = false): Promise<RTCPeerConnection> {
    const existing = this.screenInPeerConnections.get(senderId);
    if (!forceRecreate && existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
      return existing;
    }

    if (existing) {
      try { existing.close(); } catch {}
      this.screenInPeerConnections.delete(senderId);
    }

    console.log(`[WebRTC 🖥️ Screen In] Новый сокет приема H.264 экрана от пира ${senderId}`);
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);
    // The remote offer creates the receiving transceiver. Pre-creating one can leave it unassociated.

    pc.onicecandidate = (event) => {
      if (this.screenInPeerConnections.get(senderId) === pc && event.candidate?.candidate) {
        this.invokeSignaling(
          senderId,
          JSON.stringify({
            isScreen: true,
            screenDirection: 'in',
            screenSessionId: this.screenInSessions.get(senderId),
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid || '0',
              sdpMLineIndex: event.candidate.sdpMLineIndex ?? 0,
            },
          })
        );
      }
    };

    pc.ontrack = (event) => {
      console.log(`%c[WebRTC 🎬 Track In] Получен H.264 поток экрана от ${senderId}! TrackID=${event.track.id}`, 'color: #10B981; font-weight: bold;');
      const freshStream = new MediaStream([event.track]);
      this.remoteScreenStreams.set(Number(senderId), freshStream);
      this.notifyRemoteStreams();
    };

    this.screenInPeerConnections.set(senderId, pc);
    return pc;
  }

  // ================= 3. МАРШРУТИЗАЦИЯ СИГНАЛОВ =================

  public processSignalingDataFromPeer(senderId: number, data: string): Promise<void> {
    const generation = this.generation;
    const pending = (this.signalQueue.get(senderId) ?? Promise.resolve()).catch(() => {}).then(async () => {
      if (generation === this.generation) await this.processSignal(senderId, data);
    });
    this.signalQueue.set(senderId, pending);
    void pending.finally(() => {
      if (this.signalQueue.get(senderId) === pending) this.signalQueue.delete(senderId);
    });
    return pending;
  }

  private async processSignal(senderId: number, data: string): Promise<void> {
    try {
      let payload: any = data;
      while (typeof payload === 'string' && (payload.startsWith('{') || payload.startsWith('['))) {
        try { payload = JSON.parse(payload); } catch { break; }
      }

      if (!payload || typeof payload !== 'object') return;

      if (payload.type === 'mediaState') {
        this.onRemoteMediaState?.(senderId, Boolean(payload.isMuted), Boolean(payload.isVideoOn), Boolean(payload.isScreenSharing));
        return;
      }
      if (payload.isCamera === true) {
        await this.processCameraSignalingFromPeer(senderId, payload);
        return;
      }

      if (payload.isScreen === true) {
        await this.processScreenSignalingFromPeer(senderId, payload);
        return;
      }

      await this.processMainSignalingFromPeer(senderId, payload);
    } catch (ex) {
      console.error(`[WebRTC ❌] Ошибка разбора сигнала от ${senderId}:`, ex);
    }
  }

  private async processScreenSignalingFromPeer(senderId: number, payload: any): Promise<void> {
    const sessionId: string = payload.screenSessionId ?? 'legacy';
    if (payload.type === 'screenStopped') {
      if (this.screenInSessions.get(senderId) === sessionId) this.removeScreenPeer(senderId);
      return;
    }
    if (payload.sdp) {
      const type: RTCSdpType = typeof payload.sdp === 'object' ? payload.sdp.type : payload.type;
      const sdp = typeof payload.sdp === 'string' ? payload.sdp : payload.sdp.sdp;
      if (type !== 'offer' && type !== 'answer') return;
      const incoming = type === 'offer';
      let pc: RTCPeerConnection;
      if (incoming) {
        this.removeScreenPeer(senderId);
        this.screenInSessions.set(senderId, sessionId);
        pc = await this.getOrCreateScreenInPeerConnectionAsync(senderId);
      } else {
        const existing = this.screenOutPeerConnections.get(senderId);
        if (!existing || existing.signalingState !== 'have-local-offer' ||
            (sessionId !== 'legacy' && this.screenOutSessions.get(senderId) !== sessionId)) return;
        pc = existing;
      }
      await pc.setRemoteDescription({ type, sdp });
      if (!incoming) {
        const transceiver = pc.getTransceivers().find(t => t.sender.track?.kind === 'video');
        if (transceiver) await this.applySenderBitrate(transceiver, 8_000_000, 60);
      }
      if (incoming) {
        for (const transceiver of pc.getTransceivers()) {
          transceiver.direction = 'recvonly';
          this.applyH264CodecPreference(transceiver);
        }
        await pc.setLocalDescription(await pc.createAnswer());
        this.invokeSignaling(senderId, JSON.stringify({ isScreen: true, screenDirection: 'in',
          screenSessionId: sessionId, sdp: pc.localDescription }));
      }
      const key = `${senderId}:${incoming ? 'in' : 'out'}:${sessionId}`;
      const queued = this.earlyScreenCandidates.get(key) ?? [];
      this.earlyScreenCandidates.delete(key);
      for (const candidate of queued) await pc.addIceCandidate(candidate);
      return;
    }
    if (payload.candidate) {
      const incoming = payload.screenDirection === 'out';
      const pc = (incoming ? this.screenInPeerConnections : this.screenOutPeerConnections).get(senderId);
      const currentSession = (incoming ? this.screenInSessions : this.screenOutSessions).get(senderId);
      const key = `${senderId}:${incoming ? 'in' : 'out'}:${sessionId}`;
      if (pc?.remoteDescription && (sessionId === 'legacy' || currentSession === sessionId)) {
        await pc.addIceCandidate(payload.candidate);
      } else {
        // ICE can precede the SDP. Keep it for this generation; never create a peer for ICE alone.
        const queue = this.earlyScreenCandidates.get(key) ?? [];
        if (queue.length < 128 && this.earlyScreenCandidates.size < 256) {
          queue.push(payload.candidate);
          this.earlyScreenCandidates.set(key, queue);
        }
      }
    }
  }

  private async processCameraSignalingFromPeer(senderId: number, payload: any): Promise<void> {
    const sessionId: string = payload.cameraSessionId ?? 'legacy';
    if (payload.type === 'cameraStopped') {
      if (this.cameraInSessions.get(senderId) === sessionId) this.removeCameraPeer(senderId);
      return;
    }
    if (payload.sdp) {
      const type: RTCSdpType = typeof payload.sdp === 'object' ? payload.sdp.type : payload.type;
      const sdp = typeof payload.sdp === 'string' ? payload.sdp : payload.sdp.sdp;
      if (type !== 'offer' && type !== 'answer') return;
      const incoming = type === 'offer';
      let pc: RTCPeerConnection;
      if (incoming) {
        this.removeCameraPeer(senderId);
        this.cameraInSessions.set(senderId, sessionId);
        pc = await this.getOrCreateCameraInPeerConnectionAsync(senderId);
      } else {
        const existing = this.cameraOutPeerConnections.get(senderId);
        if (!existing || existing.signalingState !== 'have-local-offer' ||
            (sessionId !== 'legacy' && this.cameraOutSessions.get(senderId) !== sessionId)) return;
        pc = existing;
      }
      await pc.setRemoteDescription({ type, sdp });
      if (!incoming) {
        const transceiver = pc.getTransceivers().find(t => t.sender.track?.kind === 'video');
        if (transceiver) await this.applySenderBitrate(transceiver, 4_500_000);
      }
      if (incoming) {
        for (const transceiver of pc.getTransceivers()) {
          transceiver.direction = 'recvonly';
          this.applyH264CodecPreference(transceiver);
        }
        await pc.setLocalDescription(await pc.createAnswer());
        this.invokeSignaling(senderId, JSON.stringify({ isCamera: true, cameraDirection: 'in',
          cameraSessionId: sessionId, sdp: pc.localDescription }));
      }
      const key = `${senderId}:${incoming ? 'in' : 'out'}:${sessionId}`;
      const queued = this.earlyCameraCandidates.get(key) ?? [];
      this.earlyCameraCandidates.delete(key);
      for (const candidate of queued) await pc.addIceCandidate(candidate);
      return;
    }
    if (payload.candidate) {
      const incoming = payload.cameraDirection === 'out';
      const pc = (incoming ? this.cameraInPeerConnections : this.cameraOutPeerConnections).get(senderId);
      const currentSession = (incoming ? this.cameraInSessions : this.cameraOutSessions).get(senderId);
      const key = `${senderId}:${incoming ? 'in' : 'out'}:${sessionId}`;
      if (pc?.remoteDescription && (sessionId === 'legacy' || currentSession === sessionId)) {
        await pc.addIceCandidate(payload.candidate);
      } else {
        // ICE can precede the SDP. Keep it for this generation; never create a peer for ICE alone.
        const queue = this.earlyCameraCandidates.get(key) ?? [];
        if (queue.length < 128 && this.earlyCameraCandidates.size < 256) {
          queue.push(payload.candidate);
          this.earlyCameraCandidates.set(key, queue);
        }
      }
    }
  }

  private async processMainSignalingFromPeer(senderId: number, payload: any): Promise<void> {
    if (!this.isGroupCall) this.singleCallTargetId = senderId;
    const pc = await this.createPeerConnectionAsync(senderId, false);

    let sdpText: string | null = null;
    let sdpType: RTCSdpType = 'offer';

    if (payload.sdp) {
      sdpText = typeof payload.sdp === 'string' ? payload.sdp : payload.sdp.sdp;
      if (typeof payload.sdp === 'object') {
        sdpType = payload.sdp.type || (payload.type as RTCSdpType) || 'offer';
      } else if (payload.type) {
        sdpType = payload.type;
      }
    }

    if (sdpText && sdpText.includes('v=0')) {
      if (sdpType === 'answer' && pc.signalingState !== 'have-local-offer') return;

      let cleanSdp = sdpText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      let lines = cleanSdp.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

      if (sdpType === 'answer') {
        lines = lines.map((l) => (l.startsWith('a=setup:actpass') ? 'a=setup:active' : l));
      }

      cleanSdp = lines.join('\r\n') + '\r\n';
      await pc.setRemoteDescription(new RTCSessionDescription({ type: sdpType, sdp: cleanSdp }));

      if (sdpType === 'offer') {
        const videoTransceiver = this.cameraTransceiver(pc);
        if (videoTransceiver) {
          this.applyH264CodecPreference(videoTransceiver);
          videoTransceiver.direction = 'sendrecv';

        }

        const answer = await pc.createAnswer();
        const modifiedAnswer = answer.sdp || '';
        await pc.setLocalDescription(new RTCSessionDescription({ type: answer.type, sdp: modifiedAnswer }));
        this.invokeSignaling(senderId, JSON.stringify({ sdp: { type: answer.type, sdp: modifiedAnswer } }));
      }

      if (this.localCameraTrack) await this.startCameraCallWithPeerAsync(senderId);
      if (this.localScreenTrack) await this.startScreenCallWithPeerAsync(senderId);
      this.syncMediaState();
      const queued = this.candidateQueue.get(senderId);
      if (queued && queued.length > 0) {
        for (const cand of queued) {
          try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
        }
        this.candidateQueue.delete(senderId);
      }
      return;
    }

    if (payload.candidate) {
      const candObj = payload.candidate;
      const iceInit: RTCIceCandidateInit = {
        candidate: candObj.candidate,
        sdpMid: candObj.sdpMid ? String(candObj.sdpMid) : '0',
        sdpMLineIndex: candObj.sdpMLineIndex ?? 0,
      };

      if (!pc.remoteDescription) {
        const q = this.candidateQueue.get(senderId) || [];
        q.push(iceInit);
        this.candidateQueue.set(senderId, q);
      } else {
        try { await pc.addIceCandidate(new RTCIceCandidate(iceInit)); } catch {}
      }
    }
  }

  // ================= 4. ГЛАВНОЕ P2P (H.264) =================

  public async initializeWebRTCAsync(): Promise<void> {
    const targetId = this.singleCallTargetId;
    await this.createPeerConnectionAsync(targetId, false);
  }

  public async createPeerConnectionAsync(targetUserId: number, isOfferer: boolean = false): Promise<RTCPeerConnection> {
    if (targetUserId <= 0) throw new Error('Call target is not set');
    const pending = this.peerCreation.get(targetUserId);
    if (pending) return pending;
    const creation = this.createPeer(targetUserId, isOfferer);
    this.peerCreation.set(targetUserId, creation);
    try { return await creation; }
    finally { if (this.peerCreation.get(targetUserId) === creation) this.peerCreation.delete(targetUserId); }
  }

  private async createPeer(targetUserId: number, isOfferer: boolean): Promise<RTCPeerConnection> {
    const existing = this.peerConnections.get(targetUserId);
    if (existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
      return existing;
    }

    const audioStream = await this.initializeLocalCapture();
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);

    audioStream.getAudioTracks().forEach((track) => {
      pc.addTrack(track, audioStream);
    });

    if (isOfferer) {
      const video = pc.addTransceiver('video', { direction: 'sendrecv' });
      this.applyH264CodecPreference(video);
    }

    pc.onicecandidate = (event) => {
      if (this.peerConnections.get(targetUserId) === pc && event.candidate?.candidate) {
        this.invokeSignaling(
          targetUserId,
          JSON.stringify({
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid || '0',
              sdpMLineIndex: event.candidate.sdpMLineIndex ?? 0,
            },
          })
        );
      }
    };

    pc.ontrack = (event) => {
      if (event.track.kind === 'audio') {
        let audioEl = this.remoteAudioElements.get(targetUserId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          this.remoteAudioElements.set(targetUserId, audioEl);
        }
        audioEl.srcObject = new MediaStream([event.track]);
        audioEl.play().catch(() => {});
        return;
      }

      console.log(`%c[WebRTC 📷 Cam In] Принят H.264 поток камеры от пира ${targetUserId}`, 'color: #10B981; font-weight: bold;');
      const freshStream = new MediaStream([event.track]);
      this.remoteCameraStreams.set(Number(targetUserId), freshStream);
      this.notifyRemoteStreams();
    };

    pc.onconnectionstatechange = () => {
      if (this.peerConnections.get(targetUserId) === pc &&
          (pc.connectionState === 'failed' || pc.connectionState === 'closed')) {
        this.removePeer(targetUserId);
      }
    };

    this.peerConnections.set(targetUserId, pc);
    return pc;
  }

  private applyH264CodecPreference(transceiver: RTCRtpTransceiver): void {
    if ('setCodecPreferences' in transceiver && typeof RTCRtpReceiver.getCapabilities === 'function') {
      try {
        const capabilities = RTCRtpReceiver.getCapabilities('video');
        if (capabilities && capabilities.codecs) {
          const h264Codecs = capabilities.codecs.filter((c) => c.mimeType.toLowerCase() === 'video/h264' && c.sdpFmtpLine?.includes('packetization-mode=1'));

          h264Codecs.sort((a, b) => {
            const aFmtp = a.sdpFmtpLine?.toLowerCase() || '';
            const bFmtp = b.sdpFmtpLine?.toLowerCase() || '';
            const aMode1 = aFmtp.includes('packetization-mode=1');
            const bMode1 = bFmtp.includes('packetization-mode=1');
            if (aMode1 && !bMode1) return -1;
            if (!aMode1 && bMode1) return 1;
            return Number(bFmtp.includes('profile-level-id=42e0')) - Number(aFmtp.includes('profile-level-id=42e0'));
          });

          if (h264Codecs.length > 0) {
            transceiver.setCodecPreferences(h264Codecs);
            console.log('%c[WebRTC 🚀 Codec] Кодеки H.264 успешно установлены в приоритет', 'color: #10B981;');
          }
        }
      } catch (e) {
        console.warn('[WebRTC ⚠️ H264] Ошибка setCodecPreferences:', e);
      }
    }
  }

  private cameraTransceiver(pc: RTCPeerConnection): RTCRtpTransceiver | undefined {
    const video = pc.getTransceivers().filter(t => t.currentDirection !== 'stopped' && t.receiver.track.kind === 'video');
    return video.find(t => t.mid !== null) ?? video[0];
  }

  private monitorVideoSender(pc: RTCPeerConnection, peerId: number, source: 'camera' | 'screen'): void {
    let previousBytes = 0;
    let previousTime = 0;
    const timer = setInterval(async () => {
      if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        clearInterval(timer); this.videoMonitors.delete(pc); return;
      }
      if (pc.connectionState !== 'connected') return;
      try {
        const reports = await pc.getStats();
        for (const report of reports.values()) {
          if (report.type !== 'outbound-rtp' || report.kind !== 'video' || report.isRemote) continue;
          const codec = reports.get(report.codecId);
          const elapsed = (report.timestamp - previousTime) / 1000;
          const kbps = previousTime && elapsed > 0 ? Math.round((report.bytesSent - previousBytes) * 8 / elapsed / 1000) : null;
          previousBytes = report.bytesSent; previousTime = report.timestamp;
          console.info('[CallVideo v3]', { peerId, source, codec: codec?.mimeType,
            width: report.frameWidth, height: report.frameHeight, fps: report.framesPerSecond,
            kbps, limitation: report.qualityLimitationReason });
        }
      } catch (error) { console.warn('[CallVideo] Statistics unavailable', error); }
    }, 4000);
    this.videoMonitors.set(pc, timer);
  }

  private withVideoQuality(sdp: string, screen: boolean): string {
    const lines = sdp.split('\r\n');
    const payloads = new Set(lines.filter(l => /^a=rtpmap:\d+ H264\/90000/i.test(l)).map(l => l.split(' ')[0].slice(9)));
    const max = screen ? 8000 : 4500;
    const start = screen ? 6000 : 3000;
    return lines.map(line => {
      const match = /^a=fmtp:(\d+) /.exec(line);
      if (!match || !payloads.has(match[1])) return line;
      return line.replace(/;?x-google-(?:min|start|max)-bitrate=\d+/g, '') +
        `;x-google-start-bitrate=${start};x-google-max-bitrate=${max}`;
    }).join('\r\n');
  }

  private async applySenderBitrate(transceiver: RTCRtpTransceiver, maxBitrateBps: number, maxFramerate: number = 30): Promise<void> {
    if (transceiver.sender && typeof transceiver.sender.getParameters === 'function') {
      try {
        const params = transceiver.sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = maxBitrateBps;
        params.encodings[0].scaleResolutionDownBy = 1.0;
        params.encodings[0].maxFramerate = maxFramerate;
        params.degradationPreference = 'maintain-resolution';
        await transceiver.sender.setParameters(params);
        console.log(`[WebRTC 🚀 Bitrate] Установлен maxBitrate: ${(maxBitrateBps / 1_000_000).toFixed(1)} Mbps`);
      } catch (error) { console.warn('[WebRTC] Video sender parameters were rejected', error); }
    }
  }

  public async startCallWithPeerAsync(targetUserId: number): Promise<void> {
    if (this.offersInProgress.has(targetUserId)) return;
    this.offersInProgress.add(targetUserId);
    try {
      if (!this.isGroupCall) this.singleCallTargetId = targetUserId;
      const pc = await this.createPeerConnectionAsync(targetUserId, true);
      if (pc.localDescription || pc.signalingState !== 'stable') return;
      if (!this.cameraTransceiver(pc)) {
        const transceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
        this.applyH264CodecPreference(transceiver);
      }
      const offer = await pc.createOffer();
      const modifiedOffer = offer.sdp || '';
      await pc.setLocalDescription(new RTCSessionDescription({ type: offer.type, sdp: modifiedOffer }));

      this.invokeSignaling(targetUserId, JSON.stringify({ sdp: { type: offer.type, sdp: modifiedOffer } }));
    } finally { this.offersInProgress.delete(targetUserId); }
  }

  public async startCallAsync(): Promise<void> {
    const targetId = this.singleCallTargetId;
    await this.startCallWithPeerAsync(targetId);
  }

  public async processSignalingData(data: string): Promise<void> {
    const targetId = this.singleCallTargetId;
    await this.processSignalingDataFromPeer(targetId, data);
  }

  public removePeer(userId: number): void {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      this.peerConnections.delete(userId);
      pc.onconnectionstatechange = null;
      try { pc.close(); } catch {}
    }

    this.removeScreenPeer(userId);
    this.removeCameraPeer(userId);

    const outPc = this.screenOutPeerConnections.get(userId);
    if (outPc) {
      try { outPc.close(); } catch {}
      this.screenOutPeerConnections.delete(userId);
    }

    const cameraOut = this.cameraOutPeerConnections.get(userId);
    if (cameraOut) { this.cameraOutPeerConnections.delete(userId); cameraOut.close(); }
    this.cameraOutSessions.delete(userId);
    const audioEl = this.remoteAudioElements.get(userId);
    if (audioEl) {
      audioEl.srcObject = null;
      this.remoteAudioElements.delete(userId);
    }

    const camStream = this.remoteCameraStreams.get(userId);
    if (camStream) {
      camStream.getTracks().forEach((t) => t.stop());
      this.remoteCameraStreams.delete(userId);
    }

    this.candidateQueue.delete(userId);
    this.notifyRemoteStreams();
  }

  public async cleanup(): Promise<void> {
    ++this.generation;
    for (const timer of this.videoMonitors.values()) clearInterval(timer);
    this.videoMonitors.clear();
    this.signalQueue.clear();
    this.peerCreation.clear();
    this.offersInProgress.clear();
    this.earlyScreenCandidates.clear();
    this.screenInSessions.clear();
    this.cameraInSessions.clear();
    this.earlyCameraCandidates.clear();
    for (const pc of this.cameraInPeerConnections.values()) pc.close();
    this.cameraInPeerConnections.clear();
    this.capturePromise = null;
    await this.stopCamera();
    await this.stopScreenShare();

    for (const pc of this.peerConnections.values()) {
      try { pc.close(); } catch {}
    }
    this.peerConnections.clear();
    this.candidateQueue.clear();

    for (const pc of this.screenOutPeerConnections.values()) {
      try { pc.close(); } catch {}
    }
    this.screenOutPeerConnections.clear();

    for (const pc of this.screenInPeerConnections.values()) {
      try { pc.close(); } catch {}
    }
    this.screenInPeerConnections.clear();

    this.remoteAudioElements.forEach((el) => { el.srcObject = null; });
    this.remoteAudioElements.clear();

    this.remoteCameraStreams.forEach((stream) => stream.getTracks().forEach((t) => t.stop()));
    this.remoteCameraStreams.clear();

    this.remoteScreenStreams.forEach((stream) => stream.getTracks().forEach((t) => t.stop()));
    this.remoteScreenStreams.clear();
    this.notifyRemoteStreams();

    if (this.localAudioStream) {
      this.localAudioStream.getTracks().forEach((t) => t.stop());
      this.localAudioStream = null;
    }

    this.emitLocalStreams();
    this.singleCallTargetId = 0;
    this.currentGroupId = 0;
    this.isGroupCall = false;
    this.isMuted = false;
  }

  private emitLocalStreams(): void {
    if (this.onLocalStreamsUpdated) {
      this.onLocalStreamsUpdated(this.localCameraStream, this.localScreenStream);
    }
  }

  private notifyRemoteStreams(): void {
    if (this.onRemoteStreamsUpdated) {
      this.onRemoteStreamsUpdated(new Map(this.remoteCameraStreams), new Map(this.remoteScreenStreams));
    }
  }

  private syncMediaState(): void {
    const isVideo = Boolean(this.localCameraTrack && this.localCameraTrack.readyState === 'live');
    const isScreen = Boolean(this.localScreenTrack && this.localScreenTrack.readyState === 'live');

    const state = JSON.stringify({ type: 'mediaState', isMuted: this.isMuted, isVideoOn: isVideo, isScreenSharing: isScreen });
    for (const peerId of this.peerConnections.keys()) this.invokeSignaling(peerId, state);

    if (this.isGroupCall && this.currentGroupId > 0) {
      void signalRService.invokeAsync(
        'UpdateGroupCallMediaState',
        this.currentGroupId,
        this.isMuted,
        isVideo,
        isScreen
      );
    } else if (!this.isGroupCall && this.singleCallTargetId > 0) {
      void signalRService.invokeAsync(
        'UpdateCallMediaState',
        this.singleCallTargetId,
        this.isMuted,
        isVideo,
        isScreen
      );
    }
  }

  private invokeSignaling(targetUserId: number, data: string): void {
    if (this.sendSignalingData) {
      void Promise.resolve(this.sendSignalingData(targetUserId, data)).catch(error => console.error('[WebRTC] Signaling failed', error));
      return;
    }

    if (this.isGroupCall) {
      signalRService.sendGroupCallWebRTCDataAsync(this.currentGroupId, targetUserId, data).catch(() => {});
    } else {
      signalRService.sendWebRTCDataAsync(targetUserId, data).catch(() => {});
    }
  }
}

export const webRtcCallService = new WebRtcCallService();
export default webRtcCallService;
