import React, { useEffect, useState } from 'react';
import FonaBrandLogo from './FonaBrandLogo.jsx';

/**
 * Modern High-Tech FONA Fiber-Optic Loading Splash Screen
 * Features:
 * - Dynamic Fiber Optic Telemetry Sequence
 * - High-speed Laser Waveguide Conduit Animation
 * - High-contrast Monochrome Baseline with Cyan Laser Glow
 * - Zero-Emoji Policy conforming to DESIGN_SYSTEM_STANDARDS.md
 */
export default function LoadingScreen({ message = "Memuat FONA Enterprise...", onComplete }) {
  const [progress, setProgress] = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);

  const telemetrySteps = [
    { title: "Inisialisasi Core Engine", detail: "Memeriksa driver telemetri SNMP & modul GIS..." },
    { title: "Sinkronisasi OLT & PON Port", detail: "Menghubungkan link telemetri Solok & Padang..." },
    { title: "Kalibrasi Sinyal Optik", detail: "RX/TX Optical Power: -19.4 dBm (Normal)..." },
    { title: "Membangun Topologi Jaringan", detail: "Menyiapkan matriks core fiber & rute kabel..." },
    { title: "Sistem Siap Operasional", detail: "Membuka antarmuka dashboard FONA..." }
  ];

  useEffect(() => {
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 12) + 8;
      if (currentProgress >= 100) {
        currentProgress = 100;
        setProgress(100);
        setStatusIdx(4);
        clearInterval(interval);
        if (onComplete) setTimeout(onComplete, 350);
      } else {
        setProgress(currentProgress);
        const idx = Math.min(3, Math.floor((currentProgress / 100) * 4));
        setStatusIdx(idx);
      }
    }, 110);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black text-white overflow-hidden font-sans select-none">
      
      {/* Laser Waveguide Grid Background Effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d40a_1px,transparent_1px),linear-gradient(to_bottom,#06b6d40a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative flex flex-col items-center space-y-7 z-10 max-w-md w-full px-6 text-center">
        
        {/* Animated Fiber Optics Pulse Logo Centerpiece */}
        <div className="relative flex items-center justify-center">
          {/* Outer Pulsing Waveguide Rings */}
          <div className="absolute w-36 h-36 rounded-full border border-cyan-500/20 animate-ping opacity-40" />
          <div className="absolute w-32 h-32 rounded-full border border-cyan-500/30 animate-spin" style={{ animationDuration: '8s' }} />
          <div className="absolute w-28 h-28 rounded-full border border-dashed border-blue-500/40 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '5s' }} />

          {/* Logo Card Container */}
          <div className="relative w-24 h-24 rounded-2xl bg-black border border-white/70 flex items-center justify-center p-3 shadow-2xl shadow-cyan-500/30">
            <FonaBrandLogo variant="icon" className="w-full h-full" />
          </div>
        </div>

        {/* Brand Lockup */}
        <div className="space-y-1.5">
          <div className="flex justify-center">
            <FonaBrandLogo className="w-48 sm:w-56 h-auto" />
          </div>
        </div>

        {/* High-Tech Optical Telemetry Readout Box */}
        <div className="w-full bg-white/5 border border-white/20 rounded-lg p-4 space-y-3.5 backdrop-blur-md text-left">
          
          {/* Telemetry Header */}
          <div className="flex items-center justify-between text-[11px] font-mono border-b border-white/10 pb-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>TELEMETRY STREAM</span>
            </div>
            <span className="text-white/60 font-semibold">{progress}% COMPLETE</span>
          </div>

          {/* Status Details */}
          <div className="space-y-1 min-h-[40px]">
            <div className="text-xs font-bold text-white tracking-wide flex items-center gap-2">
              <span className="text-cyan-400 font-mono">&gt;</span>
              <span>{telemetrySteps[statusIdx].title}</span>
            </div>
            <div className="text-[11px] text-white/60 font-mono truncate">
              {telemetrySteps[statusIdx].detail}
            </div>
          </div>

          {/* Laser Conduit Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden p-0.5 relative">
              {/* Laser Beam Gradient Fill */}
              <div
                className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-white rounded-full transition-all duration-200 ease-out relative shadow-[0_0_12px_rgba(6,182,212,0.8)]"
                style={{ width: `${progress}%` }}
              >
                {/* Leading Photon Point */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_8px_#ffffff]" />
              </div>
            </div>

            {/* Bottom Live Metrics */}
            <div className="flex items-center justify-between text-[10px] font-mono text-white/40 pt-1">
              <span>LAMBDA: 1310/1490nm</span>
              <span>BER: &lt; 10^-12</span>
              <span>SEC: AES-256</span>
            </div>
          </div>

        </div>

        {/* Footer Security Notice */}
        <div className="text-[11px] font-mono text-white/40 tracking-wider">
          FONA ENTERPRISE · FIBER OPTIC NETWORK ANALYSIS
        </div>

      </div>
    </div>
  );
}
