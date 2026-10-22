// Tokens become React children. No model-provided text is ever interpreted as HTML.
export function aiInlineTokens(value) {
  const text = typeof value === 'string' ? value : '';
  const pattern = /\*\*([^*\n]+)\*\*|`([^`\n]+)`|\[([^\]\n]*)\]\((https?:\/\/[^\s<>"'`)]+)\)|\*([^*\n]+)\*/g;
  const result = []; let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) result.push({ type: 'text', text: text.slice(cursor, match.index) });
    if (match[1]) result.push({ type: 'strong', text: match[1] });
    else if (match[2]) result.push({ type: 'code', text: match[2] });
    else if (match[4]) {
      let url;
      try { url = new URL(match[4]); } catch { url = null; }
      result.push(url && ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
        ? { type: 'link', text: match[3], href: url.href } : { type: 'text', text: match[0] });
    } else result.push({ type: 'em', text: match[5] });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) result.push({ type: 'text', text: text.slice(cursor) });
  return result;
}

export function aiEnginePresentation(engine, configured, provider) {
  if (engine.state === 'loading') return { label: 'Memeriksa konfigurasi', tone: 'neutral' };
  if (engine.mode === 'cloud' && engine.state === 'available') return { label: `${provider === 'groq' ? 'Groq' : provider === 'gemini' ? 'Gemini' : 'AI Custom'} · terhubung`, tone: 'healthy' };
  if (engine.mode === 'local') return { label: 'Data tersimpan · pencarian lokal', tone: 'neutral' };
  if (engine.mode === 'local_fallback') return { label: 'Mode lokal · cloud belum tersedia', tone: 'warning' };
  if (engine.state === 'degraded' || engine.state === 'unavailable') return { label: 'Layanan AI belum tersedia', tone: 'warning' };
  return { label: configured ? 'Terkonfigurasi · koneksi belum diuji' : 'Mode pencarian lokal', tone: 'neutral' };
}
