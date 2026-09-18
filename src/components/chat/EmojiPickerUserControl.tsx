import React, { useRef, useEffect } from 'react';
import { useEmojiStore } from '../../stores/emojiStore';

const CATEGORY_ICONS: { key: string; icon: string; title: string }[] = [
  { key: 'Recent', icon: '🕒', title: 'Recent' },
  { key: 'Smileys', icon: '😀', title: 'Smileys' },
  { key: 'Animals', icon: '🐶', title: 'Animals' },
  { key: 'Food', icon: '🍎', title: 'Food' },
  { key: 'Activities', icon: '⚽', title: 'Activities' },
  { key: 'Travel', icon: '🚗', title: 'Travel' },
  { key: 'Objects', icon: '💡', title: 'Objects' },
  { key: 'Symbols', icon: '❤️', title: 'Symbols' },
];

export const EmojiPickerUserControl: React.FC = () => {
  const {
    isEmojiPickerOpen,
    selectedMainTab,
    selectedCategory,
    currentEmojiList,
    savedGifs,
    isGifsLoading,
    closePicker,
    selectMainTab,
    switchEmojiCategory,
    addEmoji,
    pickGif,
  } = useEmojiStore();

  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        closePicker();
      }
    };
    if (isEmojiPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEmojiPickerOpen, closePicker]);

  if (!isEmojiPickerOpen) return null;

  return (
    <div
      ref={popupRef}
      style={{
        position: 'absolute',
        bottom: 60,
        right: 16,
        width: 320,
        height: 440,
        backgroundColor: '#1E2330',
        borderRadius: 16,
        border: '1.2px solid #334155',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.55)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        userSelect: 'none',
      }}
    >
      {/* 1. Верхние вкладки: Emoji / GIF */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: 45, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <button
          onClick={() => selectMainTab('Emoji')}
          style={{
            background: 'transparent',
            border: 'none',
            color: selectedMainTab === 'Emoji' ? 'var(--app-accent, #3B82F6)' : '#94A3B8',
            fontSize: 13.5,
            fontWeight: 'bold',
            cursor: 'pointer',
            borderBottom: selectedMainTab === 'Emoji' ? '2px solid var(--app-accent, #3B82F6)' : 'none',
          }}
        >
          Emoji
        </button>
        <button
          onClick={() => selectMainTab('GIF')}
          style={{
            background: 'transparent',
            border: 'none',
            color: selectedMainTab === 'GIF' ? 'var(--app-accent, #3B82F6)' : '#94A3B8',
            fontSize: 13.5,
            fontWeight: 'bold',
            cursor: 'pointer',
            borderBottom: selectedMainTab === 'GIF' ? '2px solid var(--app-accent, #3B82F6)' : 'none',
          }}
        >
          GIF
        </button>
      </div>

      {/* 2. Контент вкладки */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
        {selectedMainTab === 'Emoji' ? (
          /* РЕЖИМ 1: Сетка эмодзи */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {currentEmojiList.map((emoji, index) => (
              <button
                key={`${emoji}_${index}`}
                onClick={() => addEmoji(emoji)}
                style={{
                  width: 40,
                  height: 40,
                  fontSize: 22,
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          /* РЕЖИМ 2: Монолитная сетка GIF (3 колонки по ~94px) */
          <div>
            {isGifsLoading ? (
              <div style={{ textAlign: 'center', color: '#94A3B8', marginTop: 80 }}>Loading GIFs...</div>
            ) : savedGifs.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94A3B8', marginTop: 80, fontSize: 13 }}>No saved GIFs yet</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                {savedGifs.map((gif) => (
                  <div
                    key={gif.id}
                    onClick={() => pickGif(gif)}
                    style={{
                      width: 94,
                      height: 94,
                      borderRadius: 8,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <img src={gif.thumbnailUrl || gif.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Нижняя панель категорий эмодзи */}
      {selectedMainTab === 'Emoji' && (
        <div
          style={{
            height: 40,
            backgroundColor: '#161B26',
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            padding: '0 4px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          {CATEGORY_ICONS.map((cat) => (
            <button
              key={cat.key}
              onClick={() => switchEmojiCategory(cat.key)}
              title={cat.title}
              style={{
                width: 32,
                height: 32,
                background: selectedCategory === cat.key ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                border: 'none',
                borderRadius: 6,
                fontSize: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};