# Visual Regression Tests

Visual regression testing for PDF output quality and layout consistency.

## Overview

These tests capture PDF pages as images and compare them against baseline snapshots to detect unintended visual changes.

## Directory Structure

```
tests/visual/
├── baseline/                    # Baseline images (committed to git)
│   ├── cover-page.png
│   ├── toc.png
│   ├── content-page-1.png
│   ├── content-page-2.png
│   └── ...
├── capture-baseline.ts          # Script to capture new baselines
├── visual-regression.test.ts    # Visual regression tests
└── README.md                    # This file
```

## Quick Start

### 1. Generate Baseline Images

First, generate a PDF from a YouTube video:

```bash
npm run dev -- "https://www.youtube.com/watch?v=EXAMPLE"
```

Then capture baseline images from the PDF:

```bash
npx tsx tests/visual/capture-baseline.ts output.pdf
```

This will create PNG images in `tests/visual/baseline/`:
- `cover-page.png` - Page 1 (cover page)
- `toc.png` - Page 2 (table of contents)
- `content-page-1.png` - Page 3 (first content page)
- `content-page-2.png` - Page 4 (second content page)
- etc.

### 2. Run Visual Tests

```bash
npm run test:visual
```

This compares the current PDF output against the baseline images.

## Updating Baselines

When you intentionally change the PDF layout or styling, you need to update the baselines:

```bash
# 1. Generate a new PDF with your changes
npm run dev -- "https://www.youtube.com/watch?v=EXAMPLE"

# 2. Review the PDF visually to ensure it looks correct
# (Open output.pdf in a PDF viewer)

# 3. Capture new baseline images
npx tsx tests/visual/capture-baseline.ts output.pdf

# 4. Commit the updated baseline images
git add tests/visual/baseline/
git commit -m "chore: update visual regression baselines"
```

## Configuration

### Test Tolerance

Visual tests allow a 1% difference threshold to account for minor rendering variations:

```typescript
failureThreshold: 0.01,  // 1% tolerance
failureThresholdType: 'percent',
```

You can adjust this in `visual-regression.test.ts` if needed.

### Custom PDF Path

By default, tests look for `output.pdf` in the project root. To test a different PDF:

```bash
TEST_PDF_PATH=/path/to/your.pdf npm run test:visual
```

### Image Scale

Baseline images are captured at 2x scale for better quality:

```typescript
scale: 2  // 2x resolution
```

## CI/CD Integration

### Skipping in CI

Visual tests are automatically skipped if no test PDF is available. This is useful for CI environments where you may not want to run visual tests on every commit.

### Running in CI

To run visual tests in CI:

1. **Option A: Use a fixture PDF** (recommended)
   ```bash
   # Add a small test PDF to tests/fixtures/
   cp output.pdf tests/fixtures/test-sample.pdf
   git add tests/fixtures/test-sample.pdf

   # Update CI config
   TEST_PDF_PATH=tests/fixtures/test-sample.pdf npm run test:visual
   ```

2. **Option B: Generate PDF in CI**
   ```yaml
   # .github/workflows/test.yml
   - name: Generate test PDF
     run: npm run dev -- "https://www.youtube.com/watch?v=EXAMPLE"

   - name: Run visual tests
     run: npm run test:visual
   ```

## Troubleshooting

### Tests fail with "No test PDF available"

Make sure you've generated a PDF first:

```bash
npm run dev -- "https://www.youtube.com/watch?v=EXAMPLE"
```

Or set `TEST_PDF_PATH` to an existing PDF:

```bash
TEST_PDF_PATH=/path/to/existing.pdf npm run test:visual
```

### Tests fail with image differences

1. **Review the diff images**
   - Jest creates diff images in `tests/visual/__image_snapshots__/__diff_output__/`
   - Compare these to understand what changed

2. **If changes are intentional**
   - Update baselines (see "Updating Baselines" above)

3. **If changes are bugs**
   - Fix the code and re-run tests

### Different rendering on different machines

PDF rendering can vary slightly between machines due to:
- Different font rendering engines
- Different image scaling algorithms
- OS-specific PDF libraries

If you see consistent failures across machines, consider:
- Increasing the failure threshold slightly (e.g., 0.02 = 2%)
- Using Docker for consistent rendering environments

## Best Practices

1. **Commit baseline images to git**
   - This ensures everyone uses the same baselines

2. **Use a representative test video**
   - Choose a video with typical content (text, images, formatting)
   - Avoid videos that change frequently

3. **Update baselines deliberately**
   - Always review visual changes before updating baselines
   - Document why baselines changed in commit messages

4. **Test critical pages**
   - Cover page (branding, title)
   - Table of contents (structure)
   - Content pages (layout, formatting)

5. **Keep baselines small**
   - Don't capture every page of a 100-page PDF
   - Focus on representative samples

## Technical Details

### Libraries Used

- **pdf-to-img**: Converts PDF pages to PNG images
- **jest-image-snapshot**: Jest matcher for image comparison
- **pixelmatch** (via jest-image-snapshot): Pixel-level image diffing

### Image Comparison Algorithm

jest-image-snapshot uses pixelmatch under the hood:
1. Converts both images to the same color space
2. Compares pixel-by-pixel
3. Calculates difference percentage
4. Fails if difference exceeds threshold

### Performance

- Each page takes ~100-500ms to render
- Tests run sequentially
- Total time: ~1-5 seconds for typical PDFs

## Future Improvements

- [ ] Add visual tests for different video types (with/without screenshots, etc.)
- [ ] Add visual tests for different themes/styles
- [ ] Add visual tests for edge cases (very long titles, special characters, etc.)
- [ ] Parallelize image comparisons for faster tests
- [ ] Add visual diff viewer in HTML format
