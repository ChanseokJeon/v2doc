import { fromPath } from 'pdf2pic';
import { toMatchImageSnapshot } from 'jest-image-snapshot';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { mkdtempSync } from 'fs';

// Extend Jest matchers
expect.extend({ toMatchImageSnapshot });

/**
 * Visual Regression Tests
 *
 * These tests compare rendered PDF pages against baseline images.
 *
 * To update baselines:
 *   1. Generate a PDF: npm run dev -- <youtube-url>
 *   2. Capture baselines: npx tsx tests/visual/capture-baseline.ts output.pdf
 *
 * To run tests:
 *   npm run test:visual
 */

describe('Visual Regression Tests', () => {
  const testPdfPath = process.env.TEST_PDF_PATH || join(__dirname, '../../output.pdf');
  const baselineDir = join(__dirname, 'baseline');

  // Skip tests if no test PDF exists
  const skipTests = !existsSync(testPdfPath);

  if (skipTests) {
    console.warn(`⚠️  Skipping visual tests: PDF not found at ${testPdfPath}`);
    console.warn('   Set TEST_PDF_PATH environment variable to specify a different path');
  }

  beforeAll(() => {
    if (skipTests) {
      console.log('📋 To run visual tests:');
      console.log('   1. Generate a PDF: npm run dev -- <youtube-url>');
      console.log('   2. Capture baselines: npx tsx tests/visual/capture-baseline.ts output.pdf');
      console.log('   3. Run tests: npm run test:visual');
    }
  });

  describe('Cover Page', () => {
    it('should match baseline snapshot', async () => {
      if (skipTests) {
        console.log('Skipped: No test PDF available');
        return;
      }

      const tempDir = mkdtempSync(join(tmpdir(), 'pdf-test-'));
      const converter = fromPath(testPdfPath, {
        density: 200,
        saveFilename: 'page',
        savePath: tempDir,
        format: 'png',
        width: 2100,
        height: 2970,
      });

      const result = await converter(1);
      expect(result).toBeDefined();

      const imageBuffer = readFileSync(result!.path);

      // Test cover page (first page)
      expect(imageBuffer).toMatchImageSnapshot({
        customSnapshotIdentifier: 'cover-page',
        customSnapshotsDir: baselineDir,
        failureThreshold: 0.01, // 1% tolerance for minor rendering differences
        failureThresholdType: 'percent',
      });
    });
  });

  describe('Table of Contents', () => {
    it('should match baseline snapshot', async () => {
      if (skipTests) {
        console.log('Skipped: No test PDF available');
        return;
      }

      const tempDir = mkdtempSync(join(tmpdir(), 'pdf-test-'));
      const converter = fromPath(testPdfPath, {
        density: 200,
        saveFilename: 'page',
        savePath: tempDir,
        format: 'png',
        width: 2100,
        height: 2970,
      });

      const result = await converter(2);
      expect(result).toBeDefined();

      const imageBuffer = readFileSync(result!.path);

      // Test TOC (second page)
      expect(imageBuffer).toMatchImageSnapshot({
        customSnapshotIdentifier: 'toc',
        customSnapshotsDir: baselineDir,
        failureThreshold: 0.01,
        failureThresholdType: 'percent',
      });
    });
  });

  describe('Content Pages', () => {
    it('should match baseline snapshot for first content page', async () => {
      if (skipTests) {
        console.log('Skipped: No test PDF available');
        return;
      }

      const tempDir = mkdtempSync(join(tmpdir(), 'pdf-test-'));
      const converter = fromPath(testPdfPath, {
        density: 200,
        saveFilename: 'page',
        savePath: tempDir,
        format: 'png',
        width: 2100,
        height: 2970,
      });

      const result = await converter(3);
      expect(result).toBeDefined();

      const imageBuffer = readFileSync(result!.path);

      // Test first content page (third page)
      expect(imageBuffer).toMatchImageSnapshot({
        customSnapshotIdentifier: 'content-page-1',
        customSnapshotsDir: baselineDir,
        failureThreshold: 0.01,
        failureThresholdType: 'percent',
      });
    });

    it('should match baseline snapshot for sample content pages', async () => {
      if (skipTests) {
        console.log('Skipped: No test PDF available');
        return;
      }

      const tempDir = mkdtempSync(join(tmpdir(), 'pdf-test-'));
      const converter = fromPath(testPdfPath, {
        density: 200,
        saveFilename: 'page',
        savePath: tempDir,
        format: 'png',
        width: 2100,
        height: 2970,
      });

      // Get total page count
      const pdf = require('pdf-parse');
      const dataBuffer = readFileSync(testPdfPath);
      const pdfData = await pdf(dataBuffer);
      const totalPages = pdfData.numpages;

      // Test a few more pages if available (pages 4-6)
      const pagesToTest = Math.min(totalPages, 6);

      for (let i = 4; i <= pagesToTest; i++) {
        const result = await converter(i);
        if (!result) continue;

        const imageBuffer = readFileSync(result.path);
        const pageNumber = i - 2; // Content page number (starts from 1)

        expect(imageBuffer).toMatchImageSnapshot({
          customSnapshotIdentifier: `content-page-${pageNumber}`,
          customSnapshotsDir: baselineDir,
          failureThreshold: 0.01,
          failureThresholdType: 'percent',
        });
      }
    });
  });

  describe('Metadata', () => {
    it('should verify PDF has expected structure', async () => {
      if (skipTests) {
        console.log('Skipped: No test PDF available');
        return;
      }

      // Get total page count
      const pdf = require('pdf-parse');
      const dataBuffer = readFileSync(testPdfPath);
      const pdfData = await pdf(dataBuffer);

      // Verify minimum page count
      expect(pdfData.numpages).toBeGreaterThanOrEqual(3); // Cover + TOC + at least 1 content page

      // Verify we can convert pages to images
      const tempDir = mkdtempSync(join(tmpdir(), 'pdf-test-'));
      const converter = fromPath(testPdfPath, {
        density: 200,
        saveFilename: 'page',
        savePath: tempDir,
        format: 'png',
        width: 2100,
        height: 2970,
      });

      const result = await converter(1);
      expect(result).toBeDefined();
      expect(result!.path).toBeTruthy();
    });
  });
});
