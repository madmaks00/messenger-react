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
        height: 46, // WPF: Height="46"
        margin: '7px 6px 5px 15px', // WPF: Margin="15,7,6,5"
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
            color: '#FFFFFF', // SidebarMainTitleBrush
            fontSize: 25, // WPF: FontSize="25"
            fontWeight: 800, // WPF: FontWeight="ExtraBold"
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