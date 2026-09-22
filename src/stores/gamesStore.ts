import { create } from 'zustand';
import { GameRoomDto, GameChatMessageDto, GamePlayerDto } from '../types/dtos';
import { IBoardCell, IGameItem } from '../types/models';
import { gameSignalrService } from '../services/gameSignalr.service';
import { BattleshipEngineService } from '../services/gameEngines/battleshipEngine.service';
import { CheckersEngineService } from '../services/gameEngines/checkersEngine.service';
import { ChessEngineService } from '../services/gameEngines/chessEngine.service';
import { InkCanvasService, ICanvasStroke } from '../services/inkCanvas.service';
import { userSession } from '../services/userSession';
import { eventBus } from '../services/eventBus';

const AVAILABLE_GAMES: IGameItem[] = [
  { name: 'Tic-Tac-Toe', iconKind: 'Grid', internalId: 'TicTacToe' },
  { name: 'Checkers', iconKind: 'Checkerboard', internalId: 'Checkers' },
  { name: 'Chess', iconKind: 'ChessKnight', internalId: 'Chess' },
  { name: 'Battleship', iconKind: 'Ferry', internalId: 'Battleship' },
  { name: 'Draw & Rate', iconKind: 'Palette', internalId: 'DrawAndRate' },
  { name: 'Draw & Guess', iconKind: 'Pencil', internalId: 'DrawAndGuess' },
];

export interface KeyValuePair<K, V> {
  key: K;
  value: V;
}

interface GamesState {
  availableGames: IGameItem[];
  selectedGame: IGameItem | null;
  currentRoom: GameRoomDto | null;
  isGameOverlayVisible: boolean;
  isJoinGameDialogOpen: boolean;
  inputRoomId: string;
  inputRoomPassword: string;
  isHost: boolean;
  canStartGame: boolean;
  isGameOver: boolean;
  isGameOverOverlayVisible: boolean;
  gameStatusText: string;
  isMyTurn: boolean;

  // Игровые доски
  boardCells: IBoardCell[];
  boardDimension: number;
  isBoardFlipped: boolean;
  myBattleshipCells: IBoardCell[];
  enemyBattleshipCells: IBoardCell[];

  // Морской бой
  isBattleship: boolean;
  isClassicGame: boolean;
  selectedShipSize: number;
  isPlacementHorizontal: boolean;
  placementOrientationText: string;
  remainingShipsText: string;
  canClickReady: boolean;
  isMyReady: boolean;

  // Чат лобби
  chatMessages: GameChatMessageDto[];
  chatInput: string;

  // Рисование (Draw & Rate / Draw & Guess)
  isDrawAndRate: boolean;
  isDrawAndGuess: boolean;
  drawPhase: number;
  proposedWords: string[];
  selectedWord: string;
  guessWordText: string;
  phaseTimerText: string;
  hasSubmittedDrawing: boolean;
  hasVotedCurrentRating: boolean;
  currentDrawingPlayerName: string;
  currentDrawingImage: string | null;
  drawResults: KeyValuePair<string, number>[];
  customBrushColor: string;
  drawingMode: 'ink' | 'erase';
  drawCanvasBackground: string;
  drawStrokes: ICanvasStroke[];

  // Команды жизненного цикла и комнат
  selectGame: (game: IGameItem) => void;
  openJoinDialog: () => void;
  closeJoinDialog: () => void;
  setInputRoomId: (id: string) => void;
  setInputRoomPassword: (pass: string) => void;
  setChatInput: (text: string) => void;
  createGameRoom: () => Promise<void>;
  joinGameRoom: () => Promise<void>;
  startGame: () => Promise<void>;
  leaveRoom: () => Promise<void>;
  closeGameOverOverlay: () => void;
  makeMove: (index: number) => Promise<void>;
  sendChatMessage: () => Promise<void>;

  // Морской бой
  toggleOrientation: () => void;
  setShipSize: (size: number) => void;
  autoPlaceLocal: () => void;
  clearPlacements: () => void;
  confirmReady: () => Promise<void>;

  // Инструменты рисования
  changeBrushColor: (color: string) => void;
  setDrawingMode: (mode: 'ink' | 'erase') => void;
  fillCanvas: () => void;
  clearCanvas: () => void;
  setDrawStrokes: (strokes: ICanvasStroke[]) => void;
  submitDrawing: () => Promise<void>;
  voteWord: (word: string) => Promise<void>;
  rateDrawing: (score: number) => Promise<void>;
}

let localPlacedShips: number[][] = [];
let selectedPieceIndex: number = -1;
let phaseTimerInterval: any = null;
let syncTimerInterval: any = null;
let targetUnixTime: number = 0;

export const useGamesStore = create<GamesState>((set, get) => ({
  availableGames: AVAILABLE_GAMES,
  selectedGame: null,
  currentRoom: null,
  isGameOverlayVisible: false,
  isJoinGameDialogOpen: false,
  inputRoomId: '',
  inputRoomPassword: '',
  isHost: false,
  canStartGame: false,
  isGameOver: false,
  isGameOverOverlayVisible: false,
  gameStatusText: 'Waiting for players...',
  isMyTurn: false,

  boardCells: [],
  boardDimension: 3,
  isBoardFlipped: false,
  myBattleshipCells: [],
  enemyBattleshipCells: [],

  isBattleship: false,
  isClassicGame: true,
  selectedShipSize: 4,
  isPlacementHorizontal: true,
  placementOrientationText: 'Horizontal',
  remainingShipsText: 'Need: 4-deck: 1 | 3-deck: 2 | 2-deck: 3 | 1-deck: 4',
  canClickReady: false,
  isMyReady: false,

  chatMessages: [],
  chatInput: '',

  isDrawAndRate: false,
  isDrawAndGuess: false,
  drawPhase: 0,
  proposedWords: [],
  selectedWord: '',
  guessWordText: '',
  phaseTimerText: '00:00',
  hasSubmittedDrawing: false,
  hasVotedCurrentRating: false,
  currentDrawingPlayerName: '',
  currentDrawingImage: null,
  drawResults: [],
  customBrushColor: '#000000',
  drawingMode: 'ink',
  drawCanvasBackground: '#FFFFFF',
  drawStrokes: [],

  selectGame: (game) => set({ selectedGame: game }),
  openJoinDialog: () => set({ isJoinGameDialogOpen: true, inputRoomId: '', inputRoomPassword: '' }),
  closeJoinDialog: () => set({ isJoinGameDialogOpen: false }),
  setInputRoomId: (id) => set({ inputRoomId: id }),
  setInputRoomPassword: (pass) => set({ inputRoomPassword: pass }),
  setChatInput: (text) => set({ chatInput: text }),
  closeGameOverOverlay: () => set({ isGameOverOverlayVisible: false }),

  // 1. Создание комнаты
  createGameRoom: async () => {
    const { selectedGame } = get();
    if (!selectedGame) return;

    try {
      const token = userSession.token;
      if (token && !gameSignalrService.isConnected) {
        await gameSignalrService.connectAsync(token);
      }

      set({ chatMessages: [], isHost: true });
      const room = await gameSignalrService.createRoomAsync(selectedGame.internalId, '');

      selectedPieceIndex = -1;
      localPlacedShips = [];

      set({
        currentRoom: room,
        isGameOverlayVisible: true,
        gameStatusText: 'Waiting for opponent...',
        isMyTurn: false,
      });

      updateCanStartGame(room, set, get);
      updateBoardUI(null, set, get);
    } catch (ex: any) {
      console.error('[GamesStore ERROR] Ошибка создания игровой комнаты:', ex);
      set({ gameStatusText: `Failed to create room: ${ex.message}` });
    }
  },

  // 2. Вход в комнату
  joinGameRoom: async () => {
    const { inputRoomId, inputRoomPassword } = get();
    if (!inputRoomId.trim()) return;

    try {
      const token = userSession.token;
      if (token && !gameSignalrService.isConnected) {
        await gameSignalrService.connectAsync(token);
      }

      set({ chatMessages: [], isHost: false });
      const room = await gameSignalrService.joinRoomAsync(inputRoomId.trim().toUpperCase(), inputRoomPassword || '');

      selectedPieceIndex = -1;
      localPlacedShips = [];

      set({
        currentRoom: room,
        isJoinGameDialogOpen: false,
        isGameOverlayVisible: true,
        gameStatusText: 'Waiting for host to start...',
        isMyTurn: false,
      });

      updateCanStartGame(room, set, get);
      updateBoardUI(null, set, get);
    } catch (ex: any) {
      console.error('[GamesStore ERROR] Ошибка входа в комнату:', ex);
      set({ gameStatusText: `Failed to join: ${ex.message}` });
    }
  },

  // 3. Старт игры
  startGame: async () => {
    const { currentRoom, isHost } = get();
    if (currentRoom && isHost) {
      set({ canStartGame: false, isGameOver: false });
      await gameSignalrService.startGameAsync(currentRoom.roomId);
    }
  },

  // 4. Выход из комнаты
  leaveRoom: async () => {
    const { currentRoom } = get();
    if (currentRoom) {
      await gameSignalrService.leaveRoomAsync(currentRoom.roomId);
    }

    stopTimers();
    selectedPieceIndex = -1;
    localPlacedShips = [];

    set({
      isGameOverlayVisible: false,
      currentRoom: null,
      isMyTurn: false,
      boardCells: [],
      myBattleshipCells: [],
      enemyBattleshipCells: [],
    });
    clearDrawAndRateState(set);
  },

  // 5. Выполнение хода
  makeMove: async (index: number) => {
    const { currentRoom, isBattleship, isMyReady, selectedShipSize, isPlacementHorizontal, isHost, boardCells } = get();
    if (!currentRoom || !currentRoom.isPlaying) return;

    const isBattleshipSetup = isBattleship && currentRoom.isSetupPhase;
    if (!isBattleshipSetup && currentRoom.currentTurnUserId !== userSession.userId) return;

    try {
      if (currentRoom.gameType === 'TicTacToe') {
        set({ isMyTurn: false });
        await gameSignalrService.makeMoveAsync(currentRoom.roomId, -1, index);
        return;
      }

      if (currentRoom.gameType === 'Checkers' || currentRoom.gameType === 'Chess') {
        const me = currentRoom.players?.find((p: GamePlayerDto) => p.userId === userSession.userId);
        if (!me) return;
        const cell = boardCells[index];
        const mySymbol = currentRoom.gameType === 'Chess' ? me.symbol.toLowerCase() : me.symbol;

        if (selectedPieceIndex === -1) {
          if (cell.content && cell.content.startsWith(mySymbol)) {
            selectedPieceIndex = index;
            highlightValidMoves(index, mySymbol, set, get);
          }
        } else {
          if (index === selectedPieceIndex) {
            selectedPieceIndex = -1;
            clearHighlights(set, get);
          } else if (cell.content && cell.content.startsWith(mySymbol)) {
            selectedPieceIndex = index;
            highlightValidMoves(index, mySymbol, set, get);
          } else {
            if (cell.isPossibleMove || cell.isPossibleCapture) {
              const fromIdx = selectedPieceIndex;
              selectedPieceIndex = -1;
              clearHighlights(set, get);

              set({ isMyTurn: false });
              await gameSignalrService.makeMoveAsync(currentRoom.roomId, fromIdx, index);
            } else {
              selectedPieceIndex = -1;
              clearHighlights(set, get);
            }
          }
        }
        return;
      }

      if (isBattleship) {
        if (currentRoom.isSetupPhase) {
          if (isMyReady) return;

          const myOffset = isHost ? 0 : 100;
          if (index < myOffset || index >= myOffset + 100) return;

          const localIdx = index % 100;
          const existingShip = localPlacedShips.find((s) => s.includes(localIdx));
          if (existingShip) {
            localPlacedShips = localPlacedShips.filter((s) => s !== existingShip);
            updateRemainingShips(set, get);
            return;
          }

          const size = selectedShipSize;
          const x = localIdx % 10;
          const y = Math.floor(localIdx / 10);
          const currentCount = localPlacedShips.filter((s) => s.length === size).length;
          const maxCount = size === 4 ? 1 : size === 3 ? 2 : size === 2 ? 3 : 4;
          if (currentCount >= maxCount) return;

          const tempBoard = get().myBattleshipCells.map((c) => c.content);
          if (BattleshipEngineService.canPlaceShipLocal(tempBoard, x, y, size, isPlacementHorizontal)) {
            const newShip: number[] = [];
            for (let i = 0; i < size; i++) {
              const cellIdx = isPlacementHorizontal ? y * 10 + x + i : (y + i) * 10 + x;
              newShip.push(cellIdx);
            }
            localPlacedShips.push(newShip);
            updateRemainingShips(set, get);
          }
        } else {
          set({ isMyTurn: false });
          await gameSignalrService.makeMoveAsync(currentRoom.roomId, -1, index);
        }
      }
    } catch (ex) {
      console.error(`[GamesStore ERROR] Ошибка совершения хода на ${index}:`, ex);
    }
  },

  // 6. Чат
  sendChatMessage: async () => {
    const { chatInput, currentRoom } = get();
    if (!chatInput.trim() || !currentRoom) return;
    const text = chatInput.trim();
    set({ chatInput: '' });

    try {
      await gameSignalrService.sendChatMessageAsync(currentRoom.roomId, text);
    } catch (ex) {
      console.error('[GamesStore ERROR] Ошибка отправки сообщения:', ex);
    }
  },

  // 7. Морской бой управление
  toggleOrientation: () => {
    const next = !get().isPlacementHorizontal;
    set({ isPlacementHorizontal: next, placementOrientationText: next ? 'Horizontal' : 'Vertical' });
  },

  setShipSize: (size: number) => set({ selectedShipSize: size }),

  clearPlacements: () => {
    if (!get().isBattleship || get().isMyReady) return;
    localPlacedShips = [];
    updateRemainingShips(set, get);
  },

  autoPlaceLocal: () => {
    if (!get().isBattleship || get().isMyReady) return;
    localPlacedShips = BattleshipEngineService.generateAutoPlacement();
    updateRemainingShips(set, get);
  },

  confirmReady: async () => {
    const { canClickReady, isMyReady, currentRoom, myBattleshipCells } = get();
    if (!canClickReady || isMyReady || !currentRoom) return;

    try {
      set({ isMyReady: true });
      const myBoard = myBattleshipCells.map((c) => c.content);
      await gameSignalrService.readyToPlayAsync(currentRoom.roomId, myBoard);
    } catch (ex: any) {
      set({ isMyReady: false, gameStatusText: `Error: ${ex.message}` });
    }
  },

  // 8. Рисование & Оценки
  changeBrushColor: (colorName: string) => set({ customBrushColor: colorName }),
  setDrawingMode: (mode: 'ink' | 'erase') => set({ drawingMode: mode }),
  fillCanvas: () => set((state) => ({ drawCanvasBackground: state.customBrushColor })),
  clearCanvas: () => set({ drawStrokes: [], drawCanvasBackground: '#FFFFFF' }),
  setDrawStrokes: (strokes) => set({ drawStrokes: strokes }),

  submitDrawing: async () => {
    const { currentRoom, drawPhase, hasSubmittedDrawing, drawStrokes, drawCanvasBackground } = get();
    if (!currentRoom || drawPhase !== 2 || hasSubmittedDrawing) return;

    const base64 = drawStrokes.length > 0
      ? InkCanvasService.renderStrokesToBase64(drawStrokes, drawCanvasBackground, 400, 400)
      : '';

    set({ hasSubmittedDrawing: true });
    await gameSignalrService.submitDrawingAsync(currentRoom.roomId, base64);
    set({ drawStrokes: [] });
  },

  voteWord: async (word: string) => {
    const { currentRoom, drawPhase } = get();
    if (!currentRoom || drawPhase !== 1) return;
    set({ proposedWords: [] });
    await gameSignalrService.voteWordAsync(currentRoom.roomId, word);
  },

  rateDrawing: async (score: number) => {
    const { currentRoom, drawPhase, hasVotedCurrentRating } = get();
    if (!currentRoom || drawPhase !== 3 || hasVotedCurrentRating) return;
    set({ hasVotedCurrentRating: true });
    await gameSignalrService.rateDrawingAsync(currentRoom.roomId, score);
  },
}));

// =========================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ВЫЧИСЛЕНИЯ ПРАВИЛ И ДОСОК
// =========================================================================

function stopTimers() {
  if (phaseTimerInterval) {
    clearInterval(phaseTimerInterval);
    phaseTimerInterval = null;
  }
  if (syncTimerInterval) {
    clearInterval(syncTimerInterval);
    syncTimerInterval = null;
  }
}

function clearHighlights(set: any, get: any) {
  const cells = get().boardCells.map((c: IBoardCell) => ({
    ...c,
    isSelected: c.index === selectedPieceIndex,
    isPossibleMove: false,
    isPossibleCapture: false,
  }));
  set({ boardCells: cells });
}

function highlightValidMoves(startIndex: number, mySymbol: string, set: any, get: any) {
  clearHighlights(set, get);
  const { currentRoom, boardCells } = get();
  if (!currentRoom) return;

  const cells = boardCells.map((c: IBoardCell) => ({
    ...c,
    isSelected: c.index === startIndex,
  }));

  if (currentRoom.gameType === 'Checkers') {
    let globalJumpAvailable = false;
    for (let i = 0; i < 64; i++) {
      if (cells[i].content && cells[i].content.startsWith(mySymbol)) {
        if (CheckersEngineService.getLocalValidJumps(cells, i, mySymbol).length > 0) {
          globalJumpAvailable = true;
          break;
        }
      }
    }
    const jumps = CheckersEngineService.getLocalValidJumps(cells, startIndex, mySymbol);
    if (jumps.length > 0) {
      jumps.forEach((j) => {
        cells[j.to].isPossibleCapture = true;
      });
    } else if (!globalJumpAvailable) {
      const simpleMoves = CheckersEngineService.getLocalValidSimpleMoves(cells, startIndex, mySymbol);
      simpleMoves.forEach((m) => {
        cells[m].isPossibleMove = true;
      });
    }
  } else if (currentRoom.gameType === 'Chess') {
    const currentBoard = cells.map((c: IBoardCell) => c.content);
    const validMoves = ChessEngineService.getLocalValidChessMoves(currentRoom, currentBoard, startIndex, mySymbol, true);

    validMoves.forEach((move) => {
      if (cells[move].content || (currentRoom.enPassantTarget === move && cells[startIndex].content.endsWith('P'))) {
        cells[move].isPossibleCapture = true;
      } else {
        cells[move].isPossibleMove = true;
      }
    });
  }

  set({ boardCells: cells });
}

function updateRemainingShips(set: any, get: any) {
  const size4 = 1 - localPlacedShips.filter((s) => s.length === 4).length;
  const size3 = 2 - localPlacedShips.filter((s) => s.length === 3).length;
  const size2 = 3 - localPlacedShips.filter((s) => s.length === 2).length;
  const size1 = 4 - localPlacedShips.filter((s) => s.length === 1).length;

  const myOffset = get().isHost ? 0 : 100;
  const cells: IBoardCell[] = Array.from({ length: 100 }, (_, i) => ({
    index: myOffset + i,
    content: localPlacedShips.some((ship) => ship.includes(i)) ? 'S' : '',
    cellType: 'BattleshipMy',
    isSelected: false,
    isPossibleMove: false,
    isPossibleCapture: false,
  }));

  set({
    myBattleshipCells: cells,
    remainingShipsText: `Need: 4-deck: ${size4} | 3-deck: ${size3} | 2-deck: ${size2} | 1-deck: ${size1}`,
    canClickReady: size4 === 0 && size3 === 0 && size2 === 0 && size1 === 0,
  });
}

function updateCanStartGame(room: GameRoomDto | null, set: any, get: any) {
  if (!room || !get().isHost) {
    set({ canStartGame: false });
    return;
  }

  if (room.gameType === 'DrawAndRate' || room.gameType === 'DrawAndGuess') {
    set({ canStartGame: room.drawPhase === 0 && room.players.length >= 2 });
  } else {
    set({ canStartGame: !room.isPlaying && room.players.length === 2 });
  }
}

function clearDrawAndRateState(set: any) {
  set({
    drawPhase: 0,
    phaseTimerText: '',
    selectedWord: '',
    hasSubmittedDrawing: false,
    currentDrawingPlayerName: '',
    hasVotedCurrentRating: false,
    currentDrawingImage: null,
    proposedWords: [],
    drawResults: [],
  });
  stopTimers();
}

function updateTurnStatus(currentTurnUserId: number, set: any, get: any) {
  const { currentRoom } = get();
  if (currentRoom && (currentRoom.gameType === 'DrawAndRate' || currentRoom.gameType === 'DrawAndGuess')) return;

  const isMyTurn = currentTurnUserId === userSession.userId;
  set({
    isMyTurn,
    gameStatusText: isMyTurn ? 'Your Turn!' : "Opponent's turn...",
  });
}

function updateBoardUI(serverBoard: string[] | null | undefined, set: any, get: any) {
  const { currentRoom, isHost } = get();
  if (!currentRoom) return;

  const isBattleship = currentRoom.gameType === 'Battleship';
  const isDrawAndRate = currentRoom.gameType === 'DrawAndRate';
  const isDrawAndGuess = currentRoom.gameType === 'DrawAndGuess';
  const isClassicGame = !isBattleship && !isDrawAndRate && !isDrawAndGuess;
  const isBoardFlipped = !isHost && (currentRoom.gameType === 'Chess' || currentRoom.gameType === 'Checkers');

  set({
    isBattleship,
    isDrawAndRate,
    isDrawAndGuess,
    isClassicGame,
    isBoardFlipped,
  });

  if (isDrawAndRate) {
    const drawPhase = currentRoom.drawPhase;
    set({ drawPhase });

    if (currentRoom.phaseEndTimeUnix !== targetUnixTime) {
      targetUnixTime = currentRoom.phaseEndTimeUnix;
      startPhaseTimer(set, get);
    }

    if (drawPhase === 1) {
      set({ proposedWords: currentRoom.proposedWords ? [...currentRoom.proposedWords] : [] });
    } else if (drawPhase === 2) {
      set({ selectedWord: currentRoom.selectedWord || '' });
    } else if (drawPhase === 3) {
      const drawer = currentRoom.players?.find((p: GamePlayerDto) => p.userId === currentRoom.currentDrawingUserId);
      set({
        hasVotedCurrentRating: currentRoom.currentDrawingUserId === userSession.userId,
        currentDrawingPlayerName: drawer ? drawer.nickName : 'Unknown',
        currentDrawingImage: currentRoom.currentDrawingBase64 || null,
      });
    } else if (drawPhase === 4) {
      const sorted = [...(currentRoom.players || [])].sort((a: GamePlayerDto, b: GamePlayerDto) => b.score - a.score);
set({ drawResults: sorted.map((p: GamePlayerDto) => ({ key: p.nickName, value: p.score })) });
    }
  } else if (isBattleship) {
    const myOffset = isHost ? 0 : 100;
    const enemyOffset = isHost ? 100 : 0;

    if (get().myBattleshipCells.length !== 100) {
      const my: IBoardCell[] = Array.from({ length: 100 }, (_, i) => ({
        index: myOffset + i,
        content: '',
        cellType: 'BattleshipMy',
        isSelected: false,
        isPossibleMove: false,
        isPossibleCapture: false,
      }));
      const enemy: IBoardCell[] = Array.from({ length: 100 }, (_, i) => ({
        index: enemyOffset + i,
        content: '',
        cellType: 'BattleshipEnemy',
        isSelected: false,
        isPossibleMove: false,
        isPossibleCapture: false,
      }));
      set({ myBattleshipCells: my, enemyBattleshipCells: enemy });
    }

    if (currentRoom.isSetupPhase && !get().isMyReady) return;

    if (serverBoard && serverBoard.length === 200) {
      set((state: GamesState) => ({
        myBattleshipCells: state.myBattleshipCells.map((c, i) => ({ ...c, content: serverBoard[myOffset + i] || '' })),
        enemyBattleshipCells: state.enemyBattleshipCells.map((c, i) => ({ ...c, content: serverBoard[enemyOffset + i] || '' })),
      }));
    }
  } else if (isDrawAndGuess) {
    const drawPhase = currentRoom.drawPhase;
    const isMyTurn = currentRoom.currentDrawingUserId === userSession.userId;
    set({ drawPhase, isMyTurn });

    if (currentRoom.phaseEndTimeUnix !== targetUnixTime) {
      // 🟢 Очищаем холст, заливку и старый рисунок от предыдущего раунда
      set({ 
        drawStrokes: [], 
        drawCanvasBackground: '#FFFFFF',
        currentDrawingImage: null 
      });
      targetUnixTime = currentRoom.phaseEndTimeUnix;
      startPhaseTimer(set, get);
    }

    const drawer = currentRoom.players?.find((p: GamePlayerDto) => p.userId === currentRoom.currentDrawingUserId);
    set({ currentDrawingPlayerName: drawer ? drawer.nickName : 'Unknown' });

    if (drawPhase === 1) {
      // 🟢 Если сервер прислал пустой рисунок нового раунда — обнуляем изображение у отгадчика
      if (!currentRoom.currentDrawingBase64) {
        set({ currentDrawingImage: null });
      }

      if (isMyTurn) {
        set({ 
          selectedWord: currentRoom.selectedWord || '', 
          drawStrokes: [], 
          drawCanvasBackground: '#FFFFFF',
          currentDrawingImage: null 
        });
        startSyncTimer(get);
      } else {
        stopSyncTimer();
        set({
          guessWordText: currentRoom.selectedWord
            ? '*'.repeat(currentRoom.selectedWord.length)
            : '',
        });
      }
    } else if (drawPhase === 2) {
      stopSyncTimer();
      set({ selectedWord: currentRoom.selectedWord || '' });
      const sorted = [...(currentRoom.players || [])].sort((a, b) => b.score - a.score);
      set({ drawResults: sorted.map((p) => ({ key: p.nickName, value: p.score })) });
    }
  } else {
    const targetLength = currentRoom.gameType === 'TicTacToe' ? 9 : 64;
    const boardDimension = currentRoom.gameType === 'TicTacToe' ? 3 : 8;

    if (get().boardCells.length !== targetLength) {
      const cells: IBoardCell[] = Array.from({ length: targetLength }, (_, i) => {
        const r = Math.floor(i / boardDimension);
        const c = i % boardDimension;
        let cellType = 'TicTacToe';
        if (boardDimension === 8) {
          cellType = currentRoom.gameType === 'Chess'
            ? (r + c) % 2 === 1 ? 'ChessDark' : 'ChessLight'
            : (r + c) % 2 === 1 ? 'CheckersDark' : 'CheckersLight';
        }
        return {
          index: i,
          content: '',
          cellType,
          isSelected: false,
          isPossibleMove: false,
          isPossibleCapture: false,
        };
      });
      set({ boardDimension, boardCells: cells });
    }

    if (serverBoard && serverBoard.length === targetLength) {
      set((state: GamesState) => ({
        boardCells: state.boardCells.map((c, i) => ({
          ...c,
          content: serverBoard[i] || '',
          isSelected: c.index === selectedPieceIndex,
        })),
      }));
    }
  }

  clearHighlights(set, get);
}

function startPhaseTimer(set: any, get: any) {
  if (phaseTimerInterval) clearInterval(phaseTimerInterval);

  const tick = () => {
    let remain = targetUnixTime - Math.floor(Date.now() / 1000);
    if (remain < 0) remain = 0;

    const m = Math.floor(remain / 60).toString().padStart(2, '0');
    const s = (remain % 60).toString().padStart(2, '0');
    set({ phaseTimerText: `${m}:${s}` });

    const { isDrawAndRate, drawPhase, hasSubmittedDrawing } = get();
    if (isDrawAndRate && drawPhase === 2 && remain === 0 && !hasSubmittedDrawing) {
      get().submitDrawing();
    }

    if (remain === 0 && phaseTimerInterval) {
      clearInterval(phaseTimerInterval);
      phaseTimerInterval = null;
    }
  };

  tick();
  phaseTimerInterval = setInterval(tick, 1000);
}

function startSyncTimer(get: any) {
  if (syncTimerInterval) return;
  syncTimerInterval = setInterval(async () => {
    const { currentRoom, isDrawAndGuess, drawPhase, drawStrokes, drawCanvasBackground } = get();
    if (!currentRoom || !isDrawAndGuess || drawPhase !== 1 || currentRoom.currentDrawingUserId !== userSession.userId) {
      return;
    }
    if (drawStrokes.length > 0) {
      const base64 = InkCanvasService.renderStrokesToBase64(drawStrokes, drawCanvasBackground, 400, 400);
      await gameSignalrService.syncDrawingAsync(currentRoom.roomId, base64);
    }
  }, 500);
}

function stopSyncTimer() {
  if (syncTimerInterval) {
    clearInterval(syncTimerInterval);
    syncTimerInterval = null;
  }
}

// =========================================================================
// ОБРАБОТЧИКИ СООБЩЕНИЙ EVENTBUS (SignalR -> ViewModel)
// =========================================================================

eventBus.on('GameRoomUpdatedMessage' as any, ({ room }: { room: GameRoomDto }) => {
  useGamesStore.setState({ currentRoom: room, gameStatusText: 'Waiting for players...' });
  updateCanStartGame(room, useGamesStore.setState, useGamesStore.getState);
  updateBoardUI(room.board, useGamesStore.setState, useGamesStore.getState);
});

eventBus.on('GameStartedMessage' as any, ({ room }: { room: GameRoomDto }) => {
  selectedPieceIndex = -1;
  localPlacedShips = [];

  useGamesStore.setState({
    currentRoom: room,
    isMyReady: false,
    isGameOver: false,
    isGameOverOverlayVisible: false,
    canStartGame: false,
  });

  clearDrawAndRateState(useGamesStore.setState);
  updateRemainingShips(useGamesStore.setState, useGamesStore.getState);
  updateCanStartGame(room, useGamesStore.setState, useGamesStore.getState);
  updateBoardUI(room.board, useGamesStore.setState, useGamesStore.getState);
  updateTurnStatus(room.currentTurnUserId, useGamesStore.setState, useGamesStore.getState);
});

eventBus.on('GameDrawingSyncedMessage' as any, ({ base64Image }: { base64Image: string }) => {
  const { isMyTurn, isDrawAndGuess } = useGamesStore.getState();
  if (!isMyTurn && isDrawAndGuess) {
    useGamesStore.setState({ currentDrawingImage: base64Image });
  }
});

eventBus.on('GameBoardUpdatedMessage' as any, ({ room }: { room: GameRoomDto }) => {
  useGamesStore.setState({ currentRoom: room });
  updateCanStartGame(room, useGamesStore.setState, useGamesStore.getState); // 🟢 Скрывает START MATCH во время матча
  updateBoardUI(room.board, useGamesStore.setState, useGamesStore.getState);
  updateTurnStatus(room.currentTurnUserId, useGamesStore.setState, useGamesStore.getState);
});

eventBus.on('GameOverMessage' as any, ({ winnerId }: { winnerId: number | null }) => {
  const { currentRoom } = useGamesStore.getState();
  let status = 'Draw! 🤝';
  if (winnerId !== null) {
    status = winnerId === userSession.userId ? 'You Won! 🎉🏆' : 'You Lost! 💀';
  }

  const showOverlay = currentRoom !== null && currentRoom.gameType !== 'DrawAndRate' && currentRoom.gameType !== 'DrawAndGuess';

  useGamesStore.setState({
    isMyTurn: false,
    gameStatusText: status,
    isGameOver: true,
    isGameOverOverlayVisible: showOverlay,
    canStartGame: false,
  });

  clearHighlights(useGamesStore.setState, useGamesStore.getState);
});

eventBus.on('GameChatMessageReceivedMessage' as any, ({ message }: { message: GameChatMessageDto }) => {
  const isMine = message.senderId === userSession.userId;
  const current = useGamesStore.getState().chatMessages;
  useGamesStore.setState({ chatMessages: [...current, { ...message, isMine }] });
});

eventBus.on('GamePlayerLeftMessage' as any, () => {
  useGamesStore.setState({
    isMyTurn: false,
    gameStatusText: 'Opponent left.',
  });
});