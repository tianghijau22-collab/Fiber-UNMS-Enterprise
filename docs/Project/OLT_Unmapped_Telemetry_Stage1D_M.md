# Redaman pelanggan tanpa ODP — tahap 1D-M, 17 Oktober 2026

Pemeriksaan pukul 16:34 WIB menemukan bahwa redaman ZTEGD5D2B427 (1/6/11:1, -21,67 dBm) dan ZTEGCF04E8D2 (1/6/7:11, -23,77 dBm) sudah tersedia pada snapshot OLT ZTE C300 Kota Solok. Halaman pelanggan menghasilkan `olt_unmapped` karena kedua layanan tidak memiliki port ODP maupun port registrasi yang menetapkan OLT.

Ini berbeda dari penghapusan identitas SN ganda pada tahap 1D-L. Dari 1.735 layanan yang diperiksa, 35 tidak mempunyai pengaitan ODP/OLT; pada snapshot tersebut 30 memiliki Rx valid yang tidak ditampilkan dan 5 belum memiliki Rx valid.

Perbaikan menggunakan indeks serial tabel perangkat yang sudah tersimpan untuk kebutuhan tampilan saja. Ketika tidak ada OLT yang ditetapkan melalui topologi, SN yang terverifikasi pada tepat satu OLT aktif dapat memilih data snapshot yang masih baru. Semua alias perangkat yang dikenal harus konsisten dengan satu lokasi. Serial pada beberapa OLT, konflik beberapa lokasi, sampel/identitas kedaluwarsa, perangkat nonaktif/demo, dan data tanpa asal tabel serial tidak memilih OLT secara otomatis.

Pengaitan OLT yang sudah ditetapkan tetap diprioritaskan. Port registrasi dipakai sebagai konteks eksplisit bila port layanan tidak ada. Tidak ada perubahan ODP, registrasi, status database pelanggan, konfigurasi perangkat, atau jalur penulisan telemetri. N/A tidak diisi dengan nilai lama/dugaan. Antarmuka memberi keterangan OLT terdeteksi dari SN dan topologi belum terhubung.

Pembacaan ini menggunakan indeks yang dibentuk sekali dari snapshot per permintaan, tidak melakukan SNMP maupun koneksi OLT tambahan, dan mempertahankan waktu sampel asli. Pemutakhiran berkala yang sudah diterapkan tetap membaca data tersimpan.
