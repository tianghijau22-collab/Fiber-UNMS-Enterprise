import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../components/AuthContext.jsx';
import { useTheme } from '../components/ThemeContext.jsx';
import InteractiveFonaCat from '../components/InteractiveFonaCat.jsx';
import FonaBrandLogo from '../components/FonaBrandLogo.jsx';

/* ───────────────────────────────────────────────────────────────────
   Login Page — Fully Compliant with DESIGN_SYSTEM_STANDARDS.md
   - 100% Monochrome Baseline: Pure White (#ffffff) & Pitch Black (#000000)
   - High-Contrast Text (text-black & dark:text-white)
   - Crisp 1px Borders (border-black/70 & dark:border-white/70)
   - Sharp Border Radius (rounded-lg / rounded-md)
   - Zero-Emoji Policy: Clean SVG Icons & Pure Text
   - React Portal Modal Architecture (z-[99999], Backdrop Blur, ESC close)
─────────────────────────────────────────────────────────────────── */
export default function Login() {
  const { login, commitLogin, loading } = useAuth();
  const { isDark, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState(null);

  // Session Inactivity Timeout Alert Notice
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(() => {
    try {
      return sessionStorage.getItem('fiber_session_expired') === '1' || location.state?.sessionExpired === true;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (sessionExpiredNotice) {
      sessionStorage.removeItem('fiber_session_expired');
    }
  }, [sessionExpiredNotice]);

  // Mascot Animation State: 'idle' | 'username' | 'password' | 'success' | 'error'
  const [mascotState, setMascotState] = useState('idle');
  const [isUsernameFocused, setIsUsernameFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Custom Modal for Forgot Password & Register Notice
  const [helpModal, setHelpModal] = useState(null);

  const from = location.state?.from?.pathname || '/dashboard';

  // Handle ESC key for modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && helpModal) {
        setHelpModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [helpModal]);

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
      await login(username.trim(), password, true);

      // SUCCESS: Trigger Celebratory Leap Animation
      setMascotState('success');

      setTimeout(() => {
        commitLogin();
        navigate(from, { replace: true });
      }, 1900);
    } catch (err) {
      // ERROR: Trigger Sassy Denial Head-shake
      const msg = err.message || 'Username atau kata sandi yang Anda masukkan salah.';
      setError(msg);
      setMascotState('error');

      setTimeout(() => {
        setMascotState(prevState => (prevState === 'error' ? 'idle' : prevState));
      }, 2400);
    }
  };

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <>
      <div className="min-h-screen flex flex-col justify-center items-center p-4 relative overflow-hidden bg-white dark:bg-black transition-colors duration-200 font-sans text-black dark:text-white">

        {/* Top Right Theme Toggle Button */}
        <div className="absolute top-5 right-5 z-30">
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
            className="px-3 py-2 rounded-md bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/20 transition-all flex items-center gap-2 text-xs font-semibold shadow-2xs cursor-pointer"
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
                <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <span>Mode Gelap</span>
              </>
            )}
          </button>
        </div>

        {/* Main Container */}
        <div className="w-full max-w-md relative z-10 my-auto">

          {/* Interactive Mascot */}
          <InteractiveFonaCat
            usernameLength={username.length}
            isUsernameFocused={isUsernameFocused}
            isPasswordFocused={isPasswordFocused}
            showPassword={showPassword}
            mascotState={mascotState}
          />

          {/* Clean Monochrome Card Container */}
          <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 p-6 sm:p-8 pt-7 rounded-lg sm:rounded-xl shadow-2xl space-y-5 relative">

            {/* Header Brand Section */}
            <div className="text-center space-y-2.5 pt-1">
              <div className="flex justify-center mb-1">
                <FonaBrandLogo className="h-16 w-auto" />
              </div>

              <div className="inline-flex items-center gap-2 bg-cyan-500/10 dark:bg-white/5 border border-cyan-500/30 dark:border-white/20 px-3.5 py-1 rounded-md text-[11px] font-mono font-bold tracking-wider text-cyan-800 dark:text-cyan-300">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                <span>Fiber Optic Network Analysis</span>
              </div>
            </div>

            {/* Info Alert (Perubahan Password Berhasil) */}
            {location.state?.infoMessage && (
              <div className="bg-emerald-50 dark:bg-neutral-900 border border-emerald-300 dark:border-emerald-800 p-3.5 rounded-md text-xs flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
                <svg className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs">Perubahan Kata Sandi Berhasil</h4>
                  <p className="text-[11px] mt-0.5">{location.state.infoMessage}</p>
                </div>
              </div>
            )}

            {/* Inactivity Session Timeout Alert */}
            {sessionExpiredNotice && !error && (
              <div className="bg-amber-50 dark:bg-neutral-900 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-300 p-3.5 rounded-md text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                <svg className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs">Sesi Berakhir</h4>
                  <p className="text-[11px] mt-0.5 text-amber-800 dark:text-amber-400/90 leading-relaxed">
                    Sesi Anda telah berakhir secara otomatis karena tidak ada aktivitas selama 3 menit. Silakan masukkan kredensial untuk masuk kembali.
                  </p>
                </div>
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <div className="bg-rose-50 dark:bg-neutral-900 border border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-400 p-3 rounded-md text-xs flex items-start gap-2 animate-in fade-in duration-200">
                <svg className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Username Field */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-black dark:text-white uppercase tracking-wider">
                  Username
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40 group-focus-within:text-blue-600 dark:group-focus-within:text-cyan-400 transition-colors">
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
                    placeholder="Masukkan username"
                    autoComplete="username"
                    disabled={mascotState === 'success'}
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md text-xs text-black dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/20 transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-black dark:text-white uppercase tracking-wider">
                  Kata Sandi
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40 group-focus-within:text-blue-600 dark:group-focus-within:text-cyan-400 transition-colors">
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
                    className="w-full pl-10 pr-20 py-2.5 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md text-xs text-black dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/20 transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white text-[11px] font-semibold px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer flex items-center gap-1"
                  >
                    {showPassword ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                        <span>Tutup</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>Lihat</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-black/70 dark:text-white/70 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-black/30 dark:border-white/30 bg-white dark:bg-black text-blue-600 focus:ring-blue-500"
                  />
                  <span>Ingat saya</span>
                </label>

                <button
                  type="button"
                  onClick={() => setHelpModal('forgot_password')}
                  className="text-xs text-blue-600 dark:text-cyan-400 font-semibold hover:underline transition-colors cursor-pointer"
                >
                  Lupa kata sandi?
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || mascotState === 'success'}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md text-xs shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2 cursor-pointer"
              >
                {loading && mascotState !== 'success' ? (
                  <>
                    <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Mengotentikasi...</span>
                  </>
                ) : mascotState === 'success' ? (
                  <>
                    <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-white font-bold">Login Berhasil! Memasuki Dashboard...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    <span>Masuk ke Sistem</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer Info */}
            <div className="pt-3 border-t border-black/10 dark:border-white/10 text-center space-y-1.5">
              <p className="text-xs text-black/70 dark:text-white/70">
                Belum punya akun?{' '}
                <button
                  type="button"
                  onClick={() => setHelpModal('register')}
                  className="text-blue-600 dark:text-cyan-400 font-semibold hover:underline cursor-pointer"
                >
                  Hubungi Admin
                </button>
              </p>
              <p className="text-[10px] text-black/50 dark:text-white/50 font-mono">
                © 2026 FONA. All rights reserved.
              </p>
            </div>

          </div>
        </div>

        {/* ── Custom Help & Information Modal (Portal Architecture) ── */}
        {helpModal && createPortal(
          <div
            className="fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen animate-in fade-in duration-150"
            onClick={() => setHelpModal(null)}
          >
            <div
              className="relative w-full max-w-md bg-white dark:bg-black rounded-lg sm:rounded-xl shadow-2xl border border-black/70 dark:border-white/70 overflow-hidden text-black dark:text-white animate-in zoom-in-95 duration-150 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >

              {/* Pinned Header */}
              <div className="bg-white dark:bg-black text-black dark:text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-black/20 dark:border-white/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-white/10 border border-blue-200 dark:border-white/20 flex items-center justify-center shrink-0 text-blue-600 dark:text-cyan-400">
                    {helpModal === 'forgot_password' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-black dark:text-white">
                      {helpModal === 'forgot_password' ? 'Lupa Kata Sandi Akun' : 'Pendaftaran Akun Baru'}
                    </h3>
                    <span className="text-[10px] font-mono text-black/60 dark:text-white/60 uppercase">
                      FONA SECURITY GATEWAY
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setHelpModal(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white font-bold cursor-pointer transition-colors"
                  aria-label="Tutup"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="p-5 text-xs text-black/80 dark:text-white/80 space-y-3 leading-relaxed">
                {helpModal === 'forgot_password' ? (
                  <>
                    <p>
                      Untuk menjaga integritas dan keamanan sistem telemetri fiber optik <strong className="text-black dark:text-white">FONA</strong>, proses <strong className="text-black dark:text-white">reset kata sandi</strong> hanya dapat dilakukan langsung oleh <strong className="text-blue-600 dark:text-cyan-400">admin</strong>.
                    </p>
                    <div className="p-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-md space-y-1.5 font-sans">
                      <div className="font-bold text-black dark:text-white text-[11px]">
                        Langkah Pemulihan Akses:
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-black/70 dark:text-white/70 text-[11px]">
                        <li>Hubungi admin melalui WhatsApp / Telegram internal.</li>
                        <li>Sebutkan Username Anda yang terdaftar.</li>
                        <li>Admin akan menerbitkan kata sandi baru melalui panel kontrol.</li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <>
                    <p>
                      Sistem <strong className="text-black dark:text-white">FONA</strong> adalah portal internal operasional jaringan terbatas untuk tim teknis.
                    </p>
                    <div className="p-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-md space-y-1.5 font-sans">
                      <div className="font-bold text-black dark:text-white text-[11px]">
                        Prosedur Pembuatan Akun Baru:
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-black/70 dark:text-white/70 text-[11px]">
                        <li>Akun didaftarkan langsung oleh admin.</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>

              {/* Pinned Footer */}
              <div className="px-5 py-3.5 bg-black/5 dark:bg-white/5 border-t border-black/20 dark:border-white/20 flex items-center justify-end flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setHelpModal(null)}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md text-xs transition-all shadow-xs cursor-pointer"
                >
                  Saya Mengerti
                </button>
              </div>

            </div>
          </div>,
          document.body
        )}

      </div>
    </>
  );
}
