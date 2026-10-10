#!/usr/bin/env python3
"""Generate the app icon and tray icons (with unread badges) as PNGs.

Requires Pillow. Output goes to assets/; the generated files are committed so
this only needs re-running when the artwork changes.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
FONT = "/usr/share/fonts/abattis-cantarell-fonts/Cantarell-Bold.otf"

TOP = (123, 131, 235)      # #7B83EB
BOTTOM = (75, 83, 188)     # #4B53BC
BADGE = (196, 49, 75)      # #C4314B
WHITE = (255, 255, 255, 255)

SS = 4  # supersampling factor for anti-aliasing


def gradient_tile(size, margin_ratio, radius_ratio):
    big = size * SS
    margin = round(big * margin_ratio)
    grad = Image.new("RGBA", (big, big))
    px = grad.load()
    for y in range(big):
        t = y / (big - 1)
        c = tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)) + (255,)
        for x in range(big):
            px[x, y] = c
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (margin, margin, big - margin - 1, big - margin - 1),
        radius=round((big - 2 * margin) * radius_ratio),
        fill=255,
    )
    tile = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    tile.paste(grad, (0, 0), mask)
    return tile, margin


def draw_centered(draw, box, text, font, fill):
    x0, y0, x1, y1 = box
    l, t, r, b = draw.textbbox((0, 0), text, font=font)
    draw.text(((x0 + x1 - (r - l)) / 2 - l, (y0 + y1 - (b - t)) / 2 - t), text, font=font, fill=fill)


def app_icon(size, margin_ratio=0.06):
    tile, margin = gradient_tile(size, margin_ratio, 0.22)
    big = tile.width
    draw = ImageDraw.Draw(tile)
    font = ImageFont.truetype(FONT, round((big - 2 * margin) * 0.68))
    draw_centered(draw, (margin, margin, big - margin, big - margin), "T", font, WHITE)
    return tile


def tray_icon(label):
    size = 64
    tile = app_icon(size, margin_ratio=0.02)
    if label:
        big = tile.width
        draw = ImageDraw.Draw(tile)
        d = round(big * 0.58)
        ring = round(big * 0.045)
        x1, y0 = big, 0
        draw.ellipse((x1 - d, y0, x1 - 1, y0 + d - 1), fill=WHITE)
        draw.ellipse((x1 - d + ring, y0 + ring, x1 - 1 - ring, y0 + d - 1 - ring), fill=BADGE + (255,))
        font = ImageFont.truetype(FONT, round(d * (0.62 if len(label) == 1 else 0.46)))
        draw_centered(draw, (x1 - d, y0, x1, y0 + d), label, font, WHITE)
    return tile.resize((size, size), Image.LANCZOS)


def badge_icon(label):
    """Badge alone, for the Windows taskbar overlay."""
    size = 32
    big = size * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    ring = round(big * 0.06)
    draw.ellipse((0, 0, big - 1, big - 1), fill=WHITE)
    draw.ellipse((ring, ring, big - 1 - ring, big - 1 - ring), fill=BADGE + (255,))
    font = ImageFont.truetype(FONT, round(big * (0.62 if len(label) == 1 else 0.46)))
    draw_centered(draw, (0, 0, big, big), label, font, WHITE)
    return img.resize((size, size), Image.LANCZOS)


def main():
    ASSETS.mkdir(exist_ok=True)
    (ASSETS / "tray").mkdir(exist_ok=True)
    for s in (16, 24, 32, 48, 64, 128, 256, 512):
        app_icon(s).resize((s, s), Image.LANCZOS).save(ASSETS / f"icon-{s}.png")
    tray_icon(None).save(ASSETS / "tray" / "tray-0.png")
    for n in range(1, 10):
        tray_icon(str(n)).save(ASSETS / "tray" / f"tray-{n}.png")
    tray_icon("9+").save(ASSETS / "tray" / "tray-10.png")
    (ASSETS / "badge").mkdir(exist_ok=True)
    for n in range(1, 10):
        badge_icon(str(n)).save(ASSETS / "badge" / f"badge-{n}.png")
    badge_icon("9+").save(ASSETS / "badge" / "badge-10.png")
    print(f"icons written to {ASSETS}")


if __name__ == "__main__":
    main()
