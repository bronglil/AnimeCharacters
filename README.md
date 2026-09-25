# AnimeCharacters

Build **accurate ASCII character designs** from images — the classic bust / silhouette look made of `.:-=+*#%@` glyphs — plus an optional character sheet from the same upload.

The conversion library lives in `src/anime_ascii` and is installable as `anime-ascii`.

## Why this conversion is accurate

Inspired by techniques used in projects like [ascii-forge](https://github.com/runawaydevil/ascii-forge) and [AdvancedAsciiArt](https://github.com/VoxelCubes/AdvancedAsciiArt) (implemented independently here):

| Technique | Purpose |
|-----------|---------|
| Linear-light → CIE L*-style luminance | Correct brightness, not raw RGB averages |
| Cell aspect correction (~0.5) | Stops monospace output looking stretched |
| Autocontrast (percentile stretch) | Keeps midtones from collapsing into one glyph |
| Density-ordered ramps | Classic ` .:-=+*#%@` matches common silhouette art |
| Optional edge boost | Strengthens outlines for bust / portrait shapes |
| Optional invert + dither | Terminal aesthetic and smoother ramps |

## Install

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -e ".[dev,web]"
```

## Library usage

```python
from PIL import Image
from anime_ascii import AsciiOptions, convert_image, convert_path

art = convert_path(
    "portrait.png",
    AsciiOptions(columns=80, invert=False, edge_boost=0.2),
)
print(art)

# Or from an already-open image
art = convert_image(Image.open("portrait.png"), AsciiOptions(columns=72, ramp="classic"))
```

### CLI

```bash
anime-ascii portrait.png -w 80 -o out.txt
anime-ascii portrait.png --invert --edge-boost 0.25
anime-ascii --list-ramps
```

For dark silhouettes on a light background (typical bust photo), leave invert off so the figure becomes dense `@#%` glyphs. Use `--invert` when the subject is light on a dark photo.

## Web UI

```bash
python -m app.main
```

Open http://127.0.0.1:7860 — upload an image to preview ASCII + a draft character sheet.

## Tests (18 synthetic images + your example when present)

```bash
pytest -q
```

Fixtures cover black/white, gradients, circles, bust silhouettes, checkerboards, anime-style faces, alpha PNGs, color subjects, and more. Each image is converted and checked for dimensions, ramp membership, and luminance→density accuracy.

## Project layout

```
src/anime_ascii/     # installable ASCII package
  converter.py
  luminance.py
  ramps.py
  cli.py
app/                 # optional Flask UI
tests/               # accuracy suite + fixture generator
```

## License

MIT
