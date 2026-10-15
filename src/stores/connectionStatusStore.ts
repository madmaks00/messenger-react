import { create } from 'zustand';

export type ConnectionPhase = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'unavailable';
export type ConnectionStatus = 'connected' | 'offline' | 'reconnecting' | 'unavailable';
export function resolveConnectionStatus(isOnline: boolean, phase: ConnectionPhase): ConnectionStatus {
  if (!isOnline) return 'offline';
  if (phase === 'connected') return 'connected';
  return phase === 'unavailable' ? 'unavailable' : 'reconnecting';
}
export const useConnectionStatusStore = create<{
  isOnline: boolean; phase: ConnectionPhase;
  setPhase: (phase: ConnectionPhase) => void;
}>((set) => ({ isOnline: navigator.onLine, phase: 'idle', setPhase: phase => set({ phase }) }));
window.addEventListener('offline', () => useConnectionStatusStore.setState({ isOnline: false }));
window.addEventListener('online', () => useConnectionStatusStore.setState({ isOnline: true }));
