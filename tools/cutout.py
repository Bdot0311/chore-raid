"""Cut a game sprite out of a flat-color background and save it as a web-ready WebP.

The art is generated on a plain gray background on purpose, so a flood fill from
the image border finds it reliably without a matting model.

    python3 tools/cutout.py input.webp public/art/laundry-1.webp [--max 1024]
"""

import argparse

import numpy as np
from PIL import Image
from scipy import ndimage


def cutout(img: Image.Image, hard: float, soft: float, holes: bool = False) -> Image.Image:
    rgb = np.asarray(img.convert("RGB")).astype(np.float32)
    h, w, _ = rgb.shape

    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.linalg.norm(rgb - bg, axis=2)

    # Background = near-bg pixels connected to the border, so gray inside the character survives.
    near = dist < hard
    labels, _ = ndimage.label(near)
    edge_labels = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    background = np.isin(labels, edge_labels[edge_labels > 0])

    # Gaps enclosed by the character (between a hydra's necks) don't touch the border,
    # so also clear large blobs that match the background very closely.
    if holes:
        tight = dist < hard * 0.5
        hl, n = ndimage.label(tight & ~background)
        if n:
            sizes = ndimage.sum(np.ones_like(dist), hl, range(1, n + 1))
            big = np.flatnonzero(sizes > h * w * 0.0006) + 1
            background |= ndimage.binary_dilation(np.isin(hl, big), iterations=1) & near

    alpha = np.ones((h, w), np.float32)
    alpha[background] = 0
    # Feather a thin band around the background so edges and the rim glow fade instead of stair-stepping.
    band = ndimage.binary_dilation(background, iterations=3) & ~background
    alpha[band] = np.clip((dist[band] - hard) / (soft - hard), 0, 1)
    alpha = ndimage.gaussian_filter(alpha, 0.6)
    alpha[background] = 0

    # Remove the gray that bled into semi-transparent edge pixels.
    a = alpha[..., None]
    safe = np.maximum(a, 1e-3)
    unmixed = np.where(a > 0, (rgb - (1 - a) * bg) / safe, 0)
    out = np.dstack([np.clip(unmixed, 0, 255), alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("src")
    p.add_argument("dst")
    p.add_argument("--max", type=int, default=1024)
    p.add_argument("--hard", type=float, default=26)
    p.add_argument("--soft", type=float, default=70)
    p.add_argument("--pad", type=int, default=16)
    p.add_argument("--holes", action="store_true", help="also clear background-colored gaps enclosed by the character")
    args = p.parse_args()

    sprite = cutout(Image.open(args.src), args.hard, args.soft, args.holes)
    x0, y0, x1, y1 = sprite.getbbox()
    sprite = sprite.crop((max(0, x0 - args.pad), max(0, y0 - args.pad), x1 + args.pad, y1 + args.pad))
    sprite.thumbnail((args.max, args.max), Image.LANCZOS)
    sprite.save(args.dst, "WEBP", quality=86, method=6)
    print(f"{args.dst}: {sprite.size[0]}x{sprite.size[1]}")


if __name__ == "__main__":
    main()
