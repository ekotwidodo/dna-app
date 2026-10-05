# DNA - Daily Notes Aku

Aplikasi desktop untuk mencatat **Capaian Kegiatan Harian** dan membuat **Laporan Harian** (PDF / Word) sebagai bukti dukung SKP — BPS Provinsi Lampung.

Versi: **0.0.1**

## Fitur

- **Tema Tampilan Fleksibel**: Dukungan mode **Terang (Light - Default)** dan mode **Gelap (Dark)** dengan peralihan 1 klik.
- **Menu Master Data**:
  1. **Pegawai**: Manajemen data pegawai (Nama & Gelar, NIP, Jabatan) yang otomatis terintegrasi ke form laporan.
  2. **Rencana Kinerja**: Manajemen daftar IKI Rencana Kinerja SKP.
- **Form Capaian Harian**:
  - Profil (Nama, NIP, Jabatan) & Kegiatan berbasis dropdown tersimpan / custom input.
  - Tahun & SKP Triwulan.
  - Periode waktu: opsi otomatis (tanggal awal-akhir & jam) atau **Pilih Manual**.
  - Editor RTF (Rich Text Format: Bold, Italic, Underline, Bullet/Numbered list) untuk Uraian Kegiatan dan Hasil Capaian.
  - Fitur **Perlebar Form (Mode Lebar)** untuk kenyamanan mengetik teks panjang.
- **Dokumentasi Kegiatan (Opsional)**:
  - Dukungan link data dukung (Google Drive, cloud, dll) maupun unggah file gambar (klik unggah, drag & drop, atau paste clipboard `Ctrl+V`).
  - Caption keterangan individual per gambar.
- **Pratinjau Dokumen Live**: Pratinjau tampilan dokumen secara real-time saat mengetik.
- **Laporan Berkualitas Tinggi (Font Arial 11 pt)**:
  - Format **PDF** dan **Word (.docx)**.
  - Tabel 2 kolom rapi (Label & Nilai, tanpa tanda titik dua).
  - Menggunakan tipografi standar instansi: **Arial 11 pt**.
  - Grid galeri foto 2 kolom dengan caption.
  - Kop logo BPS resmi dan blok tanda tangan pegawai.
- **Riwayat Laporan**: Buka langsung file/folder dokumen dan gunakan kembali data laporan sebelumnya.

## Kompatibilitas Lintas Platform

Aplikasi ini didesain dan diuji untuk berjalan secara penuh (*cross-platform*) di:
- **Windows**: Windows 10 / 11 (menggunakan Microsoft Edge WebView2 bawaan OS).
- **macOS**: macOS 11 Big Sur ke atas (menggunakan native WebKit/Cocoa).
- **Linux**: Ubuntu/Debian, Fedora, Arch, dll (menggunakan WebKitGTK).
  - *Catatan Linux:* Pastikan library WebKitGTK terpasang (mis. `sudo apt install libwebkit2gtk-4.1-dev` atau `libwebkit2gtk-4.0-37`).

## Menjalankan dari Source

Prasyarat: [uv](https://docs.astral.sh/uv/) terpasang di sistem.

```bash
# Sinkronisasi dependensi
uv sync

# Jalankan aplikasi
uv run src/main.py
```

Mode debug (DevTools / Inspect aktif): `uv run src/main.py --debug`

## Aset

| File | Keterangan |
| --- | --- |
| `assets/logo.png` | Logo instansi untuk kop dokumen (PNG, latar transparan disarankan). |
| `assets/signature.png` | *(Opsional)* Gambar tanda tangan digital pegawai. |

## Struktur Folder

```text
daily-works-app/
├── assets/            # logo.png, signature.png (opsional)
├── data/              # settings.json (profil & default), history.json (riwayat)
├── output/            # hasil laporan: output/<Tahun>/<MM-Bulan>/<YYYY-MM-DD>_Laporan-Harian_<Nama>.pdf
├── src/
│   ├── main.py        # entry point jendela desktop (pywebview)
│   ├── api.py         # jembatan JS <-> Python (validasi & generate lintas OS)
│   ├── doc_generator.py  # pembuat PDF & Word (font resolution otomatis lintas OS)
│   ├── storage.py     # baca/tulis settings.json & history.json
│   ├── helpers.py     # path dinamis dev/frozen, penamaan file, gambar
│   └── ui/            # antarmuka web (index.html, styles.css, app.js)
├── build.bat          # script build 1-klik untuk Windows
├── build.sh           # script build 1-klik untuk macOS dan Linux
├── build_exe.py       # script builder PyInstaller lintas platform
├── pyproject.toml
└── uv.lock
```

## Cara Generate Executable / Binary Mandiri

Aplikasi dapat dikompilasi menjadi satu file executable mandiri tanpa perlu instalasi Python di komputer pengguna:

### 1. Windows:
Cukup klik ganda **`build.bat`** atau jalankan:
```powershell
.\build.bat
```
Hasil: `dist\DNA-DailyNotesAku.exe`

### 2. macOS & Linux:
Jalankan script bash:
```bash
chmod +x build.sh
./build.sh
```
Hasil: `dist/DNA-DailyNotesAku` (atau `.app` di macOS).

### 3. Menggunakan Script Python Builder:
```bash
# Single-file mandiri (default)
uv run build_exe.py

# Opsi folder direktori (startup instan)
uv run build_exe.py --onedir
```

> **Catatan Penggunaan Portabel:**
> - File aplikasi dapat disalin dan dijalankan langsung di komputer target yang sesuai.
> - Folder `data/` (penyimpanan riwayat & pengaturan) dan `output/` (laporan Word & PDF) otomatis dibuat berdampingan dengan aplikasi.
> - Jika ingin mengubah logo instansi, cukup letakkan file `logo.png` di dalam folder `assets/` di samping aplikasi.

## Penamaan File Output

```
output/2026/10-Oktober/2026-10-05_Laporan-Harian_EkoTeguhWidodo.pdf
output/2026/10-Oktober/2026-10-05_Laporan-Harian_EkoTeguhWidodo_02.pdf   # laporan ke-2 di hari yang sama
```

Gelar akademik otomatis dihapus dari nama file. PDF dan DOCX dari satu laporan memakai nama yang sama.
