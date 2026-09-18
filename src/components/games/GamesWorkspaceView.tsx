import React from 'react';
import { useGamesStore } from '../../stores/gamesStore';

export const GamesWorkspaceView: React.FC = () => {
  const {
    selectedGame,
    isJoinGameDialogOpen,
    inputRoomId,
    openJoinDialog,
    closeJoinDialog,
    setInputRoomId,
    createRoom,
    joinRoom,
  } = useGamesStore();

  if (!selectedGame) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0B141B', color: '#64748B' }}>
        <div style={{ padding: '16px 24px', borderRadius: 20, background: '#1E293B', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>🎮</span>
          <span style={{ color: '#E2E8F0', fontWeight: 600 }}>Select a game to start playing</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0B141B', position: 'relative' }}>
      {/* КАРТОЧКА ВЫБРАННОЙ ИГРЫ */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        {/* Иконка в круге 80x80 */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#1E2330',
            border: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 38,
            marginBottom: 16,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          {selectedGame.internalId === 'TicTacToe' && '❌'}
          {selectedGame.internalId === 'Checkers' && '⚪'}
          {selectedGame.internalId === 'Chess' && '♞'}
          {selectedGame.internalId === 'Battleship' && '🚢'}
          {selectedGame.internalId === 'DrawAndRate' && '🎨'}
          {selectedGame.internalId === 'DrawAndGuess' && '✏️'}
        </div>

        {/* Название */}
        <h1 style={{ fontSize: 28, fontWeight: 'bold', color: '#FFF', margin: '0 0 40px 0' }}>
          {selectedGame.name}
        </h1>

        {/* КНОПКА: CREATE ROOM (Ширина 280, высота 52) */}
        <button
          onClick={createRoom}
          style={{
            width: 280,
            height: 52,
            borderRadius: 12,
            backgroundColor: 'var(--app-accent, #3B82F6)',
            color: '#FFF',
            border: 'none',
            fontSize: 15,
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            boxShadow: '0 10px 25px rgba(59, 130, 246, 0.35)',
          }}
        >
          <span>➕</span>
          <span>CREATE ROOM</span>
        </button>

        {/* РАЗДЕЛИТЕЛЬ "OR" */}
        <div style={{ display: 'flex', alignItems: 'center', width: 280, margin: '20px 0' }}>
          <div style={{ flex: 1, height: 1, backgroundColor: '#334155' }} />
          <span style={{ padding: '0 15px', color: '#64748B', fontSize: 13, fontWeight: 'bold' }}>OR</span>
          <div style={{ flex: 1, height: 1, backgroundColor: '#334155' }} />
        </div>

        {/* КНОПКА: JOIN ROOM */}
        <button
          onClick={openJoinDialog}
          style={{
            width: 280,
            height: 52,
            borderRadius: 12,
            backgroundColor: 'transparent',
            color: '#E2E8F0',
            border: '2px solid #334155',
            fontSize: 15,
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
          }}
        >
          <span>🚪</span>
          <span>JOIN ROOM</span>
        </button>
      </div>

      {/* ДИАЛОГ ВВОДА КОДА КОМНАТЫ */}
      {isJoinGameDialogOpen && (
        <div
          onClick={closeJoinDialog}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 360,
              backgroundColor: '#1E2330',
              borderRadius: 16,
              padding: 30,
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              border: '1px solid #334155',
              textAlign: 'center',
            }}
          >
            <h2 style={{ fontSize: 20, fontWeight: 'bold', color: '#FFF', margin: '0 0 6px 0' }}>Join Room</h2>
            <p style={{ fontSize: 14, color: '#94A3B8', margin: '0 0 24px 0' }}>Enter the Room ID to join the match.</p>

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-accent, #38BDF8)', textAlign: 'left', marginBottom: 6 }}>
              ROOM ID
            </div>
            <div style={{ background: '#161B26', border: '2px solid #334155', borderRadius: 8, marginBottom: 25 }}>
              <input
                type="text"
                autoFocus
                placeholder="e.g. B4F8A1"
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#FFF',
                  fontSize: 20,
                  fontWeight: 'bold',
                  textAlign: 'center',
                  padding: '12px 10px',
                  outline: 'none',
                  letterSpacing: 2,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
              <button
                onClick={closeJoinDialog}
                style={{ height: 44, borderRadius: 8, background: 'transparent', border: 'none', color: '#94A3B8', fontWeight: 'bold', cursor: 'pointer' }}
              >
                CANCEL
              </button>
              <button
                onClick={joinRoom}
                style={{
                  height: 44,
                  borderRadius: 8,
                  backgroundColor: 'var(--app-accent, #3B82F6)',
                  color: '#FFF',
                  border: 'none',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
                }}
              >
                JOIN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};