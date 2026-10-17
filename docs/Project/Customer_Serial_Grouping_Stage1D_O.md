# Pengelompokan SN ganda pada Customers — 17 Oktober 2026

Ketika filter **SN ganda** aktif, baris pelanggan dikelompokkan berdasarkan SN yang dinormalisasi, lalu diurutkan menurut SN. Pelanggan dengan SN yang sama tampil berurutan atas–bawah, dengan urutan pelanggan dalam satu kelompok mengikuti urutan sumber sebelumnya.

Paginasi menjaga satu kelompok SN tetap pada satu halaman. Halaman dapat berisi kurang dari delapan pelanggan agar kelompok berikutnya tidak terbelah. Jika satu SN dipakai lebih dari delapan pelanggan, seluruh kelompok tetap ditampilkan dalam satu halaman. Rentang nomor baris dihitung dari jumlah baris sebenarnya, bukan kelipatan delapan.

Pencarian dan filter lain tetap diterapkan terlebih dahulu: pengelompokan tidak memunculkan kembali pelanggan yang tidak cocok dengan filter. Saat filter SN ganda dinonaktifkan, urutan dan paginasi biasa tetap berlaku. Tabel desktop dan kartu seluler memakai halaman data yang sama. Tidak ada perubahan data pelanggan, backend, atau pembacaan OLT.


## Hasil penerapan

Diverifikasi pada **2026-10-17T22:39:09+07:00**. Kode aplikasi GitHub: `bac5a1849aad3888cebd7a45d7710b8ef36fc346`. GitHub diperbarui sebelum cadangan baru diverifikasi dan paket diterapkan ke VPS.

- **51 pengujian frontend** lulus, termasuk lima pengujian baru untuk urutan SN, batas halaman, kelompok melebihi delapan pelanggan, urutan normal, dan filter gabungan. **10 skenario render server** memeriksa kontrol filter serta hasil tabel dan penomoran kartu seluler pada halaman pertama/kedua. Ini bukan pemeriksaan visual browser.
- Build produksi lulus. 54 aset dipaketkan; 43 berkas JS/CSS pada HTTPS cocok dengan checksum paket.
- Data tersimpan berisi 1735 pelanggan; **50 pelanggan** cocok dengan filter SN ganda. Hasil pengelompokan menjadi 7 halaman dengan jumlah baris **[7, 8, 8, 8, 7, 7, 5]**. Setiap SN tetap pada satu halaman, seluruh ID pelanggan hasil filter terjaga, dan urutan data sumber tidak berubah.
- Pemeriksaan data memakai transaksi baca-saja: **0 penulisan database, 0 panggilan pembacaan OLT**. Poller/listener tetap aktif dengan PID yang sama. Konfigurasi, backend, nilai Rx, dan status perangkat tidak berubah. Tidak ditemukan kesalahan aplikasi baru selama verifikasi.
- Cadangan privat: `/var/backups/fona/stage1do-20261017T153732Z`. Database diperiksa melalui pg_restore, arsip aplikasi dan checksum diverifikasi sebelum pemasangan.

| Berkas | Ukuran | SHA-256 |
|---|---:|---|
| database.dump | 5,870,644 byte | `26b061fd5a81da63e7d411286d2f052263aea433f6e855226f2facbc43f70f03` |
| application.tar.gz | 9,082,611 byte | `117915b3d84c5f04d833e8ada225df834b1e8f47f3eab572adb6066d1597ace6` |
| system-configuration.tar.gz | 732 byte | `9af9bf66570933ba0b18b792e30b76848f2a01c4dc4ade622e843ba71a235360` |
