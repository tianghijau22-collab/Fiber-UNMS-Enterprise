# Hasil penerapan fondasi insiden FONA — 24 Oktober 2026

Tahap 1G-B sudah dipasang pada VPS 103.89.6.125. GitHub diperbarui sebelum penerapan: [commit kode 1ffca7d](https://github.com/tianghijau22-collab/Fiber-UNMS-Enterprise/commit/1ffca7dc77ab487bd43652bc5931e2f00ab6e6f0).

## Yang sudah berjalan

1. Riwayat insiden dan checkpoint monitoring tersimpan di PostgreSQL, sehingga tidak hanya bergantung pada cache.
2. Antrean pengiriman mencatat hasil per tujuan. Tujuan yang berhasil tidak dikirimi ulang karena tujuan lain gagal. Hasil pengiriman yang belum pasti memerlukan peninjauan operator sebelum dikirim ulang.
3. Form pembuatan tiket mempertahankan identitas permintaan saat jaringan gagal. Nomor tiket dibuat berurutan dengan penguncian, dan satu insiden hanya dapat ditautkan ke satu tiket.
4. API riwayat insiden, percobaan ulang pengiriman, dan pembuatan tiket insiden sudah dilindungi autentikasi serta izin akses. Panel baru untuk mengelola riwayat/pengiriman belum ditambahkan ke antarmuka.

n8n sendiri belum dipasang. Tiket otomatis dari gangguan belum diaktifkan. Pembacaan OLT tetap dimiliki collector yang sudah ada; rilis ini tidak menambah permintaan pembacaan langsung dari halaman atau pengiriman notifikasi.

## Cadangan

Lokasi privat VPS: `/var/backups/fona/stage1gb-20261024T121633Z/`.

Cadangan meliputi dump PostgreSQL, aplikasi, aset web, konfigurasi layanan, dan penjadwal. Seluruh arsip diverifikasi sebelum penerapan. Hanya migrasi khusus insiden yang dijalankan; tabel tiket lama tidak dibuat ulang.

## Pemeriksaan setelah penerapan

Penerapan selesai sekitar **19.18 WIB**. Pada pemeriksaan **19.19.46 WIB**:

- Collector OLT, penerima alarm, kedua pekerja antrean, penjadwal, dan layanan web aktif.
- 999 catatan status telah diimpor ke checkpoint permanen; 10 insiden lama tercatat sebagai baseline tanpa pengiriman ulang alarm lama.
- Snapshot ketiga OLT telah diperbarui setelah pemuatan ulang, masing-masing sekitar 19.19.16–19.19.22 WIB.
- Antrean pekerjaan sudah kosong, pekerjaan gagal nol, dan tidak ada kesalahan aplikasi baru. Checkpoint kembali diperbarui pada 19.19.25 WIB setelah beberapa siklus berjalan.
- HTTP halaman utama 200; endpoint privat menolak akses tanpa login. Sebanyak 43 aset JavaScript/CSS yang dilayani web cocok dengan paket rilis.
- Port penerima alarm UDP 162/514 tetap aktif; konfigurasi dan firewall dipertahankan.

Pembacaan collector masih berstatus **PARTIAL**, seperti sebelum penerapan. Artinya paket ini tidak menyatakan seluruh masalah akuisisi data telah selesai. N/A yang memang dilaporkan perangkat tetap dipertahankan.

## Bukti pengujian

342 tes backend terkait lulus dengan 3.141 assertion, ditambah 12 tes frontend. Uji 50 permintaan bersamaan pada PostgreSQL sementara lulus: satu insiden/kejadian, 12 nomor tiket unik, dan satu pengiriman simulasi meskipun diminta berulang. Database uji diisolasi dan skemanya sudah dihapus.

Pengujian tidak mengirim pesan ke Telegram/FCM sungguhan dan tidak membuat tiket uji pada data produksi.

Ada **lima kegagalan pada suite AI yang juga muncul dengan kode sebelum rilis ini**. Temuannya meliputi penolakan intent terlarang, klasifikasi pembatasan kuota, validasi riwayat, fixture pencarian node, dan penampilan waktu sampel. Kelimanya dicatat untuk pemeriksaan lanjutan; tidak dinyatakan selesai melalui perubahan monitoring ini.

## Berikutnya

Pasang n8n secara terisolasi, siapkan alamat HTTPS dan akses integrasi terbatas, lalu hubungkan kejadian insiden menggunakan identitas kejadian yang sama. Tambahkan panel riwayat/pengiriman serta persetujuan operator sebelum mengaktifkan tindakan otomatis.

Muat ulang halaman tiket agar browser menggunakan versi form terbaru.
