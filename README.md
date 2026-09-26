# anime-ascii

**Node-native image → colored ASCII** for bots, CLIs, CI logs, and web previews.

Anime sprites and portraits are the *hook* — the API is general. Same call turns a PNG into readable glyphs with truecolor HTML/ANSI.

```bash
npm install anime-ascii
npx anime-ascii photo.png --look ascii --color
```

```js
import { convertPathColored } from "anime-ascii";
import "anime-ascii/ascii.css";

const { text, html, ansi } = await convertPathColored("photo.png", {
  look: "ascii",
  quality: "high",
});
```

**Who it's for first:** Node / terminal developers (Discord bots, pipeline logs, TUI thumbnails). Anime gallery is optional flair in this repo.

## Why anime-ascii?

| | anime-ascii | jp2a / caca | ImageMagick ASCII |
|--|-------------|-------------|-------------------|
| Node API | First-class ESM + types | Shell only | Shell / bindings |
| Color | Truecolor HTML + ANSI in one call | Limited / complex | Possible, awkward |
| Presets | Locked `ascii` / `dense` + styles | Flags everywhere | DIY |
| Browser decode | **Node only** (output is web-ready) | Terminal | Offline |

Use **jp2a** when you need raw C speed and plain mono. Use **this** when you want an expressive JS library with color and presets.

## Looks

| `look` | Columns | Use when |
|--------|---------|----------|
| `ascii` (default) | **56** (portrait/anime **64**) | Readable colored characters — bots, logs, cards |
| `dense` | **72** (portrait **80**) | Maximum detail when readability is secondary (gallery zoom, print-style mosaics). Prefer `columns: 72` if you only need width. |

## Not just anime

| Sample | Path |
|--------|------|
| Landscape | [`samples/general/landscape`](samples/general/landscape.txt) |
| Diagram | [`samples/general/diagram`](samples/general/diagram.txt) |
| Meme-style face | [`samples/general/meme`](samples/general/meme.txt) |
| Portrait + anime polish | [`samples/sajid/`](samples/sajid/) |
| Character cards | [`gallery/`](gallery/) |

## Performance (measured, Node 24 · this machine)

| Input | Options | Time | Heap Δ |
|-------|---------|------|--------|
| ~sprite (Pikachu) | `ascii` + `high` | ~50ms | small |
| Portrait photo | `ascii` + `portrait` + `high` | ~45–80ms | ~6MB |

- **Node.js ≥ 18 only** — no browser WASM decode yet (HTML/CSS output is for browsers)
- CPU-bound; I/O is cheap after decode
- Batch: run conversions in worker threads / a job queue
- Huge files: decode cost is jimp’s; prefer resizing first if > a few MB
- No streaming line-by-line API yet

## Design cards

```bash
cd js && npm install && npm run build:characters && npm run gallery
# http://localhost:5173/gallery/
```

## Tests

```bash
cd js && npm test
```

## Docs

Package README: [`js/README.md`](js/README.md) · Wiki pages in [`wiki/`](wiki/) · License: MIT

Default branch: **`master`**.
