# Looks and styles

## Looks (locked presets)

| `look` | Columns | Portrait columns | Use when |
|--------|---------|------------------|----------|
| `ascii` (default) | **56** | **64** | Readable colored characters |
| `dense` | **72** | **80** | Maximum detail when readability is secondary (gallery zoom, print mosaics). Prefer explicit `columns` if you only need width. |

`LOOK_PRESETS` and `PORTRAIT_COLUMNS` are exported and tested so gallery, CLI, and API stay aligned.

## Styles

| `style` | Behavior |
|---------|----------|
| `fill` | Solid fill from luminance |
| `relief` | Hollow-face / silhouette relief |
| `portrait` | Wider columns, facial edge preservation |
| `anime` | Same geometry as portrait + cel outline polish (silhouette, soft skin bands) — **does not morph the face** |
| `auto` | Heuristic pick |

### Anime touch

`--style anime` keeps identity (eyes, nose, mouth placement). It strengthens outline (helps ears/hair) and softens skin planes so the result feels like an anime character card without relocating features.
