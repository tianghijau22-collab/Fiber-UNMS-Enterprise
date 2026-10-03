import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/dio_client.dart';
import '../../providers/dashboard_provider.dart';

class SystemAlertScreen extends StatefulWidget {
  const SystemAlertScreen({super.key});

  @override
  State<SystemAlertScreen> createState() => _SystemAlertScreenState();
}

class _SystemAlertScreenState extends State<SystemAlertScreen> {
  String _selectedCategory = 'ALL'; // 'ALL', 'OUTAGE', 'DYING_GASP', 'RECOVERY'
  String _searchQuery = '';
  final TextEditingController _searchCtrl = TextEditingController();
  
  bool _isLoadingFeed = false;
  List<dynamic> _alertFeed = [];
  Map<String, dynamic> _stats = {};
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    _fetchAlerts();
    _pollingTimer = Timer.periodic(const Duration(seconds: 15), (_) => _fetchAlerts(silent: true));
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchAlerts({bool silent = false}) async {
    if (!silent) {
      setState(() => _isLoadingFeed = true);
    }

    try {
      final queryParams = <String, dynamic>{
        'limit': 100,
      };
      if (_selectedCategory != 'ALL') {
        queryParams['type'] = _selectedCategory;
      }
      if (_searchQuery.trim().isNotEmpty) {
        queryParams['search'] = _searchQuery.trim();
      }

      final response = await DioClient().dio.get(
        ApiConstants.endpointSystemAlerts,
        queryParameters: queryParams,
      );

      if (response.data != null && mounted) {
        final res = response.data;
        List<dynamic> loadedMessages = [];
        Map<String, dynamic> loadedStats = {};

        if (res is Map<String, dynamic>) {
          if (res['messages'] is List) {
            loadedMessages = res['messages'] as List;
          } else if (res['data'] is List) {
            loadedMessages = res['data'] as List;
          } else if (res['alerts'] is List) {
            loadedMessages = res['alerts'] as List;
          }

          if (res['stats'] is Map<String, dynamic>) {
            loadedStats = res['stats'] as Map<String, dynamic>;
          }
        } else if (res is List) {
          loadedMessages = res;
        }

        setState(() {
          _alertFeed = loadedMessages;
          _stats = loadedStats;
          _isLoadingFeed = false;
        });
      }
    } catch (e) {
      if (mounted) {
        final dp = Provider.of<DashboardProvider>(context, listen: false);
        if (_alertFeed.isEmpty && dp.systemAlerts.isNotEmpty) {
          setState(() {
            _alertFeed = dp.systemAlerts;
            _isLoadingFeed = false;
          });
        } else {
          setState(() => _isLoadingFeed = false);
        }
      }
    }
  }

  String _cleanHtml(String text) {
    return text
        .replaceAll(RegExp(r'<[^>]*>|&[^;]+;'), ' ')
        .replaceAll('────────────────────────────', '')
        .replaceAll(RegExp(r'\[#(?:POLL|TRAP|UNMS|MASS_OUTAGE|RECOVERY|DYING_GASP)\]'), '')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  String _cleanAlertTitle(String title) {
    var t = title
        .replaceAll(RegExp(r'^[⚡🚨⚠️🟢🔴👤🖥️🔄\s]+'), '')
        .replaceAll('SNMP TRAP:', '')
        .replaceAll('PERINGATAN FLAPPING:', 'Flapping:')
        .replaceAll('ALARM GANGGUAN:', 'Gangguan:')
        .replaceAll('ALARM LOS:', 'LOS:')
        .trim();
    return t.isEmpty ? title : t;
  }

  String _formatAlertTime(Map<String, dynamic> alert) {
    final createdStr = alert['created_at']?.toString();
    if (createdStr != null && createdStr.isNotEmpty) {
      try {
        final dt = DateTime.parse(createdStr);
        final diff = DateTime.now().difference(dt);
        if (diff.inSeconds < 60) return 'Baru saja';
        if (diff.inMinutes < 60) return '${diff.inMinutes}m lalu';
        if (diff.inHours < 24) return '${diff.inHours}j lalu';
      } catch (_) {}
    }
    return alert['time_human']?.toString() ??
        alert['datetime_human']?.toString() ??
        alert['time']?.toString() ??
        'Baru saja';
  }

  String _formatAlertNode(Map<String, dynamic> alert) {
    final rawBody = (alert['body'] ?? alert['description'] ?? '').toString();

    final odpMatch = RegExp(r'ODP[:\s]+([A-Za-z0-9_\-\/ ]+?)(?:\)|<|\n|$)').firstMatch(rawBody);
    if (odpMatch != null && odpMatch.group(1) != null) {
      final name = odpMatch.group(1)!.trim().replaceAll(RegExp(r'\s+'), ' ');
      if (name.isNotEmpty) return name;
    }

    final ifMatch = RegExp(r'(?:gpon-olt|epon-olt)[A-Za-z0-9_\-\/:]*').firstMatch(rawBody);
    if (ifMatch != null) {
      return ifMatch.group(0)!;
    }

    if (alert['node'] != null && alert['node'].toString().isNotEmpty && alert['node'] != 'Node FTTH') {
      return alert['node'].toString();
    }

    if (alert['olt'] != null && alert['olt'].toString().isNotEmpty) {
      return alert['olt'].toString();
    }

    return 'Node FTTH';
  }

  String _formatAlertSubtitle(Map<String, dynamic> alert) {
    final rawBody = (alert['body'] ?? alert['description'] ?? '').toString();
    if (rawBody.isEmpty) return 'Terdeteksi anomali pada jalur optik';

    final oltMatch = RegExp(r'OLT:<\/b>\s*([^<\n]+)').firstMatch(rawBody);
    final ifMatch = RegExp(r'Interface\s*\/\s*Port:<\/b>\s*<code>([^<]+)<\/code>').firstMatch(rawBody);
    final snMatch = RegExp(r'SN(?:\s*Modem)?:<\/b>\s*<code>([^<]+)<\/code>').firstMatch(rawBody);
    final rxMatch = RegExp(r'(-?\d+(?:\.\d+)?\s*dBm)').firstMatch(rawBody);

    final List<String> parts = [];
    if (oltMatch != null) {
      var oltName = oltMatch.group(1)!.trim().replaceAll('OLT ', '');
      parts.add('OLT: $oltName');
    }
    if (ifMatch != null) {
      var ifName = ifMatch.group(1)!.trim().replaceAll('gpon-olt_', '').replaceAll('epon-olt_', '');
      parts.add('Port: $ifName');
    }
    if (snMatch != null) {
      parts.add('SN: ${snMatch.group(1)!.trim()}');
    } else if (rxMatch != null) {
      parts.add('RX: ${rxMatch.group(1)!.trim()}');
    }

    if (parts.isNotEmpty) {
      return parts.join(' • ');
    }

    var clean = _cleanHtml(rawBody);
    if (clean.length > 90) {
      clean = '${clean.substring(0, 90)}...';
    }
    return clean.isEmpty ? 'Terdeteksi aktivitas pada perangkat' : clean;
  }

  void _showAlertDetail(Map<String, dynamic> alert) {
    final rawTitle = alert['title']?.toString() ?? 'Detail Alert';
    final cleanTitle = _cleanAlertTitle(rawTitle);
    final rawBody = alert['body']?.toString() ?? alert['description']?.toString() ?? '';
    final cleanBody = _cleanHtml(rawBody);
    final telegramText = alert['telegram_text']?.toString() ?? '$rawTitle\n\n$cleanBody';
    final timeStr = alert['datetime_human']?.toString() ?? alert['time_human']?.toString() ?? _formatAlertTime(alert);
    final nodeStr = _formatAlertNode(alert);
    final badge = alert['source_short_badge']?.toString() ?? alert['category']?.toString() ?? 'SYSTEM';

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
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
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
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    badge,
                    style: const TextStyle(color: Color(0xFF334155), fontWeight: FontWeight.bold, fontSize: 11),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE0F7FA),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    nodeStr,
                    style: const TextStyle(color: Color(0xFF00AAE0), fontWeight: FontWeight.bold, fontSize: 11),
                  ),
                ),
                const Spacer(),
                Text(
                  timeStr,
                  style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              cleanTitle,
              style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w800, fontSize: 16),
            ),
            const SizedBox(height: 12),
            Flexible(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  child: SelectableText(
                    cleanBody.isNotEmpty ? cleanBody : 'Tidak ada detail tambahan untuk insiden ini.',
                    style: const TextStyle(color: Color(0xFF334155), fontSize: 13, height: 1.5),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.copy_rounded, size: 18, color: Color(0xFF00AAE0)),
                    label: const Text('Salin Format Telegram', style: TextStyle(color: Color(0xFF00AAE0), fontWeight: FontWeight.w700)),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      side: const BorderSide(color: Color(0xFF00AAE0)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: telegramText));
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Pesan alert berhasil disalin ke clipboard!'),
                          backgroundColor: Color(0xFF10B981),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(width: 10),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF00AAE0),
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 22),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Tutup', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  void _showFilterSheet(int totalCount, int outageCount, int dyingGaspCount, int recoveryCount) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setSheetState) => Container(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Filter Kategori Alert',
                    style: TextStyle(color: Color(0xFF0F172A), fontSize: 16, fontWeight: FontWeight.w800),
                  ),
                  TextButton(
                    onPressed: () {
                      setState(() => _selectedCategory = 'ALL');
                      Navigator.pop(ctx);
                      _fetchAlerts();
                    },
                    child: const Text('Reset', style: TextStyle(color: Color(0xFF00AAE0), fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _buildFilterOption(
                label: 'Semua Kategori Insiden',
                count: totalCount,
                keyName: 'ALL',
                icon: Icons.list_alt_rounded,
                color: const Color(0xFF00AAE0),
                onTap: () {
                  setState(() => _selectedCategory = 'ALL');
                  Navigator.pop(ctx);
                  _fetchAlerts();
                },
              ),
              _buildFilterOption(
                label: 'Gangguan & Putus (Outage / LOS)',
                count: outageCount,
                keyName: 'OUTAGE',
                icon: Icons.bolt_rounded,
                color: const Color(0xFFEF4444),
                onTap: () {
                  setState(() => _selectedCategory = 'OUTAGE');
                  Navigator.pop(ctx);
                  _fetchAlerts();
                },
              ),
              _buildFilterOption(
                label: 'Dying Gasp (Mati Listrik PLN)',
                count: dyingGaspCount,
                keyName: 'DYING_GASP',
                icon: Icons.power_off_rounded,
                color: const Color(0xFFEA580C),
                onTap: () {
                  setState(() => _selectedCategory = 'DYING_GASP');
                  Navigator.pop(ctx);
                  _fetchAlerts();
                },
              ),
              _buildFilterOption(
                label: 'Normal / Pulih (Restored)',
                count: recoveryCount,
                keyName: 'RECOVERY',
                icon: Icons.check_circle_outline_rounded,
                color: const Color(0xFF10B981),
                onTap: () {
                  setState(() => _selectedCategory = 'RECOVERY');
                  Navigator.pop(ctx);
                  _fetchAlerts();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFilterOption({
    required String label,
    required int count,
    required String keyName,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    final isSelected = _selectedCategory == keyName;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? color.withValues(alpha: 0.1) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isSelected ? color : const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: const Color(0xFF0F172A),
                  fontSize: 13.5,
                  fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
              decoration: BoxDecoration(
                color: isSelected ? color : const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  color: isSelected ? Colors.white : const Color(0xFF475569),
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final effectiveAlerts = _alertFeed.where((raw) {
      final alert = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};

      final title = (alert['title'] ?? '').toString().toLowerCase();
      final body = (alert['body'] ?? alert['description'] ?? '').toString().toLowerCase();
      final node = _formatAlertNode(alert).toLowerCase();

      final isOutage = alert['is_outage'] == true || title.contains('gangguan') || title.contains('los') || title.contains('alarm') || title.contains('down') || title.contains('putus');
      final isDyingGasp = alert['is_dying_gasp'] == true || title.contains('dying gasp') || title.contains('listrik') || body.contains('dying gasp');
      final isRecovery = alert['is_recovery'] == true || title.contains('pulih') || title.contains('recovery') || title.contains('restored') || title.contains('normal');

      final matchesCat = switch (_selectedCategory) {
        'OUTAGE' => isOutage && !isDyingGasp,
        'DYING_GASP' => isDyingGasp,
        'RECOVERY' => isRecovery,
        _ => true,
      };

      final matchesSearch = _searchQuery.isEmpty ||
          title.contains(_searchQuery.toLowerCase()) ||
          body.contains(_searchQuery.toLowerCase()) ||
          node.contains(_searchQuery.toLowerCase());

      return matchesCat && matchesSearch;
    }).toList();

    final outageCount = _stats['outage_today'] ?? _stats['outage_interface_today'] ?? _alertFeed.where((raw) {
      final a = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
      final t = (a['title'] ?? '').toString().toLowerCase();
      return (a['is_outage'] == true || t.contains('gangguan') || t.contains('los')) && !(a['is_dying_gasp'] == true || t.contains('dying gasp') || t.contains('listrik'));
    }).length;

    final dyingGaspCount = _stats['dying_gasp_today'] ?? _alertFeed.where((raw) {
      final a = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
      final t = (a['title'] ?? '').toString().toLowerCase();
      return a['is_dying_gasp'] == true || t.contains('dying gasp') || t.contains('listrik');
    }).length;

    final recoveryCount = _stats['recovery_today'] ?? _stats['recovery_interface_today'] ?? _alertFeed.where((raw) {
      final a = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
      final t = (a['title'] ?? '').toString().toLowerCase();
      return a['is_recovery'] == true || t.contains('pulih') || t.contains('recovery') || t.contains('normal');
    }).length;

    final int totalCount = _alertFeed.length;
    final int safeOutageCount = outageCount is int ? outageCount : 0;
    final int safeDyingGaspCount = dyingGaspCount is int ? dyingGaspCount : 0;
    final int safeRecoveryCount = recoveryCount is int ? recoveryCount : 0;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'Alert & Gangguan Jaringan',
          style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w800, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: _isLoadingFeed
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF00AAE0)),
                  )
                : const Icon(Icons.refresh_rounded, color: Color(0xFF64748B)),
            onPressed: _isLoadingFeed ? null : () => _fetchAlerts(),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          // Search & Filter Bar
          Container(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            color: Colors.white,
            child: Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 44,
                    child: TextField(
                      controller: _searchCtrl,
                      onChanged: (val) {
                        setState(() => _searchQuery = val.trim());
                        _fetchAlerts(silent: true);
                      },
                      style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13.5),
                      decoration: InputDecoration(
                        hintText: 'Cari alert, ODP, OLT, SN...',
                        hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                        prefixIcon: const Icon(Icons.search, color: Color(0xFF64748B), size: 19),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear, color: Color(0xFF64748B), size: 16),
                                onPressed: () {
                                  _searchCtrl.clear();
                                  setState(() => _searchQuery = '');
                                  _fetchAlerts();
                                },
                              )
                            : null,
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF00AAE0), width: 1.5)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                InkWell(
                  onTap: () => _showFilterSheet(
                    totalCount,
                    safeOutageCount,
                    safeDyingGaspCount,
                    safeRecoveryCount,
                  ),
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    height: 44,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: _selectedCategory != 'ALL'
                          ? const Color(0xFF00AAE0).withValues(alpha: 0.12)
                          : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: _selectedCategory != 'ALL' ? const Color(0xFF00AAE0) : const Color(0xFFE2E8F0),
                      ),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.filter_list_rounded, color: Color(0xFF00AAE0), size: 18),
                        SizedBox(width: 6),
                        Text(
                          'Filter',
                          style: TextStyle(color: Color(0xFF0F172A), fontSize: 12.5, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Alert List
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => _fetchAlerts(),
              color: const Color(0xFF00AAE0),
              backgroundColor: Colors.white,
              child: _isLoadingFeed && _alertFeed.isEmpty
                  ? const Center(
                      child: CircularProgressIndicator(color: Color(0xFF00AAE0)),
                    )
                  : effectiveAlerts.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.check_circle_outline_rounded, color: const Color(0xFF10B981).withValues(alpha: 0.6), size: 54),
                              const SizedBox(height: 12),
                              const Text(
                                'Tidak Ada Alert Terdeteksi',
                                style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 16),
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                'Seluruh parameter jaringan dan OLT terpantau normal.',
                                style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          itemCount: effectiveAlerts.length,
                          itemBuilder: (ctx, i) {
                            final raw = effectiveAlerts[i];
                            final alert = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};

                            final rawTitle = alert['title']?.toString() ?? 'Alert Sistem';
                            final cleanTitle = _cleanAlertTitle(rawTitle);
                            final subtitle = _formatAlertSubtitle(alert);
                            final node = _formatAlertNode(alert);
                            final time = _formatAlertTime(alert);

                            final sev = (alert['severity']?.toString() ?? alert['type']?.toString() ?? alert['category'] ?? '').toUpperCase();
                            final upperTitle = rawTitle.toUpperCase();

                            final bool isCritical = alert['is_outage'] == true ||
                                sev.contains('CRITICAL') ||
                                sev.contains('HIGH') ||
                                sev.contains('DANGER') ||
                                upperTitle.contains('LOS') ||
                                upperTitle.contains('MATI MASSAL') ||
                                upperTitle.contains('PUTUS');

                            final bool isDyingGasp = alert['is_dying_gasp'] == true ||
                                sev.contains('DYING_GASP') ||
                                upperTitle.contains('DYING GASP') ||
                                upperTitle.contains('PADAM') ||
                                upperTitle.contains('LISTRIK');

                            final bool isRecovery = alert['is_recovery'] == true ||
                                sev.contains('RECOVERY') ||
                                upperTitle.contains('PULIH') ||
                                upperTitle.contains('RESTORED') ||
                                upperTitle.contains('NORMAL');

                            final bool isWarning = !isCritical &&
                                !isDyingGasp &&
                                !isRecovery &&
                                (sev.contains('WARNING') || upperTitle.contains('FLAPPING') || upperTitle.contains('ATTENUATION') || upperTitle.contains('REDAMAN'));

                            String badgeText;
                            Color badgeBg;
                            Color badgeColor;
                            Color iconBg;
                            Color iconColor;
                            IconData icon;

                            if (isRecovery) {
                              badgeText = 'RESTORED';
                              badgeBg = const Color(0xFFDCFCE7);
                              badgeColor = const Color(0xFF15803D);
                              iconBg = const Color(0xFFDCFCE7);
                              iconColor = const Color(0xFF10B981);
                              icon = Icons.check_circle_outline_rounded;
                            } else if (isDyingGasp) {
                              badgeText = 'DYING GASP';
                              badgeBg = const Color(0xFFFFEDD5);
                              badgeColor = const Color(0xFFC2410C);
                              iconBg = const Color(0xFFFFEDD5);
                              iconColor = const Color(0xFFEA580C);
                              icon = Icons.power_off_rounded;
                            } else if (isCritical) {
                              badgeText = upperTitle.contains('MASSAL') ? 'MASS OUTAGE' : 'LOS CRITICAL';
                              badgeBg = const Color(0xFFFEE2E2);
                              badgeColor = const Color(0xFFDC2626);
                              iconBg = const Color(0xFFFEE2E2);
                              iconColor = const Color(0xFFEF4444);
                              icon = Icons.bolt_rounded;
                            } else if (isWarning) {
                              badgeText = 'ATTENUATION';
                              badgeBg = const Color(0xFFFEF3C7);
                              badgeColor = const Color(0xFFD97706);
                              iconBg = const Color(0xFFFEF3C7);
                              iconColor = const Color(0xFFD97706);
                              icon = Icons.warning_amber_rounded;
                            } else {
                              badgeText = 'SYSTEM ALERT';
                              badgeBg = const Color(0xFFE0F2FE);
                              badgeColor = const Color(0xFF0369A1);
                              iconBg = const Color(0xFFE0F2FE);
                              iconColor = const Color(0xFF0284C7);
                              icon = Icons.info_outline_rounded;
                            }

                            return InkWell(
                              onTap: () => _showAlertDetail(alert),
                              borderRadius: BorderRadius.circular(14),
                              child: Container(
                                margin: const EdgeInsets.only(bottom: 10),
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFF0F172A).withValues(alpha: 0.03),
                                      blurRadius: 8,
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
                                        color: iconBg,
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Center(
                                        child: Icon(icon, color: iconColor, size: 22),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: badgeBg,
                                                  borderRadius: BorderRadius.circular(4),
                                                ),
                                                child: Text(
                                                  badgeText,
                                                  style: TextStyle(
                                                    color: badgeColor,
                                                    fontSize: 9.5,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(width: 6),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFFF1F5F9),
                                                  borderRadius: BorderRadius.circular(4),
                                                ),
                                                child: Text(
                                                  node,
                                                  style: const TextStyle(
                                                    color: Color(0xFF475569),
                                                    fontWeight: FontWeight.w600,
                                                    fontSize: 9.5,
                                                  ),
                                                ),
                                              ),
                                              const Spacer(),
                                              Text(
                                                time,
                                                style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 6),
                                          Text(
                                            cleanTitle,
                                            style: const TextStyle(
                                              color: Color(0xFF0F172A),
                                              fontWeight: FontWeight.bold,
                                              fontSize: 13.5,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            subtitle,
                                            style: const TextStyle(color: Color(0xFF64748B), fontSize: 11.5),
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
            ),
          ),
        ],
      ),
    );
  }
}
