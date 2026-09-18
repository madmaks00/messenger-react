// src/components/common/SearchInputUserControl.tsx
import React from 'react';

interface SearchInputProps {
  text: string;
  hintText?: string;
  searchBackground?: string;
  onChange?: (value: string) => void;
  clearCommand?: () => void;
}

export const SearchInputUserControl: React.FC<SearchInputProps> = ({
  text,
  hintText = 'Search...',
  searchBackground = 'rgba(255, 255, 255, 0.05)',
  onChange,
  clearCommand,
}) => {
  const handleClear = () => {
    onChange?.('');
    clearCommand?.();
  };

  return (
    <div
      style={{
        backgroundColor: searchBackground,
        borderRadius: 8,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <span style={{ color: '#94A3B8', fontSize: 14, marginRight: 8 }}>🔍</span>
      <input
        type="text"
        placeholder={hintText}
        value={text}
        onChange={(e) => onChange?.(e.target.value)}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: '#FFFFFF',
          fontSize: 14,
        }}
      />
      {text && (
        <button
          onClick={handleClear}
          style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 13, padding: 0 }}
        >
          ✕
        </button>
      )}
    </div>
  );
};