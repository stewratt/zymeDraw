#!/usr/bin/env python3
"""Punch rounded-corner alpha into the card_template/ plates.

The scanned templates arrive with square PNG corners: the card's rounded
edge is real, but the triangle outside it is near-opaque WHITE, not alpha.
This script multiplies an antialiased rounded-rectangle mask into each
plate's alpha channel so the corners go truly transparent.

The radius law (keep in sync with frontend/src/foundry/cardCorners.js):
    R = CORNER_RADIUS_FRAC x image width
0.05 was chosen by measuring every corner of the original 8 plates — the
white triangles need R >= ~0.0472 of width to be fully covered.

Safe to re-run: pristine copies are kept in card_template/originals/ on
first run, and every run re-masks FROM those copies, so the mask never
compounds. New plates dropped into card_template/ just work — run again.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

CORNER_RADIUS_FRAC = 0.05
SUPERSAMPLE = 4  # draw the mask at 4x and downsample for smooth arcs

REPO = Path(__file__).resolve().parent.parent
TEMPLATES = REPO / "card_template"
ORIGINALS = TEMPLATES / "originals"


def corner_mask(width, height):
    """8-bit L mask: 255 inside the rounded rect, antialiased arcs."""
    big = Image.new("L", (width * SUPERSAMPLE, height * SUPERSAMPLE), 0)
    radius = round(width * SUPERSAMPLE * CORNER_RADIUS_FRAC)
    ImageDraw.Draw(big).rounded_rectangle(
        [0, 0, big.width - 1, big.height - 1], radius=radius, fill=255
    )
    return big.resize((width, height), Image.LANCZOS)


def main():
    plates = sorted(p for p in TEMPLATES.glob("*.png"))
    if not plates:
        raise SystemExit(f"No .png plates found in {TEMPLATES}")
    ORIGINALS.mkdir(exist_ok=True)

    masks = {}  # one mask per distinct size
    for plate in plates:
        original = ORIGINALS / plate.name
        if not original.exists():
            original.write_bytes(plate.read_bytes())

        im = Image.open(original).convert("RGBA")
        if im.size not in masks:
            masks[im.size] = np.asarray(corner_mask(*im.size), dtype=np.uint16)
        mask = masks[im.size]

        px = np.asarray(im, dtype=np.uint8).copy()
        px[:, :, 3] = (px[:, :, 3].astype(np.uint16) * mask // 255).astype(np.uint8)
        Image.fromarray(px, "RGBA").save(plate)
        print(f"rounded {plate.name}  ({im.width}x{im.height}, R={round(im.width * CORNER_RADIUS_FRAC)}px)")

    print(f"\n{len(plates)} plates masked; pristine copies in {ORIGINALS}")


if __name__ == "__main__":
    main()
