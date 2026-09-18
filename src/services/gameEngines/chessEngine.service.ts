import { GameRoomDto } from '../../types/dtos';

export class ChessEngineService {
  private static isOnBoard(r: number, c: number): boolean {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  public static getLocalValidChessMoves(
    room: GameRoomDto | null,
    board: string[],
    startIndex: number,
    myColor: string,
    validateCheck: boolean
  ): number[] {
    const moves: number[] = [];
    const piece = board[startIndex];
    if (!piece || !piece.startsWith(myColor)) return moves;

    const type = piece[1];
    const r = Math.floor(startIndex / 8);
    const c = startIndex % 8;
    const oppColor = myColor === 'w' ? 'b' : 'w';

    if (type === 'P') {
      const dir = myColor === 'w' ? -1 : 1;
      const startRow = myColor === 'w' ? 6 : 1;

      // Ход на 1 клетку вперед
      if (this.isOnBoard(r + dir, c) && !board[(r + dir) * 8 + c]) {
        moves.push((r + dir) * 8 + c);
        // Первый ход пешки на 2 клетки
        if (r === startRow && !board[(r + 2 * dir) * 8 + c]) {
          moves.push((r + 2 * dir) * 8 + c);
        }
      }

      // Взятия по диагонали
      if (this.isOnBoard(r + dir, c - 1) && board[(r + dir) * 8 + (c - 1)]?.startsWith(oppColor)) {
        moves.push((r + dir) * 8 + (c - 1));
      }
      if (this.isOnBoard(r + dir, c + 1) && board[(r + dir) * 8 + c + 1]?.startsWith(oppColor)) {
        moves.push((r + dir) * 8 + c + 1);
      }

      // Взятие на проходе (En Passant)
      if (room && typeof room.enPassantTarget === 'number') {
        const ep = room.enPassantTarget;
        if (myColor === 'w' && r === 3 && (ep === startIndex - 9 || ep === startIndex - 7)) moves.push(ep);
        if (myColor === 'b' && r === 4 && (ep === startIndex + 7 || ep === startIndex + 9)) moves.push(ep);
      }
    } else if (type === 'N') {
      // Конь
      const dr = [-2, -2, -1, -1, 1, 1, 2, 2];
      const dc = [-1, 1, -2, 2, -2, 2, -1, 1];
      for (let i = 0; i < 8; i++) {
        const nr = r + dr[i];
        const nc = c + dc[i];
        if (this.isOnBoard(nr, nc)) {
          const target = board[nr * 8 + nc];
          if (!target || target.startsWith(oppColor)) {
            moves.push(nr * 8 + nc);
          }
        }
      }
    } else if (type === 'K') {
      // Король
      const dr = [-1, -1, -1, 0, 0, 1, 1, 1];
      const dc = [-1, 0, 1, -1, 1, -1, 0, 1];
      for (let i = 0; i < 8; i++) {
        const nr = r + dr[i];
        const nc = c + dc[i];
        if (this.isOnBoard(nr, nc)) {
          const target = board[nr * 8 + nc];
          if (!target || target.startsWith(oppColor)) {
            moves.push(nr * 8 + nc);
          }
        }
      }

      // Рокировка
      if (validateCheck && room) {
        const kingMoved = myColor === 'w' ? room.whiteKingMoved : room.blackKingMoved;
        if (!kingMoved && !this.isKingInCheck(board, myColor)) {
          const hRookMoved = myColor === 'w' ? room.whiteRookH1Moved : room.blackRookH8Moved;
          if (!hRookMoved && !board[startIndex + 1] && !board[startIndex + 2]) {
            if (!this.isSquareUnderAttack(board, startIndex + 1, oppColor) && !this.isSquareUnderAttack(board, startIndex + 2, oppColor)) {
              moves.push(startIndex + 2);
            }
          }

          const aRookMoved = myColor === 'w' ? room.whiteRookA1Moved : room.blackRookA8Moved;
          if (!aRookMoved && !board[startIndex - 1] && !board[startIndex - 2] && !board[startIndex - 3]) {
            if (!this.isSquareUnderAttack(board, startIndex - 1, oppColor) && !this.isSquareUnderAttack(board, startIndex - 2, oppColor)) {
              moves.push(startIndex - 2);
            }
          }
        }
      }
    } else {
      // Ладья (R), Слон (B), Ферзь (Q)
      const dirs: [number, number][] =
        type === 'R'
          ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
          : type === 'B'
          ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
          : [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];

      for (const [dr, dc] of dirs) {
        let nr = r + dr;
        let nc = c + dc;
        while (this.isOnBoard(nr, nc)) {
          const target = board[nr * 8 + nc];
          if (!target) {
            moves.push(nr * 8 + nc);
          } else {
            if (target.startsWith(oppColor)) moves.push(nr * 8 + nc);
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
    }

    // Проверка легальности хода (не подставляет ли короля под шах)
    if (validateCheck) {
      const legalMoves: number[] = [];
      for (const m of moves) {
        const tempBoard = [...board];
        if (type === 'P' && room && m === room.enPassantTarget) {
          tempBoard[myColor === 'w' ? m + 8 : m - 8] = '';
        }
        tempBoard[m] = tempBoard[startIndex];
        tempBoard[startIndex] = '';

        if (!this.isKingInCheck(tempBoard, myColor)) {
          legalMoves.push(m);
        }
      }
      return legalMoves;
    }

    return moves;
  }

  public static isSquareUnderAttack(board: string[], squareIndex: number, attackerColor: string): boolean {
    for (let i = 0; i < 64; i++) {
      const piece = board[i];
      if (piece && piece.startsWith(attackerColor)) {
        if (this.getLocalValidChessMoves(null, board, i, attackerColor, false).includes(squareIndex)) {
          return true;
        }
      }
    }
    return false;
  }

  public static isKingInCheck(board: string[], color: string): boolean {
    const kingIdx = board.indexOf(color + 'K');
    if (kingIdx === -1) return false;
    return this.isSquareUnderAttack(board, kingIdx, color === 'w' ? 'b' : 'w');
  }
}