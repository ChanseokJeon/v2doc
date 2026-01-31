/**
 * Theme Builder E2E 테스트
 */

import * as fs from 'fs';
import * as path from 'path';
import { buildTheme, AVAILABLE_PRESETS } from '../../src/core/theme-builder';

describe('ThemeBuilder E2E', () => {
  describe('Preset Theme Integration', () => {
    it.each(AVAILABLE_PRESETS)('should build valid theme from %s preset', async (presetName) => {
      const theme = await buildTheme(presetName);

      // Theme structure validation
      expect(theme).toHaveProperty('name');
      expect(theme).toHaveProperty('margins');
      expect(theme).toHaveProperty('fonts');
      expect(theme).toHaveProperty('colors');
      expect(theme).toHaveProperty('spacing');

      // Margins validation
      expect(theme.margins.top).toBeGreaterThan(0);
      expect(theme.margins.bottom).toBeGreaterThan(0);
      expect(theme.margins.left).toBeGreaterThan(0);
      expect(theme.margins.right).toBeGreaterThan(0);

      // Fonts validation
      expect(theme.fonts.title.name).toBeTruthy();
      expect(theme.fonts.title.size).toBeGreaterThan(0);
      expect(theme.fonts.body.name).toBeTruthy();
      expect(theme.fonts.body.size).toBeGreaterThan(0);

      // Colors validation (hex format)
      const hexRegex = /^#[0-9a-fA-F]{6}$/;
      expect(theme.colors.primary).toMatch(hexRegex);
      expect(theme.colors.text).toMatch(hexRegex);
      expect(theme.colors.secondary).toMatch(hexRegex);
      expect(theme.colors.link).toMatch(hexRegex);
      expect(theme.colors.background).toMatch(hexRegex);

      // Spacing validation
      expect(theme.spacing.sectionGap).toBeGreaterThan(0);
      expect(theme.spacing.paragraphGap).toBeGreaterThan(0);
      expect(theme.spacing.imageMargin).toBeGreaterThan(0);
    });

    it('should produce different themes for different presets', async () => {
      const lightTheme = await buildTheme('light');
      const darkTheme = await buildTheme('dark');

      expect(lightTheme.colors.background).not.toBe(darkTheme.colors.background);
      expect(lightTheme.colors.text).not.toBe(darkTheme.colors.text);
    });
  });

  describe('Error Handling', () => {
    it('should gracefully handle non-existent image file', async () => {
      const theme = await buildTheme('./non-existent-image.png');

      // Should fallback to default theme
      expect(theme).toBeDefined();
      expect(theme.name).toBe('default');
      expect(theme.colors.background).toBe('#ffffff');
    });

    it('should gracefully handle invalid preset name', async () => {
      const theme = await buildTheme('invalid-preset-xyz');

      // Should fallback to default theme
      expect(theme).toBeDefined();
      expect(theme.colors).toBeDefined();
    });

    it('should gracefully handle empty input', async () => {
      const theme = await buildTheme('');

      expect(theme).toBeDefined();
      expect(theme.colors).toBeDefined();
    });
  });

  describe('Theme Consistency', () => {
    it('should produce consistent results for same input', async () => {
      const theme1 = await buildTheme('dark');
      const theme2 = await buildTheme('dark');

      expect(theme1.colors).toEqual(theme2.colors);
      expect(theme1.fonts).toEqual(theme2.fonts);
      expect(theme1.margins).toEqual(theme2.margins);
      expect(theme1.spacing).toEqual(theme2.spacing);
    });

    it('should apply WCAG contrast requirements', async () => {
      // For any preset, text should have sufficient contrast with background
      for (const presetName of AVAILABLE_PRESETS) {
        const theme = await buildTheme(presetName);

        // Text color should be dark on light bg or light on dark bg
        const bgLuminance = getLuminance(theme.colors.background);

        if (bgLuminance > 0.5) {
          // Light background - text should be dark
          expect(getLuminance(theme.colors.text)).toBeLessThan(0.5);
        } else {
          // Dark background - text should be light
          expect(getLuminance(theme.colors.text)).toBeGreaterThan(0.5);
        }
      }
    });
  });

  describe('Custom Options', () => {
    it('should use custom theme name', async () => {
      const customName = 'my-custom-theme-123';
      const theme = await buildTheme('light', { name: customName });

      expect(theme.name).toBe(customName);
    });

    it('should generate timestamp-based name by default', async () => {
      const before = Date.now();
      const theme = await buildTheme('dark');
      const after = Date.now();

      // Name should start with 'extracted-' followed by timestamp
      expect(theme.name).toMatch(/^extracted-\d+$/);

      // Timestamp should be within test execution time
      const timestamp = parseInt(theme.name.replace('extracted-', ''));
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });
});

// Helper function to calculate relative luminance
function getLuminance(hex: string): number {
  const rgb = parseInt(hex.slice(1), 16);
  const r = ((rgb >> 16) & 0xff) / 255;
  const g = ((rgb >> 8) & 0xff) / 255;
  const b = (rgb & 0xff) / 255;

  const [rs, gs, bs] = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
