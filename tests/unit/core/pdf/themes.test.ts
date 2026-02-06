import {
  Theme,
  DEFAULT_THEME,
  MINIMAL_NEON_THEME,
  MINIMAL_NEON_COLORS,
  MINIMAL_NEON_TAG_COLORS,
  THEMES,
  loadTheme,
  getThemeNames,
  isValidTheme,
} from '../../../../src/core/pdf/themes';

describe('Theme Interface and Structure', () => {
  it('should have valid DEFAULT_THEME structure', () => {
    expect(DEFAULT_THEME).toBeDefined();
    expect(DEFAULT_THEME.name).toBe('default');
    expect(DEFAULT_THEME.margins).toHaveProperty('top');
    expect(DEFAULT_THEME.margins).toHaveProperty('bottom');
    expect(DEFAULT_THEME.margins).toHaveProperty('left');
    expect(DEFAULT_THEME.margins).toHaveProperty('right');
    expect(DEFAULT_THEME.fonts).toHaveProperty('title');
    expect(DEFAULT_THEME.fonts).toHaveProperty('heading');
    expect(DEFAULT_THEME.fonts).toHaveProperty('body');
    expect(DEFAULT_THEME.fonts).toHaveProperty('timestamp');
    expect(DEFAULT_THEME.colors).toHaveProperty('primary');
    expect(DEFAULT_THEME.colors).toHaveProperty('text');
    expect(DEFAULT_THEME.colors).toHaveProperty('secondary');
    expect(DEFAULT_THEME.colors).toHaveProperty('link');
    expect(DEFAULT_THEME.colors).toHaveProperty('background');
    expect(DEFAULT_THEME.spacing).toHaveProperty('sectionGap');
    expect(DEFAULT_THEME.spacing).toHaveProperty('paragraphGap');
    expect(DEFAULT_THEME.spacing).toHaveProperty('imageMargin');
  });

  it('should have valid MINIMAL_NEON_THEME structure', () => {
    expect(MINIMAL_NEON_THEME).toBeDefined();
    expect(MINIMAL_NEON_THEME.name).toBe('minimal-neon');
    expect(MINIMAL_NEON_THEME.margins).toHaveProperty('top');
    expect(MINIMAL_NEON_THEME.margins).toHaveProperty('bottom');
    expect(MINIMAL_NEON_THEME.margins).toHaveProperty('left');
    expect(MINIMAL_NEON_THEME.margins).toHaveProperty('right');
    expect(MINIMAL_NEON_THEME.fonts).toHaveProperty('title');
    expect(MINIMAL_NEON_THEME.fonts).toHaveProperty('heading');
    expect(MINIMAL_NEON_THEME.fonts).toHaveProperty('body');
    expect(MINIMAL_NEON_THEME.fonts).toHaveProperty('timestamp');
    expect(MINIMAL_NEON_THEME.colors).toHaveProperty('primary');
    expect(MINIMAL_NEON_THEME.colors).toHaveProperty('text');
    expect(MINIMAL_NEON_THEME.colors).toHaveProperty('secondary');
    expect(MINIMAL_NEON_THEME.colors).toHaveProperty('link');
    expect(MINIMAL_NEON_THEME.colors).toHaveProperty('background');
    expect(MINIMAL_NEON_THEME.spacing).toHaveProperty('sectionGap');
    expect(MINIMAL_NEON_THEME.spacing).toHaveProperty('paragraphGap');
    expect(MINIMAL_NEON_THEME.spacing).toHaveProperty('imageMargin');
  });

  it('should have all required MINIMAL_NEON_COLORS', () => {
    expect(MINIMAL_NEON_COLORS).toHaveProperty('bg');
    expect(MINIMAL_NEON_COLORS).toHaveProperty('bgElevated');
    expect(MINIMAL_NEON_COLORS).toHaveProperty('bgSubtle');
    expect(MINIMAL_NEON_COLORS).toHaveProperty('neonGreen');
    expect(MINIMAL_NEON_COLORS).toHaveProperty('neonBlue');
    expect(MINIMAL_NEON_COLORS).toHaveProperty('neonPurple');
    expect(MINIMAL_NEON_COLORS).toHaveProperty('neonYellow');
    expect(MINIMAL_NEON_COLORS).toHaveProperty('neonCyan');
    expect(MINIMAL_NEON_COLORS).toHaveProperty('white');
    expect(MINIMAL_NEON_COLORS).toHaveProperty('gray100');
    expect(MINIMAL_NEON_COLORS).toHaveProperty('gray300');
    expect(MINIMAL_NEON_COLORS).toHaveProperty('gray500');
    expect(MINIMAL_NEON_COLORS).toHaveProperty('gray700');
    expect(MINIMAL_NEON_COLORS).toHaveProperty('border');
  });

  it('should have all required MINIMAL_NEON_TAG_COLORS', () => {
    expect(MINIMAL_NEON_TAG_COLORS).toHaveProperty('INSIGHT');
    expect(MINIMAL_NEON_TAG_COLORS).toHaveProperty('TECHNIQUE');
    expect(MINIMAL_NEON_TAG_COLORS).toHaveProperty('DEFINITION');
    expect(MINIMAL_NEON_TAG_COLORS).toHaveProperty('METRIC');
    expect(MINIMAL_NEON_TAG_COLORS).toHaveProperty('TOOL');

    // Each tag color should have bg and text properties
    Object.values(MINIMAL_NEON_TAG_COLORS).forEach((color) => {
      expect(color).toHaveProperty('bg');
      expect(color).toHaveProperty('text');
    });
  });
});

describe('Theme Registry', () => {
  it('should have THEMES registry with default and minimal-neon', () => {
    expect(THEMES).toBeDefined();
    expect(THEMES.default).toBe(DEFAULT_THEME);
    expect(THEMES['minimal-neon']).toBe(MINIMAL_NEON_THEME);
  });

  it('should load default theme when theme name not found', () => {
    const theme = loadTheme('nonexistent-theme');
    expect(theme).toBe(DEFAULT_THEME);
  });

  it('should load default theme by name', () => {
    const theme = loadTheme('default');
    expect(theme).toBe(DEFAULT_THEME);
  });

  it('should load minimal-neon theme by name', () => {
    const theme = loadTheme('minimal-neon');
    expect(theme).toBe(MINIMAL_NEON_THEME);
  });
});

describe('Theme Utility Functions', () => {
  it('should return all theme names', () => {
    const names = getThemeNames();
    expect(names).toContain('default');
    expect(names).toContain('minimal-neon');
    expect(names.length).toBe(2);
  });

  it('should validate valid theme names', () => {
    expect(isValidTheme('default')).toBe(true);
    expect(isValidTheme('minimal-neon')).toBe(true);
  });

  it('should invalidate unknown theme names', () => {
    expect(isValidTheme('unknown')).toBe(false);
    expect(isValidTheme('')).toBe(false);
    expect(isValidTheme('random-theme')).toBe(false);
  });
});

describe('Color Values', () => {
  it('should have valid hex color codes in DEFAULT_THEME', () => {
    const hexPattern = /^#[0-9a-f]{6}$/i;
    expect(DEFAULT_THEME.colors.primary).toMatch(hexPattern);
    expect(DEFAULT_THEME.colors.text).toMatch(hexPattern);
    expect(DEFAULT_THEME.colors.secondary).toMatch(hexPattern);
    expect(DEFAULT_THEME.colors.link).toMatch(hexPattern);
    expect(DEFAULT_THEME.colors.background).toMatch(hexPattern);
  });

  it('should have valid hex color codes in MINIMAL_NEON_THEME', () => {
    const hexPattern = /^#[0-9a-f]{6}$/i;
    expect(MINIMAL_NEON_THEME.colors.primary).toMatch(hexPattern);
    expect(MINIMAL_NEON_THEME.colors.text).toMatch(hexPattern);
    expect(MINIMAL_NEON_THEME.colors.secondary).toMatch(hexPattern);
    expect(MINIMAL_NEON_THEME.colors.link).toMatch(hexPattern);
    expect(MINIMAL_NEON_THEME.colors.background).toMatch(hexPattern);
  });

  it('should have valid color codes in MINIMAL_NEON_COLORS', () => {
    const hexPattern = /^#[0-9a-f]{6}$/i;
    Object.values(MINIMAL_NEON_COLORS).forEach((color) => {
      expect(color).toMatch(hexPattern);
    });
  });
});

describe('Theme Consistency', () => {
  it('should have consistent font names across themes', () => {
    const validateFont = (theme: Theme) => {
      expect(theme.fonts.title.name).toBeTruthy();
      expect(theme.fonts.heading.name).toBeTruthy();
      expect(theme.fonts.body.name).toBeTruthy();
      expect(theme.fonts.timestamp.name).toBeTruthy();
    };

    validateFont(DEFAULT_THEME);
    validateFont(MINIMAL_NEON_THEME);
  });

  it('should have positive numeric values for margins', () => {
    const validateMargins = (theme: Theme) => {
      expect(theme.margins.top).toBeGreaterThan(0);
      expect(theme.margins.bottom).toBeGreaterThan(0);
      expect(theme.margins.left).toBeGreaterThan(0);
      expect(theme.margins.right).toBeGreaterThan(0);
    };

    validateMargins(DEFAULT_THEME);
    validateMargins(MINIMAL_NEON_THEME);
  });

  it('should have positive numeric values for font sizes', () => {
    const validateFontSizes = (theme: Theme) => {
      expect(theme.fonts.title.size).toBeGreaterThan(0);
      expect(theme.fonts.heading.size).toBeGreaterThan(0);
      expect(theme.fonts.body.size).toBeGreaterThan(0);
      expect(theme.fonts.timestamp.size).toBeGreaterThan(0);
    };

    validateFontSizes(DEFAULT_THEME);
    validateFontSizes(MINIMAL_NEON_THEME);
  });

  it('should have positive numeric values for spacing', () => {
    const validateSpacing = (theme: Theme) => {
      expect(theme.spacing.sectionGap).toBeGreaterThan(0);
      expect(theme.spacing.paragraphGap).toBeGreaterThan(0);
      expect(theme.spacing.imageMargin).toBeGreaterThan(0);
    };

    validateSpacing(DEFAULT_THEME);
    validateSpacing(MINIMAL_NEON_THEME);
  });
});
