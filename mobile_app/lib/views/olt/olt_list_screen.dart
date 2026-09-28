import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../../core/constants/api_constants.dart';
import '../../core/constants/app_colors.dart';
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
      if (response.data != null) {
        final rawData = response.data is List
            ? response.data
            : (response.data['data'] is List ? response.data['data'] : []);
        setState(() {
          _olts = rawData;
          _isLoading = false;
        });
      }
    } on DioException catch (e) {
      setState(() {
        _errorMessage = e.response?.data?['message'] ?? 'Gagal memuat data OLT.';
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Terjadi kesalahan: $e';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final filteredOlts = _olts.where((olt) {
      final status = (olt['status'] ?? 'offline').toString().toLowerCase();
      final isOnline = status == 'online' || status == 'active';
      final name = (olt['name'] ?? '').toString().toLowerCase();
      final ip = (olt['ip_address'] ?? '').toString().toLowerCase();
      final vendor = (olt['vendor'] ?? '').toString().toLowerCase();

      final matchesFilter = _filter == 'ALL' ||
          (_filter == 'ONLINE' && isOnline) ||
          (_filter == 'OFFLINE' && !isOnline);

      final matchesSearch = _searchQuery.isEmpty ||
          name.contains(_searchQuery.toLowerCase()) ||
          ip.contains(_searchQuery.toLowerCase()) ||
          vendor.contains(_searchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
    }).toList();

    final onlineCount = _olts.where((o) {
      final s = (o['status'] ?? '').toString().toLowerCase();
      return s == 'online' || s == 'active';
    }).length;
    final offlineCount = _olts.length - onlineCount;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: const Text(
          'Perangkat OLT',
          style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: _fetchOlts,
          ),
        ],
      ),
      body: Column(
        children: [
          // Counter Status Strip
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: AppColors.surface,
            child: Row(
              children: [
                Expanded(
                  child: _buildFilterTab(
                    label: 'Online',
                    count: onlineCount,
                    color: AppColors.success,
                    isActive: _filter == 'ONLINE',
                    onTap: () => setState(() => _filter = _filter == 'ONLINE' ? 'ALL' : 'ONLINE'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildFilterTab(
                    label: 'Offline',
                    count: offlineCount,
                    color: AppColors.danger,
                    isActive: _filter == 'OFFLINE',
                    onTap: () => setState(() => _filter = _filter == 'OFFLINE' ? 'ALL' : 'OFFLINE'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildFilterTab(
                    label: 'Total OLT',
                    count: _olts.length,
                    color: AppColors.primary,
                    isActive: _filter == 'ALL',
                    onTap: () => setState(() => _filter = 'ALL'),
                  ),
                ),
              ],
            ),
          ),

          // Search Field
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (val) => setState(() => _searchQuery = val.trim()),
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Cari nama OLT, IP Address, Vendor...',
                hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                prefixIcon: const Icon(Icons.search, color: AppColors.textSecondary, size: 20),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, color: AppColors.textSecondary, size: 18),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                filled: true,
                fillColor: AppColors.surface,
                contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
            ),
          ),

          // OLT Device List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _errorMessage != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.error_outline, color: AppColors.danger, size: 48),
                            const SizedBox(height: 12),
                            Text(_errorMessage!, style: const TextStyle(color: AppColors.textSecondary)),
                            const SizedBox(height: 16),
                            ElevatedButton(
                              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                              onPressed: _fetchOlts,
                              child: const Text('Coba Lagi', style: TextStyle(color: Colors.white)),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _fetchOlts,
                        color: AppColors.primary,
                        backgroundColor: AppColors.surface,
                        child: filteredOlts.isEmpty
                            ? const Center(
                                child: Text('Tidak ada perangkat OLT ditemukan.', style: TextStyle(color: AppColors.textMuted)),
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.all(16),
                                itemCount: filteredOlts.length,
                                itemBuilder: (ctx, i) {
                                  final olt = filteredOlts[i];
                                  final name = olt['name'] ?? 'OLT Device';
                                  final ip = olt['ip_address'] ?? '-';
                                  final vendor = olt['vendor'] ?? 'ZTE/Huawei';
                                  final model = olt['model'] ?? '';
                                  final status = (olt['status'] ?? 'offline').toString().toLowerCase();
                                  final isOnline = status == 'online' || status == 'active';
                                  final totalPon = olt['pon_ports_count'] ?? olt['total_ports'] ?? 8;
                                  final totalOnus = olt['total_onus_count'] ?? (olt['last_telemetry_snapshot']?['onu_count'] ?? 0);

                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 14),
                                    padding: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      color: AppColors.surface,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(
                                        color: isOnline
                                            ? AppColors.success.withValues(alpha: 0.3)
                                            : AppColors.danger.withValues(alpha: 0.3),
                                      ),
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
                                                    color: (isOnline ? AppColors.success : AppColors.danger).withValues(alpha: 0.15),
                                                    borderRadius: BorderRadius.circular(8),
                                                  ),
                                                  child: Icon(
                                                    Icons.router_rounded,
                                                    color: isOnline ? AppColors.success : AppColors.danger,
                                                    size: 22,
                                                  ),
                                                ),
                                                const SizedBox(width: 10),
                                                Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Text(
                                                      name,
                                                      style: const TextStyle(
                                                        color: AppColors.textPrimary,
                                                        fontWeight: FontWeight.bold,
                                                        fontSize: 15,
                                                      ),
                                                    ),
                                                    Text(
                                                      '$vendor ${model.isNotEmpty ? "• $model" : ""}',
                                                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                                                    ),
                                                  ],
                                                ),
                                              ],
                                            ),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                              decoration: BoxDecoration(
                                                color: (isOnline ? AppColors.success : AppColors.danger).withValues(alpha: 0.15),
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: Row(
                                                children: [
                                                  CircleAvatar(
                                                    radius: 3.5,
                                                    backgroundColor: isOnline ? AppColors.success : AppColors.danger,
                                                  ),
                                                  const SizedBox(width: 5),
                                                  Text(
                                                    isOnline ? 'Online' : 'Offline',
                                                    style: TextStyle(
                                                      color: isOnline ? AppColors.success : AppColors.danger,
                                                      fontWeight: FontWeight.bold,
                                                      fontSize: 11,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 14),
                                        const Divider(color: AppColors.surfaceBorder, height: 1),
                                        const SizedBox(height: 12),
                                        Row(
                                          children: [
                                            Expanded(
                                              child: _buildInfoItem(
                                                icon: Icons.language,
                                                label: 'IP Address',
                                                value: ip,
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
                                                icon: Icons.devices,
                                                label: 'Total ONU',
                                                value: '$totalOnus Unit',
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
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

  Widget _buildFilterTab({
    required String label,
    required int count,
    required Color color,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? color.withValues(alpha: 0.2) : AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: isActive ? color : AppColors.surfaceBorder),
        ),
        child: Column(
          children: [
            Text(
              '$count',
              style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 16),
            ),
            Text(
              label,
              style: TextStyle(color: isActive ? AppColors.textPrimary : AppColors.textSecondary, fontSize: 11),
            ),
          ],
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
            Icon(icon, color: AppColors.textMuted, size: 12),
            const SizedBox(width: 4),
            Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 12),
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}
