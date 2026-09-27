import React from 'react';

export default function FonaBrandLogo({ className = "w-56 sm:w-64 h-auto", variant = "full" }) {
  if (variant === "icon") {
    return (
      <img
        src="/images/brand/fona_icon_clean.png"
        alt="FONA Icon"
        className={`object-contain select-none ${className}`}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center select-none">
      {/* Light Mode Logo (Original 3D Sapphire Blue) */}
      <img
        src="/images/brand/fona_logo_light.png"
        alt="FONA — Fiber Optic Network Analysis"
        className={`dark:hidden object-contain ${className}`}
      />

      {/* Dark Mode Logo (Original 3D Sapphire with White Tagline) */}
      <img
        src="/images/brand/fona_logo_dark.png"
        alt="FONA — Fiber Optic Network Analysis"
        className={`hidden dark:block object-contain ${className}`}
      />
    </div>
  );
}
