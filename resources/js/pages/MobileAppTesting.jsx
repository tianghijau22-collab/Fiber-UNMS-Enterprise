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

  const fetchAppInfo = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/app-testing/info');
      if (res.data && res.data.status === 'success') {
        setAppInfo(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch mobile app info:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppInfo();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.apk')) {
      setAlertMsg({ type: 'error', text: 'Format berkas harus .apk' });
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
  const apiEndpointUrl = appInfo?.api_endpoint || (typeof window !== 'undefined' ? `${window.location.origin}/api` : '');

  const qrDownloadUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(downloadUrl)}`;
  const qrApiEndpointUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(apiEndpointUrl)}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header & Access Badge */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide">Pusat Uji Coba Aplikasi Mobile (Tes App)</h1>
              <p className="text-sm text-slate-400">Distribusi build APK Android, integrasi scan QR code & diagnostik API mobile</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-full flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            Khusus Super Administrator
          </span>
          <RefreshButton onClick={fetchAppInfo} loading={loading} />
        </div>
      </div>

      {/* Alert Banner */}
      {alertMsg && (
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          alertMsg.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={alertMsg.type === 'success' ? "M5 13l4 4L19 7" : "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} />
            </svg>
            <span className="text-sm font-medium">{alertMsg.text}</span>
          </div>
          <button onClick={() => setAlertMsg(null)} className="text-xs opacity-70 hover:opacity-100">✕ Tutup</button>
        </div>
      )}

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Build Info & Direct Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Build Details Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                Informasi Paket Rilis Mobile
              </h2>
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${
                appInfo?.is_apk_available 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {appInfo?.is_apk_available ? 'APK Tersedia untuk Diunduh' : 'APK Belum Diunggah'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Nama Aplikasi</span>
                <span className="font-semibold text-slate-200">{appInfo?.app_name || 'Fiber-UNMS Mobile'}</span>
              </div>
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Versi Rilis</span>
                <span className="font-semibold text-emerald-400">{appInfo?.app_version || '1.0.0+1'}</span>
              </div>
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Ukuran Berkas APK</span>
                <span className="font-semibold text-slate-200">{appInfo?.apk_file_size_fmt || '0 MB'}</span>
              </div>
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Package ID</span>
                <span className="font-mono text-xs text-sky-400">{appInfo?.package_name || 'com.fiberunms.mobile'}</span>
              </div>
            </div>

            {/* Direct Download & Upload Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              {appInfo?.is_apk_available ? (
                <a
                  href={downloadUrl}
                  download="fiber-unms-app.apk"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition shadow-lg shadow-emerald-950/40"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Berkas APK Android
                </a>
              ) : (
                <button
                  disabled
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-800 text-slate-500 font-semibold rounded-xl cursor-not-allowed"
                >
                  Berkas APK Belum Diunggah
                </button>
              )}

              <label className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition border border-slate-700 cursor-pointer">
                <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {uploading ? `Mengunggah (${uploadProgress}%)...` : 'Unggah / Update APK Baru'}
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

          {/* Mobile API Diagnostics Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Diagnostik Konektivitas API Mobile
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Uji kesiapan endpoint backend untuk menerima request dari mobile app</p>
              </div>
              <button
                onClick={handleRunApiTest}
                disabled={testingApi}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2"
              >
                {testingApi ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    Menguji...
                  </>
                ) : (
                  'Jalankan Tes API'
                )}
              </button>
            </div>

            {testResults ? (
              <div className="space-y-2.5 pt-1">
                {testResults.results.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-200 block">{item.module}</span>
                      <span className="font-mono text-slate-400 text-[11px]">{item.method} {item.endpoint}</span>
                      <p className="text-slate-500 text-[11px] mt-0.5">{item.detail}</p>
                    </div>
                    <span className={`px-2.5 py-1 font-semibold rounded-md ${
                      item.status === 'OK' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 text-xs">
                Klik tombol "Jalankan Tes API" untuk memvalidasi seluruh endpoint mobile.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: QR Code Direct Download & Install Guide */}
        <div className="space-y-6">
          {/* QR Code Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-center space-y-4">
            <h3 className="text-sm font-semibold text-white">Scan QR untuk Download di HP</h3>
            <p className="text-xs text-slate-400">Arahkan kamera HP Android Anda untuk langsung mengunduh APK</p>

            <div className="inline-block p-3 bg-white rounded-2xl shadow-lg">
              <img
                src={qrDownloadUrl}
                alt="QR Code Download APK"
                className="w-44 h-44 object-contain mx-auto"
              />
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-left">
              <span className="text-[11px] text-slate-400 block mb-0.5">Tautan Unduh Langsung:</span>
              <span className="text-xs text-emerald-400 font-mono break-all select-all">{downloadUrl}</span>
            </div>
          </div>

          {/* Quick Setup Instructions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3 text-xs">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Panduan Instalasi Android
            </h3>
            <ol className="space-y-2 text-slate-300 list-decimal list-inside leading-relaxed">
              <li>Scan QR Code atau buka tautan unduh di browser HP Android Anda.</li>
              <li>Buka file <strong className="text-white">fiber-unms-app.apk</strong> yang telah selesai diunduh.</li>
              <li>Jika muncul peringatan keamanan, pilih <strong className="text-white">Izinkan dari sumber ini (Install unknown apps)</strong>.</li>
              <li>Buka aplikasi, masukkan akun Web Anda (Super Admin / Teknisi) untuk mulai pengujian.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
