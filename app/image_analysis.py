"""Extract simple visual cues from a reference image."""

from __future__ import annotations

from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path

from PIL import Image, ImageStat


@dataclass
class ImageProfile:
    width: int
    height: int
    brightness: float
    dominant_colors: list[str]
    orientation: str

    def to_dict(self) -> dict:
        return asdict(self)


def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def _quantize_color(rgb: tuple[int, ...], step: int = 32) -> tuple[int, int, int]:
    return tuple(min(255, (c // step) * step) for c in rgb[:3])  # type: ignore[return-value]


def analyze_image(path: str | Path, palette_size: int = 5) -> ImageProfile:
    path = Path(path)
    with Image.open(path) as img:
        rgb = img.convert("RGB")
        width, height = rgb.size
        stat = ImageStat.Stat(rgb)
        brightness = sum(stat.mean) / (3 * 255)

        # Sample pixels for a compact palette (fast, dependency-light).
        thumb = rgb.copy()
        thumb.thumbnail((120, 120))
        counts = Counter(_quantize_color(px) for px in thumb.getdata())
        dominant = [_rgb_to_hex(c) for c, _ in counts.most_common(palette_size)]

        if width > height * 1.15:
            orientation = "landscape"
        elif height > width * 1.15:
            orientation = "portrait"
        else:
            orientation = "square"

        return ImageProfile(
            width=width,
            height=height,
            brightness=round(brightness, 3),
            dominant_colors=dominant,
            orientation=orientation,
        )
