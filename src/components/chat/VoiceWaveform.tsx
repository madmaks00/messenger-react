import React, { useRef, useEffect, useState, useCallback } from 'react';
import { IAttachment } from '../../types/models';
import { AudioConverterHelper } from '../../utils/audioConverters';
import { audioPlayerService } from '../../services/audioPlayer.service';

const audioWaveCache = new Map<string, number[]>();

function decodeTelegram5Bit(bytes: Uint8Array): number[] {
  const bitsCount = bytes.length * 8;
  const valuesCount = Math.floor(bitsCount / 5);
  if (valuesCount <= 0) return [];

  const values: number[] = new Array(valuesCount);
  for (let i = 0; i < valuesCount; i++) {
    const bitOffset = i * 5;
    const byteOffset = Math.floor(bitOffset / 8);
    const bitShift = bitOffset % 8;

    let val = (bytes[byteOffset] >> bitShift) & 0x1f;
    if (bitShift > 3 && byteOffset + 1 < bytes.length) {
      val |= (bytes[byteOffset + 1] << (8 - bitShift)) & 0x1f;
    }
    values[i] = val;
  }
  return values;
}

function parseWaveformTo5BitSamples(input: any): number[] {
  if (!input) return [];

  if (Array.isArray(input)) {
    return normalizeToTelegram31(input.map(Number).filter((n) => !isNaN(n)));
  }

  if (input instanceof Uint8Array || input instanceof Int8Array) {
    const decoded = decodeTelegram5Bit(new Uint8Array(input));
    if (decoded.length >= 8) return decoded;
    return normalizeToTelegram31(Array.from(input));
  }

  if (typeof input !== 'string') return [];
  const str = input.trim();
  if (!str) return [];

  if (str.includes(',') || str.includes(';') || (str.includes(' ') && !str.includes('='))) {
    const sep = str.includes(',') ? ',' : (str.includes(';') ? ';' : ' ');
    const nums = str
      .split(sep)
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n));

    if (nums.length > 0) {
      return normalizeToTelegram31(nums);
    }
  }

  try {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const decoded5Bit = decodeTelegram5Bit(bytes);
    if (decoded5Bit.length >= 5) {
      return decoded5Bit;
    }

    return normalizeToTelegram31(Array.from(bytes));
  } catch {}

  return [];
}

function normalizeToTelegram31(samples: number[]): number[] {
  if (!samples || samples.length === 0) return [];

  let max = 0;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] > max) max = samples[i];
  }

  if (max <= 0.001) return new Array(samples.length).fill(0);

  if (max <= 1.0) {
    return samples.map((s) => Math.round(Math.max(0, Math.min(1, s)) * 31.0));
  }
  if (max <= 31) {
    return samples.map((s) => Math.max(0, Math.min(31, Math.round(s))));
  }

  const divisor = max > 100 ? 255.0 : 100.0;
  return samples.map((s) => Math.round((Math.max(0, s) / divisor) * 31.0));
}

function resampleWaveform(samples: number[], targetCount: number, durationSec: number): number[] {
  if (!samples || samples.length === 0) {
    const result = new Array(targetCount);
    const seed = Math.max(1, Math.round(durationSec * 13));
    for (let i = 0; i < targetCount; i++) {
      const p = (i / targetCount) * Math.PI * 4;
      const v = Math.abs(Math.sin(p + seed) * 0.7 + Math.cos(p * 2.1 + seed) * 0.3);
      result[i] = Math.round(v * 28.0);
    }
    return result;
  }

  if (targetCount <= 0) return [];
  if (samples.length === targetCount) return samples;

  const result = new Array(targetCount);
  const step = samples.length / targetCount;

  for (let i = 0; i < targetCount; i++) {
    const start = i * step;
    const end = (i + 1) * step;

    const iStart = Math.floor(start);
    const iEnd = Math.min(samples.length - 1, Math.floor(end));

    if (iStart === iEnd) {
      const next = Math.min(samples.length - 1, iStart + 1);
      const prog = start - iStart;
      result[i] = Math.round(samples[iStart] * (1 - prog) + samples[next] * prog);
    } else {
      let peak = 0;
      for (let j = iStart; j <= iEnd; j++) {
        if (samples[j] > peak) peak = samples[j];
      }
      result[i] = peak;
    }
  }

  return result;
}

interface VoiceWaveformProps {
  waveform?: string | null;
  durationSeconds: number;
  playerDurationSeconds?: number;
  attachment: IAttachment;
  currentAttachment?: IAttachment | null;
  positionSeconds?: number;
  playedBrush?: string;
  unplayedBrush?: string;
  onSeek: (seconds: number) => void;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  waveform,
  durationSeconds,
  playerDurationSeconds = 0,
  attachment,
  currentAttachment,
  positionSeconds = 0,
  playedBrush = '#FFFFFF',
  unplayedBrush = 'rgba(255, 255, 255, 0.4)',
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);
  const dragRatioRef = useRef(-1.0);

  const [extractedWave, setExtractedWave] = useState<number[] | null>(null);

  const isCurrent = AudioConverterHelper.isSameAttachment(currentAttachment, attachment);

  const getAccurateDuration = useCallback((): number => {
    if (playerDurationSeconds > 0.05) return playerDurationSeconds;
    if (attachment.durationSeconds && attachment.durationSeconds > 0.05) return attachment.durationSeconds;
    if (durationSeconds > 0.05) return durationSeconds;
    return 2.0;
  }, [playerDurationSeconds, attachment.durationSeconds, durationSeconds]);

  // 🟢 Автоматическое извлечение формы волны из файла, если сервер её стёр
  useEffect(() => {
    const raw = parseWaveformTo5BitSamples(waveform);
    if (raw.length > 0) {
      setExtractedWave(raw);
      return;
    }

    const audioUrl = attachment.url || attachment.localImagePath;
    if (!audioUrl) return;

    if (audioWaveCache.has(audioUrl)) {
      setExtractedWave(audioWaveCache.get(audioUrl)!);
      return;
    }

    let isCanceled = false;

    (async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = new AudioCtx();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        ctx.close();

        const channelData = audioBuffer.getChannelData(0);
        const barCount = 64;
        const blockSize = Math.floor(channelData.length / barCount);
        const peaks: number[] = [];

        for (let i = 0; i < barCount; i++) {
          let max = 0;
          const start = i * blockSize;
          for (let j = 0; j < blockSize; j++) {
            const val = Math.abs(channelData[start + j]);
            if (val > max) max = val;
          }
          peaks.push(Math.round(Math.min(1.0, max) * 31.0));
        }

        audioWaveCache.set(audioUrl, peaks);
        if (!isCanceled) {
          setExtractedWave(peaks);
        }
      } catch {}
    })();

    return () => {
      isCanceled = true;
    };
  }, [waveform, attachment.url, attachment.localImagePath]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpi = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight || 20;

    if (w <= 0 || h <= 0) return;

    const targetWidth = Math.round(w * dpi);
    const targetHeight = Math.round(h * dpi);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    ctx.save();
    ctx.scale(dpi, dpi);
    ctx.clearRect(0, 0, w, h);

    const totalDur = getAccurateDuration();
    let effectiveProgress = 0.0;
    if (isDraggingRef.current && dragRatioRef.current >= 0.0) {
      effectiveProgress = dragRatioRef.current;
    } else if (isCurrent && totalDur > 0.05) {
      effectiveProgress = Math.max(0.0, Math.min(1.0, positionSeconds / totalDur));
    }

    const rawSamples31 = extractedWave || parseWaveformTo5BitSamples(waveform);

    const barWidth = 2.0;
    const minSpacing = 1.0;

    const targetBarCount = Math.max(16, Math.floor(w / (barWidth + minSpacing)));
    const samples = resampleWaveform(rawSamples31, targetBarCount, totalDur);
    const barCount = samples.length;

    let spacing = (w - barCount * barWidth) / Math.max(1, barCount - 1);
    if (spacing < 1.0) spacing = 1.0;

    const minBarHeight = 2.0;
    const maxBarHeight = Math.max(minBarHeight, h - 2.0);
    const progressCutX = w * effectiveProgress;

    const drawBars = (fillStyle: string) => {
      ctx.fillStyle = fillStyle;
      for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + spacing);
        const val31 = samples[i];
        const barH = minBarHeight + (val31 / 31.0) * (maxBarHeight - minBarHeight);
        const y = (h - barH) / 2.0;

        ctx.beginPath();
        if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(x, y, barWidth, barH, 1.0);
        } else {
          ctx.rect(x, y, barWidth, barH);
        }
        ctx.fill();
      }
    };

    drawBars(unplayedBrush);

    if (progressCutX > 0.5) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, progressCutX, h);
      ctx.clip();
      drawBars(playedBrush);
      ctx.restore();
    }

    ctx.restore();
  }, [waveform, extractedWave, isCurrent, positionSeconds, getAccurateDuration, playedBrush, unplayedBrush]);

  useEffect(() => {
    renderCanvas();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ro = new ResizeObserver(() => {
      renderCanvas();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [renderCanvas]);

  const commitSeek = (ratio: number) => {
    const totalDur = getAccurateDuration();
    const targetSeconds = ratio * totalDur;
    onSeek(targetSeconds);
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    isDraggingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    dragRatioRef.current = Math.max(0, Math.min(1, x / rect.width));
    renderCanvas();

    const onMouseMove = (moveEvt: MouseEvent) => {
      if (isDraggingRef.current && canvasRef.current) {
        const r = canvasRef.current.getBoundingClientRect();
        const curX = Math.max(0, Math.min(r.width, moveEvt.clientX - r.left));
        dragRatioRef.current = Math.max(0, Math.min(1, curX / r.width));
        renderCanvas();
      }
    };

    const onMouseUp = (upEvt: MouseEvent) => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        if (canvasRef.current) {
          const r = canvasRef.current.getBoundingClientRect();
          const finalX = Math.max(0, Math.min(r.width, upEvt.clientX - r.left));
          const finalRatio = Math.max(0, Math.min(1, finalX / r.width));
          dragRatioRef.current = -1.0;
          renderCanvas();

          commitSeek(finalRatio);
        }
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={onMouseDown}
      style={{
        width: '100%',
        height: 20,
        cursor: 'pointer',
        display: 'block',
      }}
    />
  );
};