# Peta satelit dan warna kabel pada pratinjau hubungan

Peta pada **Cable Routes → Pratinjau Hubungan** menggunakan mode satelit hybrid, sama dengan peta GIS. Nama jalan tetap terlihat untuk membantu pemeriksaan posisi di lapangan.

Rute memakai `cable_color` yang tersimpan pada setiap kabel, dengan opasitas penuh. Pemilihan calon hubungan tidak lagi mengubah kabel menjadi warna biru/ungu berdasarkan urutannya. Legenda di bawah peta menampilkan nama dan warna kabel yang sedang diperiksa. Kabel tanpa warna tersimpan menggunakan biru bawaan, sesuai GIS, dan diberi keterangan pada legenda.

Garis jingga putus-putus tetap menunjukkan jarak antara dua titik calon sambungan. Garis ini adalah alat bantu validasi, bukan warna fisik kabel atau sambungan yang telah disahkan.

Perubahan hanya pada tampilan peta pratinjau. Perhitungan geometri, toleransi, penilaian manual, ekspor, sumber data tersimpan, serta penyimpanan jaringan tetap memakai alur yang sama. Tidak ada perubahan backend atau pembacaan OLT.

Validasi rilis mencakup build produksi, pengujian frontend yang ada, serta pemeriksaan browser dengan data contoh untuk pilihan satelit, dua warna kabel tersimpan, warna bawaan, legenda, dan garis bantu calon sambungan. Catatan penerapan dan pencadangan disimpan secara privat di luar dokumentasi sumber ini.
