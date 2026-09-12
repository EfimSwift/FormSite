#!/usr/bin/env python3
"""Один аркуш A1:F18 → один PDF + forms/templates/interactive-board-print.pdf"""

from __future__ import annotations

import re
import subprocess
import sys
import zipfile
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "forms" / "templates" / "interactive-board.xlsx"
BLANK_DATA = ROOT / "forms" / "templates" / "interactive-board-blank-data.xlsx"
OUT_PDF = ROOT / "forms" / "templates" / "interactive-board-print.pdf"
OUT_JS = ROOT / "js" / "infrastructure" / "xlsx" / "interactiveBoardPdfPlacements.js"

sys.path.insert(0, str(Path(__file__).parent))
from xlsx_zip_fill import fill_workbook  # noqa: E402


def make_blank_data_xlsx() -> None:
    clears = {f"{c}10": None for c in "ABCDEF"}
    clears.update({f"{c}14": None for c in "ABCDEF"})
    BLANK_DATA.write_bytes(fill_workbook(TEMPLATE.read_bytes(), clears))


def fix_signature_block_in_workbook(xlsx: Path) -> None:
    """Лівий текст A17:E18 (перенос як у шаблоні), звання F17:F18 зверху праворуч."""
    ps = rf"""
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
$wb = $xl.Workbooks.Open('{xlsx.resolve()}')
$ws = $wb.Worksheets.Item(1)
$left = $ws.Range('A17').Value2
if ($null -eq $left -or "$left".Length -eq 0) {{ $left = $ws.Range('A17').Text }}
$rightRaw = [string]$ws.Range('A18').Value2
$right = $rightRaw.Trim()
if ($right.Length -eq 0) {{ $right = 'полковник' }}

try {{ $ws.Range('A18:F18').UnMerge() }} catch {{ }}
foreach ($addr in @('B17','C17','D17','E17','F17','B18','C18','D18','E18','F18')) {{
  $ws.Range($addr).UnMerge() | Out-Null
  $ws.Range($addr).Clear()
}}

$ws.Range('A17:E18').Merge() | Out-Null
$ws.Range('A17').Value2 = $left
$ws.Range('A17:E18').WrapText = $true
$ws.Range('A17:E18').VerticalAlignment = -4160
$ws.Range('A17:E18').HorizontalAlignment = -4131

$ws.Range('F17:F18').Merge() | Out-Null
$ws.Range('F17').Value2 = $right
$ws.Range('F17:F18').WrapText = $false
$ws.Range('F17:F18').VerticalAlignment = -4160
$ws.Range('F17:F18').HorizontalAlignment = -4152

$ws.Rows('17:18').EntireRow.AutoFit() | Out-Null
$wb.Save()
$wb.Close($false)
$xl.Quit()
"""
    subprocess.run(
        ["powershell", "-NoProfile", "-Command", ps],
        check=True,
        capture_output=True,
        text=True,
    )


def export_pdf_one_page(xlsx: Path, pdf: Path) -> None:
    ps = rf"""
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
$wb = $xl.Workbooks.Open('{xlsx.resolve()}')
$ws = $wb.Worksheets.Item(1)
$ps = $ws.PageSetup
$ps.PrintArea = '$A$1:$F$18'
$ps.Zoom = $false
$ps.FitToPagesWide = 1
$ps.FitToPagesTall = 1
$ps.Orientation = 1
$ps.LeftMargin = $xl.InchesToPoints(0.7)
$ps.RightMargin = $xl.InchesToPoints(0.7)
$ps.TopMargin = $xl.InchesToPoints(0.75)
$ps.BottomMargin = $xl.InchesToPoints(0.75)
$ws.ExportAsFixedFormat(0, '{pdf.resolve()}')
$wb.Close($false)
$xl.Quit()
"""
    subprocess.run(
        ["powershell", "-NoProfile", "-Command", ps],
        check=True,
        capture_output=True,
        text=True,
    )


def page_count(pdf: Path) -> int:
    b = pdf.read_bytes()
    return len(re.findall(rb"/Type\s*/Page\b", b))


def first_stream_text(pdf: Path) -> str:
    b = pdf.read_bytes()
    m = re.search(rb"stream\r?\n(.*?)endstream", b, re.S)
    raw = m.group(1).strip(b"\r\n") if m else b""
    try:
        return zlib.decompress(raw).decode("latin-1", errors="ignore")
    except zlib.error:
        return raw.decode("latin-1", errors="ignore")


def extract_cells(t: str) -> dict[str, dict[str, float]]:
    """Шапка + рядок даних однією смугою; дані — смуга безпосередньо під шапкою."""
    fills: list[tuple[float, float, float, float]] = []
    for m in re.finditer(
        r"(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+re",
        t,
    ):
        x, y, w, h = map(float, m.groups())
        if w < 35 or h < 15 or h > 70:
            continue
        if x < 90:
            continue
        fills.append((x, y, w, h))

    def header_and_data(y_min: float, y_max: float):
        band = [f for f in fills if y_min <= f[1] <= y_max]
        if not band:
            return None, None
        header_y = max(f[1] for f in band)
        header = next(f for f in band if f[1] == header_y)
        hx, hy, hw, hh = header
        data_y = hy - hh
        return (hy, hh), (data_y, hh)

    r10_header, r10_data = header_and_data(640, 652)
    r14_header, r14_data = header_and_data(575, 582)
    if not r10_header or not r14_header:
        raise SystemExit("Не знайдено смуги рядків 10/14 у PDF")

    cols14_b = next((f for f in fills if 575 <= f[1] <= 582 and 85 < f[2] < 95), None)
    b_x = round(cols14_b[0], 2) if cols14_b else 94.32
    b_w = round(cols14_b[2], 2) if cols14_b else 90.38

    col_specs = [
        ("B", b_x, b_w if b_w else 91.34),
        ("C", 185.1, 111.8),
        ("D", 296.9, 97.5),
        ("E", 395.4, 75.9),
        ("F", 472.2, 66.7),
    ]

    def row_cells(data_y: float, data_h: float, suffix: str) -> dict[str, dict[str, float]]:
        out: dict[str, dict[str, float]] = {}
        for letter, x, w in col_specs:
            out[f"{letter}{suffix}"] = {
                "x": round(x, 2),
                "y": round(data_y, 2),
                "w": round(w, 2),
                "h": round(data_h, 2),
            }
        return out

    cells = row_cells(r10_data[0], r10_data[1], "10")
    cells.update(row_cells(r14_data[0], r14_data[1], "14"))

    return cells


def write_js(cells: dict[str, dict[str, float]]) -> None:
    lines = [
        "/**",
        " * Рамки комірок на interactive-board-print.pdf (pt, знизу-ліворуч).",
        " * Авто: python tools/regenerate_print_pdf.py",
        " */",
        "export const INTERACTIVE_BOARD_PDF_CELLS = {",
    ]
    for key in sorted(cells.keys()):
        c = cells[key]
        lines.append(
            f'  {key}: {{ page: 0, x: {c["x"]}, y: {c["y"]}, w: {c["w"]}, h: {c["h"]} }},',
        )
    lines.append("};")
    lines.append("")
    OUT_JS.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    fix_signature_block_in_workbook(TEMPLATE)
    make_blank_data_xlsx()
    export_pdf_one_page(BLANK_DATA, OUT_PDF)
    n = page_count(OUT_PDF)
    print("pages:", n, "pdf:", OUT_PDF)
    if n != 1:
        print("WARNING: PDF має бути 1 сторінка. Перевірте Excel PageSetup.")
    t = first_stream_text(OUT_PDF)
    cells = extract_cells(t)
    write_js(cells)
    print("updated", OUT_JS)
    for k, v in sorted(cells.items()):
        print(k, v)


if __name__ == "__main__":
    main()
