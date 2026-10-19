import { generateCandidates } from './topologyCandidates.js';

self.onmessage = event => {
  try { self.postMessage({ result: generateCandidates(event.data.data, event.data.tolerance) }); }
  catch { self.postMessage({ error: 'Analisis koordinat gagal. Periksa kelengkapan rute dan coba lagi.' }); }
};
