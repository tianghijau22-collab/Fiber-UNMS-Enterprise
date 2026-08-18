import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * PageTransitionWrapper
 * Memberikan animasi transisi laser sinkronisasi telemetri di bagian atas dan
 * efek animasi data reveal / smooth fade-up pada setiap perpindahan halaman.
 */
export default function PageTransitionWrapper({ children }) {
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    // Scroll ke atas setiap berganti halaman
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Picu animasi laser sync beam di atas
    setIsNavigating(true);
    const timer = setTimeout(() => {
      setIsNavigating(false);
    }, 380);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <div className="relative w-full">
      {/* ── Top High-Tech Fiber Laser Sync Beam ── */}
      {isNavigating && (
        <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none h-1 overflow-hidden">
          <div className="h-full bg-linear-to-r from-blue-600 via-cyan-400 to-emerald-400 animate-laser-beam shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
        </div>
      )}

      {/* ── Page Content Container with Staggered Entrance ── */}
      <div key={location.pathname} className="animate-page-enter w-full">
        {children}
      </div>
    </div>
  );
}
