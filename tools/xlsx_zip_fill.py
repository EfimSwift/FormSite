#!/usr/bin/env python3
"""Заполнение .xlsx: правка sheet1.xml внутри ZIP, стили не трогаем."""

from __future__ import annotations

import re
import sys
import zipfile
from io import BytesIO
from pathlib import Path


def xml_text(text: str) -> str:
    esc = (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
    space = ' xml:space="preserve"' if text != text.strip() else ""
    return f"<is><t{space}>{esc}</t></is>"


def patch_cell_block(block: str, value: str | None) -> str:
    block = re.sub(r">\s*<v>.*?</v>\s*", ">", block, flags=re.S)
    block = re.sub(r">\s*<is>.*?</is>\s*", ">", block, flags=re.S)
    block = re.sub(r'\s+t="[^"]*"', "", block)
    if value is None or value == "":
        block = re.sub(r">\s*.*?\s*</c>", "/>", block, flags=re.S)
        if block.rstrip().endswith("</c>"):
            block = re.sub(r">\s*.*?\s*</c>", "/>", block, flags=re.S)
        return block

    inner = xml_text(value)
    if block.rstrip().endswith("/>"):
        return block.rstrip()[:-2] + f' t="inlineStr">{inner}</c>'
    return re.sub(
        r">\s*.*?\s*</c>",
        f' t="inlineStr">{inner}</c>',
        block,
        count=1,
        flags=re.S,
    )


def set_cell_in_sheet(sheet_xml: str, ref: str, value: str | None) -> str:
    pattern = rf'(<c r="{re.escape(ref)}"[^>]*)(?:/>|>.*?</c>)'
    m = re.search(pattern, sheet_xml, flags=re.S)
    if not m:
        raise ValueError(f"cell {ref} not found")
    old = m.group(0)
    new = patch_cell_block(old, value)
    return sheet_xml[: m.start()] + new + sheet_xml[m.end() :]


def fill_workbook(template: bytes, updates: dict[str, str | None]) -> bytes:
    out = BytesIO()
    with zipfile.ZipFile(BytesIO(template), "r") as zin:
        sheet_xml = zin.read("xl/worksheets/sheet1.xml").decode("utf-8")
        for ref, val in updates.items():
            sheet_xml = set_cell_in_sheet(sheet_xml, ref, val)
        new_sheet = sheet_xml.encode("utf-8")

        with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "xl/worksheets/sheet1.xml":
                    data = new_sheet
                zout.writestr(item, data)
    return out.getvalue()


def main() -> None:
    template = Path(
        r"C:\Users\User\Documents\GitHub\FormSite\forms\templates\interactive-board.xlsx"
    )
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("filled-test.xlsx")
    updates = {
        "B14": "Сорока Юхим Геннадійович",
        "C14": "test@example.com",
        "D14": "GX175G-V4",
        "E14": "K171SW18S0130",
        "F14": "Інтерактивна панель командного пункту",
    }
    for c in "ABCDEF":
        updates[f"{c}10"] = None
    blob = fill_workbook(template.read_bytes(), updates)
    out.write_bytes(blob)
    print("written", out, "size", len(blob))


if __name__ == "__main__":
    main()
