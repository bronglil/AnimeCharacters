"""Unit tests for image profile → character sheet mapping."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

from app.character_builder import build_character_from_image
from app.image_analysis import analyze_image


def test_analyze_image_returns_palette(tmp_path: Path) -> None:
    path = tmp_path / "sample.png"
    Image.new("RGB", (64, 96), color=(40, 90, 200)).save(path)

    profile = analyze_image(path)

    assert profile.width == 64
    assert profile.height == 96
    assert profile.orientation == "portrait"
    assert len(profile.dominant_colors) >= 1
    assert profile.dominant_colors[0].startswith("#")


def test_build_character_from_image(tmp_path: Path) -> None:
    path = tmp_path / "ref.jpg"
    Image.new("RGB", (120, 80), color=(210, 60, 50)).save(path)

    sheet = build_character_from_image(path, name="Aoi")

    assert sheet.name == "Aoi"
    assert sheet.hair_color.startswith("#")
    assert "energetic" in sheet.series_vibe or "action" in sheet.series_vibe
    assert sheet.source_image == "ref.jpg"
