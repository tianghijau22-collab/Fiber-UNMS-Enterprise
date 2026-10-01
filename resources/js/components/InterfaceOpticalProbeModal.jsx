import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import SearchableSelect from './SearchableSelect';

export default function InterfaceOpticalProbeModal({
  isOpen,
  onClose,
  olts = [],
  availableInterfaces = [],
  initialOltId = 'all',
  initialInterface = '',
  onProbeCompleted,
}) {
  const [selectedOlt, setSelectedOlt] = useState(initialOltId || 'all');
  const [selectedInterface, setSelectedInterface] = useState(initialInterface || '');
  const [loading, setLoading] = useState(false);
  const [probeResult, setProbeResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [syncDb, setSyncDb] = useState(true);

  // Screenshot states
  const [capturingScreenshot, setCapturingScreenshot] = useState(false);
  const [screenshotProgressText, setScreenshotProgressText] = useState('');
  const [screenshotSuccess, setScreenshotSuccess] = useState(false);

  // Interface options with search formatting (filtered dynamically by selected OLT)
  const interfaceOptions = useMemo(() => {
    const list = [];
    const targetOltObj = (olts || []).find((o) => String(o.id) === String(selectedOlt));

    if (targetOltObj && Array.isArray(targetOltObj.pon_ports) && targetOltObj.pon_ports.length > 0) {
      targetOltObj.pon_ports.forEach((p) => {
        const id = p.port_id || p.port || p.name;
        if (id && id !== '—' && id !== 'all') list.push(id);
      });
    }

    // Fallback ke availableInterfaces jika list masih kosong
    if (list.length === 0) {
      (availableInterfaces || []).forEach((iface) => {
        if (iface && iface !== '—' && iface !== 'all') list.push(iface);
      });
    }

    const uniqueList = Array.from(new Set(list)).sort((a, b) => {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    return uniqueList.map((iface) => ({
      value: iface,
      label: iface,
      sublabel: `Port PON ${iface}`,
    }));
  }, [availableInterfaces, olts, selectedOlt]);

  // Table local filter
  const [tableSearch, setTableSearch] = useState('');
  const [qualityFilter, setQualityFilter] = useState('ALL'); // ALL, ONLINE, OFFLINE, WARNING_CRITICAL

  // Update selected interface when modal opens or initial values change
  useEffect(() => {
    if (isOpen) {
      if (initialOltId && initialOltId !== 'all') {
        setSelectedOlt(initialOltId);
      } else if (olts.length > 0 && selectedOlt === 'all') {
        setSelectedOlt(olts[0].id);
      }

      if (initialInterface && initialInterface !== 'all') {
        setSelectedInterface(initialInterface);
      } else if (!selectedInterface && availableInterfaces.length > 0) {
        setSelectedInterface(availableInterfaces[0]);
      }
      setErrorMsg(null);
    }
  }, [isOpen, initialOltId, initialInterface, olts, availableInterfaces]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleExecuteProbe = useCallback(async (targetIface = selectedInterface, targetOlt = selectedOlt) => {
    if (!targetIface || targetIface === 'all' || targetIface === '—') {
      setErrorMsg('Harap pilih interface / port PON OLT terlebih dahulu.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/customers/probe-interface-optical', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
        },
        body: JSON.stringify({
          olt_id: targetOlt,
          interface: targetIface,
          sync_db: syncDb,
        }),
      });

      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setProbeResult(json);
        if (onProbeCompleted) {
          onProbeCompleted(json);
        }
      } else {
        setErrorMsg(json.message || 'Gagal mengambil data redaman dari OLT.');
      }
    } catch (err) {
      setErrorMsg(`Error koneksi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedInterface, selectedOlt, syncDb, onProbeCompleted]);

  // Filtered rows for the modal table
  const filteredRows = useMemo(() => {
    if (!probeResult?.data) return [];
    const q = tableSearch.toLowerCase().trim();

    return probeResult.data.filter((item) => {
      // Search
      const matchSearch = !q ||
        item.customer_name?.toLowerCase().includes(q) ||
        item.customer_number?.toLowerCase().includes(q) ||
        item.serial_number?.toLowerCase().includes(q) ||
        item.odp_name?.toLowerCase().includes(q) ||
        item.phone?.includes(q) ||
        item.address?.toLowerCase().includes(q);

      if (!matchSearch) return false;

      // Quality Filter
      if (qualityFilter === 'ONLINE') return item.is_online;
      if (qualityFilter === 'OFFLINE') return !item.is_online;
      if (qualityFilter === 'WARNING_CRITICAL') {
        return item.is_online && (item.attenuation_quality === 'WARNING' || item.attenuation_quality === 'CRITICAL');
      }
      return true;
    });
  }, [probeResult, tableSearch, qualityFilter]);

  const summary = probeResult?.summary;
  const currentOltObj = olts.find((o) => String(o.id) === String(selectedOlt));
  const oltDisplayName = currentOltObj ? currentOltObj.name : (selectedOlt === 'all' ? 'Semua OLT' : selectedOlt);

  // ─── HIGH-QUALITY PAGINATED SCREENSHOT GENERATOR ────────────────────────────
  const handleScreenshot = async () => {
    if (capturingScreenshot || !filteredRows.length) return;
    setCapturingScreenshot(true);

    try {
      const isDarkMode = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
      const bg = isDarkMode ? '#09090b' : '#ffffff';
      const textPrimary = isDarkMode ? '#f4f4f5' : '#09090b';
      const textSecondary = isDarkMode ? '#a1a1aa' : '#71717a';
      const borderColor = isDarkMode ? '#27272a' : '#e4e4e7';
      const cardBg = isDarkMode ? '#18181b' : '#f8fafc';
      const rowAltBg = isDarkMode ? '#111113' : '#fcfcfd';

      // Split data into pages of 25 rows to avoid overly long/blurry images
      const ROWS_PER_PAGE = 25;
      const pages = [];
      for (let i = 0; i < filteredRows.length; i += ROWS_PER_PAGE) {
        pages.push(filteredRows.slice(i, i + ROWS_PER_PAGE));
      }

      const ifaceClean = (probeResult?.interface || selectedInterface || 'Port').replace(/[^a-zA-Z0-9_-]/g, '_');
      const now = new Date();
      const dateStr = now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0');
      const timeStr = String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0');
      const formattedDate = now.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + ' WIB';

      for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
        setScreenshotProgressText(`Memproses Hal ${pageIdx + 1} dari ${pages.length}...`);
        const pageRows = pages[pageIdx];
        const startRowIdx = pageIdx * ROWS_PER_PAGE + 1;
        const endRowIdx = startRowIdx + pageRows.length - 1;

        // Create an off-screen wrapper placed behind UI
        const wrapper = document.createElement('div');
        wrapper.id = `optical-probe-screenshot-wrapper-${pageIdx}`;
        wrapper.style.position = 'fixed';
        wrapper.style.top = '0';
        wrapper.style.left = '0';
        wrapper.style.width = '1020px';
        wrapper.style.zIndex = '-99999';
        wrapper.style.pointerEvents = 'none';
        wrapper.style.opacity = '1';
        wrapper.style.backgroundColor = bg;
        wrapper.style.overflow = 'visible';

        // Construct a dedicated 1020px high-density desktop report element inside wrapper
        const container = document.createElement('div');
        container.style.position = 'relative';
        container.style.width = '1020px';
        container.style.maxWidth = '1020px';
        container.style.backgroundColor = bg;
        container.style.color = textPrimary;
        container.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        container.style.padding = '24px';
        container.style.boxSizing = 'border-box';

        let rowsHtml = '';
        pageRows.forEach((row, i) => {
          const rowNum = startRowIdx + i;
          const isUp = row.is_online;
          const rx = parseFloat(row.rx_power);

          let rxColor = textSecondary;
          let rxText = '-40.00 dBm';
          if (isUp) {
            rxText = rx > -38 ? `${rx.toFixed(2)} dBm` : '-40.00 dBm';
            if (rx >= -25.0) rxColor = '#10b981'; // Emerald
            else if (rx >= -28.0) rxColor = '#f59e0b'; // Amber
            else rxColor = '#f43f5e'; // Rose
          } else {
            rxText = 'LOS / Offline';
            rxColor = '#f43f5e';
          }

          const statusBadge = isUp
            ? `<span style="color:#10b981;font-weight:700;font-size:11px;">ONLINE</span>`
            : `<span style="color:#f43f5e;font-weight:700;font-size:11px;">OFFLINE</span>`;

          const portStr = row.onu_port_id || '-';
          const snStr = row.serial_number ? `<span style="font-size:11px;color:${textSecondary};margin-left:6px;font-family:monospace;">(${row.serial_number})</span>` : '';
          const custName = row.customer_name || '—';
          const custId = row.customer_number ? `<span style="font-size:11px;color:#6366f1;font-weight:700;margin-left:6px;font-family:monospace;">(${row.customer_number})</span>` : '';
          const phoneStr = row.phone && row.phone !== '-' ? `<span style="font-size:11px;color:${textSecondary};margin-left:6px;">• ${row.phone}</span>` : '';
          const odpStr = row.odp_name || '—';

          const bgRow = i % 2 === 1 ? rowAltBg : bg;

          rowsHtml += `
            <tr style="background-color:${bgRow};border-bottom:1px solid ${borderColor};font-size:12px;">
              <td style="padding:10px 12px;font-family:monospace;font-weight:700;color:${textSecondary};width:40px;">${rowNum}</td>
              <td style="padding:10px 12px;font-family:monospace;white-space:nowrap;font-weight:700;color:${textPrimary};">${portStr}${snStr}</td>
              <td style="padding:10px 12px;white-space:nowrap;">${statusBadge}</td>
              <td style="padding:10px 12px;font-family:monospace;font-weight:700;color:${rxColor};white-space:nowrap;">${rxText}</td>
              <td style="padding:10px 12px;color:${textPrimary};"><strong style="color:${textPrimary};">${custName}</strong>${custId}${phoneStr}</td>
              <td style="padding:10px 12px;white-space:nowrap;font-weight:600;color:${textPrimary};">${odpStr}</td>
            </tr>
          `;
        });

        container.innerHTML = `
          <div style="border:1px solid ${borderColor};border-radius:10px;background-color:${bg};overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
            
            <!-- HEADER SECTION -->
            <div style="padding:16px 20px;border-bottom:1px solid ${borderColor};background-color:${cardBg};">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                <div>
                  <div style="font-size:16px;font-weight:800;letter-spacing:-0.02em;color:${textPrimary};">
                    LAPORAN REDAMAN PORT PON ${probeResult?.interface || selectedInterface}
                  </div>
                  <div style="font-size:11px;font-family:monospace;color:${textSecondary};margin-top:2px;">
                    OLT: <strong style="color:${textPrimary};">${oltDisplayName}</strong> &nbsp;•&nbsp; Waktu: ${formattedDate}
                  </div>
                </div>
                <div style="text-align:right;">
                  <span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;border:1px solid ${borderColor};background-color:${bg};font-family:monospace;color:${textPrimary};">
                    Hal. ${pageIdx + 1} dari ${pages.length} (${startRowIdx}-${endRowIdx})
                  </span>
                </div>
              </div>

              <!-- METADATA SUMMARY BAR -->
              <div style="display:flex;gap:16px;font-size:11px;font-family:monospace;padding-top:10px;border-top:1px solid ${borderColor};">
                <div style="color:${textPrimary};">Total ONU: <strong style="color:${textPrimary};">${probeResult?.data?.length ?? 0}</strong></div>
                <div style="color:#10b981;">Online: <strong style="color:#10b981;">${summary?.online_count ?? 0}</strong></div>
                <div style="color:#f43f5e;">Offline / LOS: <strong style="color:#f43f5e;">${summary?.down_count ?? 0}</strong></div>
              </div>
            </div>

            <!-- TABLE CONTENT -->
            <table style="width:100%;border-collapse:collapse;text-align:left;">
              <thead>
                <tr style="background-color:${cardBg};border-bottom:1px solid ${borderColor};font-size:11px;color:${textSecondary};text-transform:uppercase;font-weight:700;">
                  <th style="padding:10px 12px;width:40px;">#</th>
                  <th style="padding:10px 12px;">ONU / Port</th>
                  <th style="padding:10px 12px;">Status</th>
                  <th style="padding:10px 12px;">Redaman Rx Power</th>
                  <th style="padding:10px 12px;">Pelanggan</th>
                  <th style="padding:10px 12px;">ODP</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <!-- FOOTER BRANDING -->
            <div style="padding:10px 20px;border-top:1px solid ${borderColor};background-color:${cardBg};display:flex;justify-content:space-between;align-items:center;font-size:10px;color:${textSecondary};font-family:monospace;">
              <div>Fiber UNMS Enterprise • Optical Telemetry Engine</div>
              <div>Halaman ${pageIdx + 1} dari ${pages.length}</div>
            </div>

          </div>
        `;

        wrapper.appendChild(container);
        document.body.appendChild(wrapper);

        // Allow layout computation
        await new Promise((resolve) => setTimeout(resolve, 250));

        const canvas = await html2canvas(container, {
          scale: 2,
          backgroundColor: bg,
          useCORS: true,
          allowTaint: true,
          logging: false,
          width: 1020,
          windowWidth: 1020,
        });

        const dataUrl = canvas.toDataURL('image/png');

        document.body.removeChild(wrapper);

        // Download page image
        const pageSuffix = pages.length > 1 ? `_Hal_${pageIdx + 1}_dari_${pages.length}` : '';
        const filename = `Redaman_${ifaceClean}${pageSuffix}_${dateStr}_${timeStr}.png`;

        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (pages.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      setScreenshotSuccess(true);
      setTimeout(() => {
        setScreenshotSuccess(false);
        setScreenshotProgressText('');
      }, 3500);
    } catch (err) {
      console.error('Screenshot error:', err);
      alert('Gagal mengambil screenshot: ' + (err?.message || 'Error'));
    } finally {
      setCapturingScreenshot(false);
      setScreenshotProgressText('');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white dark:bg-black rounded-lg sm:rounded-xl shadow-2xl border border-black/70 dark:border-white/70 my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 text-black dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* PINNED HEADER */}
        <div className="bg-white dark:bg-black text-black dark:text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-black/20 dark:border-white/20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-md bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/20 dark:border-white/20 shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-black dark:text-white truncate">
                Cek Redaman Interface
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white font-bold cursor-pointer transition-colors"
            aria-label="Tutup modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* TOOLBAR CONTROLS */}
        <div className="p-3.5 sm:p-4 bg-black/5 dark:bg-white/5 border-b border-black/20 dark:border-white/20 space-y-2.5 shrink-0 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            {/* OLT Selector */}
            <div className="sm:col-span-4 space-y-1">
              <label className="block text-[11px] font-bold text-black dark:text-white">
                1. Pilih Perangkat OLT:
              </label>
              <select
                value={selectedOlt}
                onChange={(e) => setSelectedOlt(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-md font-bold text-xs text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">Semua OLT (Otomatis)</option>
                {olts.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Interface Selector with Search */}
            <div className="sm:col-span-5 space-y-1">
              <label className="block text-[11px] font-bold text-black dark:text-white">
                2. Pilih Interface / Port PON:
              </label>
              <SearchableSelect
                options={interfaceOptions}
                value={selectedInterface}
                onChange={(val) => setSelectedInterface(val)}
                placeholder="-- Pilih Port Interface PON --"
                searchPlaceholder="Cari port misal: 1/2/1..."
                className="font-mono font-bold"
              />
            </div>

            {/* Action Button */}
            <div className="sm:col-span-3">
              <button
                type="button"
                onClick={() => handleExecuteProbe()}
                disabled={loading || !selectedInterface}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold rounded-md text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Memindai OLT...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Pindai Redaman OLT</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 sm:space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 font-bold cursor-pointer">
                ✕
              </button>
            </div>
          )}

          {/* TABLE FILTER & SEARCH */}
          {probeResult?.data && probeResult.data.length > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Cari pelanggan, SN modem, ODP..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-md text-xs text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
                {tableSearch && (
                  <button
                    onClick={() => setTableSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Quick Status Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto shrink-0 pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setQualityFilter('ALL')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                    qualityFilter === 'ALL'
                      ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white'
                      : 'bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70 border-black/20 dark:border-white/20 hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                >
                  Semua ({probeResult.data.length})
                </button>
                <button
                  type="button"
                  onClick={() => setQualityFilter('ONLINE')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                    qualityFilter === 'ONLINE'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-black/5 dark:bg-white/5 text-emerald-600 dark:text-emerald-400 border-black/20 dark:border-white/20 hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                >
                  Online ({summary?.online_count ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setQualityFilter('OFFLINE')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                    qualityFilter === 'OFFLINE'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-black/5 dark:bg-white/5 text-rose-600 dark:text-rose-400 border-black/20 dark:border-white/20 hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                >
                  Offline / LOS ({summary?.down_count ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setQualityFilter('WARNING_CRITICAL')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                    qualityFilter === 'WARNING_CRITICAL'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-black/5 dark:bg-white/5 text-amber-600 dark:text-amber-400 border-black/20 dark:border-white/20 hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                >
                  Redaman Drop ({((summary?.warning_count ?? 0) + (summary?.critical_count ?? 0))})
                </button>
              </div>
            </div>
          )}

          {/* DATA PRESENTATION */}
          {loading ? (
            <div className="p-10 text-center space-y-3 bg-black/5 dark:bg-white/5 rounded-lg border border-black/20 dark:border-white/20">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="font-bold text-black dark:text-white text-xs sm:text-sm">
                Mengambil data redaman langsung dari OLT...
              </div>
              <p className="text-black/60 dark:text-white/60 text-[11px] font-mono">
                Membaca SNMP DDM optical register &amp; status ONU port {selectedInterface}
              </p>
            </div>
          ) : probeResult?.data ? (
            <div className="space-y-3">
              {/* 1. MOBILE RESPONSIVE CARDS VIEW (md:hidden) */}
              <div className="block md:hidden space-y-2">
                {filteredRows.length === 0 ? (
                  <div className="p-8 text-center text-black/50 dark:text-white/50 italic bg-black/5 dark:bg-white/5 rounded-lg border border-black/20 dark:border-white/20">
                    Tidak ada data yang cocok dengan filter.
                  </div>
                ) : (
                  filteredRows.map((row, idx) => {
                    const isUp = row.is_online;
                    const rx = parseFloat(row.rx_power);

                    let rxColorClass = 'text-black/60 dark:text-white/60';
                    if (isUp) {
                      if (rx >= -25.0) rxColorClass = 'text-emerald-600 dark:text-emerald-400';
                      else if (rx >= -28.0) rxColorClass = 'text-amber-600 dark:text-amber-400';
                      else rxColorClass = 'text-rose-600 dark:text-rose-400 animate-pulse';
                    }

                    return (
                      <div
                        key={`mob-${row.serial_number}-${idx}`}
                        className="p-3 bg-black/5 dark:bg-white/5 rounded-md border border-black/20 dark:border-white/20 space-y-2"
                      >
                        {/* Baris 1: Port, Status & Nilai Redaman */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-xs text-black dark:text-white truncate block">
                              {row.onu_port_id}
                            </span>
                            <div className="font-mono text-[10px] text-black/60 dark:text-white/60 truncate">
                              SN: {row.serial_number}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                                isUp
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isUp ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              <span>{isUp ? 'ONLINE' : 'OFFLINE'}</span>
                            </span>

                            <span className={`font-mono font-bold text-xs ${rxColorClass}`}>
                              {isUp && rx > -38 ? `${rx.toFixed(2)} dBm` : '-40.00 dBm'}
                            </span>
                          </div>
                        </div>

                        {/* Baris 2: Nama Pelanggan & ODP */}
                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-black/10 dark:border-white/10 text-xs">
                          <div className="min-w-0">
                            <div className="font-bold text-black dark:text-white truncate">
                              {row.customer_name}
                            </div>
                            <div className="text-[10px] text-black/60 dark:text-white/60 font-mono truncate">
                              {row.customer_number} {row.phone && row.phone !== '-' ? `• ${row.phone}` : ''}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 text-black dark:text-white font-bold text-[11px] border border-black/20 dark:border-white/20">
                              {row.odp_name}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* 2. DESKTOP TABLE VIEW (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto rounded-md border border-black/20 dark:border-white/20 bg-white dark:bg-black">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-black/5 dark:bg-white/5 text-black dark:text-white font-bold border-b border-black/20 dark:border-white/20 text-[11px]">
                      <th className="py-2.5 px-3">ONU / Port</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Redaman Rx Power</th>
                      <th className="py-2.5 px-3">Pelanggan</th>
                      <th className="py-2.5 px-3">ODP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/10 dark:divide-white/10">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-black/50 dark:text-white/50 italic">
                          Tidak ada data yang cocok dengan filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, idx) => {
                        const isUp = row.is_online;
                        const rx = parseFloat(row.rx_power);

                        let rxColorClass = 'text-black/60 dark:text-white/60';
                        if (isUp) {
                          if (rx >= -25.0) rxColorClass = 'text-emerald-600 dark:text-emerald-400';
                          else if (rx >= -28.0) rxColorClass = 'text-amber-600 dark:text-amber-400';
                          else rxColorClass = 'text-rose-600 dark:text-rose-400 animate-pulse';
                        }

                        return (
                          <tr
                            key={`${row.serial_number}-${idx}`}
                            className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          >
                            {/* ONU / Port */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="font-mono font-bold text-black dark:text-white">
                                {row.onu_port_id}
                              </div>
                              <div className="font-mono text-[10px] text-black/60 dark:text-white/60">
                                SN: {row.serial_number}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${
                                  isUp
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isUp ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                <span>{isUp ? 'ONLINE' : 'OFFLINE'}</span>
                              </span>
                            </td>

                            {/* Redaman Rx Power (Clean Pure Colored Text) */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className={`font-mono font-bold text-xs ${rxColorClass}`}>
                                {isUp && rx > -38 ? `${rx.toFixed(2)} dBm` : '-40.00 dBm'}
                              </span>
                            </td>

                            {/* Pelanggan */}
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-black dark:text-white">
                                {row.customer_name}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-black/60 dark:text-white/60 font-mono">
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">{row.customer_number}</span>
                                {row.phone && row.phone !== '-' && (
                                  <span>• {row.phone}</span>
                                )}
                              </div>
                            </td>

                            {/* ODP */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="font-bold text-black dark:text-white">
                                {row.odp_name}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-8 sm:p-12 text-center text-black/60 dark:text-white/60 space-y-3 bg-black/5 dark:bg-white/5 rounded-lg border border-black/20 dark:border-white/20">
              <div className="flex justify-center">
                <div className="p-3 rounded-md bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/20 dark:border-white/20">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
              </div>
              <p className="font-medium text-xs sm:text-sm text-black dark:text-white">
                Silakan pilih OLT dan Interface di atas, lalu klik tombol <strong className="text-blue-600 dark:text-blue-400">"Pindai Redaman OLT"</strong>.
              </p>
            </div>
          )}
        </div>

        {/* PINNED FOOTER */}
        <div className="px-5 py-3.5 bg-black/5 dark:bg-white/5 border-t border-black/20 dark:border-white/20 flex items-center justify-between flex-shrink-0 text-xs">
          <div className="flex items-center gap-2">
            {filteredRows.length > 0 && (
              <button
                type="button"
                onClick={handleScreenshot}
                disabled={capturingScreenshot}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-semibold text-xs transition-colors cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
              >
                {capturingScreenshot ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{screenshotProgressText || 'Menyimpan...'}</span>
                  </>
                ) : screenshotSuccess ? (
                  <>
                    <svg className="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-emerald-200">Tersimpan</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <circle cx="12" cy="13" r="3" strokeWidth={2} />
                    </svg>
                    <span>Screenshot HD</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={onClose}
              className="bg-black/10 dark:bg-white/10 text-black dark:text-white hover:bg-black/20 dark:hover:bg-white/20 px-4 py-2 rounded-md font-semibold text-xs transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
