"""Penyimpanan lokal berbasis JSON: profil/pengaturan dan riwayat laporan."""

from __future__ import annotations

import json
from copy import deepcopy
from datetime import date
from pathlib import Path
from typing import Any

from helpers import DATA_DIR, default_skp_period

SETTINGS_FILE = DATA_DIR / "settings.json"
HISTORY_FILE = DATA_DIR / "history.json"
MAX_HISTORY = 300

DEFAULT_SETTINGS: dict[str, Any] = {
    "daftar_pegawai": [
        {
            "nama": "Eko Teguh Widodo SST., M.Sc.",
            "nip": "198903102013111001",
            "jabatan": "Pranata Komputer Ahli Muda",
        },
    ],
    "profil_terpilih": {
        "nama": "Eko Teguh Widodo SST., M.Sc.",
        "nip": "198903102013111001",
        "jabatan": "Pranata Komputer Ahli Muda",
    },
    "daftar_kegiatan": [
        "Pengembangan dan Pengujian Aplikasi Inovasi Digital",
        "Penyusunan Laporan Harian dan Dokumentasi Kegiatan",
        "Koordinasi dan Rapat Tindak Lanjut Kegiatan Perkantoran",
        "Pemeliharaan Infrastruktur dan Sistem Informasi",
    ],
    "instansi": {
        "nama": "BADAN PUSAT STATISTIK",
        "wilayah": "PROVINSI LAMPUNG",
        "kota": "Bandar Lampung",
    },
    "default": {
        "tahun": date.today().year,
        "skp": default_skp_period(),
        "format": ["pdf"],
    },
    "rencana_kinerja": [
        "Persentase pengembangan inovasi digital kegiatan internal perkantoran "
        "sesuai kebutuhan pengguna sebesar 100 persen",
    ],
    "use_logo": True,
}


def _read_json(path: Path, fallback: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return deepcopy(fallback)


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def _merge(base: dict, override: dict) -> dict:
    out = deepcopy(base)
    for key, value in (override or {}).items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _merge(out[key], value)
        else:
            out[key] = value
    return out


# ---- Settings ---- #
def load_settings() -> dict:
    settings = _merge(DEFAULT_SETTINGS, _read_json(SETTINGS_FILE, {}))
    if not SETTINGS_FILE.exists():
        _write_json(SETTINGS_FILE, settings)
    return settings


def save_settings(settings: dict) -> dict:
    merged = _merge(load_settings(), settings)
    _write_json(SETTINGS_FILE, merged)
    return merged


def remember_rencana_kinerja(text: str) -> None:
    text = text.strip()
    if not text:
        return
    settings = load_settings()
    items = [t for t in settings.get("rencana_kinerja", []) if t.strip() != text]
    settings["rencana_kinerja"] = [text, *items][:20]
    _write_json(SETTINGS_FILE, settings)


def remember_kegiatan(text: str) -> None:
    text = text.strip()
    if not text:
        return
    settings = load_settings()
    items = [t for t in settings.get("daftar_kegiatan", []) if t.strip() != text]
    settings["daftar_kegiatan"] = [text, *items][:30]
    _write_json(SETTINGS_FILE, settings)


# ---- Master Data ---- #
def get_master_pegawai() -> list[dict]:
    settings = load_settings()
    return settings.get("daftar_pegawai", [])


def save_master_pegawai(pegawai_list: list[dict]) -> list[dict]:
    settings = load_settings()
    settings["daftar_pegawai"] = pegawai_list
    # Sinkronkan profil terpilih bila perlu
    sel = settings.get("profil_terpilih")
    if sel and not any(p.get("nip") == sel.get("nip") for p in pegawai_list):
        settings["profil_terpilih"] = pegawai_list[0] if pegawai_list else {}
    _write_json(SETTINGS_FILE, settings)
    return settings["daftar_pegawai"]


def get_master_rk() -> list[str]:
    settings = load_settings()
    return settings.get("rencana_kinerja", [])


def save_master_rk(rk_list: list[str]) -> list[str]:
    settings = load_settings()
    settings["rencana_kinerja"] = [t.strip() for t in rk_list if t and t.strip()]
    _write_json(SETTINGS_FILE, settings)
    return settings["rencana_kinerja"]


# ---- History ---- #
def load_history() -> list[dict]:
    history = _read_json(HISTORY_FILE, [])
    for item in history:
        item["files"] = [f for f in item.get("files", []) if Path(f["path"]).exists()]
        if not item.get("status"):
            form = item.get("form") or {}
            progres = form.get("progres", 100)
            if not item.get("files") or len(item["files"]) == 0:
                item["status"] = "draft"
            elif isinstance(progres, (int, float)) and progres < 100:
                item["status"] = "proses"
            else:
                item["status"] = "generate"
    return history


def add_history(entry: dict) -> list[dict]:
    history = _read_json(HISTORY_FILE, [])
    # Jika entry dengan ID yang sama sudah ada, hapus entri lama
    entry_id = entry.get("id")
    if entry_id:
        history = [h for h in history if h.get("id") != entry_id]
    history.insert(0, entry)
    _write_json(HISTORY_FILE, history[:MAX_HISTORY])
    return load_history()


def delete_history(entry_id: str) -> list[dict]:
    history = [h for h in _read_json(HISTORY_FILE, []) if h.get("id") != entry_id]
    _write_json(HISTORY_FILE, history)
    return load_history()


# ---- Backup, Restore & Reset ---- #
def get_backup_payload() -> dict:
    from datetime import datetime
    return {
        "app": "DNA - Daily Notes Aku",
        "version": "1.0",
        "exported_at": datetime.now().isoformat(timespec="seconds"),
        "settings": load_settings(),
        "history": load_history(),
    }


def restore_backup(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("Format file backup tidak valid.")
    settings = payload.get("settings")
    history = payload.get("history")
    if settings is not None and isinstance(settings, dict):
        _write_json(SETTINGS_FILE, settings)
    if history is not None and isinstance(history, list):
        _write_json(HISTORY_FILE, history)
    return {
        "settings": load_settings(),
        "history": load_history(),
    }


def reset_all_data() -> dict:
    """Mengosongkan semua data dalam folder data (history dan settings)."""
    if DATA_DIR.exists():
        for f in DATA_DIR.glob("*.*"):
            try:
                f.unlink()
            except Exception:
                pass
    _write_json(SETTINGS_FILE, {})
    _write_json(HISTORY_FILE, [])
    return {
        "settings": load_settings(),
        "history": load_history(),
    }
