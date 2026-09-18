// src/components/common/SidebarHeaderUserControl.tsx
import React from 'react';

interface SidebarHeaderProps {
  title: string;
  iconKind?: string;
  rightContent?: React.ReactNode;
}

export const SidebarHeaderUserControl: React.FC<SidebarHeaderProps> = ({
  title,
  iconKind,
  rightContent,
}) => {
  return (
    <div
      style={{
        height: 46,
        margin: '7px 6px 5px 15px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {iconKind && <span style={{ fontSize: 24 }}>📑</span>}
        <h2 style={{ fontSize: 25, fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
          {title}
        </h2>
      </div>

      {rightContent && <div>{rightContent}</div>}
    </div>
  );
};