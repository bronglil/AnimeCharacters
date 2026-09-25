# anime-ascii (npm)

Convert images into accurate ASCII character designs (bust / silhouette style).

Same approach as the Python package: linear-light luminance, L*-style mapping, monospace cell aspect, classic ` .:-=+*#%@` ramp.

## Install

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

const art = await convertPath("portrait.png", {
  columns: 80,
  invert: false,
  edgeBoost: 0.2,
});
console.log(art);
```

### CLI

```bash
npx anime-ascii portrait.png -w 80 -o out.txt
npx anime-ascii portrait.png --invert --edge-boost 0.25
npx anime-ascii --list-ramps
```

## Tests

```bash
npm test
```

## License

MIT
