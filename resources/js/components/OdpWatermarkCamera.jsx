import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/* ── SVG Icons ── */
const IconCamera = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconRotate = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const IconX = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const IconUpload = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

export default function OdpWatermarkCamera({
  isOpen,
  onClose,
  onCapture,
  title = 'Ambil Foto Lapangan',
  subtitle = 'Foto akan otomatis diberi watermark timestamp, ODP, dBm & koordinat GPS',
  metaData = {},
}) {
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) | 'user' (front)
  const [cameraError, setCameraError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Inisialisasi Kamera WebRTC
  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.warn('Live camera error:', err);
      setCameraError('Kamera langsung tidak dapat diakses di browser ini. Anda tetap dapat menggunakan tombol Unggah / Kamera HP.');
    }
  }, [facingMode]);

  // Start / Stop camera saat modal open / close
  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      startCamera();
    } else {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, startCamera]);

  // Switch Depan / Belakang
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Helper Stamp Watermark ke Canvas
  const stampWatermarkToCanvas = (sourceImgOrVideo, width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 1. Gambar foto utama
    ctx.drawImage(sourceImgOrVideo, 0, 0, width, height);

    // 2. Buat Banner Watermark di bagian bawah (Semi-transparan hitam pekat)
    const bannerHeight = Math.max(130, Math.round(height * 0.18));
    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.fillRect(0, height - bannerHeight, width, bannerHeight);

    // Garis aksen atas banner
    ctx.fillStyle = '#3b82f6'; // Blue accent
    ctx.fillRect(0, height - bannerHeight, width, 4);

    // 3. Format Data Watermark
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + ' WIB';

    const odpCode = metaData.odp_code || 'ODP-UNMS';
    const port = metaData.port_number || 'Port 1';
    const dbm = metaData.power_measurement_dbm ? `${metaData.power_measurement_dbm} dBm` : '- dBm';
    const status = metaData.power_status ? metaData.power_status.toUpperCase() : 'CHECK';
    const techName = metaData.technician_name || 'Teknisi Lapangan';
    const coords = metaData.latitude && metaData.longitude
      ? `Lat: ${Number(metaData.latitude).toFixed(6)}, Lng: ${Number(metaData.longitude).toFixed(6)}`
      : 'GPS: Lokasi Terdeteksi';

    // 4. Render Teks Watermark
    const baseFontSize = Math.max(14, Math.round(width * 0.022));
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';

    // Header Stamp
    ctx.font = `bold ${Math.round(baseFontSize * 1.15)}px sans-serif`;
    ctx.fillStyle = '#60a5fa'; // Light blue
    ctx.fillText('FIBER-UNMS FIELD VERIFICATION', 20, height - bannerHeight + 25);

    // Baris 1: Kode ODP & Port & Redaman
    ctx.font = `bold ${baseFontSize}px monospace`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`ODP: ${odpCode} | Port: ${port}`, 20, height - bannerHeight + 52);

    // Status Redaman Badge
    ctx.fillStyle = status === 'GOOD' ? '#10b981' : status === 'WARNING' ? '#f59e0b' : '#ef4444';
    ctx.fillText(`OPM: ${dbm} [${status}]`, 20, height - bannerHeight + 76);

    // Baris 2: GPS & Waktu & Teknisi
    ctx.font = `normal ${Math.round(baseFontSize * 0.9)}px sans-serif`;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`${coords}`, 20, height - bannerHeight + 100);

    // Timestamp & Petugas di kanan bawah
    ctx.textAlign = 'right';
    ctx.fillText(`${dateStr} ${timeStr}`, width - 20, height - bannerHeight + 52);
    ctx.fillText(`Petugas: ${techName}`, width - 20, height - bannerHeight + 76);
    ctx.fillText(`Sistem Fiber-UNMS Enterprise`, width - 20, height - bannerHeight + 100);

    return canvas.toDataURL('image/jpeg', 0.88);
  };

  // Tangkap dari Live Video
  const handleCaptureLive = () => {
    if (!videoRef.current) return;
    setIsProcessing(true);
    try {
      const video = videoRef.current;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const dataUrl = stampWatermarkToCanvas(video, width, height);
      setCapturedImage(dataUrl);
    } catch (e) {
      console.error('Error capturing from video:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Tangkap dari File Input / Kamera Native HP
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        const dataUrl = stampWatermarkToCanvas(img, width, height);
        setCapturedImage(dataUrl);
        setIsProcessing(false);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Konfirmasi dan kirim foto ke form induk
  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto min-h-screen">
      <div className="relative w-full max-w-2xl bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-3xl shadow-2xl flex flex-col my-auto max-h-[92vh] overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between bg-white dark:bg-black flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-black dark:text-white flex items-center gap-2">
              <IconCamera />
              <span>{title}</span>
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-neutral-900 text-neutral-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
          >
            <IconX />
          </button>
        </div>

        {/* Viewfinder / Preview Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-slate-900">
          {capturedImage ? (
            // Hasil Foto Ber-Watermark
            <div className="relative w-full flex flex-col items-center">
              <img
                src={capturedImage}
                alt="Hasil Watermark Lapangan"
                className="max-h-[60vh] w-auto object-contain rounded-2xl border border-neutral-700 shadow-xl"
              />
              <span className="mt-2 text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                <IconCheck /> Watermark Timestamp &amp; Geotagging Berhasil Diterapkan
              </span>
            </div>
          ) : (
            // Live Camera Viewfinder
            <div className="relative w-full flex flex-col items-center">
              {cameraError ? (
                <div className="w-full py-12 px-6 text-center text-xs text-neutral-400 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-3">
                  <p className="text-rose-400 font-bold">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition-all inline-flex items-center gap-2 cursor-pointer"
                  >
                    <IconUpload />
                    <span>Ambil dari Kamera HP / Galeri</span>
                  </button>
                </div>
              ) : (
                <div className="relative w-full overflow-hidden rounded-2xl border border-neutral-800 bg-black aspect-video sm:aspect-4/3 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay Viewfinder Grid */}
                  <div className="absolute inset-0 border border-white/20 pointer-events-none grid grid-cols-3 grid-rows-3">
                    <div className="border-r border-b border-white/10" />
                    <div className="border-r border-b border-white/10" />
                    <div className="border-b border-white/10" />
                    <div className="border-r border-b border-white/10" />
                    <div className="border-r border-b border-white/10" />
                    <div className="border-b border-white/10" />
                    <div className="border-r border-white/10" />
                    <div className="border-r border-white/10" />
                    <div />
                  </div>

                  {/* Stamp Watermark Live Badge Preview */}
                  <div className="absolute bottom-2 left-2 right-2 bg-black/75 backdrop-blur-xs p-2.5 rounded-xl border border-white/10 text-[10px] text-white space-y-0.5">
                    <div className="font-bold text-blue-400">FIBER-UNMS WATERMARK ENGINE</div>
                    <div className="font-mono text-neutral-200">
                      ODP: {metaData.odp_code || 'ODP-AUTO'} | Port: {metaData.port_number || 'Port 1'} | OPM: {metaData.power_measurement_dbm ? `${metaData.power_measurement_dbm} dBm` : '- dBm'}
                    </div>
                    <div className="text-neutral-400">
                      {metaData.latitude ? `GPS: ${metaData.latitude}, ${metaData.longitude}` : 'GPS: Mendeteksi...'} | {new Date().toLocaleDateString('id-ID')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Hidden File Input for Native Camera / Gallery */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-neutral-800 bg-white dark:bg-black flex items-center justify-between flex-shrink-0">
          {capturedImage ? (
            <>
              <button
                type="button"
                onClick={() => setCapturedImage(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 text-xs font-bold text-black dark:text-white hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <IconRotate />
                <span>Foto Ulang</span>
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-5 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-xs hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <IconCheck />
                <span>Gunakan Foto Ini</span>
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 text-xs font-bold text-black dark:text-white hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Pilih dari Galeri atau Kamera Bawaan HP"
                >
                  <IconUpload />
                  <span>Kamera HP / File</span>
                </button>
                {!cameraError && (
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="p-2 rounded-xl border border-slate-300 dark:border-neutral-700 text-black dark:text-white hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                    title="Ganti Kamera Depan / Belakang"
                  >
                    <IconRotate />
                  </button>
                )}
              </div>

              {!cameraError && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleCaptureLive}
                  className="px-6 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-xs hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <IconCamera />
                  <span>{isProcessing ? 'Memproses...' : 'Ambil Foto'}</span>
                </button>
              )}
            </>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}
