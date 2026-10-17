# Hasil perbaikan SN ganda FONA — 17 Oktober 2026

Perbaikan telah diterapkan dan diverifikasi pada VPS 103.89.6.125. Kode GitHub: `ecc0025a81f7e0fe328d1a8cf50beacbe4bd1f25`. Pemeriksaan akhir data halaman dilakukan pukul 16:25 WIB. Scope adalah aplikasi web dan jalur backend bersama; APK tidak dibangun ulang.

## Temuan dan penyebab

SN **ZTEGD461F38E** tercatat pada dua registrasi pelanggan dan dua lokasi OLT ZTE C300 Kota Solok. Pemetaan serial versi 2 membuang seluruh lokasi SN ganda sebelum mengaitkannya dengan hasil pembacaan state dan Rx. Ini menyebabkan N/A meskipun salah satu lokasi memiliki pembacaan valid.

| Lokasi | Pemeriksaan langsung 16:11 WIB | Snapshot normal sesudah penerapan |
|---|---|---|
| 1/2/3:12 | State 3, raw Rx 3926, **−22,15 dBm** | **−22,08 dBm**, sampel 16:24:30 WIB |
| 1/4/7:2 | Serial sekunder masih tercantum; state/Rx 65535 | Tanpa Rx valid; tetap disimpan sebagai kandidat pembanding |

Perubahan angka antarwaktu berasal dari sampel perangkat yang berbeda. Nilai pemeriksaan awal tidak ditulis ulang sebagai sampel baru.

## Perilaku yang diterapkan

1. Simpan seluruh lokasi serial yang sah dalam cache identitas versi 3. Tolak kontradiksi serial pada tuple yang sama.
2. Pilih lokasi hanya jika **tepat satu** memiliki state Online dan Rx valid yang masih baru. Data kandidat pesaing juga harus masih baru. Dua lokasi dengan Rx valid, ketiadaan Rx, atau bukti kedaluwarsa tidak memakai aturan pertama/terakhir maupun sinyal terkuat.
3. Pisahkan bukti lokasi ganda dari hasil tampilan pelanggan dan ledger penulisan, sehingga pembaruan berikutnya masih dapat membatalkan pilihan lama ketika konflik muncul.
4. Pembacaan halaman tetap berbasis snapshot; tidak ada pembacaan langsung ke OLT setiap pembaruan modal.
5. Tampilkan keterangan **SN ganda · memakai lokasi dengan redaman valid** beserta lokasi pembanding pada petunjuknya.
6. Tidak menghapus atau memindahkan pelanggan. Dua catatan pelanggan dengan SN yang sama dapat menampilkan pembacaan perangkat yang sama; ini tidak membuktikan kedua pelanggan memiliki perangkat aktif terpisah. Penulisan otomatis ke registrasi pelanggan yang ambigu tetap ditahan.
7. Isolasi antar-OLT, masa berlaku identitas/sampel, konfirmasi serial untuk pembacaan langsung, serta kebijakan tampilan N/A sebagai Offline tetap dipertahankan.

## Hasil produksi

- Pembacaan pelanggan CMN 5698 dan LIVESMAN1KUBUNG, detail ODP 390 dan ODP 94, serta modal redaman menghasilkan **nilai, interface, ID ONU, waktu sampel, dan penanda SN ganda yang sama** untuk SN contoh.
- Snapshot normal bergerak dari sampel 16:22:52 ke 16:24:30 WIB. Ini menunjukkan poller baru tetap memasok pembaruan tersimpan.
- OLT 1 memiliki **24 SN ganda** pada snapshot pemeriksaan: **22** memiliki tepat satu lokasi dengan Rx valid dan dapat dipilih; **2** belum memiliki kandidat dengan Rx valid. OLT 2 dan 3 tidak memiliki SN ganda pada snapshot tersebut.
- Dua yang belum terpilih: **ZTEGC157E69B** (1/2/15:4 dan 1/5/7:17: state belum diketahui dan Rx kosong), **ZTEGC09B00B8** (1/5/5:7 dan 1/5/8:54: state Online tetapi Rx kosong). Ini adalah keadaan snapshot saat pemeriksaan; penyebab fisik atau pengambilan datanya belum dibuktikan. Sistem tidak mengisi angka dugaan.
- Registrasi database untuk contoh tetap tidak diubah karena dua pelanggan cocok. Seluruh halaman diuji lewat jalur baca bersama, sehingga tampilan tidak bergantung pada nilai lama registrasi.

## Validasi

- **231 pengujian backend / 2.263 assertion**, seluruhnya lulus.
- **38 pengujian frontend**, seluruhnya lulus.
- **10 skenario render server** lulus, termasuk pemberitahuan SN ganda. Ini bukan pengujian visual browser.
- Build produksi lulus; 54 aset dipaketkan dan 43 berkas JS/CSS diverifikasi melalui HTTPS.
- Pemeriksaan snapshot ketiga OLT, halaman pelanggan, detail ODP, interface, dan diagnostik dalam transaksi baca-saja: **0 pembacaan SNMP/driver/ODP langsung, 0 perubahan database, snapshot tetap sama**.
- Endpoint terlindungi tetap menolak akses tanpa autentikasi. Listener dan poller aktif setelah restart terkontrol, tanpa restart berulang saat verifikasi. Socket alarm 162 dan 514 aktif.
- Tidak ditemukan ERROR/CRITICAL/ALERT/EMERGENCY aplikasi atau kesalahan pemrosesan paket listener baru pada jendela verifikasi.
- VPN tersedia dan tiga OLT merespons. Sampel ping 16:24:54 WIB: **27,52 ms**, 2/2 balasan; pengukuran singkat ini tidak menyatakan stabilitas jangka panjang.

## Cadangan dan penerapan

Urutan: GitHub diperbarui → cadangan diverifikasi → paket diterapkan → layanan diperiksa → pembacaan normal dan endpoint tersimpan diperiksa. Tidak ada migrasi database, perubahan konfigurasi OLT/VPN/firewall, penghapusan pelanggan, atau penghapusan sesi login.

Cadangan privat: `/var/backups/fona/stage1dl-20261017T092116Z`.

| Berkas | Ukuran | SHA-256 |
|---|---:|---|
| database.dump | 9,503,173 byte | `e6249524482bdae7b42ecdbb4b99678b9a4b861104b3c15c7afc913a4c77aa98` |
| application.tar.gz | 7,836,955 byte | `5b92919982cfe0177ee6c185b67801d58022e29db8203a499b3ce316a6ab903d` |
| system-configuration.tar.gz | 732 byte | `a5b50a1cea5c7eb2d031b2f06982dda5c40e0006d91fa3549e0f5b56f33f96b6` |

Arsip database diuji melalui pembacaan pg_restore; arsip aplikasi berisi 7,793 entri dan seluruh checksum diverifikasi sebelum penerapan.

Pemeriksa rilis sempat berhenti setelah pemasangan karena `resources/js/lib/onuTelemetry.js` terdaftar sekaligus sebagai target perubahan dan berkas yang harus tetap sama. Pemeriksaan lanjutan membuktikan hanya target yang memang direncanakan itu yang berubah, semua hash aplikasi/aset sesuai paket, layanan aktif, dan konfigurasi tetap sama. Daftar pemeriksaan alat rilis diperbaiki lalu verifikasi diselesaikan; tidak diperlukan pemulihan aplikasi atau database. Ini bukan penolakan izin maupun perubahan tak terduga pada sistem.

## Batas dan tindak lanjut terpisah

Status siklus backend masih PARTIAL pada pengamatan, sebagaimana temuan pengambilan data sebelumnya. Perbaikan SN ganda tidak menyatakan seluruh timeout transport F21 sudah selesai. N/A tetap dapat berasal dari perangkat mati, kabel putus, belum tersedianya Rx pada snapshot, atau pembacaan yang belum lengkap; penyebab spesifik membutuhkan bukti perangkat.

Kepemilikan registrasi pelanggan yang menggunakan ulang SN masih memerlukan penertiban administratif terpisah. Muat ulang halaman web satu kali untuk memakai aset baru; setelahnya pembaruan tersimpan berjalan mengikuti interval yang sudah diterapkan.
