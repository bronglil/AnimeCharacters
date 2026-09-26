# anime-ascii

Node **image → colored ASCII** (readable glyphs, not a photo mosaic). Anime is the demo aesthetic; the API is general.

**Site:** [bronglil.github.io/AnimeCharacters](https://bronglil.github.io/AnimeCharacters/)

<p align="center">
  <img src="https://raw.githubusercontent.com/bronglil/AnimeCharacters/master/samples/sajid/sajid.png" alt="Input portrait" width="220" />
  &nbsp;&nbsp;
  <img src="https://raw.githubusercontent.com/bronglil/AnimeCharacters/master/samples/sajid/sajid-ascii.png" alt="Output: colored ASCII" width="220" />
</p>

<p align="center"><sub>Photo → colored ASCII — <a href="https://github.com/bronglil/AnimeCharacters/tree/master/samples/sajid">samples/sajid/</a></sub></p>

```bash
npm install @lilbrong/anime-ascii
```

```js
import { convertPathColored } from "@lilbrong/anime-ascii";
import "@lilbrong/anime-ascii/ascii.css"; // or: import "@lilbrong/anime-ascii/ascii.vars.css"

const { html, text, ansi } = await convertPathColored("./hero.png", {
  look: "ascii",
});
```

Install from this monorepo (`master`):

```bash
npm install github:bronglil/AnimeCharacters#master:js
```

## Install

**npmjs (public):**
```bash
npm install @lilbrong/anime-ascii
```

**GitHub Packages** (same code, scope matches GitHub user — see [Packages](https://github.com/bronglil/AnimeCharacters/packages)):
```bash
# ~/.npmrc
# @bronglil:registry=https://npm.pkg.github.com
# //npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN

npm install @bronglil/anime-ascii
```

## Output formats

Choose what to generate — **text**, **html**, **ansi**, and/or **png** (pic):

```js
import { convertPathColored } from "@lilbrong/anime-ascii";

// text + html only
const card = await convertPathColored("photo.png", {
  formats: ["text", "html"],
});

// PNG image of the ASCII glyphs
const pic = await convertPathColored("photo.png", {
  formats: ["png"],
  style: "anime",
  imageScale: 2,
});
// pic.png → Buffer (write with fs.writeFileSync("out.png", pic.png))
```

CLI:

```bash
npx anime-ascii photo.png --format text
npx anime-ascii photo.png --format html -o card.html
npx anime-ascii photo.png --format png --style anime -o card.png
npx anime-ascii photo.png --format text,html,png -o out
# → out.txt  out.html  out.png

# same with flags
npx anime-ascii photo.png --text --html --pic -o out
```

## Why this vs jp2a / caca / ImageMagick?

- **Node-native** ESM API + TypeScript types (`ConvertOptions` / `ConvertResult`)
- **One call →** plain text, colored HTML, ANSI truecolor
- **Locked presets** shared by API, CLI, and gallery tests
- **Color is first-class**, not a bolted-on flag

Use jp2a for pure mono CLI speed. Use this inside JS bots, apps, and pipelines.

## Audience examples

| Use case | Hint |
|----------|------|
| Discord bot | [`examples/discord-bot.mjs`](examples/discord-bot.mjs) |
| CI / logs | `convertPath` → paste `text` into the job log |
| Web preview | `html` + `ascii.css` |
| Portrait polish | `--style anime` (same face, cel outline — no morph) |

Non-anime samples in the repo: `samples/general/{landscape,diagram,meme}.*`

## Looks (locked)

| `look` | Columns | When |
|--------|---------|------|
| `ascii` | **56** / portrait **64** | Default — readable glyphs |
| `dense` | **72** / portrait **80** | Finer mosaic when you want detail over readability (gallery, print). Or set `columns` explicitly. |

```js
import { LOOK_PRESETS, PORTRAIT_COLUMNS, MIN_COLUMNS, MAX_COLUMNS } from "@lilbrong/anime-ascii";
```

## Validation

`normalizeOptions()` throws on bad input (unknown `look` / `style` / `quality`, `columns` outside **8–400**). Broken image paths get a clear decode error instead of a raw jimp stack.

## Performance

Measured locally (Node 24): sprite ≈ **50ms**, portrait ≈ **45–80ms**, heap Δ typically **&lt;10MB** per call. **Node only** (no WASM). Batch with workers. Prefer downscaling very large sources first.

## CSS

```js
import "@lilbrong/anime-ascii/ascii.css";       // full theme (imports variables)
import "@lilbrong/anime-ascii/ascii.vars.css";  // tokens only — style `.ascii-color` yourself
```

Override tokens:

```css
:root {
  --ascii-bg: #0b1020;
  --ascii-fg: #f5f7ff;
  --ascii-size: 13px;
}
```

## CLI

```bash
npx anime-ascii --help
npx anime-ascii photo.png --look ascii --color -o out.html
npx anime-ascii photo.png --look ascii --style anime --quality high --color
```

CLI ships **inside** this package (`bin/anime-ascii.js`) — same `LOOK_PRESETS` as the library and gallery.

## API

```js
await convertPathColored("sprite.png", {
  look: "ascii",
  style: "auto", // auto | fill | relief | portrait | anime
  quality: "high",
  columns: 56,   // optional override
});
```

Exports: `convertPath`, `convertPathColored`, `convertImage`, `convertImageColored`, `convertBuffer`, `convertBufferColored`, `toHtml`, `toAnsi`, `toPlain`, `LOOK_PRESETS`, `PORTRAIT_COLUMNS`, `MIN_COLUMNS`, `MAX_COLUMNS`, `RAMPS`, `normalizeOptions`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Unknown look preset "…"` | Use `"ascii"` or `"dense"` |
| `columns must be 8–400` | Pass a sane width |
| `could not decode …` | Valid PNG/JPEG/GIF/WebP; check path |
| Output looks like a photo soup | Use `look: "ascii"` (not `dense`) |
| Face too small / ears missing | `--style portrait` or `anime`, `quality: "high"` |

## Gallery (repo)

```bash
npm install && npm run build:characters && npm run gallery
```

## Contributing / license

See [`CONTRIBUTING.md`](CONTRIBUTING.md). **MIT** — see [`LICENSE`](LICENSE).
