export type Theme = 'light' | 'dark' | 'system';
export const THEME_COOKIE = 'muster-theme';
export const asTheme = (v?: string): Theme => (v === 'light' || v === 'dark' ? v : 'system');
