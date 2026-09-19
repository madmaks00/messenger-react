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
        height: 42,
        margin: '12px 6px 8px 15px',
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
            width={26}
            height={26}
            fill="#FFFFFF"
            style={{ marginRight: 9, flexShrink: 0 }}
          >
            <path d={iconPath} />
          </svg>
        )}
        <span
          style={{
            color: '#FFFFFF',
            fontSize: 24,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: '-0.2px',
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

export default SidebarHeaderUserControl;