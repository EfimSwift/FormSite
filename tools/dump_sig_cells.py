#!/usr/bin/env python3
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def cell_value(sheet, strings, ref: str) -> str:
    c = sheet.find(f'.//{NS}c[@r="{ref}"]')
    if c is None:
        return ""
    v = c.find(f"{NS}v")
    if v is None or v.text is None:
        return ""
    if c.get("t") == "s":
        return strings[int(v.text)]
    return v.text


def main() -> None:
    p = Path(sys.argv[1])
    with zipfile.ZipFile(p) as z:
        ss = ET.fromstring(z.read("xl/sharedStrings.xml"))
        strings = [
            "".join((t.text or "") for t in si.iter(f"{NS}t"))
            for si in ss.findall(f".//{NS}si")
        ]
        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        for ref in ("A17", "A18", "F17", "F18"):
            val = cell_value(sheet, strings, ref)
            sys.stdout.buffer.write(f"{ref} ({len(val)}): {val}\n".encode("utf-8"))


if __name__ == "__main__":
    main()
