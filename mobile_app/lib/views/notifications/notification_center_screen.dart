import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final np = Provider.of<NotificationProvider>(context, listen: false);
      np.fetchNotifications();
    });
  }

  void _showNotificationDetail(NotificationModel notif) {
    final provider = Provider.of<NotificationProvider>(context, listen: false);
    if (!notif.isRead) {
      provider.markAsRead(notif.id);
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.88,
        ),
        padding: const EdgeInsets.only(top: 12, left: 20, right: 20, bottom: 20),
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
                margin: const EdgeInsets.only(bottom: 14),
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3.5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE0F2FE),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.notifications_active_rounded, size: 14, color: Color(0xFF00AAE0)),
                      SizedBox(width: 5),
                      Text(
                        'Pusat Notifikasi',
                        style: TextStyle(
                          color: Color(0xFF008BB8),
                          fontWeight: FontWeight.w800,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                Text(
                  notif.formattedTime,
                  style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              notif.cleanTitle,
              style: const TextStyle(
                color: Color(0xFF0F172A),
                fontWeight: FontWeight.w800,
                fontSize: 16.5,
                height: 1.3,
              ),
            ),
            const SizedBox(height: 12),
            Flexible(
              child: Container(
                width: double.infinity,
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
            Row(
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
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF00AAE0),
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
          ],
        ),
      ),
    );
  }

  void _showBroadcastModal() {
    final titleCtrl = TextEditingController();
    final bodyCtrl = TextEditingController();
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
                          color: const Color(0xFF00AAE0).withValues(alpha: 0.12),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.campaign_rounded, color: Color(0xFF00AAE0), size: 22),
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
                            'Kirimkan pengumuman langsung ke ponsel teknisi/pengguna',
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
                      DropdownMenuItem(value: 'ALL', child: Text('🌐 Seluruh Pengguna & Teknisi (ALL)')),
                      DropdownMenuItem(value: 'TECHNICIAN', child: Text('🔧 Tim Teknisi Lapangan Saja')),
                      DropdownMenuItem(value: 'ADMIN', child: Text('👑 Administrator & NOC Saja')),
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
                      hintText: 'Contoh: Pemeliharaan Jalur Core OLT...',
                      hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF00AAE0), width: 1.5)),
                    ),
                  ),
                  const SizedBox(height: 14),

                  const Text('Isi Pesan Siaran', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: Color(0xFF334155))),
                  const SizedBox(height: 6),
                  TextField(
                    controller: bodyCtrl,
                    maxLines: 4,
                    decoration: InputDecoration(
                      hintText: 'Tuliskan pesan yang akan disiarkan ke seluruh perangkat...',
                      hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      contentPadding: const EdgeInsets.all(14),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF00AAE0), width: 1.5)),
                    ),
                  ),
                  const SizedBox(height: 22),

                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: isSubmitting ? null : () => Navigator.pop(ctx),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            side: const BorderSide(color: Color(0xFFCBD5E1)),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text('Batal', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: ElevatedButton.icon(
                          icon: isSubmitting
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                )
                              : const Icon(Icons.send_rounded, size: 18, color: Colors.white),
                          label: Text(
                            isSubmitting ? 'Mengirim...' : 'Kirim Siaran',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF00AAE0),
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: isSubmitting
                              ? null
                              : () async {
                                  final title = titleCtrl.text.trim();
                                  final body = bodyCtrl.text.trim();

                                  if (title.isEmpty || body.isEmpty) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('Silakan isi judul dan isi pesan siaran.'),
                                        backgroundColor: AppColors.danger,
                                      ),
                                    );
                                    return;
                                  }

                                  final messenger = ScaffoldMessenger.of(context);
                                  final navigator = Navigator.of(ctx);

                                  setModalState(() => isSubmitting = true);

                                  final res = await notifProvider.sendBroadcast(
                                    title: title,
                                    body: body,
                                    type: selectedType,
                                    targetRole: selectedTarget,
                                  );

                                  if (mounted) {
                                    setModalState(() => isSubmitting = false);
                                    navigator.pop();
                                    messenger.showSnackBar(
                                      SnackBar(
                                        content: Text(res['message'] ?? 'Siaran dikirimkan.'),
                                        backgroundColor: res['success'] == true ? const Color(0xFF10B981) : AppColors.danger,
                                      ),
                                    );
                                  }
                                },
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

  @override
  Widget build(BuildContext context) {
    final notifProvider = Provider.of<NotificationProvider>(context);
    final auth = Provider.of<AuthProvider>(context);
    final userRole = auth.currentUser?.role.toUpperCase() ?? 'TECHNICIAN';
    final bool canBroadcast = userRole.contains('ADMIN') || userRole.contains('NOC') || userRole.contains('SUPER');

    final notifications = notifProvider.notifications;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'Pusat Notifikasi',
          style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w800, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.done_all_rounded, color: Color(0xFF00AAE0)),
            tooltip: 'Tandai Semua Dibaca',
            onPressed: notifProvider.unreadCount > 0
                ? () {
                    notifProvider.markAllAsRead();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Semua notifikasi ditandai telah dibaca.')),
                    );
                  }
                : null,
          ),
          IconButton(
            icon: notifProvider.isLoading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF00AAE0)),
                  )
                : const Icon(Icons.refresh_rounded, color: Color(0xFF64748B)),
            onPressed: () => notifProvider.fetchNotifications(),
          ),
          const SizedBox(width: 6),
        ],
      ),
      floatingActionButton: canBroadcast
          ? FloatingActionButton.extended(
              backgroundColor: const Color(0xFF00AAE0),
              icon: const Icon(Icons.campaign_rounded, color: Colors.white),
              label: const Text('Buat Siaran Massal', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              onPressed: _showBroadcastModal,
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () => notifProvider.fetchNotifications(),
        color: const Color(0xFF00AAE0),
        backgroundColor: Colors.white,
        child: notifProvider.isLoading && notifications.isEmpty
            ? const Center(
                child: CircularProgressIndicator(color: Color(0xFF00AAE0)),
              )
            : notifications.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.mark_email_read_rounded, color: const Color(0xFF94A3B8).withValues(alpha: 0.5), size: 56),
                        const SizedBox(height: 12),
                        const Text(
                          'Belum Ada Notifikasi',
                          style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Siaran admin, tiket terkait, atau gangguan massal akan tampil di sini.',
                          style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    itemCount: notifications.length,
                    itemBuilder: (ctx, i) {
                      final notif = notifications[i];

                            return Dismissible(
                              key: Key('notif_${notif.id}'),
                              direction: DismissDirection.endToStart,
                              background: Container(
                                alignment: Alignment.centerRight,
                                padding: const EdgeInsets.only(right: 20),
                                margin: const EdgeInsets.only(bottom: 10),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEF4444),
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: const Icon(Icons.delete_rounded, color: Colors.white),
                              ),
                              onDismissed: (_) {
                                notifProvider.deleteNotification(notif.id);
                              },
                              child: InkWell(
                                onTap: () => _showNotificationDetail(notif),
                                borderRadius: BorderRadius.circular(14),
                                child: Container(
                                  margin: const EdgeInsets.only(bottom: 10),
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    color: notif.isRead ? Colors.white : const Color(0xFFF0F9FF),
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(
                                      color: notif.isRead ? const Color(0xFFE2E8F0) : const Color(0xFFBAE6FD),
                                      width: notif.isRead ? 1 : 1.5,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFF0F172A).withValues(alpha: 0.03),
                                        blurRadius: 6,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Container(
                                        width: 42,
                                        height: 42,
                                        decoration: BoxDecoration(
                                          color: notif.isRead ? const Color(0xFFF1F5F9) : const Color(0xFFE0F2FE),
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: Center(
                                          child: Icon(
                                            Icons.notifications_rounded,
                                            color: notif.isRead ? const Color(0xFF94A3B8) : const Color(0xFF00AAE0),
                                            size: 22,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                if (!notif.isRead)
                                                  Container(
                                                    width: 7,
                                                    height: 7,
                                                    decoration: const BoxDecoration(
                                                      color: Color(0xFF00AAE0),
                                                      shape: BoxShape.circle,
                                                    ),
                                                  ),
                                                const Spacer(),
                                                Text(
                                                  notif.timeAgo,
                                                  style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 6),
                                            Text(
                                              notif.cleanTitle,
                                              style: TextStyle(
                                                color: const Color(0xFF0F172A),
                                                fontWeight: notif.isRead ? FontWeight.w600 : FontWeight.w800,
                                                fontSize: 13.5,
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              notif.cleanBody,
                                              style: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ],
                                        ),
                                      ),
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

  Widget _buildFormattedNotificationBody(String raw) {
    if (raw.trim().isEmpty) {
      return const Text(
        'Tidak ada rincian pesan.',
        style: TextStyle(color: Color(0xFF64748B), fontSize: 13.5),
      );
    }

    final cleanLines = raw
        .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
        .replaceAll('────────────────────────────', '')
        .split('\n');

    final List<Widget> lineWidgets = [];

    for (final rawLine in cleanLines) {
      final line = rawLine.trim();
      if (line.isEmpty) {
        lineWidgets.add(const SizedBox(height: 6));
        continue;
      }

      final spans = _parseHtmlToSpans(line);

      lineWidgets.add(
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 2.5),
          child: SelectableText.rich(
            TextSpan(
              style: const TextStyle(
                color: Color(0xFF334155),
                fontSize: 13.5,
                height: 1.5,
              ),
              children: spans,
            ),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: lineWidgets,
    );
  }

  List<InlineSpan> _parseHtmlToSpans(String input) {
    final List<InlineSpan> spans = [];
    final regex = RegExp(
      r'(<b>(.*?)<\/b>|<code>(.*?)<\/code>|<i>(.*?)<\/i>|<strong>(.*?)<\/strong>)',
      caseSensitive: false,
    );

    int lastIndex = 0;
    for (final match in regex.allMatches(input)) {
      if (match.start > lastIndex) {
        final normalText = _decodeHtmlEntities(input.substring(lastIndex, match.start));
        if (normalText.isNotEmpty) {
          spans.add(TextSpan(text: normalText));
        }
      }

      final fullMatch = match.group(0)!;
      if (fullMatch.toLowerCase().startsWith('<b>') || fullMatch.toLowerCase().startsWith('<strong>')) {
        final content = _decodeHtmlEntities(match.group(2) ?? match.group(5) ?? '');
        spans.add(
          TextSpan(
            text: content,
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              color: Color(0xFF0F172A),
            ),
          ),
        );
      } else if (fullMatch.toLowerCase().startsWith('<code>')) {
        final content = _decodeHtmlEntities(match.group(3) ?? '');
        spans.add(
          WidgetSpan(
            alignment: PlaceholderAlignment.middle,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
              margin: const EdgeInsets.symmetric(horizontal: 2),
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(5),
              ),
              child: Text(
                content,
                style: const TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                ),
              ),
            ),
          ),
        );
      } else if (fullMatch.toLowerCase().startsWith('<i>')) {
        final content = _decodeHtmlEntities(match.group(4) ?? '');
        spans.add(
          TextSpan(
            text: content,
            style: const TextStyle(fontStyle: FontStyle.italic),
          ),
        );
      }

      lastIndex = match.end;
    }

    if (lastIndex < input.length) {
      final normalText = _decodeHtmlEntities(input.substring(lastIndex));
      if (normalText.isNotEmpty) {
        spans.add(TextSpan(text: normalText));
      }
    }

    return spans.isNotEmpty ? spans : [TextSpan(text: _decodeHtmlEntities(input))];
  }

  String _decodeHtmlEntities(String text) {
    return text
        .replaceAll('<b>', '')
        .replaceAll('</b>', '')
        .replaceAll('<strong>', '')
        .replaceAll('</strong>', '')
        .replaceAll('<code>', '')
        .replaceAll('</code>', '')
        .replaceAll('<i>', '')
        .replaceAll('</i>', '')
        .replaceAll('&bull;', '•')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'");
  }
}
