# Konsistensi tampilan Cable Management

Halaman `/cable-management` diselaraskan dengan pola halaman Customers: latar putih/hitam, border, sudut panel, tipografi, tombol ringkas, toolbar pencarian, serta header/baris tabel. Identitas kabel kini ditata sebagai kode di atas nama agar mudah dipindai. Label status dan indikator utilisasi tetap berwarna untuk membantu pembacaan. Formulir dan Core Matrix memakai bingkai/warna dasar yang selaras; 12 warna fiber TIA tetap sama.

Daftar ditampilkan 10 baris per halaman, dengan pilihan 25/50, tombol Sebelumnya/Berikutnya, nomor halaman dan rentang data. Pencarian, perubahan filter atau jumlah baris kembali ke halaman pertama. Halaman terakhir dijepit ke rentang yang sah ketika jumlah data menyusut. Tombol Reset Filter menghapus pencarian dan filter status/instalasi. Pada layar kecil tabel tetap memiliki area gulir horizontal sendiri.

Kegagalan pemuatan daftar kabel kini menampilkan pesan dan tombol Coba lagi. Pembaruan gagal mempertahankan daftar yang sudah berhasil dimuat dan tidak mengeluarkan toast keberhasilan palsu. Kegagalan awal dibedakan dari inventaris kosong. Fungsi tambah, edit, hapus, impor KML, navigasi rute, dan penyuntingan core tetap menggunakan handler/API yang sama. Hak akses tidak diperluas.

## Validasi

- Build produksi berhasil dan 71 pengujian frontend yang ada lulus.
- 21 skenario browser lokal diperiksa menggunakan komponen halaman sebenarnya, CSS produksi, dan data contoh: pagination awal/lanjut/akhir, pilihan jumlah baris, pencarian, filter tunggal/gabungan, reset, hasil kosong, kegagalan refresh/pemulihan, Core Matrix/pergantian tube, pembukaan modal tambah/edit, tema gelap, navigasi rute, akses baca saja, kegagalan awal/pemulihan, tampilan ponsel 390 piksel, serta inventaris kosong.
- Perbandingan sumber dengan baseline VPS memastikan konstanta TIA dan handler tambah/edit/hapus/core/navigasi tidak berubah. Pemeriksaan browser tidak menyimpan, menghapus, atau mengimpor data produksi.
- Pratinjau tema terang/gelap dan ponsel memakai data sintetis; tangkapan layar tersebut bukan sesi Cable Management produksi yang terautentikasi. Tab/server pratinjau ditutup setelah pemeriksaan.
- Sebelum pemasangan, statistik produksi menunjukkan 83 kabel aktif dan 1.230 core kapasitas. Jumlah fisik tabel database lebih besar karena mencakup data historis/terhapus; checksum lengkap kabel dan core dicatat secara privat untuk dibandingkan setelah pemasangan, tanpa menyalin isi data pelanggan ke laporan.

Paket runtime hanya mengubah `resources/js/pages/CableManagement.jsx` beserta hasil build. Tidak ada perubahan backend, skema database, OLT, VPN atau sistem pengambilan redaman. Alur penerapan: GitHub lebih dahulu, cadangan baru terverifikasi, pemasangan aset/sumber, lalu pemeriksaan layanan/HTTPS dan checksum data kabel/core. Poller dan listener tidak dimulai ulang, cache data serta sesi login tidak dibersihkan.


## Hasil penerapan

Diterapkan pada **19-10-2026 17.08.20 WIB**, diverifikasi kembali pada **2026-10-19T17:10:21+07:00**. Commit aplikasi: `7b3bbd18e13238017fe097415c89f7718e86c6c5`. GitHub diperbarui sebelum cadangan baru dan pemasangan.

- Build produksi berhasil: 53 aset dipaketkan; 42 berkas JS/CSS melalui HTTPS cocok dengan checksum paket. Sumber yang terpasang cocok dengan paket dan aset lama tetap tersedia.
- 71 pengujian frontend serta 21 skenario browser lokal lulus. Tangkapan layar memakai data contoh: `scratch/cable-consistency/cable-proof-light.jpg`, `cable-proof-dark.jpg`, dan `mobile-proof.jpg`. Checksum pratinjau gelap: `1ce4fd3ab9bbcebbb789a99854f1b299396b336a40d2a415a4268c90cac6d4e2`.
- Setelah pemasangan: 85 kabel aktif, kapasitas 1290 core. Checksum seluruh kabel dan core yang sudah ada sebelum pemasangan tetap sama, termasuk data historis/terhapus. Selama verifikasi terdapat 2 kabel baru (ID 352, 353) yang ditambahkan lewat aplikasi; penambahan ini dipisahkan dari baseline dan dipertahankan. Karena itu checksum seluruh tabel berubah, sedangkan checksum data lama tetap cocok. Pemeriksaan dilakukan dalam transaksi baca-saja, nol penulisan database.
- Layanan tetap aktif; PID poller/listener sama dengan sebelum penerapan. Socket alarm 162/514 aktif. Tidak ditemukan kesalahan aplikasi baru pada jendela verifikasi. Cache data dan sesi login tidak dibersihkan. Backend, VPN, OLT dan konfigurasi tidak berubah.

Cadangan privat terverifikasi: `/var/backups/fona/stage1dt-20261019T100611Z`. Database diperiksa melalui pg_restore dan arsip/checksum diverifikasi sebelum pemasangan.

| Berkas | Ukuran | SHA-256 |
|---|---:|---|
| database.dump | 5,293,007 byte | `9ec702ee2e886a796af00ad14c5bd273d8232ecf19f9d3a0933c9db7e935b29a` |
| application.tar.gz | 11,244,396 byte | `6f23dd5daa2b64702a9f993aab330033bbee49fdba184a51dafa1f396f14e7e0` |
| system-configuration.tar.gz | 732 byte | `48927300cc5e2319736dda38d2e9658b28e85d35f3b83f1f12b674eb50a4499a` |
