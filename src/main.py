"""Entry point DNA - Daily Notes Aku — jalankan dengan: `uv run src/main.py`."""

from __future__ import annotations

import sys

import webview

from api import Api
from helpers import APP_NAME, APP_VERSION, UI_DIR


def main() -> None:
    debug = "--debug" in sys.argv
    webview.create_window(
        title=f"{APP_NAME} v{APP_VERSION} — Laporan Harian Pegawai",
        url=str(UI_DIR / "index.html"),
        js_api=Api(),
        width=1360,
        height=900,
        min_size=(1080, 720),
        maximized=True,
        background_color="#F8FAFC",
    )
    webview.start(debug=debug, http_server=True)


if __name__ == "__main__":
    main()
