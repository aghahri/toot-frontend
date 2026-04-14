#!/usr/bin/env python3
"""One-off generator for legacy mipmap launcher PNGs (pre-API 26). Requires Pillow."""
from __future__ import annotations

import math
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Install Pillow: pip install pillow", file=sys.stderr)
    sys.exit(1)

# Toot brand (aligned with web navbar sky → slate accent)
BG = (14, 165, 233)  # sky-500 #0ea5e9
FG = (255, 255, 255)

ROOT = Path(__file__).resolve().parents[1] / "android" / "app" / "src" / "main" / "res"


def draw_composite(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = max(1, int(round(size * 0.06)))
    draw.rounded_rectangle(
        [pad, pad, size - pad, size - pad],
        radius=int(round(size * 0.2)),
        fill=BG,
    )
    # Simple chat-bubble silhouette (minimal, readable at small sizes)
    cx, cy = size // 2, int(size * 0.46)
    bw = int(size * 0.34)
    bh = int(size * 0.26)
    tail = int(size * 0.08)
    bubble = [
        (cx - bw, cy - bh),
        (cx + bw, cy - bh),
        (cx + bw, cy + bh // 2),
        (cx - tail, cy + bh // 2 + tail),
        (cx - bw // 2, cy + bh // 3),
        (cx - bw, cy + bh // 2),
    ]
    draw.polygon(bubble, fill=FG)
    dot_r = max(2, int(size * 0.035))
    dcy = cy + bh // 6
    for dx in (-int(size * 0.09), 0, int(size * 0.09)):
        draw.ellipse(
            [cx + dx - dot_r, dcy - dot_r, cx + dx + dot_r, dcy + dot_r],
            fill=BG,
        )
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
        # Foreground plate used by some OEMs / tooling (keep consistent)
        fg = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        fg_draw = ImageDraw.Draw(fg)
        inset = int(px * 0.18)
        fg_draw.rounded_rectangle(
            [inset, inset, px - inset, px - inset],
            radius=int(px * 0.14),
            fill=FG,
        )
        fg.save(out_dir / "ic_launcher_foreground.png", "PNG")
    print("Wrote launcher PNGs to", ROOT)


if __name__ == "__main__":
    main()
