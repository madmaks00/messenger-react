const SHIP_SIZES = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];

export class BattleshipEngineService {
  public static canPlaceShipLocal(
    board: string[],
    x: number,
    y: number,
    size: number,
    isHorz: boolean
  ): boolean {
    if (isHorz && x + size > 10) return false;
    if (!isHorz && y + size > 10) return false;

    // Проверка ореола вокруг корабля на 1 клетку во всех направлениях
    for (let i = -1; i <= size; i++) {
      for (let j = -1; j <= 1; j++) {
        const cx = isHorz ? x + i : x + j;
        const cy = isHorz ? y + j : y + i;

        if (cx >= 0 && cx < 10 && cy >= 0 && cy < 10) {
          if (board[cy * 10 + cx] === 'S') return false;
        }
      }
    }
    return true;
  }

  public static generateAutoPlacement(): number[][] {
    const tempBoard = new Array(100).fill('');
    const tempShips: number[][] = [];

    for (const size of SHIP_SIZES) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 500) {
        attempts++;
        const x = Math.floor(Math.random() * 10);
        const y = Math.floor(Math.random() * 10);
        const isHorz = Math.random() < 0.5;

        if (this.canPlaceShipLocal(tempBoard, x, y, size, isHorz)) {
          const ship: number[] = [];
          for (let i = 0; i < size; i++) {
            const idx = isHorz ? y * 10 + x + i : (y + i) * 10 + x;
            tempBoard[idx] = 'S';
            ship.push(idx);
          }
          tempShips.push(ship);
          placed = true;
        }
      }
    }
    return tempShips;
  }
}