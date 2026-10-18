# GIS: ODP seluruh ONU N/A dan perkiraan segmen gangguan

## Perilaku

Marker ODP merah bila seluruh pelanggan/ONU memiliki identitas terverifikasi, sampel terbaru (maksimal 180 detik), status perangkat diketahui, dan tidak ada nilai Rx valid. Ini mencakup status asli Online dengan Rx N/A. Labelnya **Seluruh ONU N/A**, tanpa menulis ulang status perangkat. ODP kosong tidak dianggap gangguan; port pelanggan yang belum terpetakan atau sampelnya kedaluwarsa membuat kesimpulan seluruh ONU N/A tidak terverifikasi.

Peta membaca pembaruan tersimpan setiap 15 detik. Masa berlaku bukti juga diperiksa lokal setiap 15 detik, termasuk ketika pembaruan dijeda atau gagal. Data kedaluwarsa menjadi abu-abu dan perkiraan terkait disembunyikan. Backend tetap memakai cache GIS yang sama selama 15 detik.

Panel **Gangguan optik otomatis** tersedia di peta biasa, fullscreen, dan tampilan tabel. Panel menampilkan jumlah ODP seluruh ONU N/A, segmen perkiraan, serta peringatan hubungan kabel yang belum lengkap.

## Penentuan segmen

Algoritma memakai sambungan `from_node_id`/`to_node_id` kabel aktif atau rusak yang tersimpan, terlepas dari urutan ID dan arah pengisian kedua endpoint. Tidak membentuk sambungan dari nomor/nama ODP, kedekatan koordinat, atau kesamaan induk ODC.

Kandidat adalah sambungan antara ODP yang masih memiliki Rx valid dan ODP seluruh ONU N/A. Sesudah sambungan tersebut, seluruh cabang harus terdiri dari ODP yang juga memiliki bukti N/A terbaru. Batas ditolak bila ada ODP bersinyal di belakangnya, data belum lengkap, maintenance/nonaktif, jalur melingkar, kabel paralel, atau jalur lain yang membuat batas tidak tunggal. Bukti perangkat di setiap ODP harus berasal dari satu OLT/PON yang sama; pengenal PON memakai hasil identitas perangkat, bukan uplink pertama ODP yang dapat berbeda dengan pelanggan.

Segmen yang memenuhi syarat ditampilkan sebagai garis merah putus-putus. Pin adalah **patokan segmen pemeriksaan**, dihitung di sepanjang rute kabel tersimpan. Bila bentuk rute tidak tersedia, garis penghubung node diberi keterangan tersebut. Koordinat tidak valid tidak menghasilkan pin. Tombol lokasi mendukung perpindahan dari tabel ke peta.

Ini perkiraan area pemeriksaan, bukan pengukuran OTDR atau kepastian kabel putus. ONU mati listrik, sambungan/splitter, dan gangguan perangkat dapat menghasilkan pola serupa. Tidak ada persentase keyakinan maupun jarak putus pasti yang dibuat-buat.

## Temuan data VPS dan batas penerapan

Audit baca-saja 18 Oktober 2026 menemukan **1.131 node (1.034 ODP)** dan **83 rute kabel**. Seluruh 83 kabel memiliki endpoint asal/tujuan kosong. Tidak ada hubungan induk ODP-ke-ODP; 102 ODP berinduk ODC dan 932 ODP tidak memiliki induk. Urutan fisik antar-ODP belum dapat dibuktikan dari data ini.

Pada snapshot 08:34:16 WIB, 101 ODP memenuhi kriteria seluruh ONU N/A dan 27 ODP memiliki bukti yang belum lengkap. **Nol segmen** dapat diperkirakan karena sambungan kabel belum tercatat. Jumlah status mengikuti pembaruan tersimpan. Setelah endpoint kabel diisi sesuai jaringan nyata, pendeteksi mengevaluasi sambungan tersebut otomatis. Penerapan ini tidak mengisi atau mengubah topologi secara otomatis.

Pemeriksaan kandidat membuktikan payload GIS sebelumnya tetap sama selain dua tambahan: `nodes[].optical_evidence` dan `optical_diagnostics`. Transaksi produksi baca-saja: 0 penulisan database, 0 panggilan pembacaan OLT, snapshot tidak berubah. Tidak ada migrasi, perubahan nilai Rx, kepemilikan pelanggan, VPN, poller/listener, atau notifikasi Telegram. Mekanisme diagnostik/notifikasi lama terpisah tidak dipanggil oleh fitur GIS ini; temuan lama terkait pengurutan ID dan nilai pengganti perlu ditinjau tersendiri sebelum dipakai untuk keputusan lapangan.


## Status rilis: siap, belum diterapkan

Commit kode aplikasi di GitHub: `1efe8b9b553e0fa13f1bc628a1c323027e3a349e`. **250 pengujian backend / 2.370 assertion**, **55 pengujian frontend**, dan **7 skenario render server** lulus. Build produksi berhasil (54 aset). Pengujian kandidat dengan database produksi memakai transaksi baca-saja, tanpa perubahan data atau pembacaan OLT. Pemeriksaan browser visual belum dilakukan.

Cadangan baru sudah diverifikasi: `/var/backups/fona/stage1dp-20261018T013903Z`. Namun pemasangan ditahan **sebelum perubahan runtime/aset** karena OLT Singkarak (10.11.48.101) tidak menjawab SNMP. Pemeriksaan ulang: OLT 1/2 merespons; OLT 3 tidak. Rute ke OLT 3 masih melalui ppp0/10.254.0.2, tetapi ping mendapat Destination Host Unreachable dari 103.84.209.30. Ini kondisi yang sudah ada sebelum penerapan; penyebab di jaringan kantor/perangkat belum dipastikan.

Usulan melanjutkan penerapan khusus GIS dengan mengecualikan syarat semua OLT merespons ditolak oleh peninjauan persetujuan otomatis karena memerlukan izin khusus pengguna saat infrastruktur bermasalah. Tindakan tersebut **tidak dieksekusi**. Pemeriksaan kesiapan tetap utuh. Pengguna diminta memilih menunggu OLT pulih atau memberi izin khusus untuk penerapan GIS dalam kondisi ini. Belum ada keputusan pengguna saat catatan ini disimpan.

Pemeriksaan sesudah penahanan: seluruh sumber runtime dan manifest web sama dengan sebelum penerapan, checksum cadangan sesuai, poller/listener aktif dengan PID dan jumlah restart sama. Fitur baru belum aktif di VPS. Kode dan paket siap diterapkan setelah syarat penerapan dipenuhi.

| Cadangan | Ukuran | SHA-256 |
|---|---:|---|
| database.dump | 5,871,205 byte | `50866725df91d81634cea1d58c23770825efb0524fe23179f130a005f3ce6f9a` |
| application.tar.gz | 9,497,781 byte | `df7de34d48805d370262b6e75d64636ee6f7fb037e1b728323b87c5ce5f44f54` |
| system-configuration.tar.gz | 732 byte | `7af9c5e79ccf6f4036b5ff6e1f390eea425a262cc3413c739bd4b223cd1edf98` |
