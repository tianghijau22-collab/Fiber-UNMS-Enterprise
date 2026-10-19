# Node sekitar calon hubungan

Peta **Cable Routes → Pratinjau Hubungan** menampilkan node sekitar kedua titik calon sambungan, menggunakan koordinat tersimpan. Radius bawaan 250 meter dapat diubah menjadi 100 atau 500 meter. Radius ini hanya mengatur lingkungan yang ditampilkan, terpisah dari toleransi pencarian calon hubungan.

Nama, kode, dan jenis node ditampilkan pada penanda peta. Pengguna dapat menyembunyikan nama jika saling bertumpuk. Warna marker membedakan jenis node, bukan status optik; kuning menandai node calon sambungan. Klik marker untuk informasi jarak. Node calon tetap terlihat jika berada di luar radius.

Peta awal mencakup kedua titik calon serta node sekitar. **Lihat node sekitar** mengembalikan cakupan ini; **Fokus calon hubungan** memperbesar kedua titik calon; **Lihat seluruh rute** menampilkan rute kabel terkait. Daftar node di bawah peta diurutkan dari jarak terdekat dan bisa diklik untuk memperbesar serta membuka informasi node. Jarak adalah jarak geografis terdekat ke titik A/B, bukan panjang kabel atau bukti sambungan.

Sumber data tetap satu permintaan GET GIS tersimpan. Perubahan radius, nama, dan fokus hanya bekerja di browser. Penilaian, ekspor, pencarian sambungan, backend, dan pengambilan OLT tidak berubah. Node tanpa koordinat valid tidak dimasukkan.

Validasi mencakup pengujian radius di kedua titik, urutan, node calon di luar radius, penolakan GPS tidak valid, serta pemeriksaan browser pada peta satelit, label, daftar, fokus dan pergantian calon. Rincian pencadangan/penerapan disimpan dalam laporan lokal privat.
