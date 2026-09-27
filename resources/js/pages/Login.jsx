import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../components/AuthContext.jsx';
import { useTheme } from '../components/ThemeContext.jsx';
import InteractiveFonaCat from '../components/InteractiveFonaCat.jsx';
import FonaBrandLogo from '../components/FonaBrandLogo.jsx';

/* ───────────────────────────────────────────────────────────────────
   Modern Clean Monochrome Login Page
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

  React.useEffect(() => {
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
      // Defer commit so currentUser is not set immediately, giving time for flight animation
      await login(username.trim(), password, true);

      // SUCCESS: Trigger Celebratory Stand-up & Flight Orbit around screen
      setMascotState('success');

      // Wait for flight animation loop (~2350ms) before committing session and navigating
      setTimeout(() => {
        commitLogin();
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

          {/* Beetle Mascot */}
          <InteractiveFonaCat
            usernameLength={username.length}
            isUsernameFocused={isUsernameFocused}
            isPasswordFocused={isPasswordFocused}
            showPassword={showPassword}
            mascotState={mascotState}
          />

          {/* Clean Monochrome Login Card */}
          <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#52525b] p-6 sm:p-8 pt-7 rounded-xl shadow-2xl space-y-5 relative">

            {/* Header Title */}
            <div className="text-center space-y-2.5 pt-1">
              <div className="flex justify-center mb-1">
                <FonaBrandLogo className="h-16 w-auto" />
              </div>

              <div className="inline-flex items-center gap-2 bg-cyan-500/10 dark:bg-neutral-900 border border-cyan-500/30 dark:border-cyan-800/60 px-3.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider text-cyan-800 dark:text-cyan-300 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                <span>Fiber Optic Network Analysis</span>
              </div>
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

            {/* Inactivity Session Timeout Alert */}
            {sessionExpiredNotice && !error && (
              <div className="bg-amber-50 dark:bg-neutral-900 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-300 p-3.5 rounded-lg text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                <span className="shrink-0 text-base">⏱️</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs">Sesi Login Berakhir</h4>
                  <p className="text-[11px] mt-0.5 text-amber-800 dark:text-amber-400/90 leading-relaxed">
                    Sesi Anda telah berakhir secara otomatis karena tidak ada aktivitas selama 3 menit. Silakan masukkan kredensial untuk masuk kembali.
                  </p>
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
                  Username
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
                    placeholder="Masukkan username"
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
                {loading && mascotState !== 'success' ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Mengotentikasi...</span>
                  </>
                ) : mascotState === 'success' ? (
                  <>
                    <span className="text-emerald-300 font-bold">✨ Login Berhasil! Memasuki Dashboard...</span>
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
                © 2026 FONA. All rights reserved.
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
                      FONA SECURITY GATEWAY
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
                    Untuk menjaga integritas dan keamanan sistem telemetri fiber optik <strong className="text-slate-900 dark:text-white">FONA</strong>, proses <strong className="text-slate-900 dark:text-white">reset kata sandi</strong> hanya dapat dilakukan langsung oleh <strong className="text-blue-600 dark:text-blue-400">Super Administrator</strong> atau tim <strong className="text-blue-600 dark:text-blue-400">NOC Central</strong>.
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
                    Sistem <strong className="text-slate-900 dark:text-white">FONA</strong> adalah portal internal operasional jaringan terbatas untuk tim teknis.
                  </p>
                  <div className="p-3 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-[#52525b] rounded-lg space-y-1.5 font-sans">
                    <div className="font-bold text-slate-900 dark:text-white text-[11px]">
                      Prosedur Pembuatan Akun Baru:
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400 text-[11px]">
                      <li>Akun didaftarkan langsung oleh Super Administrator.</li>
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
