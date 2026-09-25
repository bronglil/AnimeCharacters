"""Core image → ASCII converter (accuracy-focused)."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Literal

from PIL import Image, ImageOps

from .luminance import (
    apply_gamma,
    lightness_lstar,
    percentile_stretch,
    relative_luminance,
    srgb_to_linear,
)
from .ramps import DEFAULT_RAMP, get_ramp

Style = Literal["fill", "relief", "auto"]
Metric = Literal["lstar", "average"]


@dataclass(frozen=True)
class AsciiOptions:
    columns: int = 80
    cell_aspect: float = 0.5
    ramp: str = DEFAULT_RAMP
    invert: bool = False
    autocontrast: bool = True
    brightness: float = 0.0
    contrast: float = 1.0
    gamma: float = 1.0
    edge_boost: float = 0.0
    dither: bool = False
    metric: Metric = "lstar"
    style: Style = "auto"
    relief_hollow: float = 0.95
    relief_edge: float = 0.95
    relief_base: float = 0.8
    local_contrast: float = 0.35


def _clamp(v: float) -> float:
    return max(0.0, min(1.0, v))


def _sample_luma_grid(
    image: Image.Image,
    columns: int,
    cell_aspect: float,
    metric: Metric,
) -> list[list[float]]:
    columns = max(1, min(int(columns), 1000))
    cell_aspect = max(0.2, min(float(cell_aspect), 1.5))
    rgba = image.convert("RGBA")
    src_w, src_h = rgba.size
    rows = max(1, int(round((src_h / src_w) * columns * cell_aspect)))
    pix = rgba.load()
    grid: list[list[float]] = []

    for cy in range(rows):
        y0 = (cy * src_h) // rows
        y1 = ((cy + 1) * src_h) // rows
        row: list[float] = []
        for cx in range(columns):
            x0 = (cx * src_w) // columns
            x1 = ((cx + 1) * src_w) // columns
            sum_lin = 0.0
            sum_avg = 0.0
            n = 0
            for y in range(y0, max(y1, y0 + 1)):
                for x in range(x0, max(x1, x0 + 1)):
                    r, g, b, a = pix[x, y]
                    alpha = a / 255.0
                    if metric == "average":
                        sum_avg += ((r + g + b) * alpha) / (255.0 * 3.0)
                    else:
                        bg = 128.0
                        cr = r * alpha + bg * (1 - alpha)
                        cg = g * alpha + bg * (1 - alpha)
                        cb = b * alpha + bg * (1 - alpha)
                        sum_lin += relative_luminance(
                            srgb_to_linear(cr / 255.0),
                            srgb_to_linear(cg / 255.0),
                            srgb_to_linear(cb / 255.0),
                        )
                    n += 1
            if n == 0:
                row.append(0.5)
            elif metric == "average":
                row.append(sum_avg / n)
            else:
                row.append(lightness_lstar(sum_lin / n))
        grid.append(row)
    return grid


def _distance_transform(mask: list[list[bool]]) -> list[list[float]]:
    h = len(mask)
    w = len(mask[0]) if h else 0
    inf = float(h * w + 1)
    dist = [[0.0 if not mask[y][x] else inf for x in range(w)] for y in range(h)]

    for y in range(h):
        for x in range(w):
            if not mask[y][x]:
                continue
            if y > 0:
                dist[y][x] = min(dist[y][x], dist[y - 1][x] + 1)
            if x > 0:
                dist[y][x] = min(dist[y][x], dist[y][x - 1] + 1)
            if y > 0 and x > 0:
                dist[y][x] = min(dist[y][x], dist[y - 1][x - 1] + 1.414)
            if y > 0 and x + 1 < w:
                dist[y][x] = min(dist[y][x], dist[y - 1][x + 1] + 1.414)

    for y in range(h - 1, -1, -1):
        for x in range(w - 1, -1, -1):
            if not mask[y][x]:
                continue
            if y + 1 < h:
                dist[y][x] = min(dist[y][x], dist[y + 1][x] + 1)
            if x + 1 < w:
                dist[y][x] = min(dist[y][x], dist[y][x + 1] + 1)
            if y + 1 < h and x + 1 < w:
                dist[y][x] = min(dist[y][x], dist[y + 1][x + 1] + 1.414)
            if y + 1 < h and x > 0:
                dist[y][x] = min(dist[y][x], dist[y + 1][x - 1] + 1.414)
    return dist


def _apply_relief(grid: list[list[float]], opts: AsciiOptions) -> list[list[float]]:
    import math

    h = len(grid)
    w = len(grid[0]) if h else 0
    flat = [v for row in grid for v in row]
    ordered = sorted(flat)
    lo = ordered[int(len(ordered) * 0.05)] if ordered else 0.0
    hi = ordered[int(len(ordered) * 0.95)] if ordered else 1.0
    thr = (lo + hi) / 2.0
    mask = [[v < thr for v in row] for row in grid]
    ink = sum(1 for row in mask for v in row if v)
    if ink < w * h * 0.05:
        return [row[:] for row in grid]

    dist = _distance_transform(mask)
    max_d = max((dist[y][x] for y in range(h) for x in range(w) if mask[y][x]), default=1.0)
    max_d = max(max_d, 1e-6)

    out = [[1.0 for _ in range(w)] for _ in range(h)]
    for y in range(h):
        depth = 0.0 if h <= 1 else y / (h - 1)
        for x in range(w):
            if not mask[y][x]:
                out[y][x] = 1.0
                continue
            d = dist[y][x] / max_d
            edge = math.exp(-d * 5)
            hollow = (d ** 0.85) * opts.relief_hollow
            shoulders = (depth ** 1.6) * opts.relief_base
            face_lift = (1 - depth) * (1 - depth) * d * 0.55
            luma = _clamp(0.08 + hollow * 0.92 + face_lift)
            luma *= 1 - shoulders * 0.92
            luma = min(luma, 1 - edge * opts.relief_edge)
            luma = luma * 0.9 + grid[y][x] * 0.1
            out[y][x] = _clamp(luma)
    return out


def _local_contrast(grid: list[list[float]], amount: float) -> list[list[float]]:
    if amount <= 0:
        return grid
    h = len(grid)
    w = len(grid[0]) if h else 0
    out = [row[:] for row in grid]
    radius = 2
    for y in range(h):
        for x in range(w):
            total = 0.0
            n = 0
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w:
                        total += grid[yy][xx]
                        n += 1
            mean = total / n
            out[y][x] = _clamp(mean + (grid[y][x] - mean) * (1 + amount))
    return out


def _is_nearly_binary(grid: list[list[float]]) -> bool:
    flat = [v for row in grid for v in row]
    if not flat:
        return False
    extremes = sum(1 for v in flat if v < 0.2 or v > 0.8)
    return extremes / len(flat) > 0.85


def _edge_grid(grid: list[list[float]]) -> list[list[float]]:
    h = len(grid)
    w = len(grid[0]) if h else 0
    out = [[0.0] * w for _ in range(h)]
    max_v = 1e-9
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            gx = (
                -grid[y - 1][x - 1]
                + grid[y - 1][x + 1]
                - 2 * grid[y][x - 1]
                + 2 * grid[y][x + 1]
                - grid[y + 1][x - 1]
                + grid[y + 1][x + 1]
            )
            gy = (
                -grid[y - 1][x - 1]
                - 2 * grid[y - 1][x]
                - grid[y - 1][x + 1]
                + grid[y + 1][x - 1]
                + 2 * grid[y + 1][x]
                + grid[y + 1][x + 1]
            )
            mag = (gx * gx + gy * gy) ** 0.5
            out[y][x] = mag
            max_v = max(max_v, mag)
    return [[v / max_v for v in row] for row in out]


def _adjust(values: Iterable[float], opts: AsciiOptions) -> list[float]:
    data = list(values)
    if opts.autocontrast:
        data = percentile_stretch(data, 5.0, 95.0)
    out: list[float] = []
    for v in data:
        v = apply_gamma(v, opts.gamma)
        v = (v - 0.5) * opts.contrast + 0.5 + opts.brightness
        out.append(_clamp(v))
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
            work[y][x] = _clamp(new)
            err = old - new
            if x + 1 < w:
                work[y][x + 1] += err * 7 / 16
            if y + 1 < h and x > 0:
                work[y + 1][x - 1] += err * 3 / 16
            if y + 1 < h:
                work[y + 1][x] += err * 5 / 16
            if y + 1 < h and x + 1 < w:
                work[y + 1][x + 1] += err * 1 / 16
    return [[_clamp(v) for v in row] for row in work]


def _luma_to_char(luma: float, ramp: str, invert: bool) -> str:
    glyph_brightness = (1.0 - luma) if invert else luma
    idx = int(round((1.0 - glyph_brightness) * (len(ramp) - 1)))
    idx = max(0, min(len(ramp) - 1, idx))
    return ramp[idx]


def convert_image(image: Image.Image, options: AsciiOptions | None = None) -> str:
    opts = options or AsciiOptions()
    ramp = get_ramp(opts.ramp)
    if len(ramp) < 2:
        raise ValueError("Ramp needs at least 2 characters")

    frame = ImageOps.exif_transpose(image)
    grid = _sample_luma_grid(frame, opts.columns, opts.cell_aspect, opts.metric)

    use_relief = opts.style == "relief" or (opts.style == "auto" and _is_nearly_binary(grid))
    if use_relief:
        grid = _apply_relief(grid, opts)
    else:
        if opts.local_contrast > 0:
            grid = _local_contrast(grid, opts.local_contrast)
        if opts.edge_boost > 0:
            edges = _edge_grid(grid)
            boost = _clamp(opts.edge_boost)
            for y, row in enumerate(grid):
                for x, v in enumerate(row):
                    grid[y][x] = _clamp(v * (1.0 - boost * edges[y][x]))

    flat = [v for row in grid for v in row]
    adjust_opts = (
        AsciiOptions(
            columns=opts.columns,
            cell_aspect=opts.cell_aspect,
            ramp=opts.ramp,
            invert=opts.invert,
            autocontrast=False,
            brightness=opts.brightness,
            contrast=1.0,
            gamma=opts.gamma,
            edge_boost=opts.edge_boost,
            dither=opts.dither,
            metric=opts.metric,
            style=opts.style,
            relief_hollow=opts.relief_hollow,
            relief_edge=opts.relief_edge,
            relief_base=opts.relief_base,
            local_contrast=opts.local_contrast,
        )
        if use_relief
        else opts
    )
    adjusted = _adjust(flat, adjust_opts)
    h = len(grid)
    w = len(grid[0]) if grid else 0
    rebuilt = [adjusted[y * w : (y + 1) * w] for y in range(h)]
    if opts.dither:
        rebuilt = _floyd_steinberg(rebuilt, levels=len(ramp))

    return "\n".join(
        "".join(_luma_to_char(luma, ramp, opts.invert) for luma in row) for row in rebuilt
    )


def convert_path(path: str | Path, options: AsciiOptions | None = None) -> str:
    with Image.open(path) as img:
        frame = img.copy()
    return convert_image(frame, options)
