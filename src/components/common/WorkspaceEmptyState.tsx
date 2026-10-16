interface WorkspaceEmptyStateProps {
  iconPath: string;
  text: string;
  background?: string;
  surface?: string;
}

export function WorkspaceEmptyState({ iconPath, text, background = 'var(--surface-recessed, #11141B)', surface = 'var(--surface-control, #1C212D)' }: WorkspaceEmptyStateProps) {
  return <div style={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background, userSelect: 'none' }}>
    <div className="workspace-empty-state" title={text} style={{
      height: 42.4, maxWidth: 'calc(100% - 32px)', boxSizing: 'border-box',
      padding: '10px 20px', borderRadius: 20, background: surface,
      border: '1.2px solid var(--border-primary, #2A303C)', color: 'var(--text-body, #FFFFFF)', fontSize: 15,
      fontWeight: 600, lineHeight: '20px', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <svg viewBox="0 0 24 24" width={20} height={20} fill="var(--app-accent, #1E9BEB)" style={{ flexShrink: 0 }} aria-hidden="true"><path d={iconPath}/></svg>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
    </div>
  </div>;
}
