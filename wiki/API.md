# API

```js
import {
  convertPath,
  convertPathColored,
  convertImage,
  convertImageColored,
  convertBuffer,
  convertBufferColored,
  toHtml,
  toAnsi,
  toPlain,
  LOOK_PRESETS,
  PORTRAIT_COLUMNS,
  RAMPS,
  normalizeOptions,
} from "anime-ascii";
```

## Colored conversion

```js
const { text, html, ansi, cells } = await convertPathColored("hero.png", {
  look: "ascii",
  style: "portrait", // or "anime"
  quality: "high",
});
```

Plain text only:

```js
const text = await convertPath("hero.png", { look: "ascii" });
```

## Options (`AsciiOptions`)

| Option | Notes |
|--------|--------|
| `look` | `"ascii"` \| `"dense"` |
| `columns` | Overrides look width |
| `style` | `"auto"` \| `"fill"` \| `"relief"` \| `"portrait"` \| `"anime"` |
| `quality` | `"fast"` \| `"high"` |
| `ramp` | Named ramp or custom string |
| `dither` | Boolean |
| `background` | `"auto"` \| `"white"` \| `"none"` |

Types ship in `anime-ascii` (`index.d.ts`).
