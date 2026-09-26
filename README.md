# anime-ascii

Reusable **image → colored ASCII** for Node. Output is made of visible characters with color — not a photo lookalike.

**npm:** [`anime-ascii@0.5.0`](https://www.npmjs.com/package/anime-ascii) · **Wiki:** [docs](https://github.com/bronglil/AnimeCharacters/wiki)

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

- `look: "ascii"` — readable glyphs (**56** columns; **64** for `--style portrait` / `anime`), default  
- `look: "dense"` — finer mosaic (**72** / portrait **80** columns)
- `style: "anime"` — same face + cel outline polish (no morphing)

## Design cards (10 characters × 4 styles · colored)

```bash
cd js && npm run build:characters
npx --yes serve . -p 5173
# open http://localhost:5173/gallery/
```

Pick a character card (ASCII thumbnails), then a design. Preview shows **colored characters**.

Characters: Bulbasaur, Charmander, Squirtle, Pikachu, Charizard, Jigglypuff, Meowth, Gengar, Eevee, Mewtwo.

## Sample — Pikachu

See [`samples/pikachu.txt`](samples/pikachu.txt) and [`samples/characters/`](samples/characters/).

## Tests

```bash
cd js && npm test
```

## License

MIT
