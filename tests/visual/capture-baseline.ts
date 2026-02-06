import { fromPath } from 'pdf2pic';
import { join } from 'path';

/**
 * Captures baseline images from a PDF file
 *
 * Usage:
 *   npx tsx tests/visual/capture-baseline.ts <path-to-pdf>
 *
 * Example:
 *   npx tsx tests/visual/capture-baseline.ts output.pdf
 */

interface CaptureOptions {
  pdfPath: string;
  outputDir: string;
  density?: number;
}

/**
 * Captures all pages from a PDF as PNG images
 */
async function captureBaseline(options: CaptureOptions): Promise<void> {
  const { pdfPath, outputDir, density = 200 } = options;

  console.log(`📸 Capturing baseline images from: ${pdfPath}`);
  console.log(`   Output directory: ${outputDir}`);
  console.log(`   Density: ${density} DPI`);

  try {
    const converter = fromPath(pdfPath, {
      density,
      saveFilename: 'page',
      savePath: outputDir,
      format: 'png',
      width: 2100,
      height: 2970,
    });

    // Get total page count first
    const pdf = require('pdf-parse');
    const fs = require('fs');
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdf(dataBuffer);
    const totalPages = pdfData.numpages;

    console.log(`   Total pages: ${totalPages}`);

    // Convert each page
    for (let pageIndex = 1; pageIndex <= totalPages; pageIndex++) {
      const result = await converter(pageIndex);

      if (!result) {
        console.warn(`   ⚠ Failed to convert page ${pageIndex}`);
        continue;
      }

      // Rename file to match naming convention
      let pageName: string;
      if (pageIndex === 1) {
        pageName = 'cover-page.png';
      } else if (pageIndex === 2) {
        pageName = 'toc.png';
      } else {
        pageName = `content-page-${pageIndex - 2}.png`;
      }

      const oldPath = result.path;
      const newPath = join(outputDir, pageName);

      // Rename the file
      fs.renameSync(oldPath, newPath);

      console.log(`   ✓ Saved page ${pageIndex}: ${pageName}`);
    }

    console.log(`\n✅ Successfully captured ${totalPages} pages`);
  } catch (error) {
    console.error('❌ Failed to capture baseline images:', error);
    throw error;
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx tests/visual/capture-baseline.ts <path-to-pdf>');
    console.error('Example: npx tsx tests/visual/capture-baseline.ts output.pdf');
    process.exit(1);
  }

  const pdfPath = args[0];
  const outputDir = join(__dirname, 'baseline');

  await captureBaseline({
    pdfPath,
    outputDir,
    density: 200, // 200 DPI for better quality
  });
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { captureBaseline, CaptureOptions };
