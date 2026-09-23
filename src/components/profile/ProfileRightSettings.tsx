import React, { useState, useEffect, useRef } from 'react';
import { PrivacyVisibility } from '../../types/enums';
import { PrivacySettingsDto } from '../../types/dtos';
import { getAvatarColor, getFirstLetter, formatDateTime, parsePrivacyVisibility } from './profileView.utils';
import { useProfileView } from './useProfileView';
import { Theme } from './profile.theme';
import { Icons } from './ProfileIcons';

interface ProfileRightSettingsProps {
  vm: ReturnType<typeof useProfileView>;
  onClose: () => void;
  onTerminateSession: (deviceId: number) => void;
  onTerminateOtherSessions: () => void;
  onUnblockUser: (userId: number) => void;
}

export const ProfileRightSettings: React.FC<ProfileRightSettingsProps> = ({
  vm,
  onClose,
  onTerminateSession,
  onTerminateOtherSessions,
  onUnblockUser,
}) => {
  const {
    currentSettingsSubPanel,
    setCurrentSettingsSubPanel,
    privacySettings,
    passcodeButtonText,
    passcode1,
    setPasscode1,
    passcode2,
    setPasscode2,
    blockedUsersList,
    setBlockedUsersList,
    isChangePasswordStep1,
    setIsChangePasswordStep1,
    currentPasswordInput,
    setCurrentPasswordInput,
    newPasswordInput,
    setNewPasswordInput,
    confirmPasswordInput,
    setConfirmPasswordInput,
    passwordErrorMessage,
    currentDevice,
    otherDevices,
    availableCameras,
    availableMicrophones,
    availableSpeakers,
    selectedCamera,
    setSelectedCamera,
    selectedMicrophone,
    setSelectedMicrophone,
    selectedSpeaker,
    setSelectedSpeaker,
    speakerVolume,
    setSpeakerVolume,
    micSensitivity,
    setMicSensitivity,
    handlePrivacyChange,
    handleVerifyCurrentPassword,
    handleSaveNewPassword,
    handleSavePasscode,
    handleRemovePasscode,
    openDevicesSubPanel,
    openSpeakersCameraSubPanel,
    openBlockedUsersSubPanel,
  } = vm;

  const [passcodeError, setPasscodeError] = useState<string>('');
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  
  // 🟢 Динамические пропорции камеры (по умолчанию 16:9)
  const [cameraAspectRatio, setCameraAspectRatio] = useState<number>(16 / 9);

  // Живое превью выбранной веб-камеры с привязкой реального потока
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isMounted = true;

    if (currentSettingsSubPanel === 'speakersCamera' && selectedCamera) {
      (async () => {
        try {
          let constraints: MediaStreamConstraints = { video: true };

          if (navigator?.mediaDevices?.enumerateDevices) {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const matched = devices.find(
              (d) => d.kind === 'videoinput' && d.label.trim() === selectedCamera.trim()
            );
            if (matched && matched.deviceId) {
              constraints = {
                video: { deviceId: { exact: matched.deviceId } },
              };
            }
          }

          let stream: MediaStream;
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          }

          if (!isMounted) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          activeStream = stream;
          setCameraStream(stream);

          if (cameraVideoRef.current) {
            cameraVideoRef.current.srcObject = stream;
            cameraVideoRef.current.play().catch(() => {});
          }
        } catch (err) {
          console.warn('[Camera Preview] Ошибка запуска видеопотока:', err);
          if (isMounted) {
            setCameraStream(null);
          }
        }
      })();
    } else {
      setCameraStream(null);
    }

    return () => {
      isMounted = false;
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [currentSettingsSubPanel, selectedCamera]);

  useEffect(() => {
    if (cameraVideoRef.current && cameraStream) {
      cameraVideoRef.current.srcObject = cameraStream;
      cameraVideoRef.current.play().catch(() => {});
    }
  }, [cameraStream]);

  const onSavePasscodeClick = () => {
    if (passcode1.length !== 4) {
      setPasscodeError('Passcode must be exactly 4 digits.');
      return;
    }
    if (passcode1 !== passcode2) {
      setPasscodeError('Passcodes do not match.');
      return;
    }
    setPasscodeError('');
    handleSavePasscode();
  };

  const handleCameraChange = (cam: string) => {
    setSelectedCamera(cam);
    localStorage.setItem('selected_camera', cam);
  };

  const handleMicChange = (mic: string) => {
    setSelectedMicrophone(mic);
    localStorage.setItem('selected_microphone', mic);
  };

  const handleSpeakerChange = (spk: string) => {
    setSelectedSpeaker(spk);
    localStorage.setItem('selected_speaker', spk);
  };

  const handleVolumeChange = (vol: number) => {
    setSpeakerVolume(vol);
    localStorage.setItem('speaker_volume', vol.toString());
  };

  const handleSensitivityChange = (sens: number) => {
    setMicSensitivity(sens);
    localStorage.setItem('mic_sensitivity', sens.toString());
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ДИНАМИЧЕСКАЯ ШАПКА НАСТРОЕК */}
      <div style={rightHeaderStyle}>
        {currentSettingsSubPanel === 'main' ? (
          <span style={{ fontSize: 26, fontWeight: 800, color: Theme.MainWindowText }}>Settings</span>
        ) : (
          <button
            onClick={() => setCurrentSettingsSubPanel('main')}
            style={{
              background: 'none',
              border: 'none',
              color: Theme.ProfileSectionLabel,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 0,
            }}
          >
            <Icons.ArrowLeft size={20} color={Theme.ProfileSectionLabel} />
            <span>Back to Settings</span>
          </button>
        )}
        <CloseButton onClick={onClose} />
      </div>

      <div className="wpf-scroll-viewer" style={{ flex: 1, padding: '0 25px 24px 25px' }}>
        {/* ================= 1. ГЛАВНЫЙ СПИСОК НАСТРОЕК ================= */}
        {currentSettingsSubPanel === 'main' && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={labelStyle}>ACCOUNT SETTINGS</div>
            <div style={settingsCardStyle}>
              <SettingsRowItem
                icon={<Icons.ShieldAccountOutline size={20} color={Theme.ProfileInfoIconBirthday} />}
                title="Privacy & Security"
                subtitle="Manage visibility, blocking, and security alerts"
                onClick={() => setCurrentSettingsSubPanel('privacy')}
              />

              <SettingsRowItem
                icon={<Icons.KeyOutline size={20} color={Theme.ProfileInfoIconName} />}
                title="Change Password"
                subtitle="Update your account password"
                onClick={() => {
                  setIsChangePasswordStep1(true);
                  setCurrentSettingsSubPanel('changePassword');
                }}
              />

              <SettingsRowItem
                icon={<Icons.MonitorCellphone size={20} color={Theme.RoomIconSpotlight} />}
                title="Devices"
                subtitle="Manage your active sessions and devices"
                onClick={openDevicesSubPanel}
                isLast
              />
            </div>

            <div style={labelStyle}>APP SETTINGS</div>
            <div style={settingsCardStyle}>
              <SettingsRowItem
                icon={<Icons.VolumeHigh size={20} color={Theme.ProfileInfoIconName} />}
                title="Speakers & Camera"
                subtitle="Configure speakers, microphone, and camera settings"
                onClick={openSpeakersCameraSubPanel}
              />

              <SettingsRowItem
                icon={<Icons.PaletteOutline size={20} color={Theme.AppAccent} />}
                title="App Theme"
                subtitle="Select light or dark mode"
              />

              <SettingsRowItem
                icon={<Icons.Web size={20} color={Theme.RoomIconSpotlight} />}
                title="Language"
                subtitle="Application display language"
                onClick={() => setCurrentSettingsSubPanel('language')}
                isLast
              />
            </div>
          </div>
        )}

        {/* Подраздел: Privacy & Security */}
        {currentSettingsSubPanel === 'privacy' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={labelStyle}>PRIVACY &amp; SECURITY SETTINGS</div>
            {[
              { label: 'Last Seen & Online', key: 'lastSeenVisibility' },
              { label: 'Profile Photo', key: 'avatarVisibility' },
              { label: 'Email Visibility', key: 'emailVisibility' },
              { label: 'Phone Visibility', key: 'phoneVisibility' },
              { label: 'Full Name', key: 'fullNameVisibility' },
              { label: 'Gender Visibility', key: 'genderVisibility' },
              { label: 'Date of Birth', key: 'birthdayVisibility' },
              { label: 'About Me (Bio)', key: 'descriptionVisibility' },
            ].map((item) => (
              <div key={item.key} style={settingRowStyle}>
                <span style={{ fontSize: 14, fontWeight: 600, color: Theme.MainWindowText }}>{item.label}</span>
                <select
                  value={parsePrivacyVisibility((privacySettings as any)[item.key])}
                  onChange={(e) =>
                    handlePrivacyChange(item.key as keyof PrivacySettingsDto, Number(e.target.value) as PrivacyVisibility)
                  }
                  style={selectStyle}
                >
                  <option value={PrivacyVisibility.Everybody}>Everybody</option>
                  <option value={PrivacyVisibility.MyContacts}>My Contacts</option>
                  <option value={PrivacyVisibility.Nobody}>Nobody</option>
                </select>
              </div>
            ))}

            <div style={{ ...labelStyle, marginTop: 15 }}>SECURITY &amp; BLOCKING</div>
            <div style={settingRowStyle}>
              <span style={{ fontSize: 14, fontWeight: 600, color: Theme.MainWindowText }}>Local Passcode Lock</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {passcodeButtonText === 'Change Code' && (
                  <button onClick={handleRemovePasscode} style={{ ...smallActionBtn, color: Theme.ProfileDestructiveAction }}>
                    Disable
                  </button>
                )}
                <button onClick={() => setCurrentSettingsSubPanel('passcodeSetup')} style={smallActionBtn}>
                  {passcodeButtonText}
                </button>
              </div>
            </div>

            <div style={settingRowStyle}>
              <span style={{ fontSize: 14, fontWeight: 600, color: Theme.MainWindowText }}>Blocked Users</span>
              <button onClick={openBlockedUsersSubPanel} style={smallActionBtn}>
                Manage
              </button>
            </div>
          </div>
        )}

        {/* Подраздел: Blocked Users */}
        {currentSettingsSubPanel === 'blockedUsers' && (
          <div>
            <div style={labelStyle}>BLOCKED USERS</div>
            {blockedUsersList.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {blockedUsersList.map((bu) => (
                  <div key={bu.id} style={mediaRowCardStyle}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: getAvatarColor(bu.id),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFF',
                        fontWeight: 'bold',
                      }}
                    >
                      {getFirstLetter(bu.nickName)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: Theme.MainWindowText, fontWeight: 600, fontSize: 14 }}>{bu.nickName}</div>
                      <div style={{ color: Theme.ProfileSectionLabel, fontSize: 12 }}>@{bu.username}</div>
                    </div>
                    <button
                      onClick={() => {
                        onUnblockUser(bu.id);
                        setBlockedUsersList(blockedUsersList.filter((u) => u.id !== bu.id));
                      }}
                      style={{ ...smallActionBtn, color: Theme.ProfileDestructiveAction }}
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: Theme.ProfileSectionLabel, marginTop: 40, fontSize: 14 }}>
                No blocked users
              </div>
            )}
          </div>
        )}

        {/* Подраздел: Passcode Setup */}
        {currentSettingsSubPanel === 'passcodeSetup' && (
          <div style={subPanelCardStyle}>
            <div style={{ padding: 20 }}>
              <h4 style={{ color: Theme.MainWindowText, margin: '0 0 6px 0', fontSize: 15, fontWeight: 'bold' }}>
                Passcode Protection
              </h4>
              <p style={{ color: Theme.ProfileSectionLabel, fontSize: 12, margin: '0 0 16px 0' }}>
                Set a 4-digit numeric code to protect application access when locked.
              </p>
              {passcodeError && <div style={{ ...errorStyle, marginBottom: 12 }}>{passcodeError}</div>}

              <div style={{ marginBottom: 14 }}>
                <div style={labelStyle}>ENTER 4 DIGITS</div>
                <input
                  type="password"
                  maxLength={4}
                  value={passcode1}
                  onChange={(e) => setPasscode1(e.target.value.replace(/\D/g, ''))}
                  style={{ ...cardInputStyle, fontSize: 20, letterSpacing: 8, textAlign: 'center' }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={labelStyle}>REPEAT 4 DIGITS</div>
                <input
                  type="password"
                  maxLength={4}
                  value={passcode2}
                  onChange={(e) => setPasscode2(e.target.value.replace(/\D/g, ''))}
                  style={{ ...cardInputStyle, fontSize: 20, letterSpacing: 8, textAlign: 'center' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={() => setCurrentSettingsSubPanel('privacy')} style={secondaryBtnStyle}>
                  Cancel
                </button>
                <button onClick={onSavePasscodeClick} style={primaryBtnStyle}>
                  Save Passcode
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Подраздел: Change Password */}
        {currentSettingsSubPanel === 'changePassword' && (
          <div style={subPanelCardStyle}>
            <div style={{ padding: 20 }}>
              <h4 style={{ color: Theme.MainWindowText, margin: '0 0 6px 0', fontSize: 15, fontWeight: 'bold' }}>
                Change Account Password
              </h4>
              <p style={{ color: Theme.ProfileSectionLabel, fontSize: 12, margin: '0 0 16px 0' }}>
                {isChangePasswordStep1
                  ? 'Please enter your current account password to verify your identity.'
                  : 'Your new password must be at least 8 characters with digits, upper and lowercase letters.'}
              </p>
              {passwordErrorMessage && <div style={{ ...errorStyle, marginBottom: 14 }}>{passwordErrorMessage}</div>}

              {isChangePasswordStep1 ? (
                <div>
                  <div style={labelStyle}>CURRENT PASSWORD</div>
                  <input
                    type="password"
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    style={{ ...cardInputStyle, marginBottom: 16 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={handleVerifyCurrentPassword} style={primaryBtnStyle}>
                      Verify Password
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={labelStyle}>NEW PASSWORD</div>
                    <input
                      type="password"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      style={cardInputStyle}
                    />
                  </div>
                  <div>
                    <div style={labelStyle}>CONFIRM NEW PASSWORD</div>
                    <input
                      type="password"
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      style={cardInputStyle}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                    <button onClick={() => setIsChangePasswordStep1(true)} style={secondaryBtnStyle}>
                      Back
                    </button>
                    <button onClick={handleSaveNewPassword} style={primaryBtnStyle}>
                      Update Password
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Подраздел: Devices */}
        {currentSettingsSubPanel === 'devices' && (
          <div>
            <div style={labelStyle}>THIS DEVICE</div>
            {currentDevice && (
              <div style={{ ...mediaRowCardStyle, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: Theme.ProfileDeviceItemBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icons.MonitorCellphone size={22} color={Theme.AppAccent} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: Theme.MainWindowText, fontWeight: 600, fontSize: 14.5 }}>{currentDevice.deviceName}</div>
                  <div style={{ color: Theme.ProfileSectionLabel, fontSize: 12, marginTop: 2 }}>
                    {currentDevice.ipAddress} • {currentDevice.location}
                  </div>
                </div>
                <span style={{ color: '#2EA043', fontWeight: 'bold', fontSize: 12, background: 'rgba(46,160,67,0.15)', padding: '4px 8px', borderRadius: 6 }}>
                  Active Now
                </span>
              </div>
            )}

            <button
              onClick={onTerminateOtherSessions}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 10,
                backgroundColor: Theme.ProfileTerminateSessionsBg,
                color: Theme.ProfileTerminateSessionsText,
                border: `1px solid ${Theme.ProfileTerminateSessionsText}33`,
                fontWeight: 'bold',
                cursor: 'pointer',
                marginBottom: 20,
              }}
            >
              Terminate All Other Sessions
            </button>

            <div style={labelStyle}>ACTIVE SESSIONS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {otherDevices.map((dev) => (
                <div key={dev.id} style={mediaRowCardStyle}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: Theme.ProfileDeviceItemBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icons.MonitorCellphone size={22} color={Theme.ProfileSectionLabel} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: Theme.MainWindowText, fontWeight: 600, fontSize: 14 }}>{dev.deviceName}</div>
                    <div style={{ color: Theme.ProfileSectionLabel, fontSize: 12, marginTop: 2 }}>
                      {dev.ipAddress} • {dev.location} • {formatDateTime(dev.lastActive)}
                    </div>
                  </div>
                  <button onClick={() => onTerminateSession(dev.id)} style={iconBtnStyle} title="Terminate Session">
                    <Icons.Close size={18} color={Theme.ProfileDestructiveAction} />
                  </button>
                </div>
              ))}
              {otherDevices.length === 0 && (
                <div style={{ textAlign: 'center', color: Theme.ProfileSectionLabel, fontSize: 13, marginTop: 12 }}>
                  No other active sessions
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= 2. SPEAKERS & CAMERA ================= */}
        {currentSettingsSubPanel === 'speakersCamera' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* ДИНАМИКИ / НАУШНИКИ */}
            <div style={settingCardStyle}>
              <div style={labelStyle}>SPEAKERS (OUTPUT)</div>
              <select
                value={selectedSpeaker}
                onChange={(e) => handleSpeakerChange(e.target.value)}
                style={selectStyleFull}
              >
                {availableSpeakers.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                <span style={{ fontSize: 16 }}>🔊</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={speakerVolume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  style={{ flex: 1, accentColor: Theme.AppAccent }}
                />
                <span style={{ fontSize: 12, color: Theme.ProfileSectionLabel, minWidth: 32 }}>{speakerVolume}%</span>
              </div>
            </div>

            {/* МИКРОФОН */}
            <div style={settingCardStyle}>
              <div style={labelStyle}>MICROPHONE (INPUT)</div>
              <select
                value={selectedMicrophone}
                onChange={(e) => handleMicChange(e.target.value)}
                style={selectStyleFull}
              >
                {availableMicrophones.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                <span style={{ fontSize: 16 }}>🎤</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={micSensitivity}
                  onChange={(e) => handleSensitivityChange(Number(e.target.value))}
                  style={{ flex: 1, accentColor: Theme.AppAccent }}
                />
                <span style={{ fontSize: 12, color: Theme.ProfileSectionLabel, minWidth: 32 }}>{micSensitivity}%</span>
              </div>
            </div>

            {/* КАМЕРА: увеличенный размер по пропорциям видеопотока (16:9 / 4:3) */}
            <div style={settingCardStyle}>
              <div style={labelStyle}>CAMERA</div>
              <select
                value={selectedCamera}
                onChange={(e) => handleCameraChange(e.target.value)}
                style={selectStyleFull}
              >
                {availableCameras.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <div
                style={{
                  width: '100%',
                  aspectRatio: `${cameraAspectRatio}`,
                  maxHeight: 270,
                  backgroundColor: Theme.ProfileEditContainerBg,
                  borderRadius: 8,
                  border: `1px solid ${Theme.ProfileInputContainerBorder}`,
                  marginTop: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                  boxSizing: 'border-box',
                }}
              >
                {/* Видео подстраивает реальные пропорции через onLoadedMetadata */}
                <video
                  ref={cameraVideoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    if (v.videoWidth && v.videoHeight) {
                      setCameraAspectRatio(v.videoWidth / v.videoHeight);
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: cameraStream ? 'block' : 'none',
                    transform: 'scaleX(-1)',
                  }}
                />

                {!cameraStream && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <Icons.VideoOutline size={36} color={Theme.ProfileSectionLabel} />
                    <span style={{ color: Theme.ProfileSectionLabel, fontSize: 12 }}>
                      Camera Preview is Active
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Подраздел: Language */}
        {currentSettingsSubPanel === 'language' && (
          <div>
            <div style={labelStyle}>LANGUAGE PREFERENCES</div>
            <div style={settingRowStyle}>
              <span style={{ fontSize: 14, fontWeight: 600, color: Theme.MainWindowText }}>App Language</span>
              <select style={selectStyle}>
                <option value="en">English</option>
                <option value="ru">Русский</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const CloseButton: React.FC<{ onClick: () => void; title?: string }> = ({
  onClick,
  title = 'Close Profile',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={title}
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: isHovered ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transition: 'all 0.15s ease-out',
      }}
    >
      <Icons.Close size={20} color={isHovered ? '#FFFFFF' : Theme.ProfileSectionLabel} />
    </button>
  );
};

interface SettingsRowItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick?: () => void;
  isLast?: boolean;
}

const SettingsRowItem: React.FC<SettingsRowItemProps> = ({
  icon,
  title,
  subtitle,
  onClick,
  isLast = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr 24px',
        alignItems: 'center',
        gap: 15,
        marginBottom: isLast ? 0 : 15,
        cursor: 'pointer',
        background: 'transparent',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: Theme.ProfileDeviceItemBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ color: Theme.MainWindowText, fontSize: 14, fontWeight: 600 }}>
          {title}
        </span>
        <span style={{ color: Theme.ProfileSectionLabel, fontSize: 12 }}>
          {subtitle}
        </span>
      </div>

      <Icons.ChevronRight
        size={24}
        color={isHovered ? '#FFFFFF' : Theme.ProfileSectionLabel}
      />
    </div>
  );
};

const rightHeaderStyle: React.CSSProperties = {
  height: 64,
  padding: '0 25px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 17,
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
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 'bold',
  color: Theme.ProfileSectionLabel,
  marginBottom: 10,
};

const errorStyle: React.CSSProperties = {
  color: Theme.ProfileValidationError,
  fontSize: 11,
};

const cardInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: Theme.ProfileInputContainerBg,
  border: `1px solid ${Theme.ProfileInputContainerBorder}`,
  borderRadius: 10,
  color: Theme.ProfileInputText,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  width: 140,
  padding: '8px 12px',
  background: Theme.ProfileComboBoxDropdownBg,
  border: `1px solid ${Theme.ProfileInputContainerBorder}`,
  borderRadius: 8,
  color: Theme.ProfileComboBoxDropdownText,
  fontSize: 13,
  outline: 'none',
};

const selectStyleFull: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: Theme.ProfileComboBoxDropdownBg,
  border: `1px solid ${Theme.ProfileInputContainerBorder}`,
  borderRadius: 8,
  color: Theme.ProfileComboBoxDropdownText,
  fontSize: 13,
  outline: 'none',
};

const settingsCardStyle: React.CSSProperties = {
  backgroundColor: Theme.ProfileInputContainerBg,
  border: `1px solid ${Theme.ProfileInputContainerBorder}`,
  borderRadius: 12,
  padding: 15,
  marginBottom: 25,
};

const subPanelCardStyle: React.CSSProperties = {
  background: Theme.ProfileInputContainerBg,
  borderRadius: 12,
  border: `1px solid ${Theme.ProfileInputContainerBorder}`,
  overflow: 'hidden',
};

const settingCardStyle: React.CSSProperties = {
  background: Theme.ProfileInputContainerBg,
  borderRadius: 12,
  border: `1px solid ${Theme.ProfileInputContainerBorder}`,
  padding: 16,
};

const settingRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 16px',
  background: Theme.ProfileInputContainerBg,
  border: `1px solid ${Theme.ProfileInputContainerBorder}`,
  borderRadius: 10,
};

const mediaRowCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  background: Theme.ProfileInputContainerBg,
  border: `1px solid ${Theme.ProfileInputContainerBorder}`,
  borderRadius: 10,
};

const smallActionBtn: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 8,
  background: Theme.ProfileDeviceItemBg,
  color: '#FFF',
  border: 'none',
  fontSize: 12.5,
  cursor: 'pointer',
  fontWeight: 600,
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 8,
  background: Theme.AppAccent,
  color: '#FFF',
  border: 'none',
  fontSize: 13.5,
  fontWeight: 'bold',
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 8,
  background: 'transparent',
  color: Theme.ProfileSectionLabel,
  border: 'none',
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
};