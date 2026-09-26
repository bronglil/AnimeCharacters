# Installation

## Requirements

- Node.js **18+**
- ESM (`"type": "module"` or `.mjs`)

## From npm

```bash
npm install anime-ascii
```

## CLI

The package ships a binary:

```bash
npx anime-ascii --help
```

## CSS (colored HTML)

Styles live in a **separate** file — never inlined into the JS bundle:

```js
import "anime-ascii/ascii.css";
```

Without a bundler:

```html
<link rel="stylesheet" href="node_modules/anime-ascii/ascii.css" />
```

## From this repo (monorepo path)

```bash
npm install github:bronglil/AnimeCharacters#main:js
# or locally:
npm install file:../AnimeCharacters/js
```
