# Konsistensi marker GIS dan N/A pada ODP 451

## Temuan terkonfirmasi

Pemeriksaan baca-saja pada 18 Oktober 2026 pukul 16:14:04 WIB menunjukkan ODP 451 (node 517) memiliki tujuh pelanggan: enam ONU dengan identitas dan sampel terbaru tetapi Rx tidak tersedia, serta satu ONU dengan SN ganda yang belum terverifikasi. Port kedelapan kosong. Backend GIS mengirim `best_rx_power`, `worst_rx_power`, dan `optical_power_dbm` bernilai null; teksnya `N/A (1 belum terverifikasi)`.

Terdapat tiga celah tampilan:

1. Pemformat marker mengekstrak angka dari teks keterangan. Angka **1** pada **1 belum terverifikasi** ditampilkan sebagai **1,0 dBm**, padahal tidak ada pengukuran Rx tersebut.
2. Gambar SVG dan indikator status memakai warna hijau bawaan ketika data belum terverifikasi, meskipun status logis marker sudah abu-abu.
3. Kriteria merah sebelumnya hanya menerima seluruh ONU terverifikasi. Campuran enam N/A terbaru dan satu SN ganda masuk kategori belum lengkap, sehingga belum memenuhi tampilan merah yang diminta pengguna.

## Perbaikan

Nilai optik untuk marker, popup, detail GIS, daftar node, dan pilihan node di lokasi yang sama sekarang berasal dari kolom pengukuran numerik. Teks penjelasan, jumlah pelanggan, nomor port, dan alamat interface tidak diparsing sebagai redaman. Data optik yang tidak tersedia tetap **N/A**; bukti kedaluwarsa tidak menampilkan angka optik lama sebagai pembacaan terbaru.

ODP dengan seluruh Rx yang ditampilkan N/A dan ada pembacaan N/A terbaru ditandai merah, termasuk bila beberapa identitas masih belum terverifikasi. Keterangan kasus ODP 451: **Seluruh Rx N/A · 1 ONU belum terverifikasi**. Marker berlabel **N/A**. Port kosong tidak dihitung sebagai pelanggan. Tanpa pembacaan N/A terbaru yang mendukung, atau setelah bukti kedaluwarsa, marker tetap abu-abu. Nilai Rx valid yang kembali tersedia mengakhiri tampilan seluruh N/A sesuai data terbaru.

Warna SVG, indikator, bingkai, dan label diuji pada tema terang/gelap. Ringkasan memakai istilah gangguan optik agar tampilan N/A yang belum lengkap tidak dinyatakan sebagai kepastian semua perangkat kehilangan sinyal fisik.

Penandaan merah ini merupakan kondisi tampilan data; bukti backend untuk perkiraan segmen kabel tetap memakai aturan ketat sebelumnya. ODP dengan identitas belum terverifikasi tidak dipromosikan menjadi bukti putus kabel. SN ganda tidak dipilih ulang, dipindah, dihapus, atau dianggap selesai dengan perubahan ini.

## Batas cakupan

Hanya tiga berkas frontend GIS yang diubah. Tidak ada perubahan backend, nilai redaman asli, kepemilikan ONU, topologi, pembacaan OLT, siklus polling, VPN, atau pengunci. Kondisi produksi dapat berubah setelah waktu pemeriksaan; warna mengikuti pembaruan tersimpan dan masa berlaku bukti.
