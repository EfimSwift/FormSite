#!/usr/bin/env python3
"""Один раз при доступі до інternet: шрифт DejaVu для кирилиці в PDF."""

from __future__ import annotations

import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FONT_OUT = ROOT / "fonts" / "DejaVuSans.ttf"
URL = (
    "https://github.com/dejavu-fonts/dejavu-fonts/raw/version_2_37/ttf/DejaVuSans.ttf"
)


def main() -> None:
    FONT_OUT.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {URL} ...")
    urllib.request.urlretrieve(URL, FONT_OUT)
    print(f"Wrote {FONT_OUT} ({FONT_OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
