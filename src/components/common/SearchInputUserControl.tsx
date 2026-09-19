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
  margin = '0 6px 10px 6px',
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
          height: 36,
          backgroundColor: searchBackground || (isFocused ? 'var(--sidebar-search-focus-bg)' : 'var(--sidebar-search-bg)'),
          borderRadius: 10,
          padding: '0 12px',
          border: '1.2px solid transparent',
          display: 'flex',
          alignItems: 'center',
          boxSizing: 'border-box',
          transition: 'background-color 0.15s ease',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width={17}
          height={17}
          fill="var(--text-muted)"
          style={{ marginRight: 9, flexShrink: 0 }}
        >
          <path d={mdiMagnify} />
        </svg>

        <input
          type="text"
          value={text}
          placeholder={hintText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%',
            height: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 0,
            margin: 0,
            color: 'var(--sidebar-search-text)',
            fontSize: 13.5,
            fontFamily: "'Segoe UI', -apple-system, sans-serif",
            boxSizing: 'border-box',
          }}
        />

        {Boolean(text) && (
          <button
            onClick={handleClear}
            style={{
              width: 18,
              height: 18,
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
            <svg viewBox="0 0 24 24" width={16} height={16} fill="var(--text-muted)">
              <path d={mdiCloseCircle} />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchInputUserControl;