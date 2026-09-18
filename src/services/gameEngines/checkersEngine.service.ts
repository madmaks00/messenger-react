import { IBoardCell } from '../../types/models';

export interface CheckersJump {
  to: number;
  captured: number;
}

export class CheckersEngineService {
  private static isOnBoard(r: number, c: number): boolean {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  public static getLocalValidJumps(
    boardCells: IBoardCell[],
    startIndex: number,
    mySymbol: string
  ): CheckersJump[] {
    const jumps: CheckersJump[] = [];
    const piece = boardCells[startIndex]?.content;
    if (!piece) return jumps;

    const isKing = piece.endsWith('K');
    const r = Math.floor(startIndex / 8);
    const c = startIndex % 8;

    const dr = [-1, -1, 1, 1];
    const dc = [-1, 1, -1, 1];

    for (let i = 0; i < 4; i++) {
      if (!isKing) {
        const r1 = r + dr[i];
        const c1 = c + dc[i];
        const r2 = r + 2 * dr[i];
        const c2 = c + 2 * dc[i];

        if (this.isOnBoard(r1, c1) && this.isOnBoard(r2, c2)) {
          const idx1 = r1 * 8 + c1;
          const idx2 = r2 * 8 + c2;
          const midPiece = boardCells[idx1]?.content;

          if (midPiece && !midPiece.startsWith(mySymbol)) {
            if (!boardCells[idx2]?.content) {
              jumps.push({ to: idx2, captured: idx1 });
            }
          }
        }
      } else {
        // Дамка скользит по диагонали
        let curR = r + dr[i];
        let curC = c + dc[i];
        let capturedIdx: number | null = null;

        while (this.isOnBoard(curR, curC)) {
          const idx = curR * 8 + curC;
          const p = boardCells[idx]?.content;

          if (!p) {
            if (capturedIdx !== null) jumps.push({ to: idx, captured: capturedIdx });
          } else if (!p.startsWith(mySymbol)) {
            if (capturedIdx !== null) break;
            capturedIdx = idx;
          } else {
            break;
          }

          curR += dr[i];
          curC += dc[i];
        }
      }
    }

    return jumps;
  }

  public static getLocalValidSimpleMoves(
    boardCells: IBoardCell[],
    startIndex: number,
    mySymbol: string
  ): number[] {
    const moves: number[] = [];
    const piece = boardCells[startIndex]?.content;
    if (!piece) return moves;

    const isKing = piece.endsWith('K');
    const r = Math.floor(startIndex / 8);
    const c = startIndex % 8;

    if (!isKing) {
      const forward = mySymbol === 'W' ? -1 : 1;
      const dc = [-1, 1];
      for (const dCol of dc) {
        const nR = r + forward;
        const nC = c + dCol;
        if (this.isOnBoard(nR, nC) && !boardCells[nR * 8 + nC]?.content) {
          moves.push(nR * 8 + nC);
        }
      }
    } else {
      const dr = [-1, -1, 1, 1];
      const dc = [-1, 1, -1, 1];
      for (let i = 0; i < 4; i++) {
        let curR = r + dr[i];
        let curC = c + dc[i];
        while (this.isOnBoard(curR, curC) && !boardCells[curR * 8 + curC]?.content) {
          moves.push(curR * 8 + curC);
          curR += dr[i];
          curC += dc[i];
        }
      }
    }

    return moves;
  }
}