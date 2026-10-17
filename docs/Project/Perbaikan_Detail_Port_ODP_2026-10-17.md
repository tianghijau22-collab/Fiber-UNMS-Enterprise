# Perbaikan detail port ODP — 17 Oktober 2026

## Masalah dan bukti

Setelah koordinasi pembacaan OLT diterapkan, `NetworkNodeController::portDetail` masih menganggap pembacaan langsung sebagai syarat untuk mengirim data port. Ketika polling memegang OLT, `OltReadBusy` keluar sebagai HTTP 423 sebelum kueri port dijalankan. Tampilan menangkap semua kegagalan, mengosongkan data, lalu menulis “Data port tidak ditemukan. Coba refresh.”

Pada VPS pukul 15:05 WIB, ODP 1 (node 12) memiliki delapan port. Jalur `skip_live=1` mengembalikan semuanya, sedangkan permintaan biasa saat polling menghasilkan `olt_busy`/423. Snapshot tidak berubah. Audit jumlah port mencakup 1.034 ODP aktif dalam arti belum dihapus; seluruh jumlah port fisik sesuai `total_ports`. Ini regresi penanganan pembacaan tertunda, bukan bukti port pelanggan hilang.

## Perubahan

- Detail port tetap HTTP 200 dengan data port tersimpan jika pengayaan langsung tertunda atau gagal. `live_probe.success=false` dan `reason_code` menerangkan kondisi tersebut. Tidak dibuat waktu sampel baru atau status hardware hasil tebakan.
- Kesalahan pembacaan langsung yang tidak terduga tetap dilaporkan di server; rincian internal tidak dikirim kepada pengguna. Kegagalan kueri data utama tetap diperlakukan sebagai kegagalan, bukan port kosong.
- Tampilan mempertahankan data yang sudah dimuat bila refresh gagal. Permintaan gagal dan daftar port yang benar-benar kosong memiliki pesan berbeda. Respons lama tidak boleh menimpa ODP yang baru dibuka atau modal yang sudah ditutup.
- Penguncian pembacaan OLT tetap berlaku. Tidak ada migrasi atau perubahan port, pemetaan pelanggan, algoritme redaman, maupun kebijakan web N/A → Offline.

## Klarifikasi redaman dari pengguna

Pengguna menegaskan bahwa redaman saat ini akurat, dan N/A dapat sesuai dengan ONU mati atau kabel pelanggan putus. Nilai kosong sendiri tidak menjadi dasar menyimpulkan pembacaan OLT salah. Investigasi berikutnya harus berangkat dari selisih yang terverifikasi, bukan semua ONU N/A.

## Validasi sebelum penerapan

- 215 pengujian backend / 2.142 assertion lulus, termasuk pembacaan ODP ketika proses lain benar-benar memegang OLT, pembukaan awal, refresh, koordinasi tidak tersedia, serta pengecualian pengayaan langsung.
- 34 pengujian frontend lulus, termasuk delapan port dengan live probe sibuk, respons HTTP gagal, format tidak valid, ODP tidak cocok, dan daftar kosong yang sah.
- Build produksi berhasil. 77 input tampilan lain telah dicocokkan dengan VPS; perubahan merek yang sudah ada dipertahankan.

Penerapan mengikuti urutan GitHub → cadangan baru terverifikasi → VPS. Hasil pascapenerapan dicatat terpisah. Pengujian otomatis dan pemeriksaan API tidak menggantikan konfirmasi visual dari sesi login pengguna.
