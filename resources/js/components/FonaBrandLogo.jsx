import React from 'react';

export default function FonaBrandLogo({ className = "w-48 sm:w-56 h-auto", showTagline = false }) {
  return (
    <div className="flex flex-col items-center justify-center select-none">
      {/* Light Mode Logo (Deep Navy Text) */}
      <img
        src="/images/brand/fona_logo_light.png"
        alt="FONA — Fiber Optical Network Analysis"
        className={`dark:hidden object-contain ${className}`}
      />

      {/* Dark Mode Logo (Crisp White Text + Glowing Cyan Delta) */}
      <img
        src="/images/brand/fona_logo_dark.png"
        alt="FONA — Fiber Optical Network Analysis"
        className={`hidden dark:block object-contain filter drop-shadow-[0_0_18px_rgba(6,182,212,0.35)] ${className}`}
      />
    </div>
  );
}
