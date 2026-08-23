import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../components/AuthContext.jsx';
import { useTheme } from '../components/ThemeContext.jsx';

/* ───────────────────────────────────────────────────────────────────
   Pure Iconic CinoxMediaNet Beetle Mascot (Kumbang Ikonik Murni)
   With Dynamic States:
   - Idle: Friendly calm look
   - Username: Cheeky teasing / mencibir (melet lidah & kedip)
   - Password: Wings covering eyes (peekaboo)
   - Success: Stands up & flies in a full celebratory loop around screen
   - Error: Stands up tall & performs angry denial / "WRONG!" ❌ gesture
─────────────────────────────────────────────────────────────────── */
function InteractiveCinoxBeetle({
  usernameLength,
  isUsernameFocused,
  isPasswordFocused,
  showPassword,
  mascotState // 'idle' | 'username' | 'password' | 'success' | 'error'
}) {
  // Eye tracking offset based on username input length (-6px to +6px)
  const maxShift = 6;
  const isTeasing = mascotState === 'username' || (isUsernameFocused && mascotState !== 'success' && mascotState !== 'error');
  const isTutupMata = mascotState === 'password' || (isPasswordFocused && mascotState !== 'success' && mascotState !== 'error');
  const isSuccess = mascotState === 'success';
  const isError = mascotState === 'error';

  const pupilShiftX = isTeasing
    ? Math.min(maxShift, Math.max(-maxShift, (usernameLength - 6) * 0.75))
    : 0;

  const pupilShiftY = isTeasing ? 1 : 0;

  // Determine Wing Transform State
  let leftWingTransform = 'translate(0px, 0px) rotate(0deg)';
  let rightWingTransform = 'translate(0px, 0px) rotate(0deg)';

  if (isTutupMata) {
    if (!showPassword) {
      // Cover eyes completely with wings (Tutup mata pakai sayap)
      leftWingTransform = 'translate(32px, -38px) rotate(20deg)';
      rightWingTransform = 'translate(-32px, -38px) rotate(-20deg)';
    } else {
      // Peeking state (wings slightly spread)
      leftWingTransform = 'translate(14px, -18px) rotate(32deg)';
      rightWingTransform = 'translate(-14px, -18px) rotate(-32deg)';
    }
  } else if (isTeasing) {
    // Playful cheeky teasing wings (Sayap berkacak pinggang & menggoda)
    const wingWiggle = Math.sin(usernameLength * 0.8) * 3;
    leftWingTransform = `translate(-10px, -6px) rotate(${-18 + wingWiggle}deg)`;
    rightWingTransform = `translate(10px, -6px) rotate(${18 - wingWiggle}deg)`;
  } else if (isError) {
    // Angry "❌ NO / WRONG!" Crossed Wings Gesture (Menyilangkan Sayap Tanda Salah)
    leftWingTransform = 'translate(30px, -12px) rotate(42deg)';
    rightWingTransform = 'translate(-30px, -12px) rotate(-42deg)';
  }

  // Head tilt calculations
  const headTilt = isTeasing
    ? (usernameLength % 2 === 0 ? -4 : -2)
    : 0;

  const tongueTilt = isTeasing ? (Math.sin(usernameLength * 1.2) * 9 + 5) : 0;

  // Outer Mascot Container Style depending on State
  let containerAnimationClass = '';
  if (isSuccess) {
    containerAnimationClass = 'animate-beetle-flight';
  } else if (isError) {
    containerAnimationClass = 'animate-beetle-angry-denial';
  }

  return (
    <>
      {/* Inline Keyframe Styles for Flight & Anger Animation */}
      <style>{`
        @keyframes beetleFlightOrbit {
          0% {
            transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
            opacity: 1;
          }
          12% {
            /* Stand up & take off upward right */
            transform: translate3d(120px, -110px, 0) scale(1.15) rotate(22deg);
          }
          30% {
            /* Swoop across top right */
            transform: translate3d(320px, -280px, 0) scale(1.25) rotate(60deg);
          }
          50% {
            /* Loop across top left */
            transform: translate3d(-320px, -250px, 0) scale(1.3) rotate(-50deg);
          }
          70% {
            /* Swoop down bottom left */
            transform: translate3d(-200px, 110px, 0) scale(1.15) rotate(15deg);
          }
          85% {
            /* Bank towards center */
            transform: translate3d(100px, -40px, 0) scale(1.35) rotate(-15deg);
          }
          94% {
            /* Center screen triumphant burst */
            transform: translate3d(0px, -80px, 0) scale(1.7) rotate(0deg);
            opacity: 1;
          }
          100% {
            /* Zoom into dashboard */
            transform: translate3d(0px, -120px, 0) scale(2.6) rotate(0deg);
            opacity: 0;
          }
        }

        @keyframes beetleWingFlutterLeft {
          0%, 100% { transform: translate(12px, -24px) rotate(55deg); }
          50% { transform: translate(-14px, 6px) rotate(-40deg); }
        }

        @keyframes beetleWingFlutterRight {
          0%, 100% { transform: translate(-12px, -24px) rotate(-55deg); }
          50% { transform: translate(14px, 6px) rotate(40deg); }
        }

        @keyframes beetleAngryDenialShake {
          0%, 100% { transform: translateY(-22px) scale(1.08) rotate(0deg); }
          12% { transform: translateY(-22px) scale(1.08) rotate(-10deg); }
          25% { transform: translateY(-22px) scale(1.08) rotate(10deg); }
          38% { transform: translateY(-22px) scale(1.08) rotate(-8deg); }
          50% { transform: translateY(-22px) scale(1.08) rotate(8deg); }
          65% { transform: translateY(-22px) scale(1.08) rotate(-4deg); }
          80% { transform: translateY(-22px) scale(1.08) rotate(4deg); }
        }

        @keyframes errorBadgePopIn {
          0% { transform: scale(0) translateY(12px); opacity: 0; }
          60% { transform: scale(1.3) translateY(-4px); opacity: 1; }
          100% { transform: scale(1) translateY(0px); opacity: 1; }
        }

        @keyframes successSparkleOrbit {
          0% { transform: rotate(0deg) scale(0.9); opacity: 0.7; }
          50% { transform: rotate(180deg) scale(1.2); opacity: 1; }
          100% { transform: rotate(360deg) scale(0.9); opacity: 0.7; }
        }

        .animate-beetle-flight {
          animation: beetleFlightOrbit 2.4s cubic-bezier(0.45, 0.05, 0.55, 0.95) forwards !important;
          z-index: 100 !important;
        }

        .animate-wing-flutter-left {
          animation: beetleWingFlutterLeft 0.07s infinite ease-in-out !important;
          transform-origin: 75px 110px !important;
        }

        .animate-wing-flutter-right {
          animation: beetleWingFlutterRight 0.07s infinite ease-in-out !important;
          transform-origin: 145px 110px !important;
        }

        .animate-beetle-angry-denial {
          animation: beetleAngryDenialShake 1.2s ease-in-out forwards !important;
        }

        .animate-error-badge {
          animation: errorBadgePopIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          transform-origin: center center;
        }

        .animate-success-sparks {
          animation: successSparkleOrbit 1s linear infinite;
          transform-origin: 110px 100px;
        }
      `}</style>

      <div
        className={`relative w-48 h-40 mx-auto -mb-6 z-20 pointer-events-none select-none transition-transform duration-300 ${containerAnimationClass}`}
      >
        <svg
          viewBox="0 0 220 180"
          className={`w-full h-full overflow-visible transition-all duration-300 ${
            isError ? 'drop-shadow-[0_0_15px_rgba(239,68,68,0.7)]' : isSuccess ? 'drop-shadow-[0_0_20px_rgba(251,191,36,0.85)]' : 'drop-shadow-2xl'
          }`}
        >
          <defs>
            {/* CinoxMediaNet Brand Gradients */}
            <linearGradient id="cinoxGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FBBF24" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <linearGradient id="cinoxHeadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <linearGradient id="cinoxRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#B91C1C" />
            </linearGradient>
            <linearGradient id="cinoxBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#1E3A8A" />
            </linearGradient>
            {/* Success Golden Halo Filter */}
            <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* ── SUCCESS GOLDEN SPARKLES TRAIL ── */}
          {isSuccess && (
            <g className="animate-success-sparks">
              <circle cx="50" cy="50" r="3" fill="#FBBF24" filter="url(#goldGlow)" />
              <circle cx="170" cy="50" r="4" fill="#FDE68A" filter="url(#goldGlow)" />
              <circle cx="40" cy="130" r="3.5" fill="#F59E0B" filter="url(#goldGlow)" />
              <circle cx="180" cy="130" r="3" fill="#FBBF24" filter="url(#goldGlow)" />
              <path d="M 110 5 L 113 14 L 122 17 L 113 20 L 110 29 L 107 20 L 98 17 L 107 14 Z" fill="#FFF" opacity="0.9" />
              <path d="M 195 90 L 197 96 L 203 98 L 197 100 L 195 106 L 193 100 L 187 98 L 193 96 Z" fill="#FDE68A" opacity="0.85" />
            </g>
          )}

          {/* ── ERROR ❌ WRONG CREDENTIALS BADGE POP-IN ── */}
          {isError && (
            <g className="animate-error-badge">
              {/* Badge Circle */}
              <circle cx="110" cy="-6" r="15" fill="#DC2626" stroke="#FFFFFF" strokeWidth="2.5" className="drop-shadow-lg" />
              {/* White X symbol */}
              <path d="M 104 -12 L 116 0 M 116 -12 L 104 0" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
              {/* Angry Steam Clouds on Sides */}
              <path d="M 72 10 Q 64 2 70 -6 Q 78 -2 74 10" fill="#EF4444" opacity="0.75" />
              <path d="M 148 10 Q 156 2 150 -6 Q 142 -2 146 10" fill="#EF4444" opacity="0.75" />
            </g>
          )}

          {/* ── 1. BEETLE LEGS (Stands Up / Tucked Aerodynamic / Sitting) ── */}
          <g stroke="#D97706" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.95">
            {isSuccess ? (
              /* Aerodynamic flight legs (Tucked in back) */
              <>
                <path d="M 68 115 Q 46 135 38 155" />
                <path d="M 64 130 Q 42 150 36 170" />
                <path d="M 152 115 Q 174 135 182 155" />
                <path d="M 156 130 Q 178 150 184 170" />
              </>
            ) : isError ? (
              /* Standing Up Straight & Firm Legs (Kaki Berdiri Tegak & Hentak) */
              <>
                <path d="M 68 110 Q 42 120 28 145" />
                <path d="M 64 130 Q 38 152 24 175" />
                <path d="M 68 150 Q 44 172 32 186" />

                <path d="M 152 110 Q 178 120 192 145" />
                <path d="M 156 130 Q 182 152 196 175" />
                <path d="M 152 150 Q 176 172 188 186" />
              </>
            ) : (
              /* Normal Sitting Legs */
              <>
                <path d="M 68 105 Q 38 100 22 118" />
                <path d="M 64 125 Q 32 130 18 152" />
                <path d="M 68 145 Q 40 160 30 176" />

                <path d="M 152 105 Q 182 100 198 118" />
                <path d="M 156 125 Q 188 130 202 152" />
                <path d="M 152 145 Q 180 160 190 176" />
              </>
            )}
          </g>

          {/* ── 2. BROADBAND FIBER GLOBE BODY (Golden Telemetry Sphere) ── */}
          <g>
            {/* Main Globe Base */}
            <circle cx="110" cy="120" r="44" fill="url(#cinoxGoldGrad)" stroke="#B45309" strokeWidth="2" />
            {/* Ambient Glow Inside Globe */}
            <circle cx="110" cy="120" r="40" fill={isError ? "#EF4444" : "#F59E0B"} opacity={isError ? "0.3" : "0.4"} />
            {/* Latitude & Longitude Fiber Rings (Exact to Cinox Logo) */}
            <ellipse cx="110" cy="120" rx="38" ry="18" fill="none" stroke="#FFFFFF" strokeWidth="2.5" opacity="0.9" />
            <ellipse cx="110" cy="120" rx="20" ry="40" fill="none" stroke="#FFFFFF" strokeWidth="2.5" opacity="0.9" />
            <line x1="68" y1="120" x2="152" y2="120" stroke="#FFFFFF" strokeWidth="2.5" opacity="0.9" />
          </g>

          {/* ── 3. HEAD & FACE GROUP ── */}
          <g
            style={{
              transform: `rotate(${headTilt}deg)`,
              transformOrigin: '110px 90px',
              transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            {/* ── BEETLE ANTENNAE ── */}
            <g className="transition-transform duration-200">
              {/* Left Antenna */}
              <path
                d={
                  isTeasing
                    ? "M 94 38 C 80 14, 62 8, 46 8"
                    : isError
                      ? "M 94 38 C 76 22, 58 24, 46 32"
                      : "M 94 38 C 82 18, 68 10, 54 6"
                }
                stroke="#D97706"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx={isTeasing ? "44" : isError ? "44" : "52"} cy={isTeasing ? "8" : isError ? "34" : "6"} r="6.5" fill="url(#cinoxGoldGrad)" stroke="#B45309" strokeWidth="1.5" />
              <circle cx={isTeasing ? "42" : isError ? "42" : "50"} cy={isTeasing ? "6" : isError ? "32" : "4"} r="2" fill="#FFFFFF" opacity="0.85" />

              {/* Right Antenna */}
              <path
                d={
                  isTeasing
                    ? "M 126 38 C 140 14, 158 8, 174 8"
                    : isError
                      ? "M 126 38 C 144 22, 162 24, 174 32"
                      : "M 126 38 C 138 18, 152 10, 166 6"
                }
                stroke="#D97706"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx={isTeasing ? "176" : isError ? "176" : "168"} cy={isTeasing ? "8" : isError ? "34" : "6"} r="6.5" fill="url(#cinoxGoldGrad)" stroke="#B45309" strokeWidth="1.5" />
              <circle cx={isTeasing ? "174" : isError ? "174" : "166"} cy={isTeasing ? "6" : isError ? "32" : "4"} r="2" fill="#FFFFFF" opacity="0.85" />
            </g>

            {/* ── BEETLE HEAD ── */}
            <ellipse cx="110" cy="58" rx="44" ry="36" fill="url(#cinoxHeadGrad)" stroke="#B45309" strokeWidth="2" />
            {/* Head Light Highlight */}
            <ellipse cx="110" cy="34" rx="26" ry="9" fill="#FFFFFF" opacity="0.5" />

            {/* ── EYEBROWS ── */}
            <g className="transition-all duration-200">
              {isSuccess ? (
                /* Joyful Arched Eyebrows */
                <>
                  <path d="M 80 36 Q 90 28 98 34" stroke="#78350F" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                  <path d="M 122 34 Q 130 28 140 36" stroke="#78350F" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                </>
              ) : isError ? (
                /* Furrowed Angry Downward Eyebrows (Alis Marah Tajam \ /) */
                <>
                  <path d="M 76 46 L 98 34" stroke="#78350F" strokeWidth="4" strokeLinecap="round" fill="none" />
                  <path d="M 122 34 L 144 46" stroke="#78350F" strokeWidth="4" strokeLinecap="round" fill="none" />
                </>
              ) : isTutupMata && !showPassword ? (
                /* Shy / Worried Eyebrows */
                <>
                  <path d="M 80 40 Q 90 46 98 42" stroke="#78350F" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                  <path d="M 122 42 Q 130 46 140 40" stroke="#78350F" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                </>
              ) : isTeasing ? (
                /* Playful Cheeky Eyebrows */
                <>
                  <path d="M 78 35 Q 88 26 98 35" stroke="#78350F" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                  <path d="M 122 41 Q 132 46 142 41" stroke="#78350F" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                </>
              ) : (
                /* Normal Eyebrows */
                <>
                  <path d="M 80 42 Q 90 35 98 39" stroke="#78350F" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                  <path d="M 122 39 Q 130 35 140 42" stroke="#78350F" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                </>
              )}
            </g>

            {/* ── EYES (DYNAMIC BY MASCOT STATE) ── */}
            {isSuccess ? (
              /* JOYFUL CLOSED CELEBRATORY EYES (^ ^) */
              <g>
                <path d="M 78 57 Q 90 43 102 57" stroke="#78350F" strokeWidth="4" strokeLinecap="round" fill="none" />
                <path d="M 118 57 Q 130 43 142 57" stroke="#78350F" strokeWidth="4" strokeLinecap="round" fill="none" />
                <circle cx="89" cy="46" r="1.5" fill="#FBBF24" />
                <circle cx="131" cy="46" r="1.5" fill="#FBBF24" />
              </g>
            ) : isError ? (
              /* ANGRY FRUSTRATED (> <) EYES WITH RED AURA */
              <g>
                {/* Left Eye: Angry (>) */}
                <path d="M 80 47 L 95 56 L 80 65" stroke="#DC2626" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                {/* Right Eye: Angry (<) */}
                <path d="M 140 47 L 125 56 L 140 65" stroke="#DC2626" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </g>
            ) : isTeasing ? (
              /* CHEEKY MOCKING / MENCIBIR EYES */
              <g>
                {/* Left Eye: Playful Wink Arc */}
                <path d="M 78 57 Q 90 46 102 57" stroke="#78350F" strokeWidth="4" strokeLinecap="round" fill="none" />
                <line x1="77" y1="56" x2="72" y2="52" stroke="#78350F" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="103" y1="56" x2="108" y2="52" stroke="#78350F" strokeWidth="2.5" strokeLinecap="round" />

                {/* Right Eye: Wide Sassy Eye with Tracking Pupil */}
                <ellipse cx="130" cy="55" rx="14" ry="15" fill="#FFFFFF" stroke="#D97706" strokeWidth="1.5" />
                <g
                  className="transition-transform duration-100 ease-out"
                  style={{ transform: `translate(${pupilShiftX}px, ${pupilShiftY}px)` }}
                >
                  <circle cx="130" cy="55" r="7.5" fill="#0F172A" />
                  <circle cx="127.5" cy="52.5" r="2.5" fill="#FFFFFF" />
                  <circle cx="133" cy="57" r="1.2" fill="#FFFFFF" opacity="0.9" />
                </g>
              </g>
            ) : (
              /* NORMAL / PASSWORD FOCUSED EYES */
              <g>
                <ellipse cx="90" cy="55" rx="14" ry="15" fill="#FFFFFF" stroke="#D97706" strokeWidth="1.5" />
                <ellipse cx="130" cy="55" rx="14" ry="15" fill="#FFFFFF" stroke="#D97706" strokeWidth="1.5" />

                <g
                  className="transition-transform duration-150 ease-out"
                  style={{ transform: `translate(${pupilShiftX}px, ${pupilShiftY}px)` }}
                >
                  <circle cx="90" cy="55" r="7.5" fill="#0F172A" />
                  <circle cx="87.5" cy="52.5" r="2.5" fill="#FFFFFF" />

                  <circle cx="130" cy="55" r="7.5" fill="#0F172A" />
                  <circle cx="127.5" cy="52.5" r="2.5" fill="#FFFFFF" />
                </g>
              </g>
            )}

            {/* ── MOUTH (DYNAMIC BY MASCOT STATE) ── */}
            {isSuccess ? (
              /* BIG TRIUMPHANT SMILE */
              <g>
                <path d="M 96 66 Q 110 88 124 66 Z" fill="#DC2626" stroke="#78350F" strokeWidth="3" />
                <path d="M 100 66 Q 110 72 120 66" fill="#FFFFFF" />
              </g>
            ) : isError ? (
              /* DOWNTURNED ANGRY / DENIAL GRIMACE (Mulut Cemberut Marah) */
              <g>
                <path d="M 97 76 Q 110 65 123 76" stroke="#78350F" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                <line x1="96" y1="74" x2="94" y2="78" stroke="#78350F" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="124" y1="74" x2="126" y2="78" stroke="#78350F" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            ) : isTeasing ? (
              /* OPEN MOUTH WITH STICKING PINK TONGUE (MENCIBIR / MELET :P) */
              <g>
                <path d="M 96 68 Q 110 65 124 68 Q 110 85 96 68 Z" fill="#881337" stroke="#78350F" strokeWidth="2" />
                <g
                  style={{
                    transformOrigin: '110px 72px',
                    transform: `rotate(${tongueTilt}deg)`,
                    transition: 'transform 0.15s ease-out'
                  }}
                >
                  <path d="M 103 70 C 103 82, 105 91, 110 91 C 115 91, 117 82, 117 70 Z" fill="#FB7185" stroke="#E11D48" strokeWidth="1.5" />
                  <line x1="110" y1="72" x2="110" y2="85" stroke="#E11D48" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
                </g>
                <path d="M 95 67 Q 110 63 125 68" stroke="#78350F" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              </g>
            ) : (
              /* NORMAL SMILE OR WORRIED PASSWORD MOUTH */
              <path
                d={isTutupMata && !showPassword ? "M 103 72 Q 110 68 117 72" : "M 100 70 Q 110 82 120 70"}
                stroke="#78350F"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill={isTutupMata && !showPassword ? "none" : "#DC2626"}
              />
            )}

            {/* Blush Cheeks */}
            <ellipse cx="73" cy="65" rx="7" ry="4" fill={isError ? "#F87171" : "#FDA4AF"} opacity={isTeasing || isSuccess ? 0.95 : 0.8} />
            <ellipse cx="147" cy="65" rx="7" ry="4" fill={isError ? "#F87171" : "#FDA4AF"} opacity={isTeasing || isSuccess ? 0.95 : 0.8} />
          </g>

          {/* ── 4. DYNAMIC INTERACTIVE SWEEPING WINGS ── */}
          {/* Left Wing Pair */}
          <g
            className={isSuccess ? 'animate-wing-flutter-left' : ''}
            style={{
              transform: isSuccess ? undefined : leftWingTransform,
              transformOrigin: '75px 110px',
              transition: isSuccess ? 'none' : 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            {/* Left Red Outer Wing */}
            <path
              d="M 80 80 C 42 85, 12 118, 16 160 C 26 168, 38 152, 48 130 C 62 104, 78 88, 80 80 Z"
              fill="url(#cinoxRedGrad)"
              stroke="#991B1B"
              strokeWidth="1.5"
            />
            {/* Left Navy Blue Inner Wing */}
            <path
              d="M 88 92 C 58 105, 34 132, 40 170 C 50 175, 58 156, 70 134 C 80 114, 88 100, 88 92 Z"
              fill="url(#cinoxBlueGrad)"
              stroke="#172554"
              strokeWidth="1.5"
            />
          </g>

          {/* Right Wing Pair */}
          <g
            className={isSuccess ? 'animate-wing-flutter-right' : ''}
            style={{
              transform: isSuccess ? undefined : rightWingTransform,
              transformOrigin: '145px 110px',
              transition: isSuccess ? 'none' : 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            {/* Right Red Outer Wing */}
            <path
              d="M 140 80 C 178 85, 208 118, 204 160 C 194 168, 182 152, 172 130 C 158 104, 142 88, 140 80 Z"
              fill="url(#cinoxRedGrad)"
              stroke="#991B1B"
              strokeWidth="1.5"
            />
            {/* Right Navy Blue Inner Wing */}
            <path
              d="M 132 92 C 162 105, 186 132, 180 170 C 170 175, 162 156, 150 134 C 140 114, 132 100, 132 92 Z"
              fill="url(#cinoxBlueGrad)"
              stroke="#172554"
              strokeWidth="1.5"
            />
          </g>
        </svg>
      </div>
    </>
  );
}

/* ───────────────────────────────────────────────────────────────────
   Modern Monochrome Login Page with CinoxMediaNet Identity
─────────────────────────────────────────────────────────────────── */
export default function Login() {
  const { login, loading } = useAuth();
  const { isDark, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState(null);

  // Mascot Animation State: 'idle' | 'username' | 'password' | 'success' | 'error'
  const [mascotState, setMascotState] = useState('idle');
  const [isUsernameFocused, setIsUsernameFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Custom Modal for Forgot Password & Register Notice
  const [helpModal, setHelpModal] = useState(null);

  const from = location.state?.from?.pathname || '/dashboard';

  // Handle focus changes smoothly
  const handleUsernameFocus = () => {
    setIsUsernameFocused(true);
    if (mascotState !== 'success') {
      setMascotState('username');
    }
  };

  const handleUsernameBlur = () => {
    setIsUsernameFocused(false);
    if (mascotState === 'username') {
      setMascotState('idle');
    }
  };

  const handlePasswordFocus = () => {
    setIsPasswordFocused(true);
    if (mascotState !== 'success') {
      setMascotState('password');
    }
  };

  const handlePasswordBlur = () => {
    setIsPasswordFocused(false);
    if (mascotState === 'password') {
      setMascotState('idle');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMascotState('idle');

    try {
      await login(username.trim(), password);
      // SUCCESS: Trigger Celebratory Stand-up & Flight Orbit around screen
      setMascotState('success');

      // Wait for flight animation loop (~2300ms) before navigating to dashboard
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 2350);
    } catch (err) {
      // ERROR: Trigger Stand-up & Angry Denial / "WRONG!" Gesture
      const msg = err.message || 'Username atau kata sandi yang Anda masukkan salah.';
      setError(msg);
      setMascotState('error');

      // Reset error posture after 2.6 seconds back to idle if user does not type
      setTimeout(() => {
        setMascotState(prevState => (prevState === 'error' ? 'idle' : prevState));
      }, 2600);
    }
  };

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <>
      <div className="min-h-screen flex flex-col justify-center items-center p-4 relative overflow-hidden bg-white dark:bg-black transition-colors duration-200 font-sans">

        {/* Top Right Theme Toggle Button */}
        <div className="absolute top-5 right-5 z-30">
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
            className="p-2.5 rounded-lg bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-[#52525b] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-800 transition-all flex items-center gap-2 text-xs font-semibold shadow-2xs cursor-pointer"
          >
            {isDark ? (
              <>
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.243 16.243l.707.707M7.757 7.757l.707-.707M12 7a5 5 0 100 10 5 5 0 000-10z" />
                </svg>
                <span>Mode Terang</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <span>Mode Gelap</span>
              </>
            )}
          </button>
        </div>

        {/* Main Container */}
        <div className="w-full max-w-md relative z-10 my-auto">

          {/* Pure Iconic CinoxMediaNet Beetle Mascot */}
          <InteractiveCinoxBeetle
            usernameLength={username.length}
            isUsernameFocused={isUsernameFocused}
            isPasswordFocused={isPasswordFocused}
            showPassword={showPassword}
            mascotState={mascotState}
          />

          {/* Clean Monochrome Login Card */}
          <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#52525b] p-6 sm:p-8 pt-7 rounded-xl shadow-2xl space-y-5 relative">

            {/* Header Title with CinoxMediaNet Brand Styling */}
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-[#52525b] px-3 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>FIBER-UNMS TELEMETRY GATEWAY</span>
              </div>

              {/* Official CinoxMediaNet Brand Signature */}
              <div className="pt-0.5 pb-1">
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans">
                  <span className="text-[#1E3A8A] dark:text-blue-400">Cinox</span>
                  <span className="text-[#DC2626] dark:text-red-500">Media</span>
                  <span className="text-[#D97706] dark:text-amber-400">Net</span>
                </div>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 tracking-wide">
                  The <span className="text-[#DC2626] dark:text-red-400 font-bold border-b border-[#DC2626]">Reliable</span> Broadband Access
                </p>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                Masuk untuk mengelola dan memonitor jaringan fiber optik
              </p>
            </div>

            {/* Info Alert (Perubahan Password Berhasil) */}
            {location.state?.infoMessage && (
              <div className="bg-emerald-50 dark:bg-neutral-900 border border-emerald-300 dark:border-emerald-900/60 p-3.5 rounded-lg text-xs flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
                <span className="text-base shrink-0">🔑</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs">Perubahan Password Berhasil!</h4>
                  <p className="text-[11px] mt-0.5">{location.state.infoMessage}</p>
                </div>
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <div className="bg-rose-50 dark:bg-neutral-900 border border-rose-300 dark:border-rose-900/60 text-rose-800 dark:text-rose-400 p-3 rounded-lg text-xs flex items-start gap-2 animate-in fade-in duration-200">
                <span className="shrink-0 text-sm">⚠️</span>
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Username Field */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Username atau Nomor WhatsApp
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={e => {
                      setUsername(e.target.value);
                      setError(null);
                      if (mascotState === 'error') setMascotState('username');
                    }}
                    onFocus={handleUsernameFocus}
                    onBlur={handleUsernameBlur}
                    placeholder="Masukkan username atau no. WhatsApp"
                    autoComplete="username"
                    disabled={mascotState === 'success'}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-[#52525b] rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Kata Sandi *
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value);
                      setError(null);
                      if (mascotState === 'error') setMascotState('password');
                    }}
                    onFocus={handlePasswordFocus}
                    onBlur={handlePasswordBlur}
                    placeholder="Masukkan kata sandi"
                    autoComplete="current-password"
                    disabled={mascotState === 'success'}
                    className="w-full pl-10 pr-24 py-2.5 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-[#52525b] rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white text-[11px] font-semibold px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-neutral-900 transition-all cursor-pointer"
                  >
                    {showPassword ? '🙈 Tutup' : '👁️ Lihat'}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-400 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 dark:border-[#52525b] bg-slate-50 dark:bg-neutral-950 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Ingat saya</span>
                </label>

                <button
                  type="button"
                  onClick={() => setHelpModal('forgot_password')}
                  className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline transition-colors cursor-pointer"
                >
                  Lupa password?
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || mascotState === 'success'}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2 cursor-pointer"
              >
                {loading || mascotState === 'success' ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>{mascotState === 'success' ? 'Sukses! Mengalihkan...' : 'Mengotentikasi...'}</span>
                  </>
                ) : (
                  <>
                    <span>→] Masuk ke Sistem</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer Info */}
            <div className="pt-3 border-t border-slate-100 dark:border-[#1f1f1f] text-center space-y-1.5">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Belum punya akun?{' '}
                <button
                  type="button"
                  onClick={() => setHelpModal('register')}
                  className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                >
                  Hubungi Admin
                </button>
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                © 2026 CinoxMediaNet · Fiber-UNMS Enterprise.
              </p>
            </div>

          </div>
        </div>

        {/* ── Custom Help & Information Modal ── */}
        {helpModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#52525b] rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150 relative">

              {/* Modal Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-neutral-900 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center text-xl shrink-0 text-blue-600 dark:text-blue-400">
                    {helpModal === 'forgot_password' ? '🔑' : '👤'}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {helpModal === 'forgot_password' ? 'Lupa Kata Sandi Akun' : 'Pendaftaran Akun Baru'}
                    </h3>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase">
                      CINOXMEDIANET SECURITY GATEWAY
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setHelpModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                  aria-label="Tutup"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              {helpModal === 'forgot_password' ? (
                <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <p>
                    Untuk menjaga integritas dan keamanan sistem telemetri fiber optik <strong className="text-slate-900 dark:text-white">CinoxMediaNet</strong>, proses <strong className="text-slate-900 dark:text-white">reset kata sandi</strong> hanya dapat dilakukan langsung oleh <strong className="text-blue-600 dark:text-blue-400">Super Administrator</strong> atau tim <strong className="text-blue-600 dark:text-blue-400">NOC Central</strong>.
                  </p>
                  <div className="p-3 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-[#52525b] rounded-lg space-y-1.5 font-sans">
                    <div className="font-bold text-slate-900 dark:text-white text-[11px]">
                      Langkah Pemulihan Akses:
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400 text-[11px]">
                      <li>Hubungi Super Administrator melalui WhatsApp / Telegram internal.</li>
                      <li>Sebutkan Username atau No. WhatsApp Anda yang terdaftar.</li>
                      <li>Admin akan menerbitkan kata sandi baru melalui panel RBAC.</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <p>
                    Sistem <strong className="text-slate-900 dark:text-white">CinoxMediaNet Fiber-UNMS</strong> adalah portal internal operasional jaringan terbatas untuk tim teknis (NOC, Jointer, Teknisi Lapangan, dan CS).
                  </p>
                  <div className="p-3 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-[#52525b] rounded-lg space-y-1.5 font-sans">
                    <div className="font-bold text-slate-900 dark:text-white text-[11px]">
                      Prosedur Pembuatan Akun Baru:
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400 text-[11px]">
                      <li>Akun didaftarkan langsung oleh Super Administrator melalui menu <code>/users</code>.</li>
                      <li>Ajukan permohonan akses akun baru kepada Koordinator NOC atau Manajemen IT CinoxMediaNet.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Modal Action Button */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#1f1f1f] flex justify-end">
                <button
                  type="button"
                  onClick={() => setHelpModal(null)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-all shadow-sm cursor-pointer"
                >
                  Saya Mengerti
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </>
  );
}
