# Filter telemetri pelanggan — 17 Oktober 2026

Halaman Customers memiliki dua pilihan tambahan pada menu Filter:

- **SN ganda**: serial yang dipakai beberapa pelanggan, dihitung dari seluruh daftar sebelum pencarian, filter OLT, dan paginasi. Huruf besar/kecil dan spasi dinormalisasi. Baris berulang untuk satu ID pelanggan tidak dihitung sebagai pelanggan berbeda; serial kosong/placeholder diabaikan. Pelanggan dengan penanda SN ganda dari inventaris perangkat juga masuk, meskipun hanya satu catatan pelanggan memakai SN tersebut.
- **ONU Online, Rx tidak tersedia**: identitas telah terverifikasi dan sampel masih baru; state asli ONU Online, tetapi Rx valid tidak tersedia. Menggunakan state perangkat dari kontrak telemetri, terpisah dari kebijakan tampilan N/A sebagai Offline. Data Offline, state tidak diketahui, serta sampel lama tidak masuk filter ini.

Keduanya dapat digabungkan (irisan) dan bekerja bersama pencarian, OLT, interface, ODC, ODP, paket, layanan, serta status tampilan yang sudah ada. Contohnya, menggabungkan status tampilan Online dengan filter Online/Rx kosong dapat menghasilkan nol baris karena N/A ditampilkan Offline sesuai kebijakan pengguna.

Pilihan mengikuti mekanisme Terapkan/Bersihkan, jumlah filter aktif, chip yang dapat dihapus, dan Reset. Filter baru mengembalikan paginasi ke halaman pertama; jumlah halaman disesuaikan jika pembaruan tersimpan mengurangi hasil. Tabel desktop dan kartu seluler memakai daftar tersaring yang sama. Filter tetap aktif ketika data tersimpan diperbarui.

Tidak ada perubahan endpoint, database, status/angka telemetri, polling, atau pembacaan OLT. Semua penyaringan dilakukan pada data pelanggan yang sudah diterima halaman.


## Hasil penerapan

Diterapkan 17 Oktober 2026 pukul **22:17 WIB**. Kode aplikasi GitHub: `9a2b87311d33a01fa487052015b0f157a5f8dc2c`. Urutan: GitHub diperbarui, cadangan diverifikasi, paket diterapkan, lalu layanan/aset dan hasil filter diperiksa.

- **240 pengujian backend / 2.323 assertion**, **46 pengujian frontend**, serta **7 skenario render server** lulus. Delapan pengujian frontend baru mencakup duplikasi lintas halaman/OLT, normalisasi serial, placeholder, identitas pelanggan, state asli versus label tampilan, data lama, Rx valid termasuk nol, irisan kedua filter, serta perubahan snapshot. Skenario render memeriksa kontrol pilihan, callback Terapkan/Bersihkan, dan hasil tabel dengan kedua filter serta pencarian. Ini bukan pemeriksaan visual browser.
- Build produksi lulus; 54 aset dipaketkan dan 43 berkas JS/CSS yang dipublikasikan melalui HTTPS cocok dengan checksum.
- Pada data **2026-10-17T22:17:46+07:00**, dari **1735 pelanggan**, filter SN ganda memilih **50 pelanggan**; filter ONU Online/Rx tidak tersedia memilih **153 layanan**; irisan keduanya **1 pelanggan**. Terdapat 21 serial yang dipakai beberapa ID pelanggan; filter juga memasukkan penanda SN ganda dari perangkat. Jumlah mengikuti snapshot, bukan angka tetap 137.
- Hasil Online/Rx kosong sama dengan daftar referensi dari kontrak telemetri API. Pemeriksaan menggunakan transaksi baca-saja: **0 penulisan database, 0 panggilan pembacaan OLT**, snapshot tetap sama dalam transaksi.
- Berkas backend, endpoint, serta konfigurasi tetap sama. Poller dan listener aktif dengan PID yang sama sebelum/sesudah penerapan, tidak dihentikan atau direstart. Socket alarm 162/514 aktif. Endpoint terlindungi tetap 401 tanpa autentikasi; halaman utama 200. Tidak ditemukan kesalahan aplikasi atau pemrosesan paket listener baru dalam jendela verifikasi.
- Tidak ada migrasi, penghapusan sesi login, perubahan status ONU, maupun perubahan VPN/firewall. APK tidak dibangun ulang.

Cadangan privat: `/var/backups/fona/stage1dn-20261017T151533Z`. Database diuji melalui pg_restore; arsip aplikasi dan checksum diperiksa sebelum pemasangan.

| Berkas | Ukuran | SHA-256 |
|---|---:|---|
| database.dump | 5,865,603 byte | `d32c35efd638fc1a5fb40de5d4e3a7c25758b505b20a9e7e4743777aaa919716` |
| application.tar.gz | 8,666,802 byte | `8ff38781f356b37de2bc7701e5af6200057905a9b8313e967c2ba7b6868d6854` |
| system-configuration.tar.gz | 732 byte | `0e6f956b569780494afa65bf56ae60797f7c1601779db28c9f363bc76528ba6a` |

Pemakaian: muat ulang halaman satu kali, buka **Customers → Filter**, centang **SN ganda** dan/atau **ONU Online, Rx tidak tersedia**, lalu **Terapkan**. Hapus chip atau gunakan Reset/Bersihkan untuk menonaktifkan filter. Kedua filter mempertahankan kebijakan N/A sebagai Offline dan tidak menyelesaikan penyebab mendasar ketiadaan Rx.
