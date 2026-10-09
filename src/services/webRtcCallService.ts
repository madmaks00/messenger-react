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
  // 🟢 Канал 1: Аудио + Камера лица
  private peerConnections: Map<number, RTCPeerConnection> = new Map();
  public remoteCameraStreams: Map<number, MediaStream> = new Map();
  private candidateQueue: Map<number, RTCIceCandidateInit[]> = new Map();
  private remoteAudioElements: Map<number, HTMLAudioElement> = new Map();

  // 🟢 Канал 2: Экран (по требованию)
  private screenPeerConnections: Map<number, RTCPeerConnection> = new Map();
  public remoteScreenStreams: Map<number, MediaStream> = new Map();
  private screenCandidateQueue: Map<number, RTCIceCandidateInit[]> = new Map();

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

    console.log('%c[WebRTC 🎙️ Audio] Инициализация микрофона...', 'color: #F59E0B;');
    try {
      if (webrtcAudioService && typeof webrtcAudioService.getOptimizedAudioStream === 'function') {
        this.localAudioStream = await webrtcAudioService.getOptimizedAudioStream();
      } else {
        this.localAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
      }
    } catch (e) {
      console.warn('[WebRTC ⚠️ Audio fallback] Дефолтный захват микрофона:', e);
      this.localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }

    this.localAudioStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted;
    });

    console.log('%c[WebRTC 🎙️ Audio] Микрофон успешно захвачен.', 'color: #10B981;');
    return this.localAudioStream;
  }

  public setMute(muted: boolean): void {
    this.isMuted = muted;
    console.log(`%c[WebRTC 🎙️ Mute] Состояние: ${muted ? 'MUTED' : 'UNMUTED'}`, 'color: #EF4444;');
    if (this.localAudioStream) {
      this.localAudioStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    this.syncMediaState();
  }

  // ================= 1. КАМЕРА =================

  public async startCamera(): Promise<MediaStreamTrack | null> {
    try {
      console.log('%c[WebRTC 📷 Cam] Включение веб-камеры...', 'color: #3B82F6; font-weight: bold;');
      if (this.localCameraStream) {
        this.localCameraStream.getTracks().forEach((t) => t.stop());
        this.localCameraStream = null;
      }

      const camStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 }, frameRate: { ideal: 30 } },
        audio: false,
      });

      this.localCameraStream = camStream;
      const track = camStream.getVideoTracks()[0];
      this.localCameraTrack = track;

      track.onended = () => {
        console.warn('[WebRTC 📷 Cam] Трек камеры остановлен ОС');
        void this.stopCamera();
      };

      // 🟢 1. Находим единственный реальный видео-трансивер и привязываем живой трек камеры
      for (const [peerId, pc] of this.peerConnections.entries()) {
        try {
          const videoTransceiver = pc.getTransceivers().find(
            (t) => t.receiver?.track?.kind === 'video'
          );

          if (videoTransceiver && videoTransceiver.sender) {
            console.log(`[WebRTC 📷 Cam] Привязка трека камеры к видео-трансиверу пира ${peerId}`);
            await videoTransceiver.sender.replaceTrack(track);
            videoTransceiver.direction = 'sendrecv';

            // 🟢 2. Отправляем Re-Offer: теперь оффер будет содержать честный a=sendrecv без дублей!
            console.log(`%c[WebRTC 📷 Cam Re-Offer] Отправка Re-Offer камеры пиру ${peerId}`, 'color: #3B82F6;');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            this.invokeSignaling(
              peerId,
              JSON.stringify({
                sdp: { type: offer.type, sdp: offer.sdp },
              })
            );
          }
        } catch (renegErr) {
          console.error(`[WebRTC ❌ Cam Re-Offer] Ошибка ренеготиации камеры для пира ${peerId}:`, renegErr);
        }
      }

      this.emitLocalStreams();
      this.syncMediaState();
      console.log('%c[WebRTC 📷 Cam] Камера успешно запущена и согласована с пирами.', 'color: #10B981;');
      return track;
    } catch (e) {
      console.error('[WebRTC ❌ Cam] Ошибка включения веб-камеры:', e);
      return null;
    }
  }

  public async stopCamera(): Promise<void> {
    console.log('%c[WebRTC 📷 Cam] Остановка веб-камеры...', 'color: #6B7280;');
    if (this.localCameraStream) {
      this.localCameraStream.getTracks().forEach((t) => {
        t.enabled = false;
        t.stop();
      });
      this.localCameraStream = null;
    }

    if (this.localCameraTrack) {
      this.localCameraTrack.enabled = false;
      this.localCameraTrack.stop();
      this.localCameraTrack = null;
    }

    for (const [peerId, pc] of this.peerConnections.entries()) {
      try {
        const videoTransceiver = pc.getTransceivers().find(
          (t) => t.receiver?.track?.kind === 'video'
        );
        if (videoTransceiver && videoTransceiver.sender) {
          await videoTransceiver.sender.replaceTrack(null);
          videoTransceiver.direction = 'recvonly';

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          this.invokeSignaling(
            peerId,
            JSON.stringify({
              sdp: { type: offer.type, sdp: offer.sdp },
            })
          );
        }
      } catch {}
    }

    this.emitLocalStreams();
    this.syncMediaState();
  }

  // ================= 2. ЭКРАН =================

  public async startScreenShare(): Promise<MediaStreamTrack | null> {
    try {
      console.log('%c[WebRTC 🖥️ Screen] Запрос демонстрации экрана...', 'color: #9B51E0; font-weight: bold;');
      if (this.localScreenStream) {
        this.localScreenStream.getTracks().forEach((t) => t.stop());
        this.localScreenStream = null;
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', frameRate: { ideal: 30 } },
        audio: false,
      });

      this.localScreenStream = screenStream;
      const track = screenStream.getVideoTracks()[0];
      this.localScreenTrack = track;

      track.onended = () => {
        console.log('[WebRTC 🖥️ Screen] Пользователь остановил трансляцию в браузере');
        void this.stopScreenShare();
      };

      const activePeerIds = Array.from(this.peerConnections.keys());
      for (const peerId of activePeerIds) {
        await this.startScreenCallWithPeerAsync(peerId);
      }

      this.emitLocalStreams();
      this.syncMediaState();
      console.log('%c[WebRTC 🖥️ Screen] Экран запущен и отправлен всем пирам.', 'color: #10B981;');
      return track;
    } catch (e) {
      console.error('[WebRTC ❌ Screen] Ошибка запуска экрана:', e);
      return null;
    }
  }

  public async stopScreenShare(): Promise<void> {
    console.log('%c[WebRTC 🖥️ Screen] Остановка демонстрации экрана...', 'color: #6B7280;');
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((t) => {
        t.enabled = false;
        t.stop();
      });
      this.localScreenStream = null;
    }

    if (this.localScreenTrack) {
      this.localScreenTrack.enabled = false;
      this.localScreenTrack.stop();
      this.localScreenTrack = null;
    }

    for (const [peerId, pc] of this.screenPeerConnections.entries()) {
      try {
        console.log(`[WebRTC 🖥️ Screen] Закрытие экранного PC для пира ${peerId}`);
        pc.close();
      } catch {}
    }
    this.screenPeerConnections.clear();
    this.screenCandidateQueue.clear();

    this.emitLocalStreams();
    this.syncMediaState();
  }

  public removeScreenPeer(peerId: number): void {
    console.log(`%c[WebRTC 🖥️ Screen Cleanup] Сброс экрана пира ${peerId}`, 'color: #E11D48;');
    const pc = this.screenPeerConnections.get(peerId);
    if (pc) {
      try { pc.close(); } catch {}
      this.screenPeerConnections.delete(peerId);
    }
    this.screenCandidateQueue.delete(peerId);

    const stream = this.remoteScreenStreams.get(peerId);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      this.remoteScreenStreams.delete(peerId);
      this.notifyRemoteStreams();
    }
  }

  public async startScreenCallWithPeerAsync(targetUserId: number): Promise<void> {
    try {
      console.log(`%c[WebRTC 🖥️ Screen Out] Создание экранного Offer к пиру ${targetUserId}`, 'color: #9B51E0;');
      const pc = await this.getOrCreateScreenPeerConnectionAsync(targetUserId, true, true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.invokeSignaling(
        targetUserId,
        JSON.stringify({
          isScreen: true,
          sdp: { type: offer.type, sdp: offer.sdp },
        })
      );
    } catch (ex) {
      console.error(`[WebRTC ❌ Screen Out] Сбой создания Offer экрана к ${targetUserId}:`, ex);
    }
  }

  public async getOrCreateScreenPeerConnectionAsync(
    targetUserId: number,
    isOfferer: boolean = false,
    forceRecreate: boolean = false
  ): Promise<RTCPeerConnection> {
    const existing = this.screenPeerConnections.get(targetUserId);
    if (!forceRecreate && existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
      return existing;
    }

    if (existing) {
      try { existing.close(); } catch {}
      this.screenPeerConnections.delete(targetUserId);
      this.screenCandidateQueue.delete(targetUserId);
    }

    console.log(`[WebRTC 🖥️ Screen] Создание сокета экрана (isOfferer=${isOfferer}, Peer=${targetUserId})`);
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);

    let transceiver: RTCRtpTransceiver;
    if (isOfferer && this.localScreenTrack && this.localScreenTrack.readyState === 'live') {
      transceiver = pc.addTransceiver(this.localScreenTrack, {
        direction: 'sendrecv',
        streams: [new MediaStream([this.localScreenTrack])],
      });
    } else {
      transceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
    }

    this.applyVp8CodecPreference(transceiver);

    pc.onicecandidate = (event) => {
      if (event.candidate && event.candidate.candidate && !event.candidate.candidate.includes('0.0.0.0')) {
        this.invokeSignaling(
          targetUserId,
          JSON.stringify({
            isScreen: true,
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
      console.log(`%c[WebRTC 🖥️ Screen In] Принят трек экрана от пира ${targetUserId}`, 'color: #10B981; font-weight: bold;');
      let stream = this.remoteScreenStreams.get(targetUserId);
      if (!stream) {
        stream = new MediaStream();
        this.remoteScreenStreams.set(targetUserId, stream);
      }
      stream.getTracks().forEach((t) => stream!.removeTrack(t));
      stream.addTrack(event.track);
      this.notifyRemoteStreams();
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC 🖥️ Screen] ConnectionState пира ${targetUserId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.removeScreenPeer(targetUserId);
      }
    };

    this.screenPeerConnections.set(targetUserId, pc);
    return pc;
  }

  // ================= 3. РАЗБОР СИГНАЛОВ =================

  public async processSignalingDataFromPeer(senderId: number, data: string): Promise<void> {
    try {
      let payload: any = data;
      while (typeof payload === 'string' && (payload.startsWith('{') || payload.startsWith('['))) {
        try {
          payload = JSON.parse(payload);
        } catch {
          break;
        }
      }

      if (!payload || typeof payload !== 'object') return;

      if (payload.isScreen === true) {
        await this.processScreenSignalingFromPeer(senderId, payload);
        return;
      }

      await this.processMainSignalingFromPeer(senderId, payload);
    } catch (ex) {
      console.error(`[WebRTC ❌] Ошибка разбора сигнала от пира ${senderId}:`, ex);
    }
  }

  private async processScreenSignalingFromPeer(senderId: number, payload: any): Promise<void> {
    const isIncomingOffer = Boolean(payload.sdp && (payload.sdp.type === 'offer' || payload.type === 'offer'));
    const pc = await this.getOrCreateScreenPeerConnectionAsync(senderId, false, isIncomingOffer);

    if (payload.sdp) {
      const sdpText = typeof payload.sdp === 'string' ? payload.sdp : payload.sdp.sdp;
      const sdpType: RTCSdpType = typeof payload.sdp === 'object' ? payload.sdp.type || 'offer' : 'offer';

      if (sdpType === 'answer' && pc.signalingState !== 'have-local-offer') {
        console.warn(`[WebRTC ⚠️ Screen] Пропуск Answer экрана от ${senderId}: состояние ${pc.signalingState}`);
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription({ type: sdpType, sdp: sdpText }));
      console.log(`[WebRTC 🖥️ Screen] RemoteDescription (${sdpType}) установлен для ${senderId}`);

      if (sdpType === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.invokeSignaling(
          senderId,
          JSON.stringify({
            isScreen: true,
            sdp: { type: answer.type, sdp: answer.sdp },
          })
        );
      }

      const queued = this.screenCandidateQueue.get(senderId);
      if (queued && queued.length > 0) {
        for (const cand of queued) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch {}
        }
        this.screenCandidateQueue.delete(senderId);
      }
    } else if (payload.candidate) {
      const candObj = payload.candidate;
      const iceInit: RTCIceCandidateInit = {
        candidate: candObj.candidate,
        sdpMid: candObj.sdpMid ? String(candObj.sdpMid) : '0',
        sdpMLineIndex: candObj.sdpMLineIndex !== undefined ? Number(candObj.sdpMLineIndex) : 0,
      };

      if (!pc.remoteDescription) {
        const q = this.screenCandidateQueue.get(senderId) || [];
        q.push(iceInit);
        this.screenCandidateQueue.set(senderId, q);
      } else {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(iceInit));
        } catch {}
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
    } else if (typeof payload === 'string' && payload.includes('v=0')) {
      sdpText = payload;
      sdpType = pc.localDescription ? 'answer' : 'offer';
    }

    if (sdpText && sdpText.includes('v=0')) {
      if (sdpType === 'answer' && pc.signalingState !== 'have-local-offer') {
        console.warn(`%c[WebRTC ⚠️ Main] Игнорируем Answer от пира ${senderId}. Состояние: ${pc.signalingState}`, 'color: #F59E0B;');
        return;
      }

      let cleanSdp = sdpText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      let lines = cleanSdp.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

      if (sdpType === 'answer') {
        lines = lines
          .filter((l) => !l.startsWith('a=ssrc:'))
          .map((l) => (l.startsWith('a=setup:actpass') ? 'a=setup:active' : l));
      }

      cleanSdp = lines.join('\r\n') + '\r\n';

      try {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: sdpType, sdp: cleanSdp }));
        console.log(`%c[WebRTC 🎙️ Main] setRemoteDescription (${sdpType}) выполнен для пира ${senderId}`, 'color: #10B981;');
      } catch (err: any) {
        console.error(`[WebRTC ❌ Main] Сбой setRemoteDescription (${sdpType}):`, err);
        return;
      }

      if (sdpType === 'offer') {
        // 🟢 Принимающая сторона: setRemoteDescription только что создал видео-трансивер автоматически!
        const videoTransceiver = pc.getTransceivers().find((t) => t.receiver?.track?.kind === 'video');
        if (videoTransceiver) {
          this.applyVp8CodecPreference(videoTransceiver);
          if (this.localCameraTrack && this.localCameraTrack.readyState === 'live') {
            await videoTransceiver.sender.replaceTrack(this.localCameraTrack);
            videoTransceiver.direction = 'sendrecv';
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log(`[WebRTC 🎙️ Main] Отправка Answer пиру ${senderId}`);
        this.invokeSignaling(senderId, JSON.stringify({ sdp: { type: answer.type, sdp: answer.sdp } }));
      }

      const queued = this.candidateQueue.get(senderId);
      if (queued && queued.length > 0) {
        for (const cand of queued) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch {}
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
        try {
          await pc.addIceCandidate(new RTCIceCandidate(iceInit));
        } catch {}
      }
    }
  }

  // ================= 4. ГЛАВНОЕ P2P СОЕДИНЕНИЕ =================

  public async initializeWebRTCAsync(): Promise<void> {
    const targetId = this.singleCallTargetId !== 0 ? this.singleCallTargetId : 1;
    await this.createPeerConnectionAsync(targetId, true);
  }

  public async createPeerConnectionAsync(targetUserId: number, isOfferer: boolean = false): Promise<RTCPeerConnection> {
    const existing = this.peerConnections.get(targetUserId);
    if (existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
      return existing;
    }

    console.log(`[WebRTC 🎙️ Main] Создание RTCPeerConnection (isOfferer=${isOfferer}, Peer=${targetUserId})`);
    const audioStream = await this.initializeLocalCapture();
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);

    audioStream.getAudioTracks().forEach((track) => {
      pc.addTrack(track, audioStream);
    });

    // 🟢 КЛЮЧЕВОЙ ФИКС:
    // Если мы инициатор (isOfferer=true) — добавляем видеотрансивер.
    // Если мы принимающая сторона (isOfferer=false) — НЕ создаем трансивер вручную! 
    // Его создаст setRemoteDescription(offer), чтобы исключить раздвоение трансиверов!
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
      this.applyVp8CodecPreference(videoTransceiver);
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
        console.log(`%c[WebRTC 🔊 Audio In] Принят аудио-поток от пира ${targetUserId}`, 'color: #10B981; font-weight: bold;');
        let audioEl = this.remoteAudioElements.get(targetUserId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          this.remoteAudioElements.set(targetUserId, audioEl);
        }
        audioEl.srcObject = new MediaStream([event.track]);
        audioEl.play().catch((e) => console.warn('[WebRTC ⚠️ Audio AutoPlay] Требуется клик в UI:', e));
        return;
      }

      console.log(`%c[WebRTC 📷 Cam In] Принят видео-поток камеры от пира ${targetUserId}`, 'color: #10B981; font-weight: bold;');
      let stream = this.remoteCameraStreams.get(targetUserId);
      if (!stream) {
        stream = new MediaStream();
        this.remoteCameraStreams.set(targetUserId, stream);
      }

      stream.getTracks().forEach((t) => stream!.removeTrack(t));
      stream.addTrack(event.track);
      this.notifyRemoteStreams();
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC 🎙️ Main] ConnectionState пира ${targetUserId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.removePeer(targetUserId);
      }
    };

    this.peerConnections.set(targetUserId, pc);
    return pc;
  }

  private applyVp8CodecPreference(transceiver: RTCRtpTransceiver): void {
    if ('setCodecPreferences' in transceiver && typeof RTCRtpReceiver.getCapabilities === 'function') {
      try {
        const capabilities = RTCRtpReceiver.getCapabilities('video');
        if (capabilities && capabilities.codecs) {
          const vp8Codecs = capabilities.codecs.filter((c) => c.mimeType.toLowerCase() === 'video/vp8');
          const otherCodecs = capabilities.codecs.filter((c) => c.mimeType.toLowerCase() !== 'video/vp8');
          if (vp8Codecs.length > 0) {
            transceiver.setCodecPreferences([...vp8Codecs, ...otherCodecs]);
          }
        }
      } catch {}
    }
  }

  public async startCallWithPeerAsync(targetUserId: number): Promise<void> {
    console.log(`%c[WebRTC 🚀 Offer Out] Старт P2P хэндшейка к пиру ${targetUserId}`, 'color: #3B82F6; font-weight: bold;');
    this.singleCallTargetId = targetUserId;
    const pc = await this.createPeerConnectionAsync(targetUserId, true);
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);

    this.invokeSignaling(targetUserId, JSON.stringify({ sdp: { type: offer.type, sdp: offer.sdp } }));
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
    console.log(`[WebRTC 🚪 RemovePeer] Удаление пира ${userId}`);
    const pc = this.peerConnections.get(userId);
    if (pc) {
      try { pc.close(); } catch {}
      this.peerConnections.delete(userId);
    }

    this.removeScreenPeer(userId);

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
    console.log('%c[WebRTC 🧹 Cleanup] Полная очистка ресурсов звонка...', 'color: #EF4444;');
    await this.stopCamera();
    await this.stopScreenShare();

    for (const pc of this.peerConnections.values()) {
      try { pc.close(); } catch {}
    }
    this.peerConnections.clear();
    this.candidateQueue.clear();

    for (const pc of this.screenPeerConnections.values()) {
      try { pc.close(); } catch {}
    }
    this.screenPeerConnections.clear();
    this.screenCandidateQueue.clear();

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