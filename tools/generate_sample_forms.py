#!/usr/bin/env python3
"""Генерация тестовых PDF-шаблонов в public/forms/ (только stdlib)."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "forms" / "templates"

# mm → PDF points (1/72 inch)
MM = 72.0 / 25.4
A4_W = 595.28
A4_H = 841.89


def esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def mm(x: float, y: float) -> tuple[float, float]:
    return x * MM, y * MM


TEMPLATES: list[tuple[str, str, list[tuple[str, float, float]]]] = [
    (
        "zayava-pererazunok-v1.pdf",
        "Zayava pro pererakhunok (maket A)",
        [
            ("PIB:", 30, 260),
            ("V/ch:", 30, 248),
            ("Period z:", 30, 210),
            ("po:", 100, 210),
        ],
    ),
    (
        "zayava-pererazunok-v2.pdf",
        "Zayava pro pererakhunok (maket B)",
        [
            ("PIB:", 25, 230),
            ("V/ch:", 25, 218),
            ("D.n.:", 25, 206),
            ("Z:", 25, 194),
            ("Po:", 95, 194),
        ],
    ),
    (
        "dovidka-visluga-v1.pdf",
        "Dovidka pro vislugu",
        [
            ("PIB:", 20, 250),
            ("V/ch:", 110, 250),
            ("Z:", 20, 225),
            ("Po:", 90, 225),
        ],
    ),
    (
        "poyasnennya-v1.pdf",
        "Poyasniuvalna zapyska",
        [
            ("PIB:", 28, 265),
            ("D.n.:", 28, 252),
            ("V/ch:", 28, 239),
        ],
    ),
    (
        "nakaz-vidpustka-v1.pdf",
        "Proekt nakazu — vidpustka",
        [
            ("PIB:", 25, 245),
            ("V/ch:", 25, 232),
            ("Z:", 35, 200),
            ("Po:", 95, 200),
        ],
    ),
    (
        "reestr-oblik-v1.pdf",
        "List obliku — sitka",
        [
            ("1. PIB:", 22, 268),
            ("2. V/ch:", 22, 256),
            ("3. D.n.:", 22, 244),
            ("4. Z:", 22, 232),
            ("5. Po:", 85, 232),
        ],
    ),
    (
        "reestr-oblik-v2.pdf",
        "List obliku — minimum",
        [
            ("PIB:", 25, 240),
            ("V/ch:", 25, 228),
        ],
    ),
]


def build_pdf(title: str, labels: list[tuple[str, float, float]]) -> bytes:
    content: list[str] = []
    content.append("BT /F1 14 Tf 72 800 Td (%s) Tj ET" % esc(title))
    content.append("BT /F1 10 Tf 72 780 Td (FormSite testovyi shablon) Tj ET")

    for label, x_mm, y_mm in labels:
        x, y = mm(x_mm, y_mm)
        line_y = y
        label_y = y + 4 * MM
        content.append(
            "BT /F1 10 Tf %.2f %.2f Td (%s) Tj ET"
            % (x, label_y, esc(label))
        )
        x2 = x + 18 * MM
        right = A4_W - 25 * MM
        content.append(
            "%.2f %.2f m %.2f %.2f l S" % (x2, line_y, right, line_y)
        )

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


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for filename, title, labels in TEMPLATES:
        path = OUT / filename
        path.write_bytes(build_pdf(title, labels))
        print(f"Wrote {path}")


if __name__ == "__main__":
    main()
