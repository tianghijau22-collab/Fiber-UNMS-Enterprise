# Refresh manual Detail Port ODP ketika OLT sibuk

## Penyebab dan perilaku baru

Peringatan `olt_busy` berasal dari pengunci pembacaan per perangkat yang sedang dimiliki proses lain. Sebelumnya, tombol refresh hanya mencoba sekali lalu menampilkan data tersimpan. Pengunci tetap diperlukan agar polling dan pembacaan manual tidak bertabrakan. Observasi baca-saja VPS 18 Oktober 2026 pukul 15:35:12 WIB menunjukkan OLT 1 sedang dibaca melalui mode `slot_parallel`, mulai pukul 15:34:52 WIB.

Tombol refresh sekarang mencoba ulang khusus respons `olt_busy`, dengan jeda sekitar dua detik ditambah variasi kecil. Ada batas 30 detik untuk memulai percobaan ulang dan maksimal 15 permintaan berurutan. Satu pembacaan yang sedang berlangsung memiliki batas keseluruhan 45 detik di browser. Tidak ada permintaan paralel dari satu modal, penghentian polling server, pelepasan paksa pengunci, atau keberhasilan realtime yang dibuat-buat.

Selama menunggu, seluruh port dan data tersimpan tetap tampil, beserta waktu sampel asli dan keterangan menunggu. Jika pembacaan berhasil, respons langsung ditampilkan. Jika OLT tetap sibuk sampai batas menunggu, modal menjelaskan pembacaan langsung belum berhasil dan tetap mempertahankan data tersimpan. Timeout, gangguan jaringan, konfigurasi antrean tidak tersedia, serta pembacaan parsial tidak diulang otomatis.

Menutup modal, membuka ODP lain, atau meninggalkan halaman membatalkan permintaan/penundaan milik modal. Pembatalan browser tidak membatalkan proses SNMP yang mungkin sudah berjalan di server; pengunci server tetap dikelola proses pemiliknya. Respons lama tidak dapat menimpa ODP yang baru dibuka. Pembaruan otomatis tetap memakai `skip_live=1`; jalur otomatis tidak mendapat percobaan pembacaan OLT tambahan.

Pengambilan langsung yang berhasil tetap dapat terjadi setelah batas penundaan jika permintaan terakhir sudah berjalan; batas keseluruhan 45 detik mencegah browser menunggu tanpa akhir. Refresh ini bukan antrean prioritas server, sehingga OLT yang terus sibuk masih dapat mengembalikan hasil tersimpan setelah batas tersebut.

## Cakupan

Dua berkas frontend diubah: halaman Network Infrastructure dan pembantu pembacaan detail ODP. Tidak ada perubahan backend, endpoint, pengunci, siklus polling, status ONU, identitas, VPN, atau topologi. Tampilan durasi tidak lagi mengganti angka nol/tidak tersedia dengan angka 45 ms.
