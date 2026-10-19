# Sinkronisasi Cable Routes dan Cable Management

Halaman `/cable-routes` kini menggunakan GET `/api/network-cables`, sama dengan inventaris Cable Management, tanpa mengambil seluruh core. Kode, nama, status, jenis instalasi, panjang, hubungan node, dan koordinat berasal dari model kabel yang sama. Tautan `cable_id` dari tabel membuka kabel yang sesuai; ID yang sudah tidak tersedia diberi pesan, bukan dialihkan diam-diam ke kabel lain. Tombol Manajemen Kabel memudahkan kembali ke inventaris.

Tampilan panel, tombol, pilihan kabel, tema putih/hitam, dan tabel urutan tiang diselaraskan. Tiang diberi nomor di peta, dapat diubah nama, dihapus, dan dipindah urutannya. Tampilan bersifat responsif; kontrol peta ditumpuk pada layar kecil. Nama pada label/popup Leaflet di-escape agar teks tidak diperlakukan sebagai HTML. Koordinat nol sah; koordinat kosong tidak dipalsukan menjadi nol.

## Penyimpanan dan panjang kabel

- Panjang tersimpan ditampilkan terpisah dari estimasi jalur peta. Secara bawaan simpan rute tidak mengubah panjang Cable Management, termasuk ketika seluruh tiang dihapus.
- Pilihan **Gunakan estimasi peta sebagai panjang kabel** memperbarui panjang hanya jika pengguna mencentangnya, pangkal/tujuan memiliki GPS yang valid, dan jaraknya positif. Estimasi adalah jarak antartitik; belum termasuk cadangan kabel. Tanpa endpoint lengkap, estimasi diberi keterangan sebagian dan tidak dapat mengganti panjang.
- PUT rute menggunakan hasil model dari server sebagai baseline setelah berhasil. HTTP gagal, validasi gagal, atau respons tidak lengkap tidak ditampilkan sebagai keberhasilan. Draf dipertahankan agar dapat dicoba ulang.
- Pergantian pilihan kabel dengan draf meminta keputusan buang/tetap. Refresh daftar tidak menimpa draf. Keluar/muat ulang halaman dengan draf memakai peringatan browser `beforeunload`. Pengaman ini tidak memblokir seluruh navigasi sidebar SPA; simpan atau buang draf sebelum berpindah halaman.
- Backend menerima array kosong melalui `present|array`, memvalidasi koordinat/rentang/nama dan panjang positif. Token opsional `expected_updated_at` diperiksa di dalam transaksi dengan kunci baris; token lama mendapat HTTP 409. Ini menggunakan ketelitian timestamp model yang tersedia, bukan revisi terpisah. Klien lama tanpa token tetap kompatibel.
- Hak perubahan disamakan dengan backend: Super Administrator dan Operator Jaringan. Pengguna baca saja dapat melihat peta/Street View, tetapi tidak menambah, mengganti nama, mengurutkan atau menghapus tiang.

## Validasi dan batas pemeriksaan

Build produksi berhasil. Sebanyak 78 pengujian frontend lulus, termasuk tujuh pengujian baru normalisasi GPS, jarak, payload panjang, pengosongan rute, koordinat tidak valid, dan pengamanan label peta. Pengujian API rute dan autentikasi lulus: 17 tes, 995 asersi, database SQLite memori terisolasi, tanpa akses jaringan keluar.

Pemeriksaan browser menggunakan komponen React yang sebenarnya, CSS produksi, Leaflet, serta fixture kabel/API lokal. Penyimpanan uji hanya mengubah fixture memori. Uji mencakup navigasi dua arah dengan ID kabel, sinkronisasi panjang ke tabel Management, nama/urutan tiang, penambahan melalui klik peta, simpan/clear, gagal simpan, konflik versi, perlindungan draf, gagal refresh/pemulihan, data kosong, ID hilang, hak baca saja, GPS nol, escaping label, dan tema. Peta contoh menggunakan tile grid lokal agar pemeriksaan tidak bergantung pada jaringan penyedia peta; ketersediaan citra satelit/Street View eksternal tidak dinilai melalui fixture ini.

Perbandingan sumber memastikan perubahan controller dibatasi pada `updateRoute`; handler tambah/edit/hapus kabel dan core tidak berubah. Paket runtime terdiri dari controller tersebut, CableRouteEditor, dan helper `cableRoutes.js`, beserta aset build. Tidak ada migrasi database atau perubahan konfigurasi OLT/VPN/poller/listener. Pemeriksaan produksi dilakukan baca saja, tanpa membuat atau menghapus rute produksi untuk uji coba.

Alur rilis: perbarui GitHub, cadangan baru terverifikasi, pemasangan sumber/aset, muat ulang PHP-FPM, lalu verifikasi HTTPS, checksum sumber/aset dan data kabel/core, serta layanan. Poller/listener tidak dimulai ulang; cache data dan sesi login tidak dibersihkan.


## Kompatibilitas data impor KML

Pemeriksaan inventaris produksi menemukan 83 dari 85 kabel memiliki rute hasil impor KML dengan total 2.180 titik berformat `[lat, lng]`. Format ini sah dan digunakan importer/GIS, sedangkan editor sebelumnya mengharapkan objek `{lat, lng, name}`. Helper kini menormalisasi kedua format di memori agar seluruh titik muncul pada peta/tabel; tidak ada konversi massal atau penulisan data lama saat halaman dibuka. Penomoran otomatis merupakan penamaan titik jalur impor, bukan konfirmasi keberadaan tiang fisik di lapangan.

Seluruh 85 kabel saat pemeriksaan belum memiliki pasangan endpoint pangkal/tujuan dengan GPS lengkap. Rute impor tetap dapat dilihat/disunting, tetapi perkiraan panjang diberi keterangan sebagian dan pilihan mengganti panjang dinonaktifkan sampai hubungan endpoint dilengkapi melalui Cable Management. Data panjang yang sudah tersimpan dipertahankan.

Uji tambahan memastikan rute KML berisi pasangan koordinat terbaca, tidak dianggap draf baru, memiliki semua penanda, dapat disimpan, dan dapat dimuat kembali tanpa mengubah panjang. Total pemeriksaan browser: 34 skenario utama dan 6 skenario KML. Sebanyak 78 tes frontend dan 17 tes API (995 asersi) lulus. Pemeriksaan produksi setelah mengenali kedua format: nol rute non-array dan nol titik dengan koordinat tidak valid.
