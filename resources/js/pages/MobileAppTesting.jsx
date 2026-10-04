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

  // Mobile Background Banner States (Dashboard, Login, & Slider)
  const [activeBannerTab, setActiveBannerTab] = useState('dashboard'); // 'dashboard' | 'login' | 'slider'

  const [loginBannerInfo, setLoginBannerInfo] = useState(null);
  const [loginBannerConfig, setLoginBannerConfig] = useState({
    fit: 'cover',
    alignment_x: 0.0,
    alignment_y: 0.0,
    scale: 1.0,
    overlay_opacity: 0.0,
  });

  const [dashBannerInfo, setDashBannerInfo] = useState(null);
  const [dashBannerConfig, setDashBannerConfig] = useState({
    fit: 'cover',
    alignment_x: 0.0,
    alignment_y: 0.0,
    scale: 1.0,
    overlay_opacity: 0.0,
  });

  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerResetting, setBannerResetting] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Slide Banners State
  const [sliderBanners, setSliderBanners] = useState([]);
  const [loadingSliders, setLoadingSliders] = useState(false);
  const [sliderModalOpen, setSliderModalOpen] = useState(false);
  const [editingSlider, setEditingSlider] = useState(null);
  const [sliderForm, setSliderForm] = useState({
    title: '',
    subtitle: '',
    badge_text: '',
    action_type: 'none',
    action_url: '',
    image_url: '',
    sort_order: 1,
    is_active: true,
  });
  const [sliderImageFile, setSliderImageFile] = useState(null);
  const [sliderPreviewUrl, setSliderPreviewUrl] = useState('');
  const [savingSlider, setSavingSlider] = useState(false);
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);

  // Active banner helpers
  const isDashboard = activeBannerTab === 'dashboard';
  const currentBannerInfo = isDashboard ? dashBannerInfo : loginBannerInfo;
  const currentBannerConfig = isDashboard ? dashBannerConfig : loginBannerConfig;
  const setCurrentBannerConfig = (updater) => {
    if (isDashboard) {
      setDashBannerConfig(updater);
    } else {
      setLoginBannerConfig(updater);
    }
  };

  const fetchSliderBanners = async () => {
    setLoadingSliders(true);
    try {
      const res = await axios.get('/api/app-testing/slider-banners');
      if (res.data && res.data.status === 'success') {
        setSliderBanners(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch slider banners:', err);
    } finally {
      setLoadingSliders(false);
    }
  };

  const fetchAppInfo = async () => {
    setLoading(true);
    try {
      const [resApp, resLogin, resDash, resSliders] = await Promise.all([
        axios.get('/api/app-testing/info'),
        axios.get('/api/app-testing/login-banner'),
        axios.get('/api/app-testing/dashboard-banner'),
        axios.get('/api/app-testing/slider-banners'),
      ]);
      if (resApp.data && resApp.data.status === 'success') {
        setAppInfo(resApp.data.data);
      }
      if (resLogin.data && resLogin.data.status === 'success') {
        setLoginBannerInfo(resLogin.data.data);
        if (resLogin.data.data.config) {
          setLoginBannerConfig(resLogin.data.data.config);
        }
      }
      if (resDash.data && resDash.data.status === 'success') {
        setDashBannerInfo(resDash.data.data);
        if (resDash.data.data.config) {
          setDashBannerConfig(resDash.data.data.config);
        }
      }
      if (resSliders.data && resSliders.data.status === 'success') {
        setSliderBanners(resSliders.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch mobile app info:', err);
    } finally {
      setLoading(false);
    }
  };

  // Preview Slide Timer
  useEffect(() => {
    if (activeBannerTab !== 'slider') return;
    const activeSlides = sliderBanners.filter((b) => b.is_active);
    if (activeSlides.length <= 1) return;

    const timer = setInterval(() => {
      setPreviewSlideIndex((prev) => (prev + 1) % activeSlides.length);
    }, 3500);

    return () => clearInterval(timer);
  }, [activeBannerTab, sliderBanners]);

  const handleOpenAddSlider = () => {
    setEditingSlider(null);
    setSliderForm({
      title: '',
      subtitle: '',
      badge_text: '',
      action_type: 'none',
      action_url: '',
      image_url: '',
      sort_order: sliderBanners.length + 1,
      is_active: true,
    });
    setSliderImageFile(null);
    setSliderPreviewUrl('');
    setSliderModalOpen(true);
  };

  const handleOpenEditSlider = (banner) => {
    setEditingSlider(banner);
    setSliderForm({
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      badge_text: banner.badge_text || '',
      action_type: banner.action_type || 'none',
      action_url: banner.action_url || '',
      image_url: banner.image_url || '',
      sort_order: banner.sort_order ?? 1,
      is_active: Boolean(banner.is_active),
    });
    setSliderImageFile(null);
    setSliderPreviewUrl(banner.image_url_full || banner.image_url || '');
    setSliderModalOpen(true);
  };

  const handleSliderImageChange = (e) => {
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

    setSliderImageFile(file);
    const objUrl = URL.createObjectURL(file);
    setSliderPreviewUrl(objUrl);
  };

  const handleSaveSlider = async (e) => {
    e.preventDefault();
    if (!sliderImageFile && !sliderForm.image_url && !editingSlider?.image_url) {
      setAlertMsg({ type: 'error', text: 'Gambar slide banner wajib diunggah atau diisi URL.' });
      return;
    }

    setSavingSlider(true);
    setAlertMsg(null);

    const formData = new FormData();
    if (sliderImageFile) {
      formData.append('image', sliderImageFile);
    }
    if (sliderForm.image_url) {
      formData.append('image_url', sliderForm.image_url);
    }
    formData.append('title', sliderForm.title || '');
    formData.append('subtitle', sliderForm.subtitle || '');
    formData.append('badge_text', sliderForm.badge_text || '');
    formData.append('action_type', sliderForm.action_type || 'none');
    formData.append('action_url', sliderForm.action_url || '');
    formData.append('sort_order', sliderForm.sort_order ?? 1);
    formData.append('is_active', sliderForm.is_active ? '1' : '0');

    try {
      let res;
      if (editingSlider) {
        formData.append('_method', 'PUT');
        res = await axios.post(`/api/app-testing/slider-banners/${editingSlider.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        res = await axios.post('/api/app-testing/slider-banners', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      if (res.data && res.data.status === 'success') {
        setAlertMsg({ type: 'success', text: res.data.message });
        setSliderModalOpen(false);
        fetchSliderBanners();
      }
    } catch (err) {
      setAlertMsg({
        type: 'error',
        text: err.response?.data?.message || 'Gagal menyimpan slide banner.',
      });
    } finally {
      setSavingSlider(false);
    }
  };

  const handleToggleSlider = async (id) => {
    try {
      const res = await axios.patch(`/api/app-testing/slider-banners/${id}/toggle`);
      if (res.data && res.data.status === 'success') {
        setAlertMsg({ type: 'success', text: res.data.message });
        fetchSliderBanners();
      }
    } catch (err) {
      setAlertMsg({ type: 'error', text: 'Gagal mengubah status slide banner.' });
    }
  };

  const handleDeleteSlider = async (id, title) => {
    if (!window.confirm(`Yakin ingin menghapus slide banner "${title || 'Tanpa Judul'}"?`)) return;
    try {
      const res = await axios.delete(`/api/app-testing/slider-banners/${id}`);
      if (res.data && res.data.status === 'success') {
        setAlertMsg({ type: 'success', text: res.data.message });
        fetchSliderBanners();
      }
    } catch (err) {
      setAlertMsg({ type: 'error', text: 'Gagal menghapus slide banner.' });
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

    const endpoint = isDashboard ? '/api/app-testing/dashboard-banner' : '/api/app-testing/login-banner';

    try {
      const res = await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data && res.data.status === 'success') {
        setAlertMsg({ type: 'success', text: res.data.message });
        const updated = {
          is_custom: true,
          banner_url: res.data.banner_url,
          updated_at: new Date().toISOString(),
        };
        if (isDashboard) {
          setDashBannerInfo((prev) => ({ ...prev, ...updated }));
        } else {
          setLoginBannerInfo((prev) => ({ ...prev, ...updated }));
        }
      }
    } catch (err) {
      setAlertMsg({
        type: 'error',
        text: err.response?.data?.message || 'Gagal mengunggah gambar latar belakang.',
      });
    } finally {
      setBannerUploading(false);
      e.target.value = '';
    }
  };

  const handleBannerReset = async () => {
    const targetName = isDashboard ? 'dashboard' : 'login';
    if (!window.confirm(`Yakin ingin mereset gambar latar belakang ${targetName} ke tampilan default?`)) return;

    setBannerResetting(true);
    setAlertMsg(null);
    const endpoint = isDashboard ? '/api/app-testing/dashboard-banner' : '/api/app-testing/login-banner';

    try {
      const res = await axios.delete(endpoint);
      if (res.data && res.data.status === 'success') {
        setAlertMsg({ type: 'success', text: res.data.message });
        const resetInfo = {
          is_custom: false,
          banner_url: null,
          updated_at: null,
        };
        const resetConfig = {
          fit: 'cover',
          alignment_x: 0.0,
          alignment_y: 0.0,
          scale: 1.0,
          overlay_opacity: 0.0,
        };
        if (isDashboard) {
          setDashBannerInfo(resetInfo);
          setDashBannerConfig(resetConfig);
        } else {
          setLoginBannerInfo(resetInfo);
          setLoginBannerConfig(resetConfig);
        }
      }
    } catch (err) {
      setAlertMsg({ type: 'error', text: 'Gagal mereset gambar latar belakang.' });
    } finally {
      setBannerResetting(false);
    }
  };

  const handleSaveBannerConfig = async () => {
    setSavingConfig(true);
    setAlertMsg(null);
    const endpoint = isDashboard ? '/api/app-testing/dashboard-banner-config' : '/api/app-testing/login-banner-config';

    try {
      const res = await axios.post(endpoint, currentBannerConfig);
      if (res.data && res.data.status === 'success') {
        setAlertMsg({ type: 'success', text: res.data.message });
        if (res.data.data?.config) {
          setCurrentBannerConfig(res.data.data.config);
        }
      }
    } catch (err) {
      setAlertMsg({
        type: 'error',
        text: err.response?.data?.message || 'Gagal menyimpan pengaturan posisi banner.',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleResetPosition = () => {
    setCurrentBannerConfig({
      fit: 'cover',
      alignment_x: 0.0,
      alignment_y: 0.0,
      scale: 1.0,
      overlay_opacity: 0.0,
    });
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
    <div className="space-y-6 w-full pb-12 text-black dark:text-white animate-in fade-in duration-200">
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
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Build Info & Direct Actions */}
        <div className="xl:col-span-7 2xl:col-span-8 space-y-6">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-3.5 text-xs">
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

          {/* Kustomisasi Background / Banner Mobile Card (Dashboard & Login) */}
          <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-5 shadow-sm space-y-5">
            {/* Top Sub-tabs Switcher */}
            <div className="flex border-b border-black/20 dark:border-white/20 -mx-5 px-5 gap-3">
              <button
                type="button"
                onClick={() => setActiveBannerTab('dashboard')}
                className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                  activeBannerTab === 'dashboard'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Header Dashboard Mobile
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  dashBannerInfo?.is_custom 
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30' 
                    : 'bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60 border border-black/10 dark:border-white/10'
                }`}>
                  {dashBannerInfo?.is_custom ? 'Kustom Aktif' : 'Default FONA'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveBannerTab('login')}
                className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                  activeBannerTab === 'login'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Header Login Mobile
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  loginBannerInfo?.is_custom 
                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30' 
                    : 'bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60 border border-black/10 dark:border-white/10'
                }`}>
                  {loginBannerInfo?.is_custom ? 'Kustom Aktif' : 'Default Maskot'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveBannerTab('slider')}
                className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                  activeBannerTab === 'slider'
                    ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400'
                    : 'border-transparent text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Slide Banner Dashboard
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                  {sliderBanners.filter((b) => b.is_active).length} Aktif
                </span>
              </button>
            </div>

            {activeBannerTab !== 'slider' ? (
              <>
                {/* Header Description & Status */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-black/15 dark:border-white/15 pb-3">
              <div>
                <h2 className="text-sm font-bold text-black dark:text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {isDashboard ? 'Kustomisasi Background Header Dashboard' : 'Kustomisasi Background Header Login'}
                </h2>
                <p className="text-[11px] text-black/60 dark:text-white/60 mt-0.5">
                  {isDashboard
                    ? 'Ubah gambar latar belakang header dashboard FONA Mobile, atur posisi & skala secara langsung.'
                    : 'Ubah gambar latar belakang layar login & atur posisi/skala agar pas dengan maskot/banner aplikasi.'}
                </p>
              </div>
              <span className={`self-start sm:self-auto px-2 py-0.5 text-xs font-bold rounded ${
                currentBannerInfo?.is_custom 
                  ? 'text-blue-600 dark:text-blue-400 border border-blue-500/30' 
                  : 'text-black/60 dark:text-white/60 border border-black/20 dark:border-white/20'
              }`}>
                {currentBannerInfo?.is_custom ? 'Gambar Kustom Aktif' : (isDashboard ? 'Tema Cyber FONA Default' : 'Default Maskot FONA')}
              </span>
            </div>

            {/* Top Row: Live Mockup Preview & File Upload */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              {/* Interactive Live Mobile Mockup Preview */}
              <div className="md:col-span-6 lg:col-span-5 flex flex-col items-center">
                <div className="w-full max-w-[280px] bg-slate-900 rounded-2xl border-2 border-slate-700 shadow-xl p-2.5 overflow-hidden">
                  <div className="flex items-center justify-between px-2 py-1 text-[10px] text-white/70 font-mono border-b border-white/10 mb-2">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Preview {isDashboard ? 'Dashboard' : 'Login'}
                    </span>
                    <span>100% Live</span>
                  </div>

                  {/* Mockup Frame Container */}
                  {isDashboard ? (
                    /* ── DASHBOARD MOCKUP SCREEN ── */
                    <div className="relative w-full rounded-xl overflow-hidden bg-[#F4F6F9] border border-white/10 flex flex-col">
                      {/* Top Curved Sunset / Custom Background */}
                      <div className="relative w-full h-36 rounded-b-[24px] overflow-hidden shadow-md">
                        {currentBannerInfo?.is_custom && currentBannerInfo?.banner_url ? (
                          <div className="w-full h-full relative overflow-hidden bg-slate-950">
                            <img
                              src={currentBannerInfo.banner_url}
                              alt="Live Custom Dashboard Banner Preview"
                              style={{
                                objectFit: currentBannerConfig.fit === 'fitWidth' ? 'fill' : currentBannerConfig.fit,
                                objectPosition: `${((Number(currentBannerConfig.alignment_x) + 1) / 2) * 100}% ${((Number(currentBannerConfig.alignment_y) + 1) / 2) * 100}%`,
                                transform: `scale(${currentBannerConfig.scale})`,
                                transformOrigin: `${((Number(currentBannerConfig.alignment_x) + 1) / 2) * 100}% ${((Number(currentBannerConfig.alignment_y) + 1) / 2) * 100}%`,
                              }}
                              className="w-full h-full transition-transform duration-75"
                            />
                            {currentBannerConfig.overlay_opacity > 0 && (
                              <div 
                                className="absolute inset-0 pointer-events-none transition-colors duration-75"
                                style={{ backgroundColor: `rgba(0,0,0,${currentBannerConfig.overlay_opacity})` }}
                              />
                            )}
                          </div>
                        ) : (
                          /* Modern Default Cyber Telecom FONA Background */
                          <div className="w-full h-full bg-gradient-to-b from-[#020B1C] via-[#002752] to-[#005B9E] p-3 flex flex-col justify-between relative overflow-hidden">
                            {/* Cyber telecom mesh glow circles */}
                            <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-[#00AAE0]/20 blur-lg"></div>
                            <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-[#0284C7]/25 blur-md"></div>
                            {/* Decorative Fiber Optic Wave lines */}
                            <svg className="absolute inset-0 w-full h-full opacity-40" preserveAspectRatio="none" viewBox="0 0 200 100">
                              <path d="M0,60 Q50,20 100,50 T200,30" fill="none" stroke="#00E5FF" strokeWidth="1.2" />
                              <path d="M0,80 Q60,40 120,70 T200,50" fill="none" stroke="#38BDF8" strokeWidth="0.8" />
                              <circle cx="50" cy="20" r="2" fill="#00E5FF" />
                              <circle cx="120" cy="70" r="2.5" fill="#38BDF8" />
                              <circle cx="160" cy="38" r="1.8" fill="#FDE68A" />
                            </svg>
                            <div className="relative z-10">
                              <span className="text-[9px] font-mono text-cyan-300 font-bold tracking-wider uppercase block">Tema Default FONA</span>
                              <span className="text-[10px] text-white/90 font-bold">Cyber Fiber Optics</span>
                            </div>
                            <div className="relative z-10 flex items-center justify-between text-[8px] text-white/70 font-mono">
                              <span>Topology Wave</span>
                              <span>High-Speed UNMS</span>
                            </div>
                          </div>
                        )}

                        {/* Top Bar Header Overlay (Logo & Bell) */}
                        <div className="absolute top-2 left-2.5 right-2.5 flex items-center justify-between z-20 pointer-events-none">
                          <div className="px-1.5 py-0.5 bg-black/35 backdrop-blur-xs rounded flex items-center gap-1 border border-white/20">
                            <span className="text-[10px] font-black text-white tracking-wider">FONA</span>
                            <span className="text-[8px] text-cyan-300 font-bold">MOBILE</span>
                          </div>
                          <div className="w-5 h-5 rounded-full bg-black/40 backdrop-blur-xs border border-white/25 flex items-center justify-center text-white text-[9px]">
                            🔔
                          </div>
                        </div>
                      </div>

                      {/* Mockup Preview of Hero Card ("Status Jaringan") Overlapping the Curve */}
                      <div className="px-3 -mt-6 pb-2.5 z-10">
                        <div className="rounded-xl shadow-lg border border-white/20 overflow-hidden bg-gradient-to-r from-[#003875] via-[#00529E] to-[#0064B8] p-2.5 text-white">
                          <div className="flex items-center justify-between text-[8px] text-white/90">
                            <span className="font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                              Status Jaringan &amp; Pelanggan
                            </span>
                            <span className="bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-400/30">93.7% Online</span>
                          </div>
                          <div className="text-xs font-black mt-1">1633 Pelanggan</div>
                          <div className="mt-1.5 pt-1.5 border-t border-white/15 flex items-center justify-between text-[8px] text-cyan-200">
                            <span>Semua Pelanggan &amp; Node</span>
                            <span>→</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ── LOGIN MOCKUP SCREEN ── */
                    <div className="relative w-full h-44 rounded-md overflow-hidden bg-gradient-to-b from-[#003870] to-[#0060AF] border border-white/10 flex items-center justify-center">
                      {currentBannerInfo?.is_custom && currentBannerInfo?.banner_url ? (
                        <div className="w-full h-full relative overflow-hidden">
                          <img
                            src={currentBannerInfo.banner_url}
                            alt="Live Custom Banner Preview"
                            style={{
                              objectFit: currentBannerConfig.fit === 'fitWidth' ? 'fill' : currentBannerConfig.fit,
                              objectPosition: `${((Number(currentBannerConfig.alignment_x) + 1) / 2) * 100}% ${((Number(currentBannerConfig.alignment_y) + 1) / 2) * 100}%`,
                              transform: `scale(${currentBannerConfig.scale})`,
                              transformOrigin: `${((Number(currentBannerConfig.alignment_x) + 1) / 2) * 100}% ${((Number(currentBannerConfig.alignment_y) + 1) / 2) * 100}%`,
                            }}
                            className="w-full h-full transition-transform duration-75"
                          />
                          {currentBannerConfig.overlay_opacity > 0 && (
                            <div 
                              className="absolute inset-0 pointer-events-none transition-colors duration-75"
                              style={{ backgroundColor: `rgba(0,0,0,${currentBannerConfig.overlay_opacity})` }}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="text-center p-3 text-white">
                          <div className="w-9 h-9 mx-auto rounded-md bg-white/20 border border-white/30 flex items-center justify-center mb-1 text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <span className="text-xs font-bold block">Maskot FONA (Default)</span>
                          <span className="text-[10px] text-white/70">Gradasi Royal Blue + Arc Curve</span>
                        </div>
                      )}

                      {/* Top Status Indicators Mockup */}
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-xs rounded text-[9px] text-white/90 font-mono border border-white/20 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>Server Online</span>
                      </div>

                      {/* Arc Curve Bottom Overlay Indicator */}
                      <div className="absolute -bottom-4 left-0 right-0 h-8 bg-white/10 dark:bg-black/30 backdrop-blur-xs rounded-[50%] border-t border-white/20 pointer-events-none"></div>
                    </div>
                  )}

                  <div className="mt-2 text-center text-[10px] text-white/60 font-mono">
                    Mode: {currentBannerConfig.fit} • Zoom: {(currentBannerConfig.scale * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Upload Controls & Description */}
              <div className="md:col-span-6 lg:col-span-7 space-y-3.5">
                <div className="p-3 bg-black/5 dark:bg-white/5 rounded-md border border-black/15 dark:border-white/15 text-xs space-y-1.5">
                  <span className="font-bold text-black dark:text-white block">Petunjuk Format Gambar {isDashboard ? 'Header Dashboard' : 'Header Login'}:</span>
                  <p className="text-black/70 dark:text-white/70 leading-relaxed text-[11px]">
                    Unggah gambar latar header (PNG, JPG, JPEG, atau WEBP maks 5MB). Rekomendasi rasio <strong className="font-bold text-black dark:text-white">16:9</strong> atau <strong className="font-bold text-black dark:text-white">4:3</strong> dengan resolusi minimal <strong className="font-bold text-black dark:text-white">800×450 px</strong>.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition shadow-xs cursor-pointer">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {bannerUploading ? 'Mengunggah...' : `Ganti / Unggah Gambar ${isDashboard ? 'Dashboard' : 'Login'}`}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleBannerUpload}
                      disabled={bannerUploading}
                      className="hidden"
                    />
                  </label>

                  {currentBannerInfo?.is_custom && (
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

            {/* Visual Position & Scale Editor Controls */}
            {currentBannerInfo?.is_custom && (
              <div className="pt-4 border-t border-black/20 dark:border-white/20 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-black dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span>Pengaturan Posisi, Skala &amp; Keselarasan {isDashboard ? 'Dashboard' : 'Login'}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleResetPosition}
                    className="text-[11px] text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white font-medium hover:underline cursor-pointer"
                  >
                    ↺ Reset Slider ke Tengah
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Preset 9 Posisi Cepat */}
                  <div className="md:col-span-4 p-3.5 bg-black/5 dark:bg-white/5 rounded-md border border-black/20 dark:border-white/20 space-y-2">
                    <label className="text-[11px] font-bold text-black dark:text-white block">
                      Preset Posisi Cepat:
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 max-w-[150px] mx-auto">
                      {[
                        { label: '↖', x: -1.0, y: -1.0, title: 'Atas Kiri' },
                        { label: '↑', x: 0.0, y: -1.0, title: 'Atas Tengah' },
                        { label: '↗', x: 1.0, y: -1.0, title: 'Atas Kanan' },
                        { label: '←', x: -1.0, y: 0.0, title: 'Tengah Kiri' },
                        { label: '•', x: 0.0, y: 0.0, title: 'Pusat (Center)' },
                        { label: '→', x: 1.0, y: 0.0, title: 'Tengah Kanan' },
                        { label: '↙', x: -1.0, y: 1.0, title: 'Bawah Kiri' },
                        { label: '↓', x: 0.0, y: 1.0, title: 'Bawah Tengah' },
                        { label: '↘', x: 1.0, y: 1.0, title: 'Bawah Kanan' },
                      ].map((p, idx) => {
                        const isActive = Math.abs(currentBannerConfig.alignment_x - p.x) < 0.05 && Math.abs(currentBannerConfig.alignment_y - p.y) < 0.05;
                        return (
                          <button
                            key={idx}
                            type="button"
                            title={p.title}
                            onClick={() => setCurrentBannerConfig((prev) => ({ ...prev, alignment_x: p.x, alignment_y: p.y }))}
                            className={`h-8 rounded-md font-bold text-xs flex items-center justify-center transition-all cursor-pointer border ${
                              isActive
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white dark:bg-black text-black dark:text-white border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10'
                            }`}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fit Mode & Precision Sliders */}
                  <div className="md:col-span-8 p-3.5 bg-black/5 dark:bg-white/5 rounded-md border border-black/20 dark:border-white/20 space-y-3.5">
                    {/* Fit Mode */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-black dark:text-white">Kesesuaian Tampilan (Fit Mode):</span>
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{currentBannerConfig.fit}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { key: 'cover', label: 'Cover (Penuh & Crop)' },
                          { key: 'contain', label: 'Contain (Muat Penuh)' },
                          { key: 'fitWidth', label: 'Fit Width (Lebar)' },
                          { key: 'fill', label: 'Fill (Regangkan)' },
                        ].map((mode) => (
                          <button
                            key={mode.key}
                            type="button"
                            onClick={() => setCurrentBannerConfig((prev) => ({ ...prev, fit: mode.key }))}
                            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition border cursor-pointer ${
                              currentBannerConfig.fit === mode.key
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white dark:bg-black text-black dark:text-white border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10'
                            }`}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sliders Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                      {/* Horizontal Alignment Slider */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-black/70 dark:text-white/70 font-medium">Posisi Horizontal (X):</span>
                          <span className="font-mono font-bold text-black dark:text-white">
                            {Number(currentBannerConfig.alignment_x) === 0 ? 'Tengah (0%)' : `${(Number(currentBannerConfig.alignment_x) * 100).toFixed(0)}%`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-1"
                          max="1"
                          step="0.05"
                          value={currentBannerConfig.alignment_x}
                          onChange={(e) => setCurrentBannerConfig((prev) => ({ ...prev, alignment_x: parseFloat(e.target.value) }))}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-black/50 dark:text-white/50 font-mono">
                          <span>Kiri (-100%)</span>
                          <span>Kanan (+100%)</span>
                        </div>
                      </div>

                      {/* Vertical Alignment Slider */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-black/70 dark:text-white/70 font-medium">Posisi Vertikal (Y):</span>
                          <span className="font-mono font-bold text-black dark:text-white">
                            {Number(currentBannerConfig.alignment_y) === 0 ? 'Tengah (0%)' : `${(Number(currentBannerConfig.alignment_y) * 100).toFixed(0)}%`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-1"
                          max="1"
                          step="0.05"
                          value={currentBannerConfig.alignment_y}
                          onChange={(e) => setCurrentBannerConfig((prev) => ({ ...prev, alignment_y: parseFloat(e.target.value) }))}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-black/50 dark:text-white/50 font-mono">
                          <span>Atas (-100%)</span>
                          <span>Bawah (+100%)</span>
                        </div>
                      </div>

                      {/* Scale / Zoom Slider */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-black/70 dark:text-white/70 font-medium">Zoom / Skala:</span>
                          <span className="font-mono font-bold text-black dark:text-white">{(Number(currentBannerConfig.scale) * 100).toFixed(0)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="2.5"
                          step="0.05"
                          value={currentBannerConfig.scale}
                          onChange={(e) => setCurrentBannerConfig((prev) => ({ ...prev, scale: parseFloat(e.target.value) }))}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-black/50 dark:text-white/50 font-mono">
                          <span>50%</span>
                          <span>100%</span>
                          <span>250%</span>
                        </div>
                      </div>

                      {/* Dark Contrast Overlay Opacity */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-black/70 dark:text-white/70 font-medium">Lapisan Gelap Kontras:</span>
                          <span className="font-mono font-bold text-black dark:text-white">{(Number(currentBannerConfig.overlay_opacity) * 100).toFixed(0)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="0.8"
                          step="0.05"
                          value={currentBannerConfig.overlay_opacity}
                          onChange={(e) => setCurrentBannerConfig((prev) => ({ ...prev, overlay_opacity: parseFloat(e.target.value) }))}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-black/50 dark:text-white/50 font-mono">
                          <span>Transparan (0%)</span>
                          <span>Gelap (80%)</span>
                        </div>
                      </div>
                    </div>

                    {/* Save Position Button */}
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveBannerConfig}
                        disabled={savingConfig}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-md transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {savingConfig ? 'Menyimpan...' : `Simpan Pengaturan Posisi ${isDashboard ? 'Dashboard' : 'Login'}`}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
              </>
            ) : (
              <div className="space-y-5">
                {/* Header & Add Button */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-black/15 dark:border-white/15 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-black dark:text-white flex items-center gap-2">
                      <svg className="w-4 h-4 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Manajemen Slide Banner Mobile Dashboard
                    </h2>
                    <p className="text-[11px] text-black/60 dark:text-white/60 mt-0.5">
                      Kelola daftar banner promosi, pengumuman, dan informasi penting yang berputar otomatis di dashboard aplikasi mobile FONA.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenAddSlider}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-md shadow-xs transition cursor-pointer self-start sm:self-auto shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Tambah Slide Banner
                  </button>
                </div>

                {/* Grid Layout: Live Interactive Mockup & Slide List */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Left Column: Live Interactive Mockup */}
                  <div className="lg:col-span-5 flex flex-col items-center">
                    <div className="w-full max-w-[300px] bg-slate-900 rounded-2xl border-2 border-slate-700 shadow-xl p-2.5 overflow-hidden">
                      <div className="flex items-center justify-between px-2 py-1 text-[10px] text-white/70 font-mono border-b border-white/10 mb-2">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                          Live Slide Preview
                        </span>
                        <span>{sliderBanners.filter((b) => b.is_active).length} Aktif</span>
                      </div>

                      {/* Mockup Slide Container */}
                      {sliderBanners.filter((b) => b.is_active).length > 0 ? (
                        (() => {
                          const activeSlides = sliderBanners.filter((b) => b.is_active);
                          const currentSlide = activeSlides[previewSlideIndex % activeSlides.length];
                          return (
                            <div className="relative w-full h-36 rounded-xl overflow-hidden shadow-lg border border-white/15 bg-gradient-to-br from-[#002752] to-[#005B9E]">
                              {/* Background Image */}
                              {currentSlide?.image_url_full || currentSlide?.image_url ? (
                                <img
                                  src={currentSlide.image_url_full || currentSlide.image_url}
                                  alt="Slide Preview"
                                  className="w-full h-full object-cover"
                                />
                              ) : null}

                              {/* Dark Gradient Overlay */}
                              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-black/20" />

                              {/* Slide Content */}
                              <div className="absolute inset-0 p-3 flex flex-col justify-center text-white">
                                {currentSlide?.badge_text && (
                                  <span className="self-start px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-orange-500 text-white mb-1 shadow-xs">
                                    {currentSlide.badge_text}
                                  </span>
                                )}
                                <h4 className="text-xs font-black line-clamp-2 leading-tight">
                                  {currentSlide?.title || 'Judul Banner'}
                                </h4>
                                {currentSlide?.subtitle && (
                                  <p className="text-[9px] text-white/80 line-clamp-2 mt-0.5">
                                    {currentSlide.subtitle}
                                  </p>
                                )}
                              </div>

                              {/* Dot Indicators */}
                              {activeSlides.length > 1 && (
                                <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 px-1.5 py-0.5 rounded-full border border-white/20">
                                  {activeSlides.map((_, dotIdx) => (
                                    <button
                                      key={dotIdx}
                                      type="button"
                                      onClick={() => setPreviewSlideIndex(dotIdx)}
                                      className={`h-1 rounded-full transition-all cursor-pointer ${
                                        dotIdx === (previewSlideIndex % activeSlides.length)
                                          ? 'w-3 bg-cyan-400'
                                          : 'w-1 bg-white/40'
                                      }`}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <div className="w-full h-36 rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center text-white/50 text-xs p-4 text-center">
                          <svg className="w-8 h-8 mb-1 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>Belum ada slide banner aktif</span>
                        </div>
                      )}

                      <div className="mt-2 text-center text-[10px] text-white/50 font-mono">
                        Tampilan otomatis berotasi di aplikasi mobile
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Slide Banners List */}
                  <div className="lg:col-span-7 space-y-3">
                    {loadingSliders ? (
                      <div className="p-8 text-center text-xs text-black/50 dark:text-white/50">
                        Memuat data slide banner...
                      </div>
                    ) : sliderBanners.length === 0 ? (
                      <div className="p-8 text-center rounded-lg border border-dashed border-black/20 dark:border-white/20 text-xs space-y-3">
                        <p className="text-black/60 dark:text-white/60">
                          Belum ada slide banner yang terdaftar. Tambahkan slide banner kustom untuk promosi atau informasi jaringan Anda.
                        </p>
                        <button
                          type="button"
                          onClick={handleOpenAddSlider}
                          className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-md shadow-xs transition"
                        >
                          + Tambah Slide Banner Pertama
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {sliderBanners.map((banner) => (
                          <div
                            key={banner.id}
                            className={`p-3 rounded-lg border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                              banner.is_active
                                ? 'bg-white dark:bg-black/40 border-black/20 dark:border-white/20'
                                : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 opacity-70'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* Thumbnail */}
                              <div className="w-18 h-12 rounded-md overflow-hidden bg-slate-800 shrink-0 border border-black/10 dark:border-white/10 relative">
                                {banner.image_url_full || banner.image_url ? (
                                  <img
                                    src={banner.image_url_full || banner.image_url}
                                    alt={banner.title || 'Slide'}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[9px] text-white/50">
                                    No Image
                                  </div>
                                )}
                                <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 bg-black/70 text-white font-mono text-[8px] rounded">
                                  #{banner.sort_order}
                                </span>
                              </div>

                              {/* Details */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {banner.badge_text && (
                                    <span className="px-1.5 py-0.2 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded text-[9px] font-black uppercase">
                                      {banner.badge_text}
                                    </span>
                                  )}
                                  <h4 className="text-xs font-bold text-black dark:text-white truncate">
                                    {banner.title || 'Tanpa Judul'}
                                  </h4>
                                </div>
                                {banner.subtitle && (
                                  <p className="text-[11px] text-black/60 dark:text-white/60 line-clamp-1 mt-0.5">
                                    {banner.subtitle}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-black/50 dark:text-white/50 font-mono">
                                  <span>Aksi: {banner.action_type === 'screen' ? `Layar (${banner.action_url})` : banner.action_type === 'url' ? 'Buka URL' : 'Teks Saja'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Actions & Switch */}
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                              {/* Active Switch Toggle */}
                              <button
                                type="button"
                                onClick={() => handleToggleSlider(banner.id)}
                                title={banner.is_active ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                                className={`px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 cursor-pointer border ${
                                  banner.is_active
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                    : 'bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50 border-black/15 dark:border-white/15'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${banner.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                                {banner.is_active ? 'Aktif' : 'Nonaktif'}
                              </button>

                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditSlider(banner)}
                                className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded border border-transparent hover:border-blue-500/30 transition cursor-pointer"
                                title="Edit Slide Banner"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteSlider(banner.id, banner.title)}
                                className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded border border-transparent hover:border-rose-500/30 transition cursor-pointer"
                                title="Hapus Slide Banner"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
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
        <div className="xl:col-span-5 2xl:col-span-4 space-y-6">
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

      {/* Modal Dialog Form Tambah / Edit Slide Banner */}
      {sliderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-neutral-900 border border-black/30 dark:border-white/30 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-black/15 dark:border-white/15 flex items-center justify-between">
              <h3 className="text-sm font-bold text-black dark:text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {editingSlider ? 'Edit Slide Banner Mobile' : 'Tambah Slide Banner Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setSliderModalOpen(false)}
                className="text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSlider} className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Image Upload & Preview */}
              <div className="space-y-2">
                <label className="font-bold text-black dark:text-white block">
                  Gambar Slide Banner <span className="text-rose-500">*</span>
                </label>
                {sliderPreviewUrl && (
                  <div className="w-full h-32 rounded-lg overflow-hidden border border-black/20 dark:border-white/20 bg-slate-900 relative mb-2">
                    <img
                      src={sliderPreviewUrl}
                      alt="Banner Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-white font-mono">
                      Preview Gambar
                    </div>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <label className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-black dark:text-white font-semibold rounded-md border border-black/20 dark:border-white/20 cursor-pointer transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Pilih File Gambar (Maks 5MB)
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleSliderImageChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="text-[10px] text-black/50 dark:text-white/50">
                  Atau isi URL gambar langsung:
                </div>
                <input
                  type="text"
                  placeholder="https://... (URL gambar)"
                  value={sliderForm.image_url}
                  onChange={(e) => {
                    setSliderForm({ ...sliderForm, image_url: e.target.value });
                    if (!sliderImageFile && e.target.value) {
                      setSliderPreviewUrl(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-1.5 rounded-md border border-black/20 dark:border-white/20 bg-transparent text-black dark:text-white text-xs focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {/* Title & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-bold text-black dark:text-white block">Judul Banner</label>
                  <input
                    type="text"
                    placeholder="Contoh: Promo Pasang Baru Fiber Optic"
                    value={sliderForm.title}
                    onChange={(e) => setSliderForm({ ...sliderForm, title: e.target.value })}
                    maxLength={150}
                    className="w-full px-3 py-1.5 rounded-md border border-black/20 dark:border-white/20 bg-transparent text-black dark:text-white text-xs focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-black dark:text-white block">Badge Teks</label>
                  <input
                    type="text"
                    placeholder="PROMO / INFO"
                    value={sliderForm.badge_text}
                    onChange={(e) => setSliderForm({ ...sliderForm, badge_text: e.target.value })}
                    maxLength={30}
                    className="w-full px-3 py-1.5 rounded-md border border-black/20 dark:border-white/20 bg-transparent text-black dark:text-white text-xs focus:ring-1 focus:ring-cyan-500 uppercase font-mono"
                  />
                </div>
              </div>

              {/* Subtitle */}
              <div className="space-y-1">
                <label className="font-bold text-black dark:text-white block">Subjudul / Deskripsi Singkat</label>
                <textarea
                  placeholder="Deskripsi singkat yang tampil di bawah judul banner..."
                  value={sliderForm.subtitle}
                  onChange={(e) => setSliderForm({ ...sliderForm, subtitle: e.target.value })}
                  rows={2}
                  maxLength={300}
                  className="w-full px-3 py-1.5 rounded-md border border-black/20 dark:border-white/20 bg-transparent text-black dark:text-white text-xs focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {/* Action Type & Action Target */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-black dark:text-white block">Tipe Aksi Saat Diklik</label>
                  <select
                    value={sliderForm.action_type}
                    onChange={(e) => setSliderForm({ ...sliderForm, action_type: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-md border border-black/20 dark:border-white/20 bg-white dark:bg-black text-black dark:text-white text-xs focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="none">Hanya Teks &amp; Informasi</option>
                    <option value="screen">Buka Layar / Menu Mobile</option>
                    <option value="url">Buka Tautan Eksternal / Web</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-black dark:text-white block">Target Aksi</label>
                  {sliderForm.action_type === 'screen' ? (
                    <select
                      value={sliderForm.action_url}
                      onChange={(e) => setSliderForm({ ...sliderForm, action_url: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-md border border-black/20 dark:border-white/20 bg-white dark:bg-black text-black dark:text-white text-xs focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value="">-- Pilih Layar Tujuan --</option>
                      <option value="gis_map">Topologi GIS &amp; Peta Kabel</option>
                      <option value="olt">Daftar Data OLT</option>
                      <option value="nodes">Daftar Data Node</option>
                      <option value="customers">Daftar Data Pelanggan</option>
                      <option value="tickets">Daftar Tiket Gangguan</option>
                      <option value="alerts">Log Trap &amp; System Alert</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled={sliderForm.action_type === 'none'}
                      placeholder={sliderForm.action_type === 'url' ? 'https://fona.id/promo' : '-'}
                      value={sliderForm.action_url}
                      onChange={(e) => setSliderForm({ ...sliderForm, action_url: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-md border border-black/20 dark:border-white/20 bg-transparent text-black dark:text-white text-xs focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
                    />
                  )}
                </div>
              </div>

              {/* Sort Order & Is Active */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1 border-t border-black/10 dark:border-white/10">
                <div className="space-y-1">
                  <label className="font-bold text-black dark:text-white block">Nomor Urutan Tampil</label>
                  <input
                    type="number"
                    min="1"
                    value={sliderForm.sort_order}
                    onChange={(e) => setSliderForm({ ...sliderForm, sort_order: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-1.5 rounded-md border border-black/20 dark:border-white/20 bg-transparent text-black dark:text-white text-xs focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="slider_active_checkbox"
                    checked={sliderForm.is_active}
                    onChange={(e) => setSliderForm({ ...sliderForm, is_active: e.target.checked })}
                    className="w-4 h-4 accent-cyan-600 rounded cursor-pointer"
                  />
                  <label htmlFor="slider_active_checkbox" className="text-xs font-bold text-black dark:text-white cursor-pointer select-none">
                    Aktifkan Slide Banner Ini
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-black/15 dark:border-white/15 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSliderModalOpen(false)}
                  className="px-4 py-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 text-black dark:text-white rounded-md text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingSlider}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-md text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {savingSlider ? 'Menyimpan...' : (editingSlider ? 'Perbarui Slide Banner' : 'Simpan Slide Banner')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
