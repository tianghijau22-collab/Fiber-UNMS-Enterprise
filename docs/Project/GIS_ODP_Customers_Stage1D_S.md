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
