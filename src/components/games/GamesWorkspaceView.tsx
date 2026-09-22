import React from 'react';
import { mdiGamepadVariantOutline, mdiPlusCircleOutline, mdiLogin, mdiGrid, mdiCheckerboard, mdiChessKnight, mdiFerry, mdiPalette, mdiPencil } from '@mdi/js';
import { useGamesStore } from '../../stores/gamesStore';

const ICON_MAP: Record<string, string> = {
  Grid: mdiGrid,
  Checkerboard: mdiCheckerboard,
  ChessKnight: mdiChessKnight,
  Ferry: mdiFerry,
  Palette: mdiPalette,
  Pencil: mdiPencil,
};

export const GamesWorkspaceView: React.FC = () => {
  const {
    selectedGame,
    isJoinGameDialogOpen,
    inputRoomId,
    openJoinDialog,
    closeJoinDialog,
    setInputRoomId,
    createGameRoom,
    joinGameRoom,
  } = useGamesStore();

  if (!selectedGame) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-chat, #11141B)',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--game-tile-hover-bg, #1C212D)',
            borderRadius: 20,
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg viewBox="0 0 24 24" width={20} height={20} fill="var(--app-accent, #1E9BEB)" style={{ marginRight: 10 }}>
            <path d={mdiGamepadVariantOutline} />
          </svg>
          <span style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 600 }}>
            Select a game to start playing
          </span>
        </div>
      </div>
    );
  }

  const iconSvg = ICON_MAP[selectedGame.iconKind] || mdiGamepadVariantOutline;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-chat, #11141B)',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Иконка в круге 80x80 с тенью */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#161A23',
            border: '1px solid #1F2533',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 15,
            boxShadow: '0 5px 25px rgba(0, 210, 255, 0.15)',
          }}
        >
          <svg viewBox="0 0 24 24" width={40} height={40} fill="#00D2FF">
            <path d={iconSvg} />
          </svg>
        </div>

        {/* Название выбранной игры */}
        <h1 style={{ color: '#FFFFFF', fontSize: 28, fontWeight: 'bold', margin: '0 0 40px 0' }}>
          {selectedGame.name}
        </h1>

        {/* Кнопка CREATE ROOM */}
        <button
          onClick={createGameRoom}
          style={{
            width: 280,
            height: 52,
            backgroundColor: 'var(--app-accent, #1E9BEB)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(0, 210, 255, 0.25)',
          }}
        >
          <svg viewBox="0 0 24 24" width={22} height={22} fill="#FFFFFF" style={{ marginRight: 8 }}>
            <path d={mdiPlusCircleOutline} />
          </svg>
          <span style={{ fontSize: 15, fontWeight: 'bold' }}>CREATE ROOM</span>
        </button>

        {/* Разделитель OR */}
        <div style={{ display: 'flex', alignItems: 'center', width: 280, margin: '20px 0' }}>
          <div style={{ flex: 1, height: 1, backgroundColor: '#2A303C', marginRight: 15 }} />
          <span style={{ color: '#4A5568', fontSize: 13, fontWeight: 'bold' }}>OR</span>
          <div style={{ flex: 1, height: 1, backgroundColor: '#2A303C', marginLeft: 15 }} />
        </div>

        {/* Кнопка JOIN ROOM */}
        <button
          onClick={openJoinDialog}
          style={{
            width: 280,
            height: 52,
            backgroundColor: '#111620',
            color: '#FFFFFF',
            border: '2px solid #252D3D',
            borderRadius: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1A212F')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#111620')}
        >
          <svg viewBox="0 0 24 24" width={22} height={22} fill="#FFFFFF" style={{ marginRight: 8 }}>
            <path d={mdiLogin} />
          </svg>
          <span style={{ fontSize: 15, fontWeight: 'bold' }}>JOIN ROOM</span>
        </button>
      </div>

      {/* Диалог подключения к комнате */}
      {isJoinGameDialogOpen && (
        <div
          onClick={closeJoinDialog}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 360,
              backgroundColor: '#111620',
              borderRadius: 16,
              padding: 30,
              border: '1px solid #252D3D',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
              textAlign: 'center',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', marginBottom: 5 }}>Join Room</div>
            <div style={{ color: '#8B94A5', fontSize: 14, marginBottom: 25 }}>Enter the Room ID to join the match.</div>

            <div style={{ textAlign: 'left', color: '#8B94A5', fontSize: 12, fontWeight: 600, margin: '0 0 5px 5px' }}>
              ROOM ID
            </div>
            <div
              style={{
                backgroundColor: '#080A0E',
                border: '2px solid #1C2331',
                borderRadius: 8,
                marginBottom: 25,
              }}
            >
              <input
                type="text"
                autoFocus
                placeholder="e.g. B4F8A1"
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && joinGameRoom()}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: 20,
                  fontWeight: 'bold',
                  textAlign: 'center',
                  padding: '10px 15px',
                  outline: 'none',
                  textTransform: 'uppercase',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
              <button
                onClick={closeJoinDialog}
                style={{
                  height: 44,
                  backgroundColor: 'transparent',
                  color: '#8B94A5',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                CANCEL
              </button>
              <button
                onClick={joinGameRoom}
                style={{
                  height: 44,
                  backgroundColor: 'var(--app-accent, #1E9BEB)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 0 10px rgba(0, 210, 255, 0.3)',
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