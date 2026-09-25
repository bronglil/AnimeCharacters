"""Turn an image profile into an editable anime character sheet."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path

from .image_analysis import ImageProfile, analyze_image


@dataclass
class CharacterSheet:
    name: str
    series_vibe: str
    hair_color: str
    eye_color: str
    outfit_colors: list[str]
    mood: str
    notes: str
    source_image: str
    profile: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


def _mood_from_brightness(brightness: float) -> str:
    if brightness < 0.35:
        return "mysterious / night"
    if brightness > 0.7:
        return "bright / cheerful"
    return "balanced / everyday"


def _vibe_from_palette(colors: list[str]) -> str:
    if not colors:
        return "soft slice-of-life"
    # Heuristic: cooler leading hexes lean "cool anime"; warmer lean shonen/energy.
    lead = colors[0].lstrip("#")
    r, g, b = int(lead[0:2], 16), int(lead[2:4], 16), int(lead[4:6], 16)
    if b > r and b > g:
        return "cool / supernatural"
    if r > g and r > b:
        return "energetic / action"
    return "pastel / gentle"


def build_character_from_image(
    image_path: str | Path,
    name: str = "Untitled Character",
) -> CharacterSheet:
    path = Path(image_path)
    profile: ImageProfile = analyze_image(path)
    colors = profile.dominant_colors
    hair = colors[0] if colors else "#333333"
    eyes = colors[1] if len(colors) > 1 else "#224466"
    outfit = colors[2:5] if len(colors) > 2 else colors

    return CharacterSheet(
        name=name.strip() or "Untitled Character",
        series_vibe=_vibe_from_palette(colors),
        hair_color=hair,
        eye_color=eyes,
        outfit_colors=outfit,
        mood=_mood_from_brightness(profile.brightness),
        notes=(
            f"Derived from {path.name} "
            f"({profile.width}x{profile.height}, {profile.orientation}). "
            "Edit fields to refine the design."
        ),
        source_image=path.name,
        profile=profile.to_dict(),
    )
