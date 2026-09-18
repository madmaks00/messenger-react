import React, { useMemo } from 'react';

interface LightweightChatTextBoxProps {
  text: string;
  isDeleted?: boolean;
  fontSize?: number;
  lineHeight?: number;
  onMentionClick?: (username: string) => void;
  onJoinClick?: (joinPath: string) => void;
}

// Регулярка 1-в-1 из TokenRegex в C#
const TOKEN_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|@[a-zA-Z0-9_]+|\/join\/[a-zA-Z0-9_-]+)/gi;

const MENTION_LINK_COLOR = '#82B1FF';
const DELETED_TEXT_COLOR = '#80FFFFFF';

export const LightweightChatTextBox: React.FC<LightweightChatTextBoxProps> = ({
  text,
  isDeleted = false,
  fontSize = 15,
  lineHeight = 20,
  onMentionClick,
  onJoinClick,
}) => {
  const renderedContent = useMemo(() => {
    if (!text) return null;

    if (isDeleted) {
      return (
        <span style={{ fontStyle: 'italic', color: DELETED_TEXT_COLOR }}>
          {text}
        </span>
      );
    }

    const parts = text.split(TOKEN_REGEX);

    return parts.map((part, index) => {
      if (!part) return null;

      // 1. Упоминания @username
      if (part.startsWith('@')) {
        return (
          <span
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              onMentionClick ? onMentionClick(part) : window.dispatchEvent(new CustomEvent('OpenUsernameMessage', { detail: part }));
            }}
            style={{ color: MENTION_LINK_COLOR, cursor: 'pointer', userSelect: 'text' }}
          >
            {part}
          </span>
        );
      }

      // 2. Инвайты в группы /join/
      if (part.toLowerCase().startsWith('/join/')) {
        return (
          <span
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              onJoinClick ? onJoinClick(part) : window.dispatchEvent(new CustomEvent('OpenJoinGroupRequestMessage', { detail: part }));
            }}
            style={{ color: MENTION_LINK_COLOR, cursor: 'pointer', userSelect: 'text' }}
          >
            {part}
          </span>
        );
      }

      // 3. Веб-ссылки http://, https://, www.
      if (
        part.toLowerCase().startsWith('http://') ||
        part.toLowerCase().startsWith('https://') ||
        part.toLowerCase().startsWith('www.')
      ) {
        const href = part.toLowerCase().startsWith('www.') ? `https://${part}` : part;
        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ color: MENTION_LINK_COLOR, textDecoration: 'none', cursor: 'pointer' }}
          >
            {part}
          </a>
        );
      }

      // Обычный текст
      return <span key={index}>{part}</span>;
    });
  }, [text, isDeleted, onMentionClick, onJoinClick]);

  return (
    <div
      style={{
        fontSize: `${fontSize}px`,
        lineHeight: `${lineHeight}px`,
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        fontFamily: 'Segoe UI, -apple-system, BlinkMacSystemFont, Roboto, sans-serif',
        userSelect: 'text',
      }}
    >
      {renderedContent}
    </div>
  );
};