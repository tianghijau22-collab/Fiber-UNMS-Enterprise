import React from 'react';

export default function FonaBrandLogo({ className = "w-56 sm:w-64 h-auto", showTagline = false }) {
  return (
    <div className="flex flex-col items-center justify-center select-none">
      {/* Light Mode Logo (Deep Navy Text) */}
      <img
        src="/images/brand/fona_logo_light.png"
        alt="FONA — Fiber Optic Network Analysis"
        className={`dark:hidden object-contain ${className}`}
      />

      {/* Dark Mode Logo (Crisp White Text + Glowing Cyan Delta) */}
      <img
        src="/images/brand/fona_logo_dark.png"
        alt="FONA — Fiber Optic Network Analysis"
        className={`hidden dark:block object-contain filter drop-shadow-[0_0_16px_rgba(6,182,212,0.3)] ${className}`}
      />
    </div>
  );
}
