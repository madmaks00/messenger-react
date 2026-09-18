import React, { useState } from 'react';
import { useChatFolderStore } from '../../stores/chatFolderStore';

const AVAILABLE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4',
  '#84CC16', '#F97316', '#6366F1', '#14B8A6', '#EAB308', '#A855F7', '#64748B',
];

const AVAILABLE_ICONS = [
  '📁', '💬', '⭐', '❤️', '💼', '👤', '🎵',
  '🎮', '📚', '💻', '🔒', '🔔', '🏷️', '🚩',
];

interface CreateFolderDialogProps {
  isOpen: boolean;
  folderDialogTitle?: string;
  onClose: () => void;
}

export const CreateFolderDialog: React.FC<CreateFolderDialogProps> = ({
  isOpen,
  folderDialogTitle = 'Create Folder',
  onClose,
}) => {
  const { createFolder } = useChatFolderStore();
  const [folderName, setFolderName] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVAILABLE_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(AVAILABLE_ICONS[0]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    await createFolder(folderName.trim(), selectedIcon, selectedColor);
    setFolderName('');
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380,
          backgroundColor: '#1E2330',
          borderRadius: 12,
          padding: '24px 24px 16px 24px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
          border: '1px solid #334155',
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', color: '#FFF', fontSize: 18, fontWeight: 'bold' }}>
          {folderDialogTitle}
        </h3>

        <form onSubmit={handleSubmit}>
          {/* Поле имени */}
          <div style={{ marginBottom: 20 }}>
            <input
              type="text"
              maxLength={12}
              placeholder="Folder Name"
              required
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${selectedColor}`,
                color: '#FFF',
                fontSize: 15,
                padding: '8px 0',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Секция выбора цвета (Симметрично 7 колонок) */}
          <div style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', marginBottom: 8 }}>Color</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 20 }}>
            {AVAILABLE_COLORS.map((c) => {
              const isSelected = selectedColor === c;
              return (
                <div
                  key={c}
                  onClick={() => setSelectedColor(c)}
                  style={{
                    width: 40,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    borderRadius: 20,
                    border: isSelected ? '2px solid #FFF' : '2px solid transparent',
                  }}
                >
                  <div style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c }} />
                </div>
              );
            })}
          </div>

          {/* Секция выбора иконки (Симметрично 7 колонок) */}
          <div style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', marginBottom: 8 }}>Icon</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 24 }}>
            {AVAILABLE_ICONS.map((icon) => {
              const isSelected = selectedIcon === icon;
              return (
                <div
                  key={icon}
                  onClick={() => setSelectedIcon(icon)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: 20,
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                  }}
                >
                  {icon}
                </div>
              );
            })}
          </div>

          {/* Кнопки Cancel / Save */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 14, cursor: 'pointer', padding: '8px 16px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ background: 'transparent', border: 'none', color: selectedColor, fontSize: 14, fontWeight: 'bold', cursor: 'pointer', padding: '8px 16px' }}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};