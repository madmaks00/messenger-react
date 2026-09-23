import React from 'react';
import { AttachmentType } from '../../types/enums';
import { IAttachment, IMessage, MessageHelper } from '../../types/models';
import { formatDate, formatDateTime, isGifAttachment, normalizeImageSrc } from './profileView.utils';
import { useProfileView } from './useProfileView';
import { Theme } from './profile.theme';
import { Icons } from './ProfileIcons';

interface ProfileRightSharedMediaProps {
  vm: ReturnType<typeof useProfileView>;
  onClose: () => void;
  onForwardMessages: (messages: IMessage[]) => void;
  onDeleteMessage: (message: IMessage) => void;
  onOpenFile: (attachment: IAttachment) => void;
}

export const ProfileRightSharedMedia: React.FC<ProfileRightSharedMediaProps> = ({
  vm,
  onClose,
  onForwardMessages,
  onDeleteMessage,
  onOpenFile,
}) => {
  const {
    sharedMediaTitle,
    selectedSharedMediaType,
    sharedAttachmentGroups,
    sharedPinnedGroups,
    isSharedMediaLoading,
    isSelectionMode,
    selectedCount,
    handleCancelSelection,
    handleSharedItemClick,
    getSelectedMessagesList,
    collapseRightPanel,
    setActiveContextMenu,
  } = vm;

  const totalItemsCount =
    selectedSharedMediaType === 'Pinned' || selectedSharedMediaType === 'Links'
      ? sharedPinnedGroups.reduce((acc, g) => acc + g.items.length, 0)
      : sharedAttachmentGroups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Шапка панели общих медиа */}
      <div style={rightHeaderStyle}>
        {!isSelectionMode ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={collapseRightPanel} style={iconBtnStyle} title="Back to Profile">
                <Icons.ArrowLeft size={20} color={Theme.ProfileSectionLabel} />
              </button>
              <span style={{ fontSize: 26, fontWeight: 800, color: Theme.MainWindowText }}>
                {sharedMediaTitle}
              </span>
            </div>
            <button onClick={onClose} style={iconBtnStyle} title="Close Profile">
              <Icons.Close size={20} color={Theme.MainWindowText} />
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={handleCancelSelection} style={iconBtnStyle} title="Cancel">
                <Icons.Close size={20} color={Theme.MainWindowText} />
              </button>
              <span style={{ fontSize: 18, fontWeight: 'bold', color: Theme.MainWindowText }}>
                Selected: {selectedCount}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => onForwardMessages(getSelectedMessagesList())} style={forwardBtnStyle}>
                Forward
              </button>
              <button
                onClick={() => {
                  getSelectedMessagesList().forEach((m) => onDeleteMessage(m));
                  handleCancelSelection();
                }}
                style={deleteBtnStyle}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>

      {/* Контент с группировкой по месяцам */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 25px 24px 25px' }}>
        {/* Фото, Видео, GIF */}
        {['Photos', 'Videos', 'GIFs'].includes(selectedSharedMediaType) &&
          sharedAttachmentGroups.map((group) => (
            <div key={group.title} style={{ marginBottom: 20 }}>
              <h4 style={{ color: Theme.MainWindowText, margin: '0 0 10px 0', fontSize: 16, fontWeight: 'bold' }}>
                {group.title}
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {group.items.map((att) => {
                  const mediaSrc = normalizeImageSrc(att.thumbnailUrl || att.url || att.localThumbnailPath || att.localImagePath);

                  return (
                    <div
                      key={att.id}
                      onClick={() => handleSharedItemClick(att)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setActiveContextMenu({ x: e.clientX, y: e.clientY, item: att });
                      }}
                      style={{
                        width: 100,
                        height: 100,
                        borderRadius: 12,
                        overflow: 'hidden',
                        position: 'relative',
                        cursor: 'pointer',
                        backgroundColor: Theme.ProfileInputContainerBg,
                      }}
                    >
                      <img
                        src={mediaSrc}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />

                      {/* Оверлей кнопки Play для видео */}
                      {att.type === AttachmentType.Video && !isGifAttachment(att) && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            color: '#FFF',
                          }}
                        >
                          <Icons.PlayCircleOutline size={32} color="#FFF" />
                        </div>
                      )}

                      {/* Бейдж GIF */}
                      {isGifAttachment(att) && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 6,
                            left: 6,
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            padding: '2px 5px',
                            borderRadius: 4,
                            fontSize: 9.5,
                            fontWeight: 'bold',
                            color: '#FFF',
                          }}
                        >
                          GIF
                        </span>
                      )}

                      {/* Оверлей подсветки выделения */}
                      {att.isSelected && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: 'rgba(30, 155, 235, 0.22)',
                          }}
                        />
                      )}

                      {/* Чекбокс мульти-выделения */}
                      {isSelectionMode && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            backgroundColor: att.isSelected ? Theme.AppAccent : 'rgba(0,0,0,0.4)',
                            border: '1.5px solid #FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFF',
                          }}
                        >
                          {att.isSelected && <Icons.CheckBold size={14} color="#FFF" />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

        {/* Аудио и Голосовые */}
        {['Audios', 'Voice'].includes(selectedSharedMediaType) &&
          sharedAttachmentGroups.map((group) => (
            <div key={group.title} style={{ marginBottom: 20 }}>
              <h4 style={{ color: Theme.MainWindowText, margin: '0 0 10px 0', fontSize: 16, fontWeight: 'bold' }}>
                {group.title}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.items.map((att) => (
                  <div
                    key={att.id}
                    onClick={() => handleSharedItemClick(att)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActiveContextMenu({ x: e.clientX, y: e.clientY, item: att });
                    }}
                    style={mediaRowCardStyle}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: Theme.AppAccent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFF',
                        flexShrink: 0,
                      }}
                    >
                      ▶
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: Theme.MainWindowText, fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {att.fileName || (selectedSharedMediaType === 'Voice' ? 'Voice message' : 'Audio Track')}
                      </div>
                      <div style={{ color: Theme.ProfileSectionLabel, fontSize: 12, marginTop: 2 }}>
                        {att.fileSizeStr || 'Audio file'}
                      </div>
                    </div>
                    {!isSelectionMode && (
                      <div style={{ color: Theme.ProfileSectionLabel, fontSize: 11.5 }}>
                        {formatDate((att as any).message?.timestamp)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

        {/* Документы */}
        {selectedSharedMediaType === 'Documents' &&
          sharedAttachmentGroups.map((group) => (
            <div key={group.title} style={{ marginBottom: 20 }}>
              <h4 style={{ color: Theme.MainWindowText, margin: '0 0 10px 0', fontSize: 16, fontWeight: 'bold' }}>
                {group.title}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.items.map((att) => (
                  <div
                    key={att.id}
                    onClick={() => handleSharedItemClick(att)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActiveContextMenu({ x: e.clientX, y: e.clientY, item: att });
                    }}
                    style={mediaRowCardStyle}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        backgroundColor: Theme.AppAccent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFF',
                        flexShrink: 0,
                      }}
                    >
                      <Icons.FileDocumentOutline size={20} color="#FFF" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: Theme.MainWindowText, fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {att.fileName}
                      </div>
                      <div style={{ color: Theme.ProfileSectionLabel, fontSize: 11.5, marginTop: 2 }}>
                        {att.fileSizeStr}
                      </div>
                    </div>
                    {!isSelectionMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFile(att);
                        }}
                        style={iconBtnStyle}
                        title="Download / Open"
                      >
                        ⬇
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

        {/* Ссылки и Закрепленные сообщения */}
        {['Links', 'Pinned'].includes(selectedSharedMediaType) &&
          sharedPinnedGroups.map((group) => (
            <div key={group.title} style={{ marginBottom: 20 }}>
              <h4 style={{ color: Theme.MainWindowText, margin: '0 0 10px 0', fontSize: 16, fontWeight: 'bold' }}>
                {group.title}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.items.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => handleSharedItemClick(msg)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActiveContextMenu({ x: e.clientX, y: e.clientY, item: msg });
                    }}
                    style={mediaRowCardStyle}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        backgroundColor: 'rgba(30, 155, 235, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: Theme.AppAccent,
                        flexShrink: 0,
                      }}
                    >
                      {selectedSharedMediaType === 'Links' ? (
                        <Icons.LinkVariant size={20} color={Theme.AppAccent} />
                      ) : (
                        <Icons.PinOutline size={20} color={Theme.AppAccent} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ color: Theme.AppAccent, fontWeight: 'bold', fontSize: 13 }}>
                          {msg.senderName || 'Sender'}
                        </span>
                        <span style={{ color: Theme.ProfileSectionLabel, fontSize: 11 }}>
                          {formatDateTime(msg.timestamp)}
                        </span>
                      </div>
                      <div style={{ color: Theme.MainWindowText, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(msg as any).previewText || MessageHelper.getPreviewText(msg)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

        {/* Заглушка при отсутствии элементов */}
        {totalItemsCount === 0 && !isSharedMediaLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 60 }}>
            <Icons.ImageMultipleOutline size={56} color={Theme.ProfileNoStoriesIcon} />
            <div style={{ fontSize: 18, fontWeight: 'bold', color: Theme.MainWindowText, margin: '15px 0 6px 0' }}>
              No items found
            </div>
            <div style={{ fontSize: 13, color: Theme.ProfileNoStoriesSubtitle }}>
              Shared media in this chat will appear here
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const rightHeaderStyle: React.CSSProperties = {
  height: 64,
  padding: '0 25px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const iconBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  background: 'transparent',
  border: 'none',
  color: Theme.ProfileSectionLabel,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};

const forwardBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 8,
  background: 'transparent',
  color: Theme.AppAccent,
  border: 'none',
  fontSize: 13,
  fontWeight: 'bold',
  cursor: 'pointer',
};

const deleteBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 8,
  background: 'transparent',
  color: Theme.ProfileDestructiveAction,
  border: 'none',
  fontSize: 13,
  fontWeight: 'bold',
  cursor: 'pointer',
};

const mediaRowCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  background: Theme.ProfileInputContainerBg,
  border: `1px solid ${Theme.ProfileInputContainerBorder}`,
  borderRadius: 10,
  cursor: 'pointer',
  boxSizing: 'border-box',
};