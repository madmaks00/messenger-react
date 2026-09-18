import React, { useState, useRef } from 'react';
import { groupService } from '../../services/group.service';

interface CreateGroupModalViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateGroupModalView: React.FC<CreateGroupModalViewProps> = ({
  isOpen,
  onClose,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [isChannel, setIsChannel] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => setAvatar(reader.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleCreate = async () => {
    if (!groupName.trim()) return;

    const res = await groupService.createGroupAsync({
  name: groupName.trim(),
  description: description.trim(),
  isChannel,
  isPublic,
  username: isPublic ? username.trim() : undefined,
  avatar: avatar || undefined,
} as any);

if (res) {
  setCreatedLink((res as any).inviteLink || `/join/${res.id}`);
  setStep(2);
}
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(createdLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
  };

  const handleClose = () => {
    setStep(1);
    setGroupName('');
    setDescription('');
    setUsername('');
    setAvatar(null);
    onClose();
  };

  return (
    <div
      onClick={handleClose}
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
          width: 390,
          backgroundColor: '#1E2330',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
          border: '1px solid #334155',
        }}
      >
        {step === 1 ? (
          /* ШАГ 1: ВВОД ДАННЫХ */
          <div>
            <h3 style={{ margin: '0 0 15px 0', textAlign: 'center', fontSize: 19, fontWeight: 600, color: '#FFF' }}>
              {isChannel ? 'Create Channel' : 'Create Group'}
            </h3>

            {/* Переключатель Group / Channel */}
            <div style={segmentedContainerStyle}>
              <button
                type="button"
                onClick={() => setIsChannel(false)}
                style={getSegmentedBtnStyle(!isChannel)}
              >
                Group
              </button>
              <button
                type="button"
                onClick={() => setIsChannel(true)}
                style={getSegmentedBtnStyle(isChannel)}
              >
                Channel
              </button>
            </div>

            {/* Аватарка и Название */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 15 }}>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  border: '1.5px solid var(--app-accent, #3B82F6)',
                  backgroundColor: '#161B26',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {avatar ? (
                  <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 24 }}>📷</span>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarSelect} style={{ display: 'none' }} />
              </div>

              <input
                type="text"
                placeholder={isChannel ? 'Channel Name' : 'Group Name'}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                style={modernInputStyle}
              />
            </div>

            {/* Описание */}
            <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--app-accent, #38BDF8)', marginBottom: 6 }}>
              Description
            </div>
            <input
              type="text"
              placeholder="Description (Optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ ...modernInputStyle, marginBottom: 15 }}
            />

            {/* Доступ: Private / Public */}
            <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--app-accent, #38BDF8)', marginBottom: 6 }}>
              Access
            </div>
            <div style={segmentedContainerStyle}>
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                style={getSegmentedBtnStyle(!isPublic)}
              >
                Private
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                style={getSegmentedBtnStyle(isPublic)}
              >
                Public
              </button>
            </div>

            {/* Ввод ссылки, если Public */}
            {isPublic && (
              <div style={{ marginTop: 15 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--app-accent, #38BDF8)', marginBottom: 6 }}>
                  Public link suffix
                </div>
                <div style={{ display: 'flex', alignItems: 'center', background: '#161B26', border: '1px solid #334155', borderRadius: 8, padding: '0 12px', height: 40 }}>
                  <span style={{ color: '#64748B', fontSize: 14.5, marginRight: 4 }}>/join/</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{ flex: 1, background: 'transparent', border: 'none', color: '#FFF', fontSize: 14.5, outline: 'none' }}
                  />
                </div>
              </div>
            )}

            {/* Кнопки */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button onClick={handleClose} style={textBtnStyle}>Cancel</button>
              <button onClick={handleCreate} style={{ ...textBtnStyle, fontWeight: 'bold' }}>Create</button>
            </div>
          </div>
        ) : (
          /* ШАГ 2: УСПЕХ И ССЫЛКА */
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, color: 'var(--app-accent, #3B82F6)', marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#FFF', marginBottom: 8 }}>
              {isChannel ? 'Channel created' : 'Group created'}
            </div>
            <div style={{ fontSize: 13.5, color: '#94A3B8', marginBottom: 20 }}>
              Send this link to your friends to invite them.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#161B26', border: '1px solid #334155', borderRadius: 8, padding: '12px 14px', marginBottom: 24 }}>
              <span style={{ color: 'var(--app-accent, #38BDF8)', fontSize: 14.5, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {createdLink}
              </span>
              <button onClick={handleCopy} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 16 }}>
                {isCopied ? '✓' : '📋'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={handleClose} style={textBtnStyle}>Done</button>
              <button onClick={handleCopy} style={{ ...textBtnStyle, fontWeight: 'bold' }}>Copy</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const segmentedContainerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  background: '#161B26',
  borderRadius: 8,
  padding: 3,
  marginBottom: 15,
};

const getSegmentedBtnStyle = (isActive: boolean): React.CSSProperties => ({
  background: isActive ? 'var(--app-accent, #3B82F6)' : 'transparent',
  color: isActive ? '#FFFFFF' : '#94A3B8',
  border: 'none',
  borderRadius: 6,
  padding: '7px 0',
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
});

const modernInputStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  background: '#161B26',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#FFFFFF',
  fontSize: 14.5,
  padding: '0 12px',
  outline: 'none',
  boxSizing: 'border-box',
};

const textBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--app-accent, #3B82F6)',
  fontSize: 14,
  cursor: 'pointer',
  padding: '8px 14px',
};