#!/usr/bin/env python3
"""Generate legacy launcher PNGs for the Toot mulberry icon (pre-API 26)."""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Install Pillow: pip install pillow", file=sys.stderr)
    sys.exit(1)

# Toot mulberry palette
BG = (243, 232, 255, 255)  # violet-100
MULBERRY_MAIN = (109, 40, 217, 255)  # violet-700
MULBERRY_DARK = (91, 33, 182, 255)  # violet-800
MULBERRY_HL = (196, 181, 253, 255)  # violet-300
LEAF = (34, 197, 94, 255)  # green-500
STEM = (124, 58, 237, 255)  # violet-600

ROOT = Path(__file__).resolve().parents[1] / "android" / "app" / "src" / "main" / "res"


def draw_berry(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int) -> None:
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=MULBERRY_MAIN)
    draw.ellipse([cx - int(r * 0.42), cy - int(r * 0.42), cx + int(r * 0.42), cy + int(r * 0.42)], fill=MULBERRY_DARK)
    hr = max(1, int(r * 0.18))
    draw.ellipse([cx - int(r * 0.38) - hr, cy - int(r * 0.38) - hr, cx - int(r * 0.38) + hr, cy - int(r * 0.38) + hr], fill=MULBERRY_HL)


def draw_composite(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = max(1, int(round(size * 0.04)))
    draw.rounded_rectangle(
        [pad, pad, size - pad, size - pad],
        radius=int(round(size * 0.22)),
        fill=BG,
    )

    # Stem + leaf + three mulberries.
    draw.polygon(
        [
            (int(size * 0.42), int(size * 0.26)),
            (int(size * 0.50), int(size * 0.18)),
            (int(size * 0.58), int(size * 0.26)),
            (int(size * 0.50), int(size * 0.32)),
        ],
        fill=STEM,
    )
    draw.polygon(
        [
            (int(size * 0.50), int(size * 0.30)),
            (int(size * 0.64), int(size * 0.24)),
            (int(size * 0.60), int(size * 0.35)),
        ],
        fill=LEAF,
    )

    r = int(size * 0.15)
    draw_berry(draw, int(size * 0.35), int(size * 0.45), r)
    draw_berry(draw, int(size * 0.50), int(size * 0.54), int(r * 1.05))
    draw_berry(draw, int(size * 0.65), int(size * 0.45), r)
    return img


def main() -> None:
    densities = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    for folder, px in densities.items():
        out_dir = ROOT / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        base = draw_composite(px)
        base.save(out_dir / "ic_launcher.png", "PNG")
        base.save(out_dir / "ic_launcher_round.png", "PNG")
        # Foreground used by some OEM launchers.
        fg = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        fg_draw = ImageDraw.Draw(fg)
        r = max(2, int(px * 0.145))
        draw_berry(fg_draw, int(px * 0.34), int(px * 0.47), r)
        draw_berry(fg_draw, int(px * 0.50), int(px * 0.56), int(r * 1.05))
        draw_berry(fg_draw, int(px * 0.66), int(px * 0.47), r)
        fg.save(out_dir / "ic_launcher_foreground.png", "PNG")
    print("Wrote launcher PNGs to", ROOT)


if __name__ == "__main__":
    main()
