import React from 'react';
import { inventoryTelemetry, onuPresentation } from '../lib/onuTelemetry.js';
import { TelemetryStamp } from './OnuTelemetry.jsx';

export function ReviewInterface({ onu }) {
  const value = inventoryTelemetry(onu.review_telemetry || {});
  const display = onuPresentation(value);
  return <div className="min-w-36">
    <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 break-words">{display.interfaceLabel}</span>
    {value.identity_status === 'resolved' && <span className="block font-mono text-[11px] text-black/60 dark:text-white/70">ONU {onu.review_telemetry.onu_id}</span>}
    {onu.issue_code === 'duplicate_customer_serial' && value.identity_status === 'resolved' && <span className="block text-[10px] text-slate-500 dark:text-slate-400">Lokasi fisik berdasarkan SN</span>}
    {['registered_other_olt','registration_scope_unverified'].includes(onu.issue_code) && value.identity_status === 'resolved' && <span className="block text-[10px] text-amber-600 dark:text-amber-400">Terdeteksi pada OLT ini</span>}
  </div>;
}

export function ReviewRxPower({ onu }) {
  const value = inventoryTelemetry(onu.review_telemetry || {});
  const display = onuPresentation(value);
  return <div className="min-w-32">
    <span className={`font-mono text-xs font-bold ${display.rxColor}`}>{display.rxLabel}</span>
    <TelemetryStamp value={value} />
  </div>;
}
