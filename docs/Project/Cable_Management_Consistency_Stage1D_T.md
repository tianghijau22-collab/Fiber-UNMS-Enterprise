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
