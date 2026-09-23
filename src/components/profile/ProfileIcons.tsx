import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

export const Icons = {
  // Навигация и диалоги
  Close: ({ size = 20, color = 'currentColor', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
    </svg>
  ),
  ArrowLeft: ({ size = 20, color = 'currentColor', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z" />
    </svg>
  ),
  Plus: ({ size = 20, color = 'currentColor', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
    </svg>
  ),
  FilterVariant: ({ size = 20, color = 'currentColor', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M6,13H18V11H6M3,6V8H21V6M10,18H14V16H10V18Z" />
    </svg>
  ),
  ChevronRight: ({ size = 18, color = 'currentColor', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" />
    </svg>
  ),
  ContentCopy: ({ size = 14, color = 'currentColor', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" />
    </svg>
  ),
  CheckBold: ({ size = 14, color = 'currentColor', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" />
    </svg>
  ),

  // Верхние кнопки действий
  PlayCircleOutline: ({ size = 22, color = 'currentColor', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M10,16.5L16,12L10,7.5V16.5Z" />
    </svg>
  ),
  PencilOutline: ({ size = 22, color = 'currentColor', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M14.06,9L15,9.94L5.92,19H5V18.08L14.06,9M17.66,3C17.41,3 17.15,3.1 16.96,3.29L15.13,5.12L18.88,8.87L20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18.17,3.09 17.92,3 17.66,3M14.06,6.19L3,17.25V21H6.75L17.81,9.94L14.06,6.19Z" />
    </svg>
  ),
  CogOutline: ({ size = 22, color = 'currentColor', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" />
    </svg>
  ),
  MessageTextOutline: ({ size = 22, color = 'currentColor', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2M20,16H5.17L4,17.17V4H20V16M7,7H17V9H7V7M7,11H14V13H7V11Z" />
    </svg>
  ),
  PhoneOutline: ({ size = 22, color = 'currentColor', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M20,15.5C18.8,15.5 17.5,15.3 16.4,14.9H16.1C15.8,14.9 15.6,15 15.4,15.2L13.2,17.4C10.4,15.9 8,13.6 6.6,10.8L8.8,8.6C9.1,8.3 9.2,7.9 9,7.6C8.7,6.5 8.5,5.2 8.5,4C8.5,3.5 8,3 7.5,3H4C3.5,3 3,3.5 3,4C3,13.4 10.6,21 20,21C20.5,21 21,20.5 21,20V16.5C21,16 20.5,15.5 20,15.5M5,5H6.5C6.6,5.9 6.8,6.8 7,7.6L5.8,8.8C5.4,7.6 5.1,6.3 5,5M19,19C17.7,18.9 16.4,18.6 15.2,18.2L16.4,17C17.2,17.2 18.1,17.4 19,17.4Z" />
    </svg>
  ),
  BellOutline: ({ size = 22, color = 'currentColor', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M10,21H14A2,2 0 0,1 12,23A2,2 0 0,1 10,21M21,19V20H3V19L5,17V11C5,7.93 7.03,5.34 10,4.6V4A2,2 0 0,1 12,2A2,2 0 0,1 14,4V4.6C16.97,5.34 19,7.93 19,11V17L21,19M17,11A5,5 0 0,0 12,6A5,5 0 0,0 7,11V18H17V11Z" />
    </svg>
  ),
  BellOffOutline: ({ size = 22, color = 'currentColor', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M20,18.69L18.71,20L15.29,16.58C14.73,17.46 13.93,18 13,18H11C10.07,18 9.27,17.46 8.71,16.58L4.31,21L3,19.69L5.61,17.08C5.22,16.27 5,15.18 5,14V11C5,10.5 5.09,10.06 5.25,9.66L2,6.41L3.31,5.1L20,21.8M12,2A2,2 0 0,1 14,4V4.6C16.97,5.34 19,7.93 19,11V13.8L17,11.8V11A5,5 0 0,0 12,6C10.62,6 9.4,6.56 8.5,7.47L7.09,6.06C8.32,4.8 10,4 12,4V2M10,21A2,2 0 0,0 12,23A2,2 0 0,0 14,21H10Z" />
    </svg>
  ),

  // =========================================================================
  // ИКОНКИ СЕКЦИЙ ЛЕВОЙ ПАНЕЛИ (1:1 MaterialDesignInXaml)
  // =========================================================================

  // 1. Kind="AccountOutline"
  AccountOutline: ({ size = 22, color = '#5865F2', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,6A2,2 0 0,0 10,8A2,2 0 0,0 12,10A2,2 0 0,0 14,8A2,2 0 0,0 12,6M12,13C14.67,13 20,14.33 20,17V20H4V17C4,14.33 9.33,13 12,13M12,14.9C9.03,14.9 5.9,16.36 5.9,17.1V18.1H18.1V17.1C18.1,16.36 14.97,14.9 12,14.9Z" />
    </svg>
  ),

  // 2. Kind="InformationOutline"
  InformationOutline: ({ size = 22, color = '#00AFF4', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z" />
    </svg>
  ),

  // 3. Kind="PhoneOutline" (Алиас PhoneSectionOutline)
  PhoneSectionOutline: ({ size = 22, color = '#3BA55C', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M20,15.5C18.8,15.5 17.5,15.3 16.4,14.9H16.1C15.8,14.9 15.6,15 15.4,15.2L13.2,17.4C10.4,15.9 8,13.6 6.6,10.8L8.8,8.6C9.1,8.3 9.2,7.9 9,7.6C8.7,6.5 8.5,5.2 8.5,4C8.5,3.5 8,3 7.5,3H4C3.5,3 3,3.5 3,4C3,13.4 10.6,21 20,21C20.5,21 21,20.5 21,20V16.5C21,16 20.5,15.5 20,15.5M5,5H6.5C6.6,5.9 6.8,6.8 7,7.6L5.8,8.8C5.4,7.6 5.1,6.3 5,5M19,19C17.7,18.9 16.4,18.6 15.2,18.2L16.4,17C17.2,17.2 18.1,17.4 19,17.4Z" />
    </svg>
  ),

  // 4. Kind="EmailOutline" (ИСПРАВЛЕНО: Честный контурный конверт с вырезом, больше не заливается сплошным цветом)
  EmailOutline: ({ size = 22, color = '#3BA55C', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M22,6C22,4.9 21.1,4 20,4H4C2.9,4 2,4.9 2,6V18C2,19.1 2.9,20 4,20H20C21.1,20 22,19.1 22,18V6M20,6L12,11L4,6H20M20,18H4V8L12,13L20,8V18Z" />
    </svg>
  ),

  // 5. Kind="GenderMaleFemale" (ИСПРАВЛЕНО: Объединенный знак Марса ♂ со стрелкой вправо-вверх и Венеры ♀ с крестом вниз)
  GenderMaleFemale: ({ size = 22, color = '#ED4245', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M17.58,4H14V2H21V9H19V5.41L15.17,9.24C15.69,10.03 16,11 16,12C16,14.42 14.28,16.44 12,16.9V19H14V21H12V23H10V21H8V19H10V16.9C7.72,16.44 6,14.42 6,12A5,5 0 0,1 11,7C12,7 12.96,7.3 13.75,7.83L17.58,4M11,9A3,3 0 0,0 8,12A3,3 0 0,0 11,15A3,3 0 0,0 14,12A3,3 0 0,0 11,9Z" />
    </svg>
  ),

  // 6. Kind="CakeVariantOutline" (ИСПРАВЛЕНО: Истинный двухъярусный торт со свечой из WPF)
  CakeVariantOutline: ({ size = 22, color = '#FAA61A', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M12,6C13.11,6 14,5.1 14,4C14,3.62 13.9,3.27 13.71,2.97L12,0L10.29,2.97C10.1,3.27 10,3.62 10,4A2,2 0 0,0 12,6M16.6,16L15.53,14.92L14.45,16C13.15,17.29 10.87,17.3 9.56,16L8.5,14.92L7.4,16C6.75,16.64 5.88,17 4.96,17C4.08,17 3.25,16.64 2.6,16L2,16.6V21H22V16.6L21.4,16C20.75,15.36 19.92,15 19.04,15C18.16,15 17.25,15.36 16.6,16M19.04,13C19.92,13 20.75,13.36 21.4,14L22,14.6V12L19,10V9C19,7.9 18.1,7 17,7H7C5.9,7 5,7.9 5,9V10L2,12V14.6L2.6,14C3.25,13.36 4.08,13 4.96,13C5.88,13 6.75,13.36 7.4,14L8.5,15.08L9.56,14C10.87,12.71 13.15,12.7 14.45,14L15.53,15.08L16.6,14C17.25,13.36 18.16,13 19.04,13Z" />
    </svg>
  ),

  // 7. Kind="CalendarBlankOutline"
  CalendarBlankOutline: ({ size = 14, color = '#7A8490', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M19,4H18V2H16V4H8V2H6V4H5A2,2 0 0,0 3,6V20A2,2 0 0,0 5,22H19A2,2 0 0,0 21,20V6A2,2 0 0,0 19,4M19,20H5V9H19V20M19,7H5V6H19V7Z" />
    </svg>
  ),

  // Общие медиа / Пункты списка
  PinOutline: ({ size = 20, color = '#8E9297', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M16,12V4H17V2H7V4H8V12L6,14V16H11V22H13V16H18V14L16,12M8.8,14L10,12.8V4H14V12.8L15.2,14H8.8Z" />
    </svg>
  ),
  ImageOutline: ({ size = 20, color = '#8E9297', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M19,19H5V5H19M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M13.96,12.29L11.21,15.83L9.25,13.47L6.5,17H17.5L13.96,12.29Z" />
    </svg>
  ),
  VideoOutline: ({ size = 20, color = '#8E9297', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M15,8V16H5V8H15M16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5V7A1,1 0 0,0 16,6Z" />
    </svg>
  ),
  FileGifBox: ({ size = 20, color = '#8E9297', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M10,10.5H7.5V13.5H9V12.5H8V11.5H10V14A1,1 0 0,1 9,15H7A1,1 0 0,1 6,14V10A1,1 0 0,1 7,9H9A1,1 0 0,1 10,10V10.5M13,15H11.5V9H13V15M17.5,10.5H15.5V11.5H17V13H15.5V15H14V9H17.5V10.5Z" />
    </svg>
  ),
  MusicNoteOutline: ({ size = 20, color = '#8E9297', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M12,3V13.55A4,4 0 1,0 14,17V7H18V3H12M10,19A2,2 0 1,1 12,17A2,2 0 0,1 10,19Z" />
    </svg>
  ),
  MicrophoneOutline: ({ size = 20, color = '#8E9297', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z" />
    </svg>
  ),
  FileDocumentOutline: ({ size = 20, color = '#8E9297', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
    </svg>
  ),
  LinkVariant: ({ size = 20, color = '#8E9297', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M10.59,13.41C11,13.8 11,14.44 10.59,14.83C10.2,15.22 9.56,15.22 9.17,14.83L6.34,12C4.78,10.44 4.78,7.9 6.34,6.34C7.9,4.78 10.44,4.78 12,6.34L14.83,9.17C15.22,9.56 15.22,10.2 14.83,10.59C14.44,11 13.8,11 13.41,10.59L10.59,7.76C9.81,6.97 8.54,6.97 7.76,7.76C6.97,8.54 6.97,9.81 7.76,10.59L10.59,13.41M13.41,10.59C13,10.2 13,9.56 13.41,9.17C13.8,8.78 14.44,8.78 14.83,9.17L17.66,12C19.22,13.56 19.22,16.1 17.66,17.66C16.1,19.22 13.56,19.22 12,17.66L9.17,14.83C8.78,14.44 8.78,13.8 9.17,13.41C9.56,13 10.2,13 10.59,13.41L13.41,16.24C14.2,17.03 15.46,17.03 16.24,16.24C17.03,15.46 17.03,14.2 16.24,13.41L13.41,10.59Z" />
    </svg>
  ),
  BlockHelper: ({ size = 20, color = '#FF3B30', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12C4,13.85 4.63,15.55 5.69,16.9L16.9,5.69C15.55,4.63 13.85,4 12,4M12,20A8,8 0 0,0 20,12C20,10.15 19.37,8.45 18.31,7.1L7.1,18.31C8.45,19.37 10.15,20 12,20Z" />
    </svg>
  ),
  ImageMultipleOutline: ({ size = 56, color = '#2A303C', style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path fill={color} d="M21,17H7V3H21M21,1H7A2,2 0 0,0 5,3V17A2,2 0 0,0 7,19H21A2,2 0 0,0 23,17V3A2,2 0 0,0 21,1M3,5H1V21A2,2 0 0,0 3,23H19V21H3M15.96,10.29L13.21,13.83L11.25,11.47L8.5,15H19.5L15.96,10.29Z" />
    </svg>
  ),
};