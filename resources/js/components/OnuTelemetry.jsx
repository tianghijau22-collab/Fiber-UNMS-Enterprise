import React from 'react';
import { onuPresentation } from '../lib/onuTelemetry.js';

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
  </span>;
}
