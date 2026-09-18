import { create } from 'zustand';
import { GameRoomDto, GameChatMessageDto } from '../types/dtos';
import { IBoardCell, IGameItem } from '../types/models';
import { gameSignalrService } from '../services/gameSignalr.service';
import { BattleshipEngineService } from '../services/gameEngines/battleshipEngine.service';
import { CheckersEngineService } from '../services/gameEngines/checkersEngine.service';
import { ChessEngineService } from '../services/gameEngines/chessEngine.service';
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

interface GamesState {
  availableGames: IGameItem[];
  selectedGame: IGameItem | null;
  currentRoom: GameRoomDto | null;
  isGameOverlayVisible: boolean;
  isJoinGameDialogOpen: boolean;
  inputRoomId: string;
  isHost: boolean;
  canStartGame: boolean;
  isGameOver: boolean;
  isGameOverOverlayVisible: boolean;
  gameStatusText: string;
  isMyTurn: boolean;

  // Доски
  boardCells: IBoardCell[];
  boardDimension: number;
  isBoardFlipped: boolean;
  myBattleshipCells: IBoardCell[];
  enemyBattleshipCells: IBoardCell[];

  // Морской бой расстановка
  isBattleship: boolean;
  selectedShipSize: number;
  isPlacementHorizontal: boolean;
  remainingShipsText: string;
  canClickReady: boolean;
  isMyReady: boolean;

  // Чат комнаты
  chatMessages: GameChatMessageDto[];
  chatInput: string;

  // Draw & Rate / Guess
  isDrawAndRate: boolean;
  isDrawAndGuess: boolean;
  drawPhase: number;
  proposedWords: string[];
  selectedWord: string;
  guessWordText: string;
  currentDrawingPlayerName: string;
  currentDrawingImage: string | null;
  drawResults: { key: string; value: number }[];
  phaseTimerText: string;

  // Действия
  selectGame: (game: IGameItem) => void;
  openJoinDialog: () => void;
  closeJoinDialog: () => void;
  setInputRoomId: (id: string) => void;
  setChatInput: (text: string) => void;
  createRoom: () => Promise<void>;
  joinRoom: () => Promise<void>;
  startGame: () => Promise<void>;
  leaveRoom: () => Promise<void>;
  closeGameOverOverlay: () => void;
  makeMove: (index: number) => Promise<void>;
  sendChatMessage: () => Promise<void>;

  // Морской бой
  toggleOrientation: () => void;
  setShipSize: (size: number) => void;
  autoPlaceShips: () => void;
  clearPlacements: () => void;
  confirmReady: () => Promise<void>;

  // Рисование
  voteWord: (word: string) => Promise<void>;
  rateDrawing: (score: number) => Promise<void>;
  submitDrawing: (base64: string) => Promise<void>;
}

let localPlacedShips: number[][] = [];
let selectedPieceIndex = -1;

export const useGamesStore = create<GamesState>((set, get) => ({
  availableGames: AVAILABLE_GAMES,
  selectedGame: null,
  currentRoom: null,
  isGameOverlayVisible: false,
  isJoinGameDialogOpen: false,
  inputRoomId: '',
  isHost: false,
  canStartGame: false,
  isGameOver: false,
  isGameOverOverlayVisible: false,
  gameStatusText: 'Waiting for opponent...',
  isMyTurn: false,

  boardCells: [],
  boardDimension: 3,
  isBoardFlipped: false,
  myBattleshipCells: [],
  enemyBattleshipCells: [],

  isBattleship: false,
  selectedShipSize: 4,
  isPlacementHorizontal: true,
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
  currentDrawingPlayerName: '',
  currentDrawingImage: null,
  drawResults: [],
  phaseTimerText: '00:00',

  selectGame: (game) => set({ selectedGame: game }),
  openJoinDialog: () => set({ isJoinGameDialogOpen: true, inputRoomId: '' }),
  closeJoinDialog: () => set({ isJoinGameDialogOpen: false }),
  setInputRoomId: (id) => set({ inputRoomId: id }),
  setChatInput: (text) => set({ chatInput: text }),
  closeGameOverOverlay: () => set({ isGameOverOverlayVisible: false }),

  createRoom: async () => {
    const { selectedGame } = get();
    if (!selectedGame) return;

    try {
      const token = userSession.token;
      if (token && !gameSignalrService.isConnected) {
        await gameSignalrService.connectAsync(token);
      }

      const room = await gameSignalrService.createRoomAsync(selectedGame.internalId);
      localPlacedShips = [];
      selectedPieceIndex = -1;

      set({
        currentRoom: room,
        isHost: true,
        isGameOverlayVisible: true,
        chatMessages: [],
        canStartGame: false,
        gameStatusText: 'Waiting for opponent...',
      });

      updateBoardUI(room, set);
    } catch (e) {
      console.error('[GamesStore] Ошибка создания комнаты:', e);
    }
  },

  joinRoom: async () => {
    const { inputRoomId } = get();
    if (!inputRoomId.trim()) return;

    try {
      const token = userSession.token;
      if (token && !gameSignalrService.isConnected) {
        await gameSignalrService.connectAsync(token);
      }

      const room = await gameSignalrService.joinRoomAsync(inputRoomId.trim().toUpperCase());
      localPlacedShips = [];
      selectedPieceIndex = -1;

      set({
        currentRoom: room,
        isHost: false,
        isGameOverlayVisible: true,
        isJoinGameDialogOpen: false,
        chatMessages: [],
        canStartGame: false,
        gameStatusText: 'Waiting for host to start...',
      });

      updateBoardUI(room, set);
    } catch (e) {
      console.error('[GamesStore] Ошибка входа в комнату:', e);
    }
  },

  startGame: async () => {
    const { currentRoom } = get();
    if (currentRoom) {
      await gameSignalrService.startGameAsync(currentRoom.roomId);
    }
  },

  leaveRoom: async () => {
    const { currentRoom } = get();
    if (currentRoom) {
      await gameSignalrService.leaveRoomAsync(currentRoom.roomId);
    }
    localPlacedShips = [];
    selectedPieceIndex = -1;
    set({
      isGameOverlayVisible: false,
      currentRoom: null,
      isMyTurn: false,
      isGameOver: false,
    });
  },

  makeMove: async (index) => {
    const { currentRoom, isBattleship, isMyReady, selectedShipSize, isPlacementHorizontal, isHost, boardCells } = get();
    if (!currentRoom || !currentRoom.isPlaying) return;

    const isBattleshipSetup = isBattleship && currentRoom.isSetupPhase;
    if (!isBattleshipSetup && currentRoom.currentTurnUserId !== userSession.userId) return;

    // --- КРЕСТИКИ-НОЛИКИ ---
    if (currentRoom.gameType === 'TicTacToe') {
      set({ isMyTurn: false });
      await gameSignalrService.makeMoveAsync(currentRoom.roomId, -1, index);
      return;
    }

    // --- ШАХМАТЫ И ШАШКИ ---
    if (currentRoom.gameType === 'Checkers' || currentRoom.gameType === 'Chess') {
      const me = currentRoom.players.find((p) => p.userId === userSession.userId);
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
        } else if (cell.isPossibleMove || cell.isPossibleCapture) {
          const from = selectedPieceIndex;
          selectedPieceIndex = -1;
          clearHighlights(set, get);
          set({ isMyTurn: false });
          await gameSignalrService.makeMoveAsync(currentRoom.roomId, from, index);
        } else {
          selectedPieceIndex = -1;
          clearHighlights(set, get);
        }
      }
      return;
    }

    // --- МОРСКОЙ БОЙ ---
    if (isBattleship) {
      if (currentRoom.isSetupPhase) {
        if (isMyReady) return;
        const myOffset = isHost ? 0 : 100;
        if (index < myOffset || index >= myOffset + 100) return;
        const localIdx = index % 100;

        const existing = localPlacedShips.find((s) => s.includes(localIdx));
        if (existing) {
          localPlacedShips = localPlacedShips.filter((s) => s !== existing);
          updateBattleshipPlacementBoard(set, get);
          return;
        }

        const x = localIdx % 10;
        const y = Math.floor(localIdx / 10);
        const tempBoard = get().myBattleshipCells.map((c) => c.content);

        if (BattleshipEngineService.canPlaceShipLocal(tempBoard, x, y, selectedShipSize, isPlacementHorizontal)) {
          const newShip: number[] = [];
          for (let i = 0; i < selectedShipSize; i++) {
            const cIdx = isPlacementHorizontal ? y * 10 + x + i : (y + i) * 10 + x;
            newShip.push(cIdx);
          }
          localPlacedShips.push(newShip);
          updateBattleshipPlacementBoard(set, get);
        }
      } else {
        set({ isMyTurn: false });
        await gameSignalrService.makeMoveAsync(currentRoom.roomId, -1, index);
      }
    }
  },

  sendChatMessage: async () => {
    const { chatInput, currentRoom } = get();
    if (!chatInput.trim() || !currentRoom) return;
    set({ chatInput: '' });
    await gameSignalrService.sendChatMessageAsync(currentRoom.roomId, chatInput.trim());
  },

  toggleOrientation: () => set((s) => ({ isPlacementHorizontal: !s.isPlacementHorizontal })),
  setShipSize: (size) => set({ selectedShipSize: size }),
  clearPlacements: () => {
    localPlacedShips = [];
    updateBattleshipPlacementBoard(set, get);
  },
  autoPlaceShips: () => {
    localPlacedShips = BattleshipEngineService.generateAutoPlacement();
    updateBattleshipPlacementBoard(set, get);
  },

  confirmReady: async () => {
    const { currentRoom, canClickReady, isMyReady, myBattleshipCells } = get();
    if (!canClickReady || isMyReady || !currentRoom) return;

    set({ isMyReady: true });
    const board = myBattleshipCells.map((c) => c.content);
    await gameSignalrService.readyToPlayAsync(currentRoom.roomId, board);
  },

  voteWord: async (word) => {
    const { currentRoom } = get();
    if (currentRoom) {
      set({ proposedWords: [] });
      await gameSignalrService.voteWordAsync(currentRoom.roomId, word);
    }
  },

  rateDrawing: async (score) => {
    const { currentRoom } = get();
    if (currentRoom) {
      await gameSignalrService.rateDrawingAsync(currentRoom.roomId, score);
    }
  },

  submitDrawing: async (base64) => {
    const { currentRoom } = get();
    if (currentRoom) {
      await gameSignalrService.submitDrawingAsync(currentRoom.roomId, base64);
    }
  },
}));

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
  const { currentRoom, boardCells } = get();
  if (!currentRoom) return;

  const cells = boardCells.map((c: IBoardCell) => ({
    ...c,
    isSelected: c.index === startIndex,
    isPossibleMove: false,
    isPossibleCapture: false,
  }));

  if (currentRoom.gameType === 'Checkers') {
    const jumps = CheckersEngineService.getLocalValidJumps(cells, startIndex, mySymbol);
    if (jumps.length > 0) {
      jumps.forEach((j) => {
        cells[j.to].isPossibleCapture = true;
      });
    } else {
      const moves = CheckersEngineService.getLocalValidSimpleMoves(cells, startIndex, mySymbol);
      moves.forEach((m) => {
        cells[m].isPossibleMove = true;
      });
    }
  } else if (currentRoom.gameType === 'Chess') {
    const board = cells.map((c: IBoardCell) => c.content);
    const validMoves = ChessEngineService.getLocalValidChessMoves(currentRoom, board, startIndex, mySymbol, true);

    validMoves.forEach((m) => {
      if (cells[m].content) cells[m].isPossibleCapture = true;
      else cells[m].isPossibleMove = true;
    });
  }

  set({ boardCells: cells });
}

function updateBattleshipPlacementBoard(set: any, get: any) {
  const size4 = 1 - localPlacedShips.filter((s) => s.length === 4).length;
  const size3 = 2 - localPlacedShips.filter((s) => s.length === 3).length;
  const size2 = 3 - localPlacedShips.filter((s) => s.length === 2).length;
  const size1 = 4 - localPlacedShips.filter((s) => s.length === 1).length;

  const myCells: IBoardCell[] = Array.from({ length: 100 }, (_, i) => ({
    index: i,
    content: localPlacedShips.some((s) => s.includes(i)) ? 'S' : '',
    cellType: 'BattleshipMy',
    isSelected: false,
    isPossibleMove: false,
    isPossibleCapture: false,
  }));

  const canClick = size4 === 0 && size3 === 0 && size2 === 0 && size1 === 0;

  set({
    myBattleshipCells: myCells,
    remainingShipsText: `Need: 4-deck: ${size4} | 3-deck: ${size3} | 2-deck: ${size2} | 1-deck: ${size1}`,
    canClickReady: canClick,
  });
}

function updateBoardUI(room: GameRoomDto, set: any) {
  const isBattleship = room.gameType === 'Battleship';
  const isDrawAndRate = room.gameType === 'DrawAndRate';
  const isDrawAndGuess = room.gameType === 'DrawAndGuess';
  const isHost = room.hostUserId === userSession.userId;
  const isFlipped = !isHost && (room.gameType === 'Chess' || room.gameType === 'Checkers');

  if (isBattleship) {
    const myOffset = isHost ? 0 : 100;
    const enemyOffset = isHost ? 100 : 0;

    const my = Array.from({ length: 100 }, (_, i) => ({
      index: myOffset + i,
      content: room.board?.[myOffset + i] || '',
      cellType: 'BattleshipMy',
      isSelected: false,
      isPossibleMove: false,
      isPossibleCapture: false,
    }));

    const enemy = Array.from({ length: 100 }, (_, i) => ({
      index: enemyOffset + i,
      content: room.board?.[enemyOffset + i] || '',
      cellType: 'BattleshipEnemy',
      isSelected: false,
      isPossibleMove: false,
      isPossibleCapture: false,
    }));

    set({
      isBattleship: true,
      myBattleshipCells: my,
      enemyBattleshipCells: enemy,
    });
  } else if (!isDrawAndRate && !isDrawAndGuess) {
    const dim = room.gameType === 'TicTacToe' ? 3 : 8;
    const count = dim * dim;

    const cells: IBoardCell[] = Array.from({ length: count }, (_, i) => {
      const r = Math.floor(i / dim);
      const c = i % dim;
      let cellType = 'TicTacToe';
      if (dim === 8) {
        cellType = room.gameType === 'Chess'
          ? (r + c) % 2 === 1 ? 'ChessDark' : 'ChessLight'
          : (r + c) % 2 === 1 ? 'CheckersDark' : 'CheckersLight';
      }
      return {
        index: i,
        content: room.board?.[i] || '',
        cellType,
        isSelected: false,
        isPossibleMove: false,
        isPossibleCapture: false,
      };
    });

    set({
      boardDimension: dim,
      boardCells: cells,
      isBoardFlipped: isFlipped,
      isBattleship: false,
      isDrawAndRate: false,
      isDrawAndGuess: false,
    });
  } else {
    set({
      isBattleship: false,
      isDrawAndRate,
      isDrawAndGuess,
      drawPhase: room.drawPhase,
      proposedWords: room.proposedWords || [],
      selectedWord: room.selectedWord || '',
      currentDrawingImage: room.currentDrawingBase64 || null,
    });
  }

  const isMyTurn = room.currentTurnUserId === userSession.userId;
  const canStart = isHost && !room.isPlaying && room.players.length >= 2;

  set({
    isMyTurn,
    canStartGame: canStart,
    gameStatusText: isMyTurn ? 'Your Turn!' : "Opponent's turn...",
  });
}

// Связка EventBus сообщений хаба SignalR
eventBus.on('GameRoomUpdatedMessage' as any, ({ room }: any) => {
  useGamesStore.setState({ currentRoom: room });
  updateBoardUI(room, useGamesStore.setState);
});

eventBus.on('GameStartedMessage' as any, ({ room }: any) => {
  useGamesStore.setState({ currentRoom: room, isGameOver: false, isGameOverOverlayVisible: false });
  updateBoardUI(room, useGamesStore.setState);
});

eventBus.on('GameBoardUpdatedMessage' as any, ({ room }: any) => {
  useGamesStore.setState({ currentRoom: room });
  updateBoardUI(room, useGamesStore.setState);
});

eventBus.on('GameOverMessage' as any, ({ winnerId }: any) => {
  const isMe = winnerId === userSession.userId;
  useGamesStore.setState({
    isMyTurn: false,
    isGameOver: true,
    isGameOverOverlayVisible: true,
    gameStatusText: winnerId === null ? 'Draw! 🤝' : isMe ? 'You Won! 🎉🏆' : 'You Lost! 💀',
  });
});

eventBus.on('GameChatMessageReceivedMessage' as any, ({ message }: any) => {
  const msgs = useGamesStore.getState().chatMessages;
  useGamesStore.setState({
    chatMessages: [...msgs, { ...message, isMine: message.senderId === userSession.userId }],
  });
});