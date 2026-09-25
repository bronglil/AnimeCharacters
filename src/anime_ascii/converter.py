"""Core image → ASCII converter."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageFilter, ImageOps

from .luminance import apply_gamma, percentile_stretch, srgb8_to_lstar
from .ramps import DEFAULT_RAMP, get_ramp


@dataclass(frozen=True)
class AsciiOptions:
    """Conversion controls.

    Attributes:
        columns: Output width in characters.
        cell_aspect: Character cell width/height. ~0.45–0.55 suits most monospace fonts.
        ramp: Built-in ramp name or a custom light→dark character string.
        invert: Flip mapping (useful on dark terminals so dark image areas become dense glyphs).
        autocontrast: Percentile-stretch luminance before mapping.
        brightness: Added after stretch (-1..1).
        contrast: Multiplier around mid-gray (1.0 = off).
        gamma: Gamma adjust (>0).
        edge_boost: 0..1 blend of edge magnitude into darkness (helps silhouette outlines).
        dither: Floyd–Steinberg dithering across the luminance grid.
    """

    columns: int = 80
    cell_aspect: float = 0.5
    ramp: str = DEFAULT_RAMP
    invert: bool = False
    autocontrast: bool = True
    brightness: float = 0.0
    contrast: float = 1.0
    gamma: float = 1.0
    edge_boost: float = 0.15
    dither: bool = False


def _resize_for_cells(image: Image.Image, columns: int, cell_aspect: float) -> Image.Image:
    columns = max(1, min(int(columns), 1000))
    cell_aspect = max(0.2, min(float(cell_aspect), 1.5))
    src_w, src_h = image.size
    rows = max(1, int(round((src_h / src_w) * columns * cell_aspect)))
    return image.resize((columns, rows), Image.Resampling.LANCZOS)


def _cell_luminance_grid(rgb: Image.Image) -> list[list[float]]:
    """One L* value per output cell (linear-light aware)."""
    width, height = rgb.size
    pixels = rgb.load()
    grid: list[list[float]] = []
    for y in range(height):
        row: list[float] = []
        for x in range(width):
            r, g, b = pixels[x, y][:3]
            row.append(srgb8_to_lstar(r, g, b))
        grid.append(row)
    return grid


def _edge_grid(gray: Image.Image) -> list[list[float]]:
    edges = gray.filter(ImageFilter.FIND_EDGES)
    width, height = edges.size
    pix = edges.load()
    return [[pix[x, y] / 255.0 for x in range(width)] for y in range(height)]


def _adjust(values: Iterable[float], opts: AsciiOptions) -> list[float]:
    data = list(values)
    if opts.autocontrast:
        data = percentile_stretch(data)
    out: list[float] = []
    for v in data:
        v = apply_gamma(v, opts.gamma)
        v = (v - 0.5) * opts.contrast + 0.5 + opts.brightness
        out.append(max(0.0, min(1.0, v)))
    return out


def _floyd_steinberg(grid: list[list[float]], levels: int) -> list[list[float]]:
    h = len(grid)
    w = len(grid[0]) if h else 0
    work = [row[:] for row in grid]
    step = 1.0 / max(levels - 1, 1)
    for y in range(h):
        for x in range(w):
            old = work[y][x]
            new = round(old / step) * step
            work[y][x] = max(0.0, min(1.0, new))
            err = old - new
            if x + 1 < w:
                work[y][x + 1] += err * 7 / 16
            if y + 1 < h and x > 0:
                work[y + 1][x - 1] += err * 3 / 16
            if y + 1 < h:
                work[y + 1][x] += err * 5 / 16
            if y + 1 < h and x + 1 < w:
                work[y + 1][x + 1] += err * 1 / 16
    return [[max(0.0, min(1.0, v)) for v in row] for row in work]


def _luma_to_char(luma: float, ramp: str, invert: bool) -> str:
    """Map brightness to a ramp character.

    Bright areas → early (light) glyphs; dark areas → late (dense) glyphs.
    With ``invert=True``, dark image regions become dense glyphs (good for dark terminals).
    """
    glyph_brightness = (1.0 - luma) if invert else luma
    idx = int(round((1.0 - glyph_brightness) * (len(ramp) - 1)))
    idx = max(0, min(len(ramp) - 1, idx))
    return ramp[idx]


def convert_image(image: Image.Image, options: AsciiOptions | None = None) -> str:
    """Convert a PIL image to an ASCII art string."""
    opts = options or AsciiOptions()
    ramp = get_ramp(opts.ramp)
    if len(ramp) < 2:
        raise ValueError("Ramp needs at least 2 characters")

    rgba = ImageOps.exif_transpose(image).convert("RGBA")
    background = Image.new("RGBA", rgba.size, (128, 128, 128, 255))
    composed = Image.alpha_composite(background, rgba).convert("RGB")

    resized = _resize_for_cells(composed, opts.columns, opts.cell_aspect)
    grid = _cell_luminance_grid(resized)

    if opts.edge_boost > 0:
        edges = _edge_grid(resized.convert("L"))
        boost = max(0.0, min(1.0, opts.edge_boost))
        for y, row in enumerate(grid):
            for x, v in enumerate(row):
                grid[y][x] = max(0.0, min(1.0, v * (1.0 - boost * edges[y][x])))

    flat = [v for row in grid for v in row]
    adjusted = _adjust(flat, opts)
    h = len(grid)
    w = len(grid[0]) if grid else 0
    rebuilt = [adjusted[y * w : (y + 1) * w] for y in range(h)]

    if opts.dither:
        rebuilt = _floyd_steinberg(rebuilt, levels=len(ramp))

    lines = [
        "".join(_luma_to_char(luma, ramp, opts.invert) for luma in row)
        for row in rebuilt
    ]
    return "\n".join(lines)


def convert_path(path: str | Path, options: AsciiOptions | None = None) -> str:
    """Convert an image file path to ASCII art."""
    with Image.open(path) as img:
        frame = img.copy()
    return convert_image(frame, options)
