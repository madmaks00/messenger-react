import React, { useMemo } from 'react';

export interface IStoryItem {
  id: number;
  hasViewed: boolean;
}

interface SegmentedStoryRingProps {
  stories: IStoryItem[];
  strokeThickness?: number;
  gradientId?: string;
  mutedColor?: string;
  size?: number;
}

export const SegmentedStoryRing: React.FC<SegmentedStoryRingProps> = ({
  stories,
  strokeThickness = 2.0,
  gradientId = 'storyGradient',
  mutedColor = '#64748B',
  size = 48,
}) => {
  const count = stories?.length || 0;
  const radius = (size - strokeThickness) / 2.0;
  const center = size / 2.0;

  const segments = useMemo(() => {
    if (count <= 1 || radius <= 0) return null;

    const gapAngle = count === 2 ? 14.0 : count === 3 ? 12.0 : count === 4 ? 10.0 : 8.0;
    const totalGap = count * gapAngle;
    const sweepAngle = (360.0 - totalGap) / count;
    let startAngle = -90.0 + gapAngle / 2.0;

    return stories.map((story, i) => {
      const a1 = (startAngle * Math.PI) / 180.0;
      const a2 = ((startAngle + sweepAngle) * Math.PI) / 180.0;

      const p1 = {
        x: center + radius * Math.cos(a1),
        y: center + radius * Math.sin(a1),
      };
      const p2 = {
        x: center + radius * Math.cos(a2),
        y: center + radius * Math.sin(a2),
      };

      const largeArcFlag = sweepAngle > 180 ? 1 : 0;
      const d = `M ${p1.x} ${p1.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${p2.x} ${p2.y}`;

      startAngle += sweepAngle + gapAngle;

      return {
        path: d,
        isViewed: story.hasViewed,
      };
    });
  }, [stories, count, radius, center]);

  if (count === 0) return null;

  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="50%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>

      {count === 1 ? (
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={stories[0].hasViewed ? mutedColor : `url(#${gradientId})`}
          strokeWidth={strokeThickness}
        />
      ) : (
        segments?.map((seg, i) => (
          <path
            key={i}
            d={seg.path}
            fill="none"
            stroke={seg.isViewed ? mutedColor : `url(#${gradientId})`}
            strokeWidth={strokeThickness}
            strokeLinecap="round"
          />
        ))
      )}
    </svg>
  );
};