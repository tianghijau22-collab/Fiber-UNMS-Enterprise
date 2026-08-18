import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';

/* ─────────────────────────────────────────────────────────────
   CinoxBeePortal — Gabungan animasi:
   1. Pintu siber terbuka (seperti sebelumnya)
   2. Logo kumbang Cinox terbang masuk
   3. Nama perusahaan muncul huruf per huruf
   4. Progress bar golden

   Timeline:
     0ms    → pintu tertutup, latar gelap
     400ms  → laser seam menyala di tengah
     900ms  → pintu slide keluar (kiri & kanan)
     1500ms → bee terbang masuk + glow
     2100ms → nama "CINOX MEDIA NETWORK" reveal
     3400ms → progress bar 0→100%
     4000ms → flash emas
     4400ms → onComplete()
───────────────────────────────────────────────────────────── */
export default function FiberPortalGate({ onComplete }) {
  const [phase, setPhase]         = useState(0);
  const [letterIdx, setLetterIdx] = useState(0);
  const [progress, setProgress]   = useState(0);
  const [wingFlap, setWingFlap]   = useState(false);
  const calledRef                 = useRef(false);
  const companyName               = 'CINOX MEDIA NETWORK';

  /* Main timeline */
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),   // laser glow
      setTimeout(() => setPhase(2), 900),   // doors open
      setTimeout(() => setPhase(3), 1500),  // bee in
      setTimeout(() => setPhase(4), 2100),  // name reveal
      setTimeout(() => {
        if (!calledRef.current) { calledRef.current = true; if (onComplete) onComplete(); }
      }, 4000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  /* Wing flap */
  useEffect(() => {
    if (phase < 3) return;
    const iv = setInterval(() => setWingFlap(f => !f), 110);
    return () => clearInterval(iv);
  }, [phase]);

  /* Letter reveal */
  useEffect(() => {
    if (phase < 4 || letterIdx >= companyName.length) return;
    const t = setTimeout(() => setLetterIdx(i => i + 1), 55);
    return () => clearTimeout(t);
  }, [phase, letterIdx]);

  /* Progress bar */
  useEffect(() => {
    if (phase < 4) return;
    const iv = setInterval(() => {
      setProgress(p => { if (p >= 100) { clearInterval(iv); return 100; } return p + 1.8; });
    }, 35);
    return () => clearInterval(iv);
  }, [phase]);

  const doorOpen  = phase >= 2;

  const portal = (
    <div style={s.root}>

      {/* ── BG TUNNEL (muncul saat pintu terbuka) ── */}
      <div style={{
        ...s.tunnel,
        opacity: phase >= 2 ? 1 : 0,
        transition: 'opacity 0.5s ease',
      }}>
        {/* Radial amber glow */}
        <div style={s.tunnelCore} />
        {/* Network grid */}
        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.08 }}>
          {[...Array(10)].map((_,i) => (
            <line key={`h${i}`} x1="0" y1={`${i*11.1}%`} x2="100%" y2={`${i*11.1}%`} stroke="#F5A623" strokeWidth="0.6"/>
          ))}
          {[...Array(14)].map((_,i) => (
            <line key={`v${i}`} x1={`${i*7.7}%`} y1="0" x2={`${i*7.7}%`} y2="100%" stroke="#F5A623" strokeWidth="0.6"/>
          ))}
        </svg>
        {/* Floating particles */}
        {[...Array(20)].map((_,i) => (
          <div key={i} style={{
            position:'absolute',
            left:`${5 + (i * 4.7) % 90}%`,
            top:`${8 + (i * 7.3) % 84}%`,
            width: 3 + (i % 3),
            height: 3 + (i % 3),
            borderRadius:'50%',
            background: ['#F5A623','#FBBF24','#DC2626','#1E3A8A','#FCD34D'][i % 5],
            opacity: 0.55,
            animation: `pt-float ${2.5 + (i % 3)}s ease-in-out ${(i * 0.22) % 2}s infinite`,
            boxShadow: `0 0 8px currentColor`,
          }} />
        ))}
      </div>

      {/* ── LEFT DOOR ── */}
      <div style={{
        ...s.door, left:0,
        transform: doorOpen ? 'translateX(-100%)' : 'translateX(0%)',
        transition: 'transform 0.7s cubic-bezier(0.7,0,0.3,1)',
        borderRight: phase >= 1 ? '2px solid rgba(245,166,35,0.9)' : '2px solid rgba(245,166,35,0.15)',
        boxShadow: phase === 1 ? 'inset -50px 0 100px rgba(245,166,35,0.35)' : 'none',
      }}>
        <DoorCircuit side="left" lit={phase >= 1} />
      </div>

      {/* ── RIGHT DOOR ── */}
      <div style={{
        ...s.door, right:0,
        transform: doorOpen ? 'translateX(100%)' : 'translateX(0%)',
        transition: 'transform 0.7s cubic-bezier(0.7,0,0.3,1)',
        borderLeft: phase >= 1 ? '2px solid rgba(245,166,35,0.9)' : '2px solid rgba(245,166,35,0.15)',
        boxShadow: phase === 1 ? 'inset 50px 0 100px rgba(245,166,35,0.35)' : 'none',
      }}>
        <DoorCircuit side="right" lit={phase >= 1} />
      </div>

      {/* ── LASER SEAM ── */}
      <div style={{
        position:'absolute', top:0, bottom:0, left:'50%',
        width: phase === 1 ? 4 : 0,
        transform:'translateX(-50%)',
        background:'white',
        boxShadow:'0 0 30px #F5A623, 0 0 80px rgba(245,166,35,0.6)',
        transition:'width 0.2s ease',
        zIndex:30,
      }} />

      {/* ── CENTER CONTENT (bee + text, muncul setelah pintu buka) ── */}
      <div style={{
        position:'relative', zIndex:20,
        display:'flex', flexDirection:'column', alignItems:'center',
        opacity: phase >= 3 ? 1 : 0,
        transform: phase >= 3 ? 'scale(1) translateY(0)' : 'scale(0.5) translateY(30px)',
        transition: 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* ── BEE LOGO SVG ── */}
        <div style={{
          filter: phase >= 3
            ? 'drop-shadow(0 0 25px rgba(245,166,35,0.8)) drop-shadow(0 0 50px rgba(245,166,35,0.35))'
            : 'none',
          transition:'filter 0.5s ease',
          animation: phase >= 3 ? 'bee-hover 2.5s ease-in-out infinite' : 'none',
          marginBottom: 22,
        }}>
          <BeeLogoSVG wingFlap={wingFlap} />
        </div>

        {/* ── COMPANY NAME ── */}
        <div style={{
          fontSize:26, fontWeight:900, letterSpacing:'0.18em',
          textAlign:'center', minHeight:38,
          fontFamily:"'Segoe UI','Arial',sans-serif",
        }}>
          {companyName.split('').map((ch, i) => {
            const color = i < 5 ? '#1E3A8A' : i < 11 ? '#DC2626' : '#F5A623';
            const glow  = i < 5
              ? '0 0 16px rgba(30,58,138,0.9)'
              : i < 11
              ? '0 0 16px rgba(220,38,38,0.9)'
              : '0 0 16px rgba(245,166,35,0.9)';
            return (
              <span key={i} style={{
                color, textShadow: glow,
                opacity: i < letterIdx ? 1 : 0,
                display:'inline-block',
                transform: i < letterIdx ? 'translateY(0)' : 'translateY(-8px)',
                transition:`opacity 0.08s, transform 0.15s`,
              }}>
                {ch === ' ' ? '\u00A0' : ch}
              </span>
            );
          })}
        </div>

        {/* ── TAGLINE ── */}
        <div style={{
          fontSize:11, letterSpacing:'0.3em', color:'rgba(255,255,255,0.5)',
          fontFamily:'monospace', marginTop:6, textTransform:'uppercase',
          opacity: letterIdx >= companyName.length ? 1 : 0,
          transition:'opacity 0.5s ease 0.2s',
        }}>
          The &nbsp;<span style={{ color:'#DC2626' }}>Reliable</span>&nbsp; Broadband Access
        </div>

        {/* ── DIVIDER ── */}
        <div style={{
          width:260, height:2, margin:'16px auto',
          background:'linear-gradient(to right, transparent, #1E3A8A 20%, #DC2626 50%, #F5A623 80%, transparent)',
          boxShadow:'0 0 14px rgba(245,166,35,0.5)',
          opacity: phase >= 4 ? 1 : 0, transition:'opacity 0.5s ease 0.4s',
        }} />

        {/* ── PROGRESS BAR ── */}
        <div style={{
          width:280,
          opacity: phase >= 4 ? 1 : 0,
          transition:'opacity 0.3s ease 0.6s',
        }}>
          <div style={{
            width:'100%', height:5, borderRadius:3,
            background:'rgba(255,255,255,0.08)', overflow:'hidden',
          }}>
            <div style={{
              height:'100%', borderRadius:3,
              width:`${progress}%`,
              background:'linear-gradient(90deg, #1E3A8A 0%, #DC2626 50%, #F5A623 100%)',
              boxShadow:'0 0 14px rgba(245,166,35,0.7)',
              transition:'width 0.04s linear',
            }} />
          </div>
          <div style={{
            display:'flex', justifyContent:'space-between',
            marginTop:5, fontSize:10,
            fontFamily:'monospace', color:'rgba(255,255,255,0.35)',
          }}>
            <span>Memuat sesi jaringan...</span>
            <span style={{ color:'#F5A623' }}>{Math.round(progress)}%</span>
          </div>
        </div>

        {/* ── DOTS ── */}
        <div style={{
          display:'flex', gap:8, marginTop:18,
          opacity: phase >= 4 ? 1 : 0, transition:'opacity 0.3s ease 0.8s',
        }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width:8, height:8, borderRadius:'50%',
              background:['#1E3A8A','#DC2626','#F5A623','#F5A623'][i],
              animation:`bee-dot 0.8s ease-in-out ${i*0.16}s infinite`,
              boxShadow:`0 0 10px ${['rgba(30,58,138,0.8)','rgba(220,38,38,0.8)','rgba(245,166,35,0.8)','rgba(245,166,35,0.8)'][i]}`,
            }} />
          ))}
        </div>
      </div>


      <style>{`
        @keyframes pt-float {
          0%,100%{transform:translateY(0) scale(1);opacity:0.4}
          50%{transform:translateY(-16px) scale(1.3);opacity:0.75}
        }
        @keyframes bee-hover {
          0%,100%{transform:translateY(0px) rotate(-1deg)}
          50%{transform:translateY(-10px) rotate(1deg)}
        }
        @keyframes bee-dot {
          0%,100%{transform:scale(1);opacity:0.35}
          50%{transform:scale(1.8);opacity:1}
        }
        @keyframes antenna-bob {
          0%,100%{transform:rotate(-4deg)}
          50%{transform:rotate(4deg)}
        }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(portal, document.body);
}

/* ─── SVG BEE — menyerupai logo Cinox Media Network ─── */
function BeeLogoSVG({ wingFlap }) {
  return (
    <svg viewBox="0 0 320 290" width="220" height="200" style={{ overflow:'visible' }}>

      {/* ══ SAYAP ATAS KANAN (kanan atas, biru+merah, seperti logo) ══ */}
      <g style={{
        transformOrigin:'155px 125px',
        transform: wingFlap ? 'rotate(-16deg) scaleY(0.82)' : 'rotate(-4deg) scaleY(1)',
        transition:'transform 0.11s ease',
      }}>
        {/* Navy top wing - arc besar ke kanan atas */}
        <path
          d="M148 100 C170 55 220 28 278 42 C265 62 220 75 155 118 Z"
          fill="#1E3A8A"
          style={{ filter:'drop-shadow(0 2px 8px rgba(30,58,138,0.7))' }}
        />
        {/* Red wing - sedikit di bawah navy */}
        <path
          d="M152 116 C175 72 228 48 284 64 C268 84 222 95 158 133 Z"
          fill="#DC2626"
          style={{ filter:'drop-shadow(0 2px 6px rgba(220,38,38,0.6))' }}
        />
      </g>

      {/* ══ SAYAP BAWAH KIRI (kiri bawah, biru+merah) ══ */}
      <g style={{
        transformOrigin:'148px 178px',
        transform: wingFlap ? 'rotate(14deg) scaleY(0.82)' : 'rotate(3deg) scaleY(1)',
        transition:'transform 0.11s ease',
      }}>
        {/* Navy bottom-left wing */}
        <path
          d="M140 175 C110 215 60 240 18 222 C38 198 88 185 138 162 Z"
          fill="#1E3A8A"
          style={{ filter:'drop-shadow(0 2px 8px rgba(30,58,138,0.6))' }}
        />
        {/* Red bottom-left wing */}
        <path
          d="M142 190 C112 232 60 258 16 242 C38 216 90 200 140 178 Z"
          fill="#DC2626"
          style={{ filter:'drop-shadow(0 2px 6px rgba(220,38,38,0.5))' }}
        />
      </g>

      {/* ══ BADAN GLOBE (oval besar, tilted) ══ */}
      <g transform="translate(168,160) rotate(-18)">
        {/* Globe body fill */}
        <ellipse cx="0" cy="0" rx="72" ry="82" fill="#F5A623"/>

        {/* Latitude lines (horizontal ellipses) */}
        <ellipse cx="0" cy="-40" rx="60" ry="18" fill="none" stroke="#C47A0A" strokeWidth="2.2" opacity="0.85"/>
        <ellipse cx="0" cy="-15" rx="68" ry="14" fill="none" stroke="#C47A0A" strokeWidth="2" opacity="0.8"/>
        <ellipse cx="0" cy="12"  rx="70" ry="13" fill="none" stroke="#C47A0A" strokeWidth="2" opacity="0.8"/>
        <ellipse cx="0" cy="38"  rx="64" ry="13" fill="none" stroke="#C47A0A" strokeWidth="2" opacity="0.75"/>
        <ellipse cx="0" cy="60"  rx="50" ry="11" fill="none" stroke="#C47A0A" strokeWidth="1.8" opacity="0.65"/>

        {/* Longitude lines (vertical curves) */}
        <path d="M0,-82 Q0,0 0,82"  stroke="#C47A0A" strokeWidth="2" fill="none" opacity="0.8"/>
        <path d="M-32,-74 Q-38,0 -32,74" stroke="#C47A0A" strokeWidth="1.8" fill="none" opacity="0.7"/>
        <path d="M32,-74 Q38,0 32,74"  stroke="#C47A0A" strokeWidth="1.8" fill="none" opacity="0.7"/>
        <path d="M-58,-48 Q-68,0 -58,48" stroke="#C47A0A" strokeWidth="1.5" fill="none" opacity="0.55"/>
        <path d="M58,-48 Q68,0 58,48"   stroke="#C47A0A" strokeWidth="1.5" fill="none" opacity="0.55"/>

        {/* Outer ring */}
        <ellipse cx="0" cy="0" rx="72" ry="82" fill="none" stroke="#C47A0A" strokeWidth="2.5"/>
      </g>

      {/* ══ KEPALA (golden, kiri atas) ══ */}
      <circle cx="95" cy="82" r="38" fill="#F5A623"/>
      <circle cx="95" cy="82" r="36" fill="#FBBF24"/>
      {/* Garis pemisah kepala-badan (subtle) */}
      <path d="M108 112 C130 118 148 122 155 128" stroke="#E8920A" strokeWidth="2" fill="none" opacity="0.5"/>

      {/* ══ ANTENA ══ */}
      {/* Antena kiri */}
      <g style={{ animation:'antenna-bob 1.1s ease-in-out infinite', transformOrigin:'78px 56px' }}>
        <path d="M80 50 Q68 28 55 10" stroke="#D97706" strokeWidth="2.8" fill="none" strokeLinecap="round"/>
        <circle cx="52" cy="7" r="5.5" fill="#E8920A"/>
        <circle cx="51" cy="6" r="2.5" fill="#FDE68A"/>
      </g>
      {/* Antena kanan */}
      <g style={{ animation:'antenna-bob 1.1s ease-in-out 0.35s infinite', transformOrigin:'105px 52px' }}>
        <path d="M105 48 Q112 26 118 8" stroke="#D97706" strokeWidth="2.8" fill="none" strokeLinecap="round"/>
        <circle cx="120" cy="5" r="5" fill="#E8920A"/>
        <circle cx="122" cy="4" r="2.2" fill="#FDE68A"/>
      </g>

      {/* ══ KAKI / APPENDAGES (lower right body) ══ */}
      <path d="M222 205 Q238 215 248 225" stroke="#D97706" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      <path d="M228 192 Q246 198 258 205" stroke="#D97706" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      <path d="M215 218 Q228 232 234 244" stroke="#D97706" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

/* ─── DOOR CIRCUIT SVG ─── */
function DoorCircuit({ side, lit }) {
  const isL = side === 'left';
  const c = lit ? '#F5A623' : 'rgba(245,166,35,0.25)';
  return (
    <svg
      style={{ position:'absolute', top:0, bottom:0, [isL?'right':'left']:0, height:'100%', width:180, opacity: lit ? 0.45 : 0.15 }}
      viewBox="0 0 180 900" preserveAspectRatio="none"
    >
      {isL ? (
        <>
          <line x1="180" y1="110" x2="55"  y2="110" stroke={c} strokeWidth="1.5"/>
          <line x1="55"  y1="110" x2="55"  y2="290" stroke={c} strokeWidth="1.5"/>
          <circle cx="55" cy="290" r="5" fill={c}/>
          <line x1="180" y1="290" x2="30"  y2="290" stroke="#DC2626" strokeWidth="1"/>
          <line x1="180" y1="470" x2="75"  y2="470" stroke={c} strokeWidth="1.5"/>
          <line x1="75"  y1="470" x2="75"  y2="620" stroke={c} strokeWidth="1.5"/>
          <circle cx="75" cy="620" r="5" fill={c}/>
          <line x1="180" y1="730" x2="40"  y2="730" stroke="#1E3A8A" strokeWidth="1"/>
          <rect x="130" y="390" width="32" height="20" rx="3" stroke="#DC2626" strokeWidth="1" fill="none"/>
          <rect x="140" y="195" width="22" height="20" rx="3" stroke={c} strokeWidth="1" fill="none"/>
          <line x1="180" y1="840" x2="90" y2="840" stroke="#34d399" strokeWidth="1"/>
          <circle cx="90" cy="840" r="4" fill="#34d399"/>
        </>
      ) : (
        <>
          <line x1="0"   y1="110" x2="125" y2="110" stroke={c} strokeWidth="1.5"/>
          <line x1="125" y1="110" x2="125" y2="290" stroke={c} strokeWidth="1.5"/>
          <circle cx="125" cy="290" r="5" fill={c}/>
          <line x1="0"   y1="290" x2="150" y2="290" stroke="#DC2626" strokeWidth="1"/>
          <line x1="0"   y1="470" x2="105" y2="470" stroke={c} strokeWidth="1.5"/>
          <line x1="105" y1="470" x2="105" y2="620" stroke={c} strokeWidth="1.5"/>
          <circle cx="105" cy="620" r="5" fill={c}/>
          <line x1="0"   y1="730" x2="140" y2="730" stroke="#1E3A8A" strokeWidth="1"/>
          <rect x="18"   y="390" width="32" height="20" rx="3" stroke="#DC2626" strokeWidth="1" fill="none"/>
          <rect x="18"   y="195" width="22" height="20" rx="3" stroke={c} strokeWidth="1" fill="none"/>
          <line x1="0"   y1="840" x2="90" y2="840" stroke="#34d399" strokeWidth="1"/>
          <circle cx="90" cy="840" r="4" fill="#34d399"/>
        </>
      )}
    </svg>
  );
}

/* ── STYLES ── */
const s = {
  root: {
    position:'fixed', inset:0, zIndex:99999,
    display:'flex', alignItems:'center', justifyContent:'center',
    fontFamily:"'Segoe UI','Arial',sans-serif",
    userSelect:'none',
  },
  tunnel: {
    position:'absolute', inset:0,
    background:'radial-gradient(ellipse at center, #1a0d00 0%, #0a0600 50%, #000000 100%)',
  },
  tunnelCore: {
    position:'absolute', left:'50%', top:'50%',
    width:500, height:500, borderRadius:'50%',
    background:'radial-gradient(circle, rgba(245,166,35,0.18) 0%, rgba(220,38,38,0.08) 45%, transparent 70%)',
    transform:'translate(-50%,-50%)',
  },
  door: {
    position:'absolute', top:0, bottom:0, width:'50%',
    background:'linear-gradient(170deg, #0f172a 0%, #1a1a2e 40%, #0a0a1a 100%)',
    overflow:'hidden', willChange:'transform',
  },
};
