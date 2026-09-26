# CLI

```bash
npx anime-ascii <image> [options]
```

## Common flags

| Flag | Description |
|------|-------------|
| `--look ascii\|dense` | Locked column / contrast presets |
| `--style auto\|fill\|relief\|portrait\|anime` | Rendering mode |
| `--quality fast\|high` | Sampling quality |
| `--color` | Colored HTML / ANSI |
| `-w, --columns <n>` | Override width |
| `-o, --output <path>` | Write file (`.html` / `.txt`) |
| `--help` | Usage |

## Examples

Readable colored glyphs:

```bash
npx anime-ascii photo.png --look ascii --color
```

Portrait with anime cel polish (same face, bold outline):

```bash
npx anime-ascii photo.png --look ascii --style anime --quality high --color -o out.html
```

Dense mosaic:

```bash
npx anime-ascii sprite.png --look dense --color -o out.html
```
