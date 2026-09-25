"""Command-line interface for anime-ascii."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .converter import AsciiOptions, convert_path
from .ramps import RAMPS


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="anime-ascii",
        description="Convert images to accurate ASCII art (character silhouettes & portraits).",
    )
    p.add_argument("image", type=Path, help="Input image path")
    p.add_argument("-o", "--output", type=Path, help="Write text here instead of stdout")
    p.add_argument("-w", "--columns", type=int, default=80, help="Width in characters")
    p.add_argument("-r", "--ramp", default="classic", help=f"Ramp name or chars. Built-ins: {', '.join(RAMPS)}")
    p.add_argument("--cell-aspect", type=float, default=0.5, help="Character width/height ratio")
    p.add_argument("--invert", action="store_true", help="Dark image areas → dense glyphs")
    p.add_argument("--no-autocontrast", action="store_true")
    p.add_argument("--brightness", type=float, default=0.0)
    p.add_argument("--contrast", type=float, default=1.0)
    p.add_argument("--gamma", type=float, default=1.0)
    p.add_argument("--edge-boost", type=float, default=0.15)
    p.add_argument("--dither", action="store_true")
    p.add_argument("--list-ramps", action="store_true", help="Print built-in ramps and exit")
    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.list_ramps:
        for name, chars in RAMPS.items():
            print(f"{name:10} {chars!r}")
        return 0

    if not args.image.exists():
        print(f"File not found: {args.image}", file=sys.stderr)
        return 1

    opts = AsciiOptions(
        columns=args.columns,
        cell_aspect=args.cell_aspect,
        ramp=args.ramp,
        invert=args.invert,
        autocontrast=not args.no_autocontrast,
        brightness=args.brightness,
        contrast=args.contrast,
        gamma=args.gamma,
        edge_boost=args.edge_boost,
        dither=args.dither,
    )
    art = convert_path(args.image, opts)
    if args.output:
        args.output.write_text(art + "\n", encoding="utf-8")
    else:
        print(art)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
