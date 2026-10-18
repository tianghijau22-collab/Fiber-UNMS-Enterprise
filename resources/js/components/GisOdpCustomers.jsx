import React, { useState } from 'react';
import { useStoredRefresh } from '../hooks/useStoredRefresh.js';
import { loadOdpPortDetail } from '../lib/odpPortDetail.js';
import { odpCustomerPorts, currentOdpCustomerTelemetry } from '../lib/gisOdpCustomers.js';
import { onuPresentation } from '../lib/onuTelemetry.js';
import { OnuStatus, TelemetryStamp } from './OnuTelemetry.jsx';

export function OdpCustomerReadings({ ports, now = Date.now() }) {
  return <ul className="divide-y divide-black/10 dark:divide-white/15 max-h-72 overflow-y-auto overscroll-contain pr-1" aria-label="Redaman pelanggan ODP">
    {odpCustomerPorts(ports).map(port => {
      const value = currentOdpCustomerTelemetry(port, now);
      const display = onuPresentation(value);
      return <li key={`${port.id}:${port.ont_id ?? ''}`} className="py-2.5 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] text-black/60 dark:text-white/60">P{port.port_number} · {port.customer_number || 'ID belum tersedia'}</div>
            <p className="text-[11px] font-bold break-words">{port.customer_name || port.customer_name_cache || 'Pelanggan belum terhubung'}</p>
          </div>
          <span className={`font-mono text-xs font-bold whitespace-nowrap ${display.rxColor}`}>{display.rxLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] break-all text-black/60 dark:text-white/60">{port.onu_serial || port.onu_mac || 'SN belum tersedia'}</span>
          <OnuStatus value={value} />
        </div>
        <TelemetryStamp value={value} />
        {value.telemetry_freshness === 'stale' && <p className="text-[10px] text-amber-600 dark:text-amber-400">Data lama · menunggu pembaruan tersimpan</p>}
      </li>;
    })}
  </ul>;
}

// The parent keys this component by ODP ID so a different ODP never inherits its rows.
export default function GisOdpCustomers({ nodeId, expectedCustomers = 0 }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(Date.now);
  useStoredRefresh(async signal => {
    try {
      const data = await loadOdpPortDetail(nodeId, false, fetch, signal);
      if (signal.aborted) return;
      setResult({ ports: data.ports, checkedAt: Date.now() });
      setError('');
    } catch (failure) {
      if (!signal.aborted) setError(failure.message || 'Data pelanggan gagal dimuat.');
    } finally {
      if (!signal.aborted) setNow(Date.now());
    }
  }, { target: `${nodeId}:${retry}`, immediate: true, intervalMs: 10000 });
  const customers = result ? odpCustomerPorts(result.ports) : [];
  return <section className="p-3 bg-black/5 dark:bg-white/5 rounded-lg border border-black/20 dark:border-white/20" aria-label="Pelanggan dan redaman">
    <div className="flex items-center justify-between gap-2">
      <h5 className="text-[10px] font-bold uppercase tracking-wider text-black/70 dark:text-white/70">Pelanggan &amp; Redaman</h5>
      {result && <span className="text-[10px] text-black/60 dark:text-white/60">{customers.length} pelanggan</span>}
    </div>
    <p className="text-[10px] text-black/60 dark:text-white/60 mt-1">Data tersimpan · diperbarui otomatis setiap 10 detik</p>
    {error && <div role="status" className="mt-2 text-[10px] text-amber-700 dark:text-amber-400">
      <p>{error} {result ? 'Data sebelumnya tetap ditampilkan sesuai waktu pembaruan.' : ''}</p>
      <button type="button" onClick={() => setRetry(n => n + 1)} className="underline font-semibold mt-1 cursor-pointer">Coba lagi</button>
    </div>}
    {!result && !error && <p role="status" className="mt-2 text-[11px] text-black/60 dark:text-white/60">Memuat pelanggan…</p>}
    {result && customers.length > 0 && <OdpCustomerReadings ports={result.ports} now={now} />}
    {result && customers.length === 0 && <p className="mt-2 text-[11px] text-black/60 dark:text-white/60">{expectedCustomers > 0 ? 'Data pelanggan pada port belum tersedia.' : 'Belum ada pelanggan terhubung.'}</p>}
  </section>;
}
