import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/dio_client.dart';

class OltListScreen extends StatefulWidget {
  const OltListScreen({super.key});

  @override
  State<OltListScreen> createState() => _OltListScreenState();
}

class _OltListScreenState extends State<OltListScreen> {
  List<dynamic> _olts = [];
  bool _isLoading = true;
  String? _errorMessage;
  String _filter = 'ALL'; // 'ALL', 'ONLINE', 'OFFLINE'
  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';

  // Mode Tampilan: 'LIST' (Daftar OLT) vs 'CHASSIS' (Virtual Chassis Rack)
  String _viewMode = 'LIST';
  int _selectedOltIndex = 0;
  String? _selectedPortId;
  Map<String, dynamic>? _selectedPortData;

  @override
  void initState() {
    super.initState();
    _fetchOlts();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchOlts() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await DioClient().dio.get(ApiConstants.endpointOlts);
      if (response.data != null && mounted) {
        final rawData = response.data is List
            ? response.data
            : (response.data['data'] is List ? response.data['data'] : []);
        setState(() {
          _olts = rawData;
          _isLoading = false;
          if (_selectedOltIndex >= _olts.length) {
            _selectedOltIndex = 0;
          }
        });
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.response?.data?['message'] ?? 'Gagal memuat data OLT dari server.';
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Terjadi kesalahan: $e';
          _isLoading = false;
        });
      }
    }
  }

  String _maskIp(String? ip) {
    return '***.***.***.***';
  }

  void _showOltDetailModal(Map<String, dynamic> olt, int oltIndex) {
    final name = olt['name'] ?? 'OLT Device';
    final vendor = olt['vendor'] ?? 'ZTE / Huawei';
    final model = olt['model'] ?? 'Standard Chassis';
    final status = (olt['status'] ?? 'offline').toString().toLowerCase();
    final isOnline = status == 'online' || status == 'active';
    final totalPon = olt['pon_ports_count'] ?? olt['total_ports'] ?? 8;
    final totalOnus = olt['total_onus_count'] ?? (olt['last_telemetry_snapshot']?['onu_count'] ?? 0);
    final odcCount = olt['odc_count'] ?? 0;
    final odpCount = olt['odp_count'] ?? 0;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(22),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 38,
                height: 4,
                margin: const EdgeInsets.only(bottom: 18),
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: (isOnline ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.router_rounded,
                    color: isOnline ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                    size: 26,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w800, fontSize: 17),
                      ),
                      Text(
                        '$vendor • $model',
                        style: const TextStyle(color: Color(0xFF64748B), fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: isOnline ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 3.5,
                        backgroundColor: isOnline ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        isOnline ? 'ONLINE' : 'OFFLINE',
                        style: TextStyle(
                          color: isOnline ? const Color(0xFF15803D) : const Color(0xFFDC2626),
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            const Divider(color: Color(0xFFE2E8F0), height: 1),
            const SizedBox(height: 16),

            // Telemetry Grid
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(child: _buildModalDetailItem('IP Host / Address', _maskIp(''), Icons.language)),
                      Expanded(child: _buildModalDetailItem('Port PON Terpasang', '$totalPon Port', Icons.settings_input_composite_rounded)),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(child: _buildModalDetailItem('Total ONU Terdaftar', '$totalOnus Pelanggan', Icons.devices_other_rounded)),
                      Expanded(child: _buildModalDetailItem('Node Terhubung', '$odcCount ODC • $odpCount ODP', Icons.hub_rounded)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Button Buka Virtual Chassis
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.developer_board_rounded, size: 18, color: Colors.white),
                label: const Text('Buka Virtual Chassis Rack', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13.5)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00AAE0),
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  setState(() {
                    _selectedOltIndex = oltIndex;
                    _viewMode = 'CHASSIS';
                    _selectedPortId = null;
                    _selectedPortData = null;
                  });
                },
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _buildModalDetailItem(String title, String val, IconData icon) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: const Color(0xFF00AAE0), size: 16),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(color: Color(0xFF64748B), fontSize: 11, fontWeight: FontWeight.w500)),
              const SizedBox(height: 2),
              Text(val, style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13, fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
      ],
    );
  }

  void _showFilterModal(int totalCount, int onlineCount, int offlineCount) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
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
                  'Filter Status Perangkat OLT',
                  style: TextStyle(color: Color(0xFF0F172A), fontSize: 16, fontWeight: FontWeight.w800),
                ),
                TextButton(
                  onPressed: () {
                    setState(() => _filter = 'ALL');
                    Navigator.pop(ctx);
                  },
                  child: const Text('Reset', style: TextStyle(color: Color(0xFF00AAE0), fontWeight: FontWeight.w700)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _buildFilterOption(
              label: 'Semua Perangkat OLT',
              count: totalCount,
              keyName: 'ALL',
              icon: Icons.list_alt_rounded,
              color: const Color(0xFF00AAE0),
              onTap: () {
                setState(() => _filter = 'ALL');
                Navigator.pop(ctx);
              },
            ),
            _buildFilterOption(
              label: 'OLT Online (Terhubung)',
              count: onlineCount,
              keyName: 'ONLINE',
              icon: Icons.check_circle_outline_rounded,
              color: const Color(0xFF10B981),
              onTap: () {
                setState(() => _filter = 'ONLINE');
                Navigator.pop(ctx);
              },
            ),
            _buildFilterOption(
              label: 'OLT Offline (Terputus)',
              count: offlineCount,
              keyName: 'OFFLINE',
              icon: Icons.error_outline_rounded,
              color: const Color(0xFFEF4444),
              onTap: () {
                setState(() => _filter = 'OFFLINE');
                Navigator.pop(ctx);
              },
            ),
          ],
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
    final isSelected = _filter == keyName;

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

  String _getFilterLabel() {
    return switch (_filter) {
      'ONLINE' => 'Online',
      'OFFLINE' => 'Offline',
      _ => 'Semua',
    };
  }

  Color _getFilterColor() {
    return switch (_filter) {
      'ONLINE' => const Color(0xFF10B981),
      'OFFLINE' => const Color(0xFFEF4444),
      _ => const Color(0xFF00AAE0),
    };
  }

  @override
  Widget build(BuildContext context) {
    final filteredOlts = _olts.where((olt) {
      final status = (olt['status'] ?? 'offline').toString().toLowerCase();
      final isOnline = status == 'online' || status == 'active';
      final name = (olt['name'] ?? '').toString().toLowerCase();
      final vendor = (olt['vendor'] ?? '').toString().toLowerCase();
      final model = (olt['model'] ?? '').toString().toLowerCase();

      final matchesFilter = _filter == 'ALL' ||
          (_filter == 'ONLINE' && isOnline) ||
          (_filter == 'OFFLINE' && !isOnline);

      final matchesSearch = _searchQuery.isEmpty ||
          name.contains(_searchQuery.toLowerCase()) ||
          vendor.contains(_searchQuery.toLowerCase()) ||
          model.contains(_searchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
    }).toList();

    final onlineCount = _olts.where((o) {
      final s = (o['status'] ?? '').toString().toLowerCase();
      return s == 'online' || s == 'active';
    }).length;
    final offlineCount = _olts.length - onlineCount;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'Perangkat OLT',
          style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w800, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: _isLoading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF00AAE0)),
                  )
                : const Icon(Icons.refresh_rounded, color: Color(0xFF64748B)),
            onPressed: _isLoading ? null : _fetchOlts,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          // View Mode Switcher (Daftar OLT vs Virtual Chassis)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: Colors.white,
            child: Container(
              padding: const EdgeInsets.all(3.5),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () => setState(() => _viewMode = 'LIST'),
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          color: _viewMode == 'LIST' ? Colors.white : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: _viewMode == 'LIST'
                              ? [
                                  BoxShadow(
                                    color: const Color(0xFF0F172A).withValues(alpha: 0.06),
                                    blurRadius: 4,
                                    offset: const Offset(0, 1),
                                  )
                                ]
                              : null,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.view_list_rounded,
                              size: 17,
                              color: _viewMode == 'LIST' ? const Color(0xFF00AAE0) : const Color(0xFF64748B),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Daftar OLT',
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: _viewMode == 'LIST' ? FontWeight.w800 : FontWeight.w600,
                                color: _viewMode == 'LIST' ? const Color(0xFF0F172A) : const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: InkWell(
                      onTap: () => setState(() => _viewMode = 'CHASSIS'),
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          color: _viewMode == 'CHASSIS' ? Colors.white : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: _viewMode == 'CHASSIS'
                              ? [
                                  BoxShadow(
                                    color: const Color(0xFF0F172A).withValues(alpha: 0.06),
                                    blurRadius: 4,
                                    offset: const Offset(0, 1),
                                  )
                                ]
                              : null,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.developer_board_rounded,
                              size: 17,
                              color: _viewMode == 'CHASSIS' ? const Color(0xFF00AAE0) : const Color(0xFF64748B),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Virtual Chassis',
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: _viewMode == 'CHASSIS' ? FontWeight.w800 : FontWeight.w600,
                                color: _viewMode == 'CHASSIS' ? const Color(0xFF0F172A) : const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Body View Content
          Expanded(
            child: _viewMode == 'CHASSIS'
                ? _buildVirtualChassisView()
                : _buildListView(filteredOlts, onlineCount, offlineCount),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW MODE 1: DAFTAR KARTU OLT (LIST VIEW)
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildListView(List<dynamic> filteredOlts, int onlineCount, int offlineCount) {
    return Column(
      children: [
        // Compact Search & Filter Bar
        Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          color: Colors.white,
          child: Row(
            children: [
              // Search Input Field
              Expanded(
                child: SizedBox(
                  height: 44,
                  child: TextField(
                    controller: _searchCtrl,
                    onChanged: (val) => setState(() => _searchQuery = val.trim()),
                    style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13.5),
                    decoration: InputDecoration(
                      hintText: 'Cari OLT, Vendor, Model...',
                      hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                      prefixIcon: const Icon(Icons.search, color: Color(0xFF64748B), size: 19),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, color: Color(0xFF64748B), size: 16),
                              onPressed: () {
                                _searchCtrl.clear();
                                setState(() => _searchQuery = '');
                              },
                            )
                          : null,
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 12),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFF00AAE0), width: 1.5),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),

              // Filter Button with Status Badge
              InkWell(
                onTap: () => _showFilterModal(_olts.length, onlineCount, offlineCount),
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  height: 44,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: _filter != 'ALL'
                        ? _getFilterColor().withValues(alpha: 0.12)
                        : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: _filter != 'ALL'
                          ? _getFilterColor()
                          : const Color(0xFFE2E8F0),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.filter_list_rounded,
                        color: _filter != 'ALL'
                            ? _getFilterColor()
                            : const Color(0xFF64748B),
                        size: 18,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        _getFilterLabel(),
                        style: TextStyle(
                          color: _filter != 'ALL'
                              ? _getFilterColor()
                              : const Color(0xFF334155),
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      if (_filter != 'ALL') ...[
                        const SizedBox(width: 6),
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: _getFilterColor(),
                            shape: BoxShape.circle,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const Divider(height: 1, color: Color(0xFFE2E8F0)),

        // OLT Device List
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator(color: Color(0xFF00AAE0)))
              : _errorMessage != null
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 48),
                          const SizedBox(height: 12),
                          Text(_errorMessage!, style: const TextStyle(color: Color(0xFF64748B), fontSize: 13)),
                          const SizedBox(height: 16),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF00AAE0),
                              elevation: 0,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            onPressed: _fetchOlts,
                            child: const Text('Coba Lagi', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _fetchOlts,
                      color: const Color(0xFF00AAE0),
                      backgroundColor: Colors.white,
                      child: filteredOlts.isEmpty
                          ? const Center(
                              child: Text('Tidak ada perangkat OLT ditemukan.', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              itemCount: filteredOlts.length,
                              itemBuilder: (ctx, i) {
                                final olt = filteredOlts[i] is Map ? Map<String, dynamic>.from(filteredOlts[i]) : <String, dynamic>{};
                                final name = olt['name'] ?? 'OLT Device';
                                final vendor = olt['vendor'] ?? 'ZTE/Huawei';
                                final model = olt['model'] ?? '';
                                final status = (olt['status'] ?? 'offline').toString().toLowerCase();
                                final isOnline = status == 'online' || status == 'active';
                                final totalPon = olt['pon_ports_count'] ?? olt['total_ports'] ?? 8;
                                final totalOnus = olt['total_onus_count'] ?? (olt['last_telemetry_snapshot']?['onu_count'] ?? 0);

                                return InkWell(
                                  onTap: () => _showOltDetailModal(olt, i),
                                  borderRadius: BorderRadius.circular(14),
                                  child: Container(
                                    margin: const EdgeInsets.only(bottom: 12),
                                    padding: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(
                                        color: isOnline
                                            ? const Color(0xFFE2E8F0)
                                            : const Color(0xFFFECACA),
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: const Color(0xFF0F172A).withValues(alpha: 0.03),
                                          blurRadius: 8,
                                          offset: const Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Row(
                                              children: [
                                                Container(
                                                  padding: const EdgeInsets.all(10),
                                                  decoration: BoxDecoration(
                                                    color: (isOnline ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2)),
                                                    borderRadius: BorderRadius.circular(10),
                                                  ),
                                                  child: Icon(
                                                    Icons.router_rounded,
                                                    color: isOnline ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                                                    size: 22,
                                                  ),
                                                ),
                                                const SizedBox(width: 12),
                                                Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Text(
                                                      name,
                                                      style: const TextStyle(
                                                        color: Color(0xFF0F172A),
                                                        fontWeight: FontWeight.w800,
                                                        fontSize: 15,
                                                      ),
                                                    ),
                                                    Text(
                                                      '$vendor ${model.isNotEmpty ? "• $model" : ""}',
                                                      style: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                                                    ),
                                                  ],
                                                ),
                                              ],
                                            ),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                                              decoration: BoxDecoration(
                                                color: isOnline ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                                                borderRadius: BorderRadius.circular(20),
                                              ),
                                              child: Row(
                                                children: [
                                                  CircleAvatar(
                                                    radius: 3.5,
                                                    backgroundColor: isOnline ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                                                  ),
                                                  const SizedBox(width: 5),
                                                  Text(
                                                    isOnline ? 'Online' : 'Offline',
                                                    style: TextStyle(
                                                      color: isOnline ? const Color(0xFF15803D) : const Color(0xFFDC2626),
                                                      fontWeight: FontWeight.bold,
                                                      fontSize: 10.5,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 14),
                                        const Divider(color: Color(0xFFF1F5F9), height: 1),
                                        const SizedBox(height: 12),
                                        Row(
                                          children: [
                                            Expanded(
                                              child: _buildInfoItem(
                                                icon: Icons.language,
                                                label: 'IP Address',
                                                value: _maskIp(''),
                                              ),
                                            ),
                                            Expanded(
                                              child: _buildInfoItem(
                                                icon: Icons.settings_ethernet,
                                                label: 'Port PON',
                                                value: '$totalPon Port',
                                              ),
                                            ),
                                            Expanded(
                                              child: _buildInfoItem(
                                                icon: Icons.devices_other_rounded,
                                                label: 'Total ONU',
                                                value: '$totalOnus Unit',
                                              ),
                                            ),
                                          ],
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
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW MODE 2: VIRTUAL CHASSIS RACK VIEW (HARDWARE VISUALIZATION)
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildVirtualChassisView() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF00AAE0)));
    }

    if (_olts.isEmpty) {
      return const Center(
        child: Text('Tidak ada perangkat OLT aktif untuk ditampilkan.', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
      );
    }

    final activeOlt = _olts[_selectedOltIndex] is Map
        ? Map<String, dynamic>.from(_olts[_selectedOltIndex])
        : <String, dynamic>{};
    final oltName = activeOlt['name'] ?? 'OLT Device';
    final vendor = (activeOlt['vendor'] ?? 'ZTE').toString();
    final model = (activeOlt['model'] ?? 'ZXAN C300').toString();
    final totalPorts = activeOlt['pon_ports_count'] ?? activeOlt['total_ports'] ?? 16;
    final totalOnus = activeOlt['total_onus_count'] ?? 0;
    final status = (activeOlt['status'] ?? 'offline').toString().toLowerCase();
    final isOnline = status == 'online' || status == 'active';

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Selector Perangkat OLT
          if (_olts.length > 1) ...[
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: List.generate(_olts.length, (idx) {
                  final o = _olts[idx];
                  final isSelected = idx == _selectedOltIndex;
                  return InkWell(
                    onTap: () {
                      setState(() {
                        _selectedOltIndex = idx;
                        _selectedPortId = null;
                        _selectedPortData = null;
                      });
                    },
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFF00AAE0) : Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isSelected ? const Color(0xFF00AAE0) : const Color(0xFFE2E8F0),
                        ),
                      ),
                      child: Text(
                        o['name'] ?? 'OLT #${idx + 1}',
                        style: TextStyle(
                          color: isSelected ? Colors.white : const Color(0xFF475569),
                          fontSize: 12,
                          fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),
            const SizedBox(height: 14),
          ],

          // Chassis Header Info
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: isOnline ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    Icons.developer_board_rounded,
                    color: isOnline ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                    size: 20,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        oltName,
                        style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w800, fontSize: 14),
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        '$vendor • $model · $totalPorts Port PON',
                        style: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isOnline ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    isOnline ? 'CHASSIS ONLINE' : 'CHASSIS OFFLINE',
                    style: TextStyle(
                      color: isOnline ? const Color(0xFF15803D) : const Color(0xFFDC2626),
                      fontWeight: FontWeight.w800,
                      fontSize: 10,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // ═══════════════════════════════════════════════════════════════════
          // REALISTIC CHASSIS RACK HARDWARE PANEL
          // ═══════════════════════════════════════════════════════════════════
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFF334155), width: 2),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.25),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Metallic Chassis Bezel & Screws
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: const BoxDecoration(
                    color: Color(0xFF1E293B),
                    borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
                    border: Border(bottom: BorderSide(color: Color(0xFF334155))),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          // Rack Screw
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: const Color(0xFF475569),
                              border: Border.all(color: const Color(0xFF94A3B8), width: 0.5),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '$vendor $model CHASSIS',
                            style: const TextStyle(
                              color: Color(0xFFE2E8F0),
                              fontWeight: FontWeight.w900,
                              fontSize: 11,
                              letterSpacing: 1.2,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                      // System LEDs (PWR, RUN, FAN, ALM)
                      Row(
                        children: [
                          _buildLedIndicator('PWR', isOnline ? const Color(0xFF10B981) : const Color(0xFFEF4444)),
                          const SizedBox(width: 8),
                          _buildLedIndicator('RUN', isOnline ? const Color(0xFF10B981) : const Color(0xFF64748B)),
                          const SizedBox(width: 8),
                          _buildLedIndicator('FAN', const Color(0xFF10B981)),
                          const SizedBox(width: 8),
                          _buildLedIndicator('ALM', const Color(0xFF334155)),
                          const SizedBox(width: 8),
                          // Right Rack Screw
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: const Color(0xFF475569),
                              border: Border.all(color: const Color(0xFF94A3B8), width: 0.5),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Control & Uplink Unit Strip
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: const BoxDecoration(
                    color: Color(0xFF131D2E),
                    border: Border(bottom: BorderSide(color: Color(0xFF1E293B))),
                  ),
                  child: Row(
                    children: [
                      // MPU/SCXN Control Board Module
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFF334155)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.memory_rounded, color: Color(0xFF00AAE0), size: 14),
                            SizedBox(width: 4),
                            Text('SCXN/MPU CTRL', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 9.5, fontWeight: FontWeight.bold, fontFamily: 'monospace')),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      // Uplink 10GE Ports
                      Expanded(
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            const Text('UPLINK 10GE: ', style: TextStyle(color: Color(0xFF64748B), fontSize: 9, fontWeight: FontWeight.bold, fontFamily: 'monospace')),
                            const SizedBox(width: 4),
                            _buildMiniPort('X1', true),
                            const SizedBox(width: 4),
                            _buildMiniPort('X2', true),
                            const SizedBox(width: 4),
                            _buildMiniPort('X3', false),
                            const SizedBox(width: 4),
                            _buildMiniPort('X4', false),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // PON SFP Port Cages Grid
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'SERVICE CARD: GTGH 16-PORT PON',
                            style: TextStyle(
                              color: Color(0xFF94A3B8),
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.8,
                              fontFamily: 'monospace',
                            ),
                          ),
                          Text(
                            'Sentuh port untuk detail',
                            style: TextStyle(color: Color(0xFF64748B), fontSize: 10),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),

                      // Grid Port PON
                      GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 4,
                          mainAxisSpacing: 8,
                          crossAxisSpacing: 8,
                          childAspectRatio: 1.15,
                        ),
                        itemCount: totalPorts,
                        itemBuilder: (ctx, idx) {
                          final portNum = idx + 1;
                          final portId = 'gpon-olt_1/1/$portNum';
                          final isSelected = _selectedPortId == portId;
                          final isPortActive = isOnline && (idx < 12); // Active ports simulation or status
                          final portOnus = (idx == 0) ? totalOnus : 0;

                          return InkWell(
                            onTap: () {
                              setState(() {
                                _selectedPortId = portId;
                                _selectedPortData = {
                                  'port_num': portNum,
                                  'port_id': portId,
                                  'status': isPortActive ? 'Up' : 'Down',
                                  'tx_power': isPortActive ? '+5.50 dBm' : '—',
                                  'registered_onus': portOnus,
                                  'online_onus': isPortActive ? portOnus : 0,
                                  'sfp_class': 'Class C+ (2.5G/1.25G)',
                                };
                              });
                            },
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? const Color(0xFF00AAE0).withValues(alpha: 0.25)
                                    : const Color(0xFF1E293B),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: isSelected
                                      ? const Color(0xFF00AAE0)
                                      : (isPortActive ? const Color(0xFF334155) : const Color(0xFF1E293B)),
                                  width: isSelected ? 2 : 1,
                                ),
                              ),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  // Laser Status Dot & Port Number
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      CircleAvatar(
                                        radius: 3,
                                        backgroundColor: isPortActive
                                            ? const Color(0xFF10B981)
                                            : const Color(0xFFEF4444),
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        'PON $portNum',
                                        style: TextStyle(
                                          color: isSelected ? Colors.white : const Color(0xFFE2E8F0),
                                          fontSize: 10,
                                          fontWeight: FontWeight.w800,
                                          fontFamily: 'monospace',
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  // Realistic Optical SFP Cage Cutout
                                  Container(
                                    width: 32,
                                    height: 14,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF0B1120),
                                      borderRadius: BorderRadius.circular(3),
                                      border: Border.all(
                                        color: isPortActive ? const Color(0xFF10B981).withValues(alpha: 0.5) : const Color(0xFF475569),
                                        width: 0.8,
                                      ),
                                    ),
                                    child: Center(
                                      child: Container(
                                        width: 14,
                                        height: 5,
                                        decoration: BoxDecoration(
                                          color: isPortActive ? const Color(0xFF10B981) : const Color(0xFF334155),
                                          borderRadius: BorderRadius.circular(1),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ═══════════════════════════════════════════════════════════════════
          // SELECTED PORT TELEMETRY CARD
          // ═══════════════════════════════════════════════════════════════════
          if (_selectedPortData != null) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFF00AAE0)),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF00AAE0).withValues(alpha: 0.08),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE0F2FE),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(Icons.settings_input_composite_rounded, color: Color(0xFF00AAE0), size: 18),
                          ),
                          const SizedBox(width: 10),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'PON Port ${_selectedPortData!['port_num']} (${_selectedPortData!['port_id']})',
                                style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w800, fontSize: 14),
                              ),
                              Text(
                                _selectedPortData!['sfp_class'] ?? 'Class C+',
                                style: const TextStyle(color: Color(0xFF64748B), fontSize: 11.5),
                              ),
                            ],
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded, color: Color(0xFF94A3B8), size: 18),
                        onPressed: () => setState(() {
                          _selectedPortId = null;
                          _selectedPortData = null;
                        }),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Divider(color: Color(0xFFF1F5F9), height: 1),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _buildInfoItem(
                          icon: Icons.power_rounded,
                          label: 'Tx Power Laser',
                          value: _selectedPortData!['tx_power'] ?? '+5.50 dBm',
                        ),
                      ),
                      Expanded(
                        child: _buildInfoItem(
                          icon: Icons.devices_other_rounded,
                          label: 'Registered ONU',
                          value: '${_selectedPortData!['registered_onus']} Pelanggan',
                        ),
                      ),
                      Expanded(
                        child: _buildInfoItem(
                          icon: Icons.check_circle_outline_rounded,
                          label: 'Online ONU',
                          value: '${_selectedPortData!['online_onus']} Unit',
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ] else ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.touch_app_rounded, color: Color(0xFF00AAE0), size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Pilih salah satu Port PON pada gambar chassis di atas untuk melihat status laser & telemetri port fisik.',
                      style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildLedIndicator(String label, Color color) {
    return Row(
      children: [
        CircleAvatar(radius: 3, backgroundColor: color),
        const SizedBox(width: 3),
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFF94A3B8),
            fontSize: 8.5,
            fontWeight: FontWeight.bold,
            fontFamily: 'monospace',
          ),
        ),
      ],
    );
  }

  Widget _buildMiniPort(String label, bool isUp) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(3),
        border: Border.all(color: isUp ? const Color(0xFF10B981) : const Color(0xFF475569), width: 0.8),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: isUp ? const Color(0xFF10B981) : const Color(0xFF64748B),
          fontSize: 8,
          fontWeight: FontWeight.bold,
          fontFamily: 'monospace',
        ),
      ),
    );
  }

  Widget _buildInfoItem({required IconData icon, required String label, required String value}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, color: const Color(0xFF94A3B8), size: 12),
            const SizedBox(width: 4),
            Text(label, style: const TextStyle(color: Color(0xFF64748B), fontSize: 11, fontWeight: FontWeight.w500)),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w700, fontSize: 12.5),
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}
