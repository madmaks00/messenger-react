// Normal sends and queue recovery share a lock for the same local message.
const active = new Set<string>();
export function beginMessageSend(userId: number, localId: number): (() => void) | null {
  const key = `${userId}:${localId}`;
  if (active.has(key)) return null;
  active.add(key);
  return () => { active.delete(key); };
}
