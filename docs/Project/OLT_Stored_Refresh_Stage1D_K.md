# Pembaruan redaman tersimpan pada seluruh tampilan web — 17 Oktober 2026

Tujuannya agar halaman dan modal mengikuti hasil polling server tanpa meminta pembacaan OLT baru setiap kali tampilan diperbarui. Pembacaan hardware tetap merupakan pekerjaan backend atau tindakan pemeriksaan manual yang sudah tersedia.

## Cakupan

| Tampilan | Pembaruan dari data tersimpan |
|---|---|
| Dashboard | Tetap memakai pembaruan 5 detik yang sudah tersedia; endpoint membaca basis data/cache |
| Pelanggan | Daftar tetap 15 detik; modal pembacaan tidak lagi menghentikan pembaruan daftar; discovery dari snapshot 15 detik |
| OLT, daftar ONU dan diagram topologi | Sekitar 10 detik; request hardware/port otomatis eksplisit `stored_only=1` |
| Detail ONU & telemetri optik | Pembukaan dan pembaruan 10 detik memakai `stored_only=1`; tombol manual tetap membaca perangkat |
| Pemeriksaan per interface | GET khusus tersimpan saat dibuka dan sekitar 10 detik; POST manual tetap tersedia |
| Infrastruktur dan daftar ODC | Sekitar 15 detik; pilihan, filter dan formulir tidak direset |
| Detail port ODP dan spesifikasi lengkap | Sekitar 10 detik dengan `skip_live=1`; tombol pemeriksaan langsung tetap tersedia |
| Detail port ODC dan spesifikasi lengkap | Sekitar 10 detik; hanya kueri data tersimpan |
| Peta, detail node, penanda dan topologi | 15 detik saat mode pembaruan aktif, serta event yang sudah tersedia; perubahan rentang redaman memperbarui penanda meskipun nilai terbaik tetap sama |
| BTS, detail BTS dan modal diagnostik BTS | Daftar/statistik 15 detik, modal 10 detik dari basis data; baca perangkat MikroTik hanya pada tindakan manual |
| Riwayat pengukuran ODP | 15 detik saat tab riwayat aktif; nilai hasil ukur historis tidak ditimpa nilai terkini |
| Log monitoring server | Mekanisme pembaruan yang sudah tersedia tetap membaca log tersimpan; pemeriksaan kesehatan koneksi merupakan fungsi terpisah |
| Pratinjau impor Sobok | Nilai pembanding diberi label “Snapshot saat impor”; pratinjau hasil impor/historis tidak diperlakukan sebagai sensor langsung |

Interval di atas merupakan jeda antarpembaruan, bukan jaminan waktu pembacaan hardware. Penjadwal baru menunggu request selesai sebelum menjadwalkan berikutnya. Cache daftar pelanggan/dashboard/peta dan jadwal polling backend dapat menambah jeda sebelum sampel baru tersedia.

## Jaminan jalur baca dan penanganan kegagalan

- `stored_only=1` pada hardware/port tidak memakai driver jika snapshot kosong, sekalipun parameter `fresh` ikut terkirim. OLT yang tidak ditemukan menghasilkan 404, bukan memakai perangkat lain.
- Diagnostik tersimpan mempertahankan waktu, identitas dan kebaruan sampel. Tidak ada nilai pengganti atau waktu pembacaan buatan. Snapshot yang kosong/kedaluwarsa tetap kosong/kedaluwarsa.
- Endpoint GET per interface membaca snapshot dan konteks pelanggan dengan kepemilikan OLT yang dipilih; tidak menyimpan kembali hasil atau membersihkan cache sebagai mutasi.
- Jalur BTS tersimpan tidak membuat data contoh ketika tabel kosong.
- Pembaruan berkala dijeda saat tab disembunyikan, berjalan kembali saat terlihat, dan tidak menumpuk request pada penjadwal yang sama. Request dibatalkan saat target/modal berubah jika pemanggil mendukung sinyal pembatalan; pemeriksaan target/urutan menjaga respons lama agar tidak menimpa pilihan terbaru.
- Refresh gagal mempertahankan data terakhir. Waktu asli pada kartu tetap menjadi acuan kebaruan. Formulir edit dan nilai hasil ukur historis dipertahankan.
- Kebijakan tampilan web N/A → Offline mengikuti pilihan pengguna. N/A sendiri tidak dianggap bukti kegagalan pembacaan.

## Verifikasi

222 pengujian backend dan 38 frontend lulus. Uji mencakup snapshot kosong dan baru, data lama, larangan pemanggilan driver/SNMP, larangan penulisan data saat membaca, penguncian OLT, otorisasi endpoint, pembatalan, tab tersembunyi, kegagalan sementara dan penjadwalan tanpa tumpang tindih. Delapan skenario render komponen juga lulus, termasuk tampilan data tersimpan saat pembaruan gagal.

Kandidat juga diperiksa di VPS dalam transaksi baca-saja, menggunakan data dari ketiga OLT dengan pembaca hardware diblokir oleh fixture proses pemeriksaan. Nilai/waktu sampel konsisten dan snapshot tidak berubah. Verifikasi visual browser lokal belum dapat diselesaikan karena sambungan pengendalian browser gagal; hasil render terpisah dan batas verifikasi dicatat pada laporan penerapan.

Cakupan penerapan ini adalah aplikasi web dan API pendukung. APK Flutter tidak dibangun atau diterbitkan. Tidak ada perubahan jadwal SNMP backend, konfigurasi OLT/VPN, identitas ONU, perhitungan redaman, atau aturan N/A.
