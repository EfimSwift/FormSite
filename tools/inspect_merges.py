#!/usr/bin/env python3
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def main() -> None:
    p = Path(sys.argv[1])
    with zipfile.ZipFile(p) as z:
        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        print("merges:")
        for mc in sheet.findall(f".//{NS}mergeCell"):
            print(" ", mc.get("ref"))
        print("rows 15-18 cells:")
        for row in sheet.findall(f".//{NS}row"):
            rn = row.get("r")
            if rn not in ("15", "16", "17", "18"):
                continue
            ht = row.get("ht")
            print(f" row {rn} ht={ht}")
            for c in row.findall(f"{NS}c"):
                print(f"  {c.get('r')} s={c.get('s')}")


if __name__ == "__main__":
    main()
