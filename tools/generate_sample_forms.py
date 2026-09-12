#!/usr/bin/env python3
"""PDF-шаблоны + catalog.json с координатами из одного макета (мм → pt)."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "forms" / "templates"
CATALOG = ROOT / "forms" / "catalog.json"

MM = 72.0 / 25.4
A4_W = 595.28
A4_H = 841.89
LABEL_GAP_MM = 18.0
BASELINE_ON_LINE_PT = 3.0


def esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def mm(x: float, y: float) -> tuple[float, float]:
    return x * MM, y * MM


def placement(x_mm: float, y_mm: float, semantic: str, font_size: int = 11) -> dict:
    x_pt = round((x_mm + LABEL_GAP_MM) * MM, 2)
    y_pt = round(y_mm * MM + BASELINE_ON_LINE_PT, 2)
    p: dict = {
        "semantic": semantic,
        "page": 0,
        "x": x_pt,
        "y": y_pt,
        "fontSize": font_size,
    }
    if semantic == "fio":
        p["maxWidth"] = round((A4_W / MM - (x_mm + LABEL_GAP_MM) - 25) * MM, 0)
    return p


FORMS = [
    {
        "id": "zayava-pererazunok",
        "title": "Заява про перерахунок вислуги",
        "category": "Заяви",
        "layoutNote": "Тестовий макет; пізніше — PDF/XLS з таблицею",
        "variants": [
            {
                "id": "zayava-v1",
                "label": "Таблиця А — класичний макет",
                "description": "ПІБ і частина у верхній таблиці, дати внизу",
                "templateFile": "zayava-pererazunok-v1.pdf",
                "title": "Zayava pro pererakhunok (maket A)",
                "fields": [
                    ("PIB:", 30, 260, "fio"),
                    ("V/ch:", 30, 248, "unit_number"),
                    ("Period z:", 30, 210, "date_start"),
                    ("po:", 100, 210, "date_end"),
                ],
            },
            {
                "id": "zayava-v2",
                "label": "Таблиця Б — компактний блок",
                "description": "Усі поля в одному блоці",
                "templateFile": "zayava-pererazunok-v2.pdf",
                "title": "Zayava pro pererakhunok (maket B)",
                "fields": [
                    ("PIB:", 25, 230, "fio"),
                    ("V/ch:", 25, 218, "unit_number"),
                    ("D.n.:", 25, 206, "birth_date"),
                    ("Z:", 25, 194, "date_start"),
                    ("Po:", 95, 194, "date_end"),
                ],
            },
        ],
    },
    {
        "id": "dovidka-visluga",
        "title": "Довідка про вислугу",
        "category": "Довідки",
        "variants": [
            {
                "id": "dovidka-v1",
                "label": "Макет 1 — двоколонкова таблиця",
                "description": "ПІБ зліва, частина справа",
                "templateFile": "dovidka-visluga-v1.pdf",
                "title": "Dovidka pro vislugu",
                "fields": [
                    ("PIB:", 20, 250, "fio"),
                    ("V/ch:", 110, 250, "unit_number"),
                    ("Z:", 20, 225, "date_start"),
                    ("Po:", 90, 225, "date_end"),
                ],
            },
        ],
    },
    {
        "id": "poyasnennya",
        "title": "Пояснювальна записка",
        "category": "Службові",
        "variants": [
            {
                "id": "poyas-v1",
                "label": "Стандартна шапка",
                "description": "Шапка з ПІБ та датою народження",
                "templateFile": "poyasnennya-v1.pdf",
                "title": "Poyasniuvalna zapyska",
                "fields": [
                    ("PIB:", 28, 265, "fio"),
                    ("D.n.:", 28, 252, "birth_date"),
                    ("V/ch:", 28, 239, "unit_number"),
                ],
            },
        ],
    },
    {
        "id": "nakaz-vidpustka",
        "title": "Проект наказу (відпустка)",
        "category": "Накази",
        "variants": [
            {
                "id": "nakaz-v1",
                "label": "Таблиця періоду відпустки",
                "description": "Дати початку та закінчення у таблиці",
                "templateFile": "nakaz-vidpustka-v1.pdf",
                "title": "Proekt nakazu — vidpustka",
                "fields": [
                    ("PIB:", 25, 245, "fio"),
                    ("V/ch:", 25, 232, "unit_number"),
                    ("Z:", 35, 200, "date_start"),
                    ("Po:", 95, 200, "date_end"),
                ],
            },
        ],
    },
    {
        "id": "reestr-oblik",
        "title": "Лист обліку (тестовий бланк)",
        "category": "Облік",
        "variants": [
            {
                "id": "reestr-v1",
                "label": "Сітка полів",
                "description": "Усі п'ять полів у сітці",
                "templateFile": "reestr-oblik-v1.pdf",
                "title": "List obliku — sitka",
                "fields": [
                    ("1. PIB:", 22, 268, "fio"),
                    ("2. V/ch:", 22, 256, "unit_number"),
                    ("3. D.n.:", 22, 244, "birth_date"),
                    ("4. Z:", 22, 232, "date_start"),
                    ("5. Po:", 85, 232, "date_end"),
                ],
            },
            {
                "id": "reestr-v2",
                "label": "Мінімальний набір",
                "description": "Лише ПІБ та частина",
                "templateFile": "reestr-oblik-v2.pdf",
                "title": "List obliku — minimum",
                "fields": [
                    ("PIB:", 25, 240, "fio"),
                    ("V/ch:", 25, 228, "unit_number"),
                ],
            },
        ],
    },
]


def build_pdf(title: str, labels: list[tuple[str, float, float]]) -> bytes:
    content: list[str] = []
    content.append("BT /F1 14 Tf 72 800 Td (%s) Tj ET" % esc(title))
    content.append("BT /F1 10 Tf 72 780 Td (FormSite testovyi shablon) Tj ET")

    for label, x_mm, y_mm in labels:
        x, y = mm(x_mm, y_mm)
        label_y = y + 4 * MM
        content.append(
            "BT /F1 10 Tf %.2f %.2f Td (%s) Tj ET" % (x, label_y, esc(label))
        )
        x2 = x + LABEL_GAP_MM * MM
        right = A4_W - 25 * MM
        content.append("%.2f %.2f m %.2f %.2f l S" % (x2, y, right, y))

    stream = "\n".join(content)
    stream_bytes = stream.encode("latin-1", errors="replace")

    objects: list[bytes] = []
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    objects.append(
        (
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2f %.2f] "
            "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>"
            % (A4_W, A4_H)
        ).encode()
    )
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    objects.append(
        b"<< /Length %d >>\nstream\n" % len(stream_bytes) + stream_bytes + b"\nendstream"
    )

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{i} 0 obj\n".encode())
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")

    xref_pos = len(pdf)
    pdf.extend(f"xref\n0 {len(objects)+1}\n".encode())
    pdf.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        pdf.extend(f"{off:010d} 00000 n \n".encode())
    pdf.extend(
        f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode()
    )
    return bytes(pdf)


def build_catalog() -> dict:
    forms_out = []
    for form in FORMS:
        f = {k: v for k, v in form.items() if k != "variants"}
        variants_out = []
        for v in form["variants"]:
            labels = [(a, b, c) for a, b, c, _ in v["fields"]]
            placements = [
                placement(b, c, sem, 10 if "reestr-v1" == v["id"] else 11)
                for _, b, c, sem in v["fields"]
            ]
            variants_out.append(
                {
                    "id": v["id"],
                    "label": v["label"],
                    "description": v["description"],
                    "templateFile": v["templateFile"],
                    "placements": placements,
                }
            )
        f["variants"] = variants_out
        forms_out.append(f)
    return {"forms": forms_out}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for form in FORMS:
        for v in form["variants"]:
            labels = [(a, b, c) for a, b, c, _ in v["fields"]]
            path = OUT / v["templateFile"]
            path.write_bytes(build_pdf(v["title"], labels))
            print(f"Wrote {path}")

    catalog = build_catalog()
    CATALOG.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {CATALOG}")


if __name__ == "__main__":
    main()
