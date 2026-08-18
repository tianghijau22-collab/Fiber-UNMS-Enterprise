import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';

const mockItems = [
  { id: 1, code: 'MAT-ONT-01', name: 'ONT Huawei HG8310M GPON', category: 'Active Device', unit: 'Unit', stock: 142, minStock: 30, location: 'Gudang Utama A-01', status: 'Available' },
  { id: 2, code: 'MAT-CAB-01', name: 'Kabel Drop Core 1 Core Fiber Optik (1000m)', category: 'Cable', unit: 'Roll', stock: 18, minStock: 5, location: 'Gudang Utama B-04', status: 'Available' },
  { id: 3, code: 'MAT-SPL-08', name: 'Splitter PLC 1:8 SC/APC', category: 'Passive Device', unit: 'Pcs', stock: 64, minStock: 20, location: 'Gudang Utama C-02', status: 'Available' },
  { id: 4, code: 'MAT-FAS-01', name: 'Fast Connector SC/APC Single Mode', category: 'Accessory', unit: 'Box (100 pcs)', stock: 8, minStock: 10, location: 'Gudang Utama C-05', status: 'Low Stock' },
  { id: 5, code: 'MAT-SPL-01', name: 'Fujikura 70S+ Optical Fiber Splicer Kit', category: 'Tool & Equipment', unit: 'Set', stock: 4, minStock: 2, location: 'Gudang Utama', status: 'Available' }
];

export default function InventoryManagement() {
  const { hasRole } = useAuth();
  const canCrud = hasRole('Super Administrator', 'Operator Jaringan', 'NOC Operator');
  const [items, setItems] = useState(mockItems);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 6;

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.code.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-6 transition-colors duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-black p-5 rounded-lg border border-slate-200 dark:border-[#222222] shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
            Manajemen Inventaris &amp; Stok Material
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pengawasan stok gudang, distribusi kabel, ONT, splitter, &amp; perangkat aktif FTTH
          </p>
        </div>
        {canCrud && (
          <div className="flex items-center gap-2">
            <button className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2">
              <span>+ Tambah Barang / Material</span>
            </button>
          </div>
        )}
      </div>

      {/* Search & Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <input
            type="text"
            placeholder="Cari nama material, kode barang, kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 p-4 rounded-2xl flex items-center justify-between text-amber-900 dark:text-amber-200">
          <div>
            <span className="text-xs font-bold uppercase text-amber-700 dark:text-amber-400">Peringatan Stok Low</span>
            <p className="text-xl font-semibold mt-0.5">1 Material</p>
          </div>
          <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping"></span>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
              <tr>
                <th className="px-6 py-4">Kode &amp; Nama Barang</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4">Stok Saat Ini</th>
                <th className="px-6 py-4">Lokasi Rak/Gudang</th>
                <th className="px-6 py-4">Status Stok</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginated.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-800 dark:text-slate-100">{item.name}</p>
                    <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{item.code}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-base text-slate-800 dark:text-slate-100">{item.stock}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">/{item.unit}</span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                    {item.location}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      item.status === 'Available' 
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                        : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                      Mutasi Material →
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
            Menampilkan data <span className="font-bold text-slate-800 dark:text-slate-200">{(currentPage - 1) * perPage + 1}</span> - <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(currentPage * perPage, filtered.length)}</span> dari total <span className="font-bold text-indigo-600 dark:text-indigo-400">{filtered.length}</span> material
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
        {paginated.map((item, idx) => {
          const globalIdx = (currentPage - 1) * perPage + idx + 1;
          return (
            <div key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center bg-slate-50/70 dark:bg-slate-800/40">
                  <span className="text-slate-400 font-semibold">#</span>
                  <span className="col-span-2 font-mono font-bold text-slate-700 dark:text-slate-200">{globalIdx}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                  <span className="text-slate-400 font-semibold">Code</span>
                  <span className="col-span-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">{item.code}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                  <span className="text-slate-400 font-semibold">Name</span>
                  <span className="col-span-2 font-bold text-slate-800 dark:text-slate-100 uppercase">{item.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                  <span className="text-slate-400 font-semibold">Category</span>
                  <span className="col-span-2 text-slate-700 dark:text-slate-300">{item.category}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                  <span className="text-slate-400 font-semibold">Stock</span>
                  <span className="col-span-2 font-bold text-slate-800 dark:text-slate-100">{item.stock} {item.unit}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                  <span className="text-slate-400 font-semibold">Location</span>
                  <span className="col-span-2 text-slate-700 dark:text-slate-300">{item.location}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                  <span className="text-slate-400 font-semibold">Status</span>
                  <span className="col-span-2">
                    <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                      item.status === 'Available' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}>
                      {item.status}
                    </span>
                  </span>
                </div>
                <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-end">
                  <button className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold">
                    Mutasi Material
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
