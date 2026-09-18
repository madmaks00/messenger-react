import React from 'react';
import { useGamesStore } from '../../stores/gamesStore';
import { IGameItem } from '../../types/models';

export const SidebarGamesView: React.FC = () => {
  const { availableGames, selectedGame, selectGame } = useGamesStore();

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      {/* РЯД 0: ШАПКА "GAMES" */}
      <div style={{ height: 52, padding: '0 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #1E293B' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 'bold', color: '#FFF' }}>
          <span>🎮</span>
          <span>Games</span>
        </div>
      </div>

      {/* РЯД 1: ДИНАМИЧЕСКИЙ СПИСОК МИНИ-ИГР (Плитка 150x160) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {availableGames.map((game: IGameItem) => {
            const isSelected = selectedGame?.internalId === game.internalId;
            return (
              <div
                key={game.internalId}
                onClick={() => selectGame(game)}
                style={{
                  height: 160,
                  backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : '#161B26',
                  borderRadius: 16,
                  border: isSelected ? '2px solid var(--app-accent, #3B82F6)' : '1.5px solid #2A303C',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 12px 14px',
                  cursor: 'pointer',
                  position: 'relative',
                  userSelect: 'none',
                  boxSizing: 'border-box',
                  transition: 'transform 0.15s, border-color 0.15s',
                }}
              >
                {/* Бейдж выбранной игры */}
                {isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: 'var(--app-accent, #3B82F6)',
                      color: '#FFF',
                      fontSize: 12,
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ✓
                  </div>
                )}

                {/* Круглая иконка */}
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: '#1E2330',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 30,
                    color: 'var(--app-accent, #3B82F6)',
                    marginTop: 6,
                  }}
                >
                  {game.internalId === 'TicTacToe' && '❌'}
                  {game.internalId === 'Checkers' && '⚪'}
                  {game.internalId === 'Chess' && '♞'}
                  {game.internalId === 'Battleship' && '🚢'}
                  {game.internalId === 'DrawAndRate' && '🎨'}
                  {game.internalId === 'DrawAndGuess' && '✏️'}
                </div>

                {/* Название */}
                <div style={{ fontSize: 14, fontWeight: 'bold', color: '#FFF', textAlign: 'center' }}>
                  {game.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};