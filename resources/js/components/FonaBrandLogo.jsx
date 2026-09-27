import React from 'react';

export default function FonaBrandLogo({ className = "h-16 w-auto", showTagline = false }) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 320 160"
        className="w-full h-full max-w-[240px] overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Main F-Wave Gradients */}
          <linearGradient id="fonaWaveGrad1" x1="0%" y1="0%" x2="100%" y2="80%">
            <stop offset="0%" stopColor="#00f5ff" />
            <stop offset="45%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>

          <linearGradient id="fonaWaveGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="60%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          <linearGradient id="fonaCyanDelta" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#00f5ff" />
          </linearGradient>

          <filter id="fonaGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── 1. F-SYMBOL ICON (TOP) ── */}
        <g transform="translate(110, 4)">
          {/* Top Wing / Wave Plume */}
          <path
            d="M 12 40 C 14 18, 38 4, 76 2 C 86 1, 92 6, 82 14 C 64 28, 34 38, 12 40 Z"
            fill="url(#fonaWaveGrad1)"
            filter="url(#fonaGlow)"
          />

          {/* Main F Curve Body */}
          <path
            d="M 14 42 C 28 32, 54 28, 70 34 C 78 37, 78 48, 68 51 C 52 56, 32 60, 22 74 C 15 84, 12 94, 14 96 C 10 90, 8 72, 12 56 Z"
            fill="url(#fonaWaveGrad2)"
          />

          {/* Glowing Optical Node / Light Dot */}
          <circle cx="68" cy="42" r="6" fill="#ffffff" stroke="#00f5ff" strokeWidth="2.5" filter="url(#fonaGlow)" />
        </g>

        {/* ── 2. "FONA" LOGOTYPE (BOTTOM) ── */}
        <g transform="translate(48, 114)" className="fill-slate-900 dark:fill-white transition-colors duration-200">
          {/* F */}
          <path
            d="M 0 0 L 34 0 C 40 0, 44 4, 44 10 C 44 14, 41 17, 36 18 L 14 18 L 14 26 L 30 26 C 35 26, 38 29, 38 34 C 38 39, 35 42, 30 42 L 14 42 L 14 46 C 14 49, 11 52, 7 52 C 3 52, 0 49, 0 46 Z"
          />

          {/* O */}
          <g transform="translate(56, 0)">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M 14 0 C 5 0, 0 7, 0 16 L 0 36 C 0 45, 5 52, 14 52 L 40 52 C 49 52, 54 45, 54 36 L 54 16 C 54 7, 49 0, 40 0 Z M 15 14 C 14 14, 14 15, 14 17 L 14 35 C 14 37, 14 38, 15 38 L 39 38 C 40 38, 40 37, 40 35 L 40 17 C 40 15, 40 14, 39 14 Z"
            />
          </g>

          {/* N */}
          <g transform="translate(122, 0)">
            <path
              d="M 0 4 L 0 48 C 0 50, 2 52, 5 52 C 8 52, 11 50, 12 47 L 38 12 L 38 48 C 38 50, 40 52, 44 52 C 48 52, 50 50, 50 48 L 50 4 C 50 2, 48 0, 45 0 C 42 0, 39 2, 38 5 L 12 40 L 12 4 C 12 2, 10 0, 6 0 C 2 0, 0 2, 0 4 Z"
            />
          </g>

          {/* A */}
          <g transform="translate(184, 0)">
            {/* Outer A Shape */}
            <path
              d="M 24 0 C 27 0, 30 2, 32 6 L 52 46 C 54 49, 52 52, 48 52 C 44 52, 42 50, 40 46 L 35 34 L 13 34 L 8 46 C 6 50, 4 52, 0 52 C -4 52, -2 49, 0 46 L 20 6 C 22 2, 25 0, 28 0 Z"
            />
            {/* Cyan Delta Triangle Inset */}
            <polygon
              points="24,14 16,30 32,30"
              fill="url(#fonaCyanDelta)"
              filter="url(#fonaGlow)"
            />
          </g>
        </g>
      </svg>

      {showTagline && (
        <span className="text-[10px] font-medium tracking-[0.25em] text-slate-500 dark:text-slate-400 uppercase mt-1">
          Fiber Optic Network Analysis
        </span>
      )}
    </div>
  );
}
