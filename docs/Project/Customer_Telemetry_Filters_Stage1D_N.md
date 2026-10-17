# Filter telemetri pelanggan — 17 Oktober 2026

Halaman Customers memiliki dua pilihan tambahan pada menu Filter:

- **SN ganda**: serial yang dipakai beberapa pelanggan, dihitung dari seluruh daftar sebelum pencarian, filter OLT, dan paginasi. Huruf besar/kecil dan spasi dinormalisasi. Baris berulang untuk satu ID pelanggan tidak dihitung sebagai pelanggan berbeda; serial kosong/placeholder diabaikan. Pelanggan dengan penanda SN ganda dari inventaris perangkat juga masuk, meskipun hanya satu catatan pelanggan memakai SN tersebut.
- **ONU Online, Rx tidak tersedia**: identitas telah terverifikasi dan sampel masih baru; state asli ONU Online, tetapi Rx valid tidak tersedia. Menggunakan state perangkat dari kontrak telemetri, terpisah dari kebijakan tampilan N/A sebagai Offline. Data Offline, state tidak diketahui, serta sampel lama tidak masuk filter ini.

Keduanya dapat digabungkan (irisan) dan bekerja bersama pencarian, OLT, interface, ODC, ODP, paket, layanan, serta status tampilan yang sudah ada. Contohnya, menggabungkan status tampilan Online dengan filter Online/Rx kosong dapat menghasilkan nol baris karena N/A ditampilkan Offline sesuai kebijakan pengguna.

Pilihan mengikuti mekanisme Terapkan/Bersihkan, jumlah filter aktif, chip yang dapat dihapus, dan Reset. Filter baru mengembalikan paginasi ke halaman pertama; jumlah halaman disesuaikan jika pembaruan tersimpan mengurangi hasil. Tabel desktop dan kartu seluler memakai daftar tersaring yang sama. Filter tetap aktif ketika data tersimpan diperbarui.

Tidak ada perubahan endpoint, database, status/angka telemetri, polling, atau pembacaan OLT. Semua penyaringan dilakukan pada data pelanggan yang sudah diterima halaman.
