import { signalRService } from './signalr.service';
import { webrtcAudioService } from './webrtcAudio.service';

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

  // 🟢 Изолированные экранные каналы H.264
  private screenOutPeerConnections: Map<number, RTCPeerConnection> = new Map();
  private screenOutCandidateQueue: Map<number, RTCIceCandidateInit[]> = new Map();

  private screenInPeerConnections: Map<number, RTCPeerConnection> = new Map();
  private screenInCandidateQueue: Map<number, RTCIceCandidateInit[]> = new Map();
  public remoteScreenStreams: Map<number, MediaStream> = new Map();

  private localAudioStream: MediaStream | null = null;
  public localCameraStream: MediaStream | null = null;
  public localCameraTrack: MediaStreamTrack | null = null;
  public localScreenStream: MediaStream | null = null;
  public localScreenTrack: MediaStreamTrack | null = null;

  private singleCallTargetId: number = 0;
  private isGroupCall: boolean = false;
  private currentGroupId: number = 0;
  private isMuted: boolean = false;

  public sendSignalingData: ((targetUserId: number, data: string) => void) | null = null;
  public onRemoteStreamsUpdated: ((cameras: Map<number, MediaStream>, screens: Map<number, MediaStream>) => void) | null = null;
  public onLocalStreamsUpdated: ((camera: MediaStream | null, screen: MediaStream | null) => void) | null = null;

  public setCallContext(isGroup: boolean, groupId: number, singleTargetId: number = 0): void {
    console.log(`%c[WebRTC 📞 Context] isGroup=${isGroup}, groupId=${groupId}, singleTarget=${singleTargetId}`, 'color: #38BDF8; font-weight: bold;');
    this.isGroupCall = isGroup;
    this.currentGroupId = groupId;
    this.singleCallTargetId = singleTargetId;
  }

  public async initializeLocalCapture(): Promise<MediaStream> {
    if (this.localAudioStream && this.localAudioStream.active) return this.localAudioStream;

    try {
      if (webrtcAudioService && typeof webrtcAudioService.getOptimizedAudioStream === 'function') {
        this.localAudioStream = await webrtcAudioService.getOptimizedAudioStream();
      } else {
        this.localAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
      }
    } catch {
      this.localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }

    this.localAudioStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted;
    });

    return this.localAudioStream;
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

      this.localCameraStream = camStream;
      const track = camStream.getVideoTracks()[0];
      if ('contentHint' in track) {
        track.contentHint = 'motion';
      }
      this.localCameraTrack = track;

      track.onended = () => { void this.stopCamera(); };

      for (const [, pc] of this.peerConnections.entries()) {
        try {
          const videoTransceiver = pc.getTransceivers().find((t) => t.receiver?.track?.kind === 'video');
          if (videoTransceiver && videoTransceiver.sender) {
            await videoTransceiver.sender.replaceTrack(track);
            await this.applySenderBitrate(videoTransceiver, 3_500_000);
          }
        } catch {}
      }

      this.emitLocalStreams();
      this.syncMediaState();
      return track;
    } catch (e) {
      console.error('[WebRTC ❌ Cam] Ошибка включения камеры:', e);
      return null;
    }
  }

  public async stopCamera(): Promise<void> {
    console.log('%c[WebRTC 📷 Cam] Остановка камеры...', 'color: #6B7280;');
    if (this.localCameraStream) {
      this.localCameraStream.getTracks().forEach((t) => { t.enabled = false; t.stop(); });
      this.localCameraStream = null;
    }

    if (this.localCameraTrack) {
      this.localCameraTrack.enabled = false;
      this.localCameraTrack.stop();
      this.localCameraTrack = null;
    }

    for (const [, pc] of this.peerConnections.entries()) {
      try {
        const videoTransceiver = pc.getTransceivers().find((t) => t.receiver?.track?.kind === 'video');
        if (videoTransceiver && videoTransceiver.sender) {
          await videoTransceiver.sender.replaceTrack(null);
        }
      } catch {}
    }

    this.emitLocalStreams();
    this.syncMediaState();
  }

  // ================= 2. ЭКРАН (H.264 @ 8.0 Mbps 60 FPS) =================

  public async startScreenShare(): Promise<MediaStreamTrack | null> {
    try {
      console.log('%c[WebRTC 🖥️ Screen Out] Запуск экрана на 60 FPS...', 'color: #9B51E0; font-weight: bold;');
      if (this.localScreenStream) {
        this.localScreenStream.getTracks().forEach((t) => t.stop());
        this.localScreenStream = null;
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
        },
        audio: false,
      });

      this.localScreenStream = screenStream;
      const track = screenStream.getVideoTracks()[0];

      if ('contentHint' in track) {
        track.contentHint = 'detail';
      }
      this.localScreenTrack = track;

      track.onended = () => {
        console.log('%c[WebRTC 🖥️ Screen Out] Пользователь остановил трансляцию в браузере', 'color: #F59E0B;');
        void this.stopScreenShare();
      };

      const activePeerIds = Array.from(this.peerConnections.keys());
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
        pc.close();
      } catch {}
    }
    this.screenOutPeerConnections.clear();
    this.screenOutCandidateQueue.clear();

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
    this.screenInCandidateQueue.delete(peerId);

    const stream = this.remoteScreenStreams.get(peerId);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      this.remoteScreenStreams.delete(peerId);
      this.notifyRemoteStreams();
    }
  }

  public async startScreenCallWithPeerAsync(targetUserId: number): Promise<void> {
    try {
      console.log(`%c[WebRTC 🖥️ Screen Out] Создание H.264 Offer экрана к пиру ${targetUserId}`, 'color: #9B51E0;');
      const pc = await this.getOrCreateScreenOutPeerConnectionAsync(targetUserId, true);
      const offer = await pc.createOffer();
      
      const modifiedSdp = this.enforceSdpBitrate(offer.sdp || '', true);
      await pc.setLocalDescription(new RTCSessionDescription({ type: offer.type, sdp: modifiedSdp }));

      this.invokeSignaling(
        targetUserId,
        JSON.stringify({
          isScreen: true,
          screenDirection: 'out',
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
      this.screenOutCandidateQueue.delete(targetUserId);
    }

    console.log(`[WebRTC 🖥️ Screen Out] Новый сокет к пиру ${targetUserId} (H.264)`);
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);

    if (this.localScreenTrack && this.localScreenTrack.readyState === 'live') {
      const transceiver = pc.addTransceiver(this.localScreenTrack, {
        direction: 'sendrecv',
        streams: [new MediaStream([this.localScreenTrack])],
      });
      this.applyH264CodecPreference(transceiver);
      void this.applySenderBitrate(transceiver, 8_000_000);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && event.candidate.candidate && !event.candidate.candidate.includes('0.0.0.0')) {
        this.invokeSignaling(
          targetUserId,
          JSON.stringify({
            isScreen: true,
            screenDirection: 'out',
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
      this.screenInCandidateQueue.delete(senderId);
    }

    console.log(`[WebRTC 🖥️ Screen In] Новый сокет приема H.264 экрана от пира ${senderId}`);
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);
    const transceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
    this.applyH264CodecPreference(transceiver);

    pc.onicecandidate = (event) => {
      if (event.candidate && event.candidate.candidate && !event.candidate.candidate.includes('0.0.0.0')) {
        this.invokeSignaling(
          senderId,
          JSON.stringify({
            isScreen: true,
            screenDirection: 'in',
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

  public async processSignalingDataFromPeer(senderId: number, data: string): Promise<void> {
    try {
      let payload: any = data;
      while (typeof payload === 'string' && (payload.startsWith('{') || payload.startsWith('['))) {
        try { payload = JSON.parse(payload); } catch { break; }
      }

      if (!payload || typeof payload !== 'object') return;

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
    const isIncomingOffer = Boolean(payload.sdp && (payload.sdp.type === 'offer' || payload.type === 'offer'));

    const pc = isIncomingOffer
      ? await this.getOrCreateScreenInPeerConnectionAsync(senderId, true)
      : await this.getOrCreateScreenOutPeerConnectionAsync(senderId, false);

    // 🟢 СТАЛО (устраняет InvalidStateError: Called in wrong state: stable):
if (payload.sdp) {
  const sdpText = typeof payload.sdp === 'string' ? payload.sdp : payload.sdp.sdp;
  const sdpType: RTCSdpType = typeof payload.sdp === 'object' ? payload.sdp.type || 'offer' : 'offer';

  // Игнорируем Answer, если соединение уже стабильно
  if (sdpType === 'answer' && pc.signalingState !== 'have-local-offer') {
    return;
  }

  console.log(`[WebRTC 🖥️ Screen] Установка H.264 ${sdpType.toUpperCase()} от ${senderId}`);
  await pc.setRemoteDescription(new RTCSessionDescription({ type: sdpType, sdp: sdpText }));

      // Гарантируем сохранение настроек битрейта после установки ответа
      if (!isIncomingOffer && this.localScreenTrack) {
        const vt = pc.getTransceivers().find((t) => t.sender?.track === this.localScreenTrack);
        if (vt) {
          void this.applySenderBitrate(vt, 8_000_000);
        }
      }

      if (sdpType === 'offer') {
        const answer = await pc.createAnswer();
        const modifiedAnswerSdp = this.enforceSdpBitrate(answer.sdp || '', true);
        await pc.setLocalDescription(new RTCSessionDescription({ type: answer.type, sdp: modifiedAnswerSdp }));

        console.log(`[WebRTC 🖥️ Screen In] Отправка Answer экрану пира ${senderId}`);
        this.invokeSignaling(
          senderId,
          JSON.stringify({
            isScreen: true,
            screenDirection: 'in',
            sdp: { type: answer.type, sdp: modifiedAnswerSdp },
          })
        );
      }

      const qDict = isIncomingOffer ? this.screenInCandidateQueue : this.screenOutCandidateQueue;
      const queued = qDict.get(senderId);
      if (queued && queued.length > 0) {
        for (const cand of queued) {
          try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
        }
        qDict.delete(senderId);
      }
    // 🟢 СТАЛО (чёткая маршрутизация по направлению и приведение ID к числу):
    } else if (payload.candidate) {
      const numSenderId = Number(senderId);
      const candObj = payload.candidate;
      const iceInit: RTCIceCandidateInit = {
        candidate: candObj.candidate,
        sdpMid: candObj.sdpMid ? String(candObj.sdpMid) : '0',
        sdpMLineIndex: candObj.sdpMLineIndex !== undefined ? Number(candObj.sdpMLineIndex) : 0,
      };

      // Если собеседник приемник (in) — значит мы отправитель (ScreenOut)!
      const isTargetIn = payload.screenDirection === 'out';
      const targetPc = isTargetIn
        ? await this.getOrCreateScreenInPeerConnectionAsync(numSenderId, false)
        : await this.getOrCreateScreenOutPeerConnectionAsync(numSenderId, false);

      if (!targetPc.remoteDescription) {
        const qDict = isTargetIn ? this.screenInCandidateQueue : this.screenOutCandidateQueue;
        const q = qDict.get(numSenderId) || [];
        q.push(iceInit);
        qDict.set(numSenderId, q);
      } else {
        try { await targetPc.addIceCandidate(new RTCIceCandidate(iceInit)); } catch {}
      }
    }
  }

  private async processMainSignalingFromPeer(senderId: number, payload: any): Promise<void> {
    this.singleCallTargetId = senderId;
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
        lines = lines
          .filter((l) => !l.startsWith('a=ssrc:'))
          .map((l) => (l.startsWith('a=setup:actpass') ? 'a=setup:active' : l));
      }

      cleanSdp = lines.join('\r\n') + '\r\n';
      await pc.setRemoteDescription(new RTCSessionDescription({ type: sdpType, sdp: cleanSdp }));

      if (sdpType === 'offer') {
        const videoTransceiver = pc.getTransceivers().find((t) => t.receiver?.track?.kind === 'video');
        if (videoTransceiver) {
          this.applyH264CodecPreference(videoTransceiver);
          videoTransceiver.direction = 'sendrecv';
          if (this.localCameraTrack && this.localCameraTrack.readyState === 'live') {
            await videoTransceiver.sender.replaceTrack(this.localCameraTrack);
            void this.applySenderBitrate(videoTransceiver, 3_500_000);
          }
        }

        const answer = await pc.createAnswer();
        const modifiedAnswer = this.enforceSdpBitrate(answer.sdp || '', false);
        await pc.setLocalDescription(new RTCSessionDescription({ type: answer.type, sdp: modifiedAnswer }));
        this.invokeSignaling(senderId, JSON.stringify({ sdp: { type: answer.type, sdp: modifiedAnswer } }));
      }

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
        sdpMLineIndex: candObj.sdpMLineIndex !== undefined ? Number(candObj.sdpMLineIndex) : 0,
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
    const targetId = this.singleCallTargetId !== 0 ? this.singleCallTargetId : 1;
    await this.createPeerConnectionAsync(targetId, true);
  }

  // СТАЛО (убрана лишняя переменная):
public async createPeerConnectionAsync(targetUserId: number, isOfferer: boolean = false): Promise<RTCPeerConnection> {
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
      const activeCam = this.localCameraTrack && this.localCameraTrack.readyState === 'live' ? this.localCameraTrack : null;
      let videoTransceiver: RTCRtpTransceiver;
      if (activeCam) {
        videoTransceiver = pc.addTransceiver(activeCam, {
          direction: 'sendrecv',
          streams: [new MediaStream([activeCam])],
        });
      } else {
        videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
      }
      this.applyH264CodecPreference(videoTransceiver);
      void this.applySenderBitrate(videoTransceiver, 3_500_000);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && event.candidate.candidate && !event.candidate.candidate.includes('0.0.0.0')) {
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
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
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
          const h264Codecs = capabilities.codecs.filter((c) => c.mimeType.toLowerCase() === 'video/h264');

          h264Codecs.sort((a, b) => {
            const aFmtp = a.sdpFmtpLine?.toLowerCase() || '';
            const bFmtp = b.sdpFmtpLine?.toLowerCase() || '';
            const aMode1 = aFmtp.includes('packetization-mode=1');
            const bMode1 = bFmtp.includes('packetization-mode=1');
            if (aMode1 && !bMode1) return -1;
            if (!aMode1 && bMode1) return 1;
            return 0;
          });

          const otherCodecs = capabilities.codecs.filter((c) => c.mimeType.toLowerCase() !== 'video/h264');
          if (h264Codecs.length > 0) {
            transceiver.setCodecPreferences([...h264Codecs, ...otherCodecs]);
            console.log('%c[WebRTC 🚀 Codec] Кодеки H.264 успешно установлены в приоритет', 'color: #10B981;');
          }
        }
      } catch (e) {
        console.warn('[WebRTC ⚠️ H264] Ошибка setCodecPreferences:', e);
      }
    }
  }

  // 🟢 Форсируем минимальный и стартовый битрейт для обхода BWE-ограничения Chrome в 300 кбит/с
  private enforceSdpBitrate(sdp: string, isScreen: boolean): string {
    if (!sdp) return sdp;
    const maxKbps = isScreen ? 8000 : 3500;
    const minKbps = isScreen ? 5000 : 2000;
    const startKbps = isScreen ? 7000 : 3000;

    const lines = sdp.split('\r\n');
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Внедряем параметры x-google прямо в a=fmtp кодека
      if (line.startsWith('a=fmtp:')) {
        if (!line.includes('x-google-min-bitrate')) {
          line = `${line};x-google-min-bitrate=${minKbps};x-google-start-bitrate=${startKbps};x-google-max-bitrate=${maxKbps}`;
        }
      }

      result.push(line);

      if (line.startsWith('m=video')) {
        result.push(`b=AS:${maxKbps}`);
        result.push(`b=TIAS:${maxKbps * 1000}`);
      }
    }

    return result.join('\r\n');
  }

  private async applySenderBitrate(transceiver: RTCRtpTransceiver, maxBitrateBps: number): Promise<void> {
    if (transceiver.sender && typeof transceiver.sender.getParameters === 'function') {
      try {
        const params = transceiver.sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = maxBitrateBps;
        params.encodings[0].scaleResolutionDownBy = 1.0;
        await transceiver.sender.setParameters(params);
        console.log(`[WebRTC 🚀 Bitrate] Установлен maxBitrate: ${(maxBitrateBps / 1_000_000).toFixed(1)} Mbps`);
      } catch {}
    }
  }

  public async startCallWithPeerAsync(targetUserId: number): Promise<void> {
    this.singleCallTargetId = targetUserId;
    const pc = await this.createPeerConnectionAsync(targetUserId, true);
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    const modifiedOffer = this.enforceSdpBitrate(offer.sdp || '', false);
    await pc.setLocalDescription(new RTCSessionDescription({ type: offer.type, sdp: modifiedOffer }));

    this.invokeSignaling(targetUserId, JSON.stringify({ sdp: { type: offer.type, sdp: modifiedOffer } }));
  }

  public async startCallAsync(): Promise<void> {
    const targetId = this.singleCallTargetId !== 0 ? this.singleCallTargetId : 1;
    await this.startCallWithPeerAsync(targetId);
  }

  public async processSignalingData(data: string): Promise<void> {
    const targetId = this.singleCallTargetId !== 0 ? this.singleCallTargetId : 1;
    await this.processSignalingDataFromPeer(targetId, data);
  }

  public removePeer(userId: number): void {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      try { pc.close(); } catch {}
      this.peerConnections.delete(userId);
    }

    this.removeScreenPeer(userId);

    const outPc = this.screenOutPeerConnections.get(userId);
    if (outPc) {
      try { outPc.close(); } catch {}
      this.screenOutPeerConnections.delete(userId);
    }
    this.screenOutCandidateQueue.delete(userId);

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
    this.screenOutCandidateQueue.clear();

    for (const pc of this.screenInPeerConnections.values()) {
      try { pc.close(); } catch {}
    }
    this.screenInPeerConnections.clear();
    this.screenInCandidateQueue.clear();

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
    if (webrtcAudioService && typeof webrtcAudioService.stopStream === 'function') {
      webrtcAudioService.stopStream();
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
    if (this.isGroupCall && this.currentGroupId > 0) {
      const isVideo = Boolean(this.localCameraTrack && this.localCameraTrack.readyState === 'live');
      const isScreen = Boolean(this.localScreenTrack && this.localScreenTrack.readyState === 'live');
      void signalRService.invokeAsync(
        'UpdateGroupCallMediaState',
        this.currentGroupId,
        this.isMuted,
        isVideo,
        isScreen
      );
    }
  }

  private invokeSignaling(targetUserId: number, data: string): void {
    if (this.sendSignalingData) {
      this.sendSignalingData(targetUserId, data);
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

export class BandlimitedSincResampler {
  private readonly taps = 32;
  private readonly step: number;
  private readonly cutoff: number;
  private readonly history: Float32Array;
  private fractionalPos: number = 0;
  private historyPos: number = 0;

  constructor(private readonly sourceRate: number, private readonly targetRate: number) {
    this.step = sourceRate / targetRate;
    this.cutoff = Math.min(1.0, targetRate / sourceRate) * 0.95;
    this.history = new Float32Array(this.taps * 2);
  }

  public processSample(currentSample: number, outputSink: (sample: number) => void): void {
    if (this.sourceRate === this.targetRate) {
      outputSink(currentSample);
      return;
    }

    this.history[this.historyPos] = currentSample;
    this.history[this.historyPos + this.taps] = currentSample;
    this.historyPos = (this.historyPos + 1) % this.taps;

    while (this.fractionalPos < 1.0) {
      const interpolated = this.calculateSincSample(this.fractionalPos);
      outputSink(interpolated);
      this.fractionalPos += this.step;
    }

    this.fractionalPos -= 1.0;
  }

  private calculateSincSample(frac: number): number {
    let sum = 0;
    let weightSum = 0;
    const center = this.historyPos + this.taps - 1;

    for (let i = 0; i < this.taps; i++) {
      const x = i - (this.taps / 2 - 1) - frac;
      const sinc = this.sinc(x * this.cutoff);
      const window = this.blackmanHarrisWindow(i / (this.taps - 1));
      const weight = sinc * window;

      sum += this.history[center - i] * weight;
      weightSum += weight;
    }

    return weightSum > 0.0001 ? sum / weightSum : sum;
  }

  private sinc(x: number): number {
    if (Math.abs(x) < 1e-5) return 1.0;
    const px = Math.PI * x;
    return Math.sin(px) / px;
  }

  private blackmanHarrisWindow(t: number): number {
    const a0 = 0.35875;
    const a1 = 0.48829;
    const a2 = 0.14128;
    const a3 = 0.01168;
    const twoPi = 2.0 * Math.PI;

    return (
      a0 -
      a1 * Math.cos(twoPi * t) +
      a2 * Math.cos(2.0 * twoPi * t) -
      a3 * Math.cos(3.0 * twoPi * t)
    );
  }
}

export class WebRtcAudioService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;

  public async getOptimizedAudioStream(): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1,
      },
      video: false,
    };

    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    return this.mediaStream;
  }

  public stopStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const webrtcAudioService = new WebRtcAudioService();