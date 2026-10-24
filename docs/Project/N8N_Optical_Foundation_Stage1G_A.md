# Fondasi monitoring untuk integrasi n8n — tahap 1G-A

Tanggal: 24 Oktober 2026.

## Tujuan dan cakupan

Menyatukan bukti analisis ODP dan indikasi segmen kabel dengan GIS, memisahkan kegagalan sumber telemetri, serta menghapus pemicu penjadwal FONA yang ganda. Tahap ini menyiapkan fondasi monitoring; n8n belum dipasang.

## Perilaku baru

- `NetworkOpticalEvidence` membaca snapshot ONU, identitas, port pelanggan dan konektivitas sumber yang sudah diamati. GIS dan diagnosis otomatis menggunakan agregasi yang sama. Layanan ini tidak melakukan ping/SNMP/probe OLT atau menulis status pelanggan.
- N/A yang berasal dari perangkat tetap N/A. Pembacaan sumber yang gagal, sampel kedaluwarsa, identitas ambigu, pelanggan/port belum terpetakan dan alias hardware yang dihitung berulang tidak dijadikan bukti seluruh ODP kehilangan Rx.
- Penentuan segmen memakai `GisOpticalFaultAnalyzer` dan hubungan kabel-node tersimpan, termasuk pemeriksaan cabang, PON dan umur bukti. Urutan ID ODP dan angka Rx pengganti tidak lagi dipakai oleh jalur lokalisasi ini.
- Alarm massal ODP memerlukan minimal dua pelanggan dan seluruh bukti tanpa Rx. Marker GIS tetap dapat menandai ODP satu pelanggan sesuai kontrak GIS. Sinyal lemah yang masih valid tetap merupakan bukti adanya sinyal.
- Konfirmasi perubahan keadaan memerlukan dua observasi berbeda dengan waktu observasi maju minimal lima detik. Refresh berulang atas sampel yang sama tidak menambah konfirmasi. Pemulihan penuh mensyaratkan seluruh pelanggan mempunyai Rx valid; pemulihan sebagian/unknown tidak diumumkan sebagai pulih penuh.
- Kondisi saat pertama diobservasi atau setelah perubahan anggota/topologi dibentuk sebagai baseline tenang, sehingga penerapan tidak menyiarkan ulang gangguan lama. Perubahan baru setelah baseline tetap dievaluasi.
- Hilangnya hasil kandidat segmen bukan bukti kabel sudah diperbaiki. Data tidak lengkap, node maintenance, penghapusan node, atau perubahan graf tidak memicu pemulihan palsu.
- Putusnya sumber VPN/OLT menggunakan kategori `SOURCE_UNAVAILABLE`/`SOURCE_RECOVERY`. Kondisi optik pelanggan diperiksa terpisah. OLT berstatus offline lama tetap dicoba oleh pengumpul yang sama; respons yang kembali teramati mengaktifkannya lagi. Penjadwal tidak lagi melakukan pengujian OLT tambahan atau mengganti status OLT berdasarkan tesnya sendiri.
- Korelasi ODP dari listener meminta satu pekerjaan analisis yang dapat digabungkan untuk rangkaian trap, memakai hasil pengamatan yang sudah ditulis ke snapshot bersama. Listener tidak menunggu analisis seluruh jaringan atau melakukan probe ODP kedua. Detektor fisik/interface yang terpisah tetap berjalan melalui jalur pembacaan perangkat yang sudah ada.
- Kategori indikasi/pemulihan segmen dan sumber diterima secara eksplisit oleh penyaring notifikasi. Kebijakan penolakan siaran individual tetap berlaku.
- Notifikasi baru dikirim oleh job antrean database FONA, sehingga diagnosis/poller tidak menunggu Telegram. Job memeriksa token dan keadaan terkini, mengabaikan event yang sudah digantikan, dan tidak mengirim lagi setelah pengiriman tercatat selesai.
- Endpoint GET diagnosis serta `fona:diagnose-optical --dry-run` membaca bukti tanpa mengubah keadaan alarm atau mengirim notifikasi.

## Penjadwalan produksi

Pertahankan `fiber-unms-scheduler` melalui Supervisor (`schedule:work`). Hapus hanya baris cron pengguna `jasenardian` yang menjalankan `artisan schedule:run` untuk `/var/www/fiber-unms`. Simpan crontab asli untuk rollback; jangan menghapus pekerjaan lain.

`fona:diagnose-optical` berjalan tiap menit dengan `withoutOverlapping(2)`. Poller tetap mengevaluasi diagnosis berkala setelah pembaruan data; listener dapat meminta evaluasi setelah observasi diterima. Lock bersama dan pembatasan frekuensi mencegah evaluasi paralel, sedangkan konfirmasi memakai waktu sampel, bukan jumlah pemanggilan.

## Validasi sebelum penerapan

- 234 tes backend terkait: 1.434 assertion, semuanya lulus. Mencakup akuisisi SNMP, identitas, writer, koordinasi baca, kesehatan sumber, listener, diagnosis optik, GIS dan transisi/antrean baru.
- Pratinjau di VPS sebagai pengguna `www-data`, dengan transaksi PostgreSQL READ ONLY dan rollback: 1.068 node diperiksa; tidak ada perbedaan bukti ODP antara GIS dan detektor, dan ID kandidat segmen identik.
- Pada pratinjau awal 15.35 WIB: 85 rute, 1 terhubung ke dua node, 84 belum lengkap; tidak ada kandidat segmen yang memenuhi bukti. Dari 19 ODP dengan bukti seluruh Rx N/A, satu memenuhi ambang alarm massal minimal dua pelanggan. Angka dapat berubah saat telemetry berjalan.
- Pratinjau tidak memasang berkas aplikasi, mengirim notifikasi atau melakukan pembacaan perangkat. Seluruh sintaks PHP calon rilis diperiksa pada VPS.
- Frontend tidak diubah; tes kontrak tampilan GIS dijalankan terpisah. Sembilan tes kontrak tampilan GIS lulus. Aset web produksi dipertahankan.

## Catatan pelestarian produksi

`NetworkNodeController` dan `TelegramService` mempunyai penambahan maintenance yang sudah berjalan di VPS tetapi belum identik dengan GitHub sebelum tahap ini. Salinan produksi keduanya disimpan dan dicocokkan hash. Penambahan tersebut dipertahankan saat menyiapkan riwayat GitHub dan paket rilis; perubahan fondasi ditinjau terhadap baseline produksi tersendiri.

## Batas dan tahap berikutnya

Status transisi saat ini tersimpan di Redis dan pengiriman memakai antrean FONA. Ini belum menggantikan tabel insiden/outbox permanen atau menjamin pengiriman eksternal tepat sekali ketika terjadi kegagalan proses pada saat yang kritis. Fondasi berikutnya adalah insiden permanen, idempotensi tiket, API/token integrasi terbatas, pencatatan pengiriman per penerima, lalu pemasangan dan workflow n8n.

Diagnosis mengikuti kecepatan sampel OLT dan tahap konfirmasi; bukan jaminan latensi subdetik. Bukti N/A tidak menentukan penyebab pasti kabel putus. Cakupan perkiraan segmen tetap bergantung pada validasi hubungan fisik kabel-node.

## Penerapan dan rollback

Perbarui GitHub terlebih dahulu, lalu cadangkan database, aplikasi, konfigurasi layanan dan crontab sebelum penggantian. Paket ini tidak memerlukan migrasi atau perubahan data pelanggan. Hentikan singkat proses lama yang memuat kode terkait, pasang berkas secara atomik, hidupkan kembali proses, lalu periksa heartbeat, soket alarm, penjadwal tunggal, layanan web dan kemajuan waktu telemetri.

Rollback mengembalikan hanya target aplikasi dan crontab yang dicadangkan, dengan pemeriksaan hash untuk mencegah penimpaan perubahan baru. Database tidak dipulihkan untuk rollback kode karena tahap ini tidak memigrasikan atau mengubah data pelanggan.
