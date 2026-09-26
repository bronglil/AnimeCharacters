# anime-ascii

Convert images to **colored ASCII art** made of readable characters — for any Node project.

## Quick start

```bash
npm install anime-ascii
```

```js
import { convertPathColored } from "anime-ascii";
import "anime-ascii/ascii.css"; // separate file — never inlined into JS

const { html, text, ansi } = await convertPathColored("./hero.png", {
  look: "ascii", // locked preset: 56 columns (64 for portraits)
});
// Paste `html` into a page that already imports ascii.css
```

Without a bundler:

```html
<link rel="stylesheet" href="node_modules/anime-ascii/ascii.css" />
```

From this monorepo without npm:

```bash
npm install github:bronglil/AnimeCharacters#main:js
# or: npm install file:../AnimeCharacters/js
```

Docs: [Wiki](https://github.com/bronglil/AnimeCharacters/wiki)

## Looks (locked presets)

| `look` | Columns | Contrast | Edge | Use when |
|--------|---------|----------|------|----------|
| `ascii` (default) | **56** (portrait **64**) | 1.15 | 0.35 | Visible colored characters, accurate coverage |
| `dense` | **72** (portrait **80**) | 1.0 | 0.4 | Near-photo mosaic |

Same numbers in gallery, CLI, and `normalizeOptions()` / `LOOK_PRESETS`. Override with `columns` anytime.

```js
import { LOOK_PRESETS, PORTRAIT_COLUMNS } from "anime-ascii";
console.log(LOOK_PRESETS.ascii.columns); // 56
console.log(PORTRAIT_COLUMNS.ascii);     // 64
```

## CLI

```bash
npx anime-ascii --help
npx anime-ascii photo.png --look ascii --color
npx anime-ascii photo.png --look dense --color -o out.html
npx anime-ascii photo.png -w 48 --color
```

## API options

```js
await convertPathColored("sprite.png", {
  look: "ascii",
  columns: 56,
  style: "fill",       // auto | fill | relief | portrait
  ramp: "classic",
  quality: "high",
  dither: false,
});
```

Exports: `convertPath`, `convertPathColored`, `convertImage`, `convertImageColored`, `convertBuffer`, `convertBufferColored`, `toHtml`, `toAnsi`, `toPlain`, `LOOK_PRESETS`, `RAMPS`, `normalizeOptions`.

Types: included (`src/index.d.ts`). CSS: `import "anime-ascii/ascii.css"` (external file, not inlined).

## Anime portraits

Same face — cel outline polish, no morphing:

```bash
npx anime-ascii photo.png --look ascii --style anime --quality high --color -o out.html
```

`--style anime` keeps your features in place, adds bold silhouette (helps ears/hair) and soft skin planes.

- [`examples/basic.mjs`](examples/basic.mjs) — file → HTML
- [`examples/react.jsx`](examples/react.jsx) — React usage sketch
- Portrait demo (this repo): `samples/sajid/` — your photo converted with `--look ascii` / `dense` + `--style portrait`

```bash
npx anime-ascii ../samples/sajid/sajid.png --look ascii --style portrait --quality high --color -o out.html
```

## Gallery (this repo)

```bash
cd js && npm install && npm run build:characters
npm run gallery
# http://localhost:5173/gallery/
```

## License

MIT
