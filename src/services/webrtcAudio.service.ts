/**
 * Bandlimited Sinc Resampler с окном Блэкмана-Харриса (32 Taps)
 * Точный перенос Engine.Dsp.BandlimitedSincResampler из C#
 */
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

/**
 * WebRTC Audio Processing Module (AEC3 + AGC2 + Noise Suppression)
 */
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