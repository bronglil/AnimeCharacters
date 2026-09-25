"""Generate synthetic fixture images used by accuracy tests."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"


def _save(img: Image.Image, name: str) -> Path:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    path = FIXTURE_DIR / name
    img.save(path)
    return path


def generate_all() -> list[Path]:
    """Create 15 varied test images and return their paths."""
    paths: list[Path] = []

    # 1 pure black / white / gray
    paths.append(_save(Image.new("RGB", (200, 200), (0, 0, 0)), "01_black.png"))
    paths.append(_save(Image.new("RGB", (200, 200), (255, 255, 255)), "02_white.png"))
    paths.append(_save(Image.new("RGB", (200, 200), (128, 128, 128)), "03_gray.png"))

    # 4 horizontal gradient
    grad = Image.new("RGB", (256, 128))
    for x in range(256):
        for y in range(128):
            grad.putpixel((x, y), (x, x, x))
    paths.append(_save(grad, "04_hgradient.png"))

    # 5 vertical gradient
    vgrad = Image.new("RGB", (128, 256))
    for y in range(256):
        for x in range(128):
            vgrad.putpixel((x, y), (y, y, y))
    paths.append(_save(vgrad, "05_vgradient.png"))

    # 6 filled circle (bright on dark)
    circ = Image.new("RGB", (256, 256), (10, 10, 10))
    d = ImageDraw.Draw(circ)
    d.ellipse((48, 48, 208, 208), fill=(240, 240, 240))
    paths.append(_save(circ, "06_circle_light.png"))

    # 7 dark circle on light (silhouette disk)
    disk = Image.new("RGB", (256, 256), (245, 245, 245))
    d = ImageDraw.Draw(disk)
    d.ellipse((48, 48, 208, 208), fill=(15, 15, 15))
    paths.append(_save(disk, "07_circle_dark.png"))

    # 8 bust-like silhouette (head + shoulders) — similar to the example style
    bust = Image.new("RGB", (320, 400), (250, 250, 250))
    d = ImageDraw.Draw(bust)
    d.ellipse((110, 30, 210, 150), fill=(20, 20, 20))  # head
    d.rectangle((140, 140, 180, 210), fill=(20, 20, 20))  # neck
    d.polygon([(40, 380), (280, 380), (220, 210), (100, 210)], fill=(20, 20, 20))  # shoulders
    paths.append(_save(bust, "08_bust_silhouette.png"))

    # 9 inverted bust (dark bg, light subject) — terminal aesthetic
    bust_inv = Image.new("RGB", (320, 400), (8, 8, 8))
    d = ImageDraw.Draw(bust_inv)
    d.ellipse((110, 30, 210, 150), fill=(230, 230, 230))
    d.rectangle((140, 140, 180, 210), fill=(210, 210, 210))
    d.polygon([(40, 380), (280, 380), (220, 210), (100, 210)], fill=(200, 200, 200))
    paths.append(_save(bust_inv, "09_bust_on_dark.png"))

    # 10 checkerboard
    check = Image.new("RGB", (256, 256))
    for y in range(256):
        for x in range(256):
            c = 255 if ((x // 32) + (y // 32)) % 2 == 0 else 0
            check.putpixel((x, y), (c, c, c))
    paths.append(_save(check, "10_checker.png"))

    # 11 soft portrait-ish oval with hair band
    portrait = Image.new("RGB", (300, 360), (30, 40, 55))
    d = ImageDraw.Draw(portrait)
    d.ellipse((70, 40, 230, 230), fill=(220, 190, 170))  # face
    d.ellipse((60, 20, 240, 120), fill=(25, 20, 35))  # hair
    d.ellipse((110, 120, 130, 140), fill=(40, 30, 30))  # eye
    d.ellipse((170, 120, 190, 140), fill=(40, 30, 30))
    d.polygon([(40, 350), (260, 350), (210, 230), (90, 230)], fill=(70, 90, 140))  # shirt
    paths.append(_save(portrait, "11_soft_portrait.png"))

    # 12 anime-ish high contrast face block
    anime = Image.new("RGB", (280, 320), (250, 250, 252))
    d = ImageDraw.Draw(anime)
    d.ellipse((50, 20, 230, 220), fill=(255, 230, 220))
    d.polygon([(40, 10), (240, 10), (220, 90), (60, 90)], fill=(40, 60, 140))  # hair
    d.line((90, 120, 120, 120), fill=(20, 20, 20), width=3)
    d.line((160, 120, 190, 120), fill=(20, 20, 20), width=3)
    d.arc((120, 150, 160, 180), 20, 160, fill=(180, 60, 80), width=3)
    d.rectangle((80, 230, 200, 310), fill=(240, 120, 140))
    paths.append(_save(anime, "12_anime_face.png"))

    # 13 stripes
    stripes = Image.new("RGB", (240, 180), (255, 255, 255))
    d = ImageDraw.Draw(stripes)
    for i in range(0, 240, 20):
        d.rectangle((i, 0, i + 10, 180), fill=(0, 0, 0))
    paths.append(_save(stripes, "13_stripes.png"))

    # 14 small icon-like diamond
    diamond = Image.new("RGB", (200, 200), (255, 255, 255))
    d = ImageDraw.Draw(diamond)
    d.polygon([(100, 20), (180, 100), (100, 180), (20, 100)], fill=(0, 0, 0))
    paths.append(_save(diamond, "14_diamond.png"))

    # 15 noisy midtone field (tests autocontrast stability)
    noisy = Image.new("RGB", (200, 200))
    for y in range(200):
        for x in range(200):
            v = 100 + ((x * 17 + y * 31) % 50)
            noisy.putpixel((x, y), (v, v, v))
    paths.append(_save(noisy, "15_noise_mid.png"))

    # 16 tall portrait aspect
    tall = Image.new("RGB", (120, 300), (240, 240, 240))
    d = ImageDraw.Draw(tall)
    d.ellipse((25, 10, 95, 90), fill=(10, 10, 10))
    d.rectangle((45, 85, 75, 140), fill=(10, 10, 10))
    d.rectangle((10, 140, 110, 290), fill=(10, 10, 10))
    paths.append(_save(tall, "16_tall_bust.png"))

    # 17 transparent PNG with alpha subject
    rgba = Image.new("RGBA", (200, 200), (0, 0, 0, 0))
    d = ImageDraw.Draw(rgba)
    d.ellipse((40, 40, 160, 160), fill=(20, 20, 20, 255))
    paths.append(_save(rgba, "17_alpha_circle.png"))

    # 18 color photo stand-in (saturated regions)
    color = Image.new("RGB", (240, 240), (20, 20, 30))
    d = ImageDraw.Draw(color)
    d.ellipse((60, 40, 180, 170), fill=(255, 180, 90))
    d.rectangle((70, 170, 170, 230), fill=(40, 140, 220))
    paths.append(_save(color, "18_color_subject.png"))

    return paths


if __name__ == "__main__":
    for p in generate_all():
        print(p)
