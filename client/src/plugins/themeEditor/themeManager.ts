/**
 * Theme Manager
 *
 * Handles theme persistence and application to DOM
 */

import { ThemeConfig } from '@/types';
import { THEME_EDITOR_CONFIG, logThemeEditor } from './config';
import { PRESET_THEMES } from './themes';

export class ThemeManager {
  private storageKey: string;

  constructor() {
    this.storageKey = THEME_EDITOR_CONFIG.storageKey;
  }

  /**
   * Load theme from localStorage
   */
  loadTheme(): ThemeConfig {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        let theme: any;
        try {
          theme = JSON.parse(stored);
        } catch {
          // If stored is a raw string (e.g., "light", "dark", "ocean")
          theme = stored;
        }

        if (typeof theme === 'string') {
          const lower = theme.toLowerCase();
          if (PRESET_THEMES[lower]) {
            theme = PRESET_THEMES[lower];
          } else if (lower === 'light') {
            theme = PRESET_THEMES.default || THEME_EDITOR_CONFIG.defaultTheme;
          } else if (lower === 'dark') {
            theme = PRESET_THEMES.midnight || THEME_EDITOR_CONFIG.defaultTheme;
          }
        }

        if (theme && typeof theme === 'object' && !Array.isArray(theme) && 'primary' in theme) {
          logThemeEditor('Theme loaded from storage', theme);
          return theme as ThemeConfig;
        }

        // Clean up invalid or corrupted theme value in localStorage
        localStorage.removeItem(this.storageKey);
      }
    } catch (error) {
      console.warn('Failed to load theme from storage:', error);
    }

    logThemeEditor('Using default theme');
    return THEME_EDITOR_CONFIG.defaultTheme;
  }

  /**
   * Save theme to localStorage
   */
  saveTheme(theme: ThemeConfig): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(theme));
      logThemeEditor('Theme saved to storage', theme);
    } catch (error) {
      console.error('Failed to save theme to storage:', error);
    }
  }

  /**
   * Apply theme to DOM by setting CSS variables
   */
  applyTheme(theme: ThemeConfig): void {
    const root = document.documentElement;

    Object.entries(theme).forEach(([key, value]) => {
      // Convert camelCase to kebab-case
      const cssVar = `--${key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}`;
      root.style.setProperty(cssVar, value as string);
    });

    logThemeEditor('Theme applied to DOM', theme);
  }

  /**
   * Reset to default theme
   */
  resetTheme(): ThemeConfig {
    const defaultTheme = THEME_EDITOR_CONFIG.defaultTheme;
    this.saveTheme(defaultTheme);
    this.applyTheme(defaultTheme);
    logThemeEditor('Theme reset to default');
    return defaultTheme;
  }

  /**
   * Clear theme from storage
   */
  clearTheme(): void {
    localStorage.removeItem(this.storageKey);
    logThemeEditor('Theme cleared from storage');
  }
}

// Singleton instance
export const themeManager = new ThemeManager();
