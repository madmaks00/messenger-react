import React, { useState, useEffect } from 'react';
import {
  mdiFolderOutline,
  mdiBriefcaseOutline,
  mdiStarOutline,
  mdiHeartOutline,
  mdiSchoolOutline,
  mdiGamepadVariantOutline,
  mdiMusicNoteOutline,
  mdiMessageOutline,
  mdiBellOutline,
  mdiAccountGroupOutline,
  mdiRobotOutline,
  mdiAirplane,
  mdiBasketball,
  mdiPaletteOutline,
  mdiCodeBraces,
  mdiBitcoin,
  mdiHomeOutline,
  mdiCartOutline,
  mdiMapMarkerOutline,
  mdiCloudOutline,
  mdiShieldOutline,
  mdiBankOutline,
  mdiHeadphones,
  mdiWalletOutline,
  mdiKeyOutline,
  mdiPaw,
  mdiEarth,
  mdiFormatListBulleted,
} from '@mdi/js';

import { useChatFolderStore } from '../../stores/chatFolderStore';
import { useTodoStore } from '../../stores/todoStore';
import { useNotesStore } from '../../stores/notesStore';
import { eventBus } from '../../services/eventBus';
import { ITodoList, INote } from '../../types/models';

// 🟢 ВСЕ 28 ЦВЕТОВ (4 ряда по 7) ИЗ ChatFolderViewModel.cs
export const AVAILABLE_COLORS: string[] = [
  '#FFB3B3', '#FBD38D', '#FAF089', '#9AE6B4', '#90CDF4', '#D6BCFA', '#FBB6CE',
  '#FF6B6B', '#FFB84D', '#FDE047', '#6EE7B7', '#60A5FA', '#C4B5FD', '#F472B6',
  '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#8B5CF6', '#FF2D55',
  '#C53030', '#DD6B20', '#D69E2E', '#276749', '#2B6CB0', '#6B46C1', '#B83280',
];

// 🟢 ВСЕ 28 ИКОНОК (4 ряда по 7) ИЗ AvailableIcons В ChatFolderViewModel.cs
export const AVAILABLE_ICONS: { kind: string; path: string }[] = [
  { kind: 'FolderOutline', path: mdiFolderOutline },
  { kind: 'BriefcaseOutline', path: mdiBriefcaseOutline },
  { kind: 'StarOutline', path: mdiStarOutline },
  { kind: 'HeartOutline', path: mdiHeartOutline },
  { kind: 'SchoolOutline', path: mdiSchoolOutline },
  { kind: 'GamepadVariantOutline', path: mdiGamepadVariantOutline },
  { kind: 'MusicNoteOutline', path: mdiMusicNoteOutline },
  { kind: 'MessageOutline', path: mdiMessageOutline },
  { kind: 'BellOutline', path: mdiBellOutline },
  { kind: 'AccountGroupOutline', path: mdiAccountGroupOutline },
  { kind: 'RobotOutline', path: mdiRobotOutline },
  { kind: 'Airplane', path: mdiAirplane },
  { kind: 'Basketball', path: mdiBasketball },
  { kind: 'PaletteOutline', path: mdiPaletteOutline },
  { kind: 'CodeBraces', path: mdiCodeBraces },
  { kind: 'Bitcoin', path: mdiBitcoin },
  { kind: 'HomeOutline', path: mdiHomeOutline },
  { kind: 'CartOutline', path: mdiCartOutline },
  { kind: 'MapMarkerOutline', path: mdiMapMarkerOutline },
  { kind: 'CloudOutline', path: mdiCloudOutline },
  { kind: 'ShieldOutline', path: mdiShieldOutline },
  { kind: 'BankOutline', path: mdiBankOutline },
  { kind: 'Headphones', path: mdiHeadphones },
  { kind: 'WalletOutline', path: mdiWalletOutline },
  { kind: 'KeyOutline', path: mdiKeyOutline },
  { kind: 'Paw', path: mdiPaw },
  { kind: 'Earth', path: mdiEarth },
  { kind: 'FormatListBulleted', path: mdiFormatListBulleted },
];

interface CreateFolderDialogProps {
  isOpen?: boolean;
  folderDialogTitle?: string;
  confirmButtonText?: string;
  onClose?: () => void;
}

export const CreateFolderDialog: React.FC<CreateFolderDialogProps> = ({
  isOpen: propIsOpen,
  folderDialogTitle: propTitle,
  confirmButtonText: propConfirmText,
  onClose: propOnClose,
}) => {
  // 🟢 Подписываемся на состояние модального окна напрямую из useChatFolderStore
  const isStoreOpen = useChatFolderStore((s) => s.isCreateFolderDialogOpen);
  const storeTitle = useChatFolderStore((s) => s.folderDialogTitle);
  const storeConfirmText = useChatFolderStore((s) => s.folderDialogConfirmButtonText);
  const storeName = useChatFolderStore((s) => s.newFolderName);
  const storeColor = useChatFolderStore((s) => s.selectedFolderColor);
  const storeIcon = useChatFolderStore((s) => s.selectedFolderIcon);

  const cancelCreateFolder = useChatFolderStore((s) => s.cancelCreateFolder);
  const confirmCreateFolder = useChatFolderStore((s) => s.confirmCreateFolder);
  const setNewFolderName = useChatFolderStore((s) => s.setNewFolderName);
  const setSelectedFolderColor = useChatFolderStore((s) => s.setSelectedFolderColor);
  const setSelectedFolderIcon = useChatFolderStore((s) => s.setSelectedFolderIcon);

  // Режимы редактирования для TaskList и Note (по C# ChatFolderViewModel.cs)
  const [mode, setMode] = useState<'Folder' | 'TaskList' | 'Note'>('Folder');
  const [targetList, setTargetList] = useState<ITodoList | null>(null);
  const [targetNote, setTargetNote] = useState<INote | null>(null);

  const [localTitle, setLocalTitle] = useState('Create Folder');
  const [localConfirmText, setLocalConfirmText] = useState('Create');
  const [localName, setLocalName] = useState('');
  const [localColor, setLocalColor] = useState('#FF3B30');
  const [localIcon, setLocalIcon] = useState('FolderOutline');
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Окно открыто, если активен стор папок ИЛИ внешние props
  const isOpen = Boolean(propIsOpen || isStoreOpen);
  const maxLength = 12;

  const currentTitle = mode === 'Folder' ? (propTitle || storeTitle) : localTitle;
  const currentConfirmText = mode === 'Folder' ? (propConfirmText || storeConfirmText) : localConfirmText;
  const currentName = mode === 'Folder' ? storeName : localName;
  const currentColor = mode === 'Folder' ? storeColor : localColor;
  const currentIcon = mode === 'Folder' ? storeIcon : localIcon;

  useEffect(() => {
    if (isStoreOpen && mode !== 'Folder') {
      setMode('Folder');
      setTargetList(null);
      setTargetNote(null);
    }
  }, [isStoreOpen, mode]);

  useEffect(() => {
    const handleOpenTaskList = (data: { list: ITodoList }) => {
      if (!data?.list) return;
      setMode('TaskList');
      setTargetList(data.list);
      setTargetNote(null);
      setLocalTitle('Edit Task List');
      setLocalConfirmText('Save');
      setLocalName(data.list.listName || '');

      const targetColor = data.list.iconColor || '#007AFF';
      const matchedColor = AVAILABLE_COLORS.find(
        (c) => c.toLowerCase() === targetColor.toLowerCase()
      );
      setLocalColor(matchedColor || '#007AFF');

      const targetIcon = data.list.iconKind || 'FormatListBulleted';
      const matchedIcon = AVAILABLE_ICONS.find(
        (i) => i.kind.toLowerCase() === targetIcon.toLowerCase()
      );
      setLocalIcon(matchedIcon?.kind || 'FormatListBulleted');

      useChatFolderStore.setState({ isCreateFolderDialogOpen: true });
    };

    const handleOpenNote = (data: { note: INote }) => {
      if (!data?.note) return;
      setMode('Note');
      setTargetNote(data.note);
      setTargetList(null);
      setLocalTitle('Edit Note');
      setLocalConfirmText('Save');
      setLocalName(data.note.title || '');

      const targetColor = data.note.iconColor || '#007AFF';
      const matchedColor = AVAILABLE_COLORS.find(
        (c) => c.toLowerCase() === targetColor.toLowerCase()
      );
      setLocalColor(matchedColor || '#007AFF');

      const targetIcon = data.note.iconKind || 'FolderOutline';
      const matchedIcon = AVAILABLE_ICONS.find(
        (i) => i.kind.toLowerCase() === targetIcon.toLowerCase()
      );
      setLocalIcon(matchedIcon?.kind || 'FolderOutline');

      useChatFolderStore.setState({ isCreateFolderDialogOpen: true });
    };

    const unbindTask = eventBus.on('OpenEditTaskListDialogMessage' as any, handleOpenTaskList);
    const unbindNote = eventBus.on('OpenEditNoteDialogMessage' as any, handleOpenNote);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unbindTask();
      unbindNote();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    cancelCreateFolder();
    setTargetList(null);
    setTargetNote(null);
    setMode('Folder');
    if (propOnClose) propOnClose();
  };

  const handleColorSelect = (color: string) => {
    if (mode === 'Folder') {
      setSelectedFolderColor(color);
    } else {
      setLocalColor(color);
    }
  };

  const handleIconSelect = (iconKind: string) => {
    if (mode === 'Folder') {
      setSelectedFolderIcon(iconKind);
    } else {
      setLocalIcon(iconKind);
    }
  };

  const handleNameChange = (val: string) => {
    if (mode === 'Folder') {
      setNewFolderName(val);
    } else {
      setLocalName(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentName.trim()) return;

    if (mode === 'TaskList' && targetList) {
      const updated: ITodoList = {
        ...targetList,
        listName: currentName.trim(),
        iconColor: currentColor,
        iconKind: currentIcon,
        isEditing: false,
      };
      await useTodoStore.getState().commitEditList(updated);
    } else if (mode === 'Note' && targetNote) {
      const updated: INote = {
        ...targetNote,
        title: currentName.trim(),
        iconColor: currentColor,
        iconKind: currentIcon,
        isEditing: false,
      };
      await useNotesStore.getState().commitEditNote(updated, updated.title);
    } else {
      // 🟢 Вызывает сохранение (Создание или Обновление существующей папки через PUT)
      await confirmCreateFolder();
    }

    handleClose();
  };

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        userSelect: 'none',
        padding: 16,
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        .wpf-color-cell {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          position: relative;
          transition: transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .wpf-color-cell:active {
          transform: scale(0.92);
        }

        .wpf-color-ring {
          position: absolute;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 1.5px solid rgba(255, 255, 255, 0.7);
          box-sizing: border-box;
          opacity: 0;
          transform: scale(0.92);
          transition: opacity 0.16s ease, transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1);
          pointer-events: none;
        }

        .wpf-color-cell:hover:not(.selected) .wpf-color-ring {
          opacity: 0.75;
          transform: scale(1.05);
        }
        .wpf-color-cell:hover:not(.selected) .wpf-color-dot {
          transform: scale(1.12);
        }

        .wpf-color-cell.selected .wpf-color-ring {
          border: 2px solid #FFFFFF !important;
          opacity: 1 !important;
          transform: scale(1) !important;
        }

        .wpf-color-dot {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          z-index: 1;
          transition: transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.25);
        }

        .wpf-icon-cell {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          background-color: transparent;
          transition: background-color 0.15s ease, transform 0.12s ease;
          box-sizing: border-box;
        }
        .wpf-icon-cell:active {
          transform: scale(0.92);
        }
        .wpf-icon-cell:hover:not(.selected) {
          background-color: rgba(255, 255, 255, 0.08) !important;
          transform: scale(1.08);
        }
        .wpf-icon-cell:hover:not(.selected) svg {
          fill: #FFFFFF !important;
        }
        .wpf-icon-cell.selected {
          background-color: #222D3D !important;
        }
        .wpf-icon-cell.selected svg {
          fill: #FFFFFF !important;
        }
        .wpf-icon-cell svg {
          transition: fill 0.15s ease;
        }

        .wpf-dialog-cancel-btn {
          background: transparent;
          border: none;
          color: #94A3B8;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          padding: 8px 16px;
          border-radius: 6px;
          outline: none;
          transition: background-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
        }
        .wpf-dialog-cancel-btn:hover {
          background-color: rgba(255, 255, 255, 0.08);
          color: #FFFFFF;
        }
        .wpf-dialog-cancel-btn:active {
          transform: scale(0.96);
          background-color: rgba(255, 255, 255, 0.14);
        }

        .wpf-dialog-confirm-btn {
          background: transparent;
          border: none;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          padding: 8px 18px;
          border-radius: 6px;
          outline: none;
          transition: background-color 0.15s ease, filter 0.15s ease, transform 0.1s ease;
        }
        .wpf-dialog-confirm-btn:hover {
          background-color: rgba(255, 255, 255, 0.08);
          filter: brightness(1.25);
        }
        .wpf-dialog-confirm-btn:active {
          transform: scale(0.96);
          background-color: rgba(255, 255, 255, 0.14);
        }
      `}</style>

      {/* Карточка окна */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380,
          maxHeight: '92vh',
          backgroundColor: '#161B26',
          borderRadius: 12,
          padding: '20px 24px 16px 24px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
          border: '1px solid #2A3342',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        <h3
          style={{
            margin: '0 0 15px 0',
            color: '#FFFFFF',
            fontSize: 18,
            fontWeight: 'bold',
            flexShrink: 0,
          }}
        >
          {currentTitle}
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div
            className="wpf-scroll-viewer"
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              margin: '0 -10px 12px 0',
              padding: '0 10px 0 0',
              boxSizing: 'border-box',
            }}
          >
            {/* Поле ввода имени */}
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <input
                type="text"
                maxLength={maxLength}
                placeholder="Folder Name"
                required
                autoFocus
                value={currentName}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                onChange={(e) => handleNameChange(e.target.value)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `1px solid ${isInputFocused ? currentColor : '#283040'}`,
                  color: '#FFFFFF',
                  fontSize: 15,
                  padding: '8px 0 4px 0',
                  outline: 'none',
                  caretColor: currentColor,
                  boxSizing: 'border-box',
                  fontFamily: "'Segoe UI', -apple-system, sans-serif",
                  transition: 'border-color 0.2s ease',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: '#7D8494', fontWeight: 500 }}>
                  {currentName.length} / {maxLength}
                </span>
              </div>
            </div>

            {/* Выбор цвета */}
            <div style={{ fontSize: 13, fontWeight: 600, color: '#7D8494', marginBottom: 8 }}>Color</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                justifyItems: 'center',
                rowGap: 4,
                marginBottom: 20,
              }}
            >
              {AVAILABLE_COLORS.map((c) => {
                const isSelected = currentColor.toLowerCase() === c.toLowerCase();
                return (
                  <div
                    key={c}
                    onClick={() => handleColorSelect(c)}
                    className={`wpf-color-cell ${isSelected ? 'selected' : ''}`}
                    title={c}
                  >
                    <div className="wpf-color-ring" />
                    <div className="wpf-color-dot" style={{ backgroundColor: c }} />
                  </div>
                );
              })}
            </div>

            {/* Выбор иконки */}
            <div style={{ fontSize: 13, fontWeight: 600, color: '#7D8494', marginBottom: 8 }}>Icon</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                justifyItems: 'center',
                rowGap: 4,
                marginBottom: 10,
              }}
            >
              {AVAILABLE_ICONS.map((item) => {
                const isSelected = currentIcon.toLowerCase() === item.kind.toLowerCase();
                return (
                  <div
                    key={item.kind}
                    onClick={() => handleIconSelect(item.kind)}
                    className={`wpf-icon-cell ${isSelected ? 'selected' : ''}`}
                    title={item.kind}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width={22}
                      height={22}
                      fill={isSelected ? '#FFFFFF' : '#7D8494'}
                      style={{ display: 'inline-block' }}
                    >
                      <path d={item.path} />
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Кнопки Cancel / Save */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 5, flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleClose}
              className="wpf-dialog-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="wpf-dialog-confirm-btn"
              style={{ color: currentColor }}
            >
              {currentConfirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateFolderDialog;