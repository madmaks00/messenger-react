import React, { useState } from 'react';
import { mdiMagnify, mdiCloseCircle } from '@mdi/js';

interface SearchInputProps {
  text: string;
  hintText: string;
  onChange: (val: string) => void;
  onClear?: () => void;
  margin?: string;
}

export const SearchInputUserControl: React.FC<SearchInputProps> = ({
  text,
  hintText,
  onChange,
  onClear,
  margin = '0 6px 10px 6px',
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div style={{ margin, boxSizing: 'border-box', flexShrink: 0 }}>
      <div
        style={{
          height: 40,
          backgroundColor: isFocused ? 'var(--sidebar-search-focus-bg)' : 'var(--sidebar-search-bg)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          border: '1.2px solid transparent',
          boxSizing: 'border-box',
          transition: 'background-color 0.15s ease',
        }}
      >
        <svg viewBox="0 0 24 24" width={18} height={18} fill="var(--text-muted)" style={{ marginRight: 10, flexShrink: 0 }}>
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
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--sidebar-search-text)',
            fontSize: 14,
            width: '100%',
            fontFamily: 'Segoe UI, sans-serif',
          }}
        />

        {text.length > 0 && (
          <button
            onClick={() => {
              onChange('');
              onClear?.();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg viewBox="0 0 24 24" width={18} height={18} fill="var(--text-muted)">
              <path d={mdiCloseCircle} />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};