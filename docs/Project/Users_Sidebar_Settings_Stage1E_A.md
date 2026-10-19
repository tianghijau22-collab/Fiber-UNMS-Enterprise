# Pengaturan sidebar melalui halaman Users

Super Administrator dapat mengatur urutan sidebar melalui tab **Pengaturan Akses & Sidebar** pada halaman Users. Geser pegangan menu atau gunakan tombol naik/turun, lalu klik **Simpan Pengaturan**. Urutan disimpan secara global dan setiap pengguna tetap hanya melihat halaman yang diizinkan untuk perannya.

Kolom **Super Admin — Tampilkan Menu** mengatur visibilitas sidebar untuk seluruh akun Super Administrator. Menyembunyikan menu tidak membatasi akses halaman atau API. Pintasan **Atur Menu Sidebar** selalu tersedia untuk membuka kembali pengaturan, termasuk ketika menu Users disembunyikan.

Daftar memuat 23 menu halaman dan blok **Daftar Wilayah OLT**. Blok wilayah dapat dipindahkan sebagai satu kesatuan dan mengikuti izin halaman Wilayah / OLT Region. Pencarian dan filter kategori tetap tersedia; perubahan urutan dinonaktifkan saat daftar difilter agar posisi tujuan tidak ambigu.

## Penyimpanan dan pemulihan

- Perubahan tetap berupa draf sampai disimpan. **Batalkan Perubahan** memuat ulang pengaturan tersimpan.
- **Urutan Bawaan** mengembalikan draf urutan tanpa mengubah visibilitas atau izin peran.
- **Reset ke Default** mengembalikan izin peran ke bawaan dan membuang draf; urutan serta visibilitas sidebar yang sudah tersimpan dipertahankan.
- Penyimpanan menggunakan versi pengaturan dan transaksi database. Jika administrator lain sudah menyimpan perubahan, server mengembalikan konflik dan draf tetap tersedia. Pengguna dapat mencatat draf lalu membatalkannya untuk memuat versi terbaru.
- Perubahan dicatat pada audit lokal dalam transaksi yang sama. Kegagalan audit membatalkan penulisan pengaturan.
- Draf dilindungi saat penyegaran data dan saat menutup atau memuat ulang browser. Navigasi internal aplikasi belum memiliki dialog pencegah kehilangan draf; simpan sebelum berpindah halaman.

## Integrasi

Preferensi tersimpan terpisah dari RBAC pada tabel system_settings yang sudah ada, tanpa migrasi baru. Katalog ID menu dibagikan antara PHP dan JavaScript. Menu baru yang belum ada dalam preferensi ditambahkan ke urutan bawaan; ID usang diabaikan saat pembacaan dan ditolak saat penyimpanan.

Sidebar mengambil pengaturan terbaru saat aplikasi kembali aktif, melalui pemberitahuan antar-tab, dan pemeriksaan ringan setiap 60 detik. Pemeriksaan ini hanya membaca pengaturan tersimpan dan tidak memicu pembacaan OLT. Draf editor tidak diganti diam-diam oleh pemeriksaan latar belakang.

## Validasi

Pengujian mencakup normalisasi dan perpindahan urutan, visibilitas khusus Super Administrator, akses penuh administrator, penolakan penulisan oleh peran lain, validasi katalog, konflik versi, kompatibilitas penyimpanan lama, reset, serta pembatalan transaksi ketika audit gagal. Pratinjau browser menggunakan data contoh dan komponen aplikasi yang sebenarnya. Cadangan dan bukti operasional disimpan secara privat di luar kode yang dipublikasikan.
