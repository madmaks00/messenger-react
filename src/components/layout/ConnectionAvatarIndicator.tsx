import { mdiLoading, mdiServerNetworkOff, mdiWifiOff } from '@mdi/js';
import type { ConnectionStatus } from '../../stores/connectionStatusStore';
import './connection-avatar.css';

export const connectionLabels = {
  connected: 'Соединение установлено', offline: 'Нет подключения к интернету',
  reconnecting: 'Переподключение к серверу…', unavailable: 'Нет связи с сервером. Повторяем подключение…',
};
export function ConnectionAvatarIndicator({ status }: { status: ConnectionStatus }) {
  if (status === 'connected') return null;
  const path = status === 'offline' ? mdiWifiOff : status === 'unavailable' ? mdiServerNetworkOff : mdiLoading;
  return <div className={`connection-avatar connection-avatar--${status}`} role="status" aria-live="polite" aria-label={connectionLabels[status]} title={connectionLabels[status]}>
    <svg className="connection-avatar__ring" viewBox="0 0 54 54" aria-hidden="true">
      <circle cx="27" cy="27" r="26" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.22" />
      <circle className="connection-avatar__arc" cx="27" cy="27" r="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="100 64" />
    </svg>
    <span className="connection-avatar__badge"><svg className={status === 'reconnecting' ? 'connection-avatar__spinner' : ''} width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={path}/></svg></span>
  </div>;
}
