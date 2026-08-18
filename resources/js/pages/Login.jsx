import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../components/AuthContext.jsx';
import { useTheme } from '../components/ThemeContext.jsx';

/* ───────────────────────────────────────────────────────────────────
   Pure Iconic CinoxMediaNet Beetle Mascot (Kumbang Ikonik Murni)
─────────────────────────────────────────────────────────────────── */
function InteractiveCinoxBeetle({ usernameLength, isUsernameFocused, isPasswordFocused, showPassword }) {
  // Eye tracking offset based on username input length (-8px to +8px)
  const maxShift = 7;
  const pupilShiftX = isUsernameFocused
    ? Math.min(maxShift, Math.max(-maxShift, (usernameLength - 6) * 0.75))
    : 0;

  const pupilShiftY = isUsernameFocused ? 2 : 0;

  // Determine Wing Covering Transform State for Password Peekaboo
  let leftWingTransform = 'translate(0px, 0px) rotate(0deg)';
  let rightWingTransform = 'translate(0px, 0px) rotate(0deg)';

  if (isPasswordFocused) {
    if (!showPassword) {
      // Cover eyes completely with wings
      leftWingTransform = 'translate(32px, -38px) rotate(20deg)';
      rightWingTransform = 'translate(-32px, -38px) rotate(-20deg)';
    } else {
      // Peeking state (wings slightly spread)
      leftWingTransform = 'translate(14px, -18px) rotate(32deg)';
      rightWingTransform = 'translate(-14px, -18px) rotate(-32deg)';
    }
  }

  return (
    <div className="relative w-48 h-40 mx-auto -mb-6 z-20 pointer-events-none select-none">
      <svg
        viewBox="0 0 220 180"
        className="w-full h-full drop-shadow-2xl overflow-visible"
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
        </defs>

        {/* ── 1. BEETLE LEGS (Golden Slender Legs on Sides) ── */}
        <g stroke="#D97706" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.9">
          {/* Left Upper Leg */}
          <path d="M 68 105 Q 38 100 22 118" />
          {/* Left Middle Leg */}
          <path d="M 64 125 Q 32 130 18 152" />
          {/* Left Lower Leg */}
          <path d="M 68 145 Q 40 160 30 176" />

          {/* Right Upper Leg */}
          <path d="M 152 105 Q 182 100 198 118" />
          {/* Right Middle Leg */}
          <path d="M 156 125 Q 188 130 202 152" />
          {/* Right Lower Leg */}
          <path d="M 152 145 Q 180 160 190 176" />
        </g>

        {/* ── 2. BROADBAND FIBER GLOBE BODY (Golden Telemetry Sphere) ── */}
        <g>
          {/* Main Globe Base */}
          <circle cx="110" cy="120" r="44" fill="url(#cinoxGoldGrad)" stroke="#B45309" strokeWidth="2" />
          {/* Ambient Glow Inside Globe */}
          <circle cx="110" cy="120" r="40" fill="#F59E0B" opacity="0.4" />
          {/* Latitude & Longitude Fiber Rings (Exact to Cinox Logo) */}
          <ellipse cx="110" cy="120" rx="38" ry="18" fill="none" stroke="#FFFFFF" strokeWidth="2.5" opacity="0.9" />
          <ellipse cx="110" cy="120" rx="20" ry="40" fill="none" stroke="#FFFFFF" strokeWidth="2.5" opacity="0.9" />
          <line x1="68" y1="120" x2="152" y2="120" stroke="#FFFFFF" strokeWidth="2.5" opacity="0.9" />
        </g>

        {/* ── 3. BEETLE ANTENNAE (Curved Gold Antennae with Glowing Spheres) ── */}
        <g className="transition-transform duration-200">
          {/* Left Antenna */}
          <path
            d="M 94 38 C 82 18, 68 10, 54 6"
            stroke="#D97706"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="52" cy="6" r="6.5" fill="url(#cinoxGoldGrad)" stroke="#B45309" strokeWidth="1.5" />
          <circle cx="50" cy="4" r="2" fill="#FFFFFF" opacity="0.85" />

          {/* Right Antenna */}
          <path
            d="M 126 38 C 138 18, 152 10, 166 6"
            stroke="#D97706"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="168" cy="6" r="6.5" fill="url(#cinoxGoldGrad)" stroke="#B45309" strokeWidth="1.5" />
          <circle cx="166" cy="4" r="2" fill="#FFFFFF" opacity="0.85" />
        </g>

        {/* ── 4. BEETLE HEAD (Golden Spherical Head) ── */}
        <g>
          <ellipse cx="110" cy="58" rx="44" ry="36" fill="url(#cinoxHeadGrad)" stroke="#B45309" strokeWidth="2" />
          {/* Head Light Highlight */}
          <ellipse cx="110" cy="34" rx="26" ry="9" fill="#FFFFFF" opacity="0.5" />
        </g>

        {/* ── 5. INTERACTIVE CUTE FACE (Big Eyes with Pupil-Tracking & Smile) ── */}
        {/* Eyebrows */}
        <g className="transition-transform duration-200">
          <path
            d={isPasswordFocused && !showPassword ? "M 80 40 Q 90 46 98 42" : "M 80 42 Q 90 35 98 39"}
            stroke="#78350F"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={isPasswordFocused && !showPassword ? "M 122 42 Q 130 46 140 40" : "M 122 39 Q 130 35 140 42"}
            stroke="#78350F"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* White Eye Sockets */}
        <ellipse cx="90" cy="55" rx="14" ry="15" fill="#FFFFFF" stroke="#D97706" strokeWidth="1.5" />
        <ellipse cx="130" cy="55" rx="14" ry="15" fill="#FFFFFF" stroke="#D97706" strokeWidth="1.5" />

        {/* Pupils (Interactive Eye-Tracking Offset) */}
        <g
          className="transition-transform duration-150 ease-out"
          style={{ transform: `translate(${pupilShiftX}px, ${pupilShiftY}px)` }}
        >
          {/* Left Pupil */}
          <circle cx="90" cy="55" r="7.5" fill="#0F172A" />
          <circle cx="87.5" cy="52.5" r="2.5" fill="#FFFFFF" />

          {/* Right Pupil */}
          <circle cx="130" cy="55" r="7.5" fill="#0F172A" />
          <circle cx="127.5" cy="52.5" r="2.5" fill="#FFFFFF" />
        </g>

        {/* Cute Smiling Mouth */}
        <path
          d={isPasswordFocused && !showPassword ? "M 103 72 Q 110 68 117 72" : "M 100 70 Q 110 82 120 70"}
          stroke="#78350F"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill={isPasswordFocused && !showPassword ? "none" : "#DC2626"}
        />

        {/* Blush Cheeks */}
        <ellipse cx="73" cy="65" rx="7" ry="4" fill="#FDA4AF" opacity="0.8" />
        <ellipse cx="147" cy="65" rx="7" ry="4" fill="#FDA4AF" opacity="0.8" />

        {/* ── 6. DYNAMIC INTERACTIVE SWEEPING WINGS (Red & Navy Blue Peekaboo) ── */}
        {/* Left Wing Pair */}
        <g
          style={{
            transform: leftWingTransform,
            transformOrigin: '75px 110px',
            transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
          {/* Left Red Sweeping Outer Wing */}
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
          style={{
            transform: rightWingTransform,
            transformOrigin: '145px 110px',
            transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
          {/* Right Red Sweeping Outer Wing */}
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

  // Input Focus States for Mascot Animation
  const [isUsernameFocused, setIsUsernameFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Custom Modal for Forgot Password & Register Notice
  const [helpModal, setHelpModal] = useState(null); // 'forgot_password' | 'register' | null

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.message || 'Username atau password yang Anda masukkan salah.';
      setError(msg);
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
            className="p-2.5 rounded-lg bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-[#52525b] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-800 transition-all flex items-center gap-2 text-xs font-semibold shadow-2xs"
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
              <div className="bg-rose-50 dark:bg-neutral-900 border border-rose-300 dark:border-rose-900/60 text-rose-800 dark:text-rose-400 p-3 rounded-lg text-xs flex items-start gap-2">
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
                    onChange={e => { setUsername(e.target.value); setError(null); }}
                    onFocus={() => setIsUsernameFocused(true)}
                    onBlur={() => setIsUsernameFocused(false)}
                    placeholder="Masukkan username atau no. WhatsApp"
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-[#52525b] rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
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
                    onChange={e => { setPassword(e.target.value); setError(null); }}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => setIsPasswordFocused(false)}
                    placeholder="Masukkan kata sandi"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-24 py-2.5 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-[#52525b] rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white text-[11px] font-semibold px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-neutral-900 transition-all"
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
                  className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline transition-colors"
                >
                  Lupa password?
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Mengotentikasi...</span>
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
                  className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
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
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors"
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
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-all shadow-sm"
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
