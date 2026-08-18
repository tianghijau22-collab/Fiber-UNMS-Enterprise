import React, { useState, useEffect } from 'react';

const mockInvoices = [
  { id: 'INV-202608-001', customer: 'Budi Santoso', package: 'Home Fiber 50Mbps', amount: 'Rp 350.000', dueDate: '2026-08-10', status: 'Paid', paidAt: '2026-08-02 09:14' },
  { id: 'INV-202608-002', customer: 'Siti Rahma', package: 'Home Fiber 30Mbps', amount: 'Rp 250.000', dueDate: '2026-08-10', status: 'Unpaid', paidAt: '-' },
  { id: 'INV-202608-003', customer: 'PT Maju Bersama', package: 'Enterprise Dedicated 200Mbps', amount: 'Rp 2.500.000', dueDate: '2026-08-05', status: 'Paid', paidAt: '2026-08-01 14:30' },
  { id: 'INV-202607-089', customer: 'Ahmad Dahlan', package: 'Home Fiber 20Mbps', amount: 'Rp 180.000', dueDate: '2026-07-20', status: 'Overdue / Isolated', paidAt: '-' }
];

export default function BillingInvoicing() {
  const [invoices, setInvoices] = useState(mockInvoices);
  const [filter, setFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 6;

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const filtered = invoices.filter(inv => {
    if (filter === 'ALL') return true;
    if (filter === 'Paid') return inv.status === 'Paid';
    if (filter === 'Unpaid') return inv.status === 'Unpaid';
    if (filter === 'Overdue') return inv.status.includes('Overdue');
    return true;
  });

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-6 transition-colors duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-black p-5 rounded-lg border border-slate-200 dark:border-[#222222] shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
            Keuangan &amp; Tagihan Billing Pelanggan
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Generasi invoice bulanan, verifikasi pembayaran, &amp; status isolir otomatis
          </p>
        </div>
        <button className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2">
          <span>+ Generate Invoice Bulanan</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex items-center gap-2">
          {['ALL', 'Paid', 'Unpaid', 'Overdue'].map(st => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                filter === st
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {st === 'ALL' ? 'Semua Tagihan' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
              <tr>
                <th className="px-6 py-4">No. Invoice</th>
                <th className="px-6 py-4">Nama Pelanggan</th>
                <th className="px-6 py-4">Paket Layanan</th>
                <th className="px-6 py-4">Total Tagihan</th>
                <th className="px-6 py-4">Jatuh Tempo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginated.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {inv.id}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">
                    {inv.customer}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-300">
                    {inv.package}
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-100">
                    {inv.amount}
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-500 dark:text-slate-400">
                    {inv.dueDate}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      inv.status === 'Paid' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                      inv.status === 'Unpaid' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800' :
                      'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                      Kirim Kuwitansi →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Desktop Pagination Bar */}
        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">
            Menampilkan data <span className="font-bold text-slate-800 dark:text-slate-200">{(currentPage - 1) * perPage + 1}</span> - <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(currentPage * perPage, filtered.length)}</span> dari total <span className="font-bold text-indigo-600 dark:text-indigo-400">{filtered.length}</span> invoice
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40"
            >
              ← Sebelumnya
            </button>
            <span className="px-2 font-bold text-slate-700 dark:text-slate-200">
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40"
            >
              Berikutnya →
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Cards View */}
      <div className="block md:hidden space-y-4">
        {paginated.map((inv, idx) => {
          const globalIdx = (currentPage - 1) * perPage + idx + 1;
          return (
            <div key={inv.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center bg-slate-50/70 dark:bg-slate-800/40">
                  <span className="text-slate-400 font-semibold">#</span>
                  <span className="col-span-2 font-mono font-bold text-slate-700 dark:text-slate-200">{globalIdx}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                  <span className="text-slate-400 font-semibold">Invoice No</span>
                  <span className="col-span-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">{inv.id}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                  <span className="text-slate-400 font-semibold">Customer</span>
                  <span className="col-span-2 font-bold text-slate-800 dark:text-slate-100 uppercase">{inv.customer}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                  <span className="text-slate-400 font-semibold">Package</span>
                  <span className="col-span-2 text-slate-700 dark:text-slate-300">{inv.package}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                  <span className="text-slate-400 font-semibold">Amount</span>
                  <span className="col-span-2 font-bold text-slate-800 dark:text-slate-100">{inv.amount}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                  <span className="text-slate-400 font-semibold">Due Date</span>
                  <span className="col-span-2 font-mono text-slate-500">{inv.dueDate}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                  <span className="text-slate-400 font-semibold">Status</span>
                  <span className="col-span-2">
                    <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                      inv.status === 'Paid' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                      inv.status === 'Unpaid' ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800' :
                      'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}>
                      {inv.status}
                    </span>
                  </span>
                </div>
                <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-end">
                  <button className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold">
                    Kirim Kuwitansi
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {totalPages > 1 && (
          <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between text-xs">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {currentPage} / {totalPages} (Total {filtered.length})
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
