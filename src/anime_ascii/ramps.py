"""Character ramps ordered light → dark (ink density).

The classic ramp matches the common silhouette bust aesthetic:
``. : - = + * # % @``
"""

from __future__ import annotations

RAMPS: dict[str, str] = {
    # Light → dark
    "classic": " .:-=+*#%@",
    "soft": " .,:;ox%#@",
    "compact": " .:oO@",
    "blocks": " ░▒▓█",
    "binary": " 01",
    "dense": " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
}

DEFAULT_RAMP = "classic"


def get_ramp(name_or_chars: str) -> str:
    """Return a built-in ramp by name, or treat the string as a custom ramp."""
    key = name_or_chars.strip().lower()
    if key in RAMPS:
        return RAMPS[key]
    if not name_or_chars:
        raise ValueError("Ramp must be a non-empty character string")
    return name_or_chars


def ramp_density_scores(ramp: str) -> list[float]:
    """Normalized 0..1 density index for each character in the ramp."""
    n = max(len(ramp) - 1, 1)
    return [i / n for i in range(len(ramp))]
