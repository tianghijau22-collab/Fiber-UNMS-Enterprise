# Rincian redaman pelanggan pada panel ODP GIS

Panel detail ODP pada GIS kini menampilkan daftar pelanggan beserta nomor port, ID pelanggan, SN, redaman Rx, status dan waktu sampel. Daftar berada tepat di bawah ringkasan telemetry ODP, pada peta biasa maupun layar penuh. Port kosong tidak ditampilkan. Port terisi yang hubungan pelanggannya belum lengkap tetap terlihat dengan keterangan yang sesuai.

Data memakai endpoint detail port yang sudah dilindungi autentikasi, dengan `skip_live=1`. Daftar membaca pembaruan tersimpan saat dibuka dan setiap 10 detik setelah permintaan sebelumnya selesai. Pembaruan ditunda ketika tab disembunyikan dan dilanjutkan saat terlihat kembali. Tidak ada endpoint baru, perubahan database, atau pembacaan langsung OLT dari daftar ini.

Komponen mengikuti kebijakan tampilan redaman yang sama dengan halaman pelanggan dan modal detail port: Rx tersedia ditampilkan dua desimal dalam dBm; Rx tidak tersedia ditampilkan N/A dengan status Offline. Status sensor asli tidak ditulis ulang. Keterangan SN ganda dan waktu sampel tetap ditampilkan. Sampel tersimpan yang melewati 180 detik disembunyikan nilai Rx-nya dan ditandai sebagai data lama.

Daftar dipasang ulang ketika ID ODP berubah. Permintaan yang dibatalkan saat menutup atau mengganti ODP tidak boleh mengganti isi daftar. Kegagalan pembaruan mempertahankan data ODP yang sama dengan peringatan; kegagalan awal tidak ditampilkan sebagai nol pelanggan. Tombol Coba lagi juga hanya membaca data tersimpan.

## Validasi sebelum penerapan

- 71 pengujian frontend lulus, termasuk empat pengujian tambahan: penyaringan/sortir port, pelanggan dengan SN sama, format Rx dan kebijakan N/A, serta pembatasan umur sampel.
- 13 skenario render/perilaku diperiksa: loading, data tersedia, kosong, relasi belum lengkap, kegagalan awal dan pembaruan, data lama, karakter HTML pada nama, jalur stored-only, penolakan akses, respons terlambat setelah pembatalan, serta panel peta biasa dan layar penuh.
- Data ODP 451 diperiksa dari VPS dalam transaksi baca-saja: tujuh pelanggan dan satu port kosong. Jumlah pelanggan cocok dengan GIS; nilai Rx mengikuti hasil endpoint detail port. Nol penulisan database, nol panggilan pembacaan OLT, snapshot tidak berubah.
- Tampilan diperiksa melalui pratinjau browser lokal menggunakan komponen aplikasi, CSS produksi, serta data pelanggan contoh. Ini bukan tangkapan layar sesi GIS produksi yang terautentikasi.

Penerapan mengikuti urutan GitHub, cadangan baru yang diverifikasi, pemasangan sumber dan aset, kemudian pemeriksaan layanan dan HTTPS. Poller dan listener tidak dimulai ulang.


## Hasil penerapan

Diterapkan pada **18 Oktober 2026 pukul 16.49 WIB**, diverifikasi kembali pada **2026-10-18T16:50:08+07:00**. Commit aplikasi: `350ddc682792bc5ba50e9d85e424b6a0bd32f045`. GitHub diperbarui sebelum cadangan baru dan pemasangan.

- Build produksi lulus: 53 aset dipaketkan; 42 berkas JS/CSS melalui HTTPS cocok dengan checksum paket. Sumber yang terpasang cocok dengan paket.
- ODP 451: 7 pelanggan ditampilkan, 1 port kosong dikecualikan, 0 nilai Rx tersedia pada saat pemeriksaan. Pembacaan GIS dan detail port dilakukan dalam transaksi baca-saja yang sama: 0 penulisan database, 0 pembacaan OLT, snapshot tidak berubah.
- 71 pengujian frontend dan 13 skenario render/perilaku lulus. Pratinjau dua tema menggunakan data contoh dan CSS produksi diperiksa di browser; bukti lokal `scratch/gis-odp-customers/customers-proof.jpg`, SHA-256 `e85152a5f22d4dd0b0a080acd940f849cc9b10177c73eeab33c9962c4ec6b520`. Tab dan server pengujian ditutup setelah pemeriksaan.
- Layanan tetap aktif. PID poller dan listener tidak berubah; socket alarm 162/514 aktif. Tidak ditemukan kesalahan aplikasi baru pada jendela verifikasi. Sesi login tidak dibersihkan.

Cadangan privat terverifikasi: `/var/backups/fona/stage1ds-20261018T094754Z`. Database diperiksa dengan pg_restore; arsip aplikasi dan konfigurasi diperiksa beserta checksum sebelum pemasangan.

| Berkas | Ukuran | SHA-256 |
|---|---:|---|
| database.dump | 5,867,489 byte | `6b5d096f60ef2a12cbde22dacbb194bf6de4f1d8add026fe00a12d6e0f9eb5f2` |
| application.tar.gz | 10,791,193 byte | `21a8be770d8e74768c468c7cfeaae106de8aac8209d5f32f1ac1e63d6182cfb3` |
| system-configuration.tar.gz | 732 byte | `9482276a85541f98fb1346d619c0e6a67ae361744af815584f90e8852cd4f6a0` |
