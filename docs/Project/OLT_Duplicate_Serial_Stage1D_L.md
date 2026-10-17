# Pemilihan redaman untuk SN ganda — 17 Oktober 2026

Pemeriksaan langsung pada OLT 1 pukul 16:11 WIB menemukan SN ZTEGD461F38E di 1/2/3:12 dengan state 3 dan Rx -22,15 dBm. Lokasi 1/4/7:2 masih tercantum pada tabel serial sekunder, tetapi state dan Rx bernilai 65535. Database juga memiliki dua registrasi pelanggan dengan SN tersebut. Nilai ini adalah hasil pemeriksaan saat itu dan bukan nilai tetap untuk produksi.

Penyebab: pemetaan identitas versi 2 menghapus semua lokasi ketika satu SN muncul lebih dari sekali. Akibatnya, data redaman yang valid ikut hilang sebelum proses pembacaan ditampilkan.

Perubahan:

- Cache identitas versi 3 mempertahankan setiap pasangan PON dan ID ONU. Kontradiksi serial primer/sekunder pada lokasi yang sama tetap ditolak.
- Untuk SN dengan beberapa lokasi, pilih hanya jika tepat satu lokasi memiliki state Online dan Rx valid yang masih baru. Bukti identitas dan sampel semua kandidat harus masih baru. Nol atau lebih dari satu kandidat dengan Rx valid tetap belum dapat dipastikan.
- Simpan bukti lokasi ganda secara terpisah pada snapshot. Pembacaan halaman, partisi berulang, diagnostik, dan pembaruan berikutnya tetap mempertimbangkan lokasi pesaing. Ledger tidak boleh memulihkan pemenang lama setelah konflik baru terkonfirmasi.
- Kunci inventaris mencakup PON dan ID ONU, termasuk dua ID pada PON yang sama.
- Pembacaan langsung untuk permintaan SN berulang cukup memakai satu lokasi yang sudah dipilih dan tetap mengonfirmasi serial perangkat.
- Tampilkan keterangan SN ganda dan lokasi yang memiliki redaman valid. Ini adalah pembacaan perangkat berdasarkan SN; kepemilikan di antara dua pelanggan belum ditetapkan otomatis.
- Penulisan status/redaman ke registrasi pelanggan tetap diblokir jika lebih dari satu registrasi cocok pada OLT yang sama. Tidak ada penghapusan atau pemindahan pelanggan otomatis, tidak ada perubahan konfigurasi OLT.
- Pembaruan web berkala tetap mengambil data tersimpan. Pemilihan tidak menggabungkan serial dari OLT berbeda. Kebijakan tampilan N/A sebagai Offline tetap berlaku.

Validasi sebelum penerapan mencakup kasus perangkat aktif dan lokasi lama tanpa data, dua lokasi aktif, sampel kedaluwarsa, dua ID ONU pada PON yang sama, isolasi OLT, partisi berulang, perlindungan registrasi pelanggan, dan pembatalan ledger saat konflik baru muncul. Penerapan memerlukan restart terkontrol poller dan listener agar proses lama memakai kelas yang baru, setelah pencadangan diverifikasi.
