import React from 'react';

/**
 * FonaBrandLogo — Komponen Logo Resmi Brand FONA (Fiber Optic Network Analysis).
 * Mendukung varian Full (vertikal), Horizontal (navbar/sidebar), dan Icon (mark).
 * Otomatis beradaptasi dengan mode Terang (Light) dan Gelap (Dark).
 */
export default function FonaBrandLogo({ className = "w-52 sm:w-60 h-auto", variant = "full", alt = "FONA — Fiber Optic Network Analysis" }) {
  if (variant === "icon") {
    return (
      <img
        src="/images/brand/fona_icon_clean.png"
        alt="FONA Icon"
        className={`object-contain select-none ${className}`}
      />
    );
  }

  if (variant === "horizontal") {
    return (
      <div className="flex items-center justify-center select-none">
        {/* Light Mode Horizontal */}
        <img
          src="/images/brand/fona_horizontal_light.png"
          alt={alt}
          className={`dark:hidden object-contain ${className}`}
        />
        {/* Dark Mode Horizontal */}
        <img
          src="/images/brand/fona_horizontal_dark.png"
          alt={alt}
          className={`hidden dark:block object-contain ${className}`}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center select-none">
      {/* Light Mode Logo */}
      <img
        src="/images/brand/fona_logo_light.png"
        alt={alt}
        className={`dark:hidden object-contain ${className}`}
      />

      {/* Dark Mode Logo */}
      <img
        src="/images/brand/fona_logo_dark.png"
        alt={alt}
        className={`hidden dark:block object-contain ${className}`}
      />
    </div>
  );
}
