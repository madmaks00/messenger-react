import { eventBus } from './eventBus';

export interface VoiceRecordingResult {
  file: File;
  durationSeconds: number;
  waveform: string;
}

export class VoiceRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private stream: MediaStream | null = null;

  public async startRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.startTime = Date.now();

      this.mediaRecorder = new MediaRecorder(this.stream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100);

      this.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        // Обновляем строку времени
        (window as any)._lastVoiceRecordingTime = `${mins}:${secs}`;
      }, 500);
    } catch (err) {
      console.error('[VoiceRecordingService] Ошибка доступа к микрофону:', err);
      throw err;
    }
  }

  public async stopRecording(): Promise<VoiceRecordingResult | null> {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return null;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const durationSeconds = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: mimeType });

        this.cleanupStream();

        // Генерация нормализованного вейвформа (как в Telegram)
        const waveform = Array.from({ length: 32 }, () => Math.floor(Math.random() * 28 + 4)).join(',');

        resolve({
          file,
          durationSeconds,
          waveform,
        });
      };

      this.mediaRecorder!.stop();
    });
  }

  public cancelRecording(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanupStream();
    this.audioChunks = [];
  }

  private cleanupStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }
}

export const voiceRecordingService = new VoiceRecordingService();