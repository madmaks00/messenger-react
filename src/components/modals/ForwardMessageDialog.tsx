import React, { useState } from 'react';
import { useSidebarChatsStore } from '../../stores/sidebarChatsStore';

interface ForwardMessageDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: (selectedChatIds: number[]) => void;
}

export const ForwardMessageDialog: React.FC<ForwardMessageDialogProps> = ({
  isOpen,
  onCancel,
  onConfirm,
}) => {
  const { allChats } = useSidebarChatsStore();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  if (!isOpen) return null;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
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
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 340,
          backgroundColor: '#1E2330',
          borderRadius: 12,
          padding: '16px 0',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
          border: '1px solid #334155',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 460,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 600, color: '#FFF', padding: '0 20px 15px 20px' }}>
          Forward to...
        </div>

        {/* Список чатов с чекбоксами */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px' }}>
          {allChats.map((chat) => {
            const chatId = (chat.isGroup ? chat.groupId : chat.userId) || 0;
            const isSelected = selectedIds.includes(chatId);
            const chatType = chat.isChannel ? 'Channel' : chat.isGroup ? 'Group' : 'Personal';

            return (
              <div
                key={chat.id || chatId}
                onClick={() => toggleSelect(chatId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  marginBottom: 2,
                }}
              >
                {/* Аватарка с галочкой */}
                <div style={{ position: 'relative', width: 40, height: 40, marginRight: 12 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: '#3B82F6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFF',
                      fontWeight: 'bold',
                      fontSize: 14,
                      overflow: 'hidden',
                    }}
                  >
                    {chat.avatarPath ? (
                      <img src={chat.avatarPath} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      (chat.isGroup ? chat.groupName : chat.nickName || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  {/* Зеленая галочка выбора */}
                  {isSelected && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: '#22C55E',
                        border: '2px solid #1E2330',
                        color: '#FFF',
                        fontSize: 10,
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ✓
                    </div>
                  )}
                </div>

                {/* Имя и тип чата */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#FFF', fontSize: 15, fontWeight: 600, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    {chat.isGroup ? chat.groupName : chat.nickName}
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: 12 }}>{chatType}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Кнопки */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '15px 20px 0 20px' }}>
          <button
            onClick={onCancel}
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 14, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedIds)}
            disabled={selectedIds.length === 0}
            style={{
              background: 'transparent',
              border: 'none',
              color: selectedIds.length > 0 ? 'var(--app-accent, #3B82F6)' : '#64748B',
              fontSize: 14,
              fontWeight: 'bold',
              cursor: selectedIds.length > 0 ? 'pointer' : 'default',
            }}
          >
            Forward
          </button>
        </div>
      </div>
    </div>
  );
};