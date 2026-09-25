# anime-ascii (npm)

Convert images into accurate ASCII character designs (bust / silhouette style).

Same approach as the Python package: linear-light luminance, L*-style mapping, monospace cell aspect, classic ` .:-=+*#%@` ramp.

## Features

- Accurate box-filter sampling (area average in linear light / L*)
- Default ramp matches `image-to-ascii`: ` .,:;i1tfLCG08@`
- `style: "relief"` for hollow-face / dense-shoulder bust silhouettes
- Local contrast for photo detail (better than flat fill)
- CLI + library API


```bash
cd js
npm install
npm link   # optional, exposes `anime-ascii` CLI
```

Or from the package folder after publish:

```bash
npm install anime-ascii
```

## Usage

```js
import { convertPath, convertImage, AsciiOptions } from "anime-ascii";

const art = await convertPath(path, {
  columns: 80,
  style: "relief", // hollow face + dense shoulders for silhouettes
  ramp: "classic",
});
console.log(art);
```

### CLI

```bash
npx anime-ascii portrait.png -w 80 -o out.txt
npx anime-ascii bust.png --style relief -r classic -w 64
npx anime-ascii photo.png --style fill --metric lstar
npx anime-ascii --list-ramps
```

`style: "auto"` (default) uses **relief** for near-binary silhouettes and **fill** + local contrast for photos — more accurate than flat `image-to-ascii` fill.
## Tests

```bash
npm test
```

## License

MIT
