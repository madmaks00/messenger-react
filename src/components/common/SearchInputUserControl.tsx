import React, { useState } from 'react';
import { mdiMagnify, mdiCloseCircle } from '@mdi/js';

interface SearchInputProps {
  text: string;
  hintText?: string;
  onChange: (val: string) => void;
  onClear?: () => void;
  searchBackground?: string;
  margin?: string;
}

export const SearchInputUserControl: React.FC<SearchInputProps> = ({
  text,
  hintText = 'Search...',
  onChange,
  onClear,
  searchBackground,
  margin = '0 6px 10px 6px', // WPF: Margin="6,0,6,10"
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    onChange('');
    onClear?.();
  };

  return (
    <div style={{ margin, boxSizing: 'border-box', flexShrink: 0 }}>
      <div
        style={{
          height: 40, // WPF: SidebarSearchInputBorderStyle Height="40"
          backgroundColor:
            searchBackground ||
            (isFocused ? '#232836' : '#1C212D'), // SidebarSearchInputFocusedBgBrush : SidebarSearchInputBgBrush
          borderRadius: 12, // WPF: CornerRadius="12"
          padding: '0 12px', // WPF: Padding="12,0"
          border: '1.2px solid transparent',
          display: 'flex',
          alignItems: 'center',
          boxSizing: 'border-box',
          transition: 'background-color 0.15s ease',
        }}
      >
        {/* Иконка Лупы 18x18 */}
        <svg
          viewBox="0 0 24 24"
          width={18}
          height={18}
          fill="#7D8494" // StaticResource TextMuted
          style={{ marginRight: 10, flexShrink: 0 }}
        >
          <path d={mdiMagnify} />
        </svg>

        {/* Текстовое поле */}
        <input
          type="text"
          value={text}
          placeholder={hintText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => onChange(e.target.value)}
          className="wpf-search-input"
          style={{
            width: '100%',
            height: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 0,
            margin: 0,
            color: '#FFFFFF', // SidebarSearchInputTextBrush
            fontSize: 14, // WPF: FontSize="14"
            fontFamily: "'Segoe UI', -apple-system, sans-serif",
            boxSizing: 'border-box',
          }}
        />

        {/* Кнопка очистки (Крестик) 20x20 */}
        {Boolean(text) && (
          <button
            onClick={handleClear}
            style={{
              width: 20,
              height: 20,
              padding: 0,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg viewBox="0 0 24 24" width={16} height={16} fill="#7D8494">
              <path d={mdiCloseCircle} />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchInputUserControl;