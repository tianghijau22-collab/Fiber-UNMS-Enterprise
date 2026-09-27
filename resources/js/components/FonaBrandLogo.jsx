import React from 'react';

export default function FonaBrandLogo({ className = "w-64 sm:w-72 h-auto", variant = "full" }) {
  if (variant === "icon") {
    return (
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <defs>
          <linearGradient id="fonaIconGradWing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f0ff" />
            <stop offset="50%" stopColor="#0088ff" />
            <stop offset="100%" stopColor="#0044ee" />
          </linearGradient>
          <linearGradient id="fonaIconGradFin" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00d4ff" />
            <stop offset="100%" stopColor="#0033cc" />
          </linearGradient>
          <filter id="fonaIconGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Top Wing */}
        <path
          d="M 22 75 C 22 38, 48 18, 102 16 C 118 15, 120 20, 114 26 C 94 44, 58 52, 42 66 C 32 74, 28 88, 26 108 C 24 114, 22 108, 22 75 Z"
          fill="url(#fonaIconGradWing)"
        />

        {/* Lower Fin */}
        <path
          d="M 26 66 C 24 82, 16 104, 18 116 C 19 122, 24 116, 34 96 C 40 84, 44 72, 44 64 Z"
          fill="url(#fonaIconGradFin)"
        />

        {/* Waveguide Node Line */}
        <path
          d="M 34 66 Q 66 60 92 54"
          stroke="#00f0ff"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          filter="url(#fonaIconGlow)"
        />
        <circle cx="92" cy="54" r="6" fill="#ffffff" stroke="#00f0ff" strokeWidth="2.5" />
      </svg>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 540 148"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto"
      >
        <defs>
          <linearGradient id="fonaWing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f0ff" />
            <stop offset="45%" stopColor="#0088ff" />
            <stop offset="100%" stopColor="#0044ee" />
          </linearGradient>
          <linearGradient id="fonaFin" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00d4ff" />
            <stop offset="100%" stopColor="#0033cc" />
          </linearGradient>
          <linearGradient id="cyanDelta" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#0077ff" />
            <stop offset="100%" stopColor="#00f2fe" />
          </linearGradient>
          <filter id="fonaNodeGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── F Wave Vector Mark ── */}
        <g transform="translate(10, 8)">
          {/* Top Wing */}
          <path
            d="M 20 76 C 22 38, 50 16, 112 14 C 132 13, 136 18, 128 25 C 106 44, 66 52, 45 66 C 34 74, 29 88, 27 110 C 25 116, 20 110, 20 76 Z"
            fill="url(#fonaWing)"
          />

          {/* Lower Fin */}
          <path
            d="M 27 66 C 25 82, 17 106, 18 120 C 19 126, 25 120, 36 100 C 42 86, 46 74, 46 66 Z"
            fill="url(#fonaFin)"
          />

          {/* Waveguide Line & Node */}
          <path
            d="M 36 66 Q 72 60 98 54"
            stroke="#00f0ff"
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
            filter="url(#fonaNodeGlow)"
          />
          <circle cx="98" cy="54" r="6.5" fill="#ffffff" stroke="#00f0ff" strokeWidth="3" />
        </g>

        {/* ── ONA Geometric Typography ── */}
        <g className="fill-[#06173d] dark:fill-white transition-colors duration-200">
          {/* 'O' */}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M 172 26 C 150 26 136 40 136 67 C 136 94 150 108 172 108 L 214 108 C 236 108 250 94 250 67 C 250 40 236 26 214 26 L 172 26 Z M 174 48 L 212 48 C 222 48 227 55 227 67 C 227 79 222 86 212 86 L 174 86 C 164 86 159 79 159 67 C 159 55 164 48 174 48 Z"
          />

          {/* 'N' */}
          <path d="M 270 26 L 297 26 L 338 78 L 338 26 L 364 26 L 364 108 L 337 108 L 296 56 L 296 108 L 270 108 Z" />

          {/* 'A' */}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M 426 26 L 476 108 L 448 108 L 436 86 L 398 86 L 386 108 L 358 108 L 408 26 L 426 26 Z M 417 50 L 404 74 L 430 74 L 417 50 Z"
          />
        </g>

        {/* ── Glowing Cyan Delta inside 'A' ── */}
        <polygon points="417,49 431,75 403,75" fill="url(#cyanDelta)" />

        {/* ── Tagline: Fiber Optic Network Analysis ── */}
        <text
          x="138"
          y="136"
          className="fill-[#06173d] dark:fill-white/90 font-sans text-[13px] font-bold tracking-[0.24em] transition-colors duration-200"
          style={{ letterSpacing: '0.24em' }}
        >
          FIBER OPTIC NETWORK ANALYSIS
        </text>
      </svg>
    </div>
  );
}
