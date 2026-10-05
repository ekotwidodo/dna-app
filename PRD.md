# Product Requirements Document (PRD)
**Nama Proyek**: DNA - Daily Notes Aku (Laporan Harian Pegawai)
**Versi**: 0.0.1

---

## 1. Pendahuluan
### 1.1 Tujuan Aplikasi
Aplikasi ini dibangun untuk memfasilitasi pegawai dalam mencatat capaian kegiatan harian secara mandiri dan mengenerate laporan harian ke dalam bentuk dokumen (PDF atau Word). Laporan yang dihasilkan akan digunakan sebagai bukti dukung pelaporan Sasaran Kinerja Pegawai (SKP).

### 1.2 Target Pengguna
Pegawai instansi (khususnya BPS Provinsi Lampung) yang membutuhkan alat bantu praktis untuk men-generate dokumen laporan harian tanpa memerlukan sistem autentikasi (login) yang rumit pada versi awal ini.

---

## 2. Spesifikasi Teknis
- **Platform**: Desktop Application (Standalone).
- **Tech Stack yang Disarankan**: 
  - **Python** (menggunakan library antarmuka seperti `Streamlit`, `Flet`, atau `CustomTkinter`).
  - Alternatif: **Local Web App** (HTML/JS/CSS murni atau dibungkus menggunakan Electron).
  *Catatan: Python direkomendasikan karena sangat kuat dalam melakukan generate dokumen (Word/PDF) melalui library seperti `python-docx` atau `FPDF/ReportLab`.*
- **Output Laporan**: File berekstensi `.pdf` atau `.docx`.
- **Organisasi File**: Terstruktur dengan pemisahan antara _source code_, _assets_ (logo/gambar), dan direktori output dokumen.

---

## 3. Kebutuhan Fitur (Functional Requirements)
### 3.1 Halaman Form Input (Add Capaian Kegiatan Perhari)
Aplikasi harus menyediakan antarmuka form yang rapi dengan isian sebagai berikut:
- **Profil Pegawai (Dropdown & Datalist)**:
  - Dropdown daftar pegawai yang tersimpan.
  - Field Nama, NIP, dan Jabatan (tersedia dropdown/datalist untuk memudahkan pemilihan atau pengetikan langsung).
- **Tahun**: Dropdown/Teks input (Contoh: `2026`).
- **SKP**: Dropdown/Teks input periode SKP (Contoh: `1 Juli - 30 September (Triwulan III)`).
- **Rencana Kinerja**: Dropdown dan area teks untuk "IKI Rencana Kinerja".
- **Pengaturan Waktu & Periode**:
  - Opsi "Periode pilih manual": Pengguna dapat mengetikkan teks periode secara bebas (misal: `1 Juli - 30 September (Triwulan III)` atau `5 Oktober 2026, pukul 08.00 - 16.00 WIB`).
  - Opsi otomatis: Checkbox "Gunakan periode tanggal" dan "Gunakan jam" dengan date-picker dan time-picker.
- **Kegiatan (Dropdown)**: Dropdown pilihan template kegiatan yang sering dilakukan atau pengetikan manual.
- **Uraian Kegiatan (RTF - Rich Text Format)**: Editor teks berformat dengan toolbar (Tebal/Bold, Miring/Italic, Garis Bawah/Underline, Daftar Poin/Bullet List, Daftar Angka/Numbered List).
- **Progres**: Input numerik / slider (0 - 100%).
- **Capaian / Hasil (RTF - Rich Text Format)**: Editor teks berformat untuk mendeskripsikan capaian hasil kegiatan.
- **Data Dukung & Dokumentasi**:
  - Input Teks: Link Data Dukung.
  - Upload Gambar: Fitur mengunggah **minimal 4 gambar** untuk bagian dokumentasi bukti dukung laporan.
  - **Caption Gambar**: Setiap gambar yang diunggah dilengkapi input teks caption/keterangan foto individual.
- **Aksi (Action)**:
  - Tombol/Checkbox: "Masukan ke capaian SKP" (Berfungsi sebagai *Submit* / *Generate Laporan*).

### 3.2 Fitur Generate Dokumen
Ketika pengguna men-submit form, sistem akan membaca inputan dan menghasilkan file dokumen (Word atau PDF) dengan struktur berikut:

1. **Kop Dokumen**:
   - Posisi Tengah (Center Alignment).
   - Baris 1: Logo BPS (Gambar logo statis yang disimpan di folder asset).
   - Baris 2: **BADAN PUSAT STATISTIK** (Huruf Kapital).
   - Baris 3: **PROVINSI LAMPUNG** (Huruf Kapital).
2. **Judul Laporan**:
   - **LAPORAN HARIAN** (Huruf Kapital, dicetak tebal).
3. **Isi (Tabel 2 Kolom Bersih, Tanpa Tanda Titik Dua ":")**:
   - Kolom 1 (Label): Nama, NIP, Jabatan, Kegiatan, Periode, Uraian Kegiatan, Hasil, Dokumentasi.
   - Kolom 2 (Nilai): Nilai data terkait (mempertahankan format teks tebal, miring, list dari RTF).
   - *Catatan*: Tanda titik dua (:) ditiadakan sesuai instruksi desain terbaru.
4. **Dokumentasi (Bukti Dukung)**:
   - Berisi gambar dokumentasi yang diupload (minimal 4 gambar).
   - Disusun sejajar dalam grid 2 kolom dengan **caption/keterangan masing-masing gambar** di bawah foto.
5. **Penutup / Pengesahan**:
   - Bagian akhir dokumen terdapat blok untuk tanda tangan pegawai yang bersangkutan.

---

## 4. Struktur Direktori Proyek (Usulan)
Untuk memastikan kerapihan _source code_ dan _file management_, berikut adalah rencana struktur foldernya:

```text
daily-works-app/
│
├── assets/                     # Folder penyimpanan aset statis
│   ├── logo-bps.png            # Logo Badan Pusat Statistik
│   └── signature.png           # Gambar tanda tangan (opsional, di-inject otomatis)
│
├── output/                     # Laporan hasil generate, tertata per tahun/bulan
│   └── 2026/10-Oktober/2026-10-05_Laporan-Harian_EkoTeguhWidodo.pdf
│
├── src/                        # Folder utama untuk source code
│   ├── main.py                 # Entry point: membuka jendela desktop (pywebview)
│   ├── api.py                  # Jembatan UI <-> Python (validasi, generate, buka file)
│   ├── doc_generator.py        # Modul khusus pengolah logika pembuatan Word/PDF
│   ├── storage.py              # Baca/tulis settings.json & history.json
│   ├── helpers.py              # Utilitas (format tanggal Indonesia, penamaan file, gambar)
│   └── ui/                     # Antarmuka (index.html, styles.css, app.js)
│
├── data/                       # Penyimpanan lokal
│   ├── settings.json           # Profil default agar tidak perlu ketik ulang
│   └── history.json            # Riwayat laporan yang pernah dibuat
│
├── pyproject.toml              # Konfigurasi project dan dependency (via uv)
├── uv.lock                     # Lock file dependensi dari uv
└── README.md                   # Dokumentasi instalasi dan cara penggunaan
```

> **Keputusan Tech Stack (v0.0.1)**: Python 3.12 + **pywebview** (jendela desktop native berbasis WebView2) dengan UI HTML/CSS/JS, **ReportLab** untuk PDF, **python-docx** untuk Word, **Pillow** untuk pemrosesan gambar.

---

## 5. Rencana Pengembangan Selanjutnya (Next Steps)
1. **Konfirmasi Tech Stack**: Sepakati apakah akan menggunakan Python (contoh: Streamlit/Tkinter/Flet) atau HTML/CSS/JS (sebagai Web Desktop App).
2. **Inisiasi Proyek**: Membuat struktur folder dan menginisialisasi environment.
3. **Desain Form**: Membangun UI untuk menerima semua parameter input dari pengguna (tanpa koneksi database rumit terlebih dahulu).
4. **Integrasi Generator Dokumen**: Membuat script khusus yang mengambil parameter dari UI untuk disisipkan ke dalam _template_ dokumen (docx/pdf).
5. **Uji Coba**: Mencoba _generate_ satu dokumen lengkap beserta upload ke-4 gambarnya dan memastikan layout sesuai PRD (kop surat tengah, layout 2x2 gambar).
