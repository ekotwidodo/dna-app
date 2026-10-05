"""Jembatan antara antarmuka (HTML/JS) dan logika Python, diekspos via pywebview `js_api`."""

from __future__ import annotations

import base64
import os
import subprocess
import traceback
import uuid
from datetime import datetime
from pathlib import Path

import storage
from doc_generator import ReportData, ReportImage, build_docx, build_pdf
from helpers import (
    APP_VERSION,
    OUTPUT_DIR,
    SKP_PERIODS,
    build_output_path,
    decode_data_url,
    format_periode,
    get_default_logo_path,
    get_logo_path,
    get_signature_path,
    get_user_assets_dir,
    normalize_image,
    parse_date,
    profile_label,
)

MIN_IMAGES = 0
BUILDERS = {"pdf": build_pdf, "docx": build_docx}


class ValidationError(ValueError):
    pass


def _open(path: Path) -> None:
    if os.name == "nt":
        os.startfile(str(path))  # noqa: S606 - membuka file lokal milik pengguna
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])


class Api:
    """Semua method publik di kelas ini dapat dipanggil dari JS: `window.pywebview.api.<nama>()`."""

    # ------------------------------------------------------------------ #
    # Data awal & pengaturan
    # ------------------------------------------------------------------ #
    def get_initial_data(self) -> dict:
        settings = storage.load_settings()
        use_logo = settings.get("use_logo", True)
        logo_path = get_logo_path()
        sig_path = get_signature_path()
        logo_data_url = None
        if logo_path.exists() and use_logo:
            try:
                logo_data_url = "data:image/png;base64," + base64.b64encode(logo_path.read_bytes()).decode()
            except Exception:
                logo_data_url = None

        custom_out = settings.get("output_dir")
        active_output_dir = str(Path(custom_out)) if custom_out and str(custom_out).strip() else str(OUTPUT_DIR)

        signature_data_url = None
        if sig_path.exists():
            try:
                signature_data_url = "data:image/png;base64," + base64.b64encode(sig_path.read_bytes()).decode()
            except Exception:
                signature_data_url = None

        return {
            "version": APP_VERSION,
            "settings": settings,
            "history": storage.load_history(),
            "skp_periods": SKP_PERIODS,
            "min_images": MIN_IMAGES,
            "output_dir": active_output_dir,
            "default_output_dir": str(OUTPUT_DIR),
            "logo_available": bool(logo_path.exists() and use_logo),
            "use_logo": use_logo,
            "logo_data_url": logo_data_url,
            "signature_available": sig_path.exists(),
            "signature_data_url": signature_data_url,
        }

    def save_settings(self, settings: dict) -> dict:
        return {"ok": True, "settings": storage.save_settings(settings)}

    def upload_logo(self, data_url: str) -> dict:
        """Menyimpan file logo instansi baru dari data URL (base64) ke folder assets/."""
        try:
            if not data_url or not isinstance(data_url, str):
                return {"ok": False, "error": "Data gambar logo tidak valid."}

            raw_bytes = decode_data_url(data_url)
            import io
            from PIL import Image as PILImage, ImageOps

            with PILImage.open(io.BytesIO(raw_bytes)) as img:
                img = ImageOps.exif_transpose(img)
                # Pertahankan transparansi jika ada (RGBA/LA/P)
                if img.mode in ("RGBA", "LA", "P"):
                    img = img.convert("RGBA")
                else:
                    img = img.convert("RGB")

                # Batasi ukuran w/h maks 2000px agar tidak membebani memori
                max_dim = 2000
                if img.width > max_dim or img.height > max_dim:
                    img.thumbnail((max_dim, max_dim), PILImage.Resampling.LANCZOS)

                user_assets = get_user_assets_dir()
                # Bersihkan logo lama berekstensi lain jika ada
                for ext in [".png", ".jpg", ".jpeg", ".webp"]:
                    p = user_assets / f"logo{ext}"
                    if p.is_file():
                        try:
                            p.unlink()
                        except Exception:
                            pass

                target_path = user_assets / "logo.png"
                img.save(target_path, format="PNG", optimize=True)

            saved_bytes = target_path.read_bytes()
            new_data_url = "data:image/png;base64," + base64.b64encode(saved_bytes).decode()

            # Aktifkan kembali use_logo di settings
            settings = storage.load_settings()
            settings["use_logo"] = True
            storage.save_settings(settings)

            return {
                "ok": True,
                "logo_available": True,
                "use_logo": True,
                "logo_data_url": new_data_url,
                "message": "Logo instansi berhasil diperbarui.",
            }
        except Exception as e:
            return {"ok": False, "error": f"Gagal mengunggah logo: {e}"}

    def reset_logo(self, mode: str = "default") -> dict:
        """Mengembalikan logo ke default bawaan sistem atau menghapus logo dari kop."""
        try:
            settings = storage.load_settings()
            user_assets = get_user_assets_dir()

            if mode == "remove":
                # Mode hapus logo (instansi tanpa logo di kop)
                settings["use_logo"] = False
                storage.save_settings(settings)
                return {
                    "ok": True,
                    "logo_available": False,
                    "use_logo": False,
                    "logo_data_url": None,
                    "message": "Logo berhasil dihapus dari kop laporan.",
                }

            # Mode default bawaan sistem
            default_logo = get_default_logo_path()
            if default_logo and default_logo.is_file():
                import shutil
                target_logo = user_assets / "logo.png"
                if default_logo.resolve() != target_logo.resolve():
                    shutil.copyfile(default_logo, target_logo)
                saved_bytes = target_logo.read_bytes()
                new_data_url = "data:image/png;base64," + base64.b64encode(saved_bytes).decode()
                settings["use_logo"] = True
                storage.save_settings(settings)
                return {
                    "ok": True,
                    "logo_available": True,
                    "use_logo": True,
                    "logo_data_url": new_data_url,
                    "message": "Logo instansi berhasil dikembalikan ke bawaan sistem.",
                }
            else:
                target_logo = user_assets / "logo.png"
                if target_logo.is_file():
                    saved_bytes = target_logo.read_bytes()
                    new_data_url = "data:image/png;base64," + base64.b64encode(saved_bytes).decode()
                    settings["use_logo"] = True
                    storage.save_settings(settings)
                    return {
                        "ok": True,
                        "logo_available": True,
                        "use_logo": True,
                        "logo_data_url": new_data_url,
                        "message": "Logo instansi diatur ke default.",
                    }
                return {"ok": False, "error": "Berkas logo default tidak ditemukan."}
        except Exception as e:
            return {"ok": False, "error": f"Gagal mereset logo: {e}"}

    def upload_signature(self, data_url: str) -> dict:
        """Menyimpan file tanda tangan (ttd) baru dari data URL (base64) ke folder assets/."""
        try:
            if not data_url or not isinstance(data_url, str):
                return {"ok": False, "error": "Data gambar tanda tangan tidak valid."}

            raw_bytes = decode_data_url(data_url)
            import io
            from PIL import Image as PILImage, ImageOps

            with PILImage.open(io.BytesIO(raw_bytes)) as img:
                img = ImageOps.exif_transpose(img)
                if img.mode in ("RGBA", "LA", "P"):
                    img = img.convert("RGBA")
                else:
                    img = img.convert("RGB")

                # Batasi ukuran
                max_dim = 1500
                if img.width > max_dim or img.height > max_dim:
                    img.thumbnail((max_dim, max_dim), PILImage.Resampling.LANCZOS)

                user_assets = get_user_assets_dir()
                # Bersihkan signature lama berekstensi lain jika ada
                for ext in [".png", ".jpg", ".jpeg", ".webp"]:
                    p = user_assets / f"signature{ext}"
                    if p.is_file():
                        try:
                            p.unlink()
                        except Exception:
                            pass

                target_path = user_assets / "signature.png"
                img.save(target_path, format="PNG", optimize=True)

            saved_bytes = target_path.read_bytes()
            new_data_url = "data:image/png;base64," + base64.b64encode(saved_bytes).decode()

            return {
                "ok": True,
                "signature_available": True,
                "signature_data_url": new_data_url,
                "message": "Tanda tangan berhasil diperbarui.",
            }
        except Exception as e:
            return {"ok": False, "error": f"Gagal mengunggah tanda tangan: {e}"}

    def remove_signature(self) -> dict:
        """Menghapus file tanda tangan."""
        try:
            user_assets = get_user_assets_dir()
            for ext in [".png", ".jpg", ".jpeg", ".webp"]:
                p = user_assets / f"signature{ext}"
                if p.is_file():
                    try:
                        p.unlink()
                    except Exception:
                        pass
            return {
                "ok": True,
                "signature_available": False,
                "signature_data_url": None,
                "message": "Tanda tangan berhasil dihapus.",
            }
        except Exception as e:
            return {"ok": False, "error": f"Gagal menghapus tanda tangan: {e}"}

    def select_output_folder(self) -> dict:
        """Membuka dialog pemilih folder OS menggunakan pywebview."""
        try:
            import webview

            if webview.windows:
                res = webview.windows[0].create_file_dialog(webview.FOLDER_DIALOG)
                if res and len(res) > 0:
                    selected = str(res[0])
                    return {"ok": True, "path": selected}
            return {"ok": False, "cancelled": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # ------------------------------------------------------------------ #
    # Master Data
    # ------------------------------------------------------------------ #
    def get_master_pegawai(self) -> list[dict]:
        return storage.get_master_pegawai()

    def save_master_pegawai(self, pegawai_list: list[dict]) -> dict:
        updated = storage.save_master_pegawai(pegawai_list)
        return {"ok": True, "daftar_pegawai": updated, "settings": storage.load_settings()}

    def get_master_rk(self) -> list[str]:
        return storage.get_master_rk()

    def save_master_rk(self, rk_list: list[str]) -> dict:
        updated = storage.save_master_rk(rk_list)
        return {"ok": True, "rencana_kinerja": updated, "settings": storage.load_settings()}

    # ------------------------------------------------------------------ #
    # Riwayat
    # ------------------------------------------------------------------ #
    def get_history(self) -> list[dict]:
        return storage.load_history()

    def delete_history(self, entry_id: str) -> list[dict]:
        return storage.delete_history(entry_id)

    # ------------------------------------------------------------------ #
    # File system
    # ------------------------------------------------------------------ #
    def open_file(self, path: str) -> dict:
        target = Path(path)
        if not target.exists():
            return {"ok": False, "error": "File tidak ditemukan."}
        _open(target)
        return {"ok": True}

    def open_folder(self, path: str | None = None) -> dict:
        settings = storage.load_settings()
        custom_out = settings.get("output_dir")
        default_dir = Path(custom_out) if custom_out and str(custom_out).strip() else OUTPUT_DIR
        target = Path(path) if path else default_dir
        if target.is_file():
            if os.name == "nt":
                subprocess.Popen(["explorer", "/select,", str(target)])
                return {"ok": True}
            elif sys.platform == "darwin":
                subprocess.Popen(["open", "-R", str(target)])
                return {"ok": True}
            target = target.parent
        target.mkdir(parents=True, exist_ok=True)
        _open(target)
        return {"ok": True}

    # ------------------------------------------------------------------ #
    # Window control
    # ------------------------------------------------------------------ #
    def toggle_fullscreen(self) -> dict:
        try:
            import webview
            if webview.windows:
                win = webview.windows[0]
                win.toggle_fullscreen()
                return {"ok": True, "fullscreen": bool(getattr(win, "fullscreen", False))}
        except Exception as e:
            return {"ok": False, "error": str(e)}
        return {"ok": False}

    # ------------------------------------------------------------------ #
    # Backup, Restore & Reset Data
    # ------------------------------------------------------------------ #
    def backup_data(self) -> dict:
        try:
            import json
            import webview
            from datetime import datetime

            payload = storage.get_backup_payload()
            default_filename = f"backup_dna_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

            save_path = None
            if webview.windows:
                win = webview.windows[0]
                res = win.create_file_dialog(
                    dialog_type=webview.FileDialog.SAVE,
                    save_filename=default_filename,
                    file_types=("JSON Files (*.json)", "All Files (*.*)"),
                )
                if res:
                    save_path = Path(res if isinstance(res, str) else res[0])

            if save_path:
                save_path.parent.mkdir(parents=True, exist_ok=True)
                save_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
                return {"ok": True, "path": str(save_path), "filename": save_path.name, "payload": payload}
            return {"ok": False, "cancelled": True, "payload": payload}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def restore_data(self, json_content: str | None = None) -> dict:
        try:
            import json
            import webview

            payload = None
            if json_content and json_content.strip():
                payload = json.loads(json_content)
            elif webview.windows:
                win = webview.windows[0]
                res = win.create_file_dialog(
                    dialog_type=webview.FileDialog.OPEN,
                    file_types=("JSON Files (*.json)", "All Files (*.*)"),
                )
                if res:
                    file_path = Path(res[0] if isinstance(res, (list, tuple)) else res)
                    if file_path.exists():
                        payload = json.loads(file_path.read_text(encoding="utf-8"))

            if not payload:
                return {"ok": False, "cancelled": True}

            restored = storage.restore_backup(payload)
            return {
                "ok": True,
                "settings": restored["settings"],
                "history": restored["history"],
                "total_history": len(restored["history"]),
            }
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def reset_data(self) -> dict:
        try:
            res = storage.reset_all_data()
            return {"ok": True, "settings": res["settings"], "history": res["history"]}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # ------------------------------------------------------------------ #
    # Generate laporan
    # ------------------------------------------------------------------ #
    def generate_report(self, payload: dict) -> dict:
        try:
            return self._generate(payload)
        except ValidationError as exc:
            return {"ok": False, "error": str(exc)}
        except Exception as exc:  # noqa: BLE001 - tampilkan error ke pengguna
            traceback.print_exc()
            return {"ok": False, "error": f"Gagal membuat laporan: {exc}"}

    def _generate(self, p: dict) -> dict:
        profil = p.get("profil") or {}
        nama = (profil.get("nama") or "").strip()
        nip = (profil.get("nip") or "").strip()
        if not nama or not nip:
            raise ValidationError("Profil pegawai (nama & NIP) wajib diisi.")

        for key, label in (("kegiatan", "Deskripsi kegiatan"), ("capaian", "Deskripsi capaian"),
                           ("rencana_kinerja", "Rencana kinerja")):
            if not str(p.get(key) or "").strip():
                raise ValidationError(f"{label} wajib diisi.")

        is_manual = bool(p.get("periode_manual") and str(p["periode_manual"]).strip())
        if not is_manual and not str(p.get("tanggal_awal") or "").strip():
            raise ValidationError("Tanggal wajib diisi.")

        tgl_awal = parse_date(p.get("tanggal_awal") or datetime.now().strftime("%Y-%m-%d"))
        tgl_akhir = None
        if not is_manual and p.get("gunakan_periode"):
            if not p.get("tanggal_akhir"):
                raise ValidationError("Tanggal akhir wajib diisi jika menggunakan periode tanggal.")
            tgl_akhir = parse_date(p["tanggal_akhir"])
            if tgl_akhir < tgl_awal:
                raise ValidationError("Tanggal akhir tidak boleh sebelum tanggal awal.")

        jam_mulai = jam_selesai = None
        if p.get("gunakan_jam"):
            jam_mulai, jam_selesai = p.get("jam_mulai"), p.get("jam_selesai")
            if not jam_mulai or not jam_selesai:
                raise ValidationError("Jam mulai dan jam selesai wajib diisi.")
            if tgl_akhir is None and jam_selesai <= jam_mulai:
                raise ValidationError("Jam selesai harus setelah jam mulai.")

        raw_images = p.get("images") or []
        if MIN_IMAGES > 0 and len(raw_images) < MIN_IMAGES:
            raise ValidationError(f"Dokumentasi minimal {MIN_IMAGES} gambar (saat ini {len(raw_images)}).")

        formats = [f for f in (p.get("format") or ["pdf"]) if f in BUILDERS]
        if not formats:
            raise ValidationError("Pilih minimal satu format output (PDF/Word).")

        images = []
        for item in raw_images:
            if isinstance(item, dict):
                data_url = item.get("dataUrl") or item.get("data_url") or ""
                caption = str(item.get("caption") or "")
            else:
                data_url = str(item)
                caption = ""
            data, w, h = normalize_image(decode_data_url(data_url))
            images.append(ReportImage(data=data, width=w, height=h, caption=caption))

        settings = storage.load_settings()
        instansi = settings.get("instansi", {})
        progres = max(0, min(100, int(p.get("progres") or 0)))

        # Tanggal laporan untuk penandatanganan (bisa diubah bila lewat hari)
        if p.get("tanggal_laporan") and str(p["tanggal_laporan"]).strip():
            tanggal_ttd = parse_date(str(p["tanggal_laporan"]).strip())
        else:
            tanggal_ttd = tgl_akhir or tgl_awal

        # Periode: manual atau otomatis dari tanggal & jam
        if p.get("periode_manual") and str(p["periode_manual"]).strip():
            periode_str = str(p["periode_manual"]).strip()
        else:
            periode_str = format_periode(tgl_awal, tgl_akhir, jam_mulai, jam_selesai)

        # Kegiatan: teks input manual pengguna, atau fallback ke rencana kinerja
        kegiatan_teks = str(p.get("kegiatan_judul") or "").strip() or p["rencana_kinerja"].strip()
        link_dukung = str(p.get("link_data_dukung") or "").strip()

        report = ReportData(
            nama=nama,
            nip=nip,
            jabatan=(profil.get("jabatan") or "").strip(),
            kegiatan=kegiatan_teks,
            periode=periode_str,
            uraian=p["kegiatan"].strip(),
            hasil=p["capaian"].strip(),
            progres=progres,
            tanggal_ttd=tanggal_ttd,
            kota=instansi.get("kota", "Bandar Lampung"),
            instansi=instansi.get("nama", "BADAN PUSAT STATISTIK"),
            wilayah=instansi.get("wilayah", "PROVINSI LAMPUNG"),
            link_dukung=link_dukung,
            use_logo=settings.get("use_logo", True),
            images=images,
        )

        custom_out = settings.get("output_dir")
        base_out = Path(custom_out) if custom_out and str(custom_out).strip() else OUTPUT_DIR

        files, stem = [], None
        for fmt in formats:
            out = build_output_path(tgl_awal, nama, fmt, stem=stem, base_dir=base_out)
            stem = out.stem
            BUILDERS[fmt](report, out)
            files.append({"type": fmt, "path": str(out), "name": out.name})

        # Simpan profil terpilih terakhir, rencana kinerja, dan default form
        storage.save_settings({
            "profil_terpilih": {"nama": nama, "nip": nip, "jabatan": report.jabatan},
            "default": {"tahun": p.get("tahun"), "skp": p.get("skp"), "format": formats},
        })
        storage.remember_rencana_kinerja(report.kegiatan)
        if p.get("kegiatan_judul"):
            storage.remember_kegiatan(p["kegiatan_judul"])

        progres = p.get("progres", 100)
        try:
            progres_val = float(progres)
        except (ValueError, TypeError):
            progres_val = 100
        status = "proses" if progres_val < 100 else "generate"

        entry = {
            "id": p.get("id") or uuid.uuid4().hex[:12],
            "created_at": datetime.now().isoformat(timespec="seconds"),
            "profil": profile_label(nama, nip),
            "periode": report.periode,
            "status": status,
            "files": files,
            "form": {k: v for k, v in p.items() if k != "images"},
        }
        storage.add_history(entry)

        return {
            "ok": True,
            "files": files,
            "folder": str(Path(files[0]["path"]).parent),
            "entry": entry,
        }

    def save_draft(self, p: dict) -> dict:
        try:
            profil = p.get("profil") or {}
            nama = (profil.get("nama") or "Draft Pegawai").strip()
            nip = (profil.get("nip") or "-").strip()

            tgl_awal = (p.get("tanggal_awal") or "").strip()
            periode = p.get("periode_manual") or (f"Tanggal {tgl_awal}" if tgl_awal else "Draft")

            entry = {
                "id": p.get("id") or uuid.uuid4().hex[:12],
                "created_at": datetime.now().isoformat(timespec="seconds"),
                "profil": profile_label(nama, nip),
                "periode": periode,
                "status": "draft",
                "files": [],
                "form": {k: v for k, v in p.items() if k != "images"},
            }
            history = storage.add_history(entry)
            return {"ok": True, "entry": entry, "history": history}
        except Exception as exc:
            return {"ok": False, "error": f"Gagal menyimpan draft: {exc}"}
