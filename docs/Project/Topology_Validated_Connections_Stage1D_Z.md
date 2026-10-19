# Penyimpanan hubungan topologi tervalidasi

Cable Routes → Pratinjau Hubungan kini memiliki bagian **Hubungan Tervalidasi**. Penilaian pratinjau dan ekspor JSON tetap berupa draf sesi. Sambungan disimpan terpisah setelah operator memilih **Sesuai lapangan**, membuka formulir, melengkapi referensi dan memberikan konfirmasi. Hubungan endpoint yang sudah tercatat di inventaris juga dapat diregistrasikan setelah pemeriksaan fisik.

## Penggunaan

1. Periksa calon pada peta satelit dan node sekitar, lalu pilih **Sesuai lapangan**.
2. Klik **Validasi & Simpan Calon Terpilih**. Server menghitung ulang calon dari geometri tersimpan dan membandingkannya dengan titik yang dilihat pengguna.
3. Pilih node sambung fisik, arah A→B/B→A dari sisi OLT, jenis sambungan, OLT dan satu port PON. A/B dijelaskan pada formulir dan bukan tebakan arah upstream. Untuk antarkabel tersedia sambungan core atau percabangan splitter; terminasi juga tersedia pada calon kabel–node.
4. Isi nomor core bila diketahui dan catatan pemeriksaan, lalu centang konfirmasi serta simpan. Core kosong diberi label belum lengkap; nomor tidak boleh melebihi kapasitas kabel.
5. Buka **Lihat Hubungan Tersimpan** untuk meninjau arah, junction, core, pemeriksa, waktu, dan riwayat. Pembatalan memerlukan alasan serta revisi terbaru; catatan asli dan seluruh riwayat tetap dipertahankan. Koreksi dilakukan dengan membatalkan kemudian memvalidasi ulang, bukan menimpa jejak sebelumnya.

Node sambung untuk antarkabel harus tersedia dalam 100 meter dari kedua titik. Bila tidak tersedia, operator perlu membuat/memperbaiki node fisik melalui infrastruktur jaringan lalu memuat ulang pratinjau. Referensi OLT/PON yang sudah tersimpan pada node sambung diperiksa; perbedaan harus diselesaikan sebelum penyimpanan. API mengembalikan metadata OLT minimum, tidak menyertakan kredensial atau memanggil perangkat.

## Konsistensi dan hak akses

GET persiapan/daftar/riwayat serta POST penyimpanan/pembatalan berada di dalam autentikasi dan otorisasi API yang sama. Peran penulis hanya Super Administrator dan Operator Jaringan dengan akses halaman Cable Routes. Pengguna baca saja tidak dapat menyimpan atau membatalkan. Penyimpanan dibatasi laju permintaannya.

Server menghitung ulang empat jenis calon, memeriksa toleransi, snapshot versi sumber/node sambung, kapasitas core dan konfirmasi. Data usang ditolak dengan konflik; nilai formulir dipertahankan untuk pemeriksaan. Kunci aktif unik pada database mencegah duplikasi calon/junction/OLT/PON/core yang sama, termasuk upaya mengubah arah dengan menyimpan duplikat. Pembatalan mengosongkan kunci aktif dan menaikkan revisi, sehingga validasi baru dapat disimpan tanpa menghapus riwayat.

Hubungan, event riwayat dan audit lokal ditulis dalam satu transaksi. Tidak ada notifikasi eksternal baru. Daftar membandingkan versi referensi kabel/node terkini dan memberi label perlu validasi ulang jika sumber berubah atau dihapus. Pengaturan warna, nama atau atribut sumber lain juga dapat memicu label konservatif ini.

Formulir aktif dilindungi terhadap refresh, perubahan toleransi dan tombol kembali internal. Jika calon dipilih berganti, formulir lama tidak bisa disimpan. Peringatan penutupan browser dipasang. Navigasi sidebar SPA belum diblokir secara menyeluruh: selesaikan atau batalkan formulir sebelum berpindah halaman. Permintaan tulis yang hasilnya tidak diketahui karena gangguan koneksi harus diperiksa pada daftar sebelum dicoba kembali.

## Batas tahap ini

Penyimpanan memakai dua tabel baru, tanpa mengubah parent node, endpoint inventaris, rute, panjang, maupun alokasi penggunaan core. Ini adalah registri pemeriksaan lapangan, belum graf penelusuran optik aktif. Arah yang diisi adalah hasil validasi operator. Belum ada pembuktian lintasan menyeluruh, pemeriksaan siklus, keunikan input splitter antarhubungan, pemetaan port splitter, atau penerapan ke diagnosis gangguan. Seluruh rekaman ditandai `fault_detection_enabled:false`, termasuk yang core-nya lengkap. Tidak ada hubungan diterima otomatis berdasarkan koordinat, dan AI tidak mengambil keputusan.

Tahap berikutnya membangun graf per OLT/PON/core dari hubungan yang masih berlaku, memeriksa urutan/percabangan serta konflik, lalu mengaitkannya dengan kebaruan dan mutu bukti optik. Hubungan dengan sumber berubah atau core belum lengkap perlu ditinjau sebelum dipakai.

## Migrasi dan verifikasi

Migrasi terbatas membuat `topology_connections` dan `topology_connection_events`; tidak menjalankan seluruh migrasi tertunda. Cadangan diambil sebelum migrasi. Jika kode perlu dipulihkan, tabel tambahan beserta data pengguna dipertahankan; tidak ada penghapusan atau pemulihan database otomatis.

Validasi mencakup transaksi/rollback, autentikasi seluruh API privat, peran penulis/baca saja, perubahan geometri, empat jenis calon, duplikasi, core/PON, versi pembatalan, riwayat, serta alur browser menggunakan data contoh. Data produksi tidak diisi dengan sambungan uji. Bukti penerapan, rincian cadangan dan observasi produksi disimpan pada laporan lokal privat.
