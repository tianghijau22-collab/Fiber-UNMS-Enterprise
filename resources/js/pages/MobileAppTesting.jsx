import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../components/AuthContext.jsx';
import RefreshButton from '../components/RefreshButton.jsx';

export default function MobileAppTesting() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appInfo, setAppInfo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [testResults, setTestResults] = useState(null);
  const [testingApi, setTestingApi] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);

  // Mobile Login Background Banner States
  const [bannerInfo, setBannerInfo] = useState(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerResetting, setBannerResetting] = useState(false);

  const fetchAppInfo = async () => {
    setLoading(true);
    try {
      const [resApp, resBanner] = await Promise.all([
        axios.get('/api/app-testing/info'),
        axios.get('/api/app-testing/login-banner'),
      ]);
      if (resApp.data && resApp.data.status === 'success') {
        setAppInfo(resApp.data.data);
      }
      if (resBanner.data && resBanner.data.status === 'success') {
        setBannerInfo(resBanner.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch mobile app info:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setAlertMsg({ type: 'error', text: 'Format gambar harus PNG, JPG, JPEG, atau WEBP.' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAlertMsg({ type: 'error', text: 'Ukuran gambar maksimal 5MB.' });
      return;
    }

    const formData = new FormData();
    formData.append('banner_image', file);

    setBannerUploading(true);
    setAlertMsg(null);

    try {
      const res = await axios.post('/api/app-testing/login-banner', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data && res.data.status === 'success') {
        setAlertMsg({ type: 'success', text: res.data.message });
        setBannerInfo({
          is_custom: true,
          banner_url: res.data.banner_url,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      setAlertMsg({
        type: 'error',
        text: err.response?.data?.message || 'Gagal mengunggah gambar latar belakang login.',
      });
    } finally {
      setBannerUploading(false);
      e.target.value = '';
    }
  };

  const handleBannerReset = async () => {
    if (!window.confirm('Yakin ingin mereset gambar latar belakang login ke tampilan maskot default?')) return;

    setBannerResetting(true);
    setAlertMsg(null);
    try {
      const res = await axios.delete('/api/app-testing/login-banner');
      if (res.data && res.data.status === 'success') {
        setAlertMsg({ type: 'success', text: res.data.message });
        setBannerInfo({
          is_custom: false,
          banner_url: null,
          updated_at: null,
        });
      }
    } catch (err) {
      setAlertMsg({ type: 'error', text: 'Gagal mereset gambar latar belakang login.' });
    } finally {
      setBannerResetting(false);
    }
  };

  useEffect(() => {
    fetchAppInfo();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.apk')) {
      setAlertMsg({ type: 'error', text: 'Format berkas harus berekstensi .apk' });
      return;
    }

    const formData = new FormData();
    formData.append('apk_file', file);

    setUploading(true);
    setUploadProgress(0);
    setAlertMsg(null);

    try {
      const res = await axios.post('/api/app-testing/upload-apk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        },
      });

      if (res.data && res.data.status === 'success') {
        setAlertMsg({ type: 'success', text: res.data.message });
        fetchAppInfo();
      }
    } catch (err) {
      setAlertMsg({
        type: 'error',
        text: err.response?.data?.message || 'Gagal mengunggah berkas APK.',
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRunApiTest = async () => {
    setTestingApi(true);
    setTestResults(null);
    try {
      const res = await axios.post('/api/app-testing/test-api');
      if (res.data && res.data.status === 'success') {
        setTestResults(res.data);
      }
    } catch (err) {
      setAlertMsg({ type: 'error', text: 'Gagal menjalankan pengujian API Mobile.' });
    } finally {
      setTestingApi(false);
    }
  };

  const downloadUrl = appInfo?.download_url || (typeof window !== 'undefined' ? `${window.location.origin}/downloads/fiber-unms-app.apk` : '');
  const qrDownloadUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(downloadUrl)}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 text-black dark:text-white">
      {/* Header & Access Badge */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-black border border-black/70 dark:border-white/70 p-5 rounded-lg shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 flex items-center justify-center text-black dark:text-white shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-black dark:text-white tracking-tight">Pusat Uji Coba &amp; Download App Mobile</h1>
              <p className="text-xs text-black/70 dark:text-white/70">Distribusi paket APK Android, unduh instan via Scan QR &amp; uji konektivitas API</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded text-xs font-bold font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Super Administrator
          </span>
          <RefreshButton onClick={fetchAppInfo} loading={loading} />
        </div>
      </div>

      {/* Alert Banner */}
      {alertMsg && (
        <div className={`p-3.5 rounded-lg border flex items-center justify-between text-xs animate-in fade-in duration-150 ${
          alertMsg.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300' 
            : 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={alertMsg.type === 'success' ? "M5 13l4 4L19 7" : "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} />
            </svg>
            <span className="font-semibold">{alertMsg.text}</span>
          </div>
          <button 
            type="button"
            onClick={() => setAlertMsg(null)} 
            className="text-xs font-bold hover:underline cursor-pointer ml-3 opacity-80 hover:opacity-100"
          >
            ✕ Tutup
          </button>
        </div>
      )}

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Build Info & Direct Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Build Details Card */}
          <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-black/20 dark:border-white/20 pb-3">
              <h2 className="text-sm font-bold text-black dark:text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Informasi Paket APK Rilis
              </h2>
              <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                appInfo?.is_apk_available 
                  ? 'text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                  : 'text-amber-600 dark:text-amber-400 border border-amber-500/30'
              }`}>
                {appInfo?.is_apk_available ? 'APK Siap Diunduh' : 'APK Belum Diunggah'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="p-3 bg-black/5 dark:bg-white/5 rounded-md border border-black/20 dark:border-white/20">
                <span className="text-[11px] text-black/60 dark:text-white/60 block mb-0.5">Nama Aplikasi</span>
                <span className="font-bold text-black dark:text-white">{appInfo?.app_name || 'Fiber-UNMS Mobile'}</span>
              </div>
              <div className="p-3 bg-black/5 dark:bg-white/5 rounded-md border border-black/20 dark:border-white/20">
                <span className="text-[11px] text-black/60 dark:text-white/60 block mb-0.5">Versi Rilis</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{appInfo?.app_version || '1.0.0+1 (Beta)'}</span>
              </div>
              <div className="p-3 bg-black/5 dark:bg-white/5 rounded-md border border-black/20 dark:border-white/20">
                <span className="text-[11px] text-black/60 dark:text-white/60 block mb-0.5">Ukuran Berkas APK</span>
                <span className="font-mono font-bold text-black dark:text-white">{appInfo?.apk_file_size_fmt || '0 MB'}</span>
              </div>
              <div className="p-3 bg-black/5 dark:bg-white/5 rounded-md border border-black/20 dark:border-white/20">
                <span className="text-[11px] text-black/60 dark:text-white/60 block mb-0.5">Package ID</span>
                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{appInfo?.package_name || 'com.fiberunms.mobile'}</span>
              </div>
            </div>

            {/* Direct Download & Upload Action Buttons */}
            <div className="pt-1 flex flex-col sm:flex-row gap-3">
              {appInfo?.is_apk_available ? (
                <a
                  href={downloadUrl}
                  download="fiber-unms-app.apk"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md text-xs transition shadow-xs cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Berkas APK ({appInfo?.apk_file_size_fmt})
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40 font-semibold rounded-md text-xs border border-black/10 dark:border-white/10 cursor-not-allowed"
                >
                  Berkas APK Belum Diunggah
                </button>
              )}

              <label className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md text-xs transition shadow-xs cursor-pointer">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {uploading ? `Mengunggah (${uploadProgress}%)...` : 'Unggah / Update Berkas APK'}
                <input
                  type="file"
                  accept=".apk"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Kustomisasi Background / Banner Login Mobile Card */}
          <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-black/20 dark:border-white/20 pb-3">
              <div>
                <h2 className="text-sm font-bold text-black dark:text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Kustomisasi Banner Header Login Mobile
                </h2>
                <p className="text-[11px] text-black/60 dark:text-white/60 mt-0.5">Ubah gambar latar belakang / maskot header pada layar login aplikasi FONA Mobile</p>
              </div>
              <span className={`self-start sm:self-auto px-2 py-0.5 text-xs font-bold rounded ${
                bannerInfo?.is_custom 
                  ? 'text-indigo-600 dark:text-indigo-400 border border-indigo-500/30' 
                  : 'text-black/60 dark:text-white/60 border border-black/20 dark:border-white/20'
              }`}>
                {bannerInfo?.is_custom ? 'Gambar Kustom Aktif' : 'Default Maskot FONA'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              {/* Image Preview Box */}
              <div className="w-full sm:w-60 h-32 rounded-md overflow-hidden bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 flex items-center justify-center relative shadow-inner">
                {bannerInfo?.is_custom && bannerInfo?.banner_url ? (
                  <img
                    src={bannerInfo.banner_url}
                    alt="Custom Login Banner"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-3 text-black dark:text-white">
                    <div className="w-9 h-9 mx-auto rounded-md bg-black/10 dark:bg-white/10 border border-black/20 dark:border-white/20 flex items-center justify-center mb-1 text-black dark:text-white">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold block">Maskot FONA (Default)</span>
                    <span className="text-[10px] text-black/60 dark:text-white/60">Gradasi Royal Blue + Arc Curve</span>
                  </div>
                )}
                {bannerInfo?.is_custom && (
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/80 text-white rounded text-[10px] font-mono border border-white/20">
                    Kustom
                  </div>
                )}
              </div>

              {/* Upload & Reset Controls */}
              <div className="flex-1 space-y-3 w-full">
                <div className="text-xs text-black/70 dark:text-white/70 leading-relaxed">
                  Unggah gambar banner (PNG, JPG, WEBP maks 5MB). Rekomendasi rasio <strong className="font-bold text-black dark:text-white">4:3</strong> atau <strong className="font-bold text-black dark:text-white">16:9</strong> dengan resolusi <strong className="font-bold text-black dark:text-white">800×600 px</strong>.
                </div>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md transition shadow-xs cursor-pointer">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {bannerUploading ? 'Mengunggah...' : 'Ganti Gambar Banner'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleBannerUpload}
                      disabled={bannerUploading}
                      className="hidden"
                    />
                  </label>

                  {bannerInfo?.is_custom && (
                    <button
                      type="button"
                      onClick={handleBannerReset}
                      disabled={bannerResetting}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-black/5 dark:bg-white/10 hover:bg-rose-500/10 text-black dark:text-white hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold rounded-md border border-black/20 dark:border-white/20 hover:border-rose-500/30 transition cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {bannerResetting ? 'Mereset...' : 'Reset ke Default'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile API Diagnostics Card */}
          <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-black/20 dark:border-white/20 pb-3">
              <div>
                <h2 className="text-sm font-bold text-black dark:text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Diagnostik Konektivitas API Mobile
                </h2>
                <p className="text-[11px] text-black/60 dark:text-white/60 mt-0.5">Uji kesiapan endpoint backend untuk menerima request dari mobile app</p>
              </div>
              <button
                type="button"
                onClick={handleRunApiTest}
                disabled={testingApi}
                className="self-start sm:self-auto px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-md transition flex items-center gap-2 shadow-xs cursor-pointer"
              >
                {testingApi ? 'Menguji...' : 'Jalankan Tes API'}
              </button>
            </div>

            {testResults ? (
              <div className="space-y-2 pt-1">
                {testResults.results.map((item, idx) => (
                  <div key={idx} className="p-3 bg-black/5 dark:bg-white/5 rounded-md border border-black/20 dark:border-white/20 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-black dark:text-white block">{item.module}</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400 text-[11px] font-bold">{item.method} {item.endpoint}</span>
                      <p className="text-black/60 dark:text-white/60 text-[11px] mt-0.5">{item.detail}</p>
                    </div>
                    <span className={`px-2 py-0.5 font-mono font-bold text-[11px] rounded ${
                      item.status === 'OK' 
                        ? 'text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                        : 'text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-black/50 dark:text-white/50 text-xs rounded-md border border-dashed border-black/20 dark:border-white/20">
                Klik tombol "Jalankan Tes API" untuk memvalidasi seluruh endpoint mobile.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: QR Code Direct Download & Install Guide */}
        <div className="space-y-6">
          {/* QR Code Card */}
          <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-5 shadow-sm text-center space-y-4">
            <h3 className="text-sm font-bold text-black dark:text-white">Scan QR untuk Download di HP</h3>
            <p className="text-xs text-black/60 dark:text-white/60">Arahkan kamera HP Android Anda untuk langsung mengunduh APK</p>

            <div className="inline-block p-3 bg-white rounded-lg border border-black/20 shadow-xs">
              <img
                src={qrDownloadUrl}
                alt="QR Code Download APK"
                className="w-44 h-44 object-contain mx-auto"
              />
            </div>

            <div className="p-3 bg-black/5 dark:bg-white/5 rounded-md border border-black/20 dark:border-white/20 text-left">
              <span className="text-[11px] font-medium text-black/60 dark:text-white/60 block mb-0.5">Tautan Unduh Langsung:</span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold break-all select-all">{downloadUrl}</span>
            </div>
          </div>

          {/* Quick Setup Instructions */}
          <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-5 shadow-sm space-y-3 text-xs">
            <h3 className="font-bold text-black dark:text-white text-sm flex items-center gap-2 border-b border-black/20 dark:border-white/20 pb-2.5">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Panduan Instalasi Android
            </h3>
            <ol className="space-y-2 text-black/80 dark:text-white/80 list-decimal list-inside leading-relaxed">
              <li>Scan QR Code atau buka tautan unduh di browser HP Android Anda.</li>
              <li>Buka file <strong className="font-bold text-black dark:text-white font-mono">fiber-unms-app.apk</strong> yang telah selesai diunduh.</li>
              <li>Jika muncul peringatan keamanan, pilih <strong className="font-bold text-black dark:text-white">Izinkan dari sumber ini (Install unknown apps)</strong>.</li>
              <li>Buka aplikasi, masukkan akun Web Anda (Super Admin / Teknisi) untuk mulai pengujian.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
