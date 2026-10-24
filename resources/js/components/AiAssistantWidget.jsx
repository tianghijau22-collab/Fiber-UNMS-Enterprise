import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiInlineTokens, aiEnginePresentation } from '../lib/aiAssistant.js';

/**
 * Parser Markdown Ringan, Bersih & Aman untuk FONA Copilot
 * Mengikuti Standar Sistem Desain Monokrom Kontras Tinggi Fiber-UNMS Enterprise
 */
export function MarkdownRenderer({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeBuffer = [];
  let listBuffer = [];
  let orderedBuffer = [];
  let tableBuffer = [];

  const formatInline = (text) => aiInlineTokens(text).map((token, index) => {
    if (token.type === 'strong') return <strong key={index} className="font-bold">{token.text}</strong>;
    if (token.type === 'em') return <em key={index}>{token.text}</em>;
    if (token.type === 'code') return <code key={index} className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono">{token.text}</code>;
    if (token.type === 'link') return <a key={index} href={token.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{token.text}</a>;
    return <React.Fragment key={index}>{token.text}</React.Fragment>;
  });

  const flushList = (key) => {
    if (listBuffer.length > 0) {
      elements.push(
        <ul key={`ul-${key}`} className="list-disc pl-5 my-1.5 space-y-1 text-xs text-black/85 dark:text-white/85">
          {listBuffer.map((item, idx) => (
            <li key={idx}>{formatInline(item)}</li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
    if (orderedBuffer.length > 0) {
      elements.push(
        <ol key={`ol-${key}`} className="list-decimal pl-5 my-1.5 space-y-1 text-xs text-black/85 dark:text-white/85">
          {orderedBuffer.map((item, idx) => (
            <li key={idx}>{formatInline(item)}</li>
          ))}
        </ol>
      );
      orderedBuffer = [];
    }
  };

  const flushTable = (key) => {
    if (tableBuffer.length > 0) {
      const parsedRows = tableBuffer
        .map(row => row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()))
        .filter(cells => !cells.every(c => /^[:\-\s]*$/.test(c)));
      if (parsedRows.length > 0) {
        const [header, ...body] = parsedRows;
        elements.push(
          <div key={`tbl-${key}`} className="my-2 overflow-x-auto rounded-md border border-black/15 dark:border-white/15">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-black/5 dark:bg-white/10 border-b border-black/15 dark:border-white/15">
                  {header.map((h, i) => (
                    <th key={i} className="px-2 py-1.5 font-bold text-black dark:text-white whitespace-nowrap">
                      {formatInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 dark:divide-white/10">
                {body.map((r, rIdx) => (
                  <tr key={rIdx} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    {r.map((cell, cIdx) => (
                      <td key={cIdx} className="px-2 py-1.5 text-black/85 dark:text-white/85 align-top">
                        {formatInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      tableBuffer = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${idx}`} className="p-3 my-2 rounded-md bg-black/5 dark:bg-white/5 text-black dark:text-white font-mono text-[11px] overflow-x-auto border border-black/15 dark:border-white/20">
            <code>{codeBuffer.join('\n')}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        flushList(idx);
        flushTable(idx);
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.split('|').length > 2) {
      flushList(idx);
      tableBuffer.push(trimmed);
      return;
    } else {
      flushTable(idx);
    }

    if (trimmed.match(/^(\*|-|•)\s+/)) {
      if (orderedBuffer.length > 0) flushList(`o-${idx}`);
      listBuffer.push(trimmed.replace(/^(\*|-|•)\s+/, ''));
      return;
    } else if (trimmed.match(/^\d+\.\s+/)) {
      if (listBuffer.length > 0) flushList(`u-${idx}`);
      orderedBuffer.push(trimmed.replace(/^\d+\.\s+/, ''));
      return;
    } else {
      flushList(idx);
    }

    if (trimmed.startsWith('#### ')) {
      elements.push(
        <h5 key={`h5-${idx}`} className="text-xs font-bold text-black dark:text-white mt-2 mb-0.5">{formatInline(trimmed.slice(5))}</h5>
      );
      return;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={`h4-${idx}`} className="text-xs font-bold text-black dark:text-white mt-2.5 mb-1">{formatInline(trimmed.slice(4))}</h4>
      );
      return;
    }
    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      const sliceLen = trimmed.startsWith('## ') ? 3 : 2;
      elements.push(
        <h3 key={`h3-${idx}`} className="text-xs font-bold text-black dark:text-white mt-3 mb-1.5 border-b border-black/10 dark:border-white/10 pb-1 uppercase tracking-wider">{formatInline(trimmed.slice(sliceLen))}</h3>
      );
      return;
    }

    if (!trimmed) {
      elements.push(<div key={`sp-${idx}`} className="h-1" />);
      return;
    }

    elements.push(
      <p key={`p-${idx}`} className="text-xs leading-relaxed my-0.5 text-black/85 dark:text-white/85">{formatInline(line)}</p>
    );
  });

  flushList('final');
  flushTable('final');
  return <div className="space-y-0.5">{elements}</div>;
}

/**
 * Maskot Animasi 3D Interaktif FONA Asisten
 * Mendukung pose: Lompat (jump), Melihat Kiri & Kanan (look), dan Sedang Berpikir (think)
 */
function FonaMascotAnimated({ variant = 'launcher', forceThinking = false }) {
  const [pose, setPose] = useState('look'); // 'jump' | 'look' | 'think'

  useEffect(() => {
    if (forceThinking) {
      setPose('think');
      return;
    }
    const poses = ['look', 'jump', 'think', 'look'];
    let idx = 0;
    const timer = setInterval(() => {
      idx = (idx + 1) % poses.length;
      setPose(poses[idx]);
    }, 3600);
    return () => clearInterval(timer);
  }, [forceThinking]);

  const activePose = forceThinking ? 'think' : pose;
  const isLauncher = variant === 'launcher';

  return (
    <div
      className={`relative select-none pointer-events-none flex items-center justify-center ${
        isLauncher ? 'w-16 h-16 sm:w-20 sm:h-20' : 'w-8 h-8 sm:w-9 sm:h-9'
      }`}
    >
      <style>{`
        @keyframes fonaJumpBody {
          0%, 100% { transform: translateY(0) scale(1, 1); }
          18% { transform: translateY(4%) scale(1.06, 0.93); }
          42% { transform: translateY(-14%) scale(0.96, 1.05) rotate(-2deg); }
          58% { transform: translateY(-16%) scale(0.97, 1.04) rotate(2deg); }
          82% { transform: translateY(3%) scale(1.05, 0.94); }
        }
        @keyframes fonaJumpShadow {
          0%, 100% { transform: scaleX(1); opacity: 0.35; }
          18% { transform: scaleX(1.12); opacity: 0.45; }
          50% { transform: scaleX(0.62); opacity: 0.16; }
          82% { transform: scaleX(1.1); opacity: 0.42; }
        }
        @keyframes fonaLookHead {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          22%, 35% { transform: translateX(-6%) rotate(-6deg); }
          62%, 78% { transform: translateX(6%) rotate(6deg); }
        }
        @keyframes fonaLookEyes {
          0%, 100% { transform: translate(0, 0) scaleY(1); }
          20%, 35% { transform: translate(-9%, 0) scaleY(1); }
          46% { transform: translate(0, 0) scaleY(0.1); }
          50% { transform: translate(0, 0) scaleY(1); }
          62%, 78% { transform: translate(9%, 0) scaleY(1); }
          90% { transform: translate(0, 0) scaleY(0.1); }
          94% { transform: translate(0, 0) scaleY(1); }
        }
        @keyframes fonaThinkHead {
          0%, 100% { transform: rotate(-8deg) translate(-2%, 1%); }
          50% { transform: rotate(-11deg) translate(-3%, 2%); }
        }
        @keyframes fonaThinkEyes {
          0%, 100% { transform: translate(6%, -5%) scaleY(0.88); }
          50% { transform: translate(8%, -7%) scaleY(0.82); }
        }
        @keyframes fonaIdleBreath {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2.5%); }
        }
        @keyframes fonaThoughtBubble {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.95; }
          50% { transform: translateY(-4px) scale(1.08); opacity: 1; }
        }
      `}</style>

      {/* Bayangan Bawah (khusus tombol utama) */}
      {isLauncher && (
        <span
          className="absolute bottom-0.5 w-10 sm:w-12 h-2 rounded-full bg-black/40 dark:bg-black/70 blur-[2px]"
          style={{
            animation: activePose === 'jump' ? 'fonaJumpShadow 1.1s ease-in-out infinite' : 'none',
          }}
        />
      )}

      {/* Kontainer Karakter Berlapis (Body + Head + Glowing Visor Eyes) */}
      <div
        className="relative w-full h-full flex items-center justify-center"
        style={{
          animation:
            activePose === 'jump'
              ? 'fonaJumpBody 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) infinite'
              : 'fonaIdleBreath 2.6s ease-in-out infinite',
        }}
      >
        {/* Layer 1: Badan Robot */}
        <img
          src="/images/fona-mascot-body.png"
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.35)]"
        />

        {/* Layer 2: Kepala & Helm Robot (Bisa menoleh kiri-kanan & miring berpikir) */}
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            transformOrigin: '50% 38%',
            animation:
              activePose === 'look'
                ? 'fonaLookHead 3.2s ease-in-out infinite'
                : activePose === 'think'
                  ? 'fonaThinkHead 2s ease-in-out infinite'
                  : 'none',
          }}
        >
          <img
            src="/images/fona-mascot-head.png"
            alt="FONA Asisten"
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain"
          />

          {/* Layer 3: Mata LED Cyan di dalam Visor (Melirik kiri/kanan, berkedip, berpikir) */}
          <img
            src="/images/fona-mascot-eyes.png"
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain"
            style={{
              transformOrigin: '50% 27%',
              animation:
                activePose === 'look'
                  ? 'fonaLookEyes 3.2s ease-in-out infinite'
                  : activePose === 'think'
                    ? 'fonaThinkEyes 2s ease-in-out infinite'
                    : 'none',
            }}
          />
        </div>

        {/* Gelembung Berpikir (Muncul saat pose berpikir) */}
        {activePose === 'think' && (
          <div
            className={`absolute ${
              isLauncher
                ? '-top-1.5 -right-1 px-1.5 py-0.5 text-[10px]'
                : '-top-1 -right-1 px-1 py-0 text-[8px]'
            } rounded-full bg-white dark:bg-zinc-900 text-sky-500 font-bold border border-sky-400/50 shadow-md flex items-center gap-0.5`}
            style={{ animation: 'fonaThoughtBubble 1.4s ease-in-out infinite' }}
          >
            <span>?</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AiAssistantWidget({ currentUser }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [configured, setConfigured] = useState(false);
  const [engine, setEngine] = useState({state: 'loading', mode: null});
  const mountedRef = useRef(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const chatRequestRef = useRef(null);
  const historyRequestRef = useRef(null);
  const settingsRequestRef = useRef(null);
  const [showSettings, setShowSettings] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);

  // Settings form states
  const [provider, setProvider] = useState('groq');
  // Gemini
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelSelect, setModelSelect] = useState('gemini-3.5-flash');
  const [maskedKey, setMaskedKey] = useState(null);
  // Groq
  const [groqApiKeyInput, setGroqApiKeyInput] = useState('');
  const [groqModelSelect, setGroqModelSelect] = useState('qwen/qwen3.8-27b');
  const [groqMaskedKey, setGroqMaskedKey] = useState(null);
  // Custom / 9Router
  const [customBaseUrlInput, setCustomBaseUrlInput] = useState('');
  const [customApiKeyInput, setCustomApiKeyInput] = useState('');
  const [customModelInput, setCustomModelInput] = useState('gpt-4o-mini');
  const [customMaskedKey, setCustomMaskedKey] = useState(null);

  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  const initialGreeting = useMemo(() => ({
    id: 'welcome-msg',
    role: 'assistant',
    content: `Halo ${currentUser?.name ? `**${currentUser.name}**` : 'Rekan'}, selamat datang di **FONA Asisten**.\n\nSaya siap membantu Anda mengecek:\n- **Data & Redaman Pelanggan** *(nama, ID layanan, atau SN)*\n- **Kapasitas & Status ODP / ODC** *(sisa port & maintenance)*\n- **Ringkasan Jaringan & Tiket Gangguan**\n\nSilakan ketik pertanyaan Anda di bawah.`,
    timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
  }), [currentUser?.name]);

  const [messages, setMessages] = useState(() => [initialGreeting]);

  const fetchUserHistory = useCallback(async () => {
    historyRequestRef.current?.abort();
    const request = new AbortController();
    historyRequestRef.current = request;
    setHistoryLoading(true);
    try {
      // History remains in the authenticated database, not shared browser storage.
      try {
        for (const key of Object.keys(localStorage)) if (key.startsWith('fona_ai_copilot_messages')) localStorage.removeItem(key);
      } catch { /* Browser storage can be disabled; server history still works. */ }
      if (!currentUser?.id) { setMessages([initialGreeting]); return; }
      const res = await fetch('/api/ai-assistant/history', { headers: {'Accept': 'application/json'}, credentials: 'same-origin', signal: request.signal });
      const data = await res.json();
      if (request.signal.aborted) return;
      if (!res.ok || data.status !== 'success') throw new Error('Riwayat belum dapat dimuat. Muat ulang halaman sebelum mengirim pesan.');
      setMessages(Array.isArray(data.messages) && data.messages.length ? data.messages : [initialGreeting]);
      setHistoryLoading(false);
    } catch (error) {
      if (request.signal.aborted) return;
      setMessages([initialGreeting, {id: 'history-error', role: 'assistant', content: 'Riwayat belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.'}]);
    }
  }, [currentUser?.id, initialGreeting]);

  useEffect(() => { fetchUserHistory(); }, [fetchUserHistory]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
    mountedRef.current = false;
    chatRequestRef.current?.abort(); historyRequestRef.current?.abort(); settingsRequestRef.current?.abort();
    recognitionRef.current?.abort();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  const fetchSettings = useCallback(async () => {
    settingsRequestRef.current?.abort();
    const request = new AbortController(); settingsRequestRef.current = request;
    try {
      const res = await fetch('/api/ai-assistant/settings', {
        signal: request.signal,
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (request.signal.aborted) return;
      if (res.ok && data.status === 'success') {
        setConfigured(data.is_configured);
        setEngine(previous => previous.mode ? previous : {state: data.provider_state || 'unverified', mode: null});
        if (data.provider) setProvider(data.provider);
        setMaskedKey(data.gemini_masked_key || data.masked_key);
        if (data.gemini_model) setModelSelect(data.gemini_model);
        setGroqMaskedKey(data.groq_masked_key);
        if (data.groq_model) setGroqModelSelect(data.groq_model);
        if (data.custom_base_url) setCustomBaseUrlInput(data.custom_base_url);
        setCustomMaskedKey(data.custom_masked_key);
        if (data.custom_model) setCustomModelInput(data.custom_model);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized, loading]);

  // Voice Input Speech Recognition setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'id-ID';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setInputMessage(prev => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Browser Anda belum mendukung input suara Web Speech API.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        recognitionRef.current.stop();
      }
    }
  };

  // Text-to-Speech Readout
  const handleSpeakText = (msgId, text) => {
    if (!('speechSynthesis' in window)) return;

    if (speakingId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*_#`[\]()]/g, ' ').replace(/\s+/g, ' ');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'id-ID';
    utterance.rate = 1.05;

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopyMessage = (msgId, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendMessage = async (customPrompt) => {
    const textToSend = customPrompt || inputMessage.trim();
    if (!textToSend || loading || historyLoading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    const request = new AbortController();
    chatRequestRef.current = request;
    const timeout = setTimeout(() => request.abort(), 65000);
    try {
      const res = await fetch('/api/ai-assistant/chat', {
        signal: request.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          message: textToSend,
        }),
      });

      const data = await res.json();
      clearTimeout(timeout);
      if (request.signal.aborted) return;

      if (res.ok && data.status === 'success') {
        setEngine({state: data.provider_state || 'unknown', mode: data.mode || 'unavailable', reason: data.fallback_reason});
        const aiMsg = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.reply || 'Tidak ada balasan.',
          tools_used: data.tools_used || [],
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, aiMsg]);
        if (data.is_configured !== undefined) {
          setConfigured(data.is_configured);
        }
      } else {
        const errorMsg = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `**Kendala Pemrosesan:** ${data.message || 'Terjadi gangguan koneksi pada modul AI.'}`,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setEngine({state:'unavailable', mode:'unavailable'});
      const netErrorMsg = {
        id: `net-err-${Date.now()}`,
        role: 'assistant',
        content: request.signal.aborted ? '**Waktu tunggu habis.** Muat ulang riwayat sebelum mencoba lagi.' : `**Kesalahan Jaringan:** ${err.message || 'Tidak dapat terhubung ke server FONA.'}`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, netErrorMsg]);
    } finally {
      clearTimeout(timeout);
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (loading || historyLoading || !window.confirm('Bersihkan seluruh riwayat percakapan Anda dengan FONA Asisten?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ai-assistant/history', {method:'DELETE', credentials:'same-origin', headers:{'Accept':'application/json','X-CSRF-TOKEN':document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''}});
      const data = await res.json();
      if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Riwayat belum berhasil dihapus.');
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setMessages([initialGreeting]);
    } catch (error) {
      setMessages(previous => [...previous,{id:`clear-error-${Date.now()}`,role:'assistant',content:`Riwayat belum dihapus: ${error.message}`}]);
    } finally { setLoading(false); }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsFeedback(null);

    const payload = {
      provider,
      ...(provider === 'groq' ? {
        groq_api_key: groqApiKeyInput,
        groq_model: groqModelSelect,
      } : provider === 'openai_custom' ? {
        custom_base_url: customBaseUrlInput,
        custom_api_key: customApiKeyInput,
        custom_model: customModelInput,
      } : {
        api_key: apiKeyInput,
        model: modelSelect,
      })
    };

    try {
      const res = await fetch('/api/ai-assistant/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSettingsFeedback({ type: 'success', text: data.message });
        setApiKeyInput('');
        setGroqApiKeyInput('');
        setCustomApiKeyInput('');
        fetchSettings();
        setTimeout(() => {
          setShowSettings(false);
          setSettingsFeedback(null);
        }, 1500);
      } else {
        setSettingsFeedback({ type: 'error', text: data.message || 'Gagal menyimpan pengaturan.' });
      }
    } catch (err) {
      setSettingsFeedback({ type: 'error', text: err.message || 'Kesalahan jaringan.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const quickPrompts = [
    { label: 'Redaman Kritis', prompt: 'Tampilkan daftar pelanggan yang memiliki redaman optik lemah (≤ -25 dBm) atau N/A saat ini.' },
    { label: 'Ringkasan Jaringan', prompt: 'Berikan ringkasan status operasional jaringan sistem FONA saat ini.' },
    { label: 'ODP Maintenance', prompt: 'ODP mana saja yang sedang dalam status maintenance aktif hari ini?' },
    { label: 'Tiket Gangguan', prompt: 'Tampilkan tiket gangguan jaringan yang masih berstatus open atau in progress.' },
  ];

  if (!currentUser?.id) return null;
  const engineDisplay = aiEnginePresentation(engine, configured, provider);
  const engineDot = engineDisplay.tone === 'healthy' ? 'bg-emerald-500' : engineDisplay.tone === 'warning' ? 'bg-amber-500' : 'bg-slate-400';

  return (
    <>
      {/* ─── FLOATING LAUNCHER BUTTON ─────────────────────────────────── */}
      {!isOpen && (
        <div className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-50 flex items-center group">
          <button
            type="button"
            onClick={() => { setIsOpen(true); setIsMinimized(false); }}
            className="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-transparent hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer focus:outline-none"
            aria-label="Buka FONA Asisten"
            title="FONA Asisten"
          >
            {/* Maskot Animasi 3D Interaktif */}
            <FonaMascotAnimated variant="launcher" forceThinking={loading} />
            {/* Status Radar Dot */}
            <span className="absolute top-1 right-2 flex h-3 w-3">
              <span className={`absolute inline-flex h-full w-full rounded-full ${engineDot} opacity-40`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${engineDot} border border-white dark:border-black`}></span>
            </span>
          </button>

          {/* Minimal Tooltip */}
          <div className="hidden sm:flex absolute right-21 px-2.5 py-1 rounded bg-black text-white dark:bg-white dark:text-black text-xs font-semibold tracking-tight shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap items-center gap-1.5 border border-black/10 dark:border-white/10">
            <span>FONA Asisten</span>
          </div>
        </div>
      )}

      {/* ─── MAIN CHAT WINDOW ────────────────────────────────────────── */}
      {isOpen && (
        <div
          className={`fixed z-50 flex flex-col bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-lg sm:rounded-xl shadow-2xl overflow-hidden transition-all duration-200 text-black dark:text-white font-sans ${
            isMinimized
              ? 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-80 h-13'
              : isExpanded
                ? 'inset-2 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[720px] md:w-[840px] sm:h-[86vh]'
                : 'inset-x-3 bottom-3 top-auto sm:inset-auto sm:bottom-6 sm:right-6 w-auto sm:w-[460px] md:w-[500px] h-[82vh] sm:h-[620px] max-h-[92vh] sm:max-h-[85vh]'
          }`}
          style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)' }}
        >
          {/* ─── PINNED HEADER BAR ────────────────────────────────────── */}
          <div className="px-4 py-2 bg-white dark:bg-black text-black dark:text-white flex items-center justify-between shrink-0 select-none border-b border-black/15 dark:border-white/15">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shrink-0">
                <FonaMascotAnimated variant="header" forceThinking={loading} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-xs sm:text-sm tracking-tight truncate">FONA Asisten</h3>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-0.5 text-black/70 dark:text-white/70 shrink-0">
              {/* Expand / Normal Window Toggle (Desktop only) */}
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Kembalikan Ukuran' : 'Perlebar Jendela'}
                className="hidden sm:inline-flex p-1.5 rounded hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isExpanded ? "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" : "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"} />
                </svg>
              </button>

              {/* Settings Button */}
              {currentUser?.role === 'Super Administrator' && (
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  title="Pengaturan Provider AI"
                  className={`p-1.5 rounded hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer ${
                    showSettings ? 'bg-black/10 dark:bg-white/15 text-black dark:text-white' : ''
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}

              {/* Clear Chat Button */}
              <button
                type="button"
                onClick={handleClearChat}
                title="Bersihkan riwayat percakapan"
                className="p-1.5 rounded hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>

              {/* Minimize Window Toggle */}
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? 'Perbesar Jendela' : 'Kecilkan Jendela'}
                className="p-1.5 rounded hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMinimized ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                </svg>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => { setIsOpen(false); if (window.speechSynthesis) window.speechSynthesis.cancel(); }}
                title="Tutup Jendela"
                className="p-1.5 rounded hover:text-rose-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* ─── BODY AREA ────────────────────────────────────────────── */}
          {!isMinimized && (
            <div className="flex-1 flex flex-col min-h-0 relative bg-white dark:bg-black">

              {/* SETTINGS OVERLAY MODAL */}
              {showSettings && (
                <div className="absolute inset-0 bg-white/98 dark:bg-black/98 backdrop-blur-xs z-20 p-4 flex flex-col justify-between overflow-y-auto">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-black/15 dark:border-white/15 pb-2.5">
                      <div>
                        <h4 className="font-bold text-xs text-black dark:text-white tracking-tight">
                          Pengaturan AI Provider
                        </h4>
                        <p className="text-[10px] text-black/60 dark:text-white/60">
                          Konfigurasi engine LLM dan kredensial API FONA Asisten
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSettings(false)}
                        className="text-xs text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white cursor-pointer px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        ✕ Tutup
                      </button>
                    </div>

                    {settingsFeedback && (
                      <div className={`p-2.5 rounded-md text-xs font-medium border ${
                        settingsFeedback.type === 'success'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                      }`}>
                        {settingsFeedback.text}
                      </div>
                    )}

                    <form onSubmit={handleSaveSettings} className="space-y-3">
                      {/* Provider Segmented Control */}
                      <div className="grid grid-cols-3 gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-md text-[10px] font-semibold border border-black/10 dark:border-white/15">
                        <button
                          type="button"
                          onClick={() => setProvider('groq')}
                          className={`py-1.5 px-1 rounded transition-all text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                            provider === 'groq'
                              ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs font-bold border border-black/10 dark:border-white/20'
                              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
                          }`}
                        >
                          <span>Groq Cloud</span>
                          <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400">Gratis &amp; Cepat</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setProvider('gemini')}
                          className={`py-1.5 px-1 rounded transition-all text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                            provider === 'gemini'
                              ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs font-bold border border-black/10 dark:border-white/20'
                              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
                          }`}
                        >
                          <span>Google Gemini</span>
                          <span className="text-[9px] font-mono opacity-60">AI Studio</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setProvider('openai_custom')}
                          className={`py-1.5 px-1 rounded transition-all text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                            provider === 'openai_custom'
                              ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs font-bold border border-black/10 dark:border-white/20'
                              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
                          }`}
                        >
                          <span>Custom / 9Router</span>
                          <span className="text-[9px] font-mono opacity-60">OpenAI API</span>
                        </button>
                      </div>

                      {/* GROQ CLOUD CONFIGURATION */}
                      {provider === 'groq' && (
                        <div className="space-y-3 bg-black/[0.02] dark:bg-white/[0.03] p-3 rounded-md border border-black/10 dark:border-white/10">
                          <div>
                            <label className="block text-[11px] font-semibold text-black/80 dark:text-white/80 mb-1">
                              Groq API Key
                            </label>
                            <input
                              type="password"
                              value={groqApiKeyInput}
                              onChange={e => setGroqApiKeyInput(e.target.value)}
                              placeholder={groqMaskedKey ? `Tersimpan: ${groqMaskedKey}` : 'Masukkan Groq API Key (gsk_...)'}
                              className="w-full px-3 py-1.5 bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-md text-xs font-mono text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                            />
                            <div className="flex items-center justify-between mt-1 text-[10px]">
                              <span className="text-black/50 dark:text-white/50 font-mono">
                                {groqMaskedKey ? 'Kunci tersimpan aktif' : 'Belum ada kunci terkonfigurasi'}
                              </span>
                              <a
                                href="https://console.groq.com/keys"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-black dark:text-white hover:underline"
                              >
                                Buat API Key di Groq Console ↗
                              </a>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-black/80 dark:text-white/80 mb-1">
                              Model Groq
                            </label>
                            <select
                              value={groqModelSelect}
                              onChange={e => setGroqModelSelect(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-md text-xs text-black dark:text-white font-medium focus:outline-none focus:border-black dark:focus:border-white"
                            >
                              <option value="qwen/qwen3.8-27b">Qwen 3.8 27B (Rekomendasi Utama: Cepat, Cerdas &amp; Bahasa Indonesia)</option>
                              <option value="openai/gpt-oss-120b">GPT-OSS 120B (Model Besar / Penalaran Kompleks)</option>
                              <option value="openai/gpt-oss-20b">GPT-OSS 20B (Super Cepat / Low Latency)</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* GOOGLE GEMINI CONFIGURATION */}
                      {provider === 'gemini' && (
                        <div className="space-y-3 bg-black/[0.02] dark:bg-white/[0.03] p-3 rounded-md border border-black/10 dark:border-white/10">
                          <div>
                            <label className="block text-[11px] font-semibold text-black/80 dark:text-white/80 mb-1">
                              Google Gemini API Key
                            </label>
                            <input
                              type="password"
                              value={apiKeyInput}
                              onChange={e => setApiKeyInput(e.target.value)}
                              placeholder={maskedKey ? `Tersimpan: ${maskedKey}` : 'Masukkan Gemini API Key'}
                              className="w-full px-3 py-1.5 bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-md text-xs font-mono text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                            />
                            <div className="flex items-center justify-between mt-1 text-[10px]">
                              <span className="text-black/50 dark:text-white/50 font-mono">
                                {maskedKey ? 'Kunci tersimpan aktif' : 'Belum ada kunci terkonfigurasi'}
                              </span>
                              <a
                                href="https://aistudio.google.com/app/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-black dark:text-white hover:underline"
                              >
                                Dapatkan Kunci di Google AI Studio ↗
                              </a>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-black/80 dark:text-white/80 mb-1">
                              Model Gemini
                            </label>
                            <select
                              value={modelSelect}
                              onChange={e => setModelSelect(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-md text-xs text-black dark:text-white font-medium focus:outline-none focus:border-black dark:focus:border-white"
                            >
                              <option value="gemini-3.5-flash">Gemini 3.5 Flash (Sangat Cepat &amp; Disarankan)</option>
                              <option value="gemini-3.8-flash">Gemini 3.8 Flash (Model Terbaru)</option>
                              <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite (Super Ringan &amp; Efisien)</option>
                              <option value="gemini-4-argon">Gemini 4 Argon (Penalaran Kompleks)</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* CUSTOM OPENAI / 9ROUTER CONFIGURATION */}
                      {provider === 'openai_custom' && (
                        <div className="space-y-3 bg-black/[0.02] dark:bg-white/[0.03] p-3 rounded-md border border-black/10 dark:border-white/10">
                          <div>
                            <label className="block text-[11px] font-semibold text-black/80 dark:text-white/80 mb-1">
                              Base API URL
                            </label>
                            <input
                              type="text"
                              value={customBaseUrlInput}
                              onChange={e => setCustomBaseUrlInput(e.target.value)}
                              placeholder="https://api.9router.com/v1 atau https://api.openai.com/v1"
                              className="w-full px-3 py-1.5 bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-md text-xs font-mono text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-black/80 dark:text-white/80 mb-1">
                              API Key (Opsional)
                            </label>
                            <input
                              type="password"
                              value={customApiKeyInput}
                              onChange={e => setCustomApiKeyInput(e.target.value)}
                              placeholder={customMaskedKey ? `Tersimpan: ${customMaskedKey}` : 'Masukkan API Key jika dibutuhkan'}
                              className="w-full px-3 py-1.5 bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-md text-xs font-mono text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-black/80 dark:text-white/80 mb-1">
                              Nama Model
                            </label>
                            <input
                              type="text"
                              value={customModelInput}
                              onChange={e => setCustomModelInput(e.target.value)}
                              placeholder="Contoh: gpt-4o-mini, deepseek-chat"
                              className="w-full px-3 py-1.5 bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-md text-xs text-black dark:text-white font-mono focus:outline-none focus:border-black dark:focus:border-white"
                            />
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={savingSettings}
                        className="w-full py-2 bg-black hover:bg-black/90 dark:bg-white dark:hover:bg-white/90 text-white dark:text-black font-bold text-xs rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {savingSettings ? (
                          <>
                            <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                            <span>Memverifikasi &amp; Menyimpan...</span>
                          </>
                        ) : (
                          <span>Verifikasi &amp; Simpan Pengaturan</span>
                        )}
                      </button>
                    </form>
                  </div>

                  <div className="pt-2.5 border-t border-black/10 dark:border-white/10 text-[9px] text-black/50 dark:text-white/50">
                    Kunci API disimpan secara terenkripsi di server database dan tidak dibocorkan ke client.
                  </div>
                </div>
              )}

              {/* ─── MESSAGE STREAM ──────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex flex-col group ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    {/* Header meta line */}
                    <div className="flex items-center gap-2 mb-1 px-1 text-[10px] font-mono text-black/50 dark:text-white/50">
                      <span>{msg.role === 'user' ? (currentUser?.name || 'Teknisi') : 'FONA Asisten'}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>

                      {/* Copy message action */}
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        title="Salin isi pesan"
                        className="opacity-0 group-hover:opacity-100 hover:text-black dark:hover:text-white transition-opacity cursor-pointer ml-1"
                      >
                        {copiedId === msg.id ? '✓ Tersalin' : 'Salin'}
                      </button>

                      {/* Text-to-Speech Action */}
                      {msg.role === 'assistant' && (
                        <button
                          type="button"
                          onClick={() => handleSpeakText(msg.id, msg.content)}
                          title={speakingId === msg.id ? 'Hentikan Audio' : 'Dengarkan Audio'}
                          className="opacity-0 group-hover:opacity-100 hover:text-black dark:hover:text-white transition-opacity cursor-pointer"
                        >
                          {speakingId === msg.id ? 'Stop' : 'Baca'}
                        </button>
                      )}
                    </div>

                    {/* Message Bubble Card */}
                    <div
                      className={`max-w-[92%] sm:max-w-[85%] rounded-lg p-3 sm:p-3.5 leading-relaxed text-xs shadow-xs ${
                        msg.role === 'user'
                          ? 'bg-black text-white dark:bg-white dark:text-black rounded-tr-none font-medium'
                          : 'bg-black/[0.02] dark:bg-white/[0.04] border border-black/10 dark:border-white/15 text-black dark:text-white rounded-tl-none'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <MarkdownRenderer content={msg.content} />
                      )}
                    </div>
                  </div>
                ))}

                {/* Loading / Processing Indicator */}
                {loading && (
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] font-mono text-black/50 dark:text-white/50">
                      <span>FONA Asisten</span>
                      <span>•</span>
                      <span>Berpikir</span>
                    </div>
                    <div className="p-3 rounded-lg rounded-tl-none bg-black/[0.02] dark:bg-white/[0.04] border border-black/10 dark:border-white/15 shadow-xs flex items-center gap-2.5">
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </span>
                      <span className="text-xs text-black/60 dark:text-white/60 font-mono">
                        Berpikir...
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* ─── INPUT COMPOSER BAR (MODERN AI STYLE) ────────────── */}
              <div className="p-3 sm:p-3.5 bg-white dark:bg-black border-t border-black/10 dark:border-white/10 shrink-0">
                <div className="rounded-2xl bg-zinc-100/90 dark:bg-[#171717] border border-black/10 dark:border-white/10 px-3.5 pt-3 pb-2.5 focus-within:border-black/25 dark:focus-within:border-white/25 transition-all shadow-xs">
                  <textarea
                    ref={textareaRef}
                    rows={2}
                    value={inputMessage}
                    onChange={e => setInputMessage(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={isListening ? 'Mendengarkan instruksi suara Anda...' : 'Bertanya pada FONA Asisten'}
                    className={`w-full max-h-28 bg-transparent border-0 resize-none text-xs sm:text-[13px] text-black dark:text-white placeholder-black/45 dark:placeholder-white/45 focus:outline-none leading-relaxed ${
                      isListening ? 'italic font-medium text-amber-600 dark:text-amber-400' : ''
                    }`}
                  />

                  {/* Bottom Toolbar inside Composer */}
                  <div className="flex items-center justify-end pt-1.5 mt-0.5">
                    <div className="flex items-center gap-1.5">
                      {/* Microphone Voice Input Button */}
                      <button
                        type="button"
                        onClick={toggleVoiceInput}
                        title={isListening ? 'Hentikan rekaman suara' : 'Gunakan input suara'}
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                          isListening
                            ? 'bg-rose-500 text-white animate-pulse'
                            : 'text-black/60 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </button>

                      {/* Send Button (muncul saat ada teks yang diketik) */}
                      {inputMessage.trim() && (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleSendMessage()}
                          className="w-8 h-8 rounded-full bg-black dark:bg-white hover:opacity-90 text-white dark:text-black flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
                          title="Kirim (Enter)"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      )}
    </>
  );
}
