# Migration Guide: yt2pdf → v2doc

Welcome! This guide will help you smoothly migrate from **yt2pdf** to **v2doc**. The process preserves all your settings, cache, and configuration files.

**What's changing?**
- Package name: `yt2pdf` → `v2doc`
- CLI command: `yt2pdf` → `v2doc`
- Config files: `yt2pdf.config.yaml` → `v2doc.config.yaml`
- API imports: `from 'yt2pdf'` → `from 'v2doc'`

**What's NOT changing?**
- ✅ Error class name: `Yt2PdfError` (backward compatible)
- ✅ localStorage keys in generated HTML (user state preserved)
- ✅ GitHub repository: `ChanseokJeon/yt2`
- ✅ Core functionality and output quality

---

## Quick Start (5 minutes)

### For CLI Users

```bash
# 1. Uninstall old package
npm uninstall -g yt2pdf

# 2. Install new package
npm install -g v2doc

# 3. Test installation
v2doc --version

# 4. Migrate your config files (optional but recommended)
# In each project directory:
mv yt2pdf.config.yaml v2doc.config.yaml
```

### For Node.js API Users

```bash
# 1. Update package
npm uninstall yt2pdf
npm install v2doc

# 2. Update your code
# Change: import { convert } from 'yt2pdf';
# To:     import { convert } from 'v2doc';
```

---

## Detailed Migration Steps

### Step 1: Back Up Your Data (Recommended)

Before migrating, back up your cache and config directories:

```bash
# macOS/Linux
cp -r ~/.cache/yt2pdf ~/.cache/yt2pdf.backup
cp -r ~/.config/yt2pdf ~/.config/yt2pdf.backup

# Windows (PowerShell)
Copy-Item -Recurse $env:APPDATA\yt2pdf $env:APPDATA\yt2pdf.backup
```

### Step 2: Uninstall yt2pdf

```bash
npm uninstall -g yt2pdf
```

Verify it's removed:

```bash
yt2pdf --version
# Should print: command not found
```

### Step 3: Install v2doc

```bash
npm install -g v2doc
```

Verify installation:

```bash
v2doc --version
# Should print: v1.0.0 (or current version)
```

### Step 4: Migrate Cache Directory (Optional)

If you want to preserve your downloaded videos and cached screenshots:

```bash
# macOS/Linux
mv ~/.cache/yt2pdf ~/.cache/v2doc
mv ~/.config/yt2pdf ~/.config/v2doc

# Windows (PowerShell)
Move-Item $env:APPDATA\yt2pdf $env:APPDATA\v2doc
```

**Note:** You can skip this step if you don't mind redownloading videos.

### Step 5: Migrate Project Config Files

For each project that uses v2doc, rename the config file:

```bash
# In your project directory
mv yt2pdf.config.yaml v2doc.config.yaml
```

**Example config file** (`v2doc.config.yaml`):

```yaml
output:
  directory: ./output
  format: pdf
  filenamePattern: "{timestamp}_{title}"

screenshot:
  interval: 60
  quality: low

subtitle:
  priority: youtube
  languages:
    - ko
    - en
```

All existing config options remain unchanged. See [Configuration Guide](docs/CONFIGURATION.md) for full details.

### Step 6: Update Shell Aliases (If You Have Any)

If you've created shell aliases for the old command:

```bash
# In ~/.bashrc, ~/.zshrc, or equivalent:

# Old
# alias yt='yt2pdf'

# New
alias yt='v2doc'
```

Then reload your shell:

```bash
source ~/.bashrc  # or ~/.zshrc
```

### Step 7: Update Build Scripts

If you have scripts that call yt2pdf:

```bash
# Update any shell scripts or npm scripts
sed -i 's/yt2pdf/v2doc/g' your-script.sh
```

Example package.json update:

```json
{
  "scripts": {
    "convert": "v2doc https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }
}
```

---

## For Developers: Programmatic API

### Step 1: Update Dependencies

```bash
npm uninstall yt2pdf
npm install v2doc
```

### Step 2: Update Imports

**Before:**
```typescript
import { convert, ConvertResult, Yt2PdfError } from 'yt2pdf';

const result = await convert('https://www.youtube.com/watch?v=...');
```

**After:**
```typescript
import { convert, ConvertResult, Yt2PdfError } from 'v2doc';

const result = await convert('https://www.youtube.com/watch?v=...');
```

### Step 3: API Compatibility

The API remains 100% compatible. All type names and function signatures are unchanged:

```typescript
// All these work exactly the same
import type {
  ConvertResult,
  VideoMetadata,
  PDFOptions,
  SubtitleResult,
  Screenshot,
} from 'v2doc';

// Error handling unchanged
try {
  await convert(url, options);
} catch (error) {
  if (error instanceof Yt2PdfError) {
    console.log(error.code, error.message);
  }
}
```

---

## For Docker Users

### Update Your Dockerfile

**Before:**
```dockerfile
FROM node:18-alpine

RUN npm install -g yt2pdf
ENTRYPOINT ["yt2pdf"]
```

**After:**
```dockerfile
FROM node:18-alpine

RUN npm install -g v2doc
ENTRYPOINT ["v2doc"]
```

### Update Your Docker Commands

```bash
# Before
docker run yt2pdf https://www.youtube.com/watch?v=...

# After
docker run v2doc https://www.youtube.com/watch?v=...
```

---

## For Cloud Run / API Server Users

### Update Service URLs

If you're using the hosted Cloud Run service:

- **Old:** `https://yt2pdf-*.run.app`
- **New:** `https://v2doc-*.run.app`

Update any client code that references the old URL:

```typescript
// Before
const response = await fetch('https://yt2pdf-941839241915.asia-northeast3.run.app/api/convert', {
  method: 'POST',
  body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=...' }),
});

// After
const response = await fetch('https://v2doc-941839241915.asia-northeast3.run.app/api/convert', {
  method: 'POST',
  body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=...' }),
});
```

### GCS Bucket Access

- **Old bucket** (`yt2pdf-output-*`): Still readable, no action needed
- **New bucket** (`v2doc-output-*`): New jobs write here by default

No migration needed unless you need to continue using the old bucket.

---

## Troubleshooting

### "Command not found: v2doc"

**Solution:**
```bash
# Reinstall with npm
npm install -g v2doc

# Or verify npm's global bin path is in your PATH
npm config get prefix
# Should output something like /usr/local/bin
```

### "Module not found: v2doc"

**Solution:**
```bash
# Verify installation in your project
npm list v2doc

# Reinstall if needed
npm install v2doc

# Clear npm cache
npm cache clean --force
npm install v2doc
```

### "config file not found"

**Solution:**
Make sure to rename or recreate the config file:

```bash
# Rename existing config
mv yt2pdf.config.yaml v2doc.config.yaml

# Or create a new one
v2doc --init
```

### Old cached videos not working

**Solution:**
If you didn't migrate the cache directory, simply re-run the command. v2doc will download fresh copies:

```bash
v2doc https://www.youtube.com/watch?v=...
```

### TypeScript type errors

**Solution:**
Make sure you're importing from the correct package:

```typescript
// Correct
import { Yt2PdfError } from 'v2doc';

// Wrong
import { Yt2PdfError } from 'yt2pdf';
```

---

## Validation Checklist

After migration, verify everything works:

- [ ] `v2doc --version` displays version number
- [ ] `v2doc --help` shows usage instructions
- [ ] Config file renamed to `v2doc.config.yaml`
- [ ] Imports updated in TypeScript code (if applicable)
- [ ] First test conversion runs successfully
- [ ] Output files generate correctly
- [ ] Shell aliases updated (if applicable)
- [ ] Docker images rebuilt (if applicable)

---

## Environment Variables

No changes needed. The following environment variables work exactly as before:

```bash
# Still supported, same behavior
OPENAI_API_KEY=sk-...
YT_DLP_PROXY=http://proxy:port
WHISPER_API_KEY=...
```

---

## Need Help?

- **Issues or bugs:** [GitHub Issues](https://github.com/ChanseokJeon/yt2/issues)
- **Documentation:** [README.md](README.md)
- **API Reference:** [docs/API.md](docs/API.md)
- **Configuration:** [docs/CONFIGURATION.md](docs/CONFIGURATION.md)

---

## What's New in v2doc?

This rebranding also brings:

- ✨ More accurate name (supports PDF, Markdown, HTML, and Brief output)
- ✨ Better pronunciation ("vee-two-doc" vs "why-tee-two-pee-dee-eff")
- ✨ Modern branding across all platforms
- ✨ Same solid reliability you know and love

---

## Migration Summary

| Component | Old | New | Action |
|-----------|-----|-----|--------|
| Package name | `yt2pdf` | `v2doc` | `npm install v2doc` |
| CLI command | `yt2pdf` | `v2doc` | Update scripts |
| Config file | `yt2pdf.config.yaml` | `v2doc.config.yaml` | Rename or recreate |
| API import | `from 'yt2pdf'` | `from 'v2doc'` | Update imports |
| Error class | `Yt2PdfError` | `Yt2PdfError` | No change (backward compatible) |
| GitHub repo | `yt2pdf` | `yt2` | No change |

---

**Happy converting! 🎥📄**
