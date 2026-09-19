import React from 'react';

interface SidebarHeaderProps {
  title: string;
  iconPath?: string;
  rightContent?: React.ReactNode;
}

export const SidebarHeaderUserControl: React.FC<SidebarHeaderProps> = ({
  title,
  iconPath,
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
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
        {iconPath && (
          <svg
            viewBox="0 0 24 24"
            width={28}
            height={28}
            fill="#FFFFFF"
            style={{ marginRight: 10, flexShrink: 0 }}
          >
            <path d={iconPath} />
          </svg>
        )}
        <span
          style={{
            color: '#FFFFFF',
            fontSize: 25,
            fontWeight: 800,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </span>
      </div>

      {rightContent && (
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
          {rightContent}
        </div>
      )}
    </div>
  );
};