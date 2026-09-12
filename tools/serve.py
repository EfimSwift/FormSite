#!/usr/bin/env python3
"""Локальный HTTP-сервер для FormSite (без Node)."""

from __future__ import annotations

import http.server
import os
import socketserver
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = int(os.environ.get("PORT", "8080"))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)


def main() -> None:
    os.chdir(ROOT)
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"FormSite: http://127.0.0.1:{PORT}/")
        print("Зупинка: Ctrl+C")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
