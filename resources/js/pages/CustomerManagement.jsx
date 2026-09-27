import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../components/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchableSelect from '../components/SearchableSelect';
import SearchableFilterDropdown from '../components/SearchableFilterDropdown';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import RefreshButton from '../components/RefreshButton';
import CustomerFilterPopover from '../components/CustomerFilterPopover';
import SobokScraperModal from '../components/SobokScraperModal.jsx';

// Memoized single row component for ultra-fast, zero-delay typing in Auto-Discovery
const UnmappedOnuCard = React.memo(function UnmappedOnuCard({
  item,
  odpOptions,
  defaultOdpId,
  onProvision,
  isSubmitting,
  odpPortsCache,
  onFetchPorts,
  onExpandOdpSplitter,
}) {
  const [customerNumber, setCustomerNumber] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('Solok, Sumatera Barat');
  const [odpId, setOdpId] = useState(defaultOdpId || '');
  const [odpPortNumber, setOdpPortNumber] = useState('');

  // Fetch ports when odpId is set or changed
  useEffect(() => {
    if (odpId && onFetchPorts) {
      onFetchPorts(odpId);
    }
  }, [odpId, onFetchPorts]);

  const currentPorts = useMemo(() => {
    if (!odpId || !odpPortsCache) return null;
    return odpPortsCache[odpId] || null;
  }, [odpPortsCache, odpId]);

  const availablePortsCount = useMemo(() => {
    if (!currentPorts) return 0;
    return currentPorts.filter(p => {
      const isOccupied = !!(
        p.customer_service_id ||
        p.customer_id ||
        p.status === 'used' ||
        p.status === 'connected' ||
        (p.customer_name_cache && p.customer_name_cache.trim())
      );
      return !isOccupied;
    }).length;
  }, [currentPorts]);

  // When ports load or change, auto-select the first available port if current is empty or occupied
  useEffect(() => {
    if (currentPorts && currentPorts.length > 0) {
      const isCurrentValid = odpPortNumber && currentPorts.some(p => {
        const isOccupied = !!(
          p.customer_service_id ||
          p.customer_id ||
          p.status === 'used' ||
          p.status === 'connected' ||
          (p.customer_name_cache && p.customer_name_cache.trim())
        );
        return String(p.port_number) === String(odpPortNumber) && !isOccupied;
      });

      if (!isCurrentValid) {
        const firstFree = currentPorts.find(p => {
          const isOccupied = !!(
            p.customer_service_id ||
            p.customer_id ||
            p.status === 'used' ||
            p.status === 'connected' ||
            (p.customer_name_cache && p.customer_name_cache.trim())
          );
          return !isOccupied;
        });
        if (firstFree) {
          setOdpPortNumber(String(firstFree.port_number));
        } else {
          setOdpPortNumber('');
        }
      }
    }
  }, [currentPorts, odpPortNumber]);

  const isOdpFull = odpId && currentPorts && availablePortsCount === 0;

  const handleProvision = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (odpId && (isOdpFull || !odpPortNumber)) return;
    onProvision(item, {
      customer_number: customerNumber,
      name,
      address,
      odp_id: odpId || null,
      odp_port_number: odpId ? odpPortNumber : null,
    });
  };

  return (
    <div className="p-4 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-3 transition-colors">
      {/* Row 1: ONU Info Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
            {item.vendor || 'ONU'} {item.model || ''}
          </span>
          <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
            {item.serial_number}
          </span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            ({item.olt_name || 'OLT'} - Port {item.gpon_port || '—'})
          </span>
        </div>

        <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
          Rx: {item.rx_power != null ? `${item.rx_power} dBm` : '—'}
        </span>
      </div>

      {/* Row 2: Mapping Form Controls */}
      <div className="space-y-2.5 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* ID Pelanggan */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ID Pelanggan (ID ISP)</label>
            <input
              type="text"
              placeholder="misal: CMN 0001"
              value={customerNumber}
              onChange={e => setCustomerNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Nama Pelanggan */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Pelanggan *</label>
            <input
              type="text"
              required
              placeholder="misal: Budi Santoso"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Daerah / Alamat Pemasangan */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Daerah / Alamat Pemasangan</label>
            <input
              type="text"
              placeholder="misal: Koto Baru, Solok"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Line 2: Searchable ODP, Port ODP, Button */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
          {/* Searchable ODP Dropdown */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Pilih Node ODP (Search)</label>
            <SearchableSelect
              value={odpId}
              onChange={val => {
                setOdpId(val);
                setOdpPortNumber('');
              }}
              placeholder="-- Pilih Node ODP --"
              searchPlaceholder="Cari nama ODP..."
              options={odpOptions}
            />
          </div>

          {/* Port ODP */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Port ODP *</label>
              {currentPorts && (
                <span className={`text-[10px] font-bold ${availablePortsCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                  {availablePortsCount > 0 ? `${availablePortsCount} Tersedia` : 'Semua Terisi'}
                </span>
              )}
            </div>

            <select
              value={odpPortNumber}
              onChange={e => setOdpPortNumber(e.target.value)}
              disabled={!odpId || !currentPorts || isOdpFull}
              className={`w-full px-3 py-2.5 rounded-xl border ${
                isOdpFull
                  ? 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white'
              } focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold disabled:opacity-60 cursor-pointer`}
            >
              {!odpId ? (
                <option value="">-- Pilih ODP dahulu --</option>
              ) : !currentPorts ? (
                <option value="">Memuat port ODP...</option>
              ) : isOdpFull ? (
                <option value="">⚠️ Semua Port ODP Penuh ({currentPorts.length}/{currentPorts.length})</option>
              ) : (
                <>
                  <option value="">-- Pilih Port --</option>
                  {currentPorts.map(p => {
                    const isOccupied = !!(
                      p.customer_service_id ||
                      p.customer_id ||
                      p.status === 'used' ||
                      p.status === 'connected' ||
                      (p.customer_name_cache && p.customer_name_cache.trim())
                    );
                    const occupant = p.customer_name || p.customer_name_cache || 'Terisi';
                    return (
                      <option
                        key={p.id || p.port_number}
                        value={p.port_number}
                        disabled={isOccupied}
                        className={isOccupied ? 'text-slate-400 bg-slate-100 dark:bg-slate-800' : 'text-slate-900 dark:text-white font-bold'}
                      >
                        Port {p.port_number} {isOccupied ? `(Terisi: ${occupant}) ❌` : `(Tersedia) ✅`}
                      </option>
                    );
                  })}
                </>
              )}
            </select>
          </div>

          {/* Button */}
          <div>
            <button
              type="button"
              onClick={handleProvision}
              disabled={isSubmitting || !name.trim() || (odpId && (!odpPortNumber || isOdpFull))}
              className="w-full py-2.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  <span>Menghubungkan...</span>
                </>
              ) : isOdpFull ? (
                <span>ODP Penuh</span>
              ) : odpId ? (
                <span>Konekkan ODP {odpPortNumber ? `(Port ${odpPortNumber})` : ''}</span>
              ) : (
                <span>Konekkan (Tanpa ODP)</span>
              )}
            </button>
          </div>
        </div>

        {/* Warning if ODP is full */}
        {isOdpFull && (
          <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-300 dark:border-amber-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span>Seluruh port ({currentPorts.length}/{currentPorts.length}) pada ODP ini sudah terisi.</span>
              <button
                type="button"
                onClick={() => { setOdpId(''); setOdpPortNumber(''); }}
                className="text-[10px] font-bold text-amber-900 dark:text-amber-200 underline cursor-pointer"
              >
                Konekkan Tanpa ODP
              </button>
            </div>
            {onExpandOdpSplitter && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onExpandOdpSplitter(odpId, '1:8')}
                  className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 rounded-lg text-[10px] font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>+ Tambah Splitter 1:8 (+8 Port)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default function CustomerManagement() {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Administrator');
  const canCrud = hasRole('Super Administrator', 'Operator Jaringan');
  const [customers, setCustomers] = useState([]);
  const [odpNodes, setOdpNodes] = useState([]);
  const [odcNodes, setOdcNodes] = useState([]);
  const [olts, setOlts] = useState([]);
  const [servicePackages, setServicePackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterServiceStatus, setFilterServiceStatus] = useState('all');
  const [syncMeta, setSyncMeta] = useState(null);
  const [isSyncingSobok, setIsSyncingSobok] = useState(false);
  const [filterOlt, setFilterOlt] = useState('all');
  const [filterInterface, setFilterInterface] = useState('all');
  const [filterOdc, setFilterOdc] = useState('all');
  const [filterOdp, setFilterOdp] = useState('all');
  const [filterPackage, setFilterPackage] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 8;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterStatus, filterServiceStatus, filterOlt, filterInterface, filterOdc, filterOdp, filterPackage]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState(null);
  const [toast, setToast] = useState(null);

  // OLT Auto-Discovery Wizard State
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [showSobokModal, setShowSobokModal] = useState(false);
  const [unmappedOnus, setUnmappedOnus] = useState([]);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [discoverySearch, setDiscoverySearch] = useState('');
  const [discoveryPage, setDiscoveryPage] = useState(1);
  const [submittingSn, setSubmittingSn] = useState(null);
  const DISCOVERY_PER_PAGE = 15;

  // Shared ODP Ports cache to avoid redundant network requests across cards & modals
  const [odpPortsCache, setOdpPortsCache] = useState({});
  const pendingOdpFetches = useRef(new Set());

  const fetchPortsForOdp = useCallback((nodeId) => {
    if (!nodeId || odpPortsCache[nodeId] || pendingOdpFetches.current.has(nodeId)) return;
    pendingOdpFetches.current.add(nodeId);

    fetch(`/api/network-nodes/${nodeId}/port-detail`)
      .then(r => r.json())
      .then(d => {
        const ports = d.ports ?? [];
        setOdpPortsCache(prev => ({ ...prev, [nodeId]: ports }));
      })
      .catch(err => {
        console.error('Error fetching ports for ODP', nodeId, err);
      })
      .finally(() => {
        pendingOdpFetches.current.delete(nodeId);
      });
  }, [odpPortsCache]);

  const odpSelectOptions = useMemo(() => {
    const list = odpNodes.map(odp => {
      const used = odp.used_ports || 0;
      const total = odp.total_ports || 8;
      const free = Math.max(0, total - used);
      const isFull = used >= total;
      return {
        value: odp.id,
        label: `${odp.name} ${isFull ? '[PENUH]' : `[${free} Port Kosong]`}`,
        sublabel: `Kapasitas: ${used}/${total} Port Terpakai ${isFull ? '— SUDAH PENUH' : `(Sisa ${free} Port Kosong)`}`
      };
    });
    return [
      {
        value: '',
        label: '— Tanpa ODP (Belum Terhubung) —',
        sublabel: 'Daftarkan pelanggan tanpa mengalokasikan port ODP'
      },
      ...list
    ];
  }, [odpNodes]);

  const filteredUnmappedOnus = useMemo(() => {
    if (!discoverySearch.trim()) return unmappedOnus;
    const q = discoverySearch.toLowerCase().trim();
    return unmappedOnus.filter(o => {
      const sn = (o.serial_number || '').toLowerCase();
      const vendor = (o.vendor || '').toLowerCase();
      const model = (o.model || '').toLowerCase();
      const olt = (o.olt_name || '').toLowerCase();
      const port = (o.gpon_port || '').toLowerCase();
      return sn.includes(q) || vendor.includes(q) || model.includes(q) || olt.includes(q) || port.includes(q);
    });
  }, [unmappedOnus, discoverySearch]);

  const totalDiscoveryPages = Math.max(1, Math.ceil(filteredUnmappedOnus.length / DISCOVERY_PER_PAGE));

  const paginatedUnmappedOnus = useMemo(() => {
    const start = (discoveryPage - 1) * DISCOVERY_PER_PAGE;
    return filteredUnmappedOnus.slice(start, start + DISCOVERY_PER_PAGE);
  }, [filteredUnmappedOnus, discoveryPage]);


  // Custom Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Ya, Hapus',
    cancelText: 'Batal',
    type: 'danger',
    loading: false,
    onConfirm: null,
  });

  const openConfirm = ({ title, message, confirmText, type = 'danger', onConfirm }) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText: 'Batal',
      type,
      loading: false,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        onConfirm();
      },
    });
  };

  const closeConfirm = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false, loading: false }));
  };

  // ODP Ports for selection
  const [odpPorts, setOdpPorts] = useState([]);
  const [loadingPorts, setLoadingPorts] = useState(false);
  const [isWithoutOdp, setIsWithoutOdp] = useState(false);
  const [expandingOdp, setExpandingOdp] = useState(false);

  // Form State
  const [form, setForm] = useState({
    customer_number: '',
    name: '',
    address: '',
    status: 'active',
    odp_id: '',
    odp_port_number: '',
    onu_serial: '',
    rx_power: '-18.5',
  });

  const showToastMsg = (msg, type = 'success') => {
    if (typeof window !== 'undefined' && window.showAppAlert) {
      window.showAppAlert({
        type: type === 'error' ? 'error' : 'success',
        title: type === 'error' ? 'Pemberitahuan Gagal' : 'Berhasil!',
        message: msg,
        duration: 2600,
      });
    }
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch Customers (Silent background refresh to prevent UI flickering / scroll reset)
  const fetchCustomers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetch('/api/customers');
      const d = await r.json();
      if (d.data) {
        setCustomers(d.data);
      }
      if (d.sync_meta) {
        setSyncMeta(d.sync_meta);
      }
    } catch {
      // Keep existing data on background error
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle on-demand sync of Sobok service status
  const handleSyncSobokStatus = async () => {
    if (!isSuperAdmin) {
      showToastMsg('Akses ditolak: Hanya Super Administrator yang berwenang menyinkronkan status layanan.', 'error');
      return;
    }
    setIsSyncingSobok(true);
    try {
      const res = await fetch('/api/customers/sobok/sync-service-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      const data = await res.json();
      if (data.status === 'success') {
        showToastMsg(data.message || 'Status layanan Sobok berhasil diperbarui', 'success');
        if (data.data) {
          setSyncMeta(data.data);
        }
        await fetchCustomers(true);
      } else {
        showToastMsg(data.message || 'Gagal menyinkronkan status layanan Sobok', 'error');
      }
    } catch {
      showToastMsg('Terjadi kesalahan jaringan saat sinkronisasi Sobok', 'error');
    } finally {
      setIsSyncingSobok(false);
    }
  };

  // Fetch ODP Nodes (Lightweight fast options mode)
  const fetchOdpNodes = useCallback(async () => {
    try {
      const r = await fetch('/api/network-nodes?type=ODP&simple=1');
      const d = await r.json();
      if (d.data) setOdpNodes(d.data);
    } catch {
      // Keep existing data
    }
  }, []);

  // Fetch ODC Nodes (Lightweight fast options mode)
  const fetchOdcNodes = useCallback(async () => {
    try {
      const r = await fetch('/api/network-nodes?type=ODC&simple=1');
      const d = await r.json();
      if (d.data) setOdcNodes(d.data);
    } catch {
      // Keep existing data
    }
  }, []);

  // Fetch OLT Devices
  const fetchOlts = useCallback(async () => {
    try {
      const r = await fetch('/api/olts');
      const d = await r.json();
      if (d.data) setOlts(d.data);
    } catch {
      // Keep existing data
    }
  }, []);

  // Fetch Service Packages
  const fetchServicePackages = useCallback(async () => {
    try {
      const r = await fetch('/api/service-packages');
      const d = await r.json();
      if (d.data) setServicePackages(d.data);
    } catch {
      // Keep existing data
    }
  }, []);

  useEffect(() => {
    fetchCustomers(false);
    fetchOdpNodes();
    fetchOdcNodes();
    fetchOlts();
    fetchServicePackages();
  }, [fetchCustomers, fetchOdpNodes, fetchOdcNodes, fetchOlts, fetchServicePackages]);

  const refreshAllData = useCallback(async (silent = true) => {
    await Promise.all([
      fetchCustomers(silent),
      fetchOdpNodes(),
      fetchOdcNodes(),
      fetchOlts(),
      fetchServicePackages()
    ]);
  }, [fetchCustomers, fetchOdpNodes, fetchOdcNodes, fetchOlts, fetchServicePackages]);

  const isAnyModalOpen = showModal || showDiscoveryModal || showSobokModal || confirmDialog.isOpen;

  // Background polling specifically targets customer list & redaman (ultra fast & silent)
  const silentCustomerPoll = useCallback(async (silent = true) => {
    await fetchCustomers(silent);
  }, [fetchCustomers]);

  const { isRefreshing, triggerRefresh, timeAgoText } = useAutoRefresh(silentCustomerPoll, {
    enablePolling: true,
    intervalMs: 15000,
    shouldPause: isAnyModalOpen,
  });

  // Fetch Unmapped ONUs from OLT Devices
  const fetchUnmappedOnus = async () => {
    setLoadingDiscovery(true);
    setDiscoverySearch('');
    setDiscoveryPage(1);
    try {
      const res = await fetch('/api/customers/unmapped-onus');
      const d = await res.json();
      setUnmappedOnus(d.data ?? []);
    } catch (e) {
      console.error('Error fetching unmapped ONUs:', e);
    } finally {
      setLoadingDiscovery(false);
    }
  };

  const handleOpenDiscoveryModal = () => {
    if (!isSuperAdmin) {
      showToastMsg('Akses ditolak: Hanya Super Administrator yang berwenang melakukan Auto-Discovery ONU.', 'error');
      return;
    }
    setShowDiscoveryModal(true);
    fetchUnmappedOnus();
  };

  const handleSingleProvision = async (onu, itemData) => {
    if (!itemData || !itemData.name.trim()) {
      showToastMsg('Harap masukkan nama pelanggan terlebih dahulu!', 'error');
      return;
    }
    if (!itemData.odp_port_number) {
      showToastMsg('Harap pilih Port ODP yang masih tersedia!', 'error');
      return;
    }

    setSubmittingSn(onu.serial_number);
    try {
      const res = await fetch('/api/customers/batch-provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            customer_number: itemData.customer_number,
            name: itemData.name,
            address: itemData.address,
            onu_serial: onu.serial_number,
            odp_id: itemData.odp_id,
            odp_port_number: itemData.odp_port_number,
          }]
        }),
      });

      const d = await res.json();
      if (d.status === 'success') {
        showToastMsg(`Pelanggan ${itemData.name} berhasil terhubung dari OLT ke ODP!`);
        fetchCustomers(true);
        fetchOdpNodes();
        setUnmappedOnus(prev => prev.filter(o => o.serial_number !== onu.serial_number));

        // Instantly mark port as occupied in cache
        if (itemData.odp_id && itemData.odp_port_number) {
          setOdpPortsCache(prev => {
            const ports = prev[itemData.odp_id];
            if (!ports) return prev;
            return {
              ...prev,
              [itemData.odp_id]: ports.map(p => {
                if (String(p.port_number) === String(itemData.odp_port_number)) {
                  return {
                    ...p,
                    status: 'used',
                    customer_name: itemData.name,
                    customer_name_cache: itemData.name,
                    customer_service_id: 999999,
                  };
                }
                return p;
              })
            };
          });
        }
      } else {
        showToastMsg(d.message || 'Gagal meregister pelanggan', 'error');
      }
    } catch (e) {
      showToastMsg('Terjadi kesalahan koneksi server', 'error');
    } finally {
      setSubmittingSn(null);
    }
  };

  // Fetch Ports when an ODP is selected in the modal
  const fetchOdpPorts = async (nodeId, keepPort = false) => {
    if (!nodeId) {
      setOdpPorts([]);
      return;
    }
    setLoadingPorts(true);
    try {
      const r = await fetch(`/api/network-nodes/${nodeId}/port-detail`);
      const d = await r.json();
      const ports = d.ports ?? [];
      setOdpPorts(ports);
      // Sync to shared cache
      setOdpPortsCache(prev => ({ ...prev, [nodeId]: ports }));

      // Auto-select first available port if not in edit mode
      if (!keepPort) {
        const firstFree = ports.find(p => {
          const isOccupied = !!(
            p.customer_service_id ||
            p.customer_id ||
            p.status === 'used' ||
            p.status === 'connected' ||
            (p.customer_name_cache && p.customer_name_cache.trim())
          );
          return !isOccupied;
        });
        if (firstFree) {
          setForm(f => ({
            ...f,
            odp_port_number: String(firstFree.port_number),
            odp_port_id: firstFree.id || '',
          }));
        } else {
          setForm(f => ({
            ...f,
            odp_port_number: '',
            odp_port_id: '',
          }));
        }
      }
    } catch {
      setOdpPorts([]);
    } finally {
      setLoadingPorts(false);
    }
  };

  const handleOdpChange = (e) => {
    const odpId = e.target.value;
    if (!odpId) {
      setIsWithoutOdp(true);
      setForm(f => ({ ...f, odp_id: '', odp_port_number: '', odp_port_id: '' }));
      setOdpPorts([]);
      return;
    }
    setIsWithoutOdp(false);
    setForm(f => ({ ...f, odp_id: odpId, odp_port_number: '', odp_port_id: '' }));
    fetchOdpPorts(odpId, false);
  };

  const handleExpandOdpSplitter = async (targetNodeId, ratio = '1:8') => {
    if (!targetNodeId) return;
    setExpandingOdp(true);
    try {
      const res = await fetch(`/api/network-nodes/${targetNodeId}/add-splitter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
        },
        body: JSON.stringify({ splitter_ratio: ratio }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Gagal menambahkan splitter ke ODP');
      }

      showToastMsg(data.message || `Splitter ${ratio} berhasil ditambahkan!`);

      // Refresh list node ODP agar dropdown opsi kapasitas terupdate
      fetchOdpNodes();

      // Refresh ports untuk ODP ini
      await fetchOdpPorts(targetNodeId, false);
    } catch (err) {
      showToastMsg(err.message || 'Gagal menambahkan splitter', 'error');
    } finally {
      setExpandingOdp(false);
    }
  };

  // ─── Auto-open Add Customer modal if navigated from OLT Belum Terdaftar ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1' || params.get('onu_sn')) {
      const onuSn = params.get('onu_sn') || '';
      const onuName = params.get('onu_name') || '';
      setEditingCustomer(null);
      setIsWithoutOdp(false);
      setForm({
        customer_number: '',
        name: onuName && !onuName.startsWith('ONU ') ? onuName : '',
        address: '',
        status: 'Online',
        odp_id: '',
        odp_port_number: '',
        onu_serial: onuSn,
        rx_power: '-18.5',
      });
      setOdpPorts([]);
      setFormErr(null);
      setShowModal(true);
    }
  }, []);

  const openAddModal = () => {
    if (!canCrud) {
      showToastMsg('Akses ditolak: Anda tidak memiliki wewenang untuk mendaftarkan pelanggan.', 'error');
      return;
    }
    setEditingCustomer(null);
    setIsWithoutOdp(false);
    setForm({
      customer_number: '',
      name: '',
      address: '',
      status: 'Online',
      odp_id: '',
      odp_port_number: '',
      onu_serial: sprintf('HWTC-%08X', randInt(10000000, 99999999)),
      rx_power: '-18.5',
    });
    setOdpPorts([]);
    setFormErr(null);
    setShowModal(true);
  };

  const openEditModal = (c) => {
    if (!canCrud) {
      showToastMsg('Akses ditolak: Anda tidak memiliki wewenang untuk mengubah data pelanggan.', 'error');
      return;
    }
    setEditingCustomer(c);
    setIsWithoutOdp(!c.odp_id);
    setForm({
      customer_number: c.customer_number ?? '',
      name: c.name ?? '',
      address: c.address ?? '',
      status: (c.status === 'Online' || (c.rx_power !== null && parseFloat(c.rx_power) > -38.0)) ? 'Online' : 'Offline / LOS',
      odp_id: c.odp_id ?? '',
      odp_port_number: c.odp_port_number ?? '',
      onu_serial: c.onu_serial ?? '',
      rx_power: c.rx_power != null ? String(c.rx_power) : '-18.5',
    });
    setFormErr(null);
    setShowModal(true);
    if (c.odp_id) {
      fetchOdpPorts(c.odp_id, true);
    } else {
      setOdpPorts([]);
    }
  };

  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const sprintf = (format, ...args) => {
    let i = 0;
    return format.replace(/%08X|%d/g, (match) => {
      if (match === '%08X') return args[i++].toString(16).toUpperCase().padStart(8, '0');
      return args[i++];
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canCrud) {
      showToastMsg('Akses ditolak: Anda tidak memiliki wewenang untuk menyimpan data pelanggan.', 'error');
      return;
    }
    setSaving(true);
    setFormErr(null);

    const isEdit = !!editingCustomer;
    const url = isEdit ? `/api/customers/${editingCustomer.id}` : '/api/customers';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const r = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
        },
        body: JSON.stringify(form),
      });

      const res = await r.json();
      if (!r.ok) {
        throw new Error(res.message || 'Gagal menyimpan data pelanggan');
      }

      showToastMsg(isEdit ? 'Data pelanggan berhasil diperbarui!' : 'Pelanggan baru & koneksi ODP berhasil terdaftar!');
      setShowModal(false);
      fetchCustomers();
      fetchOdpNodes();
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (c) => {
    if (!c) return;
    if (!canCrud) {
      showToastMsg('Akses ditolak: Anda tidak memiliki wewenang untuk menghapus data pelanggan.', 'error');
      return;
    }
    openConfirm({
      title: 'Hapus Data Pelanggan?',
      message: (
        <span>
          Apakah Anda yakin ingin menghapus data pelanggan <strong className="text-slate-900 dark:text-white">"{c.name}"</strong> ({c.customer_number || `CMN ${c.id}`})? <br />
          <span className="text-rose-600 dark:text-rose-400 font-bold mt-1 block">Port ODP yang terhubung akan dilepaskan otomatis.</span>
        </span>
      ),
      confirmText: 'Ya, Hapus Pelanggan',
      type: 'danger',
      onConfirm: async () => {
        try {
          const r = await fetch(`/api/customers/${c.id}`, {
            method: 'DELETE',
            headers: {
              'Accept': 'application/json',
              'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
            },
          });
          closeConfirm();
          if (r.ok) {
            showToastMsg('Pelanggan berhasil dihapus & Port ODP dilepaskan.');
            fetchCustomers();
          } else {
            showToastMsg('Gagal menghapus pelanggan', 'error');
          }
        } catch {
          closeConfirm();
          showToastMsg('Gagal menghapus pelanggan', 'error');
        }
      },
    });
  };

  // 1. Available Interfaces based on filterOlt
  const availableInterfaces = useMemo(() => {
    const set = new Set();
    
    // Dari OLT yang dipilih atau semua OLT
    olts.forEach(o => {
      const matchOlt = filterOlt === 'all' || String(o.id) === String(filterOlt);
      if (matchOlt && o.pon_ports && Array.isArray(o.pon_ports)) {
        o.pon_ports.forEach(p => {
          const id = p.port_id || p.port || p.name;
          if (id && id !== '—') set.add(id);
        });
      }
    });

    // Dari data pelanggan
    customers.forEach(c => {
      const matchOlt = filterOlt === 'all' || String(c.olt_id) === String(filterOlt) || c.olt_name === filterOlt;
      if (matchOlt && c.gpon_interface && c.gpon_interface !== '—' && c.gpon_interface !== 'none') {
        set.add(c.gpon_interface);
      }
    });

    // Dari ODP
    odpNodes.forEach(odp => {
      const matchOlt = filterOlt === 'all' || String(odp.olt_device_id) === String(filterOlt);
      if (matchOlt && odp.olt_port_ref && odp.olt_port_ref !== '—' && odp.olt_port_ref !== 'none') {
        set.add(odp.olt_port_ref);
      }
    });

    return Array.from(set).sort();
  }, [customers, olts, odpNodes, filterOlt]);

  // 2. Available ODCs based on filterOlt
  const availableOdcs = useMemo(() => {
    if (filterOlt === 'all') {
      return odcNodes;
    }

    return odcNodes.filter(odc => {
      // Direct OLT link
      if (odc.olt_device_id && String(odc.olt_device_id) === String(filterOlt)) {
        return true;
      }
      // Pelanggan yang berada di ODC ini dan terhubung ke OLT terpilih
      const hasCustomer = customers.some(c => 
        (String(c.olt_id) === String(filterOlt) || c.olt_name === filterOlt) &&
        (String(c.odc_id) === String(odc.id) || c.odc_name === odc.name)
      );
      if (hasCustomer) return true;

      // ODP turunan ODC yang terhubung ke OLT terpilih
      const hasOdp = odpNodes.some(odp =>
        String(odp.olt_device_id) === String(filterOlt) &&
        (String(odp.parent_node_id) === String(odc.id) || String(odp.parent_id) === String(odc.id))
      );
      return hasOdp;
    });
  }, [odcNodes, customers, odpNodes, filterOlt]);

  // 3. Available ODPs based on filterOlt, filterOdc, and filterInterface
  const availableOdps = useMemo(() => {
    return odpNodes.filter(odp => {
      // A. Filter by OLT
      if (filterOlt !== 'all') {
        const directOlt = odp.olt_device_id && String(odp.olt_device_id) === String(filterOlt);
        const custInOlt = customers.some(c =>
          (String(c.olt_id) === String(filterOlt) || c.olt_name === filterOlt) &&
          (String(c.odp_id) === String(odp.id) || c.odp_name === odp.name)
        );
        const parentOdcInOlt = availableOdcs.some(odc =>
          String(odc.id) === String(odp.parent_node_id || odp.parent_id)
        );
        if (!directOlt && !custInOlt && !parentOdcInOlt) return false;
      }

      // B. Filter by ODC
      if (filterOdc !== 'all') {
        const directOdc = String(odp.parent_node_id || odp.parent_id) === String(filterOdc);
        const custInOdc = customers.some(c =>
          (String(c.odc_id) === String(filterOdc) || c.odc_name === filterOdc) &&
          (String(c.odp_id) === String(odp.id) || c.odp_name === odp.name)
        );
        if (!directOdc && !custInOdc) return false;
      }

      // C. Filter by Interface
      if (filterInterface !== 'all') {
        const directPort = odp.olt_port_ref === filterInterface;
        const custInPort = customers.some(c =>
          (c.gpon_interface === filterInterface || (c.gpon_interface && c.gpon_interface.toLowerCase() === filterInterface.toLowerCase())) &&
          (String(c.odp_id) === String(odp.id) || c.odp_name === odp.name)
        );
        if (!directPort && !custInPort) return false;
      }

      return true;
    });
  }, [odpNodes, customers, availableOdcs, filterOlt, filterOdc, filterInterface]);

  // Cascading Selection Handlers
  const handleOltChange = (newOlt) => {
    setFilterOlt(newOlt);
    setFilterInterface('all');
    setFilterOdc('all');
    setFilterOdp('all');
  };

  const handleInterfaceChange = (newInterface) => {
    setFilterInterface(newInterface);
    setFilterOdp('all');
  };

  const handleOdcChange = (newOdc) => {
    setFilterOdc(newOdc);
    setFilterOdp('all');
  };

  // Dropdown Options formatted with Name Only (No Code)
  const oltOptions = useMemo(() => [
    { value: 'all', label: 'Semua OLT' },
    ...olts.map(o => ({ value: o.id, label: o.name }))
  ], [olts]);

  const interfaceOptions = useMemo(() => [
    { value: 'all', label: filterOlt !== 'all' ? `Semua Port OLT (${availableInterfaces.length})` : 'Semua Interface' },
    ...availableInterfaces.map(iface => ({ value: iface, label: iface }))
  ], [availableInterfaces, filterOlt]);

  const odcOptions = useMemo(() => [
    { value: 'all', label: filterOlt !== 'all' ? `Semua ODC OLT (${availableOdcs.length})` : 'Semua ODC' },
    ...availableOdcs.map(odc => ({ value: odc.id, label: odc.name }))
  ], [availableOdcs, filterOlt]);

  const odpOptions = useMemo(() => [
    { value: 'all', label: filterOlt !== 'all' || filterOdc !== 'all' ? `Semua ODP Terpilih (${availableOdps.length})` : 'Semua ODP' },
    ...availableOdps.map(odp => ({ value: odp.id, label: odp.name }))
  ], [availableOdps, filterOlt, filterOdc]);

  // Complete, naturally sorted list of all ODPs for Sobok Scraper & Manual Assignment
  const allOdpListOptions = useMemo(() => {
    return [...odpNodes]
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }))
      .map(odp => {
        const total = parseInt(odp.total_ports) || 0;
        const used = parseInt(odp.used_ports) || 0;
        const available = Math.max(0, total - used);
        const isFull = total > 0 && available === 0;
        return {
          value: odp.id,
          label: odp.name,
          total,
          used,
          available,
          isFull,
        };
      });
  }, [odpNodes]);

  const statusOptions = useMemo(() => [
    { value: 'all', label: 'Semua Perangkat' },
    { value: 'Online', label: 'Online' },
    { value: 'Offline / LOS', label: 'Offline / LOS' },
  ], []);

  const serviceStatusOptions = useMemo(() => [
    { value: 'all', label: 'Semua Layanan' },
    { value: 'OPEN', label: 'Layanan Open (Aktif)' },
    { value: 'BLOKIR', label: 'Layanan Terblokir' },
    { value: 'LOSS_PHYSICAL', label: 'Kabel Putus (Offline & Open)' },
    { value: 'LOSS_BLOCKED', label: 'Isolir Tagihan (Offline & Blokir)' },
  ], []);

  // Unique service packages list for filtering
  const packageOptions = useMemo(() => {
    const set = new Set();
    customers.forEach(c => {
      if (c.package_name && c.package_name.trim()) {
        set.add(c.package_name.trim());
      }
    });
    return Array.from(set).sort().map(pkg => ({ value: pkg, label: pkg }));
  }, [customers]);

  // Filtered customers (Multi-level OLT / Interface / ODC / ODP / Status / Layanan / Paket / Alamat / Search)
  const filtered = useMemo(() => {
    return customers.filter(c => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        c.name?.toLowerCase().includes(q) ||
        c.customer_number?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.package_name?.toLowerCase().includes(q) ||
        c.odp_name?.toLowerCase().includes(q) ||
        c.odp_code?.toLowerCase().includes(q) ||
        c.odc_name?.toLowerCase().includes(q) ||
        c.odc_code?.toLowerCase().includes(q) ||
        c.olt_name?.toLowerCase().includes(q) ||
        c.onu_serial?.toLowerCase().includes(q) ||
        c.ip_address?.toLowerCase().includes(q);

      const matchStatus = filterStatus === 'all' || 
        (filterStatus === 'Online' && (c.status === 'Online' || (c.rx_power !== null && parseFloat(c.rx_power) > -38.0))) ||
        (filterStatus === 'Offline / LOS' && (c.status !== 'Online' && (c.rx_power === null || parseFloat(c.rx_power) <= -38.0)));

      const cServiceStatus = (c.service_status || 'OPEN').toUpperCase();
      const isClientOnline = c.status === 'Online' || (c.rx_power !== null && parseFloat(c.rx_power) > -38.0);
      const matchService = filterServiceStatus === 'all' ||
        (filterServiceStatus === 'OPEN' && cServiceStatus === 'OPEN') ||
        (filterServiceStatus === 'BLOKIR' && cServiceStatus === 'BLOKIR') ||
        (filterServiceStatus === 'LOSS_PHYSICAL' && !isClientOnline && cServiceStatus === 'OPEN') ||
        (filterServiceStatus === 'LOSS_BLOCKED' && !isClientOnline && cServiceStatus === 'BLOKIR');

      const matchOlt = filterOlt === 'all' || String(c.olt_id) === String(filterOlt) || c.olt_name === filterOlt;
      const matchInterface = filterInterface === 'all' || 
        c.gpon_interface === filterInterface || 
        (c.gpon_interface && c.gpon_interface.toLowerCase() === filterInterface.toLowerCase());
      const matchOdc = filterOdc === 'all' || String(c.odc_id) === String(filterOdc) || c.odc_name === filterOdc;
      const matchOdp = filterOdp === 'all' || String(c.odp_id) === String(filterOdp) || c.odp_name === filterOdp;
      const matchPackage = filterPackage === 'all' || c.package_name === filterPackage;

      return matchSearch && matchStatus && matchService && matchOlt && matchInterface && matchOdc && matchOdp && matchPackage;
    });
  }, [customers, search, filterStatus, filterServiceStatus, filterOlt, filterInterface, filterOdc, filterOdp, filterPackage]);

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const isFilterActive = search || filterStatus !== 'all' || filterServiceStatus !== 'all' || filterOlt !== 'all' || filterInterface !== 'all' || filterOdc !== 'all' || filterOdp !== 'all' || filterPackage !== 'all';

  const handleResetFilters = () => {
    setSearch('');
    setFilterStatus('all');
    setFilterServiceStatus('all');
    setFilterOlt('all');
    setFilterInterface('all');
    setFilterOdc('all');
    setFilterOdp('all');
    setFilterPackage('all');
  };

  const handleApplyFilterPopover = ({
    oltValue,
    interfaceValue,
    odcValue,
    odpValue,
    statusValue,
    serviceStatusValue,
    packageValue,
  }) => {
    setFilterOlt(oltValue);
    setFilterInterface(interfaceValue);
    setFilterOdc(odcValue);
    setFilterOdp(odpValue);
    setFilterStatus(statusValue);
    setFilterServiceStatus(serviceStatusValue);
    setFilterPackage(packageValue);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-black p-4 sm:p-5 rounded-lg border border-black/70 dark:border-white/70 shadow-xs">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight">
            Data Pelanggan - Redaman
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          <RefreshButton
            isRefreshing={isRefreshing}
            onRefresh={triggerRefresh}
            lastUpdatedText={timeAgoText}
            className="w-full sm:w-auto"
          />
          {isSuperAdmin && (
            <>
              <button
                type="button"
                onClick={handleSyncSobokStatus}
                disabled={isSyncingSobok}
                className="w-full sm:w-auto px-3.5 py-2.5 bg-white dark:bg-black hover:bg-black/5 dark:hover:bg-white/10 text-black dark:text-white font-bold rounded-md text-xs border border-black/70 dark:border-white/70 hover:border-black dark:hover:border-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                title={`Sinkronisasi Status Layanan (${syncMeta?.domain_used || 'sobok.cinoxmedianet.id'}) - Terakhir: ${syncMeta?.synced_at_human || 'Belum'}`}
              >
                <svg className={`w-3.5 h-3.5 text-blue-500 ${isSyncingSobok ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="truncate">{isSyncingSobok ? 'Menyinkronkan...' : 'Sinkron Status'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSobokModal(true)}
                className="w-full sm:w-auto px-3.5 py-2.5 bg-white dark:bg-black hover:bg-black/5 dark:hover:bg-white/10 text-black dark:text-white font-bold rounded-md text-xs border border-black/70 dark:border-white/70 hover:border-black dark:hover:border-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="truncate">Tarik Data pelanggan</span>
              </button>
              <button
                type="button"
                onClick={handleOpenDiscoveryModal}
                className="w-full sm:w-auto px-3.5 py-2.5 bg-white dark:bg-black hover:bg-black/5 dark:hover:bg-white/10 text-black dark:text-white font-bold rounded-md text-xs border border-black/70 dark:border-white/70 hover:border-black dark:hover:border-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="truncate">Sync Auto-Discover ONU</span>
              </button>
            </>
          )}
          {canCrud && (
            <button
              type="button"
              onClick={openAddModal}
              className="col-span-2 sm:col-span-1 w-full sm:w-auto px-4 py-2.5 bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-bold rounded-md text-xs border border-black dark:border-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Registrasi Manual</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── SEARCH & COMPACT POPUP FILTER BAR ─── */}
      <div className="bg-white dark:bg-black p-3.5 sm:p-4 rounded-lg border border-black/70 dark:border-white/70 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Main Search Input */}
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black/60 dark:text-white/60 pointer-events-none">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Cari ID, nama pelanggan, ODP, SN modem..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2 bg-white dark:bg-black border border-black/70 dark:border-white/70 focus:border-black dark:focus:border-white rounded-md text-xs text-black dark:text-white placeholder-black/50 dark:placeholder-white/50 focus:outline-none transition-all font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Compact Popup Filter & Quick Reset */}
          <div className="flex items-center gap-2 shrink-0">
            <CustomerFilterPopover
              filterOlt={filterOlt}
              filterInterface={filterInterface}
              filterOdc={filterOdc}
              filterOdp={filterOdp}
              filterStatus={filterStatus}
              filterServiceStatus={filterServiceStatus}
              filterPackage={filterPackage}
              olts={olts}
              availableInterfaces={availableInterfaces}
              availableOdcs={availableOdcs}
              availableOdps={availableOdps}
              statusOptions={statusOptions}
              serviceStatusOptions={serviceStatusOptions}
              packageOptions={packageOptions}
              onApplyFilters={handleApplyFilterPopover}
              onResetFilters={handleResetFilters}
            />

            {/* Quick Reset Filter */}
            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 bg-white dark:bg-black border border-rose-500/80 rounded-md hover:bg-rose-500/10 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                title="Reset Semua Filter"
              >
                <span>✕</span>
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Tags / Chips */}
        {isFilterActive && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="text-[11px] font-semibold text-black/60 dark:text-white/60">Filter Aktif:</span>
            {filterOlt !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 text-black dark:text-white">
                <span>OLT: <strong>{olts.find(o => String(o.id) === String(filterOlt))?.name || filterOlt}</strong></span>
                <button type="button" onClick={() => setFilterOlt('all')} className="hover:text-rose-500 cursor-pointer font-bold ml-0.5">✕</button>
              </span>
            )}
            {filterInterface !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 text-black dark:text-white">
                <span>IF: <strong>{filterInterface}</strong></span>
                <button type="button" onClick={() => setFilterInterface('all')} className="hover:text-rose-500 cursor-pointer font-bold ml-0.5">✕</button>
              </span>
            )}
            {filterOdc !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 text-black dark:text-white">
                <span>ODC: <strong>{availableOdcs.find(o => String(o.id) === String(filterOdc))?.name || filterOdc}</strong></span>
                <button type="button" onClick={() => setFilterOdc('all')} className="hover:text-rose-500 cursor-pointer font-bold ml-0.5">✕</button>
              </span>
            )}
            {filterOdp !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 text-black dark:text-white">
                <span>ODP: <strong>{availableOdps.find(o => String(o.id) === String(filterOdp))?.name || filterOdp}</strong></span>
                <button type="button" onClick={() => setFilterOdp('all')} className="hover:text-rose-500 cursor-pointer font-bold ml-0.5">✕</button>
              </span>
            )}
            {filterStatus !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 text-black dark:text-white">
                <span>Perangkat: <strong>{filterStatus}</strong></span>
                <button type="button" onClick={() => setFilterStatus('all')} className="hover:text-rose-500 cursor-pointer font-bold ml-0.5">✕</button>
              </span>
            )}
            {filterServiceStatus !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 text-black dark:text-white">
                <span>Layanan: <strong>{filterServiceStatus}</strong></span>
                <button type="button" onClick={() => setFilterServiceStatus('all')} className="hover:text-rose-500 cursor-pointer font-bold ml-0.5">✕</button>
              </span>
            )}
            {filterPackage !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 text-black dark:text-white">
                <span>Paket: <strong>{filterPackage}</strong></span>
                <button type="button" onClick={() => setFilterPackage('all')} className="hover:text-rose-500 cursor-pointer font-bold ml-0.5">✕</button>
              </span>
            )}
          </div>
        )}

        {/* Filter Summary Stats */}
        <div className="flex items-center justify-between text-xs font-semibold text-black dark:text-white pt-2.5 border-t border-black/20 dark:border-white/20">
          <div>
            Menampilkan: <span className="font-bold">{filtered.length}</span> dari {customers.length} total pelanggan
          </div>
          {isFilterActive && (
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              * Filter aktif diterapkan
            </div>
          )}
        </div>
      </div>

      {/* ─── CUSTOMER DATA CONTENT AREA ─── */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-20 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-semibold text-slate-600 dark:text-slate-300">Memuat data pelanggan &amp; telemetri ODP...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-16 text-center text-slate-400 text-xs space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto text-sm font-bold">
            Data
          </div>
          <p className="font-bold text-sm text-slate-900 dark:text-white">Belum Ada Pelanggan Ditemukan</p>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Coba sesuaikan kriteria filter pencarian{canCrud ? ' atau gunakan tombol Registrasi Manual untuk mendaftarkan pelanggan baru.' : '.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-black dark:text-white">
                <thead className="bg-white dark:bg-black border-b border-black/30 dark:border-white/30 uppercase font-bold text-black dark:text-white text-[11px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">ID Pelanggan</th>
                    <th className="px-4 py-3.5">Nama Pelanggan</th>
                    <th className="px-4 py-3.5">ODP</th>
                    <th className="px-4 py-3.5">OLT &amp; Interface</th>
                    <th className="px-4 py-3.5">Serial (SN) &amp; Sinyal Rx</th>
                    <th className="px-4 py-3.5">Perangkat</th>
                    <th className="px-4 py-3.5">Status</th>
                    {canCrud && <th className="px-4 py-3.5 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/15 dark:divide-white/15 font-sans">
                  {paginated.map(c => {
                    const isClientOnline = c.status === 'Online' || (c.rx_power !== null && parseFloat(c.rx_power) > -38.0);
                    const rx = !isClientOnline ? null : (c.rx_power != null ? parseFloat(c.rx_power) : null);
                    let rxLabel = '—';
                    let rxColorClass = 'text-black/50 dark:text-white/50';

                    if (!isClientOnline) {
                      rxLabel = 'Offline (-40.00 dBm)';
                      rxColorClass = 'text-rose-600 dark:text-rose-400 font-bold';
                    } else if (rx !== null) {
                      rxLabel = `${rx.toFixed(2)} dBm`;
                      if (rx >= -19.0) {
                        rxColorClass = 'text-emerald-600 dark:text-emerald-400 font-bold';
                      } else if (rx >= -24.0) {
                        rxColorClass = 'text-teal-600 dark:text-teal-400 font-bold';
                      } else if (rx >= -27.0) {
                        rxColorClass = 'text-amber-600 dark:text-amber-400 font-bold';
                      } else {
                        rxColorClass = 'text-rose-600 dark:text-rose-400 font-bold';
                      }
                    }

                    return (
                      <tr key={c.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        {/* 1. ID Pelanggan */}
                        <td className="px-4 py-3.5 font-mono text-black dark:text-white font-bold whitespace-nowrap">
                          {c.customer_number || `CMN ${String(c.id).padStart(4, '0')}`}
                        </td>

                        {/* 2. Nama Pelanggan */}
                        <td className="px-4 py-3.5">
                          <span className="font-bold text-black dark:text-white block">{c.name}</span>
                          {c.phone && c.phone !== '-' && (
                            <span className="text-black/60 dark:text-white/60 text-[11px] block">{c.phone}</span>
                          )}
                        </td>

                        {/* 3. ODP */}
                        <td className="px-4 py-3.5 text-black dark:text-white">
                          {c.odp_name ? (
                            <div className="flex flex-col gap-0.5">
                              <span>
                                <strong>{c.odp_name}</strong>
                              </span>
                              {c.odp_port_number && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                  P{c.odp_port_number}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 text-black/70 dark:text-white/70 font-semibold text-[10px] border border-black/15 dark:border-white/15">
                              Tanpa ODP
                            </span>
                          )}
                        </td>

                        {/* 4. OLT & Interface */}
                        <td className="px-4 py-3.5 text-black dark:text-white">
                          <span>{c.olt_name || '—'}</span>
                          {c.gpon_interface && c.gpon_interface !== '—' && (
                            <span className="text-black/60 dark:text-white/60 font-mono text-[11px] ml-1">({c.gpon_interface})</span>
                          )}
                        </td>

                        {/* 5. Serial (SN) & Sinyal Rx */}
                        <td className="px-4 py-3.5 font-mono text-black dark:text-white whitespace-nowrap">
                          <span>{c.onu_serial || '—'}</span>
                          {rxLabel !== '—' && (
                            <span className={`ml-1.5 ${rxColorClass}`}>({rxLabel})</span>
                          )}
                        </td>

                        {/* 6. Perangkat ONU */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {isClientOnline ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 font-sans">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 font-sans">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              Offline / LOS
                            </span>
                          )}
                        </td>

                        {/* 7. Status */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {(c.service_status || '').toUpperCase() === 'BLOKIR' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 font-sans tracking-wide">
                              <svg className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              BLOKIR
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-sans tracking-wide">
                              <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              OPEN
                            </span>
                          )}
                        </td>

                        {/* 8. Actions */}
                        {canCrud && (
                          <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(c)}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold text-black dark:text-white bg-white dark:bg-black hover:bg-black/5 dark:hover:bg-white/10 border border-black/30 dark:border-white/30 transition-all cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(c)}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold text-rose-600 dark:text-rose-400 bg-white dark:bg-black hover:bg-black/5 dark:hover:bg-white/10 border border-rose-500/40 dark:border-rose-400/40 transition-all cursor-pointer"
                            >
                              Hapus
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Desktop Pagination Bar */}
            <div className="p-4 bg-white dark:bg-black border-t border-black/30 dark:border-white/30 flex items-center justify-between text-xs text-black dark:text-white">
              <span className="font-medium">
                Menampilkan data <strong className="font-bold">{(currentPage - 1) * perPage + 1}</strong> - <strong className="font-bold">{Math.min(currentPage * perPage, filtered.length)}</strong> dari total <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{filtered.length}</strong> pelanggan
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-md border border-black/30 dark:border-white/30 bg-white dark:bg-black text-black dark:text-white font-semibold disabled:opacity-40 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer"
                >
                  Sebelumnya
                </button>
                <span className="px-2 font-bold text-black dark:text-white">
                  Halaman {currentPage} dari {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-md border border-black/30 dark:border-white/30 bg-white dark:bg-black text-black dark:text-white font-semibold disabled:opacity-40 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Cards View */}
          <div className="block md:hidden space-y-4">
            {paginated.map((c, idx) => {
              const globalIndex = (currentPage - 1) * perPage + idx + 1;
              const isClientOnline = c.status === 'Online' || (c.rx_power !== null && parseFloat(c.rx_power) > -38.0);
              const rx = !isClientOnline ? null : (c.rx_power != null ? parseFloat(c.rx_power) : null);
              let rxLabel = '—';
              let rxColorClass = 'text-slate-400';

              if (!isClientOnline) {
                rxLabel = 'Offline (-40.00 dBm)';
                rxColorClass = 'text-rose-600 dark:text-rose-400 font-bold';
              } else if (rx !== null) {
                rxLabel = `${rx.toFixed(2)} dBm`;
                if (rx >= -19.0) {
                  rxColorClass = 'text-emerald-600 dark:text-emerald-400 font-bold';
                } else if (rx >= -24.0) {
                  rxColorClass = 'text-teal-600 dark:text-teal-400 font-bold';
                } else if (rx >= -27.0) {
                  rxColorClass = 'text-amber-600 dark:text-amber-400 font-bold';
                } else {
                  rxColorClass = 'text-rose-600 dark:text-rose-400 font-bold';
                }
              }

              return (
                <div key={c.id} className="bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 shadow-xs overflow-hidden">
                  <div className="divide-y divide-black/15 dark:divide-white/15 text-xs text-black dark:text-white">
                    {/* Row 1: Index & Status Badges */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-black">
                      <span className="text-black/70 dark:text-white/70 font-semibold">#{globalIndex} • {c.customer_number || `CMN ${c.id}`}</span>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                          isClientOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isClientOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                          {isClientOnline ? 'Online' : 'Offline'}
                        </span>
                        <span className="text-black/30 dark:text-white/30">|</span>
                        {(c.service_status || '').toUpperCase() === 'BLOKIR' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 tracking-wide">
                            <svg className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            BLOKIR
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tracking-wide">
                            <svg className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            OPEN
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Nama */}
                    <div className="px-4 py-3">
                      <span className="text-black/70 dark:text-white/70 text-[11px] block">Nama Pelanggan</span>
                      <span className="font-bold text-black dark:text-white text-sm">{c.name}</span>
                    </div>

                    {/* Row 3: ODP */}
                    <div className="px-4 py-2.5 grid grid-cols-3 gap-2">
                      <span className="text-black/70 dark:text-white/70">ODP</span>
                      <span className="col-span-2 text-black dark:text-white font-medium">
                        {c.odp_name ? (
                          <span>
                            <strong>{c.odp_name}</strong>
                            {c.odp_port_number && (
                              <span className="ml-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                                (P{c.odp_port_number})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 text-black/70 dark:text-white/70 font-semibold text-[10px] border border-black/15 dark:border-white/15">
                            Tanpa ODP
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Row 4: OLT & Interface */}
                    <div className="px-4 py-2.5 grid grid-cols-3 gap-2 items-center">
                      <span className="text-black/70 dark:text-white/70">OLT / Interface</span>
                      <span className="col-span-2 text-black dark:text-white font-medium">
                        {c.olt_name || '—'} {c.gpon_interface && c.gpon_interface !== '—' ? <span className="font-mono text-[11px] text-black/60 dark:text-white/60">({c.gpon_interface})</span> : ''}
                      </span>
                    </div>

                    {/* Row 5: Serial & Rx */}
                    <div className="px-4 py-2.5 grid grid-cols-3 gap-2 items-center">
                      <span className="text-black/70 dark:text-white/70">SN &amp; Sinyal</span>
                      <div className="col-span-2 flex items-center gap-1.5 font-mono">
                        <span className="text-black dark:text-white font-bold">{c.onu_serial || '—'}</span>
                        {rxLabel !== '—' && (
                          <span className={`ml-1 font-semibold ${rxColorClass}`}>
                            ({rxLabel})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Row 6: Actions */}
                    {canCrud && (
                      <div className="px-4 py-3 bg-white dark:bg-black border-t border-black/30 dark:border-white/30 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          className="px-3 py-1.5 rounded-md text-xs font-semibold text-black dark:text-white bg-white dark:bg-black border border-black/30 dark:border-white/30 hover:border-black dark:hover:border-white transition-all cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          className="px-3 py-1.5 rounded-md text-xs font-semibold text-rose-600 dark:text-rose-400 bg-white dark:bg-black border border-rose-500/40 dark:border-rose-400/40 hover:border-rose-500 dark:hover:border-rose-400 transition-all cursor-pointer"
                        >
                          Hapus
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Mobile Pagination Control */}
            {totalPages > 1 && (
              <div className="p-3 bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 shadow-xs flex items-center justify-between text-xs text-black dark:text-white">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-md border border-black/30 dark:border-white/30 bg-white dark:bg-black text-black dark:text-white font-semibold disabled:opacity-40 cursor-pointer"
                >
                  ← Prev
                </button>
                <span className="font-bold text-black dark:text-white">
                  {currentPage} / {totalPages} (Total {filtered.length})
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-md border border-black/30 dark:border-white/30 bg-white dark:bg-black text-black dark:text-white font-semibold disabled:opacity-40 cursor-pointer"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── MODAL REGISTRASI / EDIT PELANGGAN (FORM INPUT) ─── */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-slate-950/80 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col my-auto max-h-[88vh] overflow-hidden animate-in fade-in zoom-in duration-150">

            {/* Modal Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-950 dark:text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">
                    {editingCustomer ? 'Edit Data Pelanggan' : 'Registrasi Pelanggan & Koneksi ODP Baru'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Lengkapi informasi identitas pelanggan dan alokasi port ODP fiber optik
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
              {formErr && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl font-medium">
                  {formErr}
                </div>
              )}

              {/* Data Utama Pelanggan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1 text-[11px]">
                    ID Pelanggan (ID ISP)
                  </label>
                  <input
                    type="text"
                    placeholder="misal: ISP-100293 / SLK-001"
                    value={form.customer_number}
                    onChange={e => setForm(f => ({ ...f, customer_number: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Dapat diisi manual sesuai ID ISP Anda</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1 text-[11px]">
                    Nama Lengkap Pelanggan *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="misal: Budi Santoso"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1 text-[11px]">
                    Daerah / Alamat Pemasangan
                  </label>
                  <input
                    type="text"
                    placeholder="misal: Koto Baru, Solok"
                    value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1 text-[11px]">
                    Status Pelanggan
                  </label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Online">Online</option>
                    <option value="Offline / LOS">Offline / LOS</option>
                  </select>
                </div>
              </div>

              {/* Section Konek Ke ODP */}
              <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    Alokasi Koneksi ODP (Optical Distribution Point)
                  </h4>
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs">
                    <input
                      type="checkbox"
                      checked={isWithoutOdp}
                      onChange={e => {
                        const checked = e.target.checked;
                        setIsWithoutOdp(checked);
                        if (checked) {
                          setForm(f => ({ ...f, odp_id: '', odp_port_number: '', odp_port_id: '' }));
                          setOdpPorts([]);
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                    />
                    <span className={`text-[11px] font-semibold ${isWithoutOdp ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                      Tanpa ODP / Belum Terhubung
                    </span>
                  </label>
                </div>

                {isWithoutOdp ? (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2.5">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-xs">
                      <p className="font-bold text-amber-900 dark:text-amber-200">Mode Tanpa ODP Aktif</p>
                      <p className="text-amber-700 dark:text-amber-300/90 text-[11px] mt-0.5">
                        Pelanggan akan didaftarkan tanpa sambungan port fisik ODP. Anda dapat memetakan ke ODP kapan saja nanti saat instalasi kabel lapangan selesai.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1 text-[11px]">
                          Pilih ODP *
                        </label>
                        <SearchableSelect
                          value={form.odp_id}
                          onChange={val => {
                            if (!val) {
                              setIsWithoutOdp(true);
                              setForm(f => ({ ...f, odp_id: '', odp_port_number: '', odp_port_id: '' }));
                              setOdpPorts([]);
                            } else {
                              handleOdpChange({ target: { value: val } });
                            }
                          }}
                          placeholder="-- Pilih ODP --"
                          searchPlaceholder="Cari nama ODP..."
                          options={odpSelectOptions}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide text-[11px]">
                            Port ODP *
                          </label>
                          <div className="flex items-center gap-2">
                            {odpPorts.length > 0 && (
                              <span className={`text-[10px] font-bold ${
                                odpPorts.some(p => !p.customer_id && !p.customer_service_id && p.status !== 'used' && p.status !== 'connected' && (!p.customer_name_cache || !p.customer_name_cache.trim()))
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-500'
                              }`}>
                                {odpPorts.filter(p => !p.customer_id && !p.customer_service_id && p.status !== 'used' && p.status !== 'connected' && (!p.customer_name_cache || !p.customer_name_cache.trim())).length} Port Tersedia
                              </span>
                            )}
                            {form.odp_id && (
                              <button
                                type="button"
                                onClick={() => handleExpandOdpSplitter(form.odp_id, '1:8')}
                                disabled={expandingOdp}
                                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                                title="Tambah Kapasitas Splitter (+8 Port)"
                              >
                                {expandingOdp ? 'Menambah...' : '+ Splitter (+8)'}
                              </button>
                            )}
                          </div>
                        </div>
                        <select
                          value={form.odp_port_number}
                          disabled={!form.odp_id || loadingPorts}
                          onChange={e => {
                            const portNum = e.target.value;
                            const selectedPortObj = odpPorts.find(p => String(p.port_number) === String(portNum));
                            setForm(f => ({
                              ...f,
                              odp_port_number: portNum,
                              odp_port_id: selectedPortObj?.id || '',
                            }));
                          }}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 font-medium cursor-pointer"
                        >
                          <option value="">-- Pilih Port --</option>
                          {loadingPorts ? (
                            <option disabled>Memuat port ODP...</option>
                          ) : (
                            odpPorts.map(p => {
                              const isOccupied = !!(
                                p.customer_id ||
                                p.customer_service_id ||
                                p.status === 'used' ||
                                p.status === 'connected' ||
                                (p.customer_name_cache && p.customer_name_cache.trim())
                              );
                              const occupantName = p.customer_name || p.customer_name_cache || 'Terisi';
                              const isCurrentCustomer = editingCustomer && (
                                p.customer_id === editingCustomer.id ||
                                p.customer_name_cache === editingCustomer.name ||
                                (editingCustomer.customer_number && p.customer_number === editingCustomer.customer_number)
                              );
                              return (
                                <option
                                  key={p.id}
                                  value={p.port_number}
                                  disabled={isOccupied && !isCurrentCustomer}
                                >
                                  Port {p.port_number} {isOccupied ? (isCurrentCustomer ? '(Port Pelanggan Ini Saat Ini)' : `(Terisi: ${occupantName})`) : '(Tersedia)'}
                                </option>
                              );
                            })
                          )}
                        </select>
                      </div>
                    </div>

                    {/* Jika ODP Dipilih dan Penuh, tampilkan Splitter Expansion Box */}
                    {form.odp_id && odpPorts.length > 0 && odpPorts.every(p => {
                      const isOccupied = !!(p.customer_id || p.customer_service_id || p.status === 'used' || p.status === 'connected' || (p.customer_name_cache && p.customer_name_cache.trim()));
                      const isCurrentCustomer = editingCustomer && (p.customer_id === editingCustomer.id || p.customer_name_cache === editingCustomer.name);
                      return isOccupied && !isCurrentCustomer;
                    }) && (
                      <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 space-y-2.5">
                        <div className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div className="flex-1">
                            <p className="font-bold text-xs text-rose-900 dark:text-rose-200">
                              Semua port pada ODP ini sudah terisi penuh!
                            </p>
                            <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">
                              Anda dapat langsung menambah splitter port ke ODP ini sekarang, memilih ODP lain, atau mendaftar tanpa ODP.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-200 dark:border-rose-900/40">
                          <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300">Ekspansi ODP:</span>
                          <button
                            type="button"
                            disabled={expandingOdp}
                            onClick={() => handleExpandOdpSplitter(form.odp_id, '1:8')}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            {expandingOdp ? 'Memproses...' : 'Tambah Splitter 1:8 (+8 Port)'}
                          </button>
                          <button
                            type="button"
                            disabled={expandingOdp}
                            onClick={() => handleExpandOdpSplitter(form.odp_id, '1:4')}
                            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            + Splitter 1:4 (+4)
                          </button>
                          <button
                            type="button"
                            disabled={expandingOdp}
                            onClick={() => handleExpandOdpSplitter(form.odp_id, '1:16')}
                            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            + Splitter 1:16 (+16)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsWithoutOdp(true);
                              setForm(f => ({ ...f, odp_id: '', odp_port_number: '', odp_port_id: '' }));
                              setOdpPorts([]);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold text-[11px] transition-colors cursor-pointer ml-auto"
                          >
                            Daftarkan Tanpa ODP
                          </button>
                        </div>
                      </div>
                    )}

                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Saat disimpan, pelanggan akan otomatis terhubung ke Port ODP yang dipilih dan muncul di monitoring sinyal optik /network.
                    </p>
                  </>
                )}
              </div>

              {/* Section ONT & Optical Power */}
              <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                  ONT / ONU &amp; Monitoring Sinyal
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1 text-[11px]">
                      Serial Number ONT (SN)
                    </label>
                    <input
                      type="text"
                      placeholder="contoh: HWTC-A84F2B01"
                      value={form.onu_serial}
                      onChange={e => setForm(f => ({ ...f, onu_serial: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1 text-[11px]">
                      Estimasi Sinyal (Rx Power dBm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="-18.5"
                      value={form.rx_power}
                      onChange={e => setForm(f => ({ ...f, rx_power: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-60 shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>{isWithoutOdp || !form.odp_id ? 'Simpan Data Pelanggan (Tanpa ODP)' : 'Simpan & Konekkan ke ODP'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─── OLT ONU AUTO-DISCOVERY & MAPPING WIZARD MODAL ─── */}
      {showDiscoveryModal && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-slate-950/80 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
          <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[88vh] overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-800 text-slate-950 dark:text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-950 dark:text-white">Auto-Discover &amp; Fast Mapping ONU OLT</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Mendapatkan modem ONU terdaftar dari OLT secara otomatis. Cukup isi nama &amp; pilih ODP tanpa perlu ketik SN manual!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDiscoveryModal(false)}
                className="w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Filter / Search & Pagination Bar */}
            <div className="px-6 py-3 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Cari SN, vendor, model, OLT, atau port..."
                  value={discoverySearch}
                  onChange={(e) => {
                    setDiscoverySearch(e.target.value);
                    setDiscoveryPage(1);
                  }}
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-950 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {discoverySearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setDiscoverySearch('');
                      setDiscoveryPage(1);
                    }}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                  {filteredUnmappedOnus.length > 0 ? (
                    <>
                      Menampilkan <span className="font-bold text-slate-900 dark:text-white">{(discoveryPage - 1) * DISCOVERY_PER_PAGE + 1}</span> - <span className="font-bold text-slate-900 dark:text-white">{Math.min(discoveryPage * DISCOVERY_PER_PAGE, filteredUnmappedOnus.length)}</span> dari <span className="font-bold text-emerald-600 dark:text-emerald-400">{filteredUnmappedOnus.length}</span>
                      {discoverySearch && ` (total ${unmappedOnus.length})`}
                    </>
                  ) : (
                    `0 modem ditemukan`
                  )}
                </span>

                {totalDiscoveryPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={discoveryPage <= 1}
                      onClick={() => setDiscoveryPage(p => Math.max(1, p - 1))}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      ◀ Prev
                    </button>
                    <span className="text-xs font-mono font-bold px-2 text-slate-700 dark:text-slate-300">
                      {discoveryPage} / {totalDiscoveryPages}
                    </span>
                    <button
                      type="button"
                      disabled={discoveryPage >= totalDiscoveryPages}
                      onClick={() => setDiscoveryPage(p => Math.min(totalDiscoveryPages, p + 1))}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next ▶
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {loadingDiscovery ? (
                <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-3">
                  <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="font-semibold text-slate-600 dark:text-slate-300">Melakukan pemindaian ONU modem terdaftar dari OLT...</p>
                </div>
              ) : unmappedOnus.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                    ✓
                  </div>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">Seluruh ONU Modem OLT Telah Terpetakan!</p>
                  <p className="mt-1 max-w-md mx-auto text-slate-500 dark:text-slate-400">
                    Semua SN ONU modem yang aktif di OLT sudah terhubung dengan data Pelanggan &amp; Port ODP.
                  </p>
                </div>
              ) : filteredUnmappedOnus.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-2 text-base">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Tidak ada modem yang cocok dengan kata kunci</p>
                  <p className="mt-1 text-slate-400">Coba ubah kata kunci pencarian SN, Vendor, atau OLT.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedUnmappedOnus.map(item => (
                    <UnmappedOnuCard
                      key={item.serial_number}
                      item={item}
                      odpOptions={odpSelectOptions}
                      defaultOdpId={odpNodes[0]?.id}
                      onProvision={handleSingleProvision}
                      isSubmitting={submittingSn === item.serial_number}
                      odpPortsCache={odpPortsCache}
                      onFetchPorts={fetchPortsForOdp}
                      onExpandOdpSplitter={handleExpandOdpSplitter}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-500 dark:text-slate-400">Auto-Discovery Sync OLT Active Engine</span>
              <div className="flex items-center gap-3">
                {totalDiscoveryPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={discoveryPage <= 1}
                      onClick={() => setDiscoveryPage(p => Math.max(1, p - 1))}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      ◀ Prev
                    </button>
                    <span className="text-xs font-mono font-bold px-2 text-slate-700 dark:text-slate-300">
                      {discoveryPage} / {totalDiscoveryPages}
                    </span>
                    <button
                      type="button"
                      disabled={discoveryPage >= totalDiscoveryPages}
                      onClick={() => setDiscoveryPage(p => Math.min(totalDiscoveryPages, p + 1))}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next ▶
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowDiscoveryModal(false)}
                  className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Sobok Scraper & Import Modal */}
      <SobokScraperModal
        isOpen={showSobokModal}
        onClose={() => setShowSobokModal(false)}
        odpOptions={allOdpListOptions}
        onExpandOdpSplitter={handleExpandOdpSplitter}
        onCustomerImported={(newCust) => {
          showToastMsg(`Pelanggan ${newCust.name} (${newCust.customer_number}) berhasil ditambahkan ke sistem!`);
          fetchCustomers(true);
          fetchOdpNodes();
        }}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        type={confirmDialog.type}
        loading={confirmDialog.loading}
        onConfirm={confirmDialog.onConfirm}
        onClose={closeConfirm}
      />
    </div>
  );
}

