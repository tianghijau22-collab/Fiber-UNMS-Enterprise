import React from 'react';
import { duplicateCustomerTarget } from '../lib/oltMismatchCustomers.js';

export default function OltMismatchCustomerActions({ onu, canDelete = false, busy = false, onDelete }) {
  const target = duplicateCustomerTarget(onu);
  return <span className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
    {onu.customer_id && <a href={`/customers?id=${onu.customer_id}`}
      className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 text-black/80 dark:text-white/90 text-xs font-bold hover:bg-black/10 dark:hover:bg-white/20 transition-colors inline-block">Pelanggan</a>}
    {canDelete && target && <button type="button" disabled={busy} onClick={() => onDelete(onu)}
      title={`Hapus pelanggan ${target.name} (${target.number})`}
      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Hapus Pelanggan</button>}
  </span>;
}
