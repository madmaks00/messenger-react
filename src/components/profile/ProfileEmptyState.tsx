import React from 'react';
import { Theme } from './profile.theme';
import { Icons } from './ProfileIcons';

interface ProfileEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle: string;
}

export const ProfileEmptyState: React.FC<ProfileEmptyStateProps> = ({
  icon,
  title,
  subtitle,
}) => {
  return (
    <div
      style={{
        width: '100%',
        minHeight: 480,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        padding: '30px 20px',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon || <Icons.ImageMultipleOutline size={56} color={Theme.ProfileNoStoriesIcon} />}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 'bold',
          color: Theme.MainWindowText,
          margin: '16px 0 6px 0',
          textAlign: 'center',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: Theme.ProfileNoStoriesSubtitle,
          textAlign: 'center',
          maxWidth: 280,
          lineHeight: 1.4,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
};