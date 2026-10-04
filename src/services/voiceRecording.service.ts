import { eventBus } from './eventBus';

export interface VoiceRecordingResult {
  file: File;
  durationSeconds: number;
  waveform: string;
}

export interface IVoiceRecordingService {
  readonly isRecording: boolean;
  startRecording(): Promise<void>;
  stopRecording(): Promise<VoiceRecordingResult | null>;
  cancelRecording(): void;
  dispose(): void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatUtcTimestamp(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const mins = pad(date.getUTCMinutes());
  const secs = pad(date.getUTCSeconds());
  return `${year}${month}${day}_${hours}${mins}${secs}`;
}

function generateRandomHex(length: number = 6): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function getPreferredAudioMimeType(): { mimeType: string; extension: string } {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: 'audio/webm', extension: 'webm' };
  }
  if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
    return { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' };
  }
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return { mimeType: 'audio/webm;codecs=opus', extension: 'webm' };
  }
  if (MediaRecorder.isTypeSupported('audio/mp4')) {
    return { mimeType: 'audio/mp4', extension: 'mp4' };
  }
  return { mimeType: 'audio/webm', extension: 'webm' };
}

// =========================================================================
// 🟢 DSP АЛГОРИТМЫ
// =========================================================================

class CubicHermiteResampler {
  private readonly sourceRate: number;
  private readonly targetRate: number;
  private fractionalPos: number = 0.0;
  private yMinus1: number = 0.0;
  private y0: number = 0.0;
  private y1: number = 0.0;
  private y2: number = 0.0;

  constructor(sourceRate: number, targetRate: number) {
    this.sourceRate = sourceRate;
    this.targetRate = targetRate;
  }

  public reset(): void {
    this.fractionalPos = 0.0;
    this.yMinus1 = 0.0;
    this.y0 = 0.0;
    this.y1 = 0.0;
    this.y2 = 0.0;
  }

  public processSample(currentSample: number, outputSink: (sample: number) => void): void {
    if (this.sourceRate === this.targetRate) {
      outputSink(currentSample);
      return;
    }

    this.yMinus1 = this.y0;
    this.y0 = this.y1;
    this.y1 = this.y2;
    this.y2 = currentSample;

    const step = this.sourceRate / this.targetRate;

    while (this.fractionalPos < 1.0) {
      const t = this.fractionalPos;
      const c0 = this.y0;
      const c1 = 0.5 * (this.y1 - this.yMinus1);
      const c2 = this.yMinus1 - 2.5 * this.y0 + 2.0 * this.y1 - 0.5 * this.y2;
      const c3 = 0.5 * (this.y2 - this.yMinus1) + 1.5 * (this.y0 - this.y1);

      const interpolated = ((c3 * t + c2) * t + c1) * t + c0;
      outputSink(interpolated);

      this.fractionalPos += step;
    }

    this.fractionalPos -= 1.0;
  }
}

class BiquadHighPass {
  private readonly b0: number;
  private readonly b1: number;
  private readonly b2: number;
  private readonly a1: number;
  private readonly a2: number;
  private x1: number = 0.0;
  private x2: number = 0.0;
  private y1: number = 0.0;
  private y2: number = 0.0;

  constructor(cutoffHz: number, sampleRate: number) {
    const w0 = (2.0 * Math.PI * cutoffHz) / sampleRate;
    const cosW0 = Math.cos(w0);
    const alpha = Math.sin(w0) / (2.0 * 0.7071);

    const a0 = 1.0 + alpha;
    this.b0 = (1.0 + cosW0) / 2.0 / a0;
    this.b1 = -(1.0 + cosW0) / a0;
    this.b2 = (1.0 + cosW0) / 2.0 / a0;
    this.a1 = (-2.0 * cosW0) / a0;
    this.a2 = (1.0 - alpha) / a0;
  }

  public process(input: number): number {
    const output =
      this.b0 * input +
      this.b1 * this.x1 +
      this.b2 * this.x2 -
      this.a1 * this.y1 -
      this.a2 * this.y2;

    this.x2 = this.x1;
    this.x1 = input;
    this.y2 = this.y1;
    this.y1 = output;

    return output;
  }
}

class WebRtcAdaptiveAgc {
  private readonly attackCoeff: number;
  private readonly releaseCoeff: number;
  private envelope: number = 0.0;
  private currentGain: number = 1.0;

  constructor(sampleRate: number) {
    this.attackCoeff = Math.exp(-1.0 / (sampleRate * 0.01));
    this.releaseCoeff = Math.exp(-1.0 / (sampleRate * 0.15));
  }

  public process(input: number, vadProbability: number): number {
    const abs = Math.abs(input) / 32768.0;
    this.envelope =
      abs > this.envelope
        ? this.attackCoeff * this.envelope + (1.0 - this.attackCoeff) * abs
        : this.releaseCoeff * this.envelope + (1.0 - this.releaseCoeff) * abs;

    if (vadProbability > 0.4) {
      const envDb = 20.0 * Math.log10(Math.max(this.envelope, 1e-5));
      const targetGainDb = clamp(-14.0 - envDb, 0.0, 18.0);
      const targetGain = Math.pow(10.0, targetGainDb / 20.0);
      this.currentGain += (targetGain - this.currentGain) * 0.001;
    } else {
      this.currentGain += (1.0 - this.currentGain) * 0.0005;
    }

    const outSample = input * this.currentGain;
    let norm = outSample / 32768.0;

    if (norm > 0.9) {
      norm = 0.9 + 0.1 * Math.tanh((norm - 0.9) / 0.1);
    } else if (norm < -0.9) {
      norm = -0.9 + 0.1 * Math.tanh((norm + 0.9) / 0.1);
    }

    return norm * 32767.0;
  }
}

class MtprotoWaveformEngine {
  public static generateDisplayString(samples: Int16Array | number[], targetBars: number = 48): string {
    if (samples.length === 0) {
      return Array.from({ length: targetBars }, () => 10).join(',');
    }

    const chunkSize = Math.max(1, Math.floor(samples.length / targetBars));
    const bars = new Uint8Array(targetBars);
    let peakDecay = 0.0;

    for (let i = 0; i < targetBars; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, samples.length);

      let max = 0.0;
      for (let j = start; j < end; j++) {
        const abs = Math.abs(samples[j]) / 32768.0;
        if (abs > max) {
          max = abs;
        }
      }

      peakDecay = Math.max(max, peakDecay * 0.88);
      bars[i] = clamp(Math.floor(peakDecay * 100.0), 8, 100);
    }

    return Array.from(bars).join(',');
  }
}

// =========================================================================
// 🟢 ОСНОВНОЙ СЕРВИС ЗАПИСИ
// =========================================================================

export class VoiceRecordingService implements IVoiceRecordingService {
  private static readonly TARGET_SAMPLE_RATE = 48000;
  private static readonly FRAME_SIZE = 480;

  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private recordingStartTime: number = 0;
  private audioChunks: Blob[] = [];

  private readonly ringBuffer = new Float32Array(VoiceRecordingService.TARGET_SAMPLE_RATE * 2);
  private ringWritePos: number = 0;
  private ringReadPos: number = 0;
  private ringCount: number = 0;

  private readonly inFrame = new Float32Array(VoiceRecordingService.FRAME_SIZE);
  private readonly outFrame = new Float32Array(VoiceRecordingService.FRAME_SIZE);
  private readonly processedSamples: number[] = [];

  private highPassFilter: BiquadHighPass | null = null;
  private adaptiveAgc: WebRtcAdaptiveAgc | null = null;
  private resampler: CubicHermiteResampler | null = null;

  public get isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state !== 'inactive';
  }

  public async startRecording(): Promise<void> {
    if (this.isRecording) return;

    this.cleanup();

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const sourceRate = this.audioContext.sampleRate;
      this.highPassFilter = new BiquadHighPass(85.0, VoiceRecordingService.TARGET_SAMPLE_RATE);
      this.adaptiveAgc = new WebRtcAdaptiveAgc(VoiceRecordingService.TARGET_SAMPLE_RATE);
      this.resampler = new CubicHermiteResampler(sourceRate, VoiceRecordingService.TARGET_SAMPLE_RATE);

      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
      this.destinationNode = this.audioContext.createMediaStreamDestination();
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.scriptProcessor.onaudioprocess = (event: AudioProcessingEvent) => {
        if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return;

        const inputBuffer = event.inputBuffer;
        const outputBuffer = event.outputBuffer;
        const channels = inputBuffer.numberOfChannels;
        const sampleCount = inputBuffer.length;

        const channelData: Float32Array[] = [];
        for (let ch = 0; ch < channels; ch++) {
          channelData.push(inputBuffer.getChannelData(ch));
        }
        const outChannel = outputBuffer.getChannelData(0);

        for (let i = 0; i < sampleCount; i++) {
          let monoSample = 0.0;
          for (let ch = 0; ch < channels; ch++) {
            monoSample += channelData[ch][i] * 32767.0;
          }
          monoSample /= channels;

          this.resampler?.processSample(monoSample, (s) => this.pushToRingBuffer(s));
          outChannel[i] = clamp(monoSample / 32767.0, -1.0, 1.0);
        }

        while (this.ringCount >= VoiceRecordingService.FRAME_SIZE) {
          for (let i = 0; i < VoiceRecordingService.FRAME_SIZE; i++) {
            const raw = this.ringBuffer[this.ringReadPos];
            this.ringReadPos = (this.ringReadPos + 1) % this.ringBuffer.length;
            this.inFrame[i] = this.highPassFilter ? this.highPassFilter.process(raw) : raw;
          }
          this.ringCount -= VoiceRecordingService.FRAME_SIZE;

          for (let i = 0; i < VoiceRecordingService.FRAME_SIZE; i++) {
            this.outFrame[i] = this.inFrame[i];
          }

          const vadProb = 1.0;
          for (let i = 0; i < VoiceRecordingService.FRAME_SIZE; i++) {
            const processed = this.adaptiveAgc
              ? this.adaptiveAgc.process(this.outFrame[i], vadProb)
              : this.outFrame[i];

            const finalPcm = clamp(Math.round(processed), -32768, 32767);
            this.processedSamples.push(finalPcm);
          }
        }
      };

      this.sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.destinationNode);

      const { mimeType } = getPreferredAudioMimeType();
      this.mediaRecorder = new MediaRecorder(this.destinationNode.stream, {
        mimeType,
        audioBitsPerSecond: 32000,
      });

      this.audioChunks = [];
      this.mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.recordingStartTime = Date.now();
      this.mediaRecorder.start(100);

      this.timerInterval = setInterval(() => {
        if (!this.isRecording) return;
        const elapsed = (Date.now() - this.recordingStartTime) / 1000.0;
        eventBus.emit('VoiceRecordingTickMessage' as any, { elapsedSeconds: elapsed });
      }, 100);

      console.log('[VoiceRecordingService] Запись звука стартовала успешно.');
    } catch (err) {
      this.cleanup();
      console.error('[VoiceRecordingService] Ошибка старта записи:', err);
      throw err;
    }
  }

  private pushToRingBuffer(sample: number): void {
    if (this.ringCount < this.ringBuffer.length) {
      this.ringBuffer[this.ringWritePos] = sample;
      this.ringWritePos = (this.ringWritePos + 1) % this.ringBuffer.length;
      this.ringCount++;
    }
  }

  public async stopRecording(): Promise<VoiceRecordingResult | null> {
    if (!this.isRecording || !this.mediaRecorder) {
      return null;
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const durationSeconds = (Date.now() - this.recordingStartTime) / 1000.0;
    const recorder = this.mediaRecorder;

    return new Promise<VoiceRecordingResult | null>((resolve) => {
      recorder.onstop = () => {
        try {
          if (this.processedSamples.length === 0 || durationSeconds < 0.6) {
            console.warn('[VoiceRecordingService] Запись слишком короткая или пустая. Отмена.');
            this.cleanup();
            resolve(null);
            return;
          }

          const finalAudio = new Int16Array(this.processedSamples);

          // 🟢 1 в 1 с C#: Косинусное сглаживание Fade-In и Fade-Out (480 сэмплов)
          const fadeLength = Math.min(480, Math.floor(finalAudio.length / 2));
          for (let i = 0; i < fadeLength; i++) {
            const factor = 0.5 * (1.0 - Math.cos((Math.PI * i) / fadeLength));
            finalAudio[i] = Math.round(finalAudio[i] * factor);
            const tailIdx = finalAudio.length - 1 - i;
            finalAudio[tailIdx] = Math.round(finalAudio[tailIdx] * factor);
          }

          const waveformStr = MtprotoWaveformEngine.generateDisplayString(finalAudio, 48);

          const { mimeType, extension } = getPreferredAudioMimeType();
          const actualMime = recorder.mimeType || mimeType;

          // 🛑 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Формируем Blob и File ДО очистки audioChunks!
          const audioBlob = new Blob(this.audioChunks, { type: actualMime });

          const timestampStr = formatUtcTimestamp(new Date());
          const randomId = generateRandomHex(6);
          const fileName = `voice_${timestampStr}_${randomId}.${extension}`;

          const file = new File([audioBlob], fileName, { type: actualMime });

          console.log(`[VoiceRecordingService ✅] Запись готова! Размер: ${(file.size / 1024).toFixed(1)} КБ (${file.size} байт), Длительность: ${durationSeconds.toFixed(1)}с`);

          // 🟢 Теперь, когда файл сохранен в памяти, очищаем аудио-ноды:
          this.cleanup();

          resolve({
            file,
            durationSeconds,
            waveform: waveformStr,
          });
        } catch (err) {
          console.error('[VoiceRecordingService] Ошибка финализации записи:', err);
          this.cleanup();
          resolve(null);
        }
      };

      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    });
  }

  public cancelRecording(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
    }

    this.cleanup();
  }

  public dispose(): void {
    this.cancelRecording();
  }

  private cleanup(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.scriptProcessor) {
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.destinationNode) {
      this.destinationNode.disconnect();
      this.destinationNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];

    this.processedSamples.length = 0;
    this.ringWritePos = 0;
    this.ringReadPos = 0;
    this.ringCount = 0;
    this.resampler?.reset();
  }
}

export const voiceRecordingService = new VoiceRecordingService();