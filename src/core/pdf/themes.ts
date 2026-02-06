/**
 * Theme System for PDF Generation
 *
 * Static theme definitions. For dynamic theme generation from images/URLs,
 * use theme-builder.ts instead.
 */

export interface Theme {
  name: string;
  margins: { top: number; bottom: number; left: number; right: number };
  fonts: {
    title: { name: string; size: number };
    heading: { name: string; size: number };
    body: { name: string; size: number };
    timestamp: { name: string; size: number };
  };
  colors: {
    primary: string;
    text: string;
    secondary: string;
    link: string;
    background: string;
  };
  spacing: {
    sectionGap: number;
    paragraphGap: number;
    imageMargin: number;
  };
}

export const DEFAULT_THEME: Theme = {
  name: 'default',
  margins: { top: 50, bottom: 50, left: 50, right: 50 },
  fonts: {
    title: { name: 'NotoSansKR-Bold', size: 24 },
    heading: { name: 'NotoSansKR-Bold', size: 14 },
    body: { name: 'NotoSansKR-Regular', size: 11 },
    timestamp: { name: 'NotoSansKR-Regular', size: 10 },
  },
  colors: {
    primary: '#2563eb',
    text: '#1f2937',
    secondary: '#6b7280',
    link: '#2563eb',
    background: '#ffffff',
  },
  spacing: {
    sectionGap: 30,
    paragraphGap: 10,
    imageMargin: 15,
  },
};

/**
 * Minimal Neon Theme Colors (from Layout6_Minimal_Neon design)
 */
export const MINIMAL_NEON_COLORS = {
  bg: '#09090b',
  bgElevated: '#18181b',
  bgSubtle: '#27272a',
  neonGreen: '#22c55e',
  neonBlue: '#3b82f6',
  neonPurple: '#a855f7',
  neonYellow: '#eab308',
  neonCyan: '#06b6d4',
  white: '#fafafa',
  gray100: '#e4e4e7',
  gray300: '#a1a1aa',
  gray500: '#71717a',
  gray700: '#3f3f46',
  border: '#27272a',
};

/**
 * Tag badge colors for minimal-neon layout
 */
export const MINIMAL_NEON_TAG_COLORS: Record<string, { bg: string; text: string }> = {
  INSIGHT: { bg: 'rgba(34, 197, 94, 0.2)', text: '#22c55e' },
  TECHNIQUE: { bg: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' },
  DEFINITION: { bg: 'rgba(168, 85, 247, 0.2)', text: '#a855f7' },
  METRIC: { bg: 'rgba(234, 179, 8, 0.2)', text: '#eab308' },
  TOOL: { bg: 'rgba(6, 182, 212, 0.2)', text: '#06b6d4' },
};

export const MINIMAL_NEON_THEME: Theme = {
  name: 'minimal-neon',
  margins: { top: 80, bottom: 80, left: 48, right: 48 },
  fonts: {
    title: { name: 'NotoSansKR-Bold', size: 36 },
    heading: { name: 'NotoSansKR-Bold', size: 18 },
    body: { name: 'NotoSansKR-Regular', size: 14 },
    timestamp: { name: 'NotoSansKR-Bold', size: 13 },
  },
  colors: {
    primary: MINIMAL_NEON_COLORS.neonGreen,
    text: MINIMAL_NEON_COLORS.white,
    secondary: MINIMAL_NEON_COLORS.gray500,
    link: MINIMAL_NEON_COLORS.neonBlue,
    background: MINIMAL_NEON_COLORS.bg,
  },
  spacing: {
    sectionGap: 56,
    paragraphGap: 16,
    imageMargin: 20,
  },
};

// Theme registry (simple Record)
export const THEMES: Record<string, Theme> = {
  default: DEFAULT_THEME,
  'minimal-neon': MINIMAL_NEON_THEME,
};

/**
 * Load theme by name
 * @param themeName - Name of the theme to load
 * @returns The requested theme or DEFAULT_THEME if not found
 */
export function loadTheme(themeName: string): Theme {
  return THEMES[themeName] || DEFAULT_THEME;
}

/**
 * Get all available theme names
 */
export function getThemeNames(): string[] {
  return Object.keys(THEMES);
}

/**
 * Check if a theme name is valid
 */
export function isValidTheme(name: string): boolean {
  return name in THEMES;
}
