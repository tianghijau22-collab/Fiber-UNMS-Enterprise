import React, { useEffect, useState } from 'react';

export default function LoadingScreen({ message = "Memuat Sistem Fiber-UNMS...", onComplete }) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Mengisiasi koneksi telemetri...");

  useEffect(() => {
    const statuses = [
      "Mengisiasi koneksi telemetri...",
      "Memuat data GIS & topologi jaringan...",
      "Menghubungkan ke OLT Solok & Padang...",
      "Menyiapkan dashboard operasional...",
      "Sistem Siap!"
    ];

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 15) + 10;
      if (currentProgress >= 100) {
        currentProgress = 100;
        setProgress(100);
        setStatusText(statuses[4]);
        clearInterval(interval);
        if (onComplete) setTimeout(onComplete, 400);
      } else {
        setProgress(currentProgress);
        const statusIdx = Math.min(3, Math.floor((currentProgress / 100) * 4));
        setStatusText(statuses[statusIdx]);
      }
    }, 120);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white overflow-hidden font-sans select-none">
      
      {/* Background Fiber Glow Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 w-[350px] h-[350px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Center Animated Core */}
      <div className="relative flex flex-col items-center space-y-8 z-10 max-w-sm px-6 text-center">
        
        {/* Animated Fiber Optics Pulse Logo */}
        <div className="relative flex items-center justify-center">
          
          {/* Rotating Outer Gradient Ring */}
          <div className="absolute w-28 h-28 rounded-3xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 animate-spin opacity-75 blur-sm" style={{ animationDuration: '4s' }} />

          {/* Inner Pulsing Aura */}
          <div className="absolute w-24 h-24 rounded-2xl bg-indigo-600/40 animate-ping opacity-50" />

          {/* Logo Container */}
          <div className="relative w-24 h-24 rounded-2xl bg-slate-900 border border-slate-700/80 flex items-center justify-center shadow-2xl shadow-indigo-500/30">
            <svg className="w-12 h-12 text-indigo-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>

        {/* Brand Text */}
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tight text-white">Fiber-UNMS</h2>
          <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest">Enterprise Platform</p>
        </div>

        {/* Status Message */}
        <div className="space-y-3 w-full">
          <p className="text-xs font-semibold text-slate-300 transition-all duration-300 min-h-[18px]">
            {statusText}
          </p>

          {/* Progress Bar Container */}
          <div className="w-full h-2 bg-slate-900 border border-slate-800 rounded-full overflow-hidden p-0.5 relative shadow-inner">
            {/* Animated Laser Gradient Fill */}
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 rounded-full transition-all duration-200 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              {/* Shimmer Sparkle effect on tip */}
              <div className="absolute right-0 top-0 bottom-0 w-3 bg-white/80 rounded-full blur-[1px] shadow-sm shadow-white" />
            </div>
          </div>

          {/* Percentage Counter */}
          <div className="text-[11px] font-mono font-bold text-slate-500">
            {progress}%
          </div>
        </div>

      </div>

      {/* Footer Info */}
      <div className="absolute bottom-8 text-[11px] text-slate-600 font-medium">
        Fiber-UNMS Enterprise v1.0 · Sistem Otentikasi Terenkripsi
      </div>
    </div>
  );
}
