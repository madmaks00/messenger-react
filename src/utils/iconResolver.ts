import * as mdi from '@mdi/js';

// Словарь сопоставления C# PackIconKind -> @mdi/js
const ICON_MAP: Record<string, string> = {
  Grid: mdi.mdiGrid,
  Checkerboard: mdi.mdiCheckerboard,
  ChessKnight: mdi.mdiChessKnight,
  Ferry: mdi.mdiFerry,
  Palette: mdi.mdiPalette,
  Pencil: mdi.mdiPencil,
  PencilOutline: mdi.mdiPencilOutline,
  Close: mdi.mdiClose,
  Draw: mdi.mdiDraw,
  GamepadVariantOutline: mdi.mdiGamepadVariantOutline,
  FormatListBulleted: mdi.mdiFormatListBulleted,
  ClipboardListOutline: mdi.mdiClipboardListOutline,
  ClipboardPlusOutline: mdi.mdiClipboardPlusOutline,
  BookmarkOutline: mdi.mdiBookmarkOutline,
  FileDocumentPlusOutline: mdi.mdiFileDocumentPlusOutline,
  TrashCanOutline: mdi.mdiTrashCanOutline,
  DeleteOutline: mdi.mdiDeleteOutline,
};

export function resolveMdiIcon(nameOrPath?: string | null, fallback: string = mdi.mdiHelpCircleOutline): string {
  if (!nameOrPath) return fallback;

  // Если это уже готовый векторный SVG-путь (начинается с M или m)
  if (nameOrPath.startsWith('M') || nameOrPath.startsWith('m')) {
    return nameOrPath;
  }

  // Проверяем прямое сопоставление из словаря
  if (ICON_MAP[nameOrPath]) {
    return ICON_MAP[nameOrPath];
  }

  // Динамический поиск в @mdi/js с префиксом "mdi" (например, "Pencil" -> "mdiPencil")
  const dynamicKey = `mdi${nameOrPath.charAt(0).toUpperCase()}${nameOrPath.slice(1)}`;
  if ((mdi as any)[dynamicKey]) {
    return (mdi as any)[dynamicKey];
  }

  return fallback;
}