# Refresh manual Detail Port ODP ketika OLT sibuk

## Penyebab dan perilaku baru

Peringatan `olt_busy` berasal dari pengunci pembacaan per perangkat yang sedang dimiliki proses lain. Sebelumnya, tombol refresh hanya mencoba sekali lalu menampilkan data tersimpan. Pengunci tetap diperlukan agar polling dan pembacaan manual tidak bertabrakan. Observasi baca-saja VPS 18 Oktober 2026 pukul 15:35:12 WIB menunjukkan OLT 1 sedang dibaca melalui mode `slot_parallel`, mulai pukul 15:34:52 WIB.

Tombol refresh sekarang mencoba ulang khusus respons `olt_busy`, dengan jeda sekitar dua detik ditambah variasi kecil. Ada batas 30 detik untuk memulai percobaan ulang dan maksimal 15 permintaan berurutan. Satu pembacaan yang sedang berlangsung memiliki batas keseluruhan 45 detik di browser. Tidak ada permintaan paralel dari satu modal, penghentian polling server, pelepasan paksa pengunci, atau keberhasilan realtime yang dibuat-buat.

Selama menunggu, seluruh port dan data tersimpan tetap tampil, beserta waktu sampel asli dan keterangan menunggu. Jika pembacaan berhasil, respons langsung ditampilkan. Jika OLT tetap sibuk sampai batas menunggu, modal menjelaskan pembacaan langsung belum berhasil dan tetap mempertahankan data tersimpan. Timeout, gangguan jaringan, konfigurasi antrean tidak tersedia, serta pembacaan parsial tidak diulang otomatis.

Menutup modal, membuka ODP lain, atau meninggalkan halaman membatalkan permintaan/penundaan milik modal. Pembatalan browser tidak membatalkan proses SNMP yang mungkin sudah berjalan di server; pengunci server tetap dikelola proses pemiliknya. Respons lama tidak dapat menimpa ODP yang baru dibuka. Pembaruan otomatis tetap memakai `skip_live=1`; jalur otomatis tidak mendapat percobaan pembacaan OLT tambahan.

Pengambilan langsung yang berhasil tetap dapat terjadi setelah batas penundaan jika permintaan terakhir sudah berjalan; batas keseluruhan 45 detik mencegah browser menunggu tanpa akhir. Refresh ini bukan antrean prioritas server, sehingga OLT yang terus sibuk masih dapat mengembalikan hasil tersimpan setelah batas tersebut.

## Cakupan

Dua berkas frontend diubah: halaman Network Infrastructure dan pembantu pembacaan detail ODP. Tidak ada perubahan backend, endpoint, pengunci, siklus polling, status ONU, identitas, VPN, atau topologi. Tampilan durasi tidak lagi mengganti angka nol/tidak tersedia dengan angka 45 ms.


## Hasil penerapan

Diverifikasi pada **2026-10-18T15:43:32+07:00**. Commit kode aplikasi: `a480759a66e835159a618abd7d63a7ad7d666be7`. GitHub diperbarui terlebih dahulu, kemudian cadangan baru diverifikasi sebelum paket dipasang.

- **62 pengujian frontend** lulus, termasuk tujuh tambahan untuk percobaan ulang berurutan, batas menunggu, kesalahan selain sibuk, pembatalan saat menunggu dan ketika respons datang, deadline pada respons lambat, serta kegagalan jaringan setelah data tersimpan tampil.
- **6 skenario render/alur modal** lulus: port tetap tampil saat menunggu/batas habis, pencegahan permintaan ganda dan tumpang tindih dengan pembaruan tersimpan, pembatalan saat ditutup, respons ODP sebelumnya diabaikan, serta durasi nol/kosong/tidak tersedia. Fixture dijalankan dengan render server dan respons simulasi; ini bukan pemeriksaan visual browser atau pembuktian bahwa setiap klik akan berhasil membaca OLT dalam 30 detik.
- Build produksi lulus. 54 aset dipaketkan; 43 berkas JS/CSS melalui HTTPS cocok dengan checksum.
- Pemeriksaan baca-saja pada 2 ODP menghasilkan 16 port tanpa selisih dengan database. Respons simulasi OLT sibuk mempertahankan seluruh port dan waktu sampel sama dengan respons tersimpan. **0 penulisan database, 0 pembacaan OLT** pada pemeriksaan ini; snapshot tidak berubah. Tidak dilakukan penahanan pengunci OLT produksi untuk pengujian.
- Seluruh sumber backend, konfigurasi, serta aset lama dipertahankan. Poller dan listener aktif dengan PID sama sebelum/sesudah, tidak direstart. Socket 162/514 aktif. Tidak ditemukan kesalahan aplikasi baru dalam jendela verifikasi.
- Pengunci lintas proses tetap berlaku. Saat OLT belum tersedia sampai batas waktu, modal tetap memberi keterangan belum berhasil dan mempertahankan nilai serta waktu data tersimpan.

Cadangan privat: `/var/backups/fona/stage1dq-20261018T084137Z`. Database diperiksa melalui pg_restore; arsip aplikasi dan checksum diverifikasi sebelum pemasangan.

| Berkas | Ukuran | SHA-256 |
|---|---:|---|
| database.dump | 5,872,574 byte | `bff13e7443cb28d40e82e6ba68130f7e3b8c9b7058aac063d382f74726f6866f` |
| application.tar.gz | 9,954,205 byte | `28a0a8bb48d43d3a82c1b13a0b76de4393c6be533e32e90a8c38696cc3ab7923` |
| system-configuration.tar.gz | 732 byte | `0a2d8365493265ddc3c425124513be374138e5ed966dd7628be5fb0ad457d113` |
