"""Script untuk membangun executable (.exe) mandiri untuk DNA - Daily Notes Aku menggunakan PyInstaller."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
SRC_DIR = ROOT_DIR / "src"
UI_DIR = SRC_DIR / "ui"
ASSETS_DIR = ROOT_DIR / "assets"
ICON_PATH = UI_DIR / "favicon.ico"
DIST_DIR = ROOT_DIR / "dist"
BUILD_DIR = ROOT_DIR / "build"


def build(onefile: bool = True, clean: bool = True) -> int:
    print("=" * 60)
    print("  DNA - Daily Notes Aku — Build Executable (.exe)")
    print("=" * 60)

    if clean:
        print("[1/4] Membersihkan folder build dan dist sebelumnya...")
        if BUILD_DIR.exists():
            shutil.rmtree(BUILD_DIR, ignore_errors=True)
        if DIST_DIR.exists():
            shutil.rmtree(DIST_DIR, ignore_errors=True)

    print("[2/4] Memeriksa kelengkapan file sumber...")
    main_py = SRC_DIR / "main.py"
    if not main_py.exists():
        print(f"Error: Entry point {main_py} tidak ditemukan!", file=sys.stderr)
        return 1

    if not UI_DIR.exists():
        print(f"Error: Folder UI {UI_DIR} tidak ditemukan!", file=sys.stderr)
        return 1

    # Data separator untuk Windows adalah ';'
    sep = ";" if os.name == "nt" else ":"

    add_data_args = [
        f"--add-data={UI_DIR}{sep}ui",
    ]
    if ASSETS_DIR.exists():
        add_data_args.append(f"--add-data={ASSETS_DIR}{sep}assets")

    # Siapkan argumen PyInstaller
    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name=DNA-DailyNotesAku",
        "--noconsole",  # Tanpa jendela hitam CMD
        "--clean",
        "--noconfirm",
        f"--distpath={DIST_DIR}",
        f"--workpath={BUILD_DIR}",
        f"--paths={SRC_DIR}",
    ]

    if onefile:
        cmd.append("--onefile")
    else:
        cmd.append("--onedir")

    if ICON_PATH.exists():
        cmd.append(f"--icon={ICON_PATH}")

    # Tambahkan aset & folder UI
    cmd.extend(add_data_args)

    # Hidden imports dan data penting untuk webview & generator sesuai platform OS
    hidden_imports = [
        "webview",
        "reportlab",
        "docx",
        "PIL",
        "PIL.Image",
    ]

    if os.name == "nt":
        # Windows
        hidden_imports.extend(["webview.platforms.winforms", "clr", "pythonnet"])
    elif sys.platform == "darwin":
        # macOS
        hidden_imports.extend(["webview.platforms.cocoa", "objc", "WebKit"])
    else:
        # Linux & BSD
        hidden_imports.extend(["webview.platforms.gtk", "gi"])

    for hi in hidden_imports:
        cmd.append(f"--hidden-import={hi}")

    cmd.append("--collect-data=webview")
    cmd.append("--collect-submodules=webview")

    # Target script
    cmd.append(str(main_py))

    print("[3/4] Menjalankan PyInstaller...")
    print(f"Command: {' '.join(cmd[:6])} ... [total {len(cmd)} flags]")

    result = subprocess.run(cmd, cwd=str(ROOT_DIR))
    if result.returncode != 0:
        print("\n[!] Terjadi kesalahan saat proses kompilasi PyInstaller.", file=sys.stderr)
        return result.returncode

    if os.name == "nt":
        exe_path = DIST_DIR / ("DNA-DailyNotesAku.exe" if onefile else "DNA-DailyNotesAku/DNA-DailyNotesAku.exe")
    elif sys.platform == "darwin":
        exe_path = DIST_DIR / ("DNA-DailyNotesAku.app" if (DIST_DIR / "DNA-DailyNotesAku.app").exists() else "DNA-DailyNotesAku")
    else:
        exe_path = DIST_DIR / ("DNA-DailyNotesAku" if onefile else "DNA-DailyNotesAku/DNA-DailyNotesAku")

    print("\n" + "=" * 60)
    print("  BUILD BERHASIL!")
    print("=" * 60)
    if exe_path.exists():
        size_mb = exe_path.stat().st_size / (1024 * 1024)
        print(f"Platform Target : {sys.platform.capitalize()} ({os.name})")
        print(f"File Executable : {exe_path.resolve()}")
        print(f"Ukuran File     : {size_mb:.2f} MB")
        print("\nPetunjuk:")
        print("1. Anda dapat menyalin file/bundle ini ke komputer pengguna target.")
        print("2. Folder 'data' (pengaturan/riwayat) dan 'output' (laporan Word & PDF)")
        print("   akan otomatis dibuat di sebelah aplikasi saat dijalankan.")
        print("3. Anda juga dapat menaruh logo kustom di folder 'assets/logo.png' di samping aplikasi.")
    else:
        print(f"Output tersedia di: {DIST_DIR.resolve()}")

    return 0


def main():
    parser = argparse.ArgumentParser(description="Build DNA - Daily Notes Aku Executable")
    parser.add_argument(
        "--onedir",
        action="store_true",
        help="Build dalam bentuk satu folder (lebih cepat start-up dibandingkan onefile)",
    )
    parser.add_argument(
        "--no-clean",
        action="store_true",
        help="Jangan hapus build/dist sebelumnya",
    )
    args = parser.parse_args()

    sys.exit(build(onefile=not args.onedir, clean=not args.no_clean))


if __name__ == "__main__":
    main()
