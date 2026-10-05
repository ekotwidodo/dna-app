"""Fungsi-fungsi utilitas: path proyek, format tanggal Indonesia, penamaan file, dan gambar."""

from __future__ import annotations

import base64
import io
import re
import sys
from datetime import date, datetime
from pathlib import Path

from PIL import Image, ImageOps

# --------------------------------------------------------------------------- #
# Path proyek (Mendukung mode dev maupun mode frozen/PyInstaller .exe)
# --------------------------------------------------------------------------- #
IS_FROZEN = getattr(sys, "frozen", False)

if IS_FROZEN:
    BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    EXE_DIR = Path(sys.executable).resolve().parent
    ROOT_DIR = EXE_DIR
    SRC_DIR = BUNDLE_DIR / "src" if (BUNDLE_DIR / "src").exists() else BUNDLE_DIR
    UI_DIR = BUNDLE_DIR / "ui" if (BUNDLE_DIR / "ui").exists() else (SRC_DIR / "ui")
    BUNDLED_ASSETS_DIR = BUNDLE_DIR / "assets"
    USER_ASSETS_DIR = EXE_DIR / "assets"
    ASSETS_DIR = USER_ASSETS_DIR if USER_ASSETS_DIR.exists() else BUNDLED_ASSETS_DIR
    OUTPUT_DIR = EXE_DIR / "output"
    DATA_DIR = EXE_DIR / "data"
else:
    ROOT_DIR = Path(__file__).resolve().parent.parent
    SRC_DIR = ROOT_DIR / "src"
    UI_DIR = SRC_DIR / "ui"
    USER_ASSETS_DIR = ROOT_DIR / "assets"
    ASSETS_DIR = USER_ASSETS_DIR
    BUNDLED_ASSETS_DIR = ASSETS_DIR
    OUTPUT_DIR = ROOT_DIR / "output"
    DATA_DIR = ROOT_DIR / "data"


def get_user_assets_dir() -> Path:
    """Folder assets tempat pengguna menyimpan logo/tanda tangan kustom."""
    d = USER_ASSETS_DIR
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_default_logo_path() -> Path | None:
    """Mencari file logo bawaan sistem jika tersedia."""
    search_dirs = [get_user_assets_dir()]
    if IS_FROZEN and BUNDLED_ASSETS_DIR != search_dirs[0]:
        search_dirs.append(BUNDLED_ASSETS_DIR)
    for d in search_dirs:
        for name in ["default_logo.png", "logo-default.png", "logo-bps.png"]:
            p = d / name
            if p.is_file():
                return p
    return None


def get_logo_path() -> Path:
    """Mencari file logo di folder assets (logo.png, logo-bps.png, atau file logo*.*)."""
    search_dirs = [get_user_assets_dir()]
    if IS_FROZEN and BUNDLED_ASSETS_DIR != search_dirs[0]:
        search_dirs.append(BUNDLED_ASSETS_DIR)

    for d in search_dirs:
        candidates = [
            d / "logo.png",
            d / "logo.jpg",
            d / "logo.jpeg",
            d / "logo.webp",
            d / "logo-bps.png",
            d / "logo_bps.png",
        ]
        for p in candidates:
            if p.is_file():
                return p
        if d.exists():
            for p in sorted(d.glob("logo*.*")):
                if p.suffix.lower() in [".png", ".jpg", ".jpeg", ".webp"]:
                    return p
    return get_user_assets_dir() / "logo.png"


def get_signature_path() -> Path:
    """Mencari file tanda tangan di folder assets (signature.png, ttd.png, dll)."""
    search_dirs = [ASSETS_DIR]
    if IS_FROZEN and BUNDLED_ASSETS_DIR != ASSETS_DIR:
        search_dirs.append(BUNDLED_ASSETS_DIR)

    for d in search_dirs:
        candidates = [
            d / "signature.png",
            d / "ttd.png",
            d / "signature.jpg",
            d / "ttd.jpg",
        ]
        for p in candidates:
            if p.is_file():
                return p
    return ASSETS_DIR / "signature.png"


LOGO_PATH = get_logo_path()
SIGNATURE_PATH = get_signature_path()

APP_NAME = "DNA - Daily Notes Aku"
APP_VERSION = "0.0.1"

# --------------------------------------------------------------------------- #
# Tanggal & waktu (format Indonesia)
# --------------------------------------------------------------------------- #
BULAN = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]
HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]

SKP_PERIODS = [
    "1 Januari - 31 Maret (Triwulan I)",
    "1 April - 30 Juni (Triwulan II)",
    "1 Juli - 30 September (Triwulan III)",
    "1 Oktober - 31 Desember (Triwulan IV)",
]


def parse_date(value: str) -> date:
    """Parse string ISO `YYYY-MM-DD` menjadi objek date."""
    return datetime.strptime(value, "%Y-%m-%d").date()


def format_tanggal(d: date, with_day: bool = False) -> str:
    """Contoh: `5 Oktober 2026` atau `Senin, 5 Oktober 2026`."""
    text = f"{d.day} {BULAN[d.month - 1]} {d.year}"
    return f"{HARI[d.weekday()]}, {text}" if with_day else text


def format_jam(value: str) -> str:
    """`08:30` -> `08.30` (penulisan jam sesuai PUEBI)."""
    return value.replace(":", ".")


def format_periode(
    tanggal_awal: date,
    tanggal_akhir: date | None = None,
    jam_mulai: str | None = None,
    jam_selesai: str | None = None,
) -> str:
    """Bangun teks periode kegiatan yang ringkas dan mudah dibaca."""
    if tanggal_akhir is None or tanggal_akhir == tanggal_awal:
        text = format_tanggal(tanggal_awal, with_day=False)
    elif (tanggal_awal.year, tanggal_awal.month) == (tanggal_akhir.year, tanggal_akhir.month):
        text = f"{tanggal_awal.day} - {format_tanggal(tanggal_akhir)}"
    elif tanggal_awal.year == tanggal_akhir.year:
        text = (
            f"{tanggal_awal.day} {BULAN[tanggal_awal.month - 1]} - "
            f"{format_tanggal(tanggal_akhir)}"
        )
    else:
        text = f"{format_tanggal(tanggal_awal)} - {format_tanggal(tanggal_akhir)}"

    if jam_mulai and jam_selesai:
        text += f", pukul {format_jam(jam_mulai)} - {format_jam(jam_selesai)} WIB"
    return text


def default_skp_period(today: date | None = None) -> str:
    today = today or date.today()
    return SKP_PERIODS[(today.month - 1) // 3]


# --------------------------------------------------------------------------- #
# Profil & penamaan file
# --------------------------------------------------------------------------- #
def profile_label(nama: str, nip: str) -> str:
    """Format tampilan profil: `[198903102013111001] Eko Teguh Widodo SST., M.Sc.`"""
    return f"[{nip}] {nama}" if nip else nama


def name_slug(nama: str) -> str:
    """`Eko Teguh Widodo SST., M.Sc.` -> `EkoTeguhWidodo` (gelar dibuang)."""
    words = [w for w in re.split(r"[\s,]+", nama) if w]
    core = [w for w in words if "." not in w] or words
    slug = "".join(re.sub(r"[^A-Za-z0-9]", "", w.capitalize()) for w in core)
    return slug[:40] or "Pegawai"


def build_output_path(tanggal: date, nama: str, ext: str, stem: str | None = None, base_dir: Path | None = None) -> Path:
    """Path output tertata: `<base_dir>/2026/10-Oktober/2026-10-05_Laporan-Harian_Nama.pdf`.

    Jika `stem` diberikan, nama dasar file tersebut dipakai ulang (agar PDF & DOCX
    dari satu laporan memiliki nama yang sama).
    """
    root_out = Path(base_dir) if base_dir else OUTPUT_DIR
    folder = root_out / str(tanggal.year) / f"{tanggal.month:02d}-{BULAN[tanggal.month - 1]}"
    folder.mkdir(parents=True, exist_ok=True)
    if stem:
        return folder / f"{stem}.{ext}"

    base = f"{tanggal.isoformat()}_Laporan-Harian_{name_slug(nama)}"
    candidate, n = base, 2
    while any((folder / f"{candidate}.{e}").exists() for e in ("pdf", "docx")):
        candidate = f"{base}_{n:02d}"
        n += 1
    return folder / f"{candidate}.{ext}"


# --------------------------------------------------------------------------- #
# Gambar
# --------------------------------------------------------------------------- #
MAX_IMAGE_SIDE = 1600


def decode_data_url(data_url: str) -> bytes:
    """Ubah data URL (`data:image/png;base64,...`) menjadi bytes."""
    _, _, encoded = data_url.partition(",")
    return base64.b64decode(encoded or data_url)


def normalize_image(raw: bytes) -> tuple[bytes, int, int]:
    """Perbaiki orientasi EXIF, konversi ke RGB, perkecil, simpan sebagai JPEG.

    Mengembalikan (bytes_jpeg, lebar, tinggi).
    """
    with Image.open(io.BytesIO(raw)) as img:
        img = ImageOps.exif_transpose(img)
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            img = bg
        else:
            img = img.convert("RGB")
        img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=88, optimize=True)
        return buf.getvalue(), img.width, img.height


def fit_size(w: float, h: float, box_w: float, box_h: float) -> tuple[float, float]:
    """Hitung ukuran agar gambar muat di dalam kotak tanpa merusak rasio."""
    scale = min(box_w / w, box_h / h)
    return w * scale, h * scale
