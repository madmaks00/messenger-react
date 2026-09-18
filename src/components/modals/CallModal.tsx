import React from 'react';
import { useCallStore } from '../../stores/callStore';
import { AudioMetadataHelper } from '../../utils/mediaFormatHelper';

export const CallModal: React.FC = () => {
  const {
    callState,
    targetUserName,
    targetUserAvatar,
    durationSeconds,
    isMuted,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
  } = useCallStore();

  if (callState === 'idle') return null;

  const formattedTime = AudioMetadataHelper.formatDuration(durationSeconds);

  return (
    <div style={callOverlayStyle}>
      {/* 1. КАРТОЧКА ВХОДЯЩЕГО ЗВОНКА */}
      {callState === 'incoming' && (
        <div style={callCardStyle}>
          <div style={avatarStyle}>
            {targetUserAvatar ? (
              <img src={targetUserAvatar} alt="" style={{ width: '100%', height: '100%', borderRadius: 40, objectFit: 'cover' }} />
            ) : (
              targetUserName.charAt(0).toUpperCase()
            )}
          </div>
          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#F8FAFC' }}>{targetUserName}</div>
          <div style={{ fontSize: 13, color: '#38BDF8', marginTop: 4 }}>Incoming Call...</div>

          <div style={{ display: 'flex', gap: 24, marginTop: 24 }}>
            <button onClick={rejectCall} style={{ ...circleActionBtnStyle, background: '#EF4444' }} title="Decline">
              ✕
            </button>
            <button onClick={acceptCall} style={{ ...circleActionBtnStyle, background: '#22C55E' }} title="Accept">
              📞
            </button>
          </div>
        </div>
      )}

      {/* 2. АКТИВНЫЙ / ИСХОДЯЩИЙ ЗВОНОК */}
      {(callState === 'outgoing' || callState === 'connected') && (
        <div style={callCardStyle}>
          <div style={{ position: 'relative', margin: '0 auto 16px' }}>
            <div style={avatarStyle}>
              {targetUserAvatar ? (
                <img src={targetUserAvatar} alt="" style={{ width: '100%', height: '100%', borderRadius: 40, objectFit: 'cover' }} />
              ) : (
                targetUserName.charAt(0).toUpperCase()
              )}
            </div>
            {callState === 'connected' && <div style={pulsingRingStyle} />}
          </div>

          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#F8FAFC' }}>{targetUserName}</div>
          <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
            {callState === 'outgoing' ? 'Calling...' : formattedTime}
          </div>

          <div style={{ display: 'flex', gap: 20, marginTop: 28 }}>
            <button
              onClick={toggleMute}
              style={{
                ...circleActionBtnStyle,
                background: isMuted ? '#EF4444' : '#334155',
              }}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>
            <button onClick={endCall} style={{ ...circleActionBtnStyle, background: '#EF4444' }} title="End call">
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const callOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.75)',
  backdropFilter: 'blur(6px)',
  zIndex: 99999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const callCardStyle: React.CSSProperties = {
  background: '#1E293B',
  border: '1px solid #334155',
  borderRadius: 24,
  padding: '32px 40px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
  minWidth: 260,
};

const avatarStyle: React.CSSProperties = {
  width: 80,
  height: 80,
  borderRadius: 40,
  background: '#3B82F6',
  color: '#FFFFFF',
  fontSize: 32,
  fontWeight: 'bold',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 12,
};

const circleActionBtnStyle: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 26,
  border: 'none',
  color: '#FFFFFF',
  fontSize: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
};

const pulsingRingStyle: React.CSSProperties = {
  position: 'absolute',
  inset: -6,
  borderRadius: 46,
  border: '2px solid #22C55E',
  animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
};