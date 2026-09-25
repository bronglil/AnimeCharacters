"""Color / luminance helpers for accurate downsampling."""

from __future__ import annotations

import math


def srgb_to_linear(c: float) -> float:
    """Convert a 0–1 sRGB channel to linear light."""
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def linear_to_srgb(c: float) -> float:
    c = max(0.0, min(1.0, c))
    if c <= 0.0031308:
        return 12.92 * c
    return 1.055 * (c ** (1.0 / 2.4)) - 0.055


def relative_luminance(r: float, g: float, b: float) -> float:
    """Rec. 709 relative luminance from linear RGB channels (0–1)."""
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def lightness_lstar(y: float) -> float:
    """CIE L* from relative luminance Y (0–1), returned as 0–1."""
    y = max(0.0, min(1.0, y))
    if y <= (6 / 29) ** 3:
        f = y * (29 / 6) ** 2 / 3 + 4 / 29
    else:
        f = y ** (1 / 3)
    return (116 * f - 16) / 100.0


def srgb8_to_lstar(r: int, g: int, b: int) -> float:
    lr = srgb_to_linear(r / 255.0)
    lg = srgb_to_linear(g / 255.0)
    lb = srgb_to_linear(b / 255.0)
    return lightness_lstar(relative_luminance(lr, lg, lb))


def apply_gamma(value: float, gamma: float) -> float:
    value = max(0.0, min(1.0, value))
    if abs(gamma - 1.0) < 1e-9:
        return value
    return value ** (1.0 / gamma) if gamma > 0 else value


def percentile_stretch(values: list[float], low_p: float = 2.0, high_p: float = 98.0) -> list[float]:
    """Stretch luminance so usable detail spans 0–1 (autocontrast)."""
    if not values:
        return values
    ordered = sorted(values)
    n = len(ordered)

    def pct(p: float) -> float:
        if n == 1:
            return ordered[0]
        idx = (p / 100.0) * (n - 1)
        lo = int(math.floor(idx))
        hi = min(lo + 1, n - 1)
        t = idx - lo
        return ordered[lo] * (1 - t) + ordered[hi] * t

    lo_v = pct(low_p)
    hi_v = pct(high_p)
    span = hi_v - lo_v
    if span < 1e-6:
        return [0.5 for _ in values]
    return [max(0.0, min(1.0, (v - lo_v) / span)) for v in values]
