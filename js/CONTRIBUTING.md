# Contributing to anime-ascii

Solo-maintained for now. Issues/PRs welcome; replies may be slow.

## Good PR ideas

- Bug fixes **with tests**
- Clearer errors / docs
- Performance improvements that keep glyph mapping stable for the same inputs
- New optional flags with backward-compatible defaults

## Not needed right now

- New output formats (keep scope focused)
- Python / browser-WASM ports (separate projects)
- Soft forks of `LOOK_PRESETS` numbers without a major bump

## Single source of truth

| Surface | Must use |
|---------|----------|
| JS API | `normalizeOptions()` / `LOOK_PRESETS` |
| CLI (`bin/anime-ascii.js`) | same |
| Gallery (`npm run build:characters`) | same |
| Tests | lock widths + smoke golden masters |

Changing preset columns / contrast / CSS class names is a **breaking** (major) change.

## Checks

```bash
cd js
npm test
npm run build:characters   # if sampling / presets changed
node bin/anime-ascii.js --help
```

## Package notes

- ESM-only, Node ≥ 18 — no fake dual CJS/ESM `dist/`
- Types: `src/index.d.ts` (`ConvertOptions` / `ConvertResult` aliases)
- CSS: `ascii.css` + `ascii.vars.css` via `exports` (never inlined into JS)
- Default git branch: **`master`**
- Commits: author **sajid** only (no Cursor co-author trailers)
