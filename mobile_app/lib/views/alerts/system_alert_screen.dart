import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/dashboard_provider.dart';

class SystemAlertScreen extends StatefulWidget {
  const SystemAlertScreen({super.key});

  @override
  State<SystemAlertScreen> createState() => _SystemAlertScreenState();
}

class _SystemAlertScreenState extends State<SystemAlertScreen> {
  String _selectedSeverity = 'ALL'; // 'ALL', 'CRITICAL', 'WARNING', 'INFO'
  String _searchQuery = '';
  final TextEditingController _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<DashboardProvider>(context, listen: false).fetchDashboardData();
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dashboard = Provider.of<DashboardProvider>(context);
    final rawAlerts = dashboard.systemAlerts;

    final filteredAlerts = rawAlerts.where((alert) {
      final sev = (alert['severity'] ?? 'INFO').toString().toUpperCase();
      final title = (alert['title'] ?? alert['message'] ?? alert['description'] ?? '').toString().toLowerCase();
      final node = (alert['node'] ?? '').toString().toLowerCase();

      final matchesSeverity = _selectedSeverity == 'ALL' ||
          (_selectedSeverity == 'CRITICAL' && (sev == 'CRITICAL' || sev == 'HIGH' || sev == 'DANGER')) ||
          (_selectedSeverity == 'WARNING' && (sev == 'WARNING' || sev == 'WARN')) ||
          (_selectedSeverity == 'INFO' && (sev == 'INFO' || sev == 'LOW'));

      final matchesSearch = _searchQuery.isEmpty ||
          title.contains(_searchQuery.toLowerCase()) ||
          node.contains(_searchQuery.toLowerCase());

      return matchesSeverity && matchesSearch;
    }).toList();

    final criticalCount = rawAlerts.where((a) {
      final s = (a['severity'] ?? '').toString().toUpperCase();
      return s == 'CRITICAL' || s == 'HIGH' || s == 'DANGER';
    }).length;

    final warningCount = rawAlerts.where((a) {
      final s = (a['severity'] ?? '').toString().toUpperCase();
      return s == 'WARNING' || s == 'WARN';
    }).length;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: const Text(
          'Alert Sistem & Insiden',
          style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: () => dashboard.fetchDashboardData(),
          ),
        ],
      ),
      body: Column(
        children: [
          // KPI Counter Strip
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: AppColors.surface,
            child: Row(
              children: [
                Expanded(
                  child: _buildSeverityCounter(
                    label: 'Kritis',
                    count: criticalCount,
                    color: AppColors.danger,
                    isActive: _selectedSeverity == 'CRITICAL',
                    onTap: () => setState(() => _selectedSeverity = _selectedSeverity == 'CRITICAL' ? 'ALL' : 'CRITICAL'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildSeverityCounter(
                    label: 'Warning',
                    count: warningCount,
                    color: AppColors.warning,
                    isActive: _selectedSeverity == 'WARNING',
                    onTap: () => setState(() => _selectedSeverity = _selectedSeverity == 'WARNING' ? 'ALL' : 'WARNING'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildSeverityCounter(
                    label: 'Semua',
                    count: rawAlerts.length,
                    color: AppColors.primary,
                    isActive: _selectedSeverity == 'ALL',
                    onTap: () => setState(() => _selectedSeverity = 'ALL'),
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
                hintText: 'Cari alert insiden, node ODP, OLT...',
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

          // Alert List
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => dashboard.fetchDashboardData(),
              color: AppColors.primary,
              backgroundColor: AppColors.surface,
              child: filteredAlerts.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle_outline, color: AppColors.success.withValues(alpha: 0.6), size: 54),
                          const SizedBox(height: 12),
                          const Text(
                            'Tidak Ada Alert Aktif',
                            style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 16),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Seluruh parameter jaringan dan OLT terpantau normal.',
                            style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: filteredAlerts.length,
                      itemBuilder: (ctx, i) {
                        final alert = filteredAlerts[i];
                        final sev = (alert['severity'] ?? 'INFO').toString().toUpperCase();
                        final isCrit = sev == 'CRITICAL' || sev == 'HIGH' || sev == 'DANGER';
                        final isWarn = sev == 'WARNING' || sev == 'WARN';
                        final color = isCrit ? AppColors.danger : (isWarn ? AppColors.warning : AppColors.info);

                        final title = alert['title'] ?? alert['message'] ?? alert['description'] ?? 'Alert Jaringan';
                        final desc = alert['description'] ?? '';
                        final time = alert['time'] ?? alert['created_at'] ?? 'Baru saja';
                        final node = alert['node'] ?? alert['olt'] ?? '';

                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isCrit ? AppColors.danger.withValues(alpha: 0.4) : AppColors.surfaceBorder,
                              width: isCrit ? 1.5 : 1,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: color.withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Icon(
                                      isCrit ? Icons.error_outline : (isWarn ? Icons.warning_amber_rounded : Icons.info_outline),
                                      color: color,
                                      size: 20,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: color.withValues(alpha: 0.2),
                                                borderRadius: BorderRadius.circular(4),
                                              ),
                                              child: Text(
                                                sev,
                                                style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold),
                                              ),
                                            ),
                                            Text(
                                              time,
                                              style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          title,
                                          style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              if (desc.isNotEmpty && desc != title) ...[
                                const SizedBox(height: 8),
                                Text(
                                  desc,
                                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                                ),
                              ],
                              if (node.isNotEmpty) ...[
                                const SizedBox(height: 10),
                                Row(
                                  children: [
                                    const Icon(Icons.hub_outlined, color: AppColors.textMuted, size: 14),
                                    const SizedBox(width: 4),
                                    Text(
                                      node,
                                      style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                                    ),
                                  ],
                                ),
                              ],
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

  Widget _buildSeverityCounter({
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
}
