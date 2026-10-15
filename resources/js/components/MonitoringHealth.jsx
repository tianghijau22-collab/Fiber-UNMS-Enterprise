import React from 'react';
import { healthStatus, healthTime } from '../lib/monitoringHealth.js';

export function HealthBadge({status}) {
  const {label, tone} = healthStatus(status);
  const color = tone === 'good' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
    : tone === 'bad' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
    : 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
  return <span className={`inline-block rounded-lg px-2 py-1 text-[11px] font-semibold ${color}`}>{label}</span>;
}

export default function MonitoringHealth({worker, vpn}) {
  return <section className="space-y-3" aria-label="Kesehatan koneksi dan data OLT">
    <p className="text-xs text-slate-500">Jumlah sampel mencakup inventori terdaftar dan belum terdaftar. Sampel terkini masih dapat memiliki status atau pengukuran Rx yang belum tersedia.</p>
    <div className="grid gap-3 sm:grid-cols-3 text-xs">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
        <p className="font-bold">Layanan pengumpul data</p><HealthBadge status={worker.status}/>
        <p className="text-slate-500">Siklus terakhir: {healthTime(worker.last_run_at)}</p>
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
        <p className="font-bold">Jalur VPN</p><HealthBadge status={vpn.status}/>
        <p className="text-slate-500">{vpn.quality_text || 'Belum diperiksa'}</p>
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
        <p className="font-bold">Hasil siklus terakhir</p><HealthBadge status={worker.cycle_result}/>
        <p className="text-slate-500">Layanan berjalan tidak selalu berarti data berhasil terbaca.</p>
      </div>
    </div>
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 dark:bg-slate-900"><tr>
          {['OLT', 'Koneksi perangkat', 'Pembacaan', 'Kebaruan data', 'Kelengkapan data'].map(h=><th key={h} className="p-3">{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {(worker.device_reports || []).map(r=>{
            const data=r.data_health || {};const connection=r.connection || {};const poll=r.poll || {};
            return <tr key={r.device_id}>
              <td className="p-3"><strong>{r.device_name}</strong><p className="text-slate-500 mt-1">{r.ip}</p></td>
              <td className="p-3 space-y-1"><HealthBadge status={connection.status}/><p className="text-slate-500">Diperiksa: {healthTime(connection.checked_at)}</p>
                {connection.latency_ms != null && <p>{connection.latency_ms} ms · respons SNMP</p>}</td>
              <td className="p-3 space-y-1"><HealthBadge status={r.status}/>
                <p className="text-slate-500">{poll.scope === 'selected_ports' ? 'Port terpilih' : 'Cakupan perangkat'}</p>
                <p>{poll.rows_read == null ? 'Jumlah belum tersedia' : `${poll.rows_read} status terbaca`}</p>
                {r.query_elapsed_seconds != null && <p>Berlangsung {r.query_elapsed_seconds} detik</p>}
                {poll.duration_ms != null && <p>{(poll.duration_ms/1000).toFixed(2)} detik</p>}</td>
              <td className="p-3 space-y-1"><HealthBadge status={data.status}/>
                <p>{data.fresh_samples ?? 0} / {data.total ?? 0} sampel terkini</p>
                <p className="text-slate-500">Terbaru: {healthTime(data.latest_sample_at)}</p>
                <p className="text-slate-500">{data.stale_samples ?? 0} kedaluwarsa · {data.missing_samples ?? 0} tanpa waktu pengambilan</p></td>
              <td className="p-3 space-y-1">
                <p>{data.unknown_state ?? 0} status belum pasti</p><p>{data.identity_unresolved ?? 0} identitas belum pasti</p>
                <p>{data.rx_missing_online ?? 0} Online tanpa pengukuran Rx</p>
                <p className="text-slate-500">Data tersimpan: {r.db_registered_total ?? 0} terdaftar / {r.db_unregistered_total ?? 0} belum terdaftar</p>
              </td>
            </tr>;
          })}
          {!worker.device_reports?.length && <tr><td colSpan="5" className="p-3 text-slate-500">Belum ada perangkat yang dapat dinilai.</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}
