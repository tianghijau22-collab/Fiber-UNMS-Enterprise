# Registrasi pelanggan dan rekonsiliasi inventaris OLT

## Registrasi dari halaman OLT

Tombol Registrasikan pada ONU Fisik Terdeteksi membuka formulir di halaman OLT. Super Administrator dan Operator Jaringan yang memiliki akses tulis halaman OLT dapat membuat pelanggan baru dengan ID, nama, telepon, alamat, ODP dan port kosong. ODP harus memiliki kepemilikan pada OLT yang dipilih. SN, interface, serta nomor ONU diambil dari baris perangkat dan diperiksa ulang pada server terhadap identitas tersimpan yang masih baru.

Registrasi ini membuat hubungan pelanggan di FONA. Konfigurasi atau otorisasi layanan pada perangkat OLT tetap merupakan proses tersendiri. Formulir tidak mengirim perintah konfigurasi, pembacaan SNMP langsung, atau redaman manual. Registrasi administratif baru memiliki redaman kosong sampai pengamatan perangkat tersedia. Tampilan memakai data tersimpan dari OLT. Setelah berhasil, daftar diperbarui tanpa navigasi ke Customers. ID yang sudah ada atau SN yang sudah terikat diarahkan untuk pemeriksaan melalui pratinjau impor, tanpa membuat duplikat diam-diam.

Formulir langsung ini memerlukan ODP dan port kosong. Pelanggan tanpa ODP tetap dapat ditambahkan melalui pratinjau Tarik Data Pelanggan; hubungan ODP dapat dilengkapi kemudian.

## Data Terputus / Tidak di OLT

Daftar ini menjadi pemeriksaan ketidaksesuaian, dengan alasan per baris: SN tidak valid, SN dipakai beberapa layanan, identitas lokasi bertentangan, pemilik topologi bertentangan, SN terdeteksi pada OLT lain, tidak ditemukan pada inventaris lengkap, atau inventaris belum cukup terverifikasi. Semua registrasi tetap tersedia di daftar pelanggan terdaftar; diagnosis tidak menghapus data.

Rx N/A tidak membuktikan registrasi hilang. Identitas yang terdeteksi tetap dianggap ada meskipun perangkat offline atau Rx tidak tersedia. Konfirmasi ketiadaan membutuhkan cache serial SNMP berformat benar, usia maksimal sepuluh menit, dan metadata pembacaan lengkap yang berhasil pada waktu observasi yang sama. Bukti identitas positif yang lebih baru tetap dipertimbangkan. Inventaris gagal atau usang menghasilkan status belum terverifikasi. Ruang lingkup registrasi mengikuti pemilik node melalui leluhur topologi.

Pembersihan tetap memerlukan tindakan manual Super Administrator dan pemeriksaan ulang inventaris pada server. SN ganda, identitas ambigu, serta inventaris belum terverifikasi tidak boleh dibersihkan melalui daftar ini. Dialog menerangkan bahwa layanan akan ditandai berhenti dan port dibebaskan; akun pelanggan tetap tersimpan. Cache tampilan terkait dibatalkan setelah perubahan berhasil. Tidak ada penghapusan otomatis.

## Tarik Data Pelanggan

Pembaca HTML menggunakan judul kolom pada tabel pelanggan, bukan posisi tetap semua tabel. Respons login atau tabel yang tidak dikenali ditolak. Jumlah baris sumber, hasil parse, baris ditolak, dan duplikat identik ditampilkan agar kegagalan tidak tersembunyi. Nilai Rx eksternal tidak ditulis sebagai telemetri.

ID pelanggan dinormalisasi secara konsisten: CMN77, CMN 0077, dan 77 adalah identitas yang sama. ID nonstandar tetap dipertahankan. Pencocokan ODP memakai nomor lengkap termasuk akhiran, sehingga ODP 69 berbeda dari ODP 69-02. Kecocokan yang tidak unik atau tidak tersedia memerlukan pilihan manual.

Pelanggan yang sudah ada dapat menggunakan **Lengkapi Data Kosong**. Pratinjau menyebutkan bagian yang akan dilengkapi dan membawa versi data untuk menolak perubahan yang sudah usang. Nama, alamat, SN, dan hubungan ODP yang sudah terisi tidak ditimpa. Perbedaan SN atau ODP ditandai untuk pemeriksaan manual. Pelanggan tanpa hubungan ODP dapat dipilihkan ODP secara manual; registrasi yang sudah memiliki pemilik OLT tidak dipindahkan lintas OLT otomatis. ID arsip dan ID ganda hasil normalisasi tidak dibuat ulang otomatis.

Penyimpanan menggunakan transaksi dan pencatatan audit lokal. Port terisi, perbedaan versi, atau kegagalan audit membatalkan seluruh penulisan baris. Tidak ada SN, redaman, status online atau waktu online buatan. Impor pilihan berjalan per baris dan menampilkan jumlah berhasil/gagal yang sebenarnya; baris gagal tetap dapat diperiksa dan dicoba kembali.

## Batas penerapan dan validasi

Tidak ada migrasi database baru, pembacaan OLT tambahan saat registrasi/impor, ataupun perubahan kredensial jaringan. Diagnosis HTTP dihitung ulang dari inventaris tersimpan sehingga tidak bergantung pada kategori lama yang disimpan worker. Pengujian memakai database dalam memori dan pratinjau browser dengan data contoh; pemeriksaan produksi dilakukan secara baca-saja. Data pelanggan aktual tidak diimpor atau diubah oleh proses pemasangan fitur. Bukti operasional dan data hasil pemeriksaan tetap disimpan secara privat.
