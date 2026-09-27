import React from 'react';

export default function FonaBrandLogo({ className = "w-56 sm:w-64 h-auto", showTagline = false }) {
  return (
    <div className="flex flex-col items-center justify-center select-none">
      {/* Light Mode Logo (Original 3D Sapphire Blue) */}
      <img
        src="/images/brand/fona_logo_light.png"
        alt="FONA — Fiber Optic Network Analysis"
        className={`dark:hidden object-contain ${className}`}
      />

      {/* Dark Mode Logo (Enhanced 3D Glossy Sapphire + White Tagline on Pitch Black) */}
      <img
        src="/images/brand/fona_logo_dark.png"
        alt="FONA — Fiber Optic Network Analysis"
        className={`hidden dark:block object-contain ${className}`}
      />
    </div>
  );
}
