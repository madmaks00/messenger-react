export type AppTheme = 'dark' | 'light';
export const THEME_STORAGE_KEY = 'makc-theme';

export function readTheme(): AppTheme {
  try { return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}

export function applyTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function saveTheme(theme: AppTheme): void {
  applyTheme(theme);
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* The in-memory choice still works. */ }
}

applyTheme(readTheme());
