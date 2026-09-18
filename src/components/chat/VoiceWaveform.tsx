import React, { useRef, useState, useMemo, useEffect } from 'react';

interface VoiceWaveformProps {
  waveform?: string;
  durationSeconds?: number;
  playerDurationSeconds?: number;
  positionSeconds?: number;
  isPlaying?: boolean;
  playedColor?: string;
  unplayedColor?: string;
  onSeek?: (targetSeconds: number) => void;
}

const DEFAULT_WAVEFORM_BARS = [
  15, 20, 35, 55, 40, 25, 45, 70, 85, 60, 35, 28, 50, 78, 65, 40,
  30, 58, 82, 92, 58, 38, 48, 68, 62, 42, 28, 52, 72, 58, 32, 22,
  38, 62, 78, 52, 28, 22, 42, 58, 48, 32, 18, 28, 38, 22, 18, 12
];

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  waveform,
  durationSeconds = 0,
  playerDurationSeconds = 0,
  positionSeconds = 0,
  isPlaying = false,
  playedColor = '#FFFFFF',
  unplayedColor = 'rgba(255, 255, 255, 0.35)',
  onSeek,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(180);
  const [isDragging, setIsDragging] = useState(false);
  const [dragRatio, setDragRatio] = useState(-1.0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const totalDuration = useMemo(() => {
    if (playerDurationSeconds > 0.05) return playerDurationSeconds;
    if (durationSeconds > 0.05) return durationSeconds;
    return 2.0;
  }, [playerDurationSeconds, durationSeconds]);

  // Парсинг и нормализация волны (алгоритмы ParseWaveform, ResampleWaveform, NormalizeBytes)
  const bars = useMemo(() => {
    let raw: number[] = DEFAULT_WAVEFORM_BARS;
    if (waveform && waveform.trim().length > 0) {
      const parsed = waveform.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
      if (parsed.length > 0 && parsed.some((v) => v > 5)) {
        raw = parsed;
      }
    }

    const barWidth = 2.0;
    const minSpacing = 1.5;
    const targetCount = Math.max(10, Math.floor(containerWidth / (barWidth + minSpacing)));

    if (targetCount <= 0) return [];
    if (raw.length === targetCount) return normalize(raw);

    const output: number[] = new Array(targetCount);
    const step = raw.length / targetCount;

    for (let i = 0; i < targetCount; i++) {
      const start = Math.floor(i * step);
      let end = Math.floor((i + 1) * step);
      if (end <= start) end = start + 1;
      end = Math.min(end, raw.length);

      let peak = 0;
      for (let j = start; j < end; j++) {
        if (raw[j] > peak) peak = raw[j];
      }
      output[i] = peak;
    }

    return normalize(output);

    function normalize(bytes: number[]) {
      const max = Math.max(...bytes, 0);
      if (max === 0) return bytes.map(() => 10);
      return bytes.map((b) => Math.min(100, Math.max(5, Math.round((b / max) * 95.0 + 5.0))));
    }
  }, [waveform, containerWidth]);

  // Расчет прогресса
  const progressRatio = useMemo(() => {
    if (isDragging && dragRatio >= 0.0) return dragRatio;
    if (isPlaying && totalDuration > 0.05) {
      return Math.min(1.0, Math.max(0.0, positionSeconds / totalDuration));
    }
    return 0.0;
  }, [isDragging, dragRatio, isPlaying, positionSeconds, totalDuration]);

  // События мыши (MouseDown, MouseMove, MouseUp)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = Math.min(1.0, Math.max(0.0, (e.clientX - rect.left) / rect.width));
    setDragRatio(ratio);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = Math.min(1.0, Math.max(0.0, (e.clientX - rect.left) / rect.width));
    setDragRatio(ratio);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      if (dragRatio >= 0.0 && onSeek) {
        onSeek(dragRatio * totalDuration);
      }
      setDragRatio(-1.0);
    }
  };

  const barWidth = 2.0;
  const barCount = bars.length;
  const spacing = barCount > 1 ? (containerWidth - barCount * barWidth) / (barCount - 1) : 1.5;
  const h = 20.0;
  const minHeight = 3.5;
  const maxHeight = h - 2.0;

  const clipWidth = containerWidth * progressRatio;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        width: '100%',
        height: '20px',
        position: 'relative',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <svg width="100%" height={h} style={{ display: 'block', overflow: 'hidden' }}>
        <defs>
          <clipPath id={`playedClip_${containerWidth}`}>
            <rect x="0" y="0" width={clipWidth} height={h} />
          </clipPath>
        </defs>

        {/* 1. Непроигранные фоновые палочки */}
        {bars.map((val, i) => {
          const x = i * (barWidth + spacing);
          const barH = minHeight + (val / 100.0) * (maxHeight - minHeight);
          const y = (h - barH) / 2.0;
          return (
            <rect
              key={`unplayed_${i}`}
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              rx={1.0}
              ry={1.0}
              fill={unplayedColor}
            />
          );
        })}

        {/* 2. Проигранная часть через PushClip */}
        {clipWidth > 0.5 && (
          <g clipPath={`url(#playedClip_${containerWidth})`}>
            {bars.map((val, i) => {
              const x = i * (barWidth + spacing);
              const barH = minHeight + (val / 100.0) * (maxHeight - minHeight);
              const y = (h - barH) / 2.0;
              return (
                <rect
                  key={`played_${i}`}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barH}
                  rx={1.0}
                  ry={1.0}
                  fill={playedColor}
                />
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
};