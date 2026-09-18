import React, { useRef, useEffect } from 'react';
import { useGamesStore } from '../../stores/gamesStore';
import { BoardCellHelper } from '../../types/models';

export const GameOverlayView: React.FC = () => {
  const {
    currentRoom,
    isGameOverlayVisible,
    canStartGame,
    isGameOver,
    isGameOverOverlayVisible,
    gameStatusText,
    isMyTurn,
    boardCells,
    boardDimension,
    isBoardFlipped,
    myBattleshipCells,
    enemyBattleshipCells,
    isBattleship,
    remainingShipsText,
    isPlacementHorizontal,
    selectedShipSize,
    canClickReady,
    isMyReady,
    chatMessages,
    chatInput,
    drawResults,
    leaveRoom,
    startGame,
    closeGameOverOverlay,
    makeMove,
    sendChatMessage,
    setChatInput,
    toggleOrientation,
    setShipSize,
    autoPlaceShips,
    clearPlacements,
    confirmReady,
  } = useGamesStore();

  const [rightTab, setRightTab] = React.useState<'chat' | 'players'>('chat');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages.length]);

  if (!isGameOverlayVisible || !currentRoom) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(circle at 50% 50%, #17212B 0%, #0A0E17 100%)',
        zIndex: 150,
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      {/* 1. ШАПКА ИГРЫ */}
      <div
        style={{
          height: 60,
          padding: '0 25px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#161B26',
        }}
      >
        <button
          onClick={leaveRoom}
          style={{ width: 42, height: 42, borderRadius: 10, background: '#1E2330', border: '1px solid #334155', color: '#FFF', fontSize: 18, cursor: 'pointer' }}
          title="Leave Room"
        >
          ←
        </button>

        {/* КНОПКА СТАРТА / РЕСТАРТА */}
        {canStartGame && (
          <button
            onClick={startGame}
            style={{
              height: 42,
              padding: '0 25px',
              borderRadius: 12,
              backgroundColor: isGameOver ? '#F59E0B' : 'var(--app-accent, #3B82F6)',
              color: '#FFF',
              border: 'none',
              fontWeight: 'bold',
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
            }}
          >
            {isGameOver ? 'PLAY AGAIN' : 'START MATCH'}
          </button>
        )}

        {/* ROOM ID */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1E2330', border: '1px solid #334155', borderRadius: 8, padding: '6px 12px' }}>
          <span style={{ fontSize: 16 }}>🎮</span>
          <span style={{ color: '#94A3B8', fontSize: 13 }}>Room ID:</span>
          <span style={{ color: '#FFF', fontSize: 15, fontWeight: 'bold' }}>{currentRoom.roomId}</span>
        </div>
      </div>

      {/* 2. КОНТЕНТ (ДОСКА СЛЕВА | ЧАТ И ИГРОКИ СПРАВА) */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {/* ЛЕВАЯ ЧАСТЬ: ИГРОВАЯ ДОСКА */}
          <div
            style={{
              padding: 6,
              borderRadius: 24,
              border: `2px solid ${isMyTurn ? 'var(--app-accent, #3B82F6)' : '#334155'}`,
              backgroundColor: '#161B26',
              boxShadow: isMyTurn ? '0 0 30px rgba(59, 130, 246, 0.3)' : 'none',
            }}
          >
            {/* А) КЛАССИЧЕСКИЕ ДОСКИ (TicTacToe, Checkers, Chess) */}
            {!isBattleship && (
              <div
                style={{
                  width: 448,
                  height: 448,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${boardDimension}, 1fr)`,
                  gridTemplateRows: `repeat(${boardDimension}, 1fr)`,
                  transform: isBoardFlipped ? 'rotate(180deg)' : 'none',
                }}
              >
                {boardCells.map((cell) => {
                  const isBlackSquare = cell.cellType === 'ChessDark' || cell.cellType === 'CheckersDark';
                  let bg = isBlackSquare ? '#739552' : '#EBECD0';
                  if (cell.cellType === 'TicTacToe') bg = '#1E2330';
                  if (cell.isPossibleMove) bg = 'rgba(56, 189, 248, 0.5)';
                  if (cell.isPossibleCapture) bg = 'rgba(239, 68, 68, 0.5)';
                  if (cell.isSelected) bg = 'rgba(245, 158, 11, 0.6)';

                  return (
                    <button
                      key={cell.index}
                      onClick={() => makeMove(cell.index)}
                      style={{
                        backgroundColor: bg,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: isBoardFlipped ? 'rotate(180deg)' : 'none',
                        margin: cell.cellType === 'TicTacToe' ? 4 : 0,
                        borderRadius: cell.cellType === 'TicTacToe' ? 12 : 0,
                      }}
                    >
                      {/* Крестики-нолики */}
                      {BoardCellHelper.isTicTacToe(cell) && (
                        <span style={{ fontSize: 48, fontWeight: 900, color: cell.content === 'X' ? '#EF4444' : '#3B82F6' }}>
                          {cell.content}
                        </span>
                      )}

                      {/* Шашки */}
                      {BoardCellHelper.isCheckers(cell) && cell.content && (
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            border: '3px solid #FFF',
                            backgroundColor: BoardCellHelper.isRedPiece(cell) ? '#EF4444' : '#3B82F6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FDE047',
                            fontSize: 18,
                          }}
                        >
                          {BoardCellHelper.isKing(cell) && '👑'}
                        </div>
                      )}

                      {/* Шахматы */}
                      {BoardCellHelper.isChess(cell) && cell.content && (
                        <span style={{ fontSize: 38, color: BoardCellHelper.isWhiteChessPiece(cell) ? '#FFFFFF' : '#000000' }}>
                          {BoardCellHelper.getChessUnicode(cell.content)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Б) МОРСКОЙ БОЙ */}
            {isBattleship && (
              <div style={{ display: 'flex', gap: 20, padding: 10 }}>
                {/* Мой флот */}
                <div>
                  <div style={{ color: '#38BDF8', fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>MY FLEET</div>
                  <div style={{ width: 300, height: 300, display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 1, backgroundColor: '#334155' }}>
                    {myBattleshipCells.map((c) => (
                      <button
                        key={c.index}
                        onClick={() => makeMove(c.index)}
                        style={{
                          backgroundColor: c.content === 'S' ? '#3B82F6' : '#1E2330',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFF',
                          fontSize: 12,
                        }}
                      >
                        {c.content === 'H' && '❌'}
                        {c.content === 'M' && '•'}
                        {c.content === 'D' && '💀'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Правая панель Морского Боя */}
                <div style={{ width: 300 }}>
                  {currentRoom.isSetupPhase ? (
                    /* ФАЗА 1: РАССТАНОВКА */
                    <div>
                      <div style={{ color: '#FFF', fontWeight: 'bold', textAlign: 'center', marginBottom: 4 }}>FLEET SETUP</div>
                      <div style={{ color: '#94A3B8', fontSize: 11, textAlign: 'center', marginBottom: 12, minHeight: 32 }}>
                        {remainingShipsText}
                      </div>

                      <button onClick={toggleOrientation} style={battleshipBtnStyle}>
                        🔄 {isPlacementHorizontal ? 'Horizontal' : 'Vertical'}
                      </button>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, margin: '10px 0' }}>
                        {[1, 2, 3, 4].map((size) => (
                          <button
                            key={size}
                            onClick={() => setShipSize(size)}
                            style={{
                              padding: '8px 0',
                              borderRadius: 8,
                              border: 'none',
                              background: selectedShipSize === size ? '#3B82F6' : '#1E2330',
                              color: '#FFF',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                            }}
                          >
                            {size}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 15 }}>
                        <button onClick={autoPlaceShips} style={battleshipBtnStyle}>AUTO</button>
                        <button onClick={clearPlacements} style={battleshipBtnStyle}>CLEAR</button>
                      </div>

                      <button
                        onClick={confirmReady}
                        disabled={!canClickReady || isMyReady}
                        style={{
                          width: '100%',
                          height: 42,
                          borderRadius: 8,
                          border: 'none',
                          background: isMyReady ? '#1E2330' : canClickReady ? '#22C55E' : '#334155',
                          color: isMyReady ? '#94A3B8' : '#FFF',
                          fontWeight: 'bold',
                          cursor: canClickReady && !isMyReady ? 'pointer' : 'default',
                        }}
                      >
                        {isMyReady ? 'WAITING FOR OPPONENT...' : 'CONFIRM READY'}
                      </button>
                    </div>
                  ) : (
                    /* ФАЗА 2: СТРЕЛЬБА ПО РАДАРУ */
                    <div>
                      <div style={{ color: '#EF4444', fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>ENEMY RADAR</div>
                      <div style={{ width: 300, height: 300, display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 1, backgroundColor: '#334155' }}>
                        {enemyBattleshipCells.map((c) => (
                          <button
                            key={c.index}
                            onClick={() => makeMove(c.index)}
                            style={{
                              backgroundColor: '#1E2330',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#FFF',
                              fontSize: 12,
                            }}
                          >
                            {c.content === 'H' && '❌'}
                            {c.content === 'M' && '•'}
                            {c.content === 'D' && '💀'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ПРАВАЯ ЧАСТЬ: ПАНЕЛЬ С ВКЛАДКАМИ (270px) */}
          <div
            style={{
              width: 270,
              height: 460,
              backgroundColor: '#161B26',
              border: '1px solid #334155',
              borderRadius: 20,
              padding: 15,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
            }}
          >
            {/* Вкладки Chat / Players */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#1E2330', borderRadius: 10, padding: 3, marginBottom: 12 }}>
              <button
                onClick={() => setRightTab('chat')}
                style={{
                  background: rightTab === 'chat' ? 'var(--app-accent, #3B82F6)' : 'transparent',
                  color: rightTab === 'chat' ? '#FFF' : '#94A3B8',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 0',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Chat
              </button>
              <button
                onClick={() => setRightTab('players')}
                style={{
                  background: rightTab === 'players' ? 'var(--app-accent, #3B82F6)' : 'transparent',
                  color: rightTab === 'players' ? '#FFF' : '#94A3B8',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 0',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Players
              </button>
            </div>

            {/* КОНТЕНТ ВКЛАДКИ ЧАТА */}
            {rightTab === 'chat' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                  {chatMessages.map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        marginBottom: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: m.isMine ? 'flex-end' : 'flex-start',
                      }}
                    >
                      {!m.isMine && <span style={{ fontSize: 11, color: '#38BDF8', fontWeight: 600 }}>{m.senderName}</span>}
                      <div
                        style={{
                          padding: '8px 10px',
                          borderRadius: m.isMine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                          backgroundColor: m.isMine ? 'var(--app-accent, #3B82F6)' : '#1E2330',
                          color: '#FFF',
                          fontSize: 13,
                          maxWidth: 210,
                          wordBreak: 'break-word',
                        }}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                    style={{
                      flex: 1,
                      background: '#1E2330',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      padding: '0 10px',
                      color: '#FFF',
                      outline: 'none',
                      fontSize: 13,
                    }}
                  />
                  <button
                    onClick={sendChatMessage}
                    style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--app-accent, #3B82F6)', border: 'none', color: '#FFF', cursor: 'pointer' }}
                  >
                    ➤
                  </button>
                </div>
              </div>
            ) : (
              /* КОНТЕНТ ВКЛАДКИ ИГРОКОВ */
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {currentRoom.players.map((p) => (
                  <div
                    key={p.userId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 10,
                      background: '#1E2330',
                      borderRadius: 10,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 17, background: '#3B82F6', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                        {p.symbol || p.nickName.charAt(0)}
                      </div>
                      <span style={{ color: '#FFF', fontSize: 14, fontWeight: 600 }}>{p.nickName}</span>
                    </div>
                    <span style={{ color: '#FDE047', fontWeight: 'bold', fontSize: 15 }}>{p.score} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. ОВЕРЛЕЙ КОНЦА ИГРЫ */}
      {isGameOverOverlayVisible && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            style={{
              minWidth: 420,
              background: '#161B26',
              border: '2px solid #334155',
              borderRadius: 24,
              padding: '30px 40px',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', marginBottom: 12 }}>MATCH RESULT</div>
            <div style={{ fontSize: 38, fontWeight: 900, color: '#FFF', marginBottom: 35 }}>{gameStatusText}</div>

            <div style={{ display: 'flex', gap: 15, justifyContent: 'center' }}>
              <button
                onClick={leaveRoom}
                style={{ height: 48, padding: '0 25px', borderRadius: 12, background: '#1E2330', border: '1px solid #334155', color: '#FFF', fontWeight: 'bold', cursor: 'pointer' }}
              >
                LEAVE ROOM
              </button>
              <button
                onClick={startGame}
                style={{ height: 48, padding: '0 25px', borderRadius: 12, background: 'var(--app-accent, #3B82F6)', border: 'none', color: '#FFF', fontWeight: 'bold', cursor: 'pointer' }}
              >
                PLAY AGAIN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const battleshipBtnStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  borderRadius: 8,
  background: '#1E2330',
  border: '1px solid #334155',
  color: '#FFF',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};