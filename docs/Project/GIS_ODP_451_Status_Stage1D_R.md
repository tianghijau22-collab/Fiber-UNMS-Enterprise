# Konsistensi marker GIS dan N/A pada ODP 451

## Temuan terkonfirmasi

Pemeriksaan baca-saja pada 18 Oktober 2026 pukul 16:14:04 WIB menunjukkan ODP 451 (node 517) memiliki tujuh pelanggan: enam ONU dengan identitas dan sampel terbaru tetapi Rx tidak tersedia, serta satu ONU dengan SN ganda yang belum terverifikasi. Port kedelapan kosong. Backend GIS mengirim `best_rx_power`, `worst_rx_power`, dan `optical_power_dbm` bernilai null; teksnya `N/A (1 belum terverifikasi)`.

Terdapat tiga celah tampilan:

1. Pemformat marker mengekstrak angka dari teks keterangan. Angka **1** pada **1 belum terverifikasi** ditampilkan sebagai **1,0 dBm**, padahal tidak ada pengukuran Rx tersebut.
2. Gambar SVG dan indikator status memakai warna hijau bawaan ketika data belum terverifikasi, meskipun status logis marker sudah abu-abu.
3. Kriteria merah sebelumnya hanya menerima seluruh ONU terverifikasi. Campuran enam N/A terbaru dan satu SN ganda masuk kategori belum lengkap, sehingga belum memenuhi tampilan merah yang diminta pengguna.

## Perbaikan

Nilai optik untuk marker, popup, detail GIS, daftar node, dan pilihan node di lokasi yang sama sekarang berasal dari kolom pengukuran numerik. Teks penjelasan, jumlah pelanggan, nomor port, dan alamat interface tidak diparsing sebagai redaman. Data optik yang tidak tersedia tetap **N/A**; bukti kedaluwarsa tidak menampilkan angka optik lama sebagai pembacaan terbaru.

ODP dengan seluruh Rx yang ditampilkan N/A dan ada pembacaan N/A terbaru ditandai merah, termasuk bila beberapa identitas masih belum terverifikasi. Keterangan kasus ODP 451: **Seluruh Rx N/A · 1 ONU belum terverifikasi**. Marker berlabel **N/A**. Port kosong tidak dihitung sebagai pelanggan. Tanpa pembacaan N/A terbaru yang mendukung, atau setelah bukti kedaluwarsa, marker tetap abu-abu. Nilai Rx valid yang kembali tersedia mengakhiri tampilan seluruh N/A sesuai data terbaru.

Warna SVG, indikator, bingkai, dan label diuji pada tema terang/gelap. Ringkasan memakai istilah gangguan optik agar tampilan N/A yang belum lengkap tidak dinyatakan sebagai kepastian semua perangkat kehilangan sinyal fisik.

Penandaan merah ini merupakan kondisi tampilan data; bukti backend untuk perkiraan segmen kabel tetap memakai aturan ketat sebelumnya. ODP dengan identitas belum terverifikasi tidak dipromosikan menjadi bukti putus kabel. SN ganda tidak dipilih ulang, dipindah, dihapus, atau dianggap selesai dengan perubahan ini.

## Batas cakupan

Hanya tiga berkas frontend GIS yang diubah. Tidak ada perubahan backend, nilai redaman asli, kepemilikan ONU, topologi, pembacaan OLT, siklus polling, VPN, atau pengunci. Kondisi produksi dapat berubah setelah waktu pemeriksaan; warna mengikuti pembaruan tersimpan dan masa berlaku bukti.


## Hasil penerapan dan validasi

Diverifikasi pada **2026-10-18T16:31:13+07:00**. Commit aplikasi: `e7d040df103d89e1487b3243465604050c1e9599`. GitHub diperbarui sebelum cadangan baru diverifikasi dan paket diterapkan.

- **67 pengujian frontend** lulus, termasuk lima pengujian tambahan untuk kasus ODP 451, angka pada teks keterangan, hitungan yang tidak sah/data kedaluwarsa, nilai numerik termasuk nol, serta pemulihan Rx. Bukti ketat untuk perkiraan kabel tetap terpisah dari warna tampilan.
- **12 skenario render/HTML/CSS** lulus. Pemformat label, SVG dan HTML marker yang digunakan aplikasi diperiksa langsung, termasuk status merah, abu-abu, popup/detail, serta panel peringatan. Ini memperluas pengujian tahap sebelumnya yang belum memeriksa seluruh bagian gambar marker dan labelnya.
- **8 contoh marker diperiksa melalui browser lokal**, tema terang dan gelap: ODP 451 merah (`rgb(239, 68, 68)`) dengan N/A; tanpa bukti terbaru abu-abu (`rgb(100, 116, 139)`); node dengan Rx terukur dan node kosong tetap sesuai. Pratinjau memakai HTML/CSS marker aplikasi dan data tersimpan, bukan tangkapan layar halaman GIS produksi yang terautentikasi. Bukti lokal: `scratch/gis-odp-consistency/marker-proof.jpg`, SHA-256 `a06bd2e1c145d74c7186ffefb8f28d0b980c2d54145a431312513ef592ede63c`. Server/tab pengujian sudah ditutup.
- Build produksi lulus: 54 aset dipaketkan dan 43 berkas JS/CSS yang diakses melalui HTTPS cocok dengan checksum paket.
- Pemeriksaan sesudah pemasangan: 1034 ODP; 272 dengan bukti N/A lengkap, 54 ditampilkan merah karena seluruh Rx N/A dengan sebagian bukti belum lengkap, dan 13 tanpa bukti terbaru yang cukup ditampilkan abu-abu. Jumlah mengikuti pembaruan snapshot.
- ODP 451: label **N/A**, kondisi tampilan `no_rx_unverified`, 7 pelanggan, dan 0 nilai Rx tersedia pada saat diperiksa. Pemeriksaan GIS dan modal dilakukan dalam transaksi baca-saja yang sama: **0 penulisan database, 0 pembacaan OLT**, snapshot tidak berubah.
- Backend serta konfigurasi tidak berubah; poller/listener tetap aktif dengan PID sama. Socket 162/514 aktif. Tidak ditemukan kesalahan aplikasi baru dalam jendela verifikasi. Tidak ada perubahan nilai sensor, identitas, SN ganda, topologi, ataupun status perangkat.

Cadangan privat: `/var/backups/fona/stage1dr-20261018T092907Z`. Database diperiksa melalui pg_restore; arsip aplikasi dan checksum diperiksa sebelum pemasangan.

| Berkas | Ukuran | SHA-256 |
|---|---:|---|
| database.dump | 5,874,347 byte | `056466776a569f76eb81e29f0ed6357e6c49c13d41289d025e0ae1c619a67920` |
| application.tar.gz | 10,372,809 byte | `96673c38a76a091d2777bfc289877a18e5c2568fd9935ac2133e654f88a44aa0` |
| system-configuration.tar.gz | 732 byte | `eea3a5a1fc715987ed3d43395aeddc3d9a8efaba09f328924faad0111575e913` |
