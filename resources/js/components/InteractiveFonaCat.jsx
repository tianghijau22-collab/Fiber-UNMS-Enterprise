import React from 'react';

/* ───────────────────────────────────────────────────────────────────
   Interactive FONA Cyber Fiber Cat Mascot
   - Idle: Gentle breathing, luminous fiber optic tail pulsing with light
   - Username: Curious alert ears, eyes actively tracking typing cursor
   - Password: Cyber paws raising up to cover eyes (peekaboo when toggled)
   - Success: Celebratory cyber leap with luminous fiber pulse & sparkles
   - Error: Sassy puzzled head-shake with alert glow
─────────────────────────────────────────────────────────────────── */
export default function InteractiveFonaCat({
  usernameLength = 0,
  isUsernameFocused = false,
  isPasswordFocused = false,
  showPassword = false,
  mascotState = 'idle' // 'idle' | 'username' | 'password' | 'success' | 'error'
}) {
  const isTyping = mascotState === 'username' || (isUsernameFocused && mascotState !== 'success' && mascotState !== 'error');
  const isCoveringEyes = mascotState === 'password' || (isPasswordFocused && mascotState !== 'success' && mascotState !== 'error');
  const isSuccess = mascotState === 'success';
  const isError = mascotState === 'error';

  // Eye tracking offset (-5px to +5px)
  const maxShift = 5;
  const pupilShiftX = isTyping
    ? Math.min(maxShift, Math.max(-maxShift, (usernameLength - 6) * 0.7))
    : 0;
  const pupilShiftY = isTyping ? 1.2 : 0;

  // Paw covering eyes transforms
  let leftPawTransform = 'translate(0px, 0px) rotate(0deg)';
  let rightPawTransform = 'translate(0px, 0px) rotate(0deg)';

  if (isCoveringEyes) {
    if (!showPassword) {
      // Paws fully covering eyes
      leftPawTransform = 'translate(44px, -62px) rotate(24deg) scale(1.15)';
      rightPawTransform = 'translate(-44px, -62px) rotate(-24deg) scale(1.15)';
    } else {
      // Peeking state (paws slightly separated)
      leftPawTransform = 'translate(22px, -48px) rotate(10deg) scale(1.05)';
      rightPawTransform = 'translate(-22px, -48px) rotate(-10deg) scale(1.05)';
    }
  }

  // Ear tilt when typing
  const earTiltLeft = isTyping ? (Math.sin(usernameLength * 0.9) * 4 - 2) : 0;
  const earTiltRight = isTyping ? (-Math.sin(usernameLength * 0.9) * 4 + 2) : 0;

  let containerAnimationClass = '';
  if (isSuccess) {
    containerAnimationClass = 'animate-fona-leap';
  } else if (isError) {
    containerAnimationClass = 'animate-fona-shake';
  }

  return (
    <>
      <style>{`
        @keyframes fonaTailGlow {
          0%, 100% { filter: drop-shadow(0 0 4px #00f5ff) drop-shadow(0 0 10px #0284c7); }
          50% { filter: drop-shadow(0 0 10px #38bdf8) drop-shadow(0 0 20px #06b6d4); }
        }
        @keyframes fiberPulseDot {
          0%, 100% { transform: scale(0.9); opacity: 0.8; }
          50% { transform: scale(1.35); opacity: 1; }
        }
        @keyframes fonaBreathe {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-2px) scale(1.01); }
        }
        @keyframes fonaLeapOrbit {
          0% { transform: translate3d(0, 0, 0) scale(1) rotate(0deg); opacity: 1; }
          25% { transform: translate3d(20px, -45px, 0) scale(1.15) rotate(8deg); }
          50% { transform: translate3d(0px, -70px, 0) scale(1.25) rotate(0deg); }
          75% { transform: translate3d(-15px, -35px, 0) scale(1.15) rotate(-6deg); }
          100% { transform: translate3d(0, 0, 0) scale(1.05) rotate(0deg); opacity: 1; }
        }
        @keyframes fonaErrorShake {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          20% { transform: translateY(-4px) rotate(-8deg); }
          40% { transform: translateY(-4px) rotate(8deg); }
          60% { transform: translateY(-2px) rotate(-5deg); }
          80% { transform: translateY(-2px) rotate(5deg); }
        }
        .animate-fona-tail {
          animation: fonaTailGlow 2.5s ease-in-out infinite;
        }
        .animate-fiber-pulse {
          animation: fiberPulseDot 1.4s ease-in-out infinite;
        }
        .animate-fona-breathe {
          animation: fonaBreathe 3.5s ease-in-out infinite;
        }
        .animate-fona-leap {
          animation: fonaLeapOrbit 1.8s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
        }
        .animate-fona-shake {
          animation: fonaErrorShake 0.6s ease-in-out 2;
        }
      `}</style>

      <div
        className={`relative w-48 h-44 mx-auto -mb-4 z-20 pointer-events-none select-none transition-transform duration-300 ${containerAnimationClass}`}
      >
        <svg
          viewBox="0 0 240 210"
          className="w-full h-full overflow-visible drop-shadow-xl"
        >
          <defs>
            {/* Cyber Gradient Definitions */}
            <linearGradient id="fonaCatDark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="50%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>

            <linearGradient id="fonaCatWhite" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>

            <linearGradient id="fonaCyanGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#00f5ff" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>

            <linearGradient id="fonaEyeIris" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="60%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#7dd3fc" />
            </linearGradient>

            <linearGradient id="fonaTailGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="40%" stopColor="#00f5ff" />
              <stop offset="100%" stopColor="#e0f2fe" />
            </linearGradient>

            <filter id="cyanGlowEffect" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* ── 1. FIBER OPTIC TAIL (GLOWING S-CURVE WITH EMITTING STRANDS) ── */}
          <g className="animate-fona-tail">
            {/* Main Tail Base Body */}
            <path
              d="M 148 152 C 180 156, 208 140, 202 96 C 196 68, 178 52, 186 28 C 190 18, 198 14, 208 12"
              fill="none"
              stroke="#0f172a"
              strokeWidth="16"
              strokeLinecap="round"
            />
            {/* Glowing Cyber Fiber Stream (Middle) */}
            <path
              d="M 148 152 C 180 156, 208 140, 202 96 C 196 68, 178 52, 186 28 C 190 18, 198 14, 208 12"
              fill="none"
              stroke="url(#fonaTailGrad)"
              strokeWidth="7"
              strokeLinecap="round"
            />

            {/* Glowing Fiber Optic Filaments (Spreading Out) */}
            {/* Fiber 1 */}
            <path
              d="M 194 65 C 205 50, 218 42, 226 30"
              fill="none"
              stroke="url(#fonaCyanGlow)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="226" cy="30" r="4.5" fill="#ffffff" stroke="#00f5ff" strokeWidth="2" className="animate-fiber-pulse" />

            {/* Fiber 2 (Top High) */}
            <path
              d="M 186 38 C 196 24, 210 16, 222 10"
              fill="none"
              stroke="url(#fonaCyanGlow)"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <circle cx="222" cy="10" r="4.8" fill="#ffffff" stroke="#00f5ff" strokeWidth="2.2" className="animate-fiber-pulse" style={{ animationDelay: '0.3s' }} />

            {/* Fiber 3 (Right Extended) */}
            <path
              d="M 198 84 C 215 78, 228 72, 234 62"
              fill="none"
              stroke="url(#fonaCyanGlow)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <circle cx="234" cy="62" r="4.2" fill="#ffffff" stroke="#00f5ff" strokeWidth="1.8" className="animate-fiber-pulse" style={{ animationDelay: '0.6s' }} />

            {/* Fiber 4 (Lower Right) */}
            <path
              d="M 190 110 C 208 112, 222 104, 230 96"
              fill="none"
              stroke="url(#fonaCyanGlow)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="230" cy="96" r="3.8" fill="#ffffff" stroke="#00f5ff" strokeWidth="1.6" className="animate-fiber-pulse" style={{ animationDelay: '0.9s' }} />
          </g>

          {/* ── 2. CAT BODY & LEGS ── */}
          <g className="animate-fona-breathe">
            {/* Back Leg / Hip (Dark Navy) */}
            <ellipse cx="140" cy="162" rx="26" ry="24" fill="url(#fonaCatDark)" />
            
            {/* Cyber Circuit on Thigh */}
            <path
              d="M 130 152 C 144 148, 154 158, 150 172"
              fill="none"
              stroke="#00f5ff"
              strokeWidth="2.2"
              strokeLinecap="round"
              filter="url(#cyanGlowEffect)"
            />

            {/* Main Torso (Sitting) */}
            <path
              d="M 88 120 C 84 145, 88 180, 102 188 C 118 190, 138 188, 148 178 C 158 160, 152 130, 138 118 Z"
              fill="url(#fonaCatDark)"
            />

            {/* White Front Chest & Belly */}
            <path
              d="M 96 118 C 92 138, 94 165, 102 186 C 112 188, 126 186, 128 174 C 130 155, 128 132, 120 118 Z"
              fill="url(#fonaCatWhite)"
            />

            {/* FONA "F" Chest Badge */}
            <g transform="translate(106, 136) scale(0.65)">
              <path
                d="M 4 2 C 14 2, 22 8, 20 18 C 18 14, 14 12, 8 12 L 8 24 Z"
                fill="#0284c7"
              />
              <circle cx="16" cy="14" r="2.2" fill="#00f5ff" />
            </g>

            {/* Cyber Chest Light Streaks */}
            <path
              d="M 92 142 C 90 156, 94 170, 98 180"
              fill="none"
              stroke="#00f5ff"
              strokeWidth="2.5"
              strokeLinecap="round"
              filter="url(#cyanGlowEffect)"
            />
            <path
              d="M 124 142 C 126 156, 122 170, 118 180"
              fill="none"
              stroke="#00f5ff"
              strokeWidth="2.5"
              strokeLinecap="round"
              filter="url(#cyanGlowEffect)"
            />

            {/* Static Hind Paw */}
            <rect x="134" y="174" width="22" height="15" rx="7" fill="url(#fonaCatWhite)" stroke="#cbd5e1" strokeWidth="1" />
          </g>

          {/* ── 3. CAT HEAD, EARS, EYES & FACE ── */}
          <g transform={`rotate(${isTyping ? earTiltLeft * 0.4 : 0} 115 88)`}>
            
            {/* Left Ear */}
            <g transform={`rotate(${earTiltLeft} 78 52)`}>
              {/* Outer Dark Ear */}
              <polygon points="68,62 82,18 102,52" fill="url(#fonaCatDark)" />
              {/* Inner Glowing Cyan Ear */}
              <polygon points="74,56 84,26 96,50" fill="url(#fonaCyanGlow)" filter="url(#cyanGlowEffect)" />
            </g>

            {/* Right Ear */}
            <g transform={`rotate(${earTiltRight} 150 52)`}>
              {/* Outer Dark Ear */}
              <polygon points="128,52 148,18 162,62" fill="url(#fonaCatDark)" />
              {/* Inner Glowing Cyan Ear */}
              <polygon points="134,50 146,26 156,56" fill="url(#fonaCyanGlow)" filter="url(#cyanGlowEffect)" />
            </g>

            {/* Main Head Base Shape (Dark Navy) */}
            <ellipse cx="115" cy="78" rx="46" ry="38" fill="url(#fonaCatDark)" />

            {/* Cyber Brow Glow Accent Marks */}
            <path
              d="M 88 56 C 96 50, 108 52, 112 56"
              fill="none"
              stroke="#00f5ff"
              strokeWidth="2"
              strokeLinecap="round"
              filter="url(#cyanGlowEffect)"
            />
            <path
              d="M 118 56 C 122 52, 134 50, 142 56"
              fill="none"
              stroke="#00f5ff"
              strokeWidth="2"
              strokeLinecap="round"
              filter="url(#cyanGlowEffect)"
            />

            {/* White Face Mask / Cheeks & Muzzle */}
            <path
              d="M 82 82 C 78 102, 95 114, 115 114 C 135 114, 152 102, 148 82 C 142 88, 132 94, 115 94 C 98 94, 88 88, 82 82 Z"
              fill="url(#fonaCatWhite)"
            />

            {/* Left Eye */}
            <g transform="translate(85, 66)">
              {/* Sclera / Eye Base */}
              <ellipse cx="14" cy="14" rx="14" ry="16" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
              {/* Iris Gradient */}
              <ellipse cx={14 + pupilShiftX} cy={14 + pupilShiftY} rx="10.5" ry="12" fill="url(#fonaEyeIris)" />
              {/* Deep Pupil */}
              <ellipse cx={14 + pupilShiftX} cy={14 + pupilShiftY} rx="6.5" ry="8" fill="#09182d" />
              {/* Big Anime Light Catchlight (Top-Right) */}
              <ellipse cx={16 + pupilShiftX * 0.4} cy={10} rx="3.8" ry="4.2" fill="#ffffff" />
              {/* Secondary Catchlight (Bottom-Left) */}
              <circle cx={10 + pupilShiftX * 0.4} cy={18} r="1.8" fill="#ffffff" />
            </g>

            {/* Right Eye */}
            <g transform="translate(117, 66)">
              {/* Sclera / Eye Base */}
              <ellipse cx="14" cy="14" rx="14" ry="16" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
              {/* Iris Gradient */}
              <ellipse cx={14 + pupilShiftX} cy={14 + pupilShiftY} rx="10.5" ry="12" fill="url(#fonaEyeIris)" />
              {/* Deep Pupil */}
              <ellipse cx={14 + pupilShiftX} cy={14 + pupilShiftY} rx="6.5" ry="8" fill="#09182d" />
              {/* Big Anime Light Catchlight (Top-Right) */}
              <ellipse cx={16 + pupilShiftX * 0.4} cy={10} rx="3.8" ry="4.2" fill="#ffffff" />
              {/* Secondary Catchlight (Bottom-Left) */}
              <circle cx={10 + pupilShiftX * 0.4} cy={18} r="1.8" fill="#ffffff" />
            </g>

            {/* Cute Whiskers (White / Cyan Tipped) */}
            <path d="M 76 88 L 52 84" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 74 94 L 48 95" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 76 100 L 54 106" stroke="#00f5ff" strokeWidth="1.2" strokeLinecap="round" />

            <path d="M 154 88 L 178 84" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 156 94 L 182 95" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 154 100 L 176 106" stroke="#00f5ff" strokeWidth="1.2" strokeLinecap="round" />

            {/* Cute Dark Cyan Nose */}
            <polygon points="112,91 118,91 115,95" fill="#0284c7" />

            {/* Cat Mouth Line */}
            {isSuccess ? (
              /* Happy Open Smile */
              <path
                d="M 107 96 Q 115 106 123 96"
                fill="#f43f5e"
                stroke="#0f172a"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ) : (
              /* Sweet W-Shape Cat Smile */
              <path
                d="M 108 96 Q 112 99 115 96 Q 118 99 122 96"
                fill="none"
                stroke="#475569"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}
          </g>

          {/* ── 4. DYNAMIC FORE-PAWS (PEEKABOO / COVER EYES ANIMATION) ── */}
          {/* Left Paw */}
          <g
            style={{
              transform: leftPawTransform,
              transformOrigin: '96px 170px',
              transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            {/* Paw Arm */}
            <path d="M 96 150 C 94 162, 94 174, 98 184" stroke="#0f172a" strokeWidth="10" strokeLinecap="round" />
            {/* White Cute Paw with Toes */}
            <ellipse cx="98" cy="180" rx="10" ry="8" fill="url(#fonaCatWhite)" stroke="#cbd5e1" strokeWidth="1" />
            <path d="M 95 182 L 95 185 M 101 182 L 101 185" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />
          </g>

          {/* Right Paw */}
          <g
            style={{
              transform: rightPawTransform,
              transformOrigin: '124px 170px',
              transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            {/* Paw Arm */}
            <path d="M 124 150 C 126 162, 126 174, 122 184" stroke="#0f172a" strokeWidth="10" strokeLinecap="round" />
            {/* White Cute Paw with Toes */}
            <ellipse cx="122" cy="180" rx="10" ry="8" fill="url(#fonaCatWhite)" stroke="#cbd5e1" strokeWidth="1" />
            <path d="M 119 182 L 119 185 M 125 182 L 125 185" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />
          </g>

          {/* ── 5. STATUS ALERTS (SPARKLES ON SUCCESS / SASSY BADGE ON ERROR) ── */}
          {isSuccess && (
            <g className="animate-fiber-pulse">
              <circle cx="65" cy="40" r="4" fill="#00f5ff" />
              <circle cx="175" cy="35" r="5" fill="#38bdf8" />
              <polygon points="65,30 68,38 76,40 68,42 65,50 62,42 54,40 62,38" fill="#ffffff" />
              <polygon points="175,25 178,33 186,35 178,37 175,45 172,37 164,35 172,33" fill="#ffffff" />
            </g>
          )}

          {isError && (
            <g transform="translate(170, 40)">
              <circle cx="0" cy="0" r="14" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
              <text x="0" y="5" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="bold">!</text>
            </g>
          )}
        </svg>
      </div>
    </>
  );
}
