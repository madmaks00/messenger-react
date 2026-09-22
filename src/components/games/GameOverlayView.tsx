import React, { useRef, useEffect, useState } from 'react';
import {
  mdiArrowLeft,
  mdiReplay,
  mdiGrid,
  mdiCheckerboard,
  mdiChessKnight,
  mdiFerry,
  mdiPalette,
  mdiPencil,
  mdiCrown,
  mdiCircle,
  mdiCloseThick,
  mdiSkull,
  mdiRotateRight,
  mdiTrashCanOutline,
  mdiBrush,
  mdiEraser,
  mdiFormatColorFill,
  mdiCheck,
  mdiTimerOutline,
  mdiTimerSand,
  mdiSend,
  mdiExitToApp,
  mdiClose,
} from '@mdi/js';

import { useGamesStore } from '../../stores/gamesStore';
import { BoardCellHelper } from '../../types/models';
import { DrawingCanvas } from './DrawingCanvas';

const SWATCH_COLORS = ['#000000', '#FFFFFF', '#FF0000', '#FFA500', '#FFFF00', '#008000', '#0000FF', '#FF00FF'];
const RATING_BRUSHES = ['#FF4B4B', '#FF6B4B', '#FF8B4B', '#FFAB4B', '#FFCB4B', '#E5D220', '#B5D220', '#85D220', '#55D220', '#00D2FF'];

export const GameOverlayView: React.FC = () => {
  const {
    currentRoom,
    isGameOverlayVisible,
    isHost,
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
    isClassicGame,
    isDrawAndRate,
    isDrawAndGuess,
    drawPhase,
    remainingShipsText,
    isPlacementHorizontal,
    placementOrientationText,
    selectedShipSize,
    canClickReady,
    isMyReady,
    proposedWords,
    selectedWord,
    guessWordText,
    phaseTimerText,
    hasSubmittedDrawing,
    hasVotedCurrentRating,
    currentDrawingPlayerName,
    currentDrawingImage,
    drawResults,
    chatMessages,
    chatInput,
    customBrushColor,
    drawingMode,
    leaveRoom,
    startGame,
    closeGameOverOverlay,
    makeMove,
    sendChatMessage,
    setChatInput,
    toggleOrientation,
    setShipSize,
    autoPlaceLocal,
    clearPlacements,
    confirmReady,
    changeBrushColor,
    setDrawingMode,
    fillCanvas,
    clearCanvas,
    submitDrawing,
    voteWord,
    rateDrawing,
  } = useGamesStore();

  const [activeTab, setActiveTab] = useState<'Chat' | 'Players'>('Chat');
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages.length]);

  if (!isGameOverlayVisible || !currentRoom) return null;

  const renderGameIcon = (type: string) => {
    switch (type) {
      case 'TicTacToe': return mdiGrid;
      case 'Checkers': return mdiCheckerboard;
      case 'Chess': return mdiChessKnight;
      case 'Battleship': return mdiFerry;
      case 'DrawAndRate': return mdiPalette;
      case 'DrawAndGuess': return mdiPencil;
      default: return mdiGrid;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        background: 'radial-gradient(circle at 50% 50%, #1A2130 0%, #0B0E14 100%)',
        userSelect: 'none',
      }}
    >
      {/* ================= 1. ШАПКА ================= */}
      <div
        style={{
          backgroundColor: '#161A23',
          borderBottom: '1px solid #1F2533',
          padding: '10px 25px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center',
          boxSizing: 'border-box',
          height: 62,
        }}
      >
        {/* Кнопка "Назад" */}
        <button
          onClick={leaveRoom}
          style={{
            width: 42,
            height: 42,
            backgroundColor: '#1C212D',
            border: '1px solid #2A303C',
            borderRadius: 10,
            color: '#FFFFFF',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg viewBox="0 0 24 24" width={24} height={24} fill="#FFFFFF"><path d={mdiArrowLeft} /></svg>
        </button>

        {/* Кнопка START / PLAY AGAIN */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {canStartGame && (
            <button
              onClick={startGame}
              style={{
                height: 42,
                padding: '0 20px',
                borderRadius: 12,
                backgroundColor: isGameOver ? '#FF4B4B' : 'var(--app-accent, #1E9BEB)',
                color: '#FFFFFF',
                fontWeight: 'bold',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {isGameOver ? 'PLAY AGAIN' : 'START MATCH'}
            </button>
          )}
        </div>

        {/* Плашка Room ID */}
        <div
          style={{
            backgroundColor: '#1C212D',
            border: '1px solid #2A303C',
            borderRadius: 8,
            padding: '5px 10px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg viewBox="0 0 24 24" width={22} height={22} fill="#00D2FF" style={{ marginRight: 8 }}>
            <path d={renderGameIcon(currentRoom.gameType)} />
          </svg>
          <span style={{ color: '#8B94A5', fontSize: 14, marginRight: 4 }}>Room ID:</span>
          <span style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>{currentRoom.roomId}</span>
        </div>
      </div>

      {/* ================= 2. ОСНОВНОЙ КОНТЕНТ ================= */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px 10px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 270px', gap: 20, alignItems: 'start' }}>

          {/* ЛЕВАЯ ЧАСТЬ: ИГРОВОЕ ПОЛЕ */}
          <div
            style={{
              backgroundColor: '#111620',
              borderRadius: 24,
              border: `2px solid ${isMyTurn ? '#00D2FF' : '#1C2331'}`,
              boxShadow: isMyTurn ? '0 0 30px rgba(0, 210, 255, 0.3)' : 'none',
              padding: 0,
            }}
          >
            <div style={{ backgroundColor: '#0B0E14', borderRadius: 24, padding: 5 }}>

              {/* 1. КЛАССИЧЕСКИЕ ИГРЫ (TicTacToe, Checkers, Chess) */}
              {isClassicGame && (
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
                    let bg = '#161A23';
                    let border = '2px solid #2A303C';
                    let margin = 4;
                    let cursor = 'pointer';
                    let isHitTest = true;

                    if (cell.cellType === 'CheckersDark') { bg = '#111620'; border = 'none'; margin = 0; }
                    if (cell.cellType === 'CheckersLight') { bg = '#E2E8F0'; border = 'none'; margin = 0; isHitTest = false; cursor = 'default'; }
                    if (cell.cellType === 'ChessDark') { bg = '#5C755E'; border = 'none'; margin = 0; }
                    if (cell.cellType === 'ChessLight') { bg = '#EBEBD0'; border = 'none'; margin = 0; }

                    if (cell.isPossibleMove) { bg = '#1A3324'; border = '2px solid #2E7D32'; }
                    if (cell.isPossibleCapture) { bg = '#3B1A1A'; border = '2px solid #D32F2F'; }
                    if (cell.isSelected) { bg = '#1A2B4C'; border = '2px solid #00D2FF'; }

                    return (
                      <button
                        key={cell.index}
                        disabled={!isHitTest}
                        onClick={() => makeMove(cell.index)}
                        style={{
                          backgroundColor: bg,
                          border,
                          margin,
                          borderRadius: cell.cellType === 'TicTacToe' ? 12 : 0,
                          cursor,
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <div style={{ transform: isBoardFlipped ? 'rotate(180deg)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {/* Крестики-нолики */}
                          {BoardCellHelper.isTicTacToe(cell) && cell.content && (
                            <span style={{ fontSize: 72, fontWeight: 900, color: cell.content === 'X' ? '#FF4B4B' : '#00D2FF', lineHeight: 1 }}>
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
                                backgroundColor: BoardCellHelper.isRedPiece(cell) ? '#FF4B4B' : '#00D2FF',
                                border: `3px solid ${BoardCellHelper.isRedPiece(cell) ? '#4A2025' : '#1A3A4A'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxSizing: 'border-box',
                              }}
                            >
                              {BoardCellHelper.isKing(cell) && (
                                <svg viewBox="0 0 24 24" width={22} height={22} fill="gold"><path d={mdiCrown} /></svg>
                              )}
                            </div>
                          )}

                          {/* Шахматы */}
                          {BoardCellHelper.isChess(cell) && cell.content && (
                            <span
                              style={{
                                fontSize: 42,
                                color: BoardCellHelper.isWhiteChessPiece(cell) ? '#FAFAFA' : '#1A1A1A',
                                textShadow: BoardCellHelper.isWhiteChessPiece(cell) ? '2px 2px 2px #FFFFFF' : '1px 1px 1px #FFFFFF',
                              }}
                            >
                              {BoardCellHelper.getChessUnicode(cell.content)}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 2. МОРСКОЙ БОЙ */}
              {isBattleship && (
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: 5 }}>
                  {/* Мой флот */}
                  <div style={{ marginRight: 15 }}>
                    <div style={{ color: '#8B94A5', fontWeight: 'bold', textAlign: 'center', marginBottom: 10 }}>MY FLEET</div>
                    <div style={{ width: 300, height: 300, display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gridTemplateRows: 'repeat(10, 1fr)' }}>
                      {myBattleshipCells.map((cell) => {
                        let bg = '#0A1428';
                        if (cell.content === 'S') bg = '#8B94A5';
                        if (cell.content === 'H') bg = '#FF9800';
                        if (cell.content === 'D') bg = '#FF4B4B';

                        return (
                          <button
                            key={cell.index}
                            onClick={() => makeMove(cell.index)}
                            style={{
                              backgroundColor: bg,
                              border: '1px solid #1C2A45',
                              margin: 0,
                              padding: 0,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {cell.content === 'M' && <svg viewBox="0 0 24 24" width={8} height={8} fill="#00D2FF"><path d={mdiCircle} /></svg>}
                            {cell.content === 'H' && <svg viewBox="0 0 24 24" width={20} height={20} fill="#0B0E14"><path d={mdiCloseThick} /></svg>}
                            {cell.content === 'D' && <svg viewBox="0 0 24 24" width={18} height={18} fill="#0B0E14"><path d={mdiSkull} /></svg>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Правая панель морского боя */}
                  <div style={{ width: 300, marginLeft: 15 }}>
                    {currentRoom.isSetupPhase ? (
                      /* ФАЗА 1: РАССТАНОВКА */
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ color: '#00D2FF', fontWeight: 'bold', textAlign: 'center', marginBottom: 5 }}>FLEET SETUP</div>
                        <div style={{ color: '#8B94A5', fontSize: 11, textAlign: 'center', height: 32, marginBottom: 15 }}>
                          {remainingShipsText}
                        </div>

                        {/* Направление */}
                        <button
                          disabled={isMyReady}
                          onClick={toggleOrientation}
                          style={{
                            height: 36,
                            backgroundColor: '#1C212D',
                            border: '1px solid #2A303C',
                            color: '#FFFFFF',
                            borderRadius: 8,
                            cursor: isMyReady ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 10,
                          }}
                        >
                          <svg viewBox="0 0 24 24" width={18} height={18} fill="#FFFFFF" style={{ marginRight: 8 }}><path d={mdiRotateRight} /></svg>
                          <span>{placementOrientationText}</span>
                        </button>

                        {/* Размер корабля */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, marginBottom: 15 }}>
                          {[1, 2, 3, 4].map((size) => (
                            <button
                              key={size}
                              disabled={isMyReady}
                              onClick={() => setShipSize(size)}
                              style={{
                                height: 36,
                                backgroundColor: selectedShipSize === size ? '#1A212F' : 'transparent',
                                color: selectedShipSize === size ? '#FFFFFF' : '#8B94A5',
                                border: 'none',
                                borderRadius: 8,
                                fontWeight: 'bold',
                                cursor: isMyReady ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {size}
                            </button>
                          ))}
                        </div>

                        {/* Auto & Clear */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 15 }}>
                          <button
                            disabled={isMyReady}
                            onClick={autoPlaceLocal}
                            style={{ height: 36, backgroundColor: '#1C212D', border: '1px solid #2A303C', color: '#FFF', borderRadius: 8, fontSize: 12, cursor: isMyReady ? 'not-allowed' : 'pointer' }}
                          >
                            AUTO
                          </button>
                          <button
                            disabled={isMyReady}
                            onClick={clearPlacements}
                            style={{ height: 36, backgroundColor: '#1C212D', border: '1px solid #2A303C', color: '#FFF', borderRadius: 8, fontSize: 12, cursor: isMyReady ? 'not-allowed' : 'pointer' }}
                          >
                            CLEAR
                          </button>
                        </div>

                        {/* Готово */}
                        <button
                          disabled={!canClickReady || isMyReady}
                          onClick={confirmReady}
                          style={{
                            height: 42,
                            backgroundColor: isMyReady ? '#1C212D' : '#00D2FF',
                            color: isMyReady ? '#8B94A5' : '#0B0E14',
                            fontWeight: 'bold',
                            border: 'none',
                            borderRadius: 8,
                            cursor: canClickReady && !isMyReady ? 'pointer' : 'default',
                          }}
                        >
                          {isMyReady ? 'WAITING FOR OPPONENT...' : 'CONFIRM READY'}
                        </button>
                      </div>
                    ) : (
                      /* ФАЗА 2: СТРЕЛЬБА */
                      <div>
                        <div style={{ color: '#FF4B4B', fontWeight: 'bold', textAlign: 'center', marginBottom: 10 }}>ENEMY RADAR</div>
                        <div style={{ width: 300, height: 300, display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gridTemplateRows: 'repeat(10, 1fr)' }}>
                          {enemyBattleshipCells.map((cell) => {
                            let bg = '#0A1428';
                            if (cell.content === 'H') bg = '#FF9800';
                            if (cell.content === 'D') bg = '#FF4B4B';

                            return (
                              <button
                                key={cell.index}
                                onClick={() => makeMove(cell.index)}
                                style={{
                                  backgroundColor: bg,
                                  border: '1px solid #1C2A45',
                                  margin: 0,
                                  padding: 0,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {cell.content === 'M' && <svg viewBox="0 0 24 24" width={8} height={8} fill="#00D2FF"><path d={mdiCircle} /></svg>}
                                {cell.content === 'H' && <svg viewBox="0 0 24 24" width={20} height={20} fill="#0B0E14"><path d={mdiCloseThick} /></svg>}
                                {cell.content === 'D' && <svg viewBox="0 0 24 24" width={18} height={18} fill="#0B0E14"><path d={mdiSkull} /></svg>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. DRAW & RATE */}
              {isDrawAndRate && (
                <div style={{ width: 450, height: 450, position: 'relative', padding: 10, boxSizing: 'border-box' }}>
                  {/* Верхняя инфо-панель */}
                  {drawPhase !== 4 && (
                    <div
                      style={{
                        backgroundColor: '#1A2130',
                        borderRadius: 12,
                        height: 40,
                        padding: '0 15px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 10,
                      }}
                    >
                      {drawPhase === 2 && (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={{ color: '#8B94A5', fontWeight: 'bold', marginRight: 8 }}>TOPIC:</span>
                          <span style={{ color: '#00D2FF', fontSize: 18, fontWeight: 900 }}>{selectedWord}</span>
                        </div>
                      )}
                      {drawPhase === 3 && (
                        <div style={{ display: 'flex', alignItems: 'center', margin: '0 auto' }}>
                          <span style={{ color: '#8B94A5', fontSize: 15, fontWeight: 600 }}>Drawing by:</span>
                          <span style={{ color: '#00D2FF', fontSize: 16, fontWeight: 'bold', marginLeft: 4 }}>{currentDrawingPlayerName}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
                        <svg viewBox="0 0 24 24" width={22} height={22} fill="#FF4B4B" style={{ marginRight: 5 }}><path d={mdiTimerOutline} /></svg>
                        <span style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>{phaseTimerText}</span>
                      </div>
                    </div>
                  )}

                  {/* Фаза 1: Голосование за слово */}
                  {drawPhase === 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 380 }}>
                      <div style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', marginBottom: 20 }}>VOTE FOR A TOPIC</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
                        {proposedWords.map((word) => (
                          <button
                            key={word}
                            onClick={() => voteWord(word)}
                            style={{
                              height: 40,
                              backgroundColor: '#1C212D',
                              border: '1px solid #2A303C',
                              color: '#FFFFFF',
                              borderRadius: 8,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {word}
                          </button>
                        ))}
                      </div>
                      {proposedWords.length === 0 && (
                        <div style={{ color: '#8B94A5', marginTop: 20 }}>Waiting for players...</div>
                      )}
                    </div>
                  )}

                  {/* Фаза 2: Рисование */}
                  {drawPhase === 2 && (
                    <div style={{ position: 'relative', height: 380, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ flex: 1, backgroundColor: '#E2E8F0', overflow: 'hidden', marginBottom: 10 }}>
                        <DrawingCanvas width={430} height={325} readOnly={hasSubmittedDrawing} />
                      </div>

                      {/* Панель инструментов */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'center' }}>
                        <button
                          disabled={hasSubmittedDrawing}
                          onClick={clearCanvas}
                          style={{ width: 40, height: 40, backgroundColor: '#FF4B4B', border: 'none', borderRadius: 8, color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <svg viewBox="0 0 24 24" width={20} height={20} fill="#FFF"><path d={mdiTrashCanOutline} /></svg>
                        </button>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, position: 'relative' }}>
                          <button
                            disabled={hasSubmittedDrawing}
                            onClick={() => setDrawingMode('ink')}
                            style={{
                              width: 40,
                              height: 40,
                              backgroundColor: drawingMode === 'ink' ? 'var(--app-accent, #1E9BEB)' : '#1C212D',
                              border: 'none',
                              borderRadius: 8,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <svg viewBox="0 0 24 24" width={22} height={22} fill="#FFF"><path d={mdiBrush} /></svg>
                          </button>
                          <button
                            disabled={hasSubmittedDrawing}
                            onClick={() => setDrawingMode('erase')}
                            style={{
                              width: 40,
                              height: 40,
                              backgroundColor: drawingMode === 'erase' ? 'var(--app-accent, #1E9BEB)' : '#1C212D',
                              border: 'none',
                              borderRadius: 8,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <svg viewBox="0 0 24 24" width={22} height={22} fill="#FFF"><path d={mdiEraser} /></svg>
                          </button>
                          <button
                            disabled={hasSubmittedDrawing}
                            onClick={fillCanvas}
                            style={{
                              width: 40,
                              height: 40,
                              backgroundColor: '#1C212D',
                              border: 'none',
                              borderRadius: 8,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <svg viewBox="0 0 24 24" width={22} height={22} fill="#8B94A5"><path d={mdiFormatColorFill} /></svg>
                          </button>

                          {/* Кнопка открытия палитры */}
                          <button
                            disabled={hasSubmittedDrawing}
                            onClick={() => setIsPaletteOpen(!isPaletteOpen)}
                            style={{
                              width: 40,
                              height: 40,
                              backgroundColor: '#1C212D',
                              border: 'none',
                              borderRadius: 8,
                              cursor: 'pointer',
                              position: 'relative',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <svg viewBox="0 0 24 24" width={22} height={22} fill="#8B94A5"><path d={mdiPalette} /></svg>
                            <div style={{ position: 'absolute', right: 4, bottom: 4, width: 10, height: 10, borderRadius: 5, backgroundColor: customBrushColor, border: '2px solid #1C212D' }} />
                          </button>

                          {/* Всплывающий островок палитры */}
                          {isPaletteOpen && (
                            <div
                              style={{
                                position: 'absolute',
                                bottom: 50,
                                backgroundColor: '#1E232E',
                                borderRadius: 16,
                                padding: 15,
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                boxShadow: '0 5px 25px rgba(0,0,0,0.5)',
                                zIndex: 100,
                              }}
                            >
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                                {SWATCH_COLORS.map((col) => (
                                  <button
                                    key={col}
                                    onClick={() => { changeBrushColor(col); setIsPaletteOpen(false); }}
                                    style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: 16,
                                      backgroundColor: col,
                                      border: customBrushColor === col ? '2px solid #FFF' : '1px solid #334155',
                                      cursor: 'pointer',
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Submit */}
                        <button
                          disabled={hasSubmittedDrawing}
                          onClick={submitDrawing}
                          style={{
                            height: 40,
                            backgroundColor: 'var(--app-accent, #1E9BEB)',
                            color: '#FFF',
                            fontWeight: 'bold',
                            border: 'none',
                            borderRadius: 8,
                            padding: '0 15px',
                            cursor: hasSubmittedDrawing ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <span>SUBMIT</span>
                          <svg viewBox="0 0 24 24" width={18} height={18} fill="#FFF"><path d={mdiCheck} /></svg>
                        </button>
                      </div>

                      {hasSubmittedDrawing && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFFFFF',
                            fontSize: 20,
                            fontWeight: 'bold',
                          }}
                        >
                          WAITING FOR OTHERS...
                        </div>
                      )}
                    </div>
                  )}

                  {/* Фаза 3: Голосование за рисунки */}
                  {drawPhase === 3 && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: 380 }}>
                      <div style={{ flex: 1, backgroundColor: '#FFFFFF', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {currentDrawingImage && (
                          <img
                            src={currentDrawingImage.startsWith('data:') ? currentDrawingImage : `data:image/png;base64,${currentDrawingImage}`}
                            alt="Current drawing"
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          />
                        )}
                      </div>

                      {/* Рейтинг 1-10 */}
                      <div style={{ position: 'relative' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                            <button
                              key={score}
                              disabled={hasVotedCurrentRating}
                              onClick={() => rateDrawing(score)}
                              style={{
                                height: 38,
                                borderRadius: 8,
                                backgroundColor: RATING_BRUSHES[score - 1],
                                color: '#FFFFFF',
                                fontSize: 16,
                                fontWeight: 900,
                                border: 'none',
                                cursor: hasVotedCurrentRating ? 'default' : 'pointer',
                              }}
                            >
                              {score}
                            </button>
                          ))}
                        </div>

                        {hasVotedCurrentRating && (
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              backgroundColor: 'rgba(11, 14, 20, 0.9)',
                              borderRadius: 12,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#00D2FF',
                              fontSize: 16,
                              fontWeight: 900,
                            }}
                          >
                            RATING SAVED
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Фаза 4: Результаты */}
                  {drawPhase === 4 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 420 }}>
                      <div style={{ color: '#00D2FF', fontSize: 26, fontWeight: 900, marginBottom: 20 }}>TOTAL SCORES</div>
                      <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {drawResults.map((res) => (
                          <div
                            key={res.key}
                            style={{
                              backgroundColor: '#1C212D',
                              borderRadius: 8,
                              padding: '10px 20px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ color: '#FFF', fontSize: 16, fontWeight: 600 }}>{res.key}</span>
                            <span style={{ color: '#FFC107', fontSize: 16, fontWeight: 'bold' }}>{res.value} pts</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: 20 }}>
                        {!isGameOver && (
                          <div style={{ color: '#8B94A5' }}>Next round starting soon...</div>
                        )}
                        {isGameOver && (
                          <div>
                            {isHost ? (
                              <button
                                onClick={startGame}
                                style={{
                                  height: 42,
                                  backgroundColor: 'var(--app-accent, #1E9BEB)',
                                  color: '#FFF',
                                  fontWeight: 'bold',
                                  padding: '0 25px',
                                  borderRadius: 12,
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                }}
                              >
                                <svg viewBox="0 0 24 24" width={20} height={20} fill="#FFF"><path d={mdiReplay} /></svg>
                                <span>PLAY AGAIN</span>
                              </button>
                            ) : (
                              <div style={{ backgroundColor: '#1C212D', border: '1px solid #2A303C', borderRadius: 12, padding: '0 25px', height: 42, display: 'flex', alignItems: 'center' }}>
                                <svg viewBox="0 0 24 24" width={18} height={18} fill="#8B94A5" style={{ marginRight: 8 }}><path d={mdiTimerSand} /></svg>
                                <span style={{ color: '#8B94A5', fontSize: 13, fontWeight: 600 }}>WAITING FOR HOST...</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. DRAW & GUESS */}
              {isDrawAndGuess && (
                <div style={{ width: 450, height: 450, position: 'relative', padding: 10, boxSizing: 'border-box' }}>
                  {/* Верхняя инфо-панель */}
                  <div
                    style={{
                      backgroundColor: '#1A2130',
                      borderRadius: 12,
                      height: 40,
                      padding: '0 15px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                    }}
                  >
                    {isMyTurn ? (
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ color: '#8B94A5', fontWeight: 'bold', marginRight: 8 }}>DRAW:</span>
                        <span style={{ color: '#00D2FF', fontSize: 18, fontWeight: 900 }}>{selectedWord}</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ color: '#8B94A5', fontWeight: 'bold', marginRight: 8 }}>GUESS:</span>
                        <span style={{ color: '#FFC107', fontSize: 18, fontWeight: 900 }}>{guessWordText}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ color: '#8B94A5', fontSize: 15, fontWeight: 600 }}>Artist:</span>
                      <span style={{ color: '#00D2FF', fontSize: 16, fontWeight: 'bold', marginLeft: 4 }}>{currentDrawingPlayerName}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <svg viewBox="0 0 24 24" width={22} height={22} fill="#FF4B4B" style={{ marginRight: 5 }}><path d={mdiTimerOutline} /></svg>
                      <span style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>{phaseTimerText}</span>
                    </div>
                  </div>

                  {/* Фаза 1: Процесс */}
                  {drawPhase === 1 && (
                    <div style={{ height: 380, display: 'flex', flexDirection: 'column' }}>
                      {isMyTurn ? (
                        /* Панель художника */
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ flex: 1, backgroundColor: '#E2E8F0', overflow: 'hidden', marginBottom: 10 }}>
                            <DrawingCanvas width={430} height={325} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'center' }}>
                            <button
                              onClick={clearCanvas}
                              style={{ width: 40, height: 40, backgroundColor: '#FF4B4B', border: 'none', borderRadius: 8, color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <svg viewBox="0 0 24 24" width={20} height={20} fill="#FFF"><path d={mdiTrashCanOutline} /></svg>
                            </button>

                            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, position: 'relative' }}>
                              <button
                                onClick={() => setDrawingMode('ink')}
                                style={{ width: 40, height: 40, backgroundColor: drawingMode === 'ink' ? 'var(--app-accent, #1E9BEB)' : '#1C212D', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg viewBox="0 0 24 24" width={22} height={22} fill="#FFF"><path d={mdiBrush} /></svg>
                              </button>
                              <button
                                onClick={() => setDrawingMode('erase')}
                                style={{ width: 40, height: 40, backgroundColor: drawingMode === 'erase' ? 'var(--app-accent, #1E9BEB)' : '#1C212D', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg viewBox="0 0 24 24" width={22} height={22} fill="#FFF"><path d={mdiEraser} /></svg>
                              </button>
                              <button
                                onClick={fillCanvas}
                                style={{ width: 40, height: 40, backgroundColor: '#1C212D', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg viewBox="0 0 24 24" width={22} height={22} fill="#8B94A5"><path d={mdiFormatColorFill} /></svg>
                              </button>
                              <button
                                onClick={() => setIsPaletteOpen(!isPaletteOpen)}
                                style={{ width: 40, height: 40, backgroundColor: '#1C212D', border: 'none', borderRadius: 8, cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg viewBox="0 0 24 24" width={22} height={22} fill="#8B94A5"><path d={mdiPalette} /></svg>
                                <div style={{ position: 'absolute', right: 4, bottom: 4, width: 10, height: 10, borderRadius: 5, backgroundColor: customBrushColor, border: '2px solid #1C212D' }} />
                              </button>

                              {isPaletteOpen && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    bottom: 50,
                                    backgroundColor: '#1E232E',
                                    borderRadius: 16,
                                    padding: 15,
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    boxShadow: '0 5px 25px rgba(0,0,0,0.5)',
                                    zIndex: 100,
                                  }}
                                >
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                                    {SWATCH_COLORS.map((col) => (
                                      <button
                                        key={col}
                                        onClick={() => { changeBrushColor(col); setIsPaletteOpen(false); }}
                                        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: col, border: customBrushColor === col ? '2px solid #FFF' : '1px solid #334155', cursor: 'pointer' }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Панель угадывающих */
                        <div style={{ flex: 1, backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {currentDrawingImage && (
                            <img
                              src={currentDrawingImage.startsWith('data:') ? currentDrawingImage : `data:image/png;base64,${currentDrawingImage}`}
                              alt="Live stream"
                              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Фаза 2: Результаты раунда */}
                  {drawPhase === 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 420 }}>
                      <div style={{ color: '#00D2FF', fontSize: 26, fontWeight: 900, marginBottom: 10 }}>ROUND RESULTS</div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                        <span style={{ color: '#8B94A5', fontSize: 16 }}>The word was:</span>
                        <span style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>{selectedWord}</span>
                      </div>

                      <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {drawResults.map((res) => (
                          <div
                            key={res.key}
                            style={{ backgroundColor: '#1C212D', borderRadius: 8, padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          >
                            <span style={{ color: '#FFF', fontSize: 16, fontWeight: 600 }}>{res.key}</span>
                            <span style={{ color: '#FFC107', fontSize: 16, fontWeight: 'bold' }}>{res.value} pts</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: 20 }}>
                        {!isGameOver && <div style={{ color: '#8B94A5' }}>Next round starting soon...</div>}
                        {isGameOver && (
                          <div>
                            {isHost ? (
                              <button
                                onClick={startGame}
                                style={{ height: 42, backgroundColor: 'var(--app-accent, #1E9BEB)', color: '#FFF', fontWeight: 'bold', padding: '0 25px', borderRadius: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                              >
                                <svg viewBox="0 0 24 24" width={20} height={20} fill="#FFF"><path d={mdiReplay} /></svg>
                                <span>PLAY AGAIN</span>
                              </button>
                            ) : (
                              <div style={{ backgroundColor: '#1C212D', border: '1px solid #2A303C', borderRadius: 12, padding: '0 25px', height: 42, display: 'flex', alignItems: 'center' }}>
                                <svg viewBox="0 0 24 24" width={18} height={18} fill="#8B94A5" style={{ marginRight: 8 }}><path d={mdiTimerSand} /></svg>
                                <span style={{ color: '#8B94A5', fontSize: 13, fontWeight: 600 }}>WAITING FOR HOST...</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ================= ПРАВАЯ ЧАСТЬ: БОКОВАЯ ПАНЕЛЬ С ВКЛАДКАМИ ================= */}
          <div
            style={{
              width: 270,
              height: 488,
              backgroundColor: '#111620',
              border: '1px solid #1C2331',
              borderRadius: 20,
              padding: 15,
              display: 'grid',
              gridTemplateRows: 'auto 1fr',
              boxSizing: 'border-box',
            }}
          >
            {/* Переключатель вкладок */}
            <div
              style={{
                backgroundColor: '#0B0E14',
                borderRadius: 10,
                padding: 4,
                marginBottom: 15,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
              }}
            >
              <button
                onClick={() => setActiveTab('Chat')}
                style={{
                  height: 36,
                  backgroundColor: activeTab === 'Chat' ? '#1A212F' : 'transparent',
                  color: activeTab === 'Chat' ? '#FFFFFF' : '#8B94A5',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Chat
              </button>
              <button
                onClick={() => setActiveTab('Players')}
                style={{
                  height: 36,
                  backgroundColor: activeTab === 'Players' ? '#1A212F' : 'transparent',
                  color: activeTab === 'Players' ? '#FFFFFF' : '#8B94A5',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Players
              </button>
            </div>

            {/* Контент вкладки ЧАТ */}
            {activeTab === 'Chat' && (
              <div style={{ display: 'grid', gridTemplateRows: '1fr auto', overflow: 'hidden' }}>
                <div
                  ref={chatScrollRef}
                  className="wpf-scroll-viewer"
                  style={{ overflowY: 'auto', marginBottom: 10, paddingRight: 4 }}
                >
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} style={{ marginBottom: 8, display: 'flex', flexDirection: 'column' }}>
                      {msg.isSystem ? (
                        <div style={{ alignSelf: 'center', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '4px 10px', borderRadius: 10 }}>
                          <span style={{ color: '#8B94A5', fontSize: 11 }}>{msg.text}</span>
                        </div>
                      ) : (
                        <div style={{ maxWidth: 220, alignSelf: msg.isMine ? 'flex-end' : 'flex-start' }}>
                          {!msg.isMine && (
                            <div style={{ fontSize: 11, color: '#8B94A5', fontWeight: 600, marginLeft: 7, marginBottom: 2 }}>
                              {msg.senderName}
                            </div>
                          )}
                          <div style={{ position: 'relative', display: 'flex' }}>
                            {/* Хвостик слева */}
                            {!msg.isMine && (
                              <svg viewBox="0 0 8 8" width={8} height={8} fill="#1A212F" style={{ position: 'absolute', left: -7, bottom: 0 }}>
                                <path d="M 8,8 L 0,8 L 8,0 Z" />
                              </svg>
                            )}

                            <div
                              style={{
                                padding: '8px 10px',
                                backgroundColor: msg.isMine ? 'var(--app-accent, #1E9BEB)' : '#1A212F',
                                borderRadius: msg.isMine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                                color: '#FFFFFF',
                                fontSize: 13,
                                wordBreak: 'break-word',
                              }}
                            >
                              {msg.text}
                            </div>

                            {/* Хвостик справа */}
                            {msg.isMine && (
                              <svg viewBox="0 0 8 8" width={8} height={8} fill="var(--app-accent, #1E9BEB)" style={{ position: 'absolute', right: -7, bottom: 0 }}>
                                <path d="M 0,8 L 8,8 L 0,0 Z" />
                              </svg>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Поле ввода сообщения */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                  <div
                    style={{
                      backgroundColor: '#0B0E14',
                      borderRadius: 10,
                      padding: '0 10px',
                      display: 'flex',
                      alignItems: 'center',
                      height: 36,
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                      style={{
                        width: '100%',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#FFFFFF',
                        outline: 'none',
                        fontSize: 13,
                      }}
                    />
                  </div>
                  <button
                    onClick={sendChatMessage}
                    style={{
                      width: 28,
                      height: 28,
                      backgroundColor: 'var(--app-accent, #1E9BEB)',
                      border: 'none',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="#FFFFFF"><path d={mdiSend} /></svg>
                  </button>
                </div>
              </div>
            )}

            {/* Контент вкладки ИГРОКИ */}
            {activeTab === 'Players' && (
              <div className="wpf-scroll-viewer" style={{ overflowY: 'auto' }}>
                {currentRoom.players.map((p) => (
                  <div
                    key={p.userId}
                    style={{
                      backgroundColor: '#1A212F',
                      border: '1px solid #252D3D',
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 10,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: '#0B0E14',
                          border: '1px solid #2A3245',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                          color: '#00D2FF',
                          fontWeight: 'bold',
                        }}
                      >
                        {p.symbol || p.nickName.charAt(0)}
                      </div>
                      <span style={{ color: '#FFFFFF', fontSize: 16 }}>{p.nickName}</span>
                    </div>

                    <span style={{ color: '#FFC107', fontWeight: 'bold', fontSize: 16 }}>
                      {p.score}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= 3. ОВЕРЛЕЙ КОНЦА ИГРЫ ================= */}
      {isGameOverOverlayVisible && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#111620',
              border: '2px solid #1C2331',
              borderRadius: 24,
              padding: 15,
              minWidth: 450,
              boxShadow: '0 0 50px rgba(0, 0, 0, 0.8)',
              position: 'relative',
              boxSizing: 'border-box',
            }}
          >
            {/* Крестик закрытия */}
            <button
              onClick={closeGameOverOverlay}
              style={{
                position: 'absolute',
                top: 15,
                right: 15,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: 'transparent',
                border: 'none',
                color: '#8B94A5',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg viewBox="0 0 24 24" width={24} height={24} fill="#8B94A5"><path d={mdiClose} /></svg>
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '25px 25px 35px 25px' }}>
              <div style={{ color: '#8B94A5', fontSize: 14, fontWeight: 600, marginBottom: 10 }}>MATCH RESULT</div>
              <div style={{ color: '#FFFFFF', fontSize: 42, fontWeight: 900, marginBottom: 40, textAlign: 'center' }}>
                {gameStatusText}
              </div>

              <div style={{ display: 'flex', gap: 15 }}>
                {/* Выйти из комнаты */}
                <button
                  onClick={leaveRoom}
                  style={{
                    height: 48,
                    backgroundColor: '#1C212D',
                    border: '1px solid #2A303C',
                    borderRadius: 12,
                    color: '#FFFFFF',
                    fontWeight: 'bold',
                    padding: '0 25px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <svg viewBox="0 0 24 24" width={20} height={20} fill="#FFF"><path d={mdiExitToApp} /></svg>
                  <span style={{ fontSize: 14 }}>LEAVE ROOM</span>
                </button>

                {/* PLAY AGAIN */}
                {isHost ? (
                  <button
                    onClick={startGame}
                    style={{
                      height: 48,
                      backgroundColor: '#00D2FF',
                      color: '#0B0E14',
                      fontWeight: 'bold',
                      borderRadius: 12,
                      padding: '0 25px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <svg viewBox="0 0 24 24" width={22} height={22} fill="#0B0E14"><path d={mdiReplay} /></svg>
                    <span style={{ fontSize: 14 }}>PLAY AGAIN</span>
                  </button>
                ) : (
                  <div
                    style={{
                      backgroundColor: '#1C212D',
                      border: '1px solid #2A303C',
                      borderRadius: 12,
                      padding: '0 25px',
                      height: 48,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <svg viewBox="0 0 24 24" width={20} height={20} fill="#8B94A5" style={{ marginRight: 8 }}>
                      <path d={mdiTimerSand} />
                    </svg>
                    <span style={{ color: '#8B94A5', fontSize: 14, fontWeight: 600 }}>WAITING FOR HOST...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};