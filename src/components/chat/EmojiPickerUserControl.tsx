import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useEmojiStore } from '../../stores/emojiStore';
import { ISavedGif } from '../../types/models';
import { UrlHelper } from '../../utils/helpers';
import { BASE_SERVER_URL } from '../../services/apiClient';
import { getCanonicalGifFilename } from '../../services/gif.service';

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

  // 🟢 Строгая дедупликация в UI: ни при каких условиях не выводить одинаковые гифки
  const uniqueGifs = useMemo(() => {
    const seenUrls = new Set<string>();
    const seenFilenames = new Set<string>();
    const list: ISavedGif[] = [];

    for (const g of savedGifs) {
      if (!g.url || g.url.startsWith('blob:') || g.url.trim().length === 0) continue;

      const normUrl = UrlHelper.normalize(g.url, BASE_SERVER_URL);
      const filename = getCanonicalGifFilename(normUrl);

      if (seenUrls.has(normUrl) || (filename && seenFilenames.has(filename))) {
        continue;
      }

      seenUrls.add(normUrl);
      if (filename) seenFilenames.add(filename);

      list.push({
        ...g,
        url: normUrl,
        thumbnailUrl: g.thumbnailUrl ? UrlHelper.normalize(g.thumbnailUrl, BASE_SERVER_URL) : normUrl,
      });
    }
    return list;
  }, [savedGifs]);

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
        backgroundColor: 'var(--surface-control, #1E2330)',
        borderRadius: 16,
        border: '1.2px solid var(--border-primary, #334155)',
        boxShadow: '0 12px 36px var(--shadow-colour, rgba(0, 0, 0, 0.55))',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        userSelect: 'none',
      }}
    >
      <style>{`
        .wpf-emoji-scroll {
          scrollbar-width: thin !important;
          scrollbar-color: var(--surface-hover, rgba(255, 255, 255, 0.22)) transparent !important;
        }
        .wpf-emoji-scroll::-webkit-scrollbar {
          width: 4px !important;
          background: transparent !important;
        }
        .wpf-emoji-scroll::-webkit-scrollbar-track {
          background: transparent !important;
        }
        .wpf-emoji-scroll::-webkit-scrollbar-thumb {
          background: var(--surface-hover, rgba(255, 255, 255, 0.22)) !important;
          border-radius: 2px !important;
        }
        .wpf-emoji-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--surface-hover, rgba(255, 255, 255, 0.45)) !important;
        }
        .wpf-emoji-scroll::-webkit-scrollbar-button {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      `}</style>

      {/* 1. Верхние вкладки: Emoji / GIF */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: 45, borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))' }}>
        <button
          onClick={() => selectMainTab('Emoji')}
          style={{
            background: 'transparent',
            border: 'none',
            color: selectedMainTab === 'Emoji' ? 'var(--app-accent, #3B82F6)' : 'var(--text-secondary, #94A3B8)',
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
            color: selectedMainTab === 'GIF' ? 'var(--app-accent, #3B82F6)' : 'var(--text-secondary, #94A3B8)',
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
      <div className="wpf-emoji-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
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
                  transition: 'background-color 0.1s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover, rgba(255, 255, 255, 0.08))')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          /* РЕЖИМ 2: Сетка уникальных GIF (3 колонки по ~94px) */
          <div>
            {isGifsLoading && uniqueGifs.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary, #94A3B8)', marginTop: 80 }}>Loading GIFs...</div>
            ) : uniqueGifs.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary, #94A3B8)', marginTop: 80, fontSize: 13 }}>No saved GIFs yet</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                {uniqueGifs.map((gif) => (
                  <GifGridItem
                    key={gif.id || gif.serverId || gif.url}
                    gif={gif}
                    onSelect={() => pickGif(gif)}
                  />
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
            backgroundColor: 'var(--surface-panel, #161B26)',
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            padding: '0 4px',
            borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))',
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
                background: selectedCategory === cat.key ? 'var(--surface-hover, rgba(255, 255, 255, 0.12))' : 'transparent',
                border: 'none',
                borderRadius: 6,
                fontSize: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.1s ease',
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

const GifGridItem: React.FC<{ gif: ISavedGif; onSelect: () => void }> = ({ gif, onSelect }) => {
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isVideo = Boolean(gif.url && gif.url.toLowerCase().endsWith('.mp4'));

  useEffect(() => {
    if (!isVideo || !videoRef.current) return;
    if (isHovered) {
      const p = videoRef.current.play();
      if (p !== undefined) p.catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isHovered, isVideo]);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: 94,
        height: 94,
        borderRadius: 8,
        overflow: 'hidden',
        cursor: 'pointer',
        backgroundColor: 'var(--surface-panel, #161B26)',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isVideo ? (
        <video
          ref={videoRef}
          src={`${gif.url}#t=0.001`}
          muted
          loop
          playsInline
          preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
        />
      ) : (
        <img
          src={gif.thumbnailUrl || gif.url}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
    </div>
  );
};

export default EmojiPickerUserControl;