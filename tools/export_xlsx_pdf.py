#!/usr/bin/env python3
"""Экспорт листа Excel в PDF (нужен установленный Microsoft Excel, Windows)."""

from __future__ import annotations

import sys
from pathlib import Path


def export_pdf(xlsx: Path, pdf: Path) -> None:
    import win32com.client  # type: ignore

    excel = win32com.client.DispatchEx("Excel.Application")
    excel.Visible = False
    excel.DisplayAlerts = False
    try:
        wb = excel.Workbooks.Open(str(xlsx.resolve()))
        try:
            ws = wb.Worksheets(1)
            ws.ExportAsFixedFormat(0, str(pdf.resolve()))
        finally:
            wb.Close(SaveChanges=False)
    finally:
        excel.Quit()


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    xlsx = root / "forms" / "templates" / "interactive-board.xlsx"
    pdf = root / "forms" / "templates" / "interactive-board-print.pdf"
    if len(sys.argv) > 1:
        pdf = Path(sys.argv[1])
    export_pdf(xlsx, pdf)
    print("PDF:", pdf)


if __name__ == "__main__":
    main()
