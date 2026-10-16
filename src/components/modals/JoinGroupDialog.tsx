import { DialogFrame } from './DialogFrame';
import React, { useState, useEffect } from 'react';

export interface JoinGroupPreviewData {
  groupId: number;
  title: string;
  avatar?: string | null;
  description?: string | null;
  memberCount: number;
  onlineCount: number;
  isChannel: boolean;
  joinLink: string;
}

interface JoinGroupDialogProps {
  isOpen: boolean;
  data: JoinGroupPreviewData | null;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  error?: string;
}

export const JoinGroupDialog: React.FC<JoinGroupDialogProps> = ({
  isOpen,
  data,
  onCancel,
  onConfirm,
  busy = false,
  error = '',
}) => {
  const [isRendered, setIsRendered] = useState(isOpen && !!data);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [cachedData, setCachedData] = useState<JoinGroupPreviewData | null>(data);

  useEffect(() => {
    if (isOpen && data) {
      setCachedData(data);
      setIsRendered(true);
      setIsFadingOut(false);
    } else if (isRendered) {
      setIsFadingOut(true);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setIsFadingOut(false);
        setCachedData(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, data]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isRendered) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRendered, onCancel]);

  const activeData = data || cachedData;
  if (!isRendered || !activeData) return null;

  return (
    <DialogFrame isOpen={isOpen} kind="join">
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        opacity: isFadingOut ? 0 : 1,
        transition: 'opacity 0.12s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380,
          backgroundColor: '#1E2330',
          borderRadius: 16,
          padding: '24px 20px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
          border: '1px solid #334155',
        }}
      >
        {/* 1. Иконка + Заголовок */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#FFF', fontSize: 16, fontWeight: 'bold' }}>
            <span>{activeData.isChannel ? '📢' : '👥'}</span>
            <span>{activeData.isChannel ? 'Group Details' : 'Join Group'}</span>
          </div>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 18, cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {/* 2. Аватарка (80x80) */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#3B82F6',
              color: '#FFF',
              fontSize: 32,
              fontWeight: 'bold',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {activeData.avatar ? (
              <img src={activeData.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              activeData.title.charAt(0).toUpperCase()
            )}
          </div>
        </div>

        {/* Название */}
        <div style={{ fontSize: 20, fontWeight: 'bold', color: '#FFF', textAlign: 'center', marginBottom: 4 }}>
          {activeData.title}
        </div>

        {/* Подписчики / Участники */}
        <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>
          {activeData.isChannel ? (
            `${activeData.memberCount.toLocaleString()} subscribers`
          ) : (
            <span>
              {activeData.onlineCount > 0 && <span style={{ color: 'var(--app-accent, #38BDF8)' }}>{activeData.onlineCount.toLocaleString()} online • </span>}
              {activeData.memberCount.toLocaleString()} members
            </span>
          )}
        </div>

        {/* Описание */}
        {activeData.description && (
          <div style={{ backgroundColor: '#161A23', borderRadius: 10, padding: '12px 10px', marginBottom: 14, maxHeight: 80, overflowY: 'auto', fontSize: 13, color: '#94A3B8' }}>
            {activeData.description}
          </div>
        )}

        {/* Плашка ссылки */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 8, padding: '6px 10px', marginBottom: 24 }}>
          <span style={{ fontSize: 13 }}>🔗</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeData.joinLink}
          </span>
        </div>

        {error && <div role="alert" style={{color:'#FF7070',marginBottom:14}}>{error}</div>}
        {/* Кнопки */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '8px 16px' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy || !activeData.groupId}
            style={{
              backgroundColor: 'var(--app-accent, #3B82F6)',
              border: 'none',
              borderRadius: 8,
              color: '#FFF',
              fontSize: 14,
              fontWeight: 'bold',
              cursor: 'pointer',
              padding: '8px 20px',
            }}
          >
            {activeData.isChannel ? 'Join Channel' : 'Join Group'}
          </button>
        </div>
      </div>
    </div>
    </DialogFrame>
  );
};

export default JoinGroupDialog;