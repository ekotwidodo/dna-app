/* ==========================================================================
   DNA - Daily Notes Aku — logika antarmuka
   Berkomunikasi dengan Python melalui `window.pywebview.api`.
   ========================================================================== */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const MAX_SIDE = 1600;

  const state = {
    api: null,
    settings: null,
    history: [],
    images: [], // { id, dataUrl, name, caption }
    minImages: 0,
    skpPeriods: [],
    lastResult: null,
    logoDataUrl: null,
    useLogo: true,
    signatureDataUrl: null,
  };

  // ------------------------------------------------------------------------
  // API bridge (dengan mode demo bila dibuka di browser biasa)
  // ------------------------------------------------------------------------
  function waitForApi() {
    return new Promise((resolve) => {
      if (window.pywebview?.api) return resolve(window.pywebview.api);
      // Tambah waktu tunggu ke 10 detik karena PyInstaller .exe cold start bisa lambat
      const timer = setTimeout(() => resolve(createDemoApi()), 10000);
      window.addEventListener("pywebviewready", () => {
        clearTimeout(timer);
        resolve(window.pywebview.api);
      });
    });
  }

  function createDemoApi() {
    console.warn("pywebview tidak terdeteksi — berjalan dalam mode demo.");
    const settings = {
      daftar_pegawai: [
        { nama: "Eko Teguh Widodo SST., M.Sc.", nip: "198903102013111001", jabatan: "Pranata Komputer Ahli Muda" },
      ],
      profil_terpilih: { nama: "Eko Teguh Widodo SST., M.Sc.", nip: "198903102013111001", jabatan: "Pranata Komputer Ahli Muda" },
      daftar_kegiatan: [
        "Pengembangan dan Pengujian Aplikasi Inovasi Digital",
        "Penyusunan Laporan Harian dan Dokumentasi Kegiatan",
        "Koordinasi dan Rapat Tindak Lanjut Kegiatan Perkantoran",
        "Pemeliharaan Infrastruktur dan Sistem Informasi",
      ],
      instansi: { nama: "BADAN PUSAT STATISTIK", wilayah: "PROVINSI LAMPUNG", kota: "Bandar Lampung" },
      default: { tahun: new Date().getFullYear(), skp: "1 Oktober - 31 Desember (Triwulan IV)", format: ["pdf"] },
      rencana_kinerja: ["Persentase pengembangan inovasi digital kegiatan internal perkantoran sesuai kebutuhan pengguna sebesar 100 persen"],
    };
    return {
      demo: true,
      get_initial_data: async () => ({
        version: "0.0.1 (demo)", settings, history: [], min_images: 4, logo_data_url: null, use_logo: true,
        skp_periods: ["1 Januari - 31 Maret (Triwulan I)", "1 April - 30 Juni (Triwulan II)", "1 Juli - 30 September (Triwulan III)", "1 Oktober - 31 Desember (Triwulan IV)"],
      }),
      save_settings: async (s) => ({ ok: true, settings: Object.assign(settings, s) }),
      upload_logo: async (dataUrl) => {
        state.logoDataUrl = dataUrl;
        state.useLogo = true;
        return { ok: true, logo_available: true, use_logo: true, logo_data_url: dataUrl, message: "Logo berhasil diperbarui (demo)." };
      },
      reset_logo: async (mode) => {
        if (mode === "remove") {
          state.logoDataUrl = null;
          state.useLogo = false;
          return { ok: true, logo_available: false, use_logo: false, logo_data_url: null, message: "Logo dihapus (demo)." };
        }
        state.useLogo = true;
        return { ok: true, logo_available: true, use_logo: true, logo_data_url: state.logoDataUrl, message: "Logo diatur ke default (demo)." };
      },
      get_history: async () => [],
      delete_history: async () => [],
      open_file: async () => ({ ok: true }),
      open_folder: async () => ({ ok: true }),
      toggle_fullscreen: async () => {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen().catch(() => { });
          return { ok: true, fullscreen: true };
        } else {
          await document.exitFullscreen().catch(() => { });
          return { ok: true, fullscreen: false };
        }
      },
      generate_report: async () => ({ ok: false, error: "Mode demo: jalankan lewat `uv run src/main.py` untuk membuat file." }),
      backup_data: async () => {
        const payload = {
          app: "DNA - Daily Notes Aku",
          version: "1.0",
          exported_at: new Date().toISOString(),
          settings: state.settings,
          history: state.history,
        };
        return { ok: true, payload, filename: `backup_dna_${new Date().toISOString().slice(0, 10)}.json` };
      },
      restore_data: async (content) => {
        if (!content) return { ok: false, cancelled: true };
        try {
          const data = JSON.parse(content);
          if (data.settings) state.settings = data.settings;
          if (data.history) state.history = data.history;
          return { ok: true, settings: state.settings, history: state.history, total_history: (state.history || []).length };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      },
      reset_data: async () => {
        state.settings = { ...settings };
        state.history = [];
        return { ok: true, settings: state.settings, history: [] };
      },
    };
  }

  // ------------------------------------------------------------------------
  // Utilitas
  // ------------------------------------------------------------------------
  const pad = (n) => String(n).padStart(2, "0");
  const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const parseIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const fmtTanggal = (d, withDay = false) => `${withDay ? HARI[d.getDay()] + ", " : ""}${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
  const fmtJam = (t) => t.replace(":", ".");
  const uid = () => Math.random().toString(36).slice(2, 10);
  const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function formatPeriode(start, end, jamMulai, jamSelesai) {
    if (!start) return "";
    const a = parseIso(start);
    const b = end ? parseIso(end) : null;
    let text;
    if (!b || +a === +b) text = fmtTanggal(a, false);
    else if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) text = `${a.getDate()} - ${fmtTanggal(b, false)}`;
    else if (a.getFullYear() === b.getFullYear()) text = `${a.getDate()} ${BULAN[a.getMonth()]} - ${fmtTanggal(b, false)}`;
    else text = `${fmtTanggal(a, false)} - ${fmtTanggal(b, false)}`;
    if (jamMulai && jamSelesai) text += `, pukul ${fmtJam(jamMulai)} - ${fmtJam(jamSelesai)} WIB`;
    return text;
  }

  function toast(message, type = "info", ms = 4200) {
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    $("#toasts").appendChild(el);
    setTimeout(() => { el.classList.add("out"); el.addEventListener("animationend", () => el.remove()); }, ms);
  }

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function compressImage(file) {
    const src = await readAsDataUrl(file);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = src;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.88);
  }

  // ------------------------------------------------------------------------
  // ------------------------------------------------------------------------
  // Navigasi & Tema (Default: Light / Terang)
  // ------------------------------------------------------------------------
  function initTheme() {
    const saved = localStorage.getItem("daily_works_theme") || "light";
    applyTheme(saved);
  }

  function applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      const lbl = $("#theme-label");
      if (lbl) lbl.textContent = "Mode Terang";
    } else {
      document.documentElement.removeAttribute("data-theme");
      const lbl = $("#theme-label");
      if (lbl) lbl.textContent = "Mode Gelap";
    }
    localStorage.setItem("daily_works_theme", theme);
  }

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    applyTheme(isDark ? "light" : "dark");
  }

  function showView(name) {
    $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
    $(".main").scrollTop = 0;
    if (name === "dashboard") renderDashboard();
    if (name === "history") refreshHistory();
    if (name === "master-pegawai") renderMasterPegawai();
    if (name === "master-rk") renderMasterRk();
  }

  // ------------------------------------------------------------------------
  // Form Elements
  // ------------------------------------------------------------------------
  const el = {};
  function cacheElements() {
    Object.assign(el, {
      pegawaiSelect: $("#f-pegawai-select"),
      nama: $("#f-nama"), nip: $("#f-nip"), jabatan: $("#f-jabatan"),
      tahun: $("#f-tahun"), skp: $("#f-skp"),
      rkSelect: $("#f-rk-select"), rk: $("#f-rk"),
      useManualPeriod: $("#f-use-manual-period"),
      manualPeriod: $("#f-manual-period"),
      wrapManualPeriod: $("#wrap-manual-period"),
      wrapAutoTime: $("#wrap-auto-time"),
      usePeriod: $("#f-use-period"), useTime: $("#f-use-time"),
      dateStart: $("#f-date-start"), dateEnd: $("#f-date-end"),
      timeStart: $("#f-time-start"), timeEnd: $("#f-time-end"),
      dateReport: $("#f-date-report"),
      kegiatanJudul: $("#f-kegiatan-judul"),
      uraianRtf: $("#f-uraian-rtf"),
      hasilRtf: $("#f-hasil-rtf"),
      progres: $("#f-progres"), progresNum: $("#f-progres-num"),
      link: $("#f-link"), masukSkp: $("#f-masuk-skp"),
      fmtPdf: $("#fmt-pdf"), fmtDocx: $("#fmt-docx"), fileInput: $("#f-images"),
    });
  }

  function getActivePegawaiList() {
    const list = state.settings.daftar_pegawai || [];
    if (!list.length && state.settings.profil) {
      list.push(state.settings.profil);
    }
    return list;
  }

  function fillSelects() {
    // 1. Pegawai dropdown
    const pegList = getActivePegawaiList();
    const selPeg = state.settings.profil_terpilih || pegList[0] || {};
    el.pegawaiSelect.innerHTML = `<option value="">— Pilih Profil Pegawai —</option>` +
      pegList.map((p, idx) => {
        const isMatch = (p.nip === selPeg.nip && p.nama === selPeg.nama) || idx === 0;
        return `<option value="${idx}" ${isMatch ? "selected" : ""}>[${escapeHtml(p.nip || '-')}] ${escapeHtml(p.nama)} - ${escapeHtml(p.jabatan || 'Pegawai')}</option>`;
      }).join("") +
      `<option value="custom">+ Isi Nama / NIP Baru</option>`;

    // Datalists
    $("#dl-nama").innerHTML = pegList.map((p) => `<option value="${escapeHtml(p.nama)}"></option>`).join("");
    $("#dl-nip").innerHTML = pegList.map((p) => `<option value="${escapeHtml(p.nip)}"></option>`).join("");
    $("#dl-jabatan").innerHTML = [...new Set(pegList.map((p) => p.jabatan).filter(Boolean))].map((j) => `<option value="${escapeHtml(j)}"></option>`).join("");

    // Set initial values from selected pegawai
    if (pegList.length) {
      const p = selPeg.nama ? selPeg : pegList[0];
      el.nama.value = p.nama || "";
      el.nip.value = p.nip || "";
      el.jabatan.value = p.jabatan || "";
    }

    // 2. SKP
    const currentSkp = state.settings.default?.skp;
    const periods = [...state.skpPeriods];
    if (currentSkp && !periods.includes(currentSkp)) periods.push(currentSkp);
    el.skp.innerHTML = periods.map((p) => `<option ${p === currentSkp ? "selected" : ""}>${escapeHtml(p)}</option>`).join("");

    // 3. Rencana Kinerja
    const rks = state.settings.rencana_kinerja || [];
    el.rkSelect.innerHTML = `<option value="">— Ketik baru / pilih dari daftar —</option>` +
      rks.map((r, i) => `<option value="${i}">${escapeHtml(r.length > 110 ? r.slice(0, 110) + "…" : r)}</option>`).join("");
  }

  function resetForm(keepImages = false) {
    state.currentEditingId = null;
    const d = state.settings.default || {};
    el.tahun.value = d.tahun || new Date().getFullYear();
    fillSelects();
    el.rk.value = state.settings.rencana_kinerja?.[0] || "";
    el.rkSelect.value = el.rk.value ? "0" : "";
    if (el.kegiatanJudul) el.kegiatanJudul.value = "";
    if (el.dateReport) el.dateReport.value = todayIso();
    el.uraianRtf.innerHTML = "";
    el.hasilRtf.innerHTML = "";
    el.useManualPeriod.checked = false;
    el.manualPeriod.value = "";
    el.usePeriod.checked = false;
    el.useTime.checked = false;
    el.dateStart.value = todayIso();
    el.dateEnd.value = "";
    el.timeStart.value = "08:00";
    el.timeEnd.value = "16:00";
    el.link.value = "";
    el.masukSkp.checked = true;
    setProgres(100);
    const fmts = d.format || ["pdf"];
    el.fmtPdf.checked = fmts.includes("pdf");
    el.fmtDocx.checked = fmts.includes("docx");
    if (!keepImages) { state.images = []; renderThumbs(); }
    $$(".invalid").forEach((x) => x.classList.remove("invalid"));
    syncToggles();
    updatePreview();
  }

  function setProgres(v) {
    v = Math.max(0, Math.min(100, Number(v) || 0));
    el.progres.value = v;
    el.progresNum.value = v;
    el.progres.style.setProperty("--p", `${v}%`);
    $("#progres-out").textContent = `${v}%`;
  }

  function syncToggles() {
    const isManual = el.useManualPeriod.checked;
    el.wrapManualPeriod.style.display = isManual ? "block" : "none";
    el.wrapAutoTime.style.display = isManual ? "none" : "grid";
    $$("[data-auto-time]").forEach((x) => (x.style.display = isManual ? "none" : "inline-flex"));
    if (!isManual) {
      $$("[data-period]").forEach((x) => (x.style.display = el.usePeriod.checked ? "" : "none"));
      $$("[data-time]").forEach((x) => (x.style.visibility = el.useTime.checked ? "visible" : "hidden"));
    }
  }

  function collectPayload() {
    const isManual = el.useManualPeriod.checked;
    const manualText = el.manualPeriod.value.trim();
    return {
      profil: {
        nama: el.nama.value.trim(),
        nip: el.nip.value.trim(),
        jabatan: el.jabatan.value.trim(),
      },
      tahun: Number(el.tahun.value),
      skp: el.skp.value,
      rencana_kinerja: el.rk.value.trim(),
      periode_manual: isManual ? manualText : "",
      gunakan_periode: isManual ? false : el.usePeriod.checked,
      gunakan_jam: isManual ? false : el.useTime.checked,
      tanggal_awal: isManual ? todayIso() : el.dateStart.value,
      tanggal_akhir: isManual ? "" : (el.usePeriod.checked ? el.dateEnd.value : ""),
      jam_mulai: isManual ? "" : (el.useTime.checked ? el.timeStart.value : ""),
      jam_selesai: isManual ? "" : (el.useTime.checked ? el.timeEnd.value : ""),
      tanggal_laporan: el.dateReport?.value || todayIso(),
      kegiatan: el.uraianRtf.innerHTML.trim(),
      kegiatan_judul: el.kegiatanJudul ? el.kegiatanJudul.value.trim() : "",
      progres: Number(el.progres.value),
      capaian: el.hasilRtf.innerHTML.trim(),
      link_data_dukung: el.link.value.trim(),
      masuk_skp: el.masukSkp.checked,
      format: [el.fmtPdf, el.fmtDocx].filter((x) => x.checked).map((x) => x.value),
      images: state.images.map((i) => ({ dataUrl: i.dataUrl, caption: i.caption || "" })),
    };
  }

  function validate(p) {
    const errors = [];
    const mark = (node, msg) => { node.classList.add("invalid"); errors.push(msg); };
    $$(".invalid").forEach((x) => x.classList.remove("invalid"));
    if (!p.profil.nama) mark(el.nama, "Nama pegawai wajib diisi.");
    if (!p.profil.nip) mark(el.nip, "NIP pegawai wajib diisi.");
    if (!p.rencana_kinerja) mark(el.rk, "Rencana kinerja wajib diisi.");

    if (el.useManualPeriod.checked) {
      if (!p.periode_manual) mark(el.manualPeriod, "Teks periode manual wajib diisi.");
    } else {
      if (!p.tanggal_awal) mark(el.dateStart, "Tanggal wajib diisi.");
      if (p.gunakan_periode) {
        if (!p.tanggal_akhir) mark(el.dateEnd, "Tanggal akhir wajib diisi.");
        else if (p.tanggal_akhir < p.tanggal_awal) mark(el.dateEnd, "Tanggal akhir sebelum tanggal awal.");
      }
      if (p.gunakan_jam) {
        if (!p.jam_mulai) mark(el.timeStart, "Jam mulai wajib diisi.");
        if (!p.jam_selesai) mark(el.timeEnd, "Jam selesai wajib diisi.");
        if (p.jam_mulai && p.jam_selesai && !p.gunakan_periode && p.jam_selesai <= p.jam_mulai) mark(el.timeEnd, "Jam selesai harus setelah jam mulai.");
      }
    }

    const cleanUraian = el.uraianRtf.innerText.trim();
    if (!cleanUraian) { $("#wrap-uraian").classList.add("invalid"); errors.push("Uraian kegiatan wajib diisi."); }
    const cleanHasil = el.hasilRtf.innerText.trim();
    if (!cleanHasil) { $("#wrap-hasil").classList.add("invalid"); errors.push("Capaian hasil kegiatan wajib diisi."); }

    if (state.minImages > 0 && p.images.length < state.minImages) {
      $("#dropzone").classList.add("invalid");
      errors.push(`Dokumentasi minimal ${state.minImages} gambar (saat ini ${p.images.length}).`);
    }
    if (!p.format.length) errors.push("Pilih minimal satu format output.");
    return errors;
  }

  // ------------------------------------------------------------------------
  // Gambar dokumentasi & Caption
  // ------------------------------------------------------------------------
  async function addFiles(files) {
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    if (!images.length) return toast("Hanya file gambar yang didukung.", "error");
    for (const f of images) {
      try {
        const idx = state.images.length + 1;
        state.images.push({
          id: uid(),
          name: f.name || "screenshot",
          caption: `Dokumentasi Kegiatan ${idx}`,
          dataUrl: await compressImage(f),
        });
      } catch {
        toast(`Gagal membaca ${f.name}`, "error");
      }
    }
    $("#dropzone").classList.remove("invalid");
    renderThumbs();
  }

  function renderThumbs() {
    const box = $("#thumbs");
    box.innerHTML = state.images.map((img, i) => `
      <div class="thumb-card" data-id="${img.id}">
        <div class="thumb">
          <img src="${img.dataUrl}" alt="Dokumentasi ${i + 1}" />
          <span class="num">Gambar ${i + 1}</span>
          <div class="tools">
            <button type="button" data-act="left" title="Geser ke kiri" ${i === 0 ? "disabled" : ""}><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
            <button type="button" data-act="right" title="Geser ke kanan" ${i === state.images.length - 1 ? "disabled" : ""}><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></button>
            <button type="button" data-act="del" class="del" title="Hapus"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
          </div>
        </div>
        <input type="text" class="thumb-caption" data-caption-id="${img.id}" placeholder="Keterangan / caption foto..." value="${escapeHtml(img.caption || '')}" />
      </div>`).join("");

    const n = state.images.length;
    const chip = $("#img-counter");
    chip.textContent = n > 0 ? `${n} foto terunggah` : "0 foto";
    chip.classList.toggle("ok", n > 0);
    updatePreview();
  }

  function onThumbAction(e) {
    const btn = e.target.closest("button[data-act]");
    if (btn) {
      const card = btn.closest(".thumb-card");
      const id = card.dataset.id;
      const i = state.images.findIndex((x) => x.id === id);
      const act = btn.dataset.act;
      if (act === "del") state.images.splice(i, 1);
      if (act === "left" && i > 0) [state.images[i - 1], state.images[i]] = [state.images[i], state.images[i - 1]];
      if (act === "right" && i < state.images.length - 1) [state.images[i + 1], state.images[i]] = [state.images[i], state.images[i + 1]];
      renderThumbs();
      return;
    }
  }

  // ------------------------------------------------------------------------
  // Pratinjau live & checklist (Tanpa tanda titik dua)
  // ------------------------------------------------------------------------
  function updatePreview() {
    if (!state.settings) return;
    const p = collectPayload();
    const inst = state.settings.instansi;
    const set = (id, v) => ($(id).textContent = v || "—");

    set("#p-inst", inst.nama);
    set("#p-wil", inst.wilayah);
    set("#pv-nama", p.profil.nama);
    set("#pv-nip", p.profil.nip);
    const kegTeks = p.kegiatan_judul || p.rencana_kinerja || "—";
    set("#pv-kegiatan", kegTeks);

    const periodeStr = p.periode_manual || formatPeriode(p.tanggal_awal, p.tanggal_akhir, p.jam_mulai, p.jam_selesai);
    set("#pv-periode", periodeStr);

    // RTF preview di sel tabel
    const elUraian = $("#pv-uraian");
    elUraian.innerHTML = p.kegiatan || "—";

    const elHasil = $("#pv-hasil");
    elHasil.innerHTML = (p.capaian ? `${p.capaian}<p><b>Progres: ${p.progres}%</b></p>` : "—");

    const ttdIso = el.dateReport?.value || p.tanggal_akhir || p.tanggal_awal;
    $("#pv-sign-date").textContent = `${inst.kota || "Bandar Lampung"}, ${ttdIso ? fmtTanggal(parseIso(ttdIso), false) : "—"}`;
    set("#pv-sign-name", p.profil.nama);

    const pSignSpace = $("#p-sign-space");
    if (pSignSpace) {
      if (state.signatureDataUrl) {
        pSignSpace.style.backgroundImage = `url("${state.signatureDataUrl}")`;
        pSignSpace.style.backgroundSize = "contain";
        pSignSpace.style.backgroundPosition = "center";
        pSignSpace.style.backgroundRepeat = "no-repeat";
      } else {
        pSignSpace.style.backgroundImage = "none";
      }
    }

    // Sel Dokumentasi & Gallery foto
    const elDok = $("#pv-dok");
    if (elDok) {
      if (p.link_data_dukung) {
        elDok.innerHTML = `<a href="${escapeHtml(p.link_data_dukung)}" target="_blank" style="color:var(--blue); text-decoration:underline; word-break:break-all;">${escapeHtml(p.link_data_dukung)}</a>`;
      } else if (!state.images.length) {
        elDok.textContent = "—";
      } else {
        elDok.textContent = "";
      }
    }

    $("#pv-gallery").innerHTML = state.images.map((img, i) => {
      const cap = img.caption && img.caption.trim() ? img.caption : `Gambar ${i + 1}`;
      return `<figure><img src="${img.dataUrl}" alt="" /><figcaption>${escapeHtml(cap)}</figcaption></figure>`;
    }).join("");

    const hasUraian = !!el.uraianRtf.innerText.trim();
    const hasHasil = !!el.hasilRtf.innerText.trim();
    const dokLabel = state.images.length > 0
      ? `Dokumentasi (${state.images.length} foto)`
      : (p.link_data_dukung ? "Link dokumentasi terisi" : "Dokumentasi (opsional)");
    const checks = [
      ["Profil pegawai lengkap", p.profil.nama && p.profil.nip],
      ["Rencana kinerja & periode", p.rencana_kinerja && (p.periode_manual || p.tanggal_awal)],
      ["Uraian kegiatan & hasil terisi", hasUraian && hasHasil],
      [dokLabel, true],
    ];
    $("#checklist").innerHTML = checks.map(([t, ok]) => `<li class="${ok ? "done" : ""}">${escapeHtml(t)}</li>`).join("");
  }

  // ------------------------------------------------------------------------
  // Generate Laporan
  // ------------------------------------------------------------------------
  async function generate() {
    const payload = collectPayload();
    payload.id = state.currentEditingId;
    const errors = validate(payload);
    if (errors.length) {
      toast(errors[0] + (errors.length > 1 ? ` (+${errors.length - 1} lainnya)` : ""), "error");
      $(".invalid")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const btn = $("#btn-generate");
    btn.disabled = true;
    $("#loading").hidden = false;
    try {
      const res = await state.api.generate_report(payload);
      if (!res.ok) return toast(res.error || "Gagal membuat laporan.", "error", 6000);
      state.lastResult = res;
      state.currentEditingId = null;
      showResult(res);
      await reloadSettings();
      await refreshHistory();
      renderDashboard();
    } catch (err) {
      toast(`Terjadi kesalahan: ${err?.message || err}`, "error", 6000);
    } finally {
      $("#loading").hidden = true;
      btn.disabled = false;
    }
  }

  function fileRow(f) {
    return `<button type="button" class="result-file" data-open="${escapeHtml(f.path)}">
      <span class="file-tag ${f.type}">${f.type.toUpperCase()}</span>
      <span class="name">${escapeHtml(f.name)}</span>
      <svg viewBox="0 0 24 24"><path d="M14 4h6v6M10 14L20 4M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/></svg>
    </button>`;
  }

  function showResult(res) {
    $("#result-folder").textContent = res.folder;
    $("#result-files").innerHTML = res.files.map(fileRow).join("");
    $("#result-modal").hidden = false;
  }

  async function openFile(path) {
    const r = await state.api.open_file(path);
    if (!r.ok) toast(r.error || "Gagal membuka file.", "error");
  }

  // ------------------------------------------------------------------------
  // Riwayat
  // ------------------------------------------------------------------------
  async function refreshHistory() {
    state.history = await state.api.get_history();
    $("#history-count").textContent = state.history.length;
    renderHistory();
  }

  function renderHistory() {
    const q = $("#history-search").value.trim().toLowerCase();
    const items = state.history.filter((h) => !q || JSON.stringify([h.periode, h.form?.kegiatan, h.form?.capaian, h.form?.rencana_kinerja]).toLowerCase().includes(q));
    const list = $("#history-list");
    if (!items.length) {
      list.innerHTML = `<div class="card empty"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/></svg><p>${q ? "Tidak ada hasil yang cocok." : "Belum ada laporan. Buat laporan pertama Anda!"}</p></div>`;
      return;
    }
    list.innerHTML = items.map((h, i) => {
      const d = h.form?.tanggal_awal ? parseIso(h.form.tanggal_awal) : new Date(h.created_at);
      const files = h.files.map((f) => `<button class="ghost-btn" data-open="${escapeHtml(f.path)}"><span class="file-tag ${f.type}">${f.type.toUpperCase()}</span>Buka</button>`).join("");
      const cleanKeg = (h.form?.kegiatan || "-").replace(/<[^>]*>/g, " ").trim().split("\n")[0];
      return `<article class="card h-item" style="--d:${Math.min(i, 8)}" data-id="${h.id}">
        <div class="h-date"><b>${d.getDate()}</b><small>${BULAN[d.getMonth()].slice(0, 3)} ${String(d.getFullYear()).slice(2)}</small></div>
        <div class="h-body">
          <h3>${escapeHtml(cleanKeg)}</h3>
          <div class="h-meta"><span>${escapeHtml(h.periode)}</span><span>Progres ${h.form?.progres ?? "-"}%</span>${h.form?.masuk_skp ? "<span>✓ Capaian SKP</span>" : ""}${h.files.length ? "" : "<span>File sudah dipindah/dihapus</span>"}</div>
        </div>
        <div class="h-actions">
          ${files}
          ${h.files[0] ? `<button class="ghost-btn" data-folder="${escapeHtml(h.files[0].path)}">Folder</button>` : ""}
          <button class="ghost-btn" data-reuse="${h.id}" title="Isi form dengan data ini">Gunakan lagi</button>
          <button class="ghost-btn danger" data-delete="${h.id}" title="Hapus dari riwayat">Hapus</button>
        </div>
      </article>`;
    }).join("");
  }

  function reuseEntry(id) {
    const h = state.history.find((x) => x.id === id);
    if (!h?.form) return;
    const f = h.form;
    if (f.profil) {
      el.nama.value = f.profil.nama || "";
      el.nip.value = f.profil.nip || "";
      el.jabatan.value = f.profil.jabatan || "";
    }
    el.tahun.value = f.tahun || el.tahun.value;
    if (f.skp) el.skp.value = f.skp;
    el.rk.value = f.rencana_kinerja || "";

    if (f.periode_manual) {
      el.useManualPeriod.checked = true;
      el.manualPeriod.value = f.periode_manual;
    } else {
      el.useManualPeriod.checked = false;
      el.manualPeriod.value = "";
      el.usePeriod.checked = !!f.gunakan_periode;
      el.useTime.checked = !!f.gunakan_jam;
      el.dateStart.value = todayIso();
      el.dateEnd.value = "";
      if (f.jam_mulai) el.timeStart.value = f.jam_mulai;
      if (f.jam_selesai) el.timeEnd.value = f.jam_selesai;
    }

    el.uraianRtf.innerHTML = f.kegiatan || "";
    el.hasilRtf.innerHTML = f.capaian || "";
    el.link.value = f.link_data_dukung || "";
    el.masukSkp.checked = f.masuk_skp !== false;
    setProgres(f.progres ?? 100);
    state.currentEditingId = id;
    state.images = [];
    renderThumbs();
    syncToggles();
    showView("form");
    updatePreview();
    toast("Form diisi dari riwayat/draft. Silakan periksa atau lengkapi dokumentasi.", "info");
  }

  // ========================================================================
  // Dashboard Logics
  // ========================================================================
  state.dashFilter = {
    year: "all",
    month: "all",
    status: "all",
    search: "",
  };
  state.chartFilter = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  };
  state.currentEditingId = null;

  function renderDashboard() {
    renderDashboardStats();
    initDashboardChartControls();
    renderDashboardChart();
    initDashboardTableFilters();
    renderDashboardTable();
  }

  function renderDashboardStats() {
    const total = state.history.length;
    const curDate = new Date();
    const curYear = curDate.getFullYear();
    const curM = curDate.getMonth() + 1;

    let qNum = 1;
    let qLabel = "Triwulan I (Jan - Mar)";
    if (curM >= 10) { qNum = 4; qLabel = "Triwulan IV (Okt - Des)"; }
    else if (curM >= 7) { qNum = 3; qLabel = "Triwulan III (Jul - Sep)"; }
    else if (curM >= 4) { qNum = 2; qLabel = "Triwulan II (Apr - Jun)"; }

    const qStart = (qNum - 1) * 3 + 1;
    const qEnd = qNum * 3;

    let countTriwulan = 0;
    let countGen = 0;
    let countProses = 0;
    let countDraft = 0;

    state.history.forEach((h) => {
      const dt = h.form?.tanggal_awal || (h.created_at ? h.created_at.slice(0, 10) : "");
      if (dt) {
        const [y, m] = dt.split("-").map(Number);
        if (y === curYear && m >= qStart && m <= qEnd) countTriwulan++;
      }
      const st = h.status || (h.files?.length ? "generate" : "draft");
      if (st === "generate") countGen++;
      else if (st === "proses") countProses++;
      else countDraft++;
    });

    const pegList = getActivePegawaiList();

    if ($("#dash-stat-total")) $("#dash-stat-total").textContent = total;
    if ($("#dash-stat-triwulan")) $("#dash-stat-triwulan").textContent = countTriwulan;
    if ($("#dash-stat-triwulan-label")) $("#dash-stat-triwulan-label").textContent = `${qLabel} ${curYear}`;
    if ($("#dash-stat-status")) $("#dash-stat-status").textContent = `${countGen} Selesai`;
    if ($("#dash-stat-status-sub")) $("#dash-stat-status-sub").textContent = `${countProses} Proses · ${countDraft} Draft`;
    if ($("#dash-stat-pegawai")) $("#dash-stat-pegawai").textContent = pegList.length;
  }

  function initDashboardChartControls() {
    const selMonth = $("#dash-chart-month");
    const selYear = $("#dash-chart-year");
    if (!selMonth || !selYear) return;

    if (!selMonth.options.length) {
      selMonth.innerHTML = BULAN.map((b, i) => `<option value="${i + 1}" ${i + 1 === state.chartFilter.month ? "selected" : ""}>${b}</option>`).join("");
    }

    const curYear = new Date().getFullYear();
    const years = new Set([curYear]);
    state.history.forEach((h) => {
      const dt = h.form?.tanggal_awal || (h.created_at ? h.created_at.slice(0, 10) : "");
      if (dt) {
        const y = parseInt(dt.split("-")[0], 10);
        if (y) years.add(y);
      }
    });
    const sortedYears = [...years].sort((a, b) => b - a);
    selYear.innerHTML = sortedYears.map((y) => `<option value="${y}" ${y === state.chartFilter.year ? "selected" : ""}>${y}</option>`).join("");
  }

  function renderDashboardChart() {
    const year = Number(state.chartFilter.year);
    const month = Number(state.chartFilter.month);
    const daysInMonth = new Date(year, month, 0).getDate();
    const dayCounts = new Array(daysInMonth + 1).fill(0);

    state.history.forEach((h) => {
      const dt = h.form?.tanggal_awal || (h.created_at ? h.created_at.slice(0, 10) : "");
      if (!dt) return;
      const [y, m, d] = dt.split("-").map(Number);
      if (y === year && m === month && d >= 1 && d <= daysInMonth) {
        dayCounts[d]++;
      }
    });

    const totalLap = dayCounts.reduce((a, b) => a + b, 0);
    const activeDays = dayCounts.filter((c) => c > 0).length;
    const maxCount = Math.max(...dayCounts, 0);
    const peakDay = dayCounts.indexOf(maxCount);

    const sub = $("#dash-chart-subtitle");
    if (sub) sub.textContent = `Frekuensi laporan harian pada bulan ${BULAN[month - 1]} ${year}`;

    const summary = $("#dash-chart-summary");
    if (summary) {
      summary.innerHTML = `
        <div class="chart-stat-pill">Bulan: <b>${BULAN[month - 1]} ${year}</b></div>
        <div class="chart-stat-pill">Total Laporan: <b>${totalLap}</b></div>
        <div class="chart-stat-pill">Hari Aktif: <b>${activeDays}</b> hari</div>
        <div class="chart-stat-pill">Rata-rata: <b>${activeDays ? (totalLap / activeDays).toFixed(1) : 0}</b> lap/hari aktif</div>
        ${maxCount > 0 ? `<div class="chart-stat-pill">Paling Produktif: <b>Tgl ${peakDay} (${maxCount} lap)</b></div>` : ""}
      `;
    }

    const container = $("#dash-chart-container");
    if (!container) return;

    const maxY = Math.max(maxCount, 3);
    const svgHtml = buildChartSvg(year, month, dayCounts, maxY, daysInMonth);
    container.innerHTML = `<div class="chart-tooltip" id="dash-chart-tooltip"></div>` + svgHtml;
  }

  function buildChartSvg(year, month, dayCounts, maxY, totalDays) {
    const curDate = new Date();
    const isCurrent = (curDate.getFullYear() === year && (curDate.getMonth() + 1) === month);
    const todayDay = curDate.getDate();

    const w = 960;
    const h = 220;
    const padL = 40;
    const padR = 20;
    const padT = 20;
    const padB = 35;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const yMid = Math.round(maxY / 2);
    const yGrid0 = padT + plotH;
    const yGridMid = padT + plotH / 2;
    const yGridTop = padT;

    let svg = `
      <svg class="chart-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="hsl(212, 95%, 58%)" />
            <stop offset="100%" stop-color="hsl(212, 85%, 45%)" />
          </linearGradient>
          <linearGradient id="barGradToday" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="hsl(150, 80%, 46%)" />
            <stop offset="100%" stop-color="hsl(150, 75%, 34%)" />
          </linearGradient>
        </defs>
        <!-- Grid lines -->
        <line x1="${padL}" y1="${yGrid0}" x2="${w - padR}" y2="${yGrid0}" stroke="var(--border)" stroke-width="1" />
        <line x1="${padL}" y1="${yGridMid}" x2="${w - padR}" y2="${yGridMid}" stroke="var(--border)" stroke-width="1" stroke-dasharray="4 4" />
        <line x1="${padL}" y1="${yGridTop}" x2="${w - padR}" y2="${yGridTop}" stroke="var(--border)" stroke-width="1" stroke-dasharray="4 4" />

        <!-- Y Axis Labels -->
        <text x="${padL - 10}" y="${yGrid0}" font-size="11" fill="var(--muted)" text-anchor="end" alignment-baseline="middle">0</text>
        <text x="${padL - 10}" y="${yGridMid}" font-size="11" fill="var(--muted)" text-anchor="end" alignment-baseline="middle">${yMid}</text>
        <text x="${padL - 10}" y="${yGridTop}" font-size="11" fill="var(--muted)" text-anchor="end" alignment-baseline="middle">${maxY}</text>
    `;

    const slotW = plotW / totalDays;
    const barW = Math.max(slotW * 0.65, 8);

    for (let d = 1; d <= totalDays; d++) {
      const cnt = dayCounts[d] || 0;
      const isToday = isCurrent && d === todayDay;
      const barH = cnt > 0 ? (cnt / maxY) * plotH : 0;
      const x = padL + (d - 1) * slotW + (slotW - barW) / 2;
      const y = padT + plotH - barH;
      const centerX = padL + (d - 1) * slotW + slotW / 2;

      svg += `
        <rect x="${padL + (d - 1) * slotW}" y="${padT}" width="${slotW}" height="${plotH}" fill="transparent"
              class="chart-col-hover" data-day="${d}" data-count="${cnt}" style="cursor: pointer;" />
      `;

      if (isToday) {
        svg += `
          <rect x="${padL + (d - 1) * slotW}" y="${padT}" width="${slotW}" height="${plotH}" fill="hsla(150, 72%, 36%, 0.08)" rx="4" pointer-events="none" />
        `;
      }

      if (cnt > 0) {
        const grad = isToday ? "url(#barGradToday)" : "url(#barGrad)";
        svg += `
          <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="${grad}" pointer-events="none" />
          <text x="${centerX}" y="${Math.max(y - 5, padT + 12)}" font-size="10.5" font-weight="700" fill="var(--text)" text-anchor="middle" pointer-events="none">${cnt}</text>
        `;
      } else {
        svg += `
          <circle cx="${centerX}" cy="${yGrid0}" r="2" fill="var(--border-strong)" pointer-events="none" />
        `;
      }

      const showLabel = (totalDays <= 15) || (d === 1 || d === totalDays || d % 2 === 1);
      if (showLabel) {
        const fontColor = isToday ? "var(--green)" : "var(--muted)";
        const fontWeight = isToday ? "700" : "500";
        svg += `
          <text x="${centerX}" y="${h - 10}" font-size="10.5" font-weight="${fontWeight}" fill="${fontColor}" text-anchor="middle" pointer-events="none">${d}</text>
        `;
      }
    }

    svg += `</svg>`;
    return svg;
  }

  function initDashboardTableFilters() {
    const selYear = $("#filter-year");
    if (!selYear) return;
    const curYear = new Date().getFullYear();
    const years = new Set([curYear]);
    state.history.forEach((h) => {
      const dt = h.form?.tanggal_awal || (h.created_at ? h.created_at.slice(0, 10) : "");
      if (dt) {
        const y = parseInt(dt.split("-")[0], 10);
        if (y) years.add(y);
      }
    });
    const sortedYears = [...years].sort((a, b) => b - a);
    selYear.innerHTML = `<option value="all">Semua Tahun</option>` +
      sortedYears.map((y) => `<option value="${y}" ${String(y) === String(state.dashFilter.year) ? "selected" : ""}>${y}</option>`).join("");
  }

  function renderDashboardTable() {
    const tbody = $("#dash-table-body");
    if (!tbody) return;

    const filtered = state.history.filter((item) => {
      const dt = item.form?.tanggal_awal || (item.created_at ? item.created_at.slice(0, 10) : "");
      let itemYear = "";
      let itemMonth = "";
      if (dt) {
        const parts = dt.split("-");
        itemYear = String(parts[0]);
        itemMonth = String(Number(parts[1]));
      }
      const itemStatus = item.status || (item.files?.length ? "generate" : "draft");

      if (state.dashFilter.year !== "all" && itemYear !== String(state.dashFilter.year)) return false;
      if (state.dashFilter.month !== "all" && itemMonth !== String(state.dashFilter.month)) return false;
      if (state.dashFilter.status !== "all" && itemStatus !== state.dashFilter.status) return false;

      if (state.dashFilter.search) {
        const q = state.dashFilter.search.toLowerCase();
        const str = `${item.profil || ""} ${item.periode || ""} ${item.form?.kegiatan || ""} ${item.form?.capaian || ""} ${item.form?.rencana_kinerja || ""}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });

    const countEl = $("#dash-table-count");
    if (countEl) countEl.textContent = `${filtered.length} Laporan`;

    if (!filtered.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty" style="padding: 40px 20px;">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
            <p>Tidak ada laporan yang sesuai dengan filter.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((item, idx) => {
      const dt = item.form?.tanggal_awal || (item.created_at ? item.created_at.slice(0, 10) : "-");
      const status = item.status || (item.files?.length ? "generate" : "draft");
      const statusLabels = { generate: "Generate", proses: "Proses", draft: "Draft" };
      const statusLabel = statusLabels[status] || status;

      const filesHtml = (item.files || []).map((f) => `
        <button class="ghost-btn sm-btn" data-dash-file="${escapeHtml(f.path)}" type="button" title="Buka ${f.type.toUpperCase()}">
          <span class="file-tag ${f.type}">${f.type.toUpperCase()}</span> Buka
        </button>
      `).join("") || '<span style="font-size: 11.5px; color: var(--muted);">-</span>';

      const pegawaiNama = item.form?.profil?.nama || item.profil || "-";
      const pegawaiNip = item.form?.profil?.nip || "-";
      const pegawaiJabatan = item.form?.profil?.jabatan || "";

      const cleanKegiatan = (item.form?.kegiatan_judul || item.form?.kegiatan || "-").replace(/<[^>]*>/g, " ").trim();
      const cleanCapaian = (item.form?.capaian || "").replace(/<[^>]*>/g, " ").trim();

      return `
        <tr>
          <td style="text-align: center; font-weight: 600; color: var(--muted);">${idx + 1}</td>
          <td>
            <div style="font-weight: 600; color: var(--text);">${escapeHtml(dt)}</div>
            <div style="font-size: 11.5px; color: var(--muted); margin-top: 2px;">${escapeHtml(item.periode || "-")}</div>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text);">${escapeHtml(pegawaiNama)}</div>
            <div style="font-size: 11.5px; color: var(--muted); margin-top: 2px;">NIP. ${escapeHtml(pegawaiNip)}${pegawaiJabatan ? " · " + escapeHtml(pegawaiJabatan) : ""}</div>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text); display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;" title="${escapeHtml(cleanKegiatan)}">${escapeHtml(cleanKegiatan)}</div>
            <div style="font-size: 12px; color: var(--text-2); margin-top: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(cleanCapaian)}</div>
          </td>
          <td>
            <span class="status-badge ${status}">
              <span class="status-dot"></span>
              ${statusLabel}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">${filesHtml}</div>
          </td>
          <td>
            <div class="row-actions">
              <button class="ghost-btn sm-btn" data-dash-reuse="${item.id}" type="button" title="Buka / Edit di Form">Form</button>
              ${item.files?.[0] ? `<button class="ghost-btn sm-btn" data-dash-folder="${escapeHtml(item.files[0].path)}" type="button" title="Buka Folder">Folder</button>` : ""}
              <button class="ghost-btn sm-btn" data-dash-del="${item.id}" type="button" style="color: var(--danger);" title="Hapus">Hapus</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  async function handleSaveDraft() {
    const payload = collectPayload();
    payload.id = state.currentEditingId;
    payload.status = "draft";

    $("#loader-text").textContent = "Menyimpan draft laporan...";
    $("#overlay-loader").hidden = false;
    try {
      const res = state.api.save_draft ? await state.api.save_draft(payload) : null;
      if (res && res.ok) {
        state.history = res.history || await state.api.get_history();
        state.currentEditingId = res.entry?.id || state.currentEditingId;
        $("#history-count").textContent = state.history.length;
        renderDashboard();
        refreshHistory();
        toast("Draft laporan berhasil disimpan ke arsip.", "success");
      } else {
        toast("Gagal menyimpan draft: " + (res?.error || "Kesalahan tidak diketahui"), "error");
      }
    } catch (e) {
      toast("Error saat menyimpan draft: " + e.message, "error");
    } finally {
      $("#overlay-loader").hidden = true;
    }
  }

  // ------------------------------------------------------------------------
  // Pengaturan & Logo
  // ------------------------------------------------------------------------
  function updateLogoDisplay(dataUrl, useLogo = true) {
    if (dataUrl !== undefined) state.logoDataUrl = dataUrl || null;
    if (useLogo !== undefined) state.useLogo = Boolean(useLogo);
    const activeUrl = (state.useLogo && state.logoDataUrl) ? state.logoDataUrl : null;

    // 1. Live preview kop dokumen
    const pLogo = $("#p-logo");
    const logoHint = $("#logo-hint");
    if (activeUrl) {
      if (pLogo) {
        pLogo.style.display = "";
        pLogo.style.backgroundImage = `url("${activeUrl}")`;
      }
      if (logoHint) logoHint.hidden = true;
    } else {
      if (pLogo) {
        pLogo.style.display = "none";
        pLogo.style.backgroundImage = "none";
      }
      if (logoHint) logoHint.hidden = false;
    }

    // 2. Settings Logo Preview Card
    const imgEl = $("#logo-setting-img");
    const emptyEl = $("#logo-setting-empty");
    const badgeEl = $("#badge-logo-status");

    if (activeUrl) {
      if (imgEl) {
        imgEl.src = activeUrl;
        imgEl.hidden = false;
      }
      if (emptyEl) emptyEl.hidden = true;
      if (badgeEl) {
        badgeEl.textContent = "Aktif";
        badgeEl.className = "badge";
      }
    } else {
      if (imgEl) {
        imgEl.src = "";
        imgEl.hidden = true;
      }
      if (emptyEl) emptyEl.hidden = false;
      if (badgeEl) {
        badgeEl.textContent = "Nonaktif";
        badgeEl.className = "badge outline";
      }
    }
  }

  function fillSettingsForm() {
    const s = state.settings || {};
    const inst = s.instansi || {};
    $("#s-instansi").value = inst.nama || "BADAN PUSAT STATISTIK";
    $("#s-wilayah").value = inst.wilayah || "PROVINSI LAMPUNG";
    $("#s-kota").value = inst.kota || "Bandar Lampung";
    $("#s-output-dir").value = s.output_dir || state.defaultOutputDir || "";
    updateLogoDisplay(state.logoDataUrl, s.use_logo !== false);
  }

  async function saveSettings(e) {
    e.preventDefault();
    const instansi = {
      nama: ($("#s-instansi").value.trim() || "BADAN PUSAT STATISTIK").toUpperCase(),
      wilayah: ($("#s-wilayah").value.trim() || "PROVINSI LAMPUNG").toUpperCase(),
      kota: $("#s-kota").value.trim() || "Bandar Lampung",
    };
    const outputDir = $("#s-output-dir").value.trim();

    const payload = {
      instansi,
      output_dir: outputDir,
    };
    const res = await state.api.save_settings(payload);
    state.settings = res.settings;
    fillSelects();
    fillSettingsForm();
    updatePreview();
    toast("Pengaturan instansi dan folder output berhasil disimpan.", "success");
  }

  // ------------------------------------------------------------------------
  // Master Data Pegawai
  // ------------------------------------------------------------------------
  function renderMasterPegawai() {
    const list = getActivePegawaiList();
    const tbody = $("#tbody-pegawai");
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--muted); padding: 30px;">Belum ada data pegawai. Silakan tambah data baru.</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map((p, idx) => `
      <tr>
        <td style="font-weight: 600; color: var(--muted);">${idx + 1}</td>
        <td style="font-weight: 600;">${escapeHtml(p.nama)}</td>
        <td><code>${escapeHtml(p.nip)}</code></td>
        <td>${escapeHtml(p.jabatan || "-")}</td>
        <td>
          <div class="row-actions">
            <button class="ghost-btn sm-btn" data-edit-pegawai="${idx}" type="button">Edit</button>
            <button class="ghost-btn sm-btn" data-del-pegawai="${idx}" type="button" style="color: var(--danger);">Hapus</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function openModalPegawai(idx = -1) {
    const list = getActivePegawaiList();
    $("#mp-edit-idx").value = idx;
    if (idx >= 0 && list[idx]) {
      const p = list[idx];
      $("#title-modal-pegawai").textContent = "Edit Data Pegawai";
      $("#mp-nama").value = p.nama || "";
      $("#mp-nip").value = p.nip || "";
      $("#mp-jabatan").value = p.jabatan || "";
    } else {
      $("#title-modal-pegawai").textContent = "Tambah Data Pegawai";
      $("#mp-nama").value = "";
      $("#mp-nip").value = "";
      $("#mp-jabatan").value = "";
    }
    $("#modal-pegawai").hidden = false;
    $("#mp-nama").focus();
  }

  function updateSignatureDisplay(dataUrl) {
    state.signatureDataUrl = dataUrl || null;
    const preview = $("#mp-signature-preview");
    const removeBtn = $("#btn-mp-signature-remove");
    const uploadBtn = $("#btn-mp-signature");
    if (preview && removeBtn && uploadBtn) {
      if (state.signatureDataUrl) {
        preview.src = state.signatureDataUrl;
        preview.style.display = "block";
        removeBtn.style.display = "block";
        uploadBtn.textContent = "Ganti Tanda Tangan";
      } else {
        preview.src = "";
        preview.style.display = "none";
        removeBtn.style.display = "none";
        uploadBtn.textContent = "Unggah Tanda Tangan";
      }
    }
    updatePreview();
  }

  async function handleSavePegawai(e) {
    e.preventDefault();
    const idx = Number($("#mp-edit-idx").value);
    const nama = $("#mp-nama").value.trim();
    const nip = $("#mp-nip").value.trim();
    const jabatan = $("#mp-jabatan").value.trim();
    if (!nama || !nip) return toast("Nama dan NIP wajib diisi!", "error");

    const list = [...getActivePegawaiList()];
    const item = { nama, nip, jabatan };
    if (idx >= 0 && idx < list.length) {
      list[idx] = item;
    } else {
      list.push(item);
    }

    state.settings.daftar_pegawai = list;
    if (state.api.save_master_pegawai) {
      await state.api.save_master_pegawai(list);
    } else {
      await state.api.save_settings({ daftar_pegawai: list });
    }
    fillSelects();
    fillSettingsForm();
    renderMasterPegawai();
    $("#modal-pegawai").hidden = true;
    toast(idx >= 0 ? "Data pegawai berhasil diperbarui." : "Pegawai baru berhasil ditambahkan.", "success");
  }

  async function handleDeletePegawai(idx) {
    const list = [...getActivePegawaiList()];
    if (!list[idx]) return;
    if (!confirm(`Hapus data pegawai "${list[idx].nama}"?`)) return;
    list.splice(idx, 1);
    state.settings.daftar_pegawai = list;
    if (state.api.save_master_pegawai) {
      await state.api.save_master_pegawai(list);
    } else {
      await state.api.save_settings({ daftar_pegawai: list });
    }
    fillSelects();
    fillSettingsForm();
    renderMasterPegawai();
    toast("Data pegawai telah dihapus.", "info");
  }

  // ------------------------------------------------------------------------
  // Master Data Rencana Kinerja (IKI)
  // ------------------------------------------------------------------------
  function renderMasterRk() {
    const list = state.settings.rencana_kinerja || [];
    const tbody = $("#tbody-rk");
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--muted); padding: 30px;">Belum ada rencana kinerja tersimpan.</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map((rk, idx) => `
      <tr>
        <td style="font-weight: 600; color: var(--muted);">${idx + 1}</td>
        <td>${escapeHtml(rk)}</td>
        <td>
          <div class="row-actions">
            <button class="ghost-btn sm-btn" data-edit-rk="${idx}" type="button">Edit</button>
            <button class="ghost-btn sm-btn" data-del-rk="${idx}" type="button" style="color: var(--danger);">Hapus</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function openModalRk(idx = -1) {
    const list = state.settings.rencana_kinerja || [];
    $("#mrk-edit-idx").value = idx;
    if (idx >= 0 && list[idx]) {
      $("#title-modal-rk").textContent = "Edit Rencana Kinerja";
      $("#mrk-teks").value = list[idx];
    } else {
      $("#title-modal-rk").textContent = "Tambah Rencana Kinerja";
      $("#mrk-teks").value = "";
    }
    $("#modal-rk").hidden = false;
    $("#mrk-teks").focus();
  }

  async function handleSaveRk(e) {
    e.preventDefault();
    const idx = Number($("#mrk-edit-idx").value);
    const teks = $("#mrk-teks").value.trim();
    if (!teks) return toast("Uraian rencana kinerja tidak boleh kosong!", "error");

    const list = [...(state.settings.rencana_kinerja || [])];
    if (idx >= 0 && idx < list.length) {
      list[idx] = teks;
    } else {
      list.push(teks);
    }

    state.settings.rencana_kinerja = list;
    if (state.api.save_master_rk) {
      await state.api.save_master_rk(list);
    } else {
      await state.api.save_settings({ rencana_kinerja: list });
    }
    fillSelects();
    renderMasterRk();
    $("#modal-rk").hidden = true;
    toast(idx >= 0 ? "Rencana kinerja diperbarui." : "Rencana kinerja baru ditambahkan.", "success");
  }

  async function handleDeleteRk(idx) {
    const list = [...(state.settings.rencana_kinerja || [])];
    if (!list[idx]) return;
    if (!confirm("Hapus rencana kinerja ini dari master data?")) return;
    list.splice(idx, 1);
    state.settings.rencana_kinerja = list;
    if (state.api.save_master_rk) {
      await state.api.save_master_rk(list);
    } else {
      await state.api.save_settings({ rencana_kinerja: list });
    }
    fillSelects();
    renderMasterRk();
    toast("Rencana kinerja telah dihapus.", "info");
  }

  async function reloadSettings() {
    const data = await state.api.get_initial_data();
    state.settings = data.settings;
    fillSelects();
  }

  // ------------------------------------------------------------------------
  // Event binding
  // ------------------------------------------------------------------------
  function bindEvents() {
    $$(".nav-item").forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));
    $("#btn-open-output").addEventListener("click", () => state.api.open_folder(null));
    $("#btn-reset").addEventListener("click", () => { resetForm(); toast("Form direset."); });

    // Pegawai Dropdown
    el.pegawaiSelect.addEventListener("change", () => {
      const idx = el.pegawaiSelect.value;
      if (idx === "custom") {
        el.nama.value = "";
        el.nip.value = "";
        el.jabatan.value = "";
        el.nama.focus();
      } else if (idx !== "") {
        const list = getActivePegawaiList();
        const p = list[Number(idx)];
        if (p) {
          el.nama.value = p.nama || "";
          el.nip.value = p.nip || "";
          el.jabatan.value = p.jabatan || "";
        }
      }
      updatePreview();
    });

    [el.nama, el.nip, el.jabatan].forEach((input) => {
      input.addEventListener("input", () => {
        input.classList.remove("invalid");
        updatePreview();
      });
    });

    // Rencana Kinerja (IKI)
    el.rkSelect.addEventListener("change", () => {
      const i = el.rkSelect.value;
      if (i !== "") el.rk.value = state.settings.rencana_kinerja[Number(i)];
      el.rk.classList.remove("invalid");
      updatePreview();
    });
    el.rk.addEventListener("input", () => {
      el.rk.classList.remove("invalid");
      updatePreview();
    });

    // Kegiatan text input & RTF
    el.kegiatanJudul?.addEventListener("input", () => {
      el.kegiatanJudul.classList.remove("invalid");
      updatePreview();
    });

    // RTF toolbar buttons
    $$(".rtf-toolbar").forEach((bar) => {
      bar.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-cmd]");
        if (!btn) return;
        e.preventDefault();
        const cmd = btn.dataset.cmd;
        const targetId = bar.dataset.target;
        const target = $(`#${targetId}`);
        target.focus();
        document.execCommand(cmd, false, null);
        updatePreview();
      });
    });

    // RTF content editable listeners
    [el.uraianRtf, el.hasilRtf].forEach((div) => {
      div.addEventListener("input", () => {
        div.closest(".rtf-wrap")?.classList.remove("invalid");
        updatePreview();
      });
    });

    // Waktu & Periode Manual
    el.useManualPeriod.addEventListener("change", () => {
      syncToggles();
      updatePreview();
    });
    el.manualPeriod.addEventListener("input", () => {
      el.manualPeriod.classList.remove("invalid");
      updatePreview();
    });
    [el.usePeriod, el.useTime].forEach((x) => x.addEventListener("change", () => { syncToggles(); updatePreview(); }));
    el.dateStart.addEventListener("change", () => {
      if (el.dateEnd.value && el.dateEnd.value < el.dateStart.value) el.dateEnd.value = el.dateStart.value;
      updatePreview();
    });
    el.dateEnd.addEventListener("change", updatePreview);
    el.dateReport?.addEventListener("change", updatePreview);
    el.timeStart.addEventListener("change", updatePreview);
    el.timeEnd.addEventListener("change", updatePreview);

    // Progres
    el.progres.addEventListener("input", () => { setProgres(el.progres.value); updatePreview(); });
    el.progresNum.addEventListener("input", () => { setProgres(el.progresNum.value); updatePreview(); });

    // Output Format
    [el.fmtPdf, el.fmtDocx].forEach((x) => x.addEventListener("change", updatePreview));

    // Upload gambar & drag-drop
    el.fileInput.addEventListener("change", () => { addFiles(el.fileInput.files); el.fileInput.value = ""; });
    const dz = $("#dropzone");
    ["dragenter", "dragover"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
    dz.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));
    document.addEventListener("paste", (e) => {
      if (!$("#view-form").classList.contains("active")) return;
      const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
      if (files.length) { e.preventDefault(); addFiles(files); toast(`${files.length} gambar ditempel dari clipboard.`, "success"); }
    });

    // Caption edit & action
    $("#thumbs").addEventListener("input", (e) => {
      const input = e.target.closest(".thumb-caption");
      if (input) {
        const id = input.dataset.captionId;
        const img = state.images.find((x) => x.id === id);
        if (img) {
          img.caption = input.value;
          updatePreview();
        }
      }
    });
    $("#thumbs").addEventListener("click", onThumbAction);

    // Generate & Hasil
    $("#btn-generate").addEventListener("click", generate);
    document.addEventListener("keydown", (e) => {
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") generate();
      if (e.key === "Escape") $("#result-modal").hidden = true;
    });
    $("#result-files").addEventListener("click", (e) => { const b = e.target.closest("[data-open]"); if (b) openFile(b.dataset.open); });
    $("#btn-result-folder").addEventListener("click", () => state.api.open_folder(state.lastResult?.files?.[0]?.path || null));
    $("#btn-result-close").addEventListener("click", () => ($("#result-modal").hidden = true));
    $("#btn-result-new").addEventListener("click", () => { $("#result-modal").hidden = true; resetForm(); });

    // Fullscreen Toggle
    async function toggleFullscreen() {
      if (state.api.toggle_fullscreen) {
        const res = await state.api.toggle_fullscreen();
        const isFull = !!res.fullscreen;
        const lbl = $("#fullscreen-label");
        if (lbl) lbl.textContent = isFull ? "Keluar Layar Penuh" : "Layar Penuh (F11)";
        toast(isFull ? "Mode layar penuh diaktifkan." : "Mode layar penuh dinonaktifkan.", "info", 1800);
      } else {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen().catch(() => { });
          const lbl = $("#fullscreen-label");
          if (lbl) lbl.textContent = "Keluar Layar Penuh";
        } else {
          await document.exitFullscreen().catch(() => { });
          const lbl = $("#fullscreen-label");
          if (lbl) lbl.textContent = "Layar Penuh (F11)";
        }
      }
    }
    // Draft & Fullscreen
    $("#btn-save-draft")?.addEventListener("click", handleSaveDraft);
    $("#btn-fullscreen")?.addEventListener("click", toggleFullscreen);

    // Wide Mode Toggle for Form (Perlebar Uraian Kegiatan & Capaian)
    const updateWideModeUi = (isWide) => {
      const layout = $(".form-layout");
      const lbl = $("#lbl-toggle-wide");
      const btn = $("#btn-toggle-wide");
      if (!layout) return;
      if (isWide) {
        layout.classList.add("wide-mode");
        if (lbl) lbl.textContent = "Tampilkan Pratinjau";
        if (btn) btn.classList.add("active");
      } else {
        layout.classList.remove("wide-mode");
        if (lbl) lbl.textContent = "Perlebar Form";
        if (btn) btn.classList.remove("active");
      }
    };

    let isFormWide = localStorage.getItem("daily_works_form_wide") === "1";
    updateWideModeUi(isFormWide);

    $("#btn-toggle-wide")?.addEventListener("click", () => {
      isFormWide = !isFormWide;
      localStorage.setItem("daily_works_form_wide", isFormWide ? "1" : "0");
      updateWideModeUi(isFormWide);
    });

    // Form Bottom Action Bar delegates
    $("#btn-bottom-generate")?.addEventListener("click", () => {
      $("#btn-generate")?.click();
    });
    $("#btn-bottom-draft")?.addEventListener("click", () => {
      $("#btn-save-draft")?.click();
    });


    // Dashboard Chart Controls & Tooltip
    $("#dash-chart-month")?.addEventListener("change", (e) => {
      state.chartFilter.month = Number(e.target.value);
      renderDashboardChart();
    });
    $("#dash-chart-year")?.addEventListener("change", (e) => {
      state.chartFilter.year = Number(e.target.value);
      renderDashboardChart();
    });
    $("#dash-chart-container")?.addEventListener("mousemove", (e) => {
      const col = e.target.closest(".chart-col-hover");
      const tt = $("#dash-chart-tooltip");
      if (!col || !tt) {
        if (tt) tt.style.display = "none";
        return;
      }
      const day = col.dataset.day;
      const cnt = col.dataset.count;
      const monthName = BULAN[state.chartFilter.month - 1];
      tt.innerHTML = `<strong>${day} ${monthName} ${state.chartFilter.year}</strong><br><span style="color:var(--blue); font-weight:700;">${cnt} Laporan Dibuat</span>`;
      tt.style.display = "block";
      const box = $("#dash-chart-container").getBoundingClientRect();
      tt.style.left = `${e.clientX - box.left}px`;
      tt.style.top = `${e.clientY - box.top - 10}px`;
    });
    $("#dash-chart-container")?.addEventListener("mouseleave", () => {
      const tt = $("#dash-chart-tooltip");
      if (tt) tt.style.display = "none";
    });

    // Dashboard Table Filters
    $("#filter-year")?.addEventListener("change", (e) => {
      state.dashFilter.year = e.target.value;
      renderDashboardTable();
    });
    $("#filter-month")?.addEventListener("change", (e) => {
      state.dashFilter.month = e.target.value;
      renderDashboardTable();
    });
    $("#filter-status")?.addEventListener("change", (e) => {
      state.dashFilter.status = e.target.value;
      renderDashboardTable();
    });
    $("#filter-search")?.addEventListener("input", (e) => {
      state.dashFilter.search = e.target.value.trim();
      renderDashboardTable();
    });
    $("#btn-reset-filter")?.addEventListener("click", () => {
      state.dashFilter = { year: "all", month: "all", status: "all", search: "" };
      if ($("#filter-year")) $("#filter-year").value = "all";
      if ($("#filter-month")) $("#filter-month").value = "all";
      if ($("#filter-status")) $("#filter-status").value = "all";
      if ($("#filter-search")) $("#filter-search").value = "";
      renderDashboardTable();
    });

    // Dashboard Table Row Actions
    $("#dash-table-body")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      if (btn.dataset.dashFile) openFile(btn.dataset.dashFile);
      if (btn.dataset.dashFolder) state.api.open_folder(btn.dataset.dashFolder);
      if (btn.dataset.dashReuse) reuseEntry(btn.dataset.dashReuse);
      if (btn.dataset.dashDel) {
        if (confirm("Hapus laporan ini dari arsip? (File fisik di folder tidak akan dihapus)")) {
          state.history = await state.api.delete_history(btn.dataset.dashDel);
          $("#history-count").textContent = state.history.length;
          renderDashboard();
          renderHistory();
          toast("Laporan dihapus dari arsip.", "info");
        }
      }
    });

    // Riwayat
    $("#history-search").addEventListener("input", renderHistory);
    $("#history-list").addEventListener("click", async (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      if (t.dataset.open) openFile(t.dataset.open);
      if (t.dataset.folder) state.api.open_folder(t.dataset.folder);
      if (t.dataset.reuse) reuseEntry(t.dataset.reuse);
      if (t.dataset.delete && confirm("Hapus entri ini dari riwayat? (File laporan tidak ikut terhapus)")) {
        state.history = await state.api.delete_history(t.dataset.delete);
        $("#history-count").textContent = state.history.length;
        renderHistory();
        renderDashboard();
      }
    });

    // Pengaturan
    $("#settings-form").addEventListener("submit", saveSettings);
    $("#btn-browse-output")?.addEventListener("click", async () => {
      if (state.api.select_output_folder) {
        const res = await state.api.select_output_folder();
        if (res.ok && res.path) {
          $("#s-output-dir").value = res.path;
          toast("Folder output dipilih: " + res.path, "info");
        }
      }
    });
    $("#btn-reset-output")?.addEventListener("click", () => {
      $("#s-output-dir").value = state.defaultOutputDir || "";
      toast("Folder output direset ke default.", "info");
    });

    // Logo Instansi
    $("#btn-upload-logo")?.addEventListener("click", () => {
      $("#input-logo-file")?.click();
    });

    $("#input-logo-file")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast("File harus berupa gambar (PNG, JPG, WebP).", "error");
        return;
      }
      e.target.value = "";
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const res = await state.api.upload_logo(ev.target.result);
          if (res.ok) {
            updateLogoDisplay(res.logo_data_url, true);
            toast("Logo instansi berhasil diunggah.", "success");
          } else {
            toast(res.error || "Gagal mengunggah logo.", "error");
          }
        } catch (err) {
          toast("Gagal memproses gambar: " + err.message, "error");
        }
      };
      reader.readAsDataURL(file);
    });

    $("#btn-default-logo")?.addEventListener("click", async () => {
      try {
        const res = await state.api.reset_logo("default");
        if (res.ok) {
          updateLogoDisplay(res.logo_data_url, true);
          toast(res.message || "Logo instansi dikembalikan ke bawaan sistem.", "success");
        } else {
          toast(res.error || "Gagal memulihkan logo default.", "error");
        }
      } catch (err) {
        toast("Terjadi kesalahan: " + err.message, "error");
      }
    });

    $("#btn-remove-logo")?.addEventListener("click", async () => {
      if (!confirm("Hilangkan logo dari kop surat laporan?")) return;
      try {
        const res = await state.api.reset_logo("remove");
        if (res.ok) {
          updateLogoDisplay(null, false);
          toast(res.message || "Logo dihilangkan dari kop laporan.", "info");
        } else {
          toast(res.error || "Gagal menghapus logo.", "error");
        }
      } catch (err) {
        toast("Terjadi kesalahan: " + err.message, "error");
      }
    });

    // Backup Data
    $("#btn-backup-data")?.addEventListener("click", async () => {
      try {
        const res = await state.api.backup_data();
        if (res.ok && res.path) {
          toast(`Data berhasil dicadangkan ke: ${res.path}`, "success", 4000);
        } else if (res.ok && res.payload) {
          const blob = new Blob([JSON.stringify(res.payload, null, 2)], { type: "application/json" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = res.filename || "backup_dna.json";
          a.click();
          URL.revokeObjectURL(a.href);
          toast("File backup .json berhasil diunduh.", "success");
        } else if (!res.cancelled) {
          toast(res.error || "Gagal mencadangkan data.", "error");
        }
      } catch (err) {
        toast("Terjadi kesalahan saat backup: " + err.message, "error");
      }
    });

    // Restore Data
    $("#btn-restore-data")?.addEventListener("click", async () => {
      try {
        const res = await state.api.restore_data();
        if (res.ok) {
          state.settings = res.settings;
          state.history = res.history;
          $("#history-count").textContent = state.history.length;
          fillSelects();
          fillSettingsForm();
          renderDashboard();
          renderHistory();
          renderMasterPegawai();
          renderMasterRk();
          toast(`Data berhasil dipulihkan (${res.total_history || state.history.length} laporan dimuat).`, "success");
        } else if (res.cancelled) {
          // Batal oleh pengguna
        } else {
          $("#input-restore-file")?.click();
        }
      } catch (err) {
        $("#input-restore-file")?.click();
      }
    });

    $("#input-restore-file")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const content = ev.target.result;
          const res = await state.api.restore_data(content);
          if (res.ok) {
            state.settings = res.settings;
            state.history = res.history;
            $("#history-count").textContent = state.history.length;
            fillSelects();
            fillSettingsForm();
            renderDashboard();
            renderHistory();
            renderMasterPegawai();
            renderMasterRk();
            toast("Data berhasil dipulihkan dari file cadangan.", "success");
          } else {
            toast(res.error || "Gagal memulihkan data dari file.", "error");
          }
        } catch (err) {
          toast("File backup tidak valid: " + err.message, "error");
        }
      };
      reader.readAsText(file);
    });

    // Reset Data
    $("#btn-reset-data")?.addEventListener("click", async () => {
      const msg = "PERINGATAN: Apakah Anda yakin ingin MENGOSONGKAN SELURUH data aplikasi?\n\n" +
        "• Semua riwayat laporan harian akan dihapus.\n" +
        "• Pengaturan dan master data akan dikosongkan.\n" +
        "• Berkas di folder data (history dan settings) akan dibersihkan.\n\n" +
        "Tindakan ini tidak dapat dibatalkan. Lanjutkan?";
      if (!confirm(msg)) return;

      try {
        const res = await state.api.reset_data();
        if (res.ok) {
          state.settings = res.settings;
          state.history = res.history;
          $("#history-count").textContent = "0";
          fillSelects();
          fillSettingsForm();
          resetForm();
          renderDashboard();
          renderHistory();
          renderMasterPegawai();
          renderMasterRk();
          toast("Semua data dalam folder data telah dikosongkan.", "info", 4000);
        } else {
          toast(res.error || "Gagal mengosongkan data.", "error");
        }
      } catch (err) {
        toast("Terjadi kesalahan saat reset: " + err.message, "error");
      }
    });

    // Tema Toggle
    $("#btn-theme-toggle").addEventListener("click", toggleTheme);

    // Master Data Pegawai
    $("#btn-add-pegawai")?.addEventListener("click", () => openModalPegawai(-1));
    $("#btn-cancel-pegawai")?.addEventListener("click", () => { $("#modal-pegawai").hidden = true; });
    $("#form-pegawai")?.addEventListener("submit", handleSavePegawai);
    $("#tbody-pegawai")?.addEventListener("click", (e) => {
      const editBtn = e.target.closest("[data-edit-pegawai]");
      if (editBtn) openModalPegawai(Number(editBtn.dataset.editPegawai));
      const delBtn = e.target.closest("[data-del-pegawai]");
      if (delBtn) handleDeletePegawai(Number(delBtn.dataset.delPegawai));
    });

    // Signature di Modal Pegawai
    $("#btn-mp-signature")?.addEventListener("click", () => {
      $("#mp-signature-file")?.click();
    });

    $("#mp-signature-file")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast("File harus berupa gambar (PNG, JPG, WebP).", "error");
        return;
      }
      e.target.value = "";
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const res = await state.api.upload_signature(ev.target.result);
          if (res.ok) {
            updateSignatureDisplay(res.signature_data_url);
            toast("Tanda tangan berhasil diunggah.", "success");
          } else {
            toast(res.error || "Gagal mengunggah tanda tangan.", "error");
          }
        } catch (err) {
          toast("Gagal memproses gambar: " + err.message, "error");
        }
      };
      reader.readAsDataURL(file);
    });

    $("#btn-mp-signature-remove")?.addEventListener("click", async () => {
      if (!confirm("Hapus tanda tangan?")) return;
      try {
        const res = await state.api.remove_signature();
        if (res.ok) {
          updateSignatureDisplay(null);
          toast("Tanda tangan dihapus.", "info");
        } else {
          toast(res.error || "Gagal menghapus tanda tangan.", "error");
        }
      } catch (err) {
        toast("Terjadi kesalahan: " + err.message, "error");
      }
    });

    // Master Data Rencana Kinerja
    $("#btn-add-rk")?.addEventListener("click", () => openModalRk(-1));
    $("#btn-cancel-rk")?.addEventListener("click", () => { $("#modal-rk").hidden = true; });
    $("#form-rk")?.addEventListener("submit", handleSaveRk);
    $("#tbody-rk")?.addEventListener("click", (e) => {
      const editBtn = e.target.closest("[data-edit-rk]");
      if (editBtn) openModalRk(Number(editBtn.dataset.editRk));
      const delBtn = e.target.closest("[data-del-rk]");
      if (delBtn) handleDeleteRk(Number(delBtn.dataset.delRk));
    });
  }

  // ------------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------------
  async function init() {
    initTheme();
    cacheElements();
    state.api = await waitForApi();
    const data = await state.api.get_initial_data();
    state.settings = data.settings;
    state.history = data.history || [];
    state.minImages = data.min_images ?? 0;
    state.skpPeriods = data.skp_periods || [];
    state.defaultOutputDir = data.default_output_dir || data.output_dir || "";
    state.logoDataUrl = data.logo_data_url || null;
    state.useLogo = data.use_logo !== false;
    state.signatureDataUrl = data.signature_data_url || null;

    $("#app-version").textContent = `v${data.version}`;
    $("#history-count").textContent = state.history.length;
    updateLogoDisplay(state.logoDataUrl, state.useLogo);
    updateSignatureDisplay(state.signatureDataUrl);

    fillSelects();
    fillSettingsForm();
    bindEvents();
    resetForm();
    showView("dashboard");
    renderDashboard();
    if (state.api.demo) toast("Mode demo (browser). Jalankan aplikasi via uv untuk generate file.", "info", 6000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
