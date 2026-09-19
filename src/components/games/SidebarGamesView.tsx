import React, { useState } from 'react';
import { mdiGamepadVariantOutline, mdiCheck } from '@mdi/js';

import { SidebarHeaderUserControl } from '../common/SidebarHeaderUserControl';
import { useGamesStore } from '../../stores/gamesStore';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import { resolveMdiIcon } from '../../utils/iconResolver';
import { IGameItem } from '../../types/models';

export const SidebarGamesView: React.FC = () => {
  const { availableGames, selectedGame, selectGame } = useGamesStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { containerRef } = useSmoothScroll<HTMLDivElement>({ friction: 0.78, wheelMultiplier: 0.15 });

  return (
    <div
      style={{
        width: 340,
        height: '100%',
        backgroundColor: 'var(--bg-list)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <SidebarHeaderUserControl title="Games" iconPath={mdiGamepadVariantOutline} />

      <div ref={containerRef} className="wpf-scroll-viewer" style={{ flex: 1, padding: '0 5px 10px 5px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', margin: '0 auto' }}>
          {availableGames.map((game: IGameItem) => {
            const isSelected = selectedGame?.internalId === game.internalId;
            const isHovered = hoveredId === game.internalId;

            // Безопасно резолвим WPF-иконку в SVG путь
            const iconSvgPath = resolveMdiIcon(game.iconKind || game.internalId, mdiGamepadVariantOutline);

            return (
              <div
                key={game.internalId}
                onClick={() => selectGame(game)}
                onMouseEnter={() => setHoveredId(game.internalId)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  width: 150,
                  height: 160,
                  margin: 5,
                  borderRadius: 16,
                  border: isSelected
                    ? '1.5px solid var(--app-accent)'
                    : isHovered
                    ? '1.5px solid var(--game-tile-hover-border)'
                    : '1.5px solid var(--game-tile-border)',
                  backgroundColor: isSelected
                    ? 'var(--accounts-active-bg)'
                    : isHovered
                    ? 'var(--game-tile-hover-bg)'
                    : 'var(--game-tile-bg)',
                  cursor: 'pointer',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box',
                  transform: isHovered ? 'scale(1.03)' : 'scale(1)',
                  transition: 'transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease',
                }}
              >
                {/* Галочка выбора */}
                <div
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: 'var(--app-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isSelected ? 1 : 0,
                    transform: isSelected ? 'scale(1)' : 'scale(0.5)',
                    transition: 'opacity 0.15s ease, transform 0.2s ease',
                    pointerEvents: 'none',
                  }}
                >
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="#FFFFFF">
                    <path d={mdiCheck} />
                  </svg>
                </div>

                {/* Кружок с иконкой */}
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: 'var(--game-tile-badge-bg)',
                    margin: '14px auto 0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg viewBox="0 0 24 24" width={36} height={36} fill="var(--app-accent)">
                    <path d={iconSvgPath} />
                  </svg>
                </div>

                {/* Название игры */}
                <div style={{ margin: '0 12px 15px 12px', textAlign: 'center' }}>
                  <span
                    style={{
                      color: '#FFFFFF',
                      fontSize: 14,
                      fontWeight: 'bold',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: '1.25',
                    }}
                  >
                    {game.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SidebarGamesView;