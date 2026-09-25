"""Unit tests for luminance helpers."""

from anime_ascii.luminance import lightness_lstar, relative_luminance, srgb8_to_lstar, srgb_to_linear


def test_black_and_white_lstar_extremes():
    assert srgb8_to_lstar(0, 0, 0) < 0.02
    assert srgb8_to_lstar(255, 255, 255) > 0.98


def test_linear_monotonic():
    assert srgb_to_linear(0.0) == 0.0
    assert srgb_to_linear(1.0) == 1.0
    assert srgb_to_linear(0.2) < srgb_to_linear(0.8)


def test_green_contributes_most_to_luminance():
    y_r = relative_luminance(1, 0, 0)
    y_g = relative_luminance(0, 1, 0)
    y_b = relative_luminance(0, 0, 1)
    assert y_g > y_r > y_b
    assert 0.0 <= lightness_lstar(y_g) <= 1.0
