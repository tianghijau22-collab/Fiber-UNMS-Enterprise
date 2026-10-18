import React from 'react';
import {faultCoordinates, gisOdpDisplayState} from '../lib/gisOpticalFaults.js';

export default function GisOpticalFaultPanel({diagnostics, faults = [], nodes = [], onLocate, compact = false, expired = false}) {
  if (diagnostics?.version !== 1) return null;
  const coverage = diagnostics.coverage || {};
  const incomplete = Number(coverage.unlinked_routes || 0) + Number(coverage.invalid_routes || 0);
  const allNa = nodes.filter(n => ['no_rx','no_rx_unverified'].includes(gisOdpDisplayState(n))).length;
  const unverifiedNa = nodes.filter(n => gisOdpDisplayState(n) === 'no_rx_unverified').length;
  return (
    <details className={`rounded-lg border border-black/20 dark:border-white/20 bg-white dark:bg-black text-black dark:text-white shadow-sm ${compact ? 'max-h-[35vh] overflow-auto' : ''}`}>
      <summary className="cursor-pointer px-4 py-3 text-xs font-bold">
        Gangguan optik otomatis · {allNa} ODP seluruh ONU N/A · {faults.length} segmen perkiraan
        {incomplete > 0 && <span className="text-amber-700 dark:text-amber-300"> · Topologi belum lengkap</span>}
      </summary>
      <div className="px-4 pb-4 space-y-3 text-xs">
        <p>ODP merah: seluruh Rx yang ditampilkan N/A dan terdapat pembacaan N/A terbaru. Identitas ONU yang belum terverifikasi tetap diberi keterangan. Tanpa bukti terbaru, marker abu-abu.</p>
        {unverifiedNa > 0 && <p>{unverifiedNa} ODP merah masih memiliki ONU belum terverifikasi. Kondisi ini belum menjadi bukti untuk menentukan segmen kabel putus.</p>}
        {expired && <p role="status" className="text-amber-700 dark:text-amber-300">Pembaruan data diperlukan. Perkiraan dengan data kedaluwarsa disembunyikan.</p>}
        {incomplete > 0 && <p className="text-amber-700 dark:text-amber-300">{incomplete} dari {coverage.total_routes} rute belum memiliki hubungan node asal–tujuan yang valid. Hubungkan rute kabel pada data infrastruktur agar batas gangguan dapat ditelusuri.</p>}
        {!faults.length && <p>Belum ada segmen gangguan yang dapat diperkirakan dari data dan hubungan kabel saat ini. Ini belum memastikan seluruh jaringan normal.</p>}
        {faults.map(f => {
          const affected = new Set(f.affected_node_ids.map(String));
          const names = nodes.filter(n => affected.has(String(n.id))).map(n => n.name);
          const {pin} = faultCoordinates(f);
          return <div key={f.id} className="border border-rose-300 dark:border-rose-800 rounded-md p-3 space-y-2">
            <p className="font-bold text-rose-700 dark:text-rose-300">{f.last_signal_node.name} → {f.first_no_rx_node.name}</p>
            <p>Sinyal terakhir: {f.last_signal_node.name}{f.last_signal_node.rx_power != null ? ` (${Number(f.last_signal_node.rx_power).toFixed(2)} dBm)` : ''}. Sesudahnya: {f.affected_odps} ODP / {f.affected_clients} pelanggan N/A.</p>
            <p>ODP terdampak: {names.join(', ')}.</p>
            <p>{f.explanation}</p>
            {f.route_source === 'between_nodes' && <p>Garis penghubung node; bentuk rute kabel belum tersimpan.</p>}
            {pin && <button type="button" onClick={() => onLocate?.(f)} className="rounded border border-rose-400 px-3 py-1.5 text-rose-700 dark:text-rose-300 font-semibold">Lihat area pemeriksaan</button>}
          </div>;
        })}
      </div>
    </details>
  );
}
