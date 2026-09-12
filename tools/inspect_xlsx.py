#!/usr/bin/env python3
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def inspect(path: Path) -> None:
    with zipfile.ZipFile(path) as z:
        ss_root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        strings = []
        for si in ss_root.findall(f".//{NS}si"):
            parts = []
            for t in si.iter(f"{NS}t"):
                if t.text:
                    parts.append(t.text)
            strings.append("".join(parts))

        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        cells = {}
        for c in sheet.findall(f".//{NS}c"):
            ref = c.get("r")
            t = c.get("t")
            v = c.find(f"{NS}v")
            is_el = c.find(f"{NS}is")
            val = ""
            if t == "s" and v is not None and v.text:
                val = strings[int(v.text)]
            elif is_el is not None:
                tnode = is_el.find(f".//{NS}t")
                val = (tnode.text or "") if tnode is not None else ""
            elif v is not None and v.text:
                val = v.text
            cells[ref] = val

        for row in range(1, 25):
            parts = []
            for col in "ABCDEFGH":
                ref = f"{col}{row}"
                v = cells.get(ref, "").replace("\n", " ").strip()
                if v:
                    parts.append(f"{ref}={v[:50]}")
            if parts:
                sys.stdout.buffer.write(
                    (f"R{row}: " + " | ".join(parts) + "\n").encode("utf-8")
                )


if __name__ == "__main__":
    p = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
        r"c:\Users\User\Desktop\інтерактивна дошка.xlsx"
    )
    inspect(p)
