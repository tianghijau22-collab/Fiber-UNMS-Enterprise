import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';

/* ─────────────────────────────────────────────────────────────
   AccessDeniedAlert — Animasi "Access Denied" saat login gagal
   Ditampilkan sebagai overlay via ReactDOM.createPortal.
   
   Timeline:
     0ms    → layar merah flash pertama
     150ms  → teks "ACCESS DENIED" muncul dengan glitch
     600ms  → alarm berkedip 3x
     1800ms → fade out
     2200ms → onComplete() dipanggil (kembali ke form login)
───────────────────────────────────────────────────────────── */
export default function AccessDeniedAlert({ onComplete, message }) {
  const [phase, setPhase]     = useState(0); // 0=flash, 1=show, 2=fadeout
  const [glitch, setGlitch]   = useState(0); // glitch frame counter
  const calledRef             = useRef(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 700);
    const t3 = setTimeout(() => {
      if (!calledRef.current) {
        calledRef.current = true;
        if (onComplete) onComplete();
      }
    }, 1000);

    // Glitch flicker loop
    let glitchTimer;
    const doGlitch = () => {
      setGlitch(g => g + 1);
      glitchTimer = setTimeout(doGlitch, 80 + Math.random() * 120);
    };
    glitchTimer = setTimeout(doGlitch, 200);

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      clearTimeout(glitchTimer);
    };
  }, [onComplete]);

  const portal = (
    <div style={{
      ...s.root,
      opacity: phase === 2 ? 0 : 1,
      transition: phase === 2 ? 'opacity 0.4s ease' : 'none',
    }}>
      {/* ── RED SCAN LINE OVERLAY ── */}
      <div style={s.scanLines} />

      {/* ── FLASHING RED BACKGROUND ── */}
      <div style={{
        ...s.bg,
        background: glitch % 7 === 0
          ? 'radial-gradient(ellipse at center, #7f1d1d 0%, #1c0a0a 60%)'
          : glitch % 3 === 0
          ? 'radial-gradient(ellipse at center, #450a0a 0%, #0c0202 60%)'
          : 'radial-gradient(ellipse at center, #5c1515 0%, #150404 60%)',
      }} />

      {/* ── ALARM CORNERS ── */}
      {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
        <div key={i} style={{
          position: 'absolute',
          [pos.includes('top') ? 'top' : 'bottom']: 0,
          [pos.includes('left') ? 'left' : 'right']: 0,
          width: 80, height: 80, zIndex: 10,
          borderTop:    pos.includes('top')    ? '3px solid rgba(239,68,68,0.8)' : 'none',
          borderBottom: pos.includes('bottom') ? '3px solid rgba(239,68,68,0.8)' : 'none',
          borderLeft:   pos.includes('left')   ? '3px solid rgba(239,68,68,0.8)' : 'none',
          borderRight:  pos.includes('right')  ? '3px solid rgba(239,68,68,0.8)' : 'none',
          boxShadow: glitch % 2 === 0
            ? `${pos.includes('left') ? '' : '-'}10px ${pos.includes('top') ? '' : '-'}10px 30px rgba(239,68,68,0.5)`
            : 'none',
        }} />
      ))}

      {/* ── CENTER CONTENT ── */}
      <div style={{
        position: 'relative', zIndex: 20, textAlign: 'center',
        opacity: phase >= 1 ? 1 : 0,
        transform: phase >= 1 ? 'scale(1)' : 'scale(0.7)',
        transition: 'opacity 0.15s ease, transform 0.15s ease',
      }}>

        {/* Shield / Lock Icon */}
        <div style={{
          width: 90, height: 90, borderRadius: '50%', margin: '0 auto 20px',
          background: 'rgba(239,68,68,0.15)',
          border: `3px solid ${glitch % 4 === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(239,68,68,0.9)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 40px rgba(239,68,68,0.6)',
          animation: 'denied-pulse 0.4s ease-in-out infinite',
        }}>
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"
              fill="rgba(239,68,68,0.3)"
              stroke={glitch % 3 === 0 ? 'white' : '#ef4444'}
              strokeWidth="1.5"
            />
            <line x1="9" y1="9" x2="15" y2="15" stroke={glitch % 3 === 0 ? 'white' : '#ef4444'} strokeWidth="2" strokeLinecap="round"/>
            <line x1="15" y1="9" x2="9" y2="15" stroke={glitch % 3 === 0 ? 'white' : '#ef4444'} strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>

        {/* ACCESS DENIED text with glitch */}
        <div style={{
          fontSize: 36, fontWeight: 900, letterSpacing: '0.25em',
          color: glitch % 5 === 0 ? '#ffffff' : glitch % 3 === 0 ? '#fca5a5' : '#ef4444',
          textShadow: glitch % 2 === 0
            ? '0 0 30px rgba(239,68,68,1), 0 0 60px rgba(239,68,68,0.6)'
            : '3px 0 0 rgba(56,189,248,0.5), -3px 0 0 rgba(167,139,250,0.5)',
          textTransform: 'uppercase',
          fontFamily: "'Courier New', monospace",
          transform: glitch % 8 === 0 ? 'skewX(-4deg)' : glitch % 6 === 0 ? 'skewX(2deg)' : 'none',
          marginBottom: 12,
          userSelect: 'none',
        }}>
          {glitch % 9 === 0 ? 'ACC3SS D3N13D' : 'ACCESS DENIED'}
        </div>

        {/* Error code */}
        <div style={{
          fontFamily: "'Courier New', monospace", fontSize: 11,
          color: 'rgba(252,165,165,0.7)', letterSpacing: '0.15em',
          marginBottom: 20, textTransform: 'uppercase',
        }}>
          ERR_AUTH_401 · UNAUTHORIZED
        </div>

        {/* Red divider */}
        <div style={{
          width: 200, height: 2, background: 'linear-gradient(to right, transparent, #ef4444, transparent)',
          margin: '0 auto 18px', boxShadow: '0 0 12px rgba(239,68,68,0.7)',
        }} />

        {/* Error message */}
        <div style={{
          fontSize: 13, color: '#fca5a5',
          fontFamily: "'Courier New', monospace",
          maxWidth: 320, margin: '0 auto 24px',
          lineHeight: 1.6,
          textShadow: '0 0 10px rgba(239,68,68,0.4)',
        }}>
          {message || 'Username atau password yang Anda masukkan salah.'}
        </div>

        {/* Blinking retry text */}
        <div style={{
          fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
          color: glitch % 2 === 0 ? 'rgba(252,165,165,0.8)' : 'transparent',
          fontFamily: "'Courier New', monospace",
        }}>
          ▶ ULANGI AUTENTIKASI...
        </div>
      </div>

      {/* ── HORIZONTAL SCAN BAR ── */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 2, zIndex: 15,
        background: 'rgba(239,68,68,0.6)',
        boxShadow: '0 0 20px rgba(239,68,68,0.8)',
        animation: 'denied-scan 1.2s linear infinite',
      }} />

      <style>{`
        @keyframes denied-pulse {
          0%,100% { box-shadow: 0 0 40px rgba(239,68,68,0.6); }
          50%      { box-shadow: 0 0 70px rgba(239,68,68,1), 0 0 120px rgba(239,68,68,0.4); }
        }
        @keyframes denied-scan {
          0%   { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(portal, document.body);
}

const s = {
  root: {
    position: 'fixed', inset: 0, zIndex: 99999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Courier New', monospace",
    userSelect: 'none',
  },
  bg: {
    position: 'absolute', inset: 0,
    transition: 'background 0.08s ease',
  },
  scanLines: {
    position: 'absolute', inset: 0, zIndex: 5,
    background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)',
    pointerEvents: 'none',
  },
};
