# Standar Sistem Desain UI (UI Design System Standards) — Fiber UNMS Enterprise

Dokumen ini merupakan pedoman resmi dan permanen untuk tampilan antarmuka (UI/UX) pada seluruh modul aplikasi Fiber UNMS Enterprise. Standar ini wajib diikuti secara konsisten pada setiap pembuatan komponen, kontainer, kartu, maupun modal baru.

---

## 1. Palet Warna Dasar & Tipografi (Monochrome High-Contrast Baseline)

| Mode Tampilan | Warna Background | Warna Garis / Border Luar | Warna Teks Utama & Label |
| :--- | :--- | :--- | :--- |
| **Dark Mode** | `#000000` (*Pure Pitch Black*) / `dark:bg-black` | `dark:border-white` (`#ffffff`) | **`dark:text-white` (`#ffffff`)** |
| **Light Mode** | `#ffffff` (*Pure Clean White*) / `bg-white` | `border-black` (`#000000`) | **`text-black` (`#000000`)** |

- **Aturan Warna Background**:
  - Jangan gunakan warna dark navy blue (seperti `bg-slate-900` atau `#090d16`) sebagai background di mode gelap. Dark mode harus murni **hitam pekat (`#000000`)**.
  - Light mode harus murni **putih bersih (`#ffffff`)**.
- **Aturan Warna Teks (High Contrast Text)**:
  - **Mode Gelap**: Penerapan warna teks utama, judul, data, maupun label adalah **warna putih (`dark:text-white` / `#ffffff`)**. Hindari teks abu-abu/slate gelap yang redup pada mode gelap agar kontras tajam dan nyaman dibaca.
  - **Mode Terang**: Penerapan warna teks utama, judul, data, maupun label adalah **warna hitam (`text-black` / `#000000`)**.
  - Pengecualian hanya untuk warna semantik status fungsional (misal: teks hijau untuk Open/Online, merah untuk Blokir/Offline/LOS, amber untuk Warning, indigo untuk ID teknis).
- **Ketebalan Garis Kontainer (Refined, Crisp 1px Lines)**:
  - Garis kontainer luar utama harus rapi, proporsional, dan tidak mencolok: gunakan ketebalan standar 1px (`border border-black/70 dark:border-white/70` atau `border border-black dark:border-white`).
  - **HINDARI `border-2`** pada kontainer, kartu, tabel, dan modal karena menghasilkan garis 2px yang terlalu tebal, kasar, dan mencolok (*visually overwhelming*).
  - Garis pemisah internal (divider horizontal/baris atau header/body): gunakan 1px dengan opasitas halus teratur (`border-b border-black/20 dark:border-white/20` atau `divide-black/20 dark:divide-white/20`).

---

## 2. Standar Kelengkungan Sudut yang Diringkas (Reduced Sharp Border Radius)

Kelengkungan sudut dibuat lebih tegas dan rapat (*sharp, compact, modern industrial aesthetic*). Hindari radius yang terlalu membulat:

| Elemen | Kelas Tailwind | Nilai Piksel |
| :--- | :--- | :--- |
| **Modal / Dialog Utama** | `rounded-lg sm:rounded-xl` | 8px (mobile) / 12px (desktop) |
| **Kartu Kontainer / Box Informasi / KPI** | `rounded-lg` | 8px |
| **Kartu Item / Card Port / Per-Elemen** | `rounded-lg` atau `rounded-md` | 8px / 6px |
| **Tombol Aksi (Buttons) & Input Form** | `rounded-md` | 6px |
| **Badge / Tag / Pill Kecil** | `rounded` | 4px |

---

## 3. Prinsip Tipografi & Penamaan Ringkas

- **Port & Penomoran**:
  - Hindari penamaan yang panjang seperti `"Port 1"`, `"Port 2"`.
  - Gunakan format ringkas terstandar: **`P1`**, **`P2`**, **`P3`**, dst., dengan font monospace tebal (`font-mono font-bold`).
- **Data Teknis (ID Pelanggan, Serial Number, Interface, Redaman Optik)**:
  - Selalu gunakan font monospace (`font-mono`) untuk data teknis agar keterbacaan presisi.

---

## 4. Konsep Badge & Pewarnaan: "Teks Berwarna Murni" (No Colored Background Boxes)

Hindari penggunaan kotak-kotak badge dengan background solid/tebal yang memenuhi kartu (*cluttered UI*). Terapkan konsep **Teks Berwarna Murni**:

1. **Status Layanan Pelanggan (Sobok)**:
   - **`OPEN`**: Ikon centang SVG + teks murni warna hijau emerald (`text-emerald-600 dark:text-emerald-400 font-bold`). Tanpa background kotak.
   - **`BLOKIR`**: Ikon gembok SVG + teks murni warna amber (`text-amber-600 dark:text-amber-400 font-bold`). Tanpa background kotak.
2. **Status Port Terisi**:
   - Titik hijau berkedip (*pulsing dot*) + teks hijau murni (`text-emerald-600 dark:text-emerald-400`). Tanpa kotak pill.
3. **ID Pelanggan (`CMN xxxx`)**:
   - Teks monospace berwarna indigo (`text-indigo-600 dark:text-indigo-400 font-bold`). Tanpa kotak background tebal.
4. **Indikator Redaman Optik (Rx Power)**:
   - Nilai redaman ditampilkan sebagai teks monospace dengan warna dinamis sesuai ambang batas:
     - $\ge -25.0$ dBm: Teks hijau prima (`text-emerald-600 dark:text-emerald-400 font-bold`).
     - $-25.1$ s/d $-28.0$ dBm: Teks amber peringatan (`text-amber-600 dark:text-amber-400 font-bold`).
     - $< -28.0$ dBm / Loss: Teks rose/merah kritis (`text-rose-600 dark:text-rose-400 font-bold animate-pulse`).

---

## 5. Larangan Penggunaan Karakter Emoji & Pembersihan Ikon Dekoratif (Zero-Emoji Policy)

- **Larangan Karakter Emoji (Zero-Emoji Policy)**:
  - **Dilarang keras menggunakan karakter emoji Unicode** (seperti `🗺️`, `📍`, `📏`, `🚨`, `📥`, `🏠`, `👁️`, `🌍`, `🎯`, `↩️`, `🟢`, `⚡`, `🧵`, dll.) pada judul halaman, sub-judul, tombol aksi, opsi dropdown/select, badge status, modal header, maupun kartu informasi di seluruh modul aplikasi.
  - **Alasan**: Emoji membuat antarmuka enterprise terkesan kasual/informal, memiliki tampilan render visual yang tidak konsisten antar-sistem operasi (Windows, macOS, Android, Linux), serta mengganggu keterbacaan data teknis.
  - **Solusi Pengganti**:
    - Gunakan **teks murni yang lugas, jelas, dan profesional** (contoh: gunakan `"Import KML"` bukan `"📥 Import KML"`, gunakan `"Cek Koordinat"` bukan `"📍 Cek Koordinat"`, gunakan `"Ukur Jarak FO"` bukan `"📏 Ukur Jarak FO"`).
    - Jika membutuhkan indikator visual, gunakan **ikon SVG minimalis monokrom/fungsional** atau **titik indikator CSS (pulsing dot)**.
- **Pembersihan Ikon Dekoratif**:
  - Jangan menambahkan ikon-ikon dekoratif generik yang tidak memiliki fungsi interaktif (misalnya ikon sinyal WiFi di header modal, ikon router di sebelah judul OLT, dll.).
  - Header dan kartu harus menampilkan informasi secara langsung, lugas, bersih, dan fungsional.

---

## 6. Standar Ekspor Tangkapan Layar (Screenshot / toPng)

Saat komponen diekspor menjadi gambar (*image screenshot*):
- Sistem harus mendeteksi mode tampilan aktif secara dinamis:
  ```javascript
  const isDarkMode = document.documentElement.classList.contains('dark');
  const canvasBgColor = isDarkMode ? '#000000' : '#ffffff';
  ```
- Terapkan background `#000000` (mode gelap) atau `#ffffff` (mode terang) langsung pada node elemen dan parameter `toPng`.
- Jangan menggunakan background navy/slate `#090d16` pada canvas screenshot.

---

## 7. Standar Struktur Filter Pop-up Dropdown (Top-Centered Modal & Searchable Selects)

Standar ini mengatur bagaimana bilah filter dan pencarian data diimplementasikan pada seluruh tabel atau modul manajemen (seperti Manajemen Pelanggan, Inventori, Tiket, ODP, dll.) agar hemat ruang (*space-saving*), rapi, dan konsisten di perangkat desktop maupun mobile.

### A. Filosofi & Tampilan Pemicu (Trigger Button)
- **Hindari Deretan Dropdown Terbuka yang Masif**:
  - Dilarang merender banyak dropdown filter (`OLT:`, `ODC:`, `ODP:`, `Status:`, dll.) secara langsung bersebelahan di bilah pencarian karena memakan banyak baris dan memecah kerapian layar.
- **Tombol Pemicu Ringkas `[ Filter ]`**:
  - Tempatkan tombol filter ringkas tepat di samping kanan kolom input pencarian utama.
  - Memiliki ikon corong (*funnel* SVG), label **"Filter"**, dan **badge bulat** jumlah filter aktif (`bg-blue-600 text-white`) ketika ada 1 atau lebih kriteria filter yang sedang diterapkan.
  - Jika ada filter yang aktif, tombol pemicu memiliki sorotan border biru lembut (`border-blue-600 dark:border-blue-500`).
  - Sediakan tombol pintas `[ ✕ Reset ]` tepat di sebelah tombol Filter ketika filter sedang aktif.

### B. Posisi Modal Pop-up: "Top-Centered Modal" (Tengah-Atas Layar)
- **Aturan Posisi Viewport**:
  - Jangan gunakan penempatan pojok kanan yang rawan terpotong tepi layar atau `items-center` yang menenggelamkan modal ke tengah/bawah layar mobile.
  - Gunakan penataan **Tengah Horizontal, Bagian Atas Vertikal (*Top-Centered*)**:
    ```html
    <!-- Wrapper Overlay Fixed -->
    <div class="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-start justify-center pt-14 sm:pt-20 pb-8 px-3 sm:px-4">
      <!-- Kartu Modal Dialog -->
      <div class="relative bg-white dark:bg-[#18181b] text-black dark:text-white border border-black/70 dark:border-white/40 rounded-lg shadow-2xl w-full max-w-md sm:max-w-lg overflow-hidden text-xs flex flex-col max-h-[82vh]">
        ...
      </div>
    </div>
    ```
- **Alasan & Kebutuhan Mobile**:
  - Penempatan `items-start pt-14 sm:pt-20` menjamin modal langsung berada dalam area pandang utama di bawah navbar atas. Pengguna smartphone **tidak perlu scroll ke bawah layar** untuk mencari modal filter.
  - Menutup otomatis saat backdrop diklik atau tombol `Escape` (`ESC`) ditekan.

### C. Anatomi Kartu Modal Pop-up Filter
1. **Header Modal**:
   - **Kiri**: Tombol `[ ✕ Bersihkan ]` (`bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20`) untuk mengosongkan seluruh draft filter.
   - **Tengah**: Ikon corong + Teks **"Filter"** tebal.
   - **Kanan**: Tombol primer biru `[ ✓ Terapkan ]` (`bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-1.5 rounded-md`) untuk mengeksekusi filter dan menutup modal.
2. **Body: Daftar Kriteria Accordion Interaktif**:
   - Kriteria filter disusun vertikal dengan pemisah garis halus (`divide-y divide-black/10 dark:divide-white/10`).
   - Setiap baris memiliki:
     - **Checkbox `[ ]`**
     - **Label Teks Biru Interaktif**: Menggunakan `text-blue-600 dark:text-blue-400 font-medium hover:underline text-xs cursor-pointer`.
   - **Prinsip Accordion**:
     - Ketika checkbox dicentang: Sub-dropdown kriteria tersebut terbuka (*expanded*) di bawahnya.
     - Ketika checkbox dilepas centangnya: Sub-dropdown otomatis menciut (*collapsed*) dan nilainya di-reset ke nilai default (`'all'`).

### D. Standar Dropdown dengan Kolom Pencarian (*Searchable Select*)
- Setiap dropdown data (terutama yang berpotensi memiliki banyak opsi seperti ODP, ODC, OLT, Paket, Wilayah) **wajib memiliki kolom input pencarian teks sticky di bagian atasnya**:
  - Placeholder pencarian yang jelas (contoh: *"Cari nama ODP..."*, *"Cari port interface..."*).
  - Opsi terfilter secara *real-time* saat pengguna mengetik.
  - Opsi aktif disorot dengan warna biru dan tanda centang `✓`.
  - Pesan informatif jika kata kunci tidak ditemukan (*"Tidak ada data ditemukan"*).

### E. Chip Indikator Filter Aktif (Removable Active Filter Chips)
- Ketika filter diterapkan, tampilkan deretan chip kecil di bawah bar pencarian:
  - Contoh: `[ OLT: ZTE-C300 ✕ ]`, `[ ODP: ODP-134 ✕ ]`, `[ Status: Online ✕ ]`.
  - Mengklik tanda `✕` pada chip akan langsung membatalkan filter tersebut secara instan tanpa perlu membuka pop-up kembali.

---

## 8. Standar Modal Dialog & Pop-up Detail/Form (Harmonized Pop-up Architecture)

Standar ini mengatur seluruh jendela modal pop-up dalam aplikasi (mulai dari Modal Edit Data, Form Tambah Node/Kabel, Detail Port ODP & Monitoring Redaman, Detail Lengkap ODC/ODP, hingga Modal Maintenance Jaringan) agar memiliki arsitektur, posisi, estetika, dan interaksi yang 100% selaras dan konsisten.

### A. Arsitektur Rendering: Direct React Portal (`createPortal`)
Semua komponen modal **wajib** di-mount langsung ke `document.body` menggunakan `createPortal(modalJSX, document.body)`.
- **Tujuan**:
  - Mencegah isu *stacking context* (`z-index`), clipping oleh kontainer peta Leaflet, overflow tersembunyi (*hidden overflow*), atau posisi modal melenceng saat di-scroll pada perangkat mobile/desktop.
- **Contoh Implementasi**:
  ```javascript
  import { createPortal } from 'react-dom';

  const MyStandardModal = ({ isOpen, onClose, children }) => {
    if (!isOpen) return null;

    return createPortal(
      <div 
        className="fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen"
        onClick={onClose}
      >
        <div 
          className="relative w-full max-w-2xl bg-white dark:bg-black rounded-lg sm:rounded-xl shadow-2xl border border-black/70 dark:border-white/70 my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 text-black dark:text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>,
      document.body
    );
  };
  ```

### B. Lapisan Latar Belakang (Backdrop Overlay)
- **Kelas Standar**:
  ```css
  fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen
  ```
- **Ketentuan Interaksi**:
  - `z-[99999]`: Berada di lapisan teratas di atas semua elemen UI, peta peta GIS, maupun bilah navigasi.
  - `bg-black/60 backdrop-blur-xs`: Menghadirkan efek redup gelap transparan 60% dengan blur halus untuk fokus perhatian pengguna.
  - **Klik Luar untuk Menutup (*Click-Outside to Close*)**: Mengklik area backdrop otomatis memicu fungsi `onClose()`.
  - **Pencegahan Event Bubbling**: Kontainer kartu modal harus memiliki `onClick={(e) => e.stopPropagation()}` agar klik di dalam modal tidak menutup modal.
  - **Keyboard Shortcut**: Wajib mendukung penutupan modal saat menekan tombol `Escape` (`ESC`).

### C. Kontainer Kartu Modal (Card Container) & Dimensi Lebar
- **Kelas Standar**:
  ```css
  relative w-full max-w-2xl bg-white dark:bg-black rounded-lg sm:rounded-xl shadow-2xl border border-black/70 dark:border-white/70 my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 text-black dark:text-white
  ```
- **Standar Lebar Maksimal (`max-w-*`)**:
  - **`max-w-2xl`** (672px): Untuk form input data tunggal, form edit properti, konfirmasi tindakan, atau detail node ringkas.
  - **`max-w-4xl`** (896px): Untuk grid multi-kolom kompleks (seperti Detail Port & Monitoring Redaman ODP, Log Maintenance, dan Detail Topologi ODC).
  - **`max-w-md sm:max-w-lg`** (448px - 512px): Khusus untuk Pop-up Filter Cepat (*Top-Centered Modal*).
- **Animasi Kemunculan**:
  - Gunakan `animate-in fade-in zoom-in duration-150` untuk transisi buka yang responsif, mulus, dan tidak memperlambat alur kerja pengguna.

### D. Struktur Anatomi 3 Bagian: Pinned Header, Scrollable Body, Pinned Footer

```
┌────────────────────────────────────────────────────────┐
│  PINNED HEADER (Title, Badges, Secondary Actions, [✕]) │ ← border-b (shrink-0)
├────────────────────────────────────────────────────────┤
│                                                        │
│  SCROLLABLE BODY (Form Inputs / Port Cards / Logs)     │ ← overflow-y-auto (flex-1)
│                                                        │
├────────────────────────────────────────────────────────┤
│  PINNED FOOTER ([Batal / Tutup]  ───  [Aksi Primer])   │ ← border-t (shrink-0)
└────────────────────────────────────────────────────────┘
```

#### 1. Header Tersemat (Pinned Header)
- **Kelas Standar**:
  ```css
  bg-white dark:bg-black text-black dark:text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-black/20 dark:border-white/20
  ```
- **Elemen Bagian Kiri**:
  - Ikon fungsional + Judul Utama: `text-sm sm:text-base font-bold text-black dark:text-white`.
  - Sub-judul / ID Teknis: `text-[11px] font-mono text-black/70 dark:text-white/70`.
  - Badge Status / Tipe: Format ringkas dengan font tebal (`rounded px-2 py-0.5 text-[10px] font-bold`).
- **Elemen Bagian Kanan**:
  - Tombol Aksi Tambahan (opsional): Seperti tombol `Screenshot` (`toPng`), tombol `Refresh`, atau tombol navigasi.
  - Tombol Tutup `[✕]`:
    ```html
    <button
      onClick={onClose}
      className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white font-bold cursor-pointer transition-colors"
      aria-label="Tutup modal"
    >
      <X className="w-5 h-5" />
    </button>
    ```

#### 2. Konten Tengah yang Dapat Digulir (Scrollable Body)
- **Kelas Standar**:
  ```css
  flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 sm:space-y-4 text-xs
  ```
- **Pengelompokan Informasi (Section / Group Boxes)**:
  - Gunakan box kontainer semi-transparan bergaris 1px tipis:
    ```css
    bg-black/5 dark:bg-white/5 p-3.5 sm:p-4 rounded-lg border border-black/20 dark:border-white/20
    ```
- **Batasan Tinggi Maksimal**:
  - `max-h-[88vh]` pada kontainer utama memastikan area body otomatis mengaktifkan scrollbar internal yang mulus saat konten melebihi tinggi layar ponsel atau laptop resolusi rendah.

#### 3. Footer Tersemat (Pinned Footer)
- **Kelas Standar**:
  ```css
  px-5 py-3.5 bg-black/5 dark:bg-white/5 border-t border-black/20 dark:border-white/20 flex items-center justify-between flex-shrink-0
  ```
- **Tombol Sekunder / Batal / Tutup**:
  ```css
  bg-black/10 dark:bg-white/10 text-black dark:text-white hover:bg-black/20 dark:hover:bg-white/20 px-4 py-2 rounded-md font-semibold text-xs transition-colors cursor-pointer
  ```
- **Tombol Aksi Utama / Simpan / Kirim**:
  ```css
  bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-md text-xs transition-colors shadow-sm cursor-pointer disabled:opacity-50
  ```

---

## 9. Ringkasan Checklist Kepatuhan Desain Pop-up & Modal

Sebelum merilis atau menyelesaikan pembuatan modal/pop-up baru, pastikan seluruh checklist berikut terpenuhi:
- [ ] Menggunakan `createPortal(..., document.body)`.
- [ ] Backdrop menggunakan `z-[99999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6`.
- [ ] Kontainer modal memiliki `rounded-lg sm:rounded-xl border border-black/70 dark:border-white/70 shadow-2xl max-h-[88vh] flex flex-col`.
- [ ] Header modal menggunakan `flex-shrink-0 border-b border-black/20 dark:border-white/20` (tidak ter-scroll).
- [ ] Body modal menggunakan `flex-1 overflow-y-auto` dengan box section `bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20`.
- [ ] Footer modal menggunakan `flex-shrink-0 border-t border-black/20 dark:border-white/20` (tidak ter-scroll).
- [ ] Menggunakan animasi kemunculan `animate-in fade-in zoom-in duration-150`.
- [ ] Semua tombol aksi menggunakan `rounded-md` dan memiliki kelas interaktif `cursor-pointer`.
- [ ] Seluruh teks dan label mematuhi palet kontras tinggi: `text-black` (light mode) dan `dark:text-white` (dark mode murni `#000000`).



