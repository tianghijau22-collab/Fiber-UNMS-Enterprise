# Pengelompokan SN ganda pada Customers — 17 Oktober 2026

Ketika filter **SN ganda** aktif, baris pelanggan dikelompokkan berdasarkan SN yang dinormalisasi, lalu diurutkan menurut SN. Pelanggan dengan SN yang sama tampil berurutan atas–bawah, dengan urutan pelanggan dalam satu kelompok mengikuti urutan sumber sebelumnya.

Paginasi menjaga satu kelompok SN tetap pada satu halaman. Halaman dapat berisi kurang dari delapan pelanggan agar kelompok berikutnya tidak terbelah. Jika satu SN dipakai lebih dari delapan pelanggan, seluruh kelompok tetap ditampilkan dalam satu halaman. Rentang nomor baris dihitung dari jumlah baris sebenarnya, bukan kelipatan delapan.

Pencarian dan filter lain tetap diterapkan terlebih dahulu: pengelompokan tidak memunculkan kembali pelanggan yang tidak cocok dengan filter. Saat filter SN ganda dinonaktifkan, urutan dan paginasi biasa tetap berlaku. Tabel desktop dan kartu seluler memakai halaman data yang sama. Tidak ada perubahan data pelanggan, backend, atau pembacaan OLT.
