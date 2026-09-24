import React from 'react';
import { mdiMagnify, mdiCloseCircle } from '@mdi/js';

interface SearchInputProps {
  text: string;
  hintText?: string;
  onChange: (val: string) => void;
  onClear?: () => void;
  searchBackground?: string;
  margin?: string;
  height?: number;
}

export const SearchInputUserControl: React.FC<SearchInputProps> = ({
  text,
  hintText = 'Search...',
  onChange,
  onClear,
  searchBackground,
  margin = '0 6px 8px 6px',
  height = 37,
}) => {
  const handleClear = () => {
    onChange('');
    onClear?.();
  };

  return (
    <div style={{ margin, boxSizing: 'border-box', flexShrink: 0 }}>
      {/* 🟢 Отключаем системный крестик Chrome/Safari/Edge прямо в компоненте */}
      <style>{`
        .wpf-search-input::-webkit-search-cancel-button,
        .wpf-search-input::-webkit-search-decoration,
        .wpf-search-input::-webkit-search-results-button,
        .wpf-search-input::-webkit-search-results-decoration {
          -webkit-appearance: none !important;
          display: none !important;
        }
        .wpf-search-input::-ms-clear,
        .wpf-search-input::-ms-reveal {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      `}</style>

      <div
        style={{
          height,
          backgroundColor: searchBackground || 'var(--sidebar-search-bg, #1C212D)',
          borderRadius: 9,
          padding: '0 12px',
          border: '1.2px solid transparent',
          display: 'flex',
          alignItems: 'center',
          boxSizing: 'border-box',
        }}
      >
        {/* Иконка Лупы 18x18 с цветом #8E95A5 */}
        <svg
          viewBox="0 0 24 24"
          width={18}
          height={18}
          fill="#8E95A5"
          style={{ marginRight: 10, flexShrink: 0 }}
        >
          <path d={mdiMagnify} />
        </svg>

        {/* Текстовое поле ввода */}
        <input
          type="search"
          name="notes_tasks_search_query"
          autoComplete="one-time-code"
          autoCorrect="off"
          spellCheck={false}
          data-lpignore="true"
          data-form-type="other"
          value={text}
          placeholder={hintText}
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
            color: '#FFFFFF',
            fontSize: 14,
            fontFamily: "'Segoe UI', -apple-system, sans-serif",
            boxSizing: 'border-box',
          }}
        />

        {/* Кнопка очистки (Крестик) */}
        {Boolean(text) && (
          <button
            onClick={handleClear}
            style={{
              width: 24,
              height: 24,
              padding: 0,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginLeft: 4,
            }}
          >
            <svg viewBox="0 0 24 24" width={18} height={18} fill="#8E95A5">
              <path d={mdiCloseCircle} />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchInputUserControl;