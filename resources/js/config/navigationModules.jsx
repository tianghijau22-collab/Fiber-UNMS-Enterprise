import React from 'react';

/**
 * Single Source of Truth untuk seluruh Modul & Rute Navigasi Sistem Fiber UNMS.
 * Menambahkan atau mengubah modul di berkas ini akan otomatis tersinkronisasi ke:
 * 1. Sidebar Navigasi (Sidebar.jsx)
 * 2. Matriks Pengaturan Hak Akses Halaman (UserManagement.jsx)
 * 3. Route Guard & Proteksi Akses (AuthContext.jsx & App.jsx)
 */
export const SYSTEM_NAVIGATION_MODULES = [
  // ── 1. Beranda & Monitoring ──
  {
    name: 'Dashboard',
    path: '/dashboard',
    category: 'Beranda & Monitoring',
    desc: 'Ringkasan metrik ONU, OLT, tiket, status server & overview sistem',
    defaultRoles: ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer', 'Customer Service', 'Finance & Billing'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )
  },
  {
    name: 'Monitoring Server',
    path: '/server-monitoring',
    category: 'Beranda & Monitoring',
    desc: 'CPU/RAM host, background telemetry worker, loop delay & daemon SNMP trap',
    defaultRoles: ['Super Administrator', 'Operator Jaringan'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>
    )
  },
  {
    name: 'Notifikasi Alert Sistem',
    path: '/system-alerts',
    category: 'Beranda & Monitoring',
    desc: 'Feed event real-time, alert telemetri loss, pemulihan online & trap log',
    defaultRoles: ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer', 'Customer Service', 'Finance & Billing'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    )
  },
  {
    name: 'Manajemen Notifikasi',
    path: '/broadcast-notifications',
    category: 'Beranda & Monitoring',
    desc: 'Kirim broadcast Web Push & multi-channel Telegram ke teknisi & user',
    defaultRoles: ['Super Administrator', 'Operator Jaringan'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    )
  },

  // ── 2. Infrastruktur Jaringan & OLT ──
  {
    name: 'OLT',
    path: '/olt-management',
    category: 'Infrastruktur Jaringan & OLT',
    desc: 'Kontrol multi-OLT, sinkronisasi PON, otorisasi ONU & cek redaman optik',
    defaultRoles: ['Super Administrator', 'Operator Jaringan'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    )
  },
  {
    name: 'Bridge',
    path: '/network-bridge-setup',
    category: 'Infrastruktur Jaringan & OLT',
    desc: 'Setup tunnel VPN API MikroTik & konfigurasi gateway remote OLT',
    defaultRoles: ['Super Administrator'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    name: 'Wilayah / OLT Region',
    path: '/network',
    category: 'Infrastruktur Jaringan & OLT',
    desc: 'Hierarki node per kamar wilayah OLT, POP, ODC, & ODP',
    defaultRoles: ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    )
  },
  {
    name: 'Manajemen Redaman BTS',
    path: '/bts-management',
    category: 'Infrastruktur Jaringan & OLT',
    desc: 'Monitoring optical link site BTS, tower, dan power level optik',
    defaultRoles: ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071a10 10 0 0114.142 0M1.394 9.393a15 15 0 0121.213 0" />
      </svg>
    )
  },

  // ── 3. Lapangan & Kabel FO ──
  {
    name: 'Peta',
    path: '/gis-map',
    category: 'Lapangan & Kabel FO',
    desc: 'Peta interaktif Leaflet spasial, rute kabel, search lokasi & ODP',
    defaultRoles: ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    )
  },
  {
    name: 'Manajemen Kabel',
    path: '/cable-management',
    category: 'Lapangan & Kabel FO',
    desc: 'Daftar inventaris kabel master, core count, segmen & jalur fiber',
    defaultRoles: ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    )
  },
  {
    name: 'Pemetaan Rute Kabel',
    path: '/cable-routes',
    category: 'Lapangan & Kabel FO',
    desc: 'Editor interaktif koordinat bentangan rute jalur kabel FO',
    defaultRoles: ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    )
  },
  {
    name: 'Tracing Putus OTDR',
    path: '/otdr-tracing',
    category: 'Lapangan & Kabel FO',
    desc: 'Simulasi dan estimasi titik putus kabel berdasarkan jarak meter OTDR',
    defaultRoles: ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  },
  {
    name: 'Matriks Splicing Core',
    path: '/core-matrix',
    category: 'Lapangan & Kabel FO',
    desc: 'Pemetaan core-to-core, sambungan tray closure & splitter tube',
    defaultRoles: ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
        <path strokeLinecap="round" strokeWidth="2" d="M3 9h18M3 15h18M9 3v18M15 3v18" />
      </svg>
    )
  },
  {
    name: 'Pengecekan ODP & OPM',
    path: '/odp-checks',
    category: 'Lapangan & Kabel FO',
    desc: 'Log pengukuran redaman lapangan teknisi dengan foto watermark GPS',
    defaultRoles: ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
  {
    name: 'Work Order Teknisi',
    path: '/field-tech',
    category: 'Lapangan & Kabel FO',
    desc: 'Penugasan kerja lapangan, perbaikan, instalasi & riwayat tugas',
    defaultRoles: ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    )
  },

  // ── 4. Layanan Pelanggan & Keuangan ──
  {
    name: 'Manajemen Pelanggan',
    path: '/customers',
    category: 'Layanan Pelanggan & Billing',
    desc: 'Data pelanggan CRM, paket langganan, ONU & sinkronisasi SOBOK',
    defaultRoles: ['Super Administrator', 'Operator Jaringan', 'Customer Service', 'Finance & Billing'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  {
    name: 'Tiket & Maintenance',
    path: '/tickets',
    category: 'Layanan Pelanggan & Billing',
    desc: 'Helpdesk pengaduan gangguan pelanggan & eskalasi penugasan teknisi',
    defaultRoles: ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer', 'Customer Service'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 001 1.732V15a2 2 0 00-1 1.732V20a2 2 0 002 2h14a2 2 0 002-2v-3.268A2 2 0 0021 15v-3a2 2 0 00-1-1.732V7a2 2 0 00-2-2H5z" />
      </svg>
    )
  },
  {
    name: 'Inventori',
    path: '/inventory',
    category: 'Layanan Pelanggan & Billing',
    desc: 'Stok barang gudang, ONT, kabel, closure, adapter & perangkat',
    defaultRoles: ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer', 'Finance & Billing'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )
  },

  // ── 5. Administrasi & Keamanan Sistem ──
  {
    name: 'Manajemen User',
    path: '/users',
    category: 'Administrasi Sistem',
    desc: 'Kelola akun staf, kontrol RBAC dinamis & izin akses halaman',
    defaultRoles: ['Super Administrator'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )
  },
  {
    name: 'Audit Logs & Security',
    path: '/audit-logs',
    category: 'Administrasi Sistem',
    desc: 'Rekaman jejak aktivitas pengguna & audit trail keamanan sistem',
    defaultRoles: ['Super Administrator', 'Operator Jaringan'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  {
    name: 'Backup Database',
    path: '/database-backup',
    category: 'Administrasi Sistem',
    desc: 'Pencadangan database MySQL, restore berkas & pembersihan data',
    defaultRoles: ['Super Administrator'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    )
  },
  {
    name: 'Tes App Mobile',
    path: '/mobile-app-testing',
    category: 'Administrasi Sistem',
    desc: 'Pusat unduh APK build mobile, QR code direct install & diagnostik API',
    defaultRoles: ['Super Administrator'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  }
];

/**
 * Generate mapping rute bawaan (default permissions map)
 */
export const getDefaultPermissionsMap = () => {
  const map = {};
  SYSTEM_NAVIGATION_MODULES.forEach(mod => {
    map[mod.path] = mod.defaultRoles || ['Super Administrator'];
  });
  return map;
};

/**
 * Standar Akses CRUD Global:
 * Hanya Super Administrator dan Operator Jaringan yang memiliki hak penuh
 * untuk melakukan Create (Tambah), Update (Edit/Ubah), dan Delete (Hapus) data master.
 */
export const isUserAuthorizedForCrud = (user) => {
  if (!user) return false;
  return user.role === 'Super Administrator' || user.role === 'Operator Jaringan';
};
