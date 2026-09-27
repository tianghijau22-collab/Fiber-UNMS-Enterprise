# Fiber-UNMS Mobile App (Flutter)

Aplikasi mobile untuk **Fiber-UNMS Enterprise**, dirancang khusus untuk teknisi lapangan, operator NOC, dan manajemen untuk monitoring jaringan, manajemen tiket, diagnostik redaman optik OLT/ODP, dan penanganan pelanggan secara *real-time*.

---

## 🚀 Fitur Utama

1. **Autentikasi Terpusat (Single Account)**
   - Login menggunakan akun (Username / Email / No HP & Password) yang sama dengan sistem web Fiber-UNMS.
   - Sesi tersimpan aman menggunakan enkripsi hardware (`flutter_secure_storage`).
   - Dynamic Server Configuration (dapat mengganti IP/Domain server backend langsung dari aplikasi).

2. **Dashboard & Alert Jaringan**
   - Ringkasan status perangkat (OLT, ONT Online/Offline, Titik ODP, Tiket Aktif).
   - Feed notifikasi gangguan kritis secara langsung (*real-time alert stream*).

3. **Manajemen Tiket Lapangan (Field Tickets)**
   - Filter tiket (*Open, In Progress, Selesai*).
   - Detail pengerjaan tiket & kontak pelanggan (bisa langsung ditelepon dari HP).
   - Form update progress & upload foto bukti penanganan via kamera HP.

4. **Pengecekan Redaman ODP (Optical Power Meter)**
   - Input hasil ukur redaman OPM (dBm) per port ODP.
   - Auto-tagging koordinat GPS akurat dari satelit HP teknisi.
   - Foto dokumentasi fisik ODP & layar alat ukur OPM.

5. **Scanner Barcode/QR & Diagnostik Sinyal ONT**
   - Scan barcode SN / MAC address ONU langsung menggunakan kamera HP.
   - Baca telemetri sinyal optik *live* dari OLT (`Rx/Tx dBm`).
   - Fitur **Swap ONU / Ganti Modem** pelanggan di lapangan secara instan.

---

## 🛠️ Persyaratan Lingkungan (Prerequisites)

- **Flutter SDK**: `>= 3.0.0`
- **Android Studio / VS Code** (dengan Flutter & Dart Extensions)
- **Backend Fiber-UNMS**: Berjalan pada port 8000 (`php artisan serve`)

---

## 📦 Menjalankan Aplikasi

1. Buka terminal dan masuk ke folder `mobile_app`:
   ```bash
   cd mobile_app
   ```

2. Unduh paket dependensi:
   ```bash
   flutter pub get
   ```

3. Jalankan aplikasi pada emulator atau perangkat HP:
   ```bash
   flutter run
   ```

---

## 🌐 Konfigurasi Koneksi Server

- **Android Emulator**: `http://10.0.2.2:8000/api`
- **Perangkat Fisik HP (via WiFi/LAN)**: `http://<IP-KOMPUTER-ANDA>:8000/api` (Contoh: `http://192.168.1.15:8000/api`)
- **Server Produksi**: `https://unms.perusahaan-anda.com/api`

*(Pengaturan URL dapat diubah langsung dari tombol Pengaturan di pojok kanan atas Layar Login).*
