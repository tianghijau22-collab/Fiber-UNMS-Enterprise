import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/app_colors.dart';
import '../../models/notification_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/notification_provider.dart';

class NotificationCenterScreen extends StatefulWidget {
  const NotificationCenterScreen({super.key});

  @override
  State<NotificationCenterScreen> createState() => _NotificationCenterScreenState();
}

class _NotificationCenterScreenState extends State<NotificationCenterScreen> {
  String _selectedCategory = 'Semua Notifikasi';

  final List<String> _categories = const [
    'Semua Notifikasi',
    'Info',
    'Gangguan',
    'Tiket',
    'Pemeliharaan',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final np = Provider.of<NotificationProvider>(context, listen: false);
      np.fetchNotifications();
    });
  }

  List<NotificationModel> _filterNotifications(List<NotificationModel> all) {
    if (_selectedCategory == 'Semua Notifikasi') return all;

    return all.where((n) {
      final t = n.type.toUpperCase();
      final title = n.cleanTitle.toLowerCase();
      final body = n.cleanBody.toLowerCase();

      switch (_selectedCategory) {
        case 'Info':
          return t == 'INFO' || t == 'ANNOUNCEMENT' || t == 'BROADCAST' || t == 'SYSTEM' || t == 'SYSTEM_ALERT' || t == 'NOC' || title.contains('info') || title.contains('pengumuman') || body.contains('pengumuman');
        case 'Gangguan':
          return t == 'MASS_OUTAGE' ||
              t == 'OUTAGE_INTERFACE' ||
              t == 'OUTAGE_ODP' ||
              t == 'ALARM' ||
              title.contains('gangguan') ||
              title.contains('putus kabel') ||
              title.contains('down');
        case 'Tiket':
          return t == 'TICKET' || title.contains('tiket') || title.contains('noc');
        case 'Pemeliharaan':
          return t == 'MAINTENANCE' || title.contains('pemeliharaan') || title.contains('maintenance');
        default:
          return true;
      }
    }).toList();
  }

  void _showNotificationDetail(NotificationModel notif) {
    final provider = Provider.of<NotificationProvider>(context, listen: false);
    if (!notif.isRead) {
      provider.markAsRead(notif.id);
    }

    final imageUrl = notif.fullImageUrl;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.90,
        ),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Drag handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Optional Image Banner
            if (imageUrl != null)
              Container(
                height: 180,
                width: double.infinity,
                margin: const EdgeInsets.fromLTRB(20, 0, 20, 14),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: CachedNetworkImage(
                    imageUrl: imageUrl,
                    fit: BoxFit.cover,
                    placeholder: (c, u) => Container(
                      color: const Color(0xFFF1F5F9),
                      child: const Center(
                        child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0075D8)),
                      ),
                    ),
                    errorWidget: (c, u, e) => Container(
                      color: const Color(0xFFF1F5F9),
                      child: const Center(
                        child: Icon(Icons.broken_image_rounded, color: Color(0xFF94A3B8), size: 36),
                      ),
                    ),
                  ),
                ),
              ),

            // Header Meta: Badge & Timestamp
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE0F2FE),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      notif.type,
                      style: const TextStyle(
                        color: Color(0xFF0075D8),
                        fontWeight: FontWeight.w800,
                        fontSize: 11,
                      ),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    DateFormat('HH:mm, dd MMM yyyy').format(notif.createdAt),
                    style: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),

            // Title
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text(
                notif.cleanTitle,
                style: const TextStyle(
                  color: Color(0xFF0F172A),
                  fontWeight: FontWeight.w800,
                  fontSize: 17,
                  height: 1.3,
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Body Content (Scrollable)
            Flexible(
              child: Container(
                width: double.infinity,
                margin: const EdgeInsets.symmetric(horizontal: 20),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  child: _buildFormattedNotificationBody(notif.body),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Action Buttons
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.delete_outline_rounded, size: 18, color: AppColors.danger),
                      label: const Text('Hapus', style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.bold)),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: const BorderSide(color: Color(0xFFFCA5A5)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: () {
                        provider.deleteNotification(notif.id);
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Notifikasi telah dihapus')),
                        );
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  if (notif.url != null && notif.url!.isNotEmpty && notif.url != '/dashboard') ...[
                    Expanded(
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.open_in_new_rounded, size: 18, color: Colors.white),
                        label: const Text('Buka Tautan', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0075D8),
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () async {
                          final uri = Uri.tryParse(notif.url!);
                          if (uri != null && await canLaunchUrl(uri)) {
                            await launchUrl(uri, mode: LaunchMode.externalApplication);
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0F172A),
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('Tutup', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showSettingsSheet() {
    final notifProvider = Provider.of<NotificationProvider>(context, listen: false);

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(22),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 18),
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const Text(
              'Pengaturan Notifikasi',
              style: TextStyle(
                color: Color(0xFF0F172A),
                fontWeight: FontWeight.bold,
                fontSize: 17,
              ),
            ),
            const SizedBox(height: 16),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFFE0F2FE),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.done_all_rounded, color: Color(0xFF0075D8), size: 22),
              ),
              title: const Text('Tandai Semua Dibaca', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
              subtitle: const Text('Tandai seluruh pesan masuk sebagai telah dibaca', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
              onTap: () {
                Navigator.pop(ctx);
                notifProvider.markAllAsRead();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Semua notifikasi ditandai telah dibaca.')),
                );
              },
            ),
            const Divider(color: Color(0xFFF1F5F9), height: 20),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.refresh_rounded, color: Color(0xFF475569), size: 22),
              ),
              title: const Text('Sinkronkan Notifikasi', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
              subtitle: const Text('Muat ulang pembaruan data notifikasi dari server', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
              onTap: () {
                Navigator.pop(ctx);
                notifProvider.fetchNotifications();
              },
            ),
            const Divider(color: Color(0xFFF1F5F9), height: 20),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFFFEE2E2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.delete_sweep_rounded, color: AppColors.danger, size: 22),
              ),
              title: const Text('Hapus Semua Notifikasi', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.danger)),
              subtitle: const Text('Bersihkan seluruh daftar riwayat notifikasi', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
              onTap: () {
                Navigator.pop(ctx);
                notifProvider.clearAll();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Seluruh notifikasi telah dibersihkan.')),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showBroadcastModal() {
    final titleCtrl = TextEditingController();
    final bodyCtrl = TextEditingController();
    final imageCtrl = TextEditingController();
    String selectedType = 'BROADCAST';
    String selectedTarget = 'ALL';
    bool isSubmitting = false;

    final notifProvider = Provider.of<NotificationProvider>(context, listen: false);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
          child: Container(
            padding: const EdgeInsets.all(22),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFCBD5E1),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0075D8).withValues(alpha: 0.12),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.campaign_rounded, color: Color(0xFF0075D8), size: 22),
                      ),
                      const SizedBox(width: 10),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Kirim Siaran Notifikasi Massal',
                            style: TextStyle(
                              color: Color(0xFF0F172A),
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                            ),
                          ),
                          Text(
                            'Kirimkan pengumuman langsung beserta poster gambar',
                            style: TextStyle(color: Color(0xFF64748B), fontSize: 11),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  const Text('Kategori Siaran', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: Color(0xFF334155))),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    value: selectedType,
                    items: const [
                      DropdownMenuItem(value: 'BROADCAST', child: Text('📢 Pengumuman Umum (Broadcast)')),
                      DropdownMenuItem(value: 'PROMO', child: Text('🎁 Promo & Penawaran Paket')),
                      DropdownMenuItem(value: 'MAINTENANCE', child: Text('🛠️ Pemeliharaan Jaringan (Maintenance)')),
                      DropdownMenuItem(value: 'INFO', child: Text('ℹ️ Informasi & Tips')),
                      DropdownMenuItem(value: 'WARNING', child: Text('⚠️ Peringatan Kritis')),
                      DropdownMenuItem(value: 'SECURITY', child: Text('🛡️ Keamanan & Akses')),
                    ],
                    onChanged: (val) {
                      if (val != null) setModalState(() => selectedType = val);
                    },
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                  ),
                  const SizedBox(height: 14),

                  const Text('Target Penerima', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: Color(0xFF334155))),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    value: selectedTarget,
                    items: const [
                      DropdownMenuItem(value: 'ALL', child: Text('👥 Seluruh Perangkat (Broadcast All)')),
                      DropdownMenuItem(value: 'TECHNICIAN', child: Text('🔧 Teknisi Lapangan')),
                      DropdownMenuItem(value: 'NOC', child: Text('🖥️ NOC & Operasional')),
                      DropdownMenuItem(value: 'ADMIN', child: Text('🛡️ Administrator')),
                    ],
                    onChanged: (val) {
                      if (val != null) setModalState(() => selectedTarget = val);
                    },
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                  ),
                  const SizedBox(height: 14),

                  const Text('Judul Notifikasi', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: Color(0xFF334155))),
                  const SizedBox(height: 6),
                  TextField(
                    controller: titleCtrl,
                    decoration: InputDecoration(
                      hintText: 'Misal: Promo Paket Turbo 100 Mbps atau Pemeliharaan...',
                      hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                  ),
                  const SizedBox(height: 14),

                  const Text('URL Gambar Poster (Opsional)', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: Color(0xFF334155))),
                  const SizedBox(height: 6),
                  TextField(
                    controller: imageCtrl,
                    decoration: InputDecoration(
                      hintText: 'https://example.com/poster-notif.jpg',
                      hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                      prefixIcon: const Icon(Icons.image_outlined, size: 20, color: Color(0xFF64748B)),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                  ),
                  const SizedBox(height: 14),

                  const Text('Isi Pesan Siaran', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: Color(0xFF334155))),
                  const SizedBox(height: 6),
                  TextField(
                    controller: bodyCtrl,
                    maxLines: 4,
                    decoration: InputDecoration(
                      hintText: 'Tuliskan pesan rincian siaran yang akan dikirim...',
                      hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      contentPadding: const EdgeInsets.all(14),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                  ),
                  const SizedBox(height: 20),

                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            side: const BorderSide(color: Color(0xFFCBD5E1)),
                          ),
                          onPressed: isSubmitting ? null : () => Navigator.pop(ctx),
                          child: const Text('Batal', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0075D8),
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            elevation: 0,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: isSubmitting
                              ? null
                              : () async {
                                  if (titleCtrl.text.trim().isEmpty || bodyCtrl.text.trim().isEmpty) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Judul dan isi pesan wajib diisi!')),
                                    );
                                    return;
                                  }

                                  setModalState(() => isSubmitting = true);
                                  final res = await notifProvider.sendBroadcast(
                                    title: titleCtrl.text.trim(),
                                    body: bodyCtrl.text.trim(),
                                    type: selectedType,
                                    targetRole: selectedTarget,
                                    imageUrl: imageCtrl.text.trim().isNotEmpty ? imageCtrl.text.trim() : null,
                                  );

                                  if (context.mounted) {
                                    setModalState(() => isSubmitting = false);
                                    Navigator.pop(ctx);
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(res['message'] ?? 'Siaran selesai diproses.'),
                                        backgroundColor: res['success'] == true ? const Color(0xFF10B981) : AppColors.danger,
                                      ),
                                    );
                                  }
                                },
                          child: isSubmitting
                              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Text('Kirim Siaran', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNotificationThumbnail(NotificationModel notif) {
    final imageUrl = notif.fullImageUrl;

    // Distinctive BRImo corner cutout: top-left & bottom-right extra rounded
    const posterRadius = BorderRadius.only(
      topLeft: Radius.circular(16),
      topRight: Radius.circular(6),
      bottomLeft: Radius.circular(6),
      bottomRight: Radius.circular(16),
    );

    if (imageUrl != null) {
      return ClipRRect(
        borderRadius: posterRadius,
        child: CachedNetworkImage(
          imageUrl: imageUrl,
          width: 64,
          height: 84,
          fit: BoxFit.cover,
          placeholder: (ctx, url) => Container(
            width: 64,
            height: 84,
            color: const Color(0xFFF1F5F9),
            child: const Center(
              child: SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0075D8)),
              ),
            ),
          ),
          errorWidget: (ctx, url, err) => _buildFallbackThumbnail(notif),
        ),
      );
    }

    return _buildFallbackThumbnail(notif);
  }

  Widget _buildFallbackThumbnail(NotificationModel notif) {
    const posterRadius = BorderRadius.only(
      topLeft: Radius.circular(16),
      topRight: Radius.circular(6),
      bottomLeft: Radius.circular(6),
      bottomRight: Radius.circular(16),
    );

    List<Color> gradientColors;
    IconData icon;

    switch (notif.type) {
      case 'MASS_OUTAGE':
      case 'OUTAGE_INTERFACE':
      case 'OUTAGE_ODP':
      case 'ALARM':
        gradientColors = [const Color(0xFFEF4444), const Color(0xFFB91C1C)];
        icon = Icons.warning_amber_rounded;
        break;
      case 'MAINTENANCE':
        gradientColors = [const Color(0xFFF59E0B), const Color(0xFFD97706)];
        icon = Icons.build_circle_rounded;
        break;
      case 'PROMO':
        gradientColors = [const Color(0xFF8B5CF6), const Color(0xFF6D28D9)];
        icon = Icons.local_offer_rounded;
        break;
      case 'TICKET':
        gradientColors = [const Color(0xFF0284C7), const Color(0xFF0369A1)];
        icon = Icons.confirmation_number_rounded;
        break;
      default:
        gradientColors = [const Color(0xFF0075D8), const Color(0xFF005BAA)];
        icon = Icons.notifications_active_rounded;
    }

    return Container(
      width: 64,
      height: 84,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: gradientColors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: posterRadius,
        boxShadow: [
          BoxShadow(
            color: gradientColors.first.withValues(alpha: 0.25),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Center(
        child: Icon(icon, color: Colors.white, size: 26),
      ),
    );
  }

  Widget _buildFormattedNotificationBody(String raw) {
    if (raw.trim().isEmpty) {
      return const Text(
        'Tidak ada rincian pesan.',
        style: TextStyle(color: Color(0xFF64748B), fontSize: 13.5),
      );
    }

    final cleanLines = raw
        .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
        .replaceAll(RegExp(r'</?(p|div)[^>]*>', caseSensitive: false), '\n')
        .replaceAll('&bull;', '•')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'")
        .replaceAll('────────────────────────────', '')
        .split('\n');

    final widgets = <Widget>[];

    for (var line in cleanLines) {
      final trimmed = line.trim();
      if (trimmed.isEmpty) continue;

      if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
        final content = trimmed.substring(1).trim();
        widgets.add(
          Padding(
            padding: const EdgeInsets.only(bottom: 5, left: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '• ',
                  style: TextStyle(color: Color(0xFF0075D8), fontWeight: FontWeight.bold, fontSize: 14),
                ),
                Expanded(
                  child: Text(
                    content.replaceAll(RegExp(r'<[^>]*>'), ''),
                    style: const TextStyle(color: Color(0xFF334155), fontSize: 13, height: 1.35),
                  ),
                ),
              ],
            ),
          ),
        );
      } else {
        widgets.add(
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(
              trimmed.replaceAll(RegExp(r'<[^>]*>'), ''),
              style: const TextStyle(color: Color(0xFF334155), fontSize: 13.5, height: 1.4),
            ),
          ),
        );
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: widgets,
    );
  }

  @override
  Widget build(BuildContext context) {
    final notifProvider = Provider.of<NotificationProvider>(context);
    final auth = Provider.of<AuthProvider>(context);
    final userRole = auth.currentUser?.role.toUpperCase() ?? 'TECHNICIAN';
    final bool canBroadcast = userRole.contains('ADMIN') || userRole.contains('NOC') || userRole.contains('SUPER');

    final allNotifications = notifProvider.notifications;
    final notifications = _filterNotifications(allNotifications);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: const Color(0xFF0075D8),
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Notifikasi',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined, color: Colors.white),
            tooltip: 'Pengaturan Notifikasi',
            onPressed: _showSettingsSheet,
          ),
          const SizedBox(width: 4),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(50),
          child: Container(
            color: const Color(0xFF0075D8),
            padding: const EdgeInsets.only(left: 12, right: 12, bottom: 12),
            child: SizedBox(
              height: 36,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                itemCount: _categories.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (ctx, index) {
                  final cat = _categories[index];
                  final isSelected = _selectedCategory == cat;

                  return GestureDetector(
                    onTap: () => setState(() => _selectedCategory = cat),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 7),
                      decoration: BoxDecoration(
                        color: isSelected ? Colors.white : const Color(0xFF005BAA),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isSelected ? Colors.white : Colors.white.withValues(alpha: 0.15),
                          width: 1,
                        ),
                      ),
                      child: Center(
                        child: Text(
                          cat,
                          style: TextStyle(
                            color: isSelected ? const Color(0xFF0075D8) : Colors.white,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      ),
      floatingActionButton: canBroadcast
          ? FloatingActionButton.extended(
              backgroundColor: const Color(0xFF0075D8),
              icon: const Icon(Icons.campaign_rounded, color: Colors.white),
              label: const Text('Buat Siaran', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              onPressed: _showBroadcastModal,
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () => notifProvider.fetchNotifications(),
        color: const Color(0xFF0075D8),
        backgroundColor: Colors.white,
        child: notifProvider.isLoading && allNotifications.isEmpty
            ? const Center(
                child: CircularProgressIndicator(color: Color(0xFF0075D8)),
              )
            : notifications.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.notifications_none_rounded,
                          color: const Color(0xFF94A3B8).withValues(alpha: 0.5),
                          size: 56,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          _selectedCategory == 'Semua Notifikasi'
                              ? 'Belum Ada Notifikasi'
                              : 'Tidak Ada Notifikasi $_selectedCategory',
                          style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Pemberitahuan baru dan siaran akan tampil di sini.',
                          style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                        ),
                      ],
                    ),
                  )
                : ListView.separated(
                    itemCount: notifications.length,
                    separatorBuilder: (ctx, i) => const Divider(
                      height: 1,
                      thickness: 1,
                      color: Color(0xFFF1F5F9),
                    ),
                    itemBuilder: (ctx, i) {
                      final notif = notifications[i];

                      return Dismissible(
                        key: Key('notif_${notif.id}'),
                        direction: DismissDirection.endToStart,
                        background: Container(
                          alignment: Alignment.centerRight,
                          padding: const EdgeInsets.only(right: 20),
                          color: const Color(0xFFEF4444),
                          child: const Icon(Icons.delete_rounded, color: Colors.white),
                        ),
                        onDismissed: (_) {
                          notifProvider.deleteNotification(notif.id);
                        },
                        child: InkWell(
                          onTap: () => _showNotificationDetail(notif),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Left text info (Date, Title, Body)
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      // Date & unread blue dot
                                      Row(
                                        children: [
                                          Text(
                                            DateFormat('HH:mm, dd MMM yyyy').format(notif.createdAt),
                                            style: const TextStyle(
                                              color: Color(0xFF64748B),
                                              fontSize: 12,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                          if (!notif.isRead) ...[
                                            const SizedBox(width: 6),
                                            Container(
                                              width: 6.5,
                                              height: 6.5,
                                              decoration: const BoxDecoration(
                                                color: Color(0xFF0075D8),
                                                shape: BoxShape.circle,
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                      const SizedBox(height: 6),

                                      // Title
                                      Text(
                                        notif.cleanTitle,
                                        style: TextStyle(
                                          color: const Color(0xFF0F172A),
                                          fontWeight: notif.isRead ? FontWeight.w600 : FontWeight.w800,
                                          fontSize: 14.5,
                                          height: 1.25,
                                        ),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 5),

                                      // Description body preview
                                      Text(
                                        notif.cleanBody,
                                        style: const TextStyle(
                                          color: Color(0xFF475569),
                                          fontSize: 12.5,
                                          height: 1.35,
                                        ),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),

                                const SizedBox(width: 14),

                                // Right poster thumbnail (supports uploaded image / FONA poster card)
                                _buildNotificationThumbnail(notif),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
      ),
    );
  }
}
