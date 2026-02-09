# v1.0.0 (2026-02-10)

## 🎉 Major Release: Product Renamed

### BREAKING CHANGES

**Product renamed from `yt2pdf` to `v2doc`**

- **CLI command**: `yt2pdf` → `v2doc`
- **npm package**: `yt2pdf` → `v2doc`
- **Config file**: `yt2pdf.config.yaml` → `v2doc.config.yaml`
- **Binary entry point**: `dist/bin/yt2pdf.js` → `dist/bin/v2doc.js`

### 🎯 Rationale

1. **More generic name** - Not limited to YouTube (supports any video source)
2. **Better pronunciation** - "vee-two-doc" is easier to say than "why-tee-two-pee-dee-eff"
3. **Accurate branding** - Reflects actual capabilities (PDF/MD/HTML output)
4. **Future-proof** - Prepared for expansion beyond YouTube platform

### 📚 Migration Guide

See [MIGRATION.md](MIGRATION.md) for step-by-step instructions.

**Quick summary for CLI users:**
```bash
npm uninstall -g yt2pdf && npm install -g v2doc
mv ~/.cache/yt2pdf ~/.cache/v2doc
mv ~/.config/yt2pdf ~/.config/v2doc
```

### 🔒 Backward Compatibility

What's preserved:
- ✅ `Yt2PdfError` class name (API stability)
- ✅ localStorage keys (`yt2pdf_*`) in generated HTML (user state preservation)
- ✅ GitHub repository remains `yt2` (URL stability)
- ✅ Queue name configurable via `QUEUE_NAME` env var (infrastructure flexibility)

### 🔐 Security Improvements

- Fixed 3 HIGH severity CVEs in `fast-xml-parser` dependency
- Added npm publish protection with `"files"` field in package.json
- Centralized infrastructure constants for better configuration management

### 🏗️ Infrastructure Changes

- Queue name now configurable via `QUEUE_NAME` environment variable
- Bucket name configurable via `BUCKET_PREFIX` and `BUCKET_SUFFIX` env vars
- New migration helper detects legacy paths and guides users

### ✨ New Features

- Auto-detection of legacy directories (`~/.cache/yt2pdf`, `~/.config/yt2pdf`)
- User-friendly migration instructions displayed on first run
- Centralized constants for infrastructure naming
