# Pratinjau calon hubungan kabel dan node

Fitur dibuka melalui Cable Routes → **Pratinjau Hubungan**. Sumbernya GET `/api/gis/map-data` yang sudah terautentikasi dan menggunakan data tersimpan. Pratinjau tidak memanggil pembacaan langsung ke OLT, tidak membuat hubungan aktif, dan tidak mengubah node, kabel, core, panjang, atau diagnosis gangguan.

## Pencarian calon hubungan

- Ujung kabel dekat node, dengan label Ujung 1/Ujung 2 tanpa menganggap arah pangkal/tujuan sudah diketahui.
- Node dekat bagian tengah rute, dengan titik proyeksi dan perkiraan posisi sepanjang rute dari titik pertama.
- Dua ujung kabel berdekatan.
- Ujung kabel dekat bagian tengah rute lain sebagai calon percabangan yang masih memerlukan titik sambung/core.

Perpotongan dua garis pada bagian tengah tanpa node atau ujung kabel tidak menghasilkan sambungan. Toleransi tersedia 5/10/20/50/100 meter, bawaan 10 meter. Angka tersebut merupakan batas pencarian geografis, bukan tingkat ketepatan atau persentase keyakinan. Tidak ada calon yang diterapkan otomatis. Beberapa node dekat satu ujung tetap ditampilkan seluruhnya dengan peringatan, bukan dipilih hanya berdasarkan yang paling dekat.

Kedua format koordinat didukung: pasangan KML `[lat,lng]` dan objek editor `{lat,lng}`. GPS nol sah; nilai kosong, tidak numerik, atau di luar rentang ditolak. Rute dengan vertex tidak valid dilewati seluruhnya agar tidak menciptakan garis yang melompati data rusak. Kabel tanpa bentuk rute hanya dapat memakai garis kedua endpoint jika keduanya memiliki GPS valid; garis tersebut diberi keterangan. Kabel tanpa rute maupun kedua endpoint dicatat dalam kelengkapan data.

Hubungan node yang sudah tercatat ditandai tersendiri. Peringatan diberikan untuk status perawatan/nonaktif, referensi OLT/PON berbeda, dan rute yang hanya berupa garis endpoint. Kesamaan lokasi tidak membuktikan sambungan core atau arah sinyal; rute yang melintas berulang dan jaringan paralel tetap memerlukan pemeriksaan manual. Fitur ini belum menelusuri aliran optik dan tidak mengubah algoritma gangguan yang sudah ada.

## Penilaian manual

Daftar memiliki pencarian nama/kode, filter jenis calon, filter kabel, filter penilaian, dan pagination 25 baris. Memilih **Periksa** menampilkan rute terkait, node sekitar, jarak koordinat, alasan pencocokan, serta peringatan. Label pada peta memakai teks DOM agar nama tidak diperlakukan sebagai HTML.

Pilihan penilaian: **Belum diperiksa**, **Sesuai lapangan**, **Tidak tersambung**, dan **Perlu cek lapangan**. Catatan dibatasi 1.000 karakter. Penilaian ini adalah draf sesi di browser, tidak disimpan ke database. Ekspor JSON memuat identitas calon, koordinat, jarak, penilaian, catatan, waktu muat, toleransi, serta `topology_applied:false`. Catatan tanpa keputusan juga dapat diekspor. Kandidat yang sudah tercatat dan ID penilaian yang tidak ada di hasil saat ini tidak diekspor sebagai hubungan baru.

Muat ulang data, perubahan toleransi, dan tombol kembali meminta keputusan ketika terdapat draf. Draf hanya dihapus setelah perhitungan baru berhasil; pemuatan gagal mempertahankan hasil dan penilaian sebelumnya. Peringatan beforeunload dipasang jika ada draf. Navigasi sidebar SPA tidak diblokir secara menyeluruh: ekspor sebelum berpindah halaman atau menutup sesi. Berkas ekspor belum dapat diimpor kembali atau diterapkan oleh fitur ini; penerapan topologi terverifikasi merupakan tahap terpisah.

Perhitungan dijalankan pada Web Worker dengan batas waktu, sehingga UI tidak diblokir. Worker dan permintaan dibatalkan ketika komponen dilepas. Tidak ada polling otomatis agar penilaian manual tidak tertimpa. Muat ulang membaca sumber GIS tersimpan yang memiliki cache singkat, bukan memicu pengambilan data OLT.

## Validasi

91 tes frontend lulus, termasuk 13 skenario algoritma/ekspor baru: normalisasi format, GPS tidak valid, toleransi meter, proyeksi midspan, persimpangan/T-branch, beberapa node berdekatan, hubungan tercatat, fallback endpoint, perbedaan referensi, ID deterministik, ekspor draf, titik berulang dan antimeridian.

29 pemeriksaan browser lokal menggunakan komponen sebenarnya, CSS produksi, Leaflet dengan tile grid sintetis, serta worker hasil build produksi pada pemeriksaan tambahan. Pemeriksaan mencakup masuk dari editor, perlindungan draf rute, daftar/pencarian/filter/pagination, peringatan ambigu, penilaian/catatan, payload ekspor, pembatalan/reset draf, kegagalan refresh/pemulihan, data kosong, akses baca saja, tema dan iframe ponsel 390 piksel. Isi Blob ekspor diverifikasi melalui fixture yang mencegat unduhan; transport unduhan asli IAB tidak berhasil diverifikasi. Tidak ada tindakan uji yang menyimpan data topologi produksi.

Build produksi dan uji kompatibilitas koordinat dilakukan sebelum rilis. Rincian pengamatan data produksi, checksum database dan lokasi cadangan disimpan dalam laporan lokal privat, terpisah dari dokumentasi sumber ini. Alur penerapan mengikuti GitHub terlebih dahulu, cadangan terverifikasi, pemasangan aset/sumber, dan pemeriksaan pascapenerapan. Tidak ada perubahan backend, migrasi, konfigurasi OLT/VPN, atau restart poller/listener.
