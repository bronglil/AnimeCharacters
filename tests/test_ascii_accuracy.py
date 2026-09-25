"""Accuracy and regression tests for anime_ascii."""

from __future__ import annotations

from collections import Counter
from pathlib import Path

import pytest
from PIL import Image

from anime_ascii import AsciiOptions, RAMPS, convert_image, convert_path, get_ramp
from anime_ascii.ramps import ramp_density_scores
from fixtures_gen import FIXTURE_DIR, generate_all

EXAMPLE_SRC = Path(
    r"C:\Users\Sajid\.cursor\projects\c-Users-Sajid-Desktop-QGIS\assets"
    r"\c__Users_Sajid_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"083ff2748965de5137b867457bcccd09_images_image-28088eb6-fa54-45ea-a815-24cb2e479d8c.png"
)


@pytest.fixture(scope="session")
def fixtures() -> list[Path]:
    return generate_all()


def _char_density(ch: str, ramp: str) -> float:
    if ch not in ramp:
        return 0.0
    return ramp.index(ch) / max(len(ramp) - 1, 1)


def _mean_density(art: str, ramp: str) -> float:
    chars = [c for c in art if c != "\n"]
    if not chars:
        return 0.0
    return sum(_char_density(c, ramp) for c in chars) / len(chars)


def test_ramps_light_to_dark_order():
    scores = ramp_density_scores(get_ramp("classic"))
    assert scores == sorted(scores)
    assert get_ramp("classic")[0] in {" ", "."}
    assert get_ramp("classic")[-1] == "@"


def test_all_fixtures_convert(fixtures: list[Path]):
    assert len(fixtures) >= 15
    ramp = get_ramp("classic")
    for path in fixtures:
        art = convert_path(
            path,
            AsciiOptions(columns=60, invert=True, edge_boost=0.1),
        )
        lines = art.splitlines()
        assert lines, f"empty output for {path.name}"
        assert all(len(line) == 60 for line in lines), path.name
        # Only ramp characters
        for ch in art.replace("\n", ""):
            assert ch in ramp, f"unexpected {ch!r} in {path.name}"


def test_black_vs_white_mapping():
    ramp = get_ramp("classic")
    black = Image.new("RGB", (64, 64), (0, 0, 0))
    white = Image.new("RGB", (64, 64), (255, 255, 255))

    # Without invert: dark → dense (@), bright → light (space/.)
    dark_art = convert_image(black, AsciiOptions(columns=40, autocontrast=False, invert=False, edge_boost=0))
    light_art = convert_image(white, AsciiOptions(columns=40, autocontrast=False, invert=False, edge_boost=0))
    assert _mean_density(dark_art, ramp) > 0.7
    assert _mean_density(light_art, ramp) < 0.3

    # With invert: dark image → light glyphs (terminal-style flip of ink)
    inv_dark = convert_image(black, AsciiOptions(columns=40, autocontrast=False, invert=True, edge_boost=0))
    assert _mean_density(inv_dark, ramp) < 0.3


def test_horizontal_gradient_density_increases_left_to_right_when_inverted_off(fixtures: list[Path]):
    path = FIXTURE_DIR / "04_hgradient.png"
    assert path.exists()
    ramp = get_ramp("classic")
    art = convert_path(
        path,
        AsciiOptions(columns=64, invert=False, autocontrast=False, edge_boost=0, brightness=0, contrast=1),
    )
    # Sample left quarter vs right quarter density
    rows = art.splitlines()
    left = []
    right = []
    for row in rows:
        mid = len(row) // 2
        left.extend(row[: mid // 2])
        right.extend(row[-(mid // 2) :])
    left_d = sum(_char_density(c, ramp) for c in left) / len(left)
    right_d = sum(_char_density(c, ramp) for c in right) / len(right)
    # Left is darker in the fixture → higher density without invert
    assert left_d > right_d + 0.15


def test_bust_silhouette_center_darker_than_corners(fixtures: list[Path]):
    path = FIXTURE_DIR / "08_bust_silhouette.png"
    ramp = get_ramp("classic")
    art = convert_path(
        path,
        AsciiOptions(columns=70, invert=False, autocontrast=True, edge_boost=0.2),
    )
    rows = art.splitlines()
    h, w = len(rows), len(rows[0])

    def region_density(x0, x1, y0, y1) -> float:
        vals = []
        for y in range(y0, y1):
            for x in range(x0, x1):
                vals.append(_char_density(rows[y][x], ramp))
        return sum(vals) / len(vals)

    center = region_density(w // 3, 2 * w // 3, h // 4, 3 * h // 4)
    corner = region_density(0, w // 6, 0, h // 6)
    assert center > corner + 0.2


def test_custom_ramp_and_columns():
    img = Image.new("RGB", (50, 50), (0, 0, 0))
    art = convert_image(img, AsciiOptions(columns=20, ramp="01", autocontrast=False, invert=False, edge_boost=0))
    assert set(art.replace("\n", "")) <= {"0", "1"}
    assert all(len(line) == 20 for line in art.splitlines())


def test_each_builtin_ramp_on_bust(fixtures: list[Path]):
    path = FIXTURE_DIR / "08_bust_silhouette.png"
    for name in RAMPS:
        art = convert_path(path, AsciiOptions(columns=50, ramp=name, invert=True))
        assert art.strip()
        assert len(art.splitlines()) >= 5


def test_user_example_image_if_present():
    """Regression: user's ASCII-style bust screenshot converts cleanly."""
    if not EXAMPLE_SRC.exists():
        pytest.skip("example image not on disk")
    dest = FIXTURE_DIR / "19_user_example.png"
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    Image.open(EXAMPLE_SRC).convert("RGB").save(dest)

    art = convert_path(
        dest,
        AsciiOptions(columns=72, invert=True, edge_boost=0.25, contrast=1.2),
    )
    lines = art.splitlines()
    assert len(lines) >= 10
    assert all(len(line) == 72 for line in lines)
    # Should use a mix of glyphs, not a single flat character
    counts = Counter(art.replace("\n", ""))
    assert len(counts) >= 4


def test_batch_report_all_fixtures(fixtures: list[Path], tmp_path: Path):
    """Convert every fixture and write outputs for manual inspection."""
    out_dir = tmp_path / "ascii_out"
    out_dir.mkdir()
    report = []
    for path in fixtures:
        art = convert_path(
            path,
            AsciiOptions(columns=64, invert=True, edge_boost=0.15),
        )
        target = out_dir / f"{path.stem}.txt"
        target.write_text(art + "\n", encoding="utf-8")
        report.append((path.name, len(art.splitlines()), _mean_density(art, get_ramp("classic"))))
    assert len(report) == len(fixtures)
    # Sanity: not all identical densities
    densities = [d for _, _, d in report]
    assert max(densities) - min(densities) > 0.05


def test_checker_has_both_light_and_dense(fixtures: list[Path]):
    path = FIXTURE_DIR / "10_checker.png"
    ramp = get_ramp("classic")
    art = convert_path(path, AsciiOptions(columns=64, invert=False, autocontrast=False, edge_boost=0))
    dens = [_char_density(c, ramp) for c in art.replace("\n", "")]
    assert min(dens) < 0.25
    assert max(dens) > 0.75
