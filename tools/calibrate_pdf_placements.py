#!/usr/bin/env python3
"""
Знімає Tm-координати з PDF (Excel ExportAsFixedFormat) для interactive-board.
Потрібен Windows + Excel. Оновлює js/infrastructure/xlsx/interactiveBoardPdfPlacements.js

  python tools/calibrate_pdf_placements.py
"""

from __future__ import annotations

import re
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "forms" / "templates" / "interactive-board.xlsx"
BLANK_PDF = ROOT / "forms" / "templates" / "interactive-board-print.pdf"
OUT_JS = ROOT / "js" / "infrastructure" / "xlsx" / "interactiveBoardPdfPlacements.js"

sys.path.insert(0, str(Path(__file__).parent))
from xlsx_zip_fill import fill_workbook  # noqa: E402


def tms(pdf: Path) -> set[tuple[float, float]]:
    b = pdf.read_bytes()
    pts: set[tuple[float, float]] = set()
    for m in re.finditer(rb"stream\r?\n", b):
        start = m.end()
        end = b.find(b"endstream", start)
        raw = b[start:end].strip(b"\r\n")
        try:
            s = zlib.decompress(raw)
        except zlib.error:
            s = raw
        t = s.decode("latin-1", errors="ignore")
        for m2 in re.finditer(r"(\d+\.?\d*)\s+(\d+\.?\d*)\s+Tm", t):
            pts.add((float(m2.group(1)), float(m2.group(2))))
    return pts


def export_pdf(xlsx: Path, pdf: Path) -> None:
    ps = f"""
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$wb = $xl.Workbooks.Open('{xlsx.resolve()}')
$wb.Worksheets.Item(1).ExportAsFixedFormat(0, '{pdf.resolve()}')
$wb.Close($false)
$xl.Quit()
"""
    subprocess.run(
        ["powershell", "-NoProfile", "-Command", ps],
        check=True,
        capture_output=True,
    )


def diff_placements(row_updates: dict[str, str]) -> list[tuple[float, float]]:
    clears = {f"{c}10": None for c in "ABCDEF"}
    clears.update({f"{c}14": None for c in "ABCDEF"})
    clears.update(row_updates)
    blob = fill_workbook(TEMPLATE.read_bytes(), clears)
    with tempfile.TemporaryDirectory() as td:
        xlsx = Path(td) / "fill.xlsx"
        pdf = Path(td) / "fill.pdf"
        xlsx.write_bytes(blob)
        export_pdf(xlsx, pdf)
        return sorted(tms(pdf) - tms(BLANK_PDF))


def pick_row(cells: list[str], points: list[tuple[float, float]]) -> dict[str, tuple[float, float]]:
    """Евристика: берём точки с максимальным Y для каждого X-кластера слева направо."""
    if not points:
        return {}
    by_y = sorted(points, key=lambda p: (-p[1], p[0]))
    used: list[tuple[float, float]] = []
    out: dict[str, tuple[float, float]] = {}
    for cell in cells:
        if not by_y:
            break
        pt = by_y.pop(0)
        used.append(pt)
        out[cell] = pt
    return out


def main() -> None:
    row10 = {
        "B10": "FIO",
        "C10": "34-331",
        "D10": "+380661234567",
        "E10": "34-338",
        "F10": "34-331",
    }
    row14 = {
        "B14": "Сорока Юхим Геннадійович",
        "C14": "mail@example.com",
        "D14": "GX175G-V4",
        "E14": "K171SW18S0130",
        "F14": "Інтерактивна панель командного пункту",
    }
    p10 = diff_placements(row10)
    p14 = diff_placements(row14)
    print("row10 new points:", p10)
    print("row14 new points:", p14)
    print("Оновіть interactiveBoardPdfPlacements.js вручну за цими точками.")


if __name__ == "__main__":
    main()
