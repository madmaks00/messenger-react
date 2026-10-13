import React, { useRef, useState, useEffect } from 'react';
import './dialogs.css';

// Keep the last open render intact until the exit animation finishes.
// The owning dialog retains its mounted state for the same 100 ms.
export function DialogFrame({ isOpen, kind, children }: {
  isOpen: boolean; kind: string; children: React.ReactNode;
}) {
  const lastOpenContent = useRef(children);
  if (isOpen) lastOpenContent.current = children;
  return <div className={`app-dialog app-dialog-${kind} ${isOpen ? 'is-open' : 'is-closing'}`}
    aria-hidden={!isOpen}>
    {isOpen ? children : lastOpenContent.current}
  </div>;
}

export function useDialogPresence(isOpen: boolean) {
  const [mounted, setMounted] = useState(isOpen);
  useEffect(() => {
    if (isOpen) { setMounted(true); return; }
    const timer = setTimeout(() => setMounted(false), 100);
    return () => clearTimeout(timer);
  }, [isOpen]);
  return mounted || isOpen;
}
