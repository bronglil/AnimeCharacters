# Contributing to anime-ascii

## What we follow (and what we skip)

Valid for this package — **do these**:

| Practice | Status |
|----------|--------|
| Locked `LOOK_PRESETS` shared by API / CLI / gallery | Required |
| Separate `ascii.css` via `exports["./ascii.css"]` (no CSS-in-JS) | Required |
| Types via `src/index.d.ts` + `exports.types` | Required |
| Preset width / HTML-class tests | Required |
| CLI `--help` lists look presets | Required |
| Quick-start README before deep API | Required |
| Document breaking changes for preset/CSS churn | Required |

**Not valid / not done for this package** (on purpose):

| Idea | Why skip |
|------|----------|
| Dual `dist/index.js` + `dist/index.esm.js` CJS/ESM build | Package is **ESM-only** (`"type":"module"`, Node ≥18). Fake `dist/` without a real build adds drift. Vite/webpack already consume ESM `import`. |
| Browser-only entry without `jimp` | Conversion needs image decode; first release stays Node. HTML/CSS output is for the browser; conversion runs on Node or a bundler that can ship jimp. |
| Lazy-load for “&lt;50KB” | Our published tarball is ~12KB source. Weight is **dependency `jimp` (~MB)**. Shrinking that is a separate epic, not a `dist` shuffle. |

## Presets are contracts

`LOOK_PRESETS` in `src/converter.js` is the single source of truth for `look: "ascii" | "dense"`.

- Gallery (`npm run build:characters`), CLI (`--look`), and the JS API must all use `normalizeOptions()` / `LOOK_PRESETS`.
- `style: "portrait"` may **raise** edge/localContrast floors; it must **never lower** look preset values.
- Changing preset numbers (columns, contrast, edgeBoost, ramp) is a **breaking change**. Bump the **major** version and regenerate gallery samples.
- Renaming CSS classes (`ascii-color`, `ascii-color--glyph`, `ascii-color--dense`) is also **breaking**.

## Non-breaking changes

- New optional API flags with defaults that preserve current look
- New ramp names
- Docs / examples / tests
- Patch/minor performance improvements that keep column counts and glyph mapping identical for the same inputs

## Checks before a PR

```bash
cd js
npm test
npm run build:characters   # if presets or converter sampling changed
node bin/anime-ascii.js --help
```

## Package layout

- JS entry: `src/index.js` (ESM)
- Types: `src/index.d.ts`
- CSS: `src/ascii.css` — shipped separately via `exports["./ascii.css"]`, never inlined into JS
