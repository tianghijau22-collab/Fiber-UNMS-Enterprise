# Redaman pelanggan tanpa ODP — hasil pemeriksaan dan penerapan

**Waktu:** 17 Oktober 2026, sekitar 16:43 WIB. **Kode aplikasi:** `819e6ebf621de68adaa7f0c36fdc13462345a6d7`. **VPS:** 103.89.6.125.

## Penyebab kedua contoh

Kasus ini berbeda dari masalah SN ganda tahap 1D-L. Kedua SN sudah memiliki identitas dan redaman valid pada snapshot FONA. Layanan pelanggan tidak mempunyai port ODP maupun port registrasi yang menetapkan OLT. Pembacaan pelanggan sebelumnya bergantung pada konteks topologi tersebut sehingga menghasilkan `olt_unmapped`, tanpa interface maupun redaman, meskipun data perangkat tersedia.

| Pelanggan | SN | Lokasi perangkat | Rx verifikasi akhir |
|---|---|---|---:|
| CMN 5942 | ZTEGD5D2B427 | gpon-olt_1/6/11:1 | -21.67 dBm |
| CMN 3157 | ZTEGCF04E8D2 | gpon-olt_1/6/7:11 | -23.77 dBm |

Kedua sampel berasal dari poller normal, waktu **16:42:42 WIB**. Perubahan kecil nilai dibanding tangkapan layar atau pemeriksaan sebelumnya adalah perbedaan waktu sampel. Tidak ada angka yang disalin dari gambar atau diberi waktu baru secara buatan.

## Cakupan dan hasil

- Semua **1.735 layanan** diperiksa; **35** tidak memiliki konteks OLT melalui ODP/port registrasi.
- Setelah perbaikan, seluruh 35 dapat mengenali OLT dari bukti serial perangkat yang unik dan masih baru; **30** memiliki Rx valid yang kini dapat ditampilkan, **5** belum memiliki Rx valid pada snapshot tersebut.
- Dua contoh konsisten pada **daftar pelanggan, diagnostik pelanggan, modal redaman, dan snapshot sumber**: nilai, interface, ID ONU, serta waktu sampelnya sama.
- Tidak tersisa kasus dalam pemeriksaan ini ketika Rx tersedia di OLT yang sesuai cakupan pelanggan tetapi disembunyikan oleh pengaitan yang belum ada. Ini bukan pernyataan bahwa semua N/A telah selesai atau semua OLT selalu menyediakan Rx.

## Perubahan

Jika pengaitan topologi tidak menyediakan OLT, pembacaan tampilan mencari SN dari tabel serial perangkat pada snapshot OLT aktif. Hanya satu OLT dengan identitas/sampel valid dan masih baru yang boleh dipilih. Semua alias perangkat yang diketahui harus menunjuk lokasi yang sama. Konflik antar-OLT maupun lokasi tidak memilih data pertama atau sinyal terkuat. Pengaitan OLT eksplisit tetap diprioritaskan; port registrasi dapat memberi konteks bila port layanan tidak ada.

Antarmuka memberi keterangan **OLT terdeteksi dari SN · topologi belum terhubung**. ODP tetap **Tanpa ODP** sampai pengaitan administratif diisi. Tidak ada pembuatan/pemindahan ODP, pengubahan registrasi/status database pelanggan, penghapusan data, perubahan konfigurasi OLT, maupun perubahan jalur penulisan telemetri.

Pembaruan berkala tetap mengambil snapshot. Pemilihan menggunakan indeks sekali per permintaan, tidak menambah pembacaan OLT atau mengubah waktu pengamatan. Kebijakan tampilan N/A sebagai Offline yang dipilih pengguna tetap dipertahankan; state asli perangkat tetap disimpan terpisah.

## Sisa N/A: jangan disamakan dengan satu penyebab

Pemeriksaan seluruh layanan pukul 16:43 WIB masih menemukan kategori berikut. Ini jumlah layanan pada satu snapshot; angka dapat berubah antar-siklus.

| Kategori pembacaan | Jumlah layanan |
|---|---:|
| State Online tetapi Rx belum tersedia | 137 |
| State perangkat belum tersedia | 52 |
| Identitas belum terverifikasi pada OLT yang ditetapkan | 30 |
| Identitas memiliki konflik | 4 |

Jumlah di atas **bukan jumlah kegagalan pengambilan yang telah dibuktikan**. Khusus tiga contoh state Online/Rx kosong, pemeriksaan SNMP langsung yang terkoordinasi berhasil mendapatkan serial yang sesuai dan respons lengkap, tetapi OLT mengembalikan **raw Rx 65535**, bukan nilai redaman valid:

| SN | Lokasi | State SNMP | Raw Rx |
|---|---|---:|---:|
| ZTEGD1AAF636 | gpon-olt_1/3/5:17 | 3 | 65535 |
| ZTEGD6D9BC79 | gpon-olt_1/6/11:25 | 3 | 65535 |
| ZTEGC9FC8D36 | gpon-olt_1/5/1:18 | 3 | 65535 |

Untuk ketiga contoh itu, nilai kosong tidak berasal dari pemilihan ODP maupun respons SNMP yang terpotong saat pemeriksaan langsung. Penyebab OLT mengembalikan nilai tersebut—misalnya perbedaan pembacaan melalui CLI dan SNMP—belum dipastikan. Membandingkan CLI untuk tuple yang sama diperlukan sebelum memilih metode pengambilan alternatif. Kesimpulan dari tiga contoh ini tidak diperluas ke seluruh kategori Rx kosong. Tidak diisi angka dugaan dan tidak disimpulkan perangkat pasti mati hanya dari Rx kosong.

## Tiga benturan pengaitan yang perlu ditinjau

Tiga layanan memiliki Rx valid pada OLT lain, sedangkan topologinya menetapkan OLT berikut. Dua SN juga masih terlihat pada OLT yang ditetapkan. Karena itu, bukti ini tidak cukup untuk memindahkan pelanggan otomatis.

| Pelanggan | SN | OLT pada topologi | OLT dengan Rx valid | Lokasi dengan Rx valid |
|---|---|---:|---:|---|
| CMN2939 | ZTEGD1AD0D1B | 2 | 1 | gpon-olt_1/2/4:21 |
| CMN 7395 | ZTEGC13108B2 | 1 | 2 | gpon-olt_1/1/15:21 |
| CMN 8847 | ZTEGCAFFEE6E | 1 | 3 | gpon-olt_1/1/1:2 |

OLT 1: ZTE C300 Kota Solok; OLT 2: C320 CINOX Guguak; OLT 3: C320 CINOX Singkarak. Benturan ini dicatat terpisah dan pengaitan eksplisitnya dipertahankan. Penertiban perlu memastikan layanan/perangkat yang benar, terutama SN yang dipakai ulang di lebih dari satu OLT.

Lima layanan tanpa ODP yang masih N/A pada snapshot akhir: CMN 7841, CMN 7597, CMN 8397, CMN 7377, dan CMN 4640. Empat memiliki state Online/Rx belum tersedia dan satu state belum tersedia. Pengaitan tampilannya sudah ditemukan; ketiadaan nilai Rx pada kelompok ini tidak lagi disebabkan ketiadaan ODP.

## Validasi dan penerapan

- **240 pengujian backend / 2.323 assertion**, **38 pengujian frontend**, dan **12 skenario render server** lulus. Render server bukan pemeriksaan visual browser.
- Build produksi lulus, 54 aset dipaketkan, 43 JS/CSS diuji melalui HTTPS dan cocok dengan checksum paket.
- Pemeriksaan seluruh layanan dan kedua contoh dilakukan dalam transaksi baca-saja. **0 panggilan SNMP/driver langsung dari halaman, 0 perubahan database**; snapshot, port/topologi, serta registrasi tetap identik dalam transaksi. Tiga probe langsung tambahan di atas merupakan diagnostik terpisah, memakai penguncian OLT, bukan pemutakhiran halaman.
- Halaman publik memberikan HTTP 200; endpoint terlindungi tetap 401 tanpa autentikasi. Tidak ditemukan ERROR/CRITICAL/ALERT/EMERGENCY aplikasi atau kesalahan paket listener baru dalam jendela verifikasi.
- Poller, listener, dan pelindung alarm aktif. PID poller/listener tetap sama, tanpa penghentian atau restart pada tahap ini. Hanya layanan web dimuat ulang. Socket alarm 162/514 tetap aktif.
- GitHub diperbarui sebelum pencadangan dan penerapan; cadangan diverifikasi sebelum perubahan aplikasi. Tidak ada migrasi database, penghapusan sesi login, atau perubahan VPN/firewall/konfigurasi.

## Cadangan

Direktori privat: `/var/backups/fona/stage1dm-20261017T094144Z`.

| Berkas | Ukuran | SHA-256 |
|---|---:|---|
| database.dump | 9,506,830 byte | `c1ba0201c6c461dfb7b1df414e4a52a3ebb7e0faa3642b3065d75a3f770f7bdd` |
| application.tar.gz | 8,253,186 byte | `fba43f10b097be7838566eac9c989b6595ff23f20de521480d96556082e12702` |
| system-configuration.tar.gz | 732 byte | `ccd8cbcd39fa406018259261e02ec1dca6c9b1bb7f350a5d0e32af5e108fecbb` |

Arsip database diuji dengan pg_restore, dan arsip aplikasi beserta checksum diperiksa sebelum pemasangan. APK tidak dibangun ulang. Temuan transport F21 dan perilaku APK F22 dari audit sebelumnya tetap terpisah. Perbaikan ini menangani pemilihan tampilan pelanggan tanpa ODP; tidak menyatakan seluruh masalah penyediaan Rx dari perangkat sudah selesai.


## Pembaruan bukti CLI dari pengguna — 17 Oktober 2026

Pengguna menjalankan perintah pada prompt `OLTZTEC300-CINOXMEDIANET` dan mengirim keluaran berikut. Waktu eksekusi CLI tidak dicantumkan, sehingga hasil ini tidak diperlakukan sebagai pengukuran serentak dengan pemeriksaan SNMP pukul 16:40 WIB.

| SN pada pemeriksaan SNMP sebelumnya | Perintah CLI yang dikirim pengguna | Hasil CLI |
|---|---|---|
| ZTEGD1AAF636 | `show pon power onu-rx gpon-onu_1/3/5:17` | N/A |
| ZTEGD6D9BC79 | `show pon power onu-rx gpon-onu_1/6/11:25` | N/A |
| ZTEGC9FC8D36 | `show pon power onu-rx gpon-onu_1/5/1:18` | N/A |

Untuk ketiga lokasi tersebut, hasil CLI yang dikirim sesuai dengan ketiadaan Rx valid pada pemeriksaan SNMP sebelumnya (raw Rx 65535). Tidak ditemukan perbedaan berupa CLI menampilkan angka sedangkan FONA/SNMP menghilangkannya pada tiga contoh ini. Tidak ada dasar dari bukti ini untuk memaksa nilai Rx atau mengubah konversi sentinel menjadi angka redaman.

Kesimpulan ini hanya mencakup tiga lokasi, bukan seluruh 137 layanan pada snapshot sebelumnya. State Online yang pernah diterima melalui SNMP dan keluaran Rx N/A merupakan dua informasi berbeda. Keduanya belum menentukan penyebab fisik maupun membuktikan waktu status Online dan pembacaan CLI sama. Penelusuran berikutnya perlu memeriksa status operasional/phase ONU, alasan down terakhir, dan waktu pengamatan pada lokasi yang sama. Kebijakan tampilan N/A sebagai Offline tetap sesuai pilihan pengguna; tidak ada perubahan aplikasi, konfigurasi OLT, atau status database pada pembaruan laporan ini.
