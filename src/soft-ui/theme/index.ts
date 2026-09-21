export { lightTheme } from './light';
export { darkTheme } from './dark';
export type { AppTheme } from './light';

import { lightTheme } from './light';
import { darkTheme } from './dark';
import type { AppTheme } from './light';

export function getTheme(mode: 'light' | 'dark'): AppTheme {
  return mode === 'dark' ? darkTheme : lightTheme;
}

export function themeFromScheme(scheme?: string | null, force?: 'light' | 'dark'): AppTheme {
  if (force) return getTheme(force);
  return getTheme(scheme === 'dark' ? 'dark' : 'light');
}
