import React from 'react';

/**
 * FonaBrandLogo — Komponen Logo Resmi Brand FONA Ultra-HD Retina.
 * Dilengkapi cache-busting versioning agar browser selalu memuat asset terbaru tanpa terhalang cache.
 */
const ASSET_VERSION = 'v=20261001_hd_v5';

export default function FonaBrandLogo({
  className = "w-52 sm:w-60 h-auto",
  variant = "full",
  alt = "FONA — Fiber Optic Network Analysis"
}) {
  if (variant === "icon") {
    return (
      <img
        src={`/images/brand/fona_icon_clean.png?${ASSET_VERSION}`}
        alt="FONA Icon"
        decoding="async"
        className={`object-contain select-none ${className}`}
      />
    );
  }

  if (variant === "horizontal" || variant === "wordmark") {
    return (
      <div className="flex items-center justify-center select-none">
        {/* Light Mode Horizontal Wordmark */}
        <img
          src={`/images/brand/fona_horizontal_light.png?${ASSET_VERSION}`}
          alt={alt}
          decoding="async"
          className={`dark:hidden object-contain ${className}`}
        />
        {/* Dark Mode Horizontal Wordmark */}
        <img
          src={`/images/brand/fona_horizontal_dark.png?${ASSET_VERSION}`}
          alt={alt}
          decoding="async"
          className={`hidden dark:block object-contain ${className}`}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center select-none">
      {/* Light Mode Logo */}
      <img
        src={`/images/brand/fona_logo_light.png?${ASSET_VERSION}`}
        alt={alt}
        decoding="async"
        className={`dark:hidden object-contain ${className}`}
      />

      {/* Dark Mode Logo */}
      <img
        src={`/images/brand/fona_logo_dark.png?${ASSET_VERSION}`}
        alt={alt}
        decoding="async"
        className={`hidden dark:block object-contain ${className}`}
      />
    </div>
  );
}
