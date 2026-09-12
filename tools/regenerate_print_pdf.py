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
    """Прямокутники заливки рядків даних у PDF-потоці."""
    fills: list[tuple[float, float, float, float]] = []
    for m in re.finditer(
        r"(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+re",
        t,
    ):
        x, y, w, h = map(float, m.groups())
        if w < 35 or h < 20 or h > 70:
            continue
        if x < 90:
            continue
        fills.append((x, y, w, h))

    def row_boxes(y_min: float, y_max: float, h_min: float, h_max: float):
        row = [f for f in fills if y_min <= f[1] <= y_max and h_min <= f[3] <= h_max]
        row.sort(key=lambda f: f[0])
        return row

    r10 = row_boxes(645, 652, 38, 45)
    r14 = row_boxes(576, 582, 28, 32)
    if len(r10) < 4 or len(r14) < 2:
        raise SystemExit("Не вдалося знайти рядки 10/14 у PDF — перевірте шаблон")

    def assign(row: list[tuple], suffix: str) -> dict[str, dict[str, float]]:
        cols = "BCDEF"[: len(row)]
        out: dict[str, dict[str, float]] = {}
        for col, (x, y, w, h) in zip(cols, row, strict=False):
            out[f"{col}{suffix}"] = {
                "x": round(x, 2),
                "y": round(y, 2),
                "w": round(w, 2),
                "h": round(h, 2),
            }
        return out

    if len(r10) >= 5:
        cells = assign(r10[:5], "10")
    else:
        cells = {}
        b = r10[0]
        cells["B10"] = {"x": b[0], "y": b[1], "w": b[2], "h": b[3]}
        for i, col in enumerate("CDEF", start=1):
            if i < len(r10):
                x, y, w, h = r10[i]
                cells[f"{col}10"] = {"x": x, "y": y, "w": w, "h": h}

    if len(r14) >= 5:
        cells.update(assign(r14[:5], "14"))
    else:
        b = next((f for f in r14 if f[0] < 120), r14[0])
        cells["B14"] = {"x": b[0], "y": b[1], "w": b[2], "h": b[3]}
        f = next((f for f in r14 if f[0] > 450), r14[-1])
        cells["F14"] = {"x": f[0], "y": f[1], "w": f[2], "h": f[3]}
        cells["C14"] = {"x": 185.1, "y": b[1], "w": 111.8, "h": b[3]}
        cells["D14"] = {"x": 296.9, "y": b[1], "w": 97.5, "h": b[3]}
        cells["E14"] = {"x": 395.4, "y": b[1], "w": 75.9, "h": b[3]}

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
            f'  {key}: {{ x: {c["x"]}, y: {c["y"]}, w: {c["w"]}, h: {c["h"]} }},',
        )
    lines.append("};")
    lines.append("")
    OUT_JS.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
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
