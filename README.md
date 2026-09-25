# AnimeCharacters

Build anime-style character sheets from a reference image.

Upload a photo or drawing, extract a simple visual profile (palette, brightness, aspect cues), and turn it into a structured character sheet you can edit and export.

## Features

- Image upload and local processing (no account required)
- Automatic color palette extraction
- Character sheet scaffold (name, vibe, colors, notes)
- Lightweight web UI for review and edits

## Quick start

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
python -m app.main
```

Open [http://127.0.0.1:7860](http://127.0.0.1:7860).

## Project layout

```
app/
  main.py              # entry point
  image_analysis.py    # palette + image stats
  character_builder.py # image → character sheet
  static/              # CSS / JS
  templates/           # HTML
uploads/               # local uploads (gitignored)
outputs/               # exported sheets (gitignored)
```

## License

MIT
