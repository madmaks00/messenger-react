import React, { useState } from 'react';
import { mdiGamepadVariantOutline, mdiCheck, mdiGrid, mdiCheckerboard, mdiChessKnight, mdiFerry, mdiPalette, mdiPencil } from '@mdi/js';
import { SidebarHeaderUserControl } from "../common/SidebarHeaderUserControl";
import { useGamesStore } from '../../stores/gamesStore';
import { IGameItem } from '../../types/models';

const ICON_MAP: Record<string, string> = {
  Grid: mdiGrid,
  Checkerboard: mdiCheckerboard,
  ChessKnight: mdiChessKnight,
  Ferry: mdiFerry,
  Palette: mdiPalette,
  Pencil: mdiPencil,
};

export const SidebarGamesView: React.FC = () => {
  const { availableGames, selectedGame, selectGame } = useGamesStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--bg-list, #161A23)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <SidebarHeaderUserControl title="Games" iconPath={mdiGamepadVariantOutline} />

      <div
        className="wpf-scroll-viewer"
        style={{
          flex: 1,
          width: '100%',
          padding: '0 5px 10px 5px',
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            margin: '0 auto',
            width: '100%',
          }}
        >
          {availableGames.map((game: IGameItem) => {
            const isSelected = selectedGame?.internalId === game.internalId;
            const isHovered = hoveredId === game.internalId;
            const iconSvg = ICON_MAP[game.iconKind] || mdiGamepadVariantOutline;

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
                    ? '1.5px solid var(--app-accent, #1E9BEB)'
                    : isHovered
                    ? '1.5px solid var(--game-tile-hover-border, #3B4456)'
                    : '1.5px solid var(--game-tile-border, #2A303C)',
                  backgroundColor: isSelected
                    ? 'var(--accounts-active-bg, rgba(30, 155, 235, 0.1))'
                    : isHovered
                    ? 'var(--game-tile-hover-bg, #1C212D)'
                    : 'var(--game-tile-bg, #161A23)',
                  cursor: 'pointer',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box',
                  transform: isHovered ? 'scale(1.03)' : 'scale(1)',
                  transition: 'transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease',
                  flexShrink: 0,
                }}
              >
                {/* Индикатор выбора (CheckBadge) */}
                <div
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: 'var(--app-accent, #1E9BEB)',
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

                {/* Круглая подложка иконки */}
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: 'var(--game-tile-badge-bg, rgba(30, 155, 235, 0.1))',
                    margin: '14px auto 0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg viewBox="0 0 24 24" width={36} height={36} fill="var(--app-accent, #1E9BEB)">
                    <path d={iconSvg} />
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