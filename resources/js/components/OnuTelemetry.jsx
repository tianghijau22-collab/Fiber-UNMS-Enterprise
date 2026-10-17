import React from 'react';
import { onuPresentation, inventoryTelemetry } from '../lib/onuTelemetry.js';

export function InventoryOnuSignal({ value }) {
  const display=onuPresentation(inventoryTelemetry(value));
  return <span className={`font-mono text-xs font-bold ${display.rxColor}`}>{display.rxLabel}</span>;
}

export function OnuStatus({ value }) {
  const display = onuPresentation(value);
  return <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${display.color}`}>
    <span className="w-1.5 h-1.5 rounded-full bg-current" />{display.label}
  </span>;
}

export function TelemetryStamp({ value }) {
  const display = onuPresentation(value);
  return <span className="block text-[10px] text-slate-500 dark:text-slate-400" title={value.sampled_at || ''}>
    {display.stamp}
    {value.olt_resolution === 'hardware_serial' && <span className="block text-slate-500 dark:text-slate-400">OLT terdeteksi dari SN · topologi belum terhubung</span>}
    {value.serial_duplicate && <span className="block text-amber-600 dark:text-amber-400" title={(value.serial_locations || []).join(', ')}>{value.serial_resolution === 'single_fresh_rx' ? 'SN ganda · memakai lokasi dengan redaman valid' : 'SN ganda · lokasi belum dapat dipastikan'}</span>}
  </span>;
}
