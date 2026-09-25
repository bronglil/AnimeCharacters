"""Character ramps ordered light → dark (ink density)."""

from __future__ import annotations

RAMPS: dict[str, str] = {
    # Same default palette as npm image-to-ascii / asciify-pixel
    "standard": " .,:;i1tfLCG08@",
    "classic": " .:-=+*#%@",
    "soft": " .,:;ox%#@",
    "compact": " .:oO@",
    "blocks": " ░▒▓█",
    "binary": " 01",
    "dense": " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
}

DEFAULT_RAMP = "standard"


def get_ramp(name_or_chars: str) -> str:
    key = name_or_chars.strip().lower()
    if key in RAMPS:
        return RAMPS[key]
    if not name_or_chars:
        raise ValueError("Ramp must be a non-empty character string")
    return name_or_chars


def ramp_density_scores(ramp: str) -> list[float]:
    n = max(len(ramp) - 1, 1)
    return [i / n for i in range(len(ramp))]
