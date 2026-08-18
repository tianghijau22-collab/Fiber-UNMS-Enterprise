import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import RefreshButton from '../components/RefreshButton';

// ─── Professional SVG Icons (No Emojis) ──────────────────────────────────────

const IconTelegram = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.56 8.16l-2.02 9.52c-.15.68-.55.85-1.12.53l-3.08-2.27-1.49 1.43c-.16.16-.3.3-.61.3l.22-3.14 5.72-5.17c.25-.22-.05-.34-.39-.12l-7.07 4.45-3.04-.95c-.66-.21-.67-.66.14-.98l11.9-4.59c.55-.2.1.03 1.84.99z" />
  </svg>
);

const IconMegaphone = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
  </svg>
);

const IconHistory = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconSend = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const IconSettings = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconPlus = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const IconTrash = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const IconEdit = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const IconCheckCircle = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconAlertCircle = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const IconPlay = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconBell = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

// Topic Specific Icons
const IconActivity = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const IconTicket = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 001 1.732V15a2 2 0 00-1 1.732V20a2 2 0 002 2h14a2 2 0 002-2v-3.268A2 2 0 0021 15v-3a2 2 0 00-1-1.732V7a2 2 0 00-2-2H5z" />
  </svg>
);

const IconUsers = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const IconNetwork = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
);

const IconServer = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
);

const IconShield = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const IconCreditCard = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const TOPIC_ICON_MAP = {
  'NOC': IconActivity,
  'TICKET': IconTicket,
  'CUSTOMER': IconUsers,
  'INFRASTRUCTURE': IconNetwork,
  'OLT_MGMT': IconServer,
  'USER_MGMT': IconShield,
  'BROADCAST': IconMegaphone,
  'BILLING': IconCreditCard,
};

const AVAILABLE_TOPICS_DEF = {
  'NOC': {
    label: 'NOC & Gangguan Jaringan',
    description: 'Alarm OLT Down, Fiber Cut, Redaman Optik Tinggi, LOS ONU',
    badgeClass: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
  },
  'TICKET': {
    label: 'Tiket & Penugasan Teknisi',
    description: 'Pembuatan Tiket Baru, Update Status, Penugasan Teknisi Jointer',
    badgeClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
  },
  'CUSTOMER': {
    label: 'Pelanggan & CRM',
    description: 'Registrasi Pelanggan, Ganti Paket, Swap ONU, Hapus Pelanggan',
    badgeClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
  },
  'INFRASTRUCTURE': {
    label: 'Infrastruktur Jaringan',
    description: 'Manajemen Node ODC, ODP, POP, & Segmen Kabel Optik',
    badgeClass: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800'
  },
  'OLT_MGMT': {
    label: 'Manajemen OLT',
    description: 'Pendaftaran OLT, Tes Koneksi SNMP/CLI, Otorisasi ONU, Port GPON',
    badgeClass: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
  },
  'USER_MGMT': {
    label: 'Manajemen User & Akun',
    description: 'User Baru, Hak Akses/Role, Reset Password, Audit Login',
    badgeClass: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
  },
  'BROADCAST': {
    label: 'Siaran Notifikasi Massal',
    description: 'Pengumuman Manual yang Dikirimkan Melalui Halaman Siaran',
    badgeClass: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
  },
  'BILLING': {
    label: 'Billing & Keuangan',
    description: 'Status Tagihan, Pembayaran, dan Transaksi Layanan',
    badgeClass: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
  },
};

export default function PushNotificationBroadcast() {
  const [activeTab, setActiveTab] = useState('telegram_groups'); // 'telegram_groups' | 'broadcast' | 'history'

  // Broadcast Form State
  const [form, setForm] = useState({
    title: 'Gangguan Putus Kabel Optik Segmen Solok',
    body: 'Diharapkan tim teknisi jointer meluncur ke lokasi ODC-SLK-01 untuk perbaikan penyambungan core fiber.',
    type: 'NOC',
    target_role: 'ALL',
    url: '/tickets',
  });
  const [loadingBroadcast, setLoadingBroadcast] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(null);
  const [broadcastError, setBroadcastError] = useState(null);
  const [history, setHistory] = useState([]);

  // Telegram Master Config State
  const [telegramConfig, setTelegramConfig] = useState({
    telegram_enabled: false,
    telegram_bot_token: '',
    telegram_chat_id: '',
  });
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [testingMasterTelegram, setTestingMasterTelegram] = useState(false);
  const [telegramMsg, setTelegramMsg] = useState(null);

  // Multi-Channel Telegram Groups State
  const [channels, setChannels] = useState([]);
  const [availableTopics, setAvailableTopics] = useState(AVAILABLE_TOPICS_DEF);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [testingChannelId, setTestingChannelId] = useState(null);

  // Modal Add / Edit Channel State
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [channelForm, setChannelForm] = useState({
    name: '',
    chat_id: '',
    description: '',
    is_active: true,
    topics: Object.keys(AVAILABLE_TOPICS_DEF),
  });
  const [channelSubmitting, setChannelSubmitting] = useState(false);
  const [channelModalError, setChannelModalError] = useState(null);

  // Custom UI Modals & Toasts (No Browser Alert / Confirm)
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, message, onConfirm, confirmText, danger }
  const [uiToast, setUiToast] = useState(null); // { type: 'success' | 'error', message: string }

  const showToast = (type, message) => {
    setUiToast({ type, message });
    setTimeout(() => setUiToast(null), 4500);
  };

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const d = await res.json();
        setHistory(Array.isArray(d?.notifications) ? d.notifications : []);
      }
    } catch (e) {
      // Silent
    }
  }, []);

  const fetchTelegramConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/telegram-config');
      if (res.ok) {
        const d = await res.json();
        setTelegramConfig(d);
      }
    } catch (e) {
      // Silent
    }
  }, []);

  const fetchChannels = useCallback(async (silent = false) => {
    if (!silent) setLoadingChannels(true);
    try {
      const res = await fetch('/api/notifications/channels');
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.channels)) setChannels(d.channels);
        if (d.available_topics) {
          setAvailableTopics(d.available_topics);
        }
      }
    } catch (e) {
      console.error('Failed to load telegram channels:', e);
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  const refreshAllNotificationData = useCallback(async (silent = true) => {
    await Promise.all([fetchHistory(), fetchTelegramConfig(), fetchChannels(silent)]);
  }, [fetchHistory, fetchTelegramConfig, fetchChannels]);

  useEffect(() => {
    refreshAllNotificationData(false);
  }, [refreshAllNotificationData]);

  const { isRefreshing, triggerRefresh, timeAgoText } = useAutoRefresh(refreshAllNotificationData);

  // Save Master Telegram Settings
  const handleSaveTelegramConfig = async (e) => {
    e.preventDefault();
    setSavingTelegram(true);
    setTelegramMsg(null);
    try {
      const res = await fetch('/api/notifications/telegram-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telegramConfig),
      });
      const d = await res.json();
      if (res.ok) {
        setTelegramMsg({ type: 'success', text: d.message || 'Konfigurasi Bot Telegram berhasil disimpan.' });
      } else {
        setTelegramMsg({ type: 'error', text: d.message || 'Gagal menyimpan konfigurasi Bot Telegram.' });
      }
    } catch (err) {
      setTelegramMsg({ type: 'error', text: 'Terjadi kesalahan saat menyimpan pengaturan.' });
    } finally {
      setSavingTelegram(false);
    }
  };

  // Test Master Telegram Connection
  const handleTestMasterTelegram = async () => {
    setTestingMasterTelegram(true);
    setTelegramMsg(null);
    try {
      const res = await fetch('/api/notifications/telegram-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telegramConfig),
      });
      const d = await res.json();
      if (d.success) {
        setTelegramMsg({ type: 'success', text: d.message });
      } else {
        setTelegramMsg({ type: 'error', text: d.message });
      }
    } catch (err) {
      setTelegramMsg({ type: 'error', text: 'Gagal menghubungi server untuk pengujian Telegram.' });
    } finally {
      setTestingMasterTelegram(false);
    }
  };

  // Test Specific Channel
  const handleTestChannel = async (channel) => {
    setTestingChannelId(channel.id);
    try {
      const res = await fetch(`/api/notifications/channels/${channel.id}/test`, {
        method: 'POST',
      });
      const d = await res.json();
      if (d.success) {
        showToast('success', `Pesan pengujian berhasil dikirimkan ke grup "${channel.name}".`);
      } else {
        showToast('error', `Gagal mengirim tes: ${d.message}`);
      }
    } catch (err) {
      showToast('error', 'Terjadi kesalahan jaringan saat menguji koneksi grup.');
    } finally {
      setTestingChannelId(null);
    }
  };

  // Open Create Channel Modal
  const openCreateChannelModal = () => {
    setEditingChannel(null);
    setChannelForm({
      name: '',
      chat_id: '',
      description: '',
      is_active: true,
      topics: Object.keys(AVAILABLE_TOPICS_DEF),
    });
    setChannelModalError(null);
    setShowChannelModal(true);
  };

  // Open Edit Channel Modal
  const openEditChannelModal = (channel) => {
    setEditingChannel(channel);
    setChannelForm({
      name: channel.name,
      chat_id: channel.chat_id,
      description: channel.description || '',
      is_active: Boolean(channel.is_active),
      topics: Array.isArray(channel.topics) ? channel.topics : Object.keys(AVAILABLE_TOPICS_DEF),
    });
    setChannelModalError(null);
    setShowChannelModal(true);
  };

  // Save Channel (Create / Edit)
  const handleSaveChannel = async (e) => {
    e.preventDefault();
    if (!channelForm.name.trim() || !channelForm.chat_id.trim()) {
      setChannelModalError('Nama grup dan Chat ID Telegram wajib diisi.');
      return;
    }
    setChannelSubmitting(true);
    setChannelModalError(null);
    try {
      const url = editingChannel
        ? `/api/notifications/channels/${editingChannel.id}`
        : '/api/notifications/channels';
      const method = editingChannel ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channelForm),
      });

      const d = await res.json();
      if (!res.ok || !d.success) {
        setChannelModalError(d.message || 'Gagal menyimpan grup Telegram.');
        return;
      }

      setShowChannelModal(false);
      fetchChannels();
      showToast('success', editingChannel ? 'Grup Telegram berhasil diperbarui.' : 'Grup Telegram baru berhasil didaftarkan.');
    } catch (err) {
      setChannelModalError('Terjadi kesalahan jaringan saat menyimpan.');
    } finally {
      setChannelSubmitting(false);
    }
  };

  // Delete Channel
  const handleDeleteChannel = (channel) => {
    setConfirmDialog({
      title: 'Hapus Grup Telegram',
      message: `Apakah Anda yakin ingin menghapus grup "${channel.name}" (${channel.chat_id})? Notifikasi topik terkait tidak akan diteruskan lagi ke grup ini.`,
      confirmText: 'Ya, Hapus Grup',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res = await fetch(`/api/notifications/channels/${channel.id}`, {
            method: 'DELETE',
          });
          if (res.ok) {
            fetchChannels();
            showToast('success', `Grup "${channel.name}" berhasil dihapus.`);
          } else {
            showToast('error', 'Gagal menghapus grup Telegram.');
          }
        } catch (e) {
          showToast('error', 'Terjadi kesalahan koneksi.');
        }
      }
    });
  };

  // Toggle Channel Active State
  const handleToggleChannelActive = async (channel) => {
    try {
      const updatedStatus = !channel.is_active;
      const res = await fetch(`/api/notifications/channels/${channel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...channel,
          is_active: updatedStatus,
        }),
      });
      if (res.ok) {
        fetchChannels();
      }
    } catch (e) {
      console.error('Toggle status error:', e);
    }
  };

  // Toggle Topic in Modal
  const toggleTopic = (topicKey) => {
    setChannelForm((prev) => {
      const exists = prev.topics.includes(topicKey);
      return {
        ...prev,
        topics: exists
          ? prev.topics.filter((t) => t !== topicKey)
          : [...prev.topics, topicKey],
      };
    });
  };

  // Select / Deselect All Topics
  const handleSelectAllTopics = () => {
    setChannelForm((prev) => ({
      ...prev,
      topics: Object.keys(availableTopics),
    }));
  };

  const handleClearAllTopics = () => {
    setChannelForm((prev) => ({
      ...prev,
      topics: [],
    }));
  };

  // Handle Broadcast Submission
  const handleBroadcastSubmit = async (e) => {
    e.preventDefault();
    setBroadcastSuccess(null);
    setBroadcastError(null);

    if (!form.title.trim() || !form.body.trim()) {
      setBroadcastError('Judul dan Isi Notifikasi wajib diisi.');
      return;
    }

    setLoadingBroadcast(true);
    try {
      const res = await fetch('/api/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBroadcastSuccess(data.message);
        fetchHistory();
      } else {
        setBroadcastError(data.message || 'Gagal mengirimkan notifikasi.');
      }
    } catch (err) {
      setBroadcastError('Terjadi kesalahan jaringan atau server.');
    } finally {
      setLoadingBroadcast(false);
    }
  };

  // Delete Single History Row
  const handleDeleteNotification = (id) => {
    setConfirmDialog({
      title: 'Hapus Riwayat Notifikasi',
      message: 'Apakah Anda yakin ingin menghapus catatan notifikasi ini dari riwayat sistem?',
      confirmText: 'Ya, Hapus',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
          if (res.ok) {
            setHistory((prev) => prev.filter((n) => n.id !== id));
            showToast('success', 'Catatan notifikasi berhasil dihapus.');
          } else {
            showToast('error', 'Gagal menghapus riwayat notifikasi.');
          }
        } catch (e) {
          showToast('error', 'Terjadi kesalahan jaringan.');
        }
      }
    });
  };

  // Clear All History
  const handleClearAllNotifications = () => {
    setConfirmDialog({
      title: 'Hapus SEMUA Riwayat Notifikasi',
      message: 'Apakah Anda yakin ingin mengosongkan seluruh riwayat siaran dan log notifikasi di sistem? Tindakan ini permanen dan tidak dapat dikembalikan.',
      confirmText: 'Ya, Kosongkan Semua',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res = await fetch('/api/notifications/clear-all', { method: 'DELETE' });
          if (res.ok) {
            setHistory([]);
            showToast('success', 'Seluruh riwayat notifikasi berhasil dikosongkan.');
          } else {
            showToast('error', 'Gagal mengosongkan riwayat notifikasi.');
          }
        } catch (e) {
          showToast('error', 'Terjadi kesalahan koneksi.');
        }
      }
    });
  };

  return (
    <div className="space-y-6 transition-colors duration-300 w-full stagger-enter">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
              <IconTelegram />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
                Pusat Manajemen Notifikasi &amp; Multi-Grup Telegram
              </h3>

            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <RefreshButton
            isRefreshing={isRefreshing}
            onRefresh={triggerRefresh}
            lastUpdatedText={timeAgoText}
            label="Segarkan Notifikasi"
          />
          {activeTab === 'telegram_groups' && (
            <button
              onClick={openCreateChannelModal}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
            >
              <IconPlus />
              <span>Tambah Grup Telegram</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('telegram_groups')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'telegram_groups'
            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80 shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
        >
          <IconTelegram />
          <span>Manajemen Multi-Grup Telegram</span>
          <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold">
            {channels.length} Grup
          </span>
        </button>

        <button
          onClick={() => setActiveTab('broadcast')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'broadcast'
            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80 shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
        >
          <IconMegaphone />
          <span>Siaran Notifikasi Massal</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'history'
            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80 shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
        >
          <IconHistory />
          <span>Riwayat Notifikasi</span>
          <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold">
            {history.length}
          </span>
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: MANAJEMEN MULTI-GRUP TELEGRAM */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'telegram_groups' && (
        <div className="space-y-6">
          {/* Master Telegram Bot Config */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs relative overflow-hidden transition-colors">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700">
                  <IconSettings />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    Konfigurasi Master Bot Telegram UNMS
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                    Token bot utama yang digunakan untuk mendistribusikan notifikasi ke seluruh grup yang terdaftar
                  </p>
                </div>
              </div>

              {/* Master Global Toggle */}
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Status Global:</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={telegramConfig.telegram_enabled}
                    onChange={(e) =>
                      setTelegramConfig((prev) => ({ ...prev, telegram_enabled: e.target.checked }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
                <span
                  className={`text-xs font-bold ${telegramConfig.telegram_enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                    }`}
                >
                  {telegramConfig.telegram_enabled ? 'AKTIF' : 'NONAKTIF'}
                </span>
              </div>
            </div>

            {/* Alert Message */}
            {telegramMsg && (
              <div
                className={`mb-4 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${telegramMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                  }`}
              >
                <span className="mt-0.5 shrink-0">
                  {telegramMsg.type === 'success' ? <IconCheckCircle /> : <IconAlertCircle />}
                </span>
                <div className="flex-1 font-medium">{telegramMsg.text}</div>
                <button onClick={() => setTelegramMsg(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs">
                  Tutup
                </button>
              </div>
            )}

            <form onSubmit={handleSaveTelegramConfig} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Telegram Bot Token (@BotFather) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={telegramConfig.telegram_bot_token}
                  onChange={(e) =>
                    setTelegramConfig((prev) => ({ ...prev, telegram_bot_token: e.target.value }))
                  }
                  placeholder="Contoh: 8940294417:AAHoVnbFHl6xNFA6nq0AZ933kDXqnAqhooU"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Fallback Default Chat ID (Opsional)
                </label>
                <input
                  type="text"
                  value={telegramConfig.telegram_chat_id}
                  onChange={(e) =>
                    setTelegramConfig((prev) => ({ ...prev, telegram_chat_id: e.target.value }))
                  }
                  placeholder="Contoh: -100123456789"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono transition-all"
                />
              </div>

              <div className="md:col-span-3 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tambahkan bot ke grup Telegram Anda lalu berikan hak Administrator agar bot dapat mengirimkan pesan.
                </p>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleTestMasterTelegram}
                    disabled={testingMasterTelegram || !telegramConfig.telegram_bot_token}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <IconPlay />
                    <span>{testingMasterTelegram ? 'Menguji...' : 'Uji Bot Master'}</span>
                  </button>
                  <button
                    type="submit"
                    disabled={savingTelegram}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
                  >
                    {savingTelegram ? 'Menyimpan...' : 'Simpan Pengaturan'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Group Routing Channels List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Daftar Grup &amp; Filter Distribusi Notifikasi
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  Notifikasi akan diteruskan hanya ke grup yang memiliki kategori/topik yang relevan
                </p>
              </div>

              <button
                onClick={openCreateChannelModal}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <IconPlus /> <span>Tambah Grup</span>
              </button>
            </div>

            {loadingChannels ? (
              <div className="p-12 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <p className="text-sm">Memuat daftar grup Telegram...</p>
              </div>
            ) : channels.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="text-slate-400 flex justify-center">
                  <IconTelegram className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Belum Ada Grup Telegram Didaftarkan</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Daftarkan grup Telegram seperti Grup NOC, Grup Teknisi, atau Grup Layanan Pelanggan dan pilih kategori notifikasi yang relevan.
                </p>
                <button
                  onClick={openCreateChannelModal}
                  className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition"
                >
                  Tambah Grup Telegram Sekarang
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {channels.map((channel) => {
                  const subTopics = Array.isArray(channel.topics) ? channel.topics : [];
                  const isAll = subTopics.length === Object.keys(availableTopics).length;

                  return (
                    <div
                      key={channel.id}
                      className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-xs relative flex flex-col justify-between transition-all ${channel.is_active
                        ? 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                        : 'border-slate-200 dark:border-slate-800 opacity-60'
                        }`}
                    >
                      <div>
                        {/* Header Group */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{channel.name}</h4>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${channel.is_active
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                  }`}
                              >
                                {channel.is_active ? 'AKTIF' : 'NONAKTIF'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-xs text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-900/60 font-bold">
                                ID: {channel.chat_id}
                              </code>
                              {channel.description && (
                                <span className="text-xs text-slate-500 dark:text-slate-400">• {channel.description}</span>
                              )}
                            </div>
                          </div>

                          {/* Quick Toggle */}
                          <label className="relative inline-flex items-center cursor-pointer" title="Aktif/Nonaktifkan Grup">
                            <input
                              type="checkbox"
                              checked={channel.is_active}
                              onChange={() => handleToggleChannelActive(channel)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                          </label>
                        </div>

                        {/* Topics Badges */}
                        <div className="mb-4">
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-2">
                            Kategori Notifikasi ({subTopics.length} Topik):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {isAll ? (
                              <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold">
                                Seluruh Notifikasi Sistem (Semua Topik)
                              </span>
                            ) : subTopics.length === 0 ? (
                              <span className="text-xs text-slate-400 dark:text-slate-500 italic">Tidak ada kategori dipilih</span>
                            ) : (
                              subTopics.map((topKey) => {
                                const info = availableTopics[topKey] || {
                                  label: topKey,
                                  badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
                                };
                                const TopicIcon = TOPIC_ICON_MAP[topKey] || IconActivity;

                                return (
                                  <span
                                    key={topKey}
                                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 ${info.badgeClass}`}
                                    title={info.description}
                                  >
                                    <TopicIcon className="w-3.5 h-3.5" />
                                    <span>{info.label}</span>
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleTestChannel(channel)}
                          disabled={testingChannelId === channel.id || !channel.is_active}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 disabled:opacity-40"
                        >
                          <IconPlay />
                          <span>{testingChannelId === channel.id ? 'Mengirim...' : 'Uji Kirim Pesan'}</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditChannelModal(channel)}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition"
                            title="Edit Grup & Topik"
                          >
                            <IconEdit />
                          </button>
                          <button
                            onClick={() => handleDeleteChannel(channel)}
                            className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 transition"
                            title="Hapus Grup"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: SIARAN NOTIFIKASI MASSAL */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                <IconSend className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>Form Siaran Notifikasi Massal</span>
              </h2>

              {broadcastSuccess && (
                <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <IconCheckCircle />
                  <span>{broadcastSuccess}</span>
                </div>
              )}

              {broadcastError && (
                <div className="mb-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                  <IconAlertCircle />
                  <span>{broadcastError}</span>
                </div>
              )}

              <form onSubmit={handleBroadcastSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Judul Notifikasi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Contoh: Pemeliharaan Server OLT Solok"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Kategori / Topik
                    </label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    >
                      <option value="NOC">NOC / Gangguan Jaringan</option>
                      <option value="TICKET">Tiket & Maintenance</option>
                      <option value="CUSTOMER">Pelanggan / Customer Care</option>
                      <option value="INFRASTRUCTURE">Infrastruktur Kabel & Node</option>
                      <option value="OLT_MGMT">Manajemen OLT GPON</option>
                      <option value="SECURITY">Keamanan & Akun</option>
                      <option value="BILLING">Billing & Keuangan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Target Pengguna
                    </label>
                    <select
                      value={form.target_role}
                      onChange={(e) => setForm({ ...form, target_role: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    >
                      <option value="ALL">Semua Pengguna (Broadcast)</option>
                      <option value="Super Administrator">Super Administrator</option>
                      <option value="NOC Operator">NOC Operator</option>
                      <option value="Teknisi Jointer">Teknisi Jointer & Fiber</option>
                      <option value="Helpdesk & CS">Helpdesk & CS</option>
                      <option value="Billing / Finance">Billing & Finance</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Isi Pesan Notifikasi <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    placeholder="Tuliskan rincian pesan notifikasi di sini..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    URL Tautan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="Contoh: /tickets atau /olt-management"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loadingBroadcast}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
                  >
                    <IconSend />
                    <span>{loadingBroadcast ? 'Mengirimkan Siaran...' : 'Kirim Siaran Notifikasi'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Preview Column */}
          <div className="lg:col-span-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Pratinjau Tampilan Notifikasi
            </h3>

            {/* Telegram Message Preview Mockup */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs relative">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-3">
                <IconTelegram />
                <span>Tampilan di Grup Telegram:</span>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-xl border border-slate-800 text-slate-200 text-xs space-y-2 font-sans">
                <div className="font-bold text-indigo-400 text-xs font-mono">
                  [SIARAN MASSAL]
                </div>
                <div className="font-bold text-white text-sm">{form.title || 'Judul Notifikasi'}</div>
                <div className="text-slate-300 text-xs whitespace-pre-wrap">{form.body || 'Isi notifikasi...'}</div>
                {form.url && (
                  <div className="pt-2">
                    <div className="bg-slate-800 text-indigo-300 text-xs py-1.5 px-3 rounded-lg text-center font-semibold border border-slate-700">
                      Buka di System UNMS
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* In-App Bell Mockup */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-3">
                <IconBell />
                <span>Tampilan di Notifikasi Web Browser:</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="font-bold text-slate-800 dark:text-slate-100 text-xs">{form.title || 'Judul Notifikasi'}</div>
                <div className="text-slate-600 dark:text-slate-400 text-xs line-clamp-2">{form.body || 'Isi notifikasi...'}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Baru saja • Target: {form.target_role}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: RIWAYAT NOTIFIKASI */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Riwayat Notifikasi Sistem</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Daftar seluruh notifikasi yang pernah disiarkan atau dihasilkan oleh sistem</p>
            </div>

            {history.length > 0 && (
              <button
                onClick={handleClearAllNotifications}
                className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-800 transition flex items-center gap-1.5"
              >
                <IconTrash /> <span>Hapus Semua Riwayat</span>
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs font-semibold">Tidak ada riwayat notifikasi.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Tipe</th>
                    <th className="px-4 py-3">Judul &amp; Isi</th>
                    <th className="px-4 py-3">Tautan</th>
                    <th className="px-4 py-3">Waktu</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-semibold">
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">
                          {item.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800 dark:text-slate-100">{item.title}</div>
                        <div className="text-slate-500 dark:text-slate-400 line-clamp-1">{item.body}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">{item.url || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono">
                        {new Date(item.created_at).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteNotification(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          title="Hapus Baris"
                        >
                          <IconTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: TAMBAH / EDIT GRUP TELEGRAM & TOPIK BERLANGGANAN */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {showChannelModal && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-h-[88vh] overflow-hidden shadow-2xl flex flex-col my-auto animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  <IconTelegram />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    {editingChannel ? 'Edit Grup & Filter Notifikasi' : 'Tambah Grup Telegram Baru'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tentukan nama grup, Chat ID Telegram, dan centang kategori yang diizinkan</p>
                </div>
              </div>
              <button
                onClick={() => setShowChannelModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 font-bold transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveChannel} className="p-6 space-y-5 flex-1">
              {channelModalError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                  <IconAlertCircle />
                  <span>{channelModalError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Nama Grup Telegram <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={channelForm.name}
                    onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                    placeholder="Contoh: Grup NOC & Gangguan"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Telegram Chat ID Grup <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={channelForm.chat_id}
                    onChange={(e) => setChannelForm({ ...channelForm, chat_id: e.target.value })}
                    placeholder="Contoh: -100192837465"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Deskripsi / Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  value={channelForm.description}
                  onChange={(e) => setChannelForm({ ...channelForm, description: e.target.value })}
                  placeholder="Contoh: Khusus alert putus kabel dan OLT down"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">Status Grup Aktif</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Jika dinonaktifkan, bot tidak akan mengirim pesan ke grup ini.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channelForm.is_active}
                    onChange={(e) => setChannelForm({ ...channelForm, is_active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Topics Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Pilih Kategori Notifikasi Yang Masuk Ke Grup Ini:
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleSelectAllTopics}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-400">•</span>
                    <button
                      type="button"
                      onClick={handleClearAllTopics}
                      className="text-slate-500 dark:text-slate-400 hover:underline"
                    >
                      Bersihkan
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {Object.entries(availableTopics).map(([key, info]) => {
                    const isChecked = channelForm.topics.includes(key);
                    const TopicIcon = TOPIC_ICON_MAP[key] || IconActivity;

                    return (
                      <label
                        key={key}
                        onClick={() => toggleTopic(key)}
                        className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all select-none ${isChecked
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => { }}
                          className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-0"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <TopicIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>{info.label}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            {info.description}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowChannelModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={channelSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
                >
                  {channelSubmitting ? 'Menyimpan...' : editingChannel ? 'Simpan Perubahan' : 'Tambah Grup'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {/* ── Custom Confirmation Modal (Pengganti window.confirm) ── */}
      {confirmDialog && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 min-h-screen animate-in fade-in duration-150">
          <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#52525b] rounded-xl shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 ${
                confirmDialog.danger
                  ? 'bg-rose-50 dark:bg-neutral-900 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400'
                  : 'bg-blue-50 dark:bg-neutral-900 border border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400'
              }`}>
                {confirmDialog.danger ? '⚠️' : 'ℹ️'}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {confirmDialog.title}
                </h3>
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase">
                  KONFIRMASI SISTEM
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {confirmDialog.message}
            </p>

            <div className="pt-2 border-t border-slate-100 dark:border-[#1f1f1f] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#52525b] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-1.5 rounded-lg text-white text-xs font-bold transition-all shadow-sm ${
                  confirmDialog.danger
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmDialog.confirmText || 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Custom UI Toast Feedback ── */}
      {uiToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-3 duration-200">
          <div className={`p-3.5 rounded-xl border shadow-xl flex items-center gap-2.5 text-xs font-semibold ${
            uiToast.type === 'success'
              ? 'bg-emerald-50 dark:bg-neutral-950 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-neutral-950 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}>
            <span>{uiToast.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{uiToast.message}</span>
            <button
              type="button"
              onClick={() => setUiToast(null)}
              className="ml-2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
