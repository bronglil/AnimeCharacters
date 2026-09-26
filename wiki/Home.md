# anime-ascii

Reusable **image → colored ASCII** for Node. Output is made of readable characters with color — not a photo mosaic.

**Package:** [`anime-ascii`](https://www.npmjs.com/package/anime-ascii) · **Repo:** [bronglil/AnimeCharacters](https://github.com/bronglil/AnimeCharacters)

## Pages

- [Installation](Installation)
- [CLI](CLI)
- [API](API)
- [Looks and styles](Looks-and-styles)
- [Gallery](Gallery)
- [Contributing](Contributing)

## Quick start

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

## Design goals

- **Glyph-forward** — characters stay readable
- **Locked looks** — `ascii` (56 cols) and `dense` (72 cols)
- **Portrait / anime** — wider columns, subject-aware sampling, cel polish without morphing the face
