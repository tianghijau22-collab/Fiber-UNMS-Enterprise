# FONA — fondasi insiden dan pengiriman tahan gangguan (1G-B)

Tanggal: 24 Oktober 2026. Tahap ini menyiapkan integrasi monitoring dan asisten operasional n8n. n8n belum dipasang dan pembuatan tiket otomatis tetap tidak diaktifkan.

## Hasil perubahan

- Status evaluasi yang sebelumnya bergantung pada Redis disimpan dalam checkpoint PostgreSQL. Evaluasi terkunci pada database; kehilangan cache tidak membuat kejadian baru atau mengulang alarm awal.
- Insiden mempunyai identitas episode dan riwayat perubahan permanen. Gangguan lama pada saat penerapan menjadi baseline tanpa mengirim ulang notifikasi. Perubahan anggota/topologi mengakhiri episode sebagai superseded; ketiadaan bukti tidak dianggap pemulihan.
- Kejadian dan daftar pengiriman per kanal, tujuan, dan potongan pesan dibuat dalam transaksi yang sama. Penjadwal memulihkan pekerjaan yang belum sempat masuk antrean.
- Setiap tujuan yang berhasil tidak dikirimi ulang karena tujuan lain gagal. Notifikasi pemulihan eksternal hanya dikirim bila tujuan tersebut menerima notifikasi gangguan. Pesan yang sudah usang dibatalkan.
- Jawaban Telegram harus berisi pengakuan berhasil dan identitas pesan. Penolakan sementara yang jelas dapat dicoba ulang dengan jeda. Timeout, jawaban tanpa pengakuan, atau proses mati setelah pengiriman diberi status uncertain. Percobaan ulang kondisi uncertain memerlukan pengakuan risiko pesan ganda dari operator. Sistem eksternal tidak menjamin exactly-once; tidak ada klaim jaminan tanpa duplikasi pada gangguan jaringan.
- Identitas tujuan Telegram disimpan terenkripsi. Endpoint pembacaan riwayat tidak menampilkan penerima, token, isi payload, atau token penguasaan pekerjaan. Percobaan ulang dicatat pada audit beserta status dan jumlah percobaan sebelumnya.
- Pembuatan tiket menggunakan nomor urut terkunci dan Idempotency-Key. Pengulangan permintaan yang sama mengembalikan tiket yang sama. Isi berbeda dengan kunci sama ditolak; tiket yang sengaja dihapus tidak dibuat ulang dengan kunci lama. Satu insiden dapat memiliki paling banyak satu tiket, termasuk ketika beberapa operator mengirim bersamaan.
- Form tiket mempertahankan identitas permintaan ketika respons jaringan tidak diterima dan mencegah kiriman ganda selama proses berlangsung. Form yang sengaja ditutup mengakhiri percobaan tersebut.

## Alur

Collector OLT → bukti tersimpan bersama GIS → evaluasi terkonfirmasi → transaksi checkpoint + insiden + kejadian + outbox → pekerja pengiriman per tujuan → pengakuan hasil / jeda ulang / peninjauan operator.

Tidak ada pembacaan langsung OLT baru pada evaluasi, daftar riwayat, atau pengiriman. Nilai N/A tetap dipertahankan. Status sumber VPN/OLT dipisahkan dari dugaan gangguan optik.

## API yang disiapkan

- GET `/api/monitoring/incidents` dan GET `/api/monitoring/incidents/{id}` untuk daftar serta riwayat.
- POST `/api/monitoring/incidents/{id}/ticket` untuk satu tiket insiden atas permintaan operator; belum ada pemicu otomatis.
- POST `/api/monitoring/deliveries/{id}/retry` untuk percobaan ulang terotorisasi. Pengiriman uncertain membutuhkan `acknowledge_duplicate_risk: true`.
- Akses memakai autentikasi dan kebijakan halaman FONA yang ada. Penulisan dibatasi Super Administrator dan Operator Jaringan. Tidak ada endpoint publik atau token integrasi baru pada tahap ini.

Antarmuka daftar insiden dan tombol peninjauan outbox belum ditambahkan ke halaman. API menjadi fondasi tahap integrasi selanjutnya.

## Validasi

- 342 tes backend di luar suite AI lulus, dengan 3.141 assertion; termasuk 40 tes fondasi, ketahanan, dan autentikasi API.
- 12 tes frontend terkait lulus; build dibuat secara terpisah dari 101 berkas sumber produksi dan perubahan form tiket.
- 50 permintaan bersamaan di PostgreSQL terisolasi menghasilkan tepat satu insiden/kejadian, 12 tiket dengan 12 nomor unik, dan satu pengiriman simulasi meskipun pekerjaan pengiriman diminta berulang. Skema uji dibuang setelah pemeriksaan.
- Pengujian memakai transport palsu dan database sementara; tidak membuat tiket uji pada data produksi serta tidak mengirim pesan uji ke pelanggan atau teknisi.
- Seluruh suite backend dijalankan: terdapat lima kegagalan AI yang juga dapat direproduksi menggunakan kode sebelum perubahan monitoring. Temuan ini bukan dinyatakan selesai pada rilis ini. Cakupannya: klasifikasi intent terlarang, klasifikasi rate limit, validasi riwayat, fixture pencarian node, dan tampilan waktu sampel.

## Penerapan dan pemulihan

GitHub diperbarui sebelum penerapan. Cadangan PostgreSQL, aplikasi, konfigurasi sistem, dan penjadwal diverifikasi terlebih dahulu. Sumber di luar paket, konfigurasi, firewall alarm, dan aset lama dipertahankan. Aset baru dipublikasikan sebelum mengganti manifest.

**Penting:** hanya migrasi `database/migrations/2026_10_24_000001_create_monitoring_incidents_and_outbox.php` dijalankan dengan `--path` eksplisit. Migrasi tiket lama berisi operasi drop tabel dan tidak boleh dijalankan ulang pada produksi. Tidak menggunakan migrate:fresh, rollback menyeluruh, atau restore database saat rollback kode.

Saat penerapan, web masuk pemeliharaan singkat dan proses latar dihentikan terkontrol untuk menghindari versi campuran. Antrean notifikasi versi lama harus selesai terlebih dahulu. Setelah migrasi, checkpoint diimpor tanpa mengirim ulang insiden lama, kemudian layanan dihidupkan kembali.

Rollback mengembalikan sumber dan manifest, menghentikan hanya pekerjaan pengiriman yang diperkenalkan rilis ini, dan mempertahankan tabel audit baru serta data bisnis. Perubahan sistem/jaringan dan pengaturan kredensial tidak termasuk paket.

## Tahap selanjutnya

Siapkan pemasangan n8n secara terisolasi, akses HTTPS dan otorisasi integrasi terbatas; gunakan identitas kejadian yang sama untuk deduplikasi workflow. Tambahkan panel riwayat insiden/hasil pengiriman dan alur persetujuan operator. Pembuatan tiket otomatis serta tindakan konfigurasi OLT memerlukan rancangan dan aktivasi terpisah.
