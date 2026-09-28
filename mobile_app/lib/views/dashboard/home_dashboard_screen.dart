import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../../providers/dashboard_provider.dart';
import '../alerts/system_alert_screen.dart';
import '../olt/olt_list_screen.dart';
import '../infrastructure/nodes_list_screen.dart';
import '../gis/gis_map_screen.dart';
import '../customers/customer_list_screen.dart';
import '../tickets/ticket_list_screen.dart';
import '../odp/odp_form_screen.dart';
import '../ont/ont_scan_screen.dart';

class HomeDashboardScreen extends StatefulWidget {
  const HomeDashboardScreen({super.key});

  @override
  State<HomeDashboardScreen> createState() => _HomeDashboardScreenState();
}

class _HomeDashboardScreenState extends State<HomeDashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<DashboardProvider>(context, listen: false).fetchDashboardData();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final dashboard = Provider.of<DashboardProvider>(context);
    final user = auth.currentUser;

    final overview = (dashboard.metrics?['overview'] is Map) ? dashboard.metrics!['overview'] as Map : {};
    final customerStats = (dashboard.metrics?['customer_stats'] is Map) ? dashboard.metrics!['customer_stats'] as Map : {};
    final onuHealth = (dashboard.metrics?['onu_health'] is Map) ? dashboard.metrics!['onu_health'] as Map : {};
    final regionalInfra = (dashboard.metrics?['regional_infrastructure'] is List)
        ? dashboard.metrics!['regional_infrastructure'] as List
        : [];

    // Pelanggan Metrics
    final totalCustomers = customerStats['total_customers'] ?? onuHealth['total_registered'] ?? 0;
    final onlineCustomers = customerStats['active_customers'] ?? onuHealth['online_count'] ?? 0;
    final offlineCustomers = customerStats['offline_customers'] ?? onuHealth['offline_count'] ?? (totalCustomers - onlineCustomers);

    // OLT Metrics
    final totalOlts = overview['total_olts'] ?? regionalInfra.length;
    int oltOnline = 0;
    int oltOffline = 0;
    if (regionalInfra.isNotEmpty) {
      for (final r in regionalInfra) {
        final st = (r['status'] ?? '').toString().toLowerCase();
        if (st == 'online' || st == 'active') {
          oltOnline++;
        } else {
          oltOffline++;
        }
      }
    } else {
      oltOnline = totalOlts;
    }

    // Tickets Metrics
    final activeTickets = overview['active_tickets'] ?? 0;
    final criticalTickets = overview['critical_tickets'] ?? 0;
    final inProgressTickets = overview['in_progress_tickets'] ?? 0;
    final totalTickets = overview['total_tickets'] ?? activeTickets;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: Row(
          children: [
            const Icon(Icons.fiber_pin_rounded, color: AppColors.primary, size: 28),
            const SizedBox(width: 8),
            const Text(
              'Fiber-UNMS',
              style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: () => dashboard.fetchDashboardData(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => dashboard.fetchDashboardData(),
        color: AppColors.primary,
        backgroundColor: AppColors.surface,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // User Greeting Banner
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.surfaceBorder),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: AppColors.primary.withValues(alpha: 0.2),
                      child: Text(
                        (user?.name.isNotEmpty ?? false) ? user!.name[0].toUpperCase() : 'U',
                        style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 18),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            user?.name ?? 'Pengguna',
                            style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '${user?.role ?? 'User'} • ${user?.division ?? 'Fiber Operations'}',
                              style: const TextStyle(color: AppColors.primaryLight, fontSize: 11, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // ── 1. STATUS PELANGGAN (Online / Offline) ──
              _buildSectionHeader(
                title: 'Pelanggan',
                actionLabel: 'Lihat Semua',
                onAction: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CustomerListScreen())),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.surfaceBorder),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const CustomerListScreen(initialFilter: 'ONLINE')),
                            ),
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppColors.success.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
                              ),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    radius: 18,
                                    backgroundColor: AppColors.success.withValues(alpha: 0.2),
                                    child: const Icon(Icons.wifi, color: AppColors.success, size: 18),
                                  ),
                                  const SizedBox(width: 10),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '$onlineCustomers',
                                        style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.bold, fontSize: 20),
                                      ),
                                      const Text('Online', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: InkWell(
                            onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const CustomerListScreen(initialFilter: 'OFFLINE')),
                            ),
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppColors.danger.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
                              ),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    radius: 18,
                                    backgroundColor: AppColors.danger.withValues(alpha: 0.2),
                                    child: const Icon(Icons.wifi_off, color: AppColors.danger, size: 18),
                                  ),
                                  const SizedBox(width: 10),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '$offlineCustomers',
                                        style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.bold, fontSize: 20),
                                      ),
                                      const Text('Offline', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Total Pelanggan Terdaftar: $totalCustomers', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                        Text(
                          totalCustomers > 0 ? '${((onlineCustomers / totalCustomers) * 100).toStringAsFixed(1)}% Online' : '100% Online',
                          style: const TextStyle(color: AppColors.primaryLight, fontSize: 12, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),

              // ── 2. STATUS PERANGKAT OLT (Online / Offline) ──
              _buildSectionHeader(
                title: 'Perangkat OLT',
                actionLabel: 'Lihat Semua',
                onAction: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OltListScreen())),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.surfaceBorder),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLight,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 18,
                              backgroundColor: AppColors.success.withValues(alpha: 0.2),
                              child: const Icon(Icons.router_rounded, color: AppColors.success, size: 18),
                            ),
                            const SizedBox(width: 10),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '$oltOnline',
                                  style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.bold, fontSize: 20),
                                ),
                                const Text('Online', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLight,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 18,
                              backgroundColor: AppColors.danger.withValues(alpha: 0.2),
                              child: const Icon(Icons.router_outlined, color: AppColors.danger, size: 18),
                            ),
                            const SizedBox(width: 10),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '$oltOffline',
                                  style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.bold, fontSize: 20),
                                ),
                                const Text('Offline', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),

              // ── 3. TICKETS & GANGGUAN ──
              _buildSectionHeader(
                title: 'Tickets & Gangguan',
                actionLabel: 'Kelola Tiket',
                onAction: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const TicketListScreen())),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.surfaceBorder),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: _buildTicketStatItem(
                        title: 'Aktif',
                        value: '$activeTickets',
                        color: AppColors.warning,
                        icon: Icons.confirmation_number_outlined,
                      ),
                    ),
                    Container(height: 36, width: 1, color: AppColors.surfaceBorder),
                    Expanded(
                      child: _buildTicketStatItem(
                        title: 'Kritis',
                        value: '$criticalTickets',
                        color: AppColors.danger,
                        icon: Icons.warning_amber_rounded,
                      ),
                    ),
                    Container(height: 36, width: 1, color: AppColors.surfaceBorder),
                    Expanded(
                      child: _buildTicketStatItem(
                        title: 'In Progress',
                        value: '$inProgressTickets',
                        color: AppColors.secondary,
                        icon: Icons.pending_actions,
                      ),
                    ),
                    Container(height: 36, width: 1, color: AppColors.surfaceBorder),
                    Expanded(
                      child: _buildTicketStatItem(
                        title: 'Total',
                        value: '$totalTickets',
                        color: AppColors.primary,
                        icon: Icons.assignment_outlined,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),

              // ── 4. PILIHAN MENU (Grid Navigasi Fitur) ──
              const Text(
                'Pilihan Menu',
                style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 3,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 0.95,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _buildMenuCard(
                    icon: Icons.notifications_active_outlined,
                    label: 'Alert Sistem',
                    badge: dashboard.systemAlerts.isNotEmpty ? '${dashboard.systemAlerts.length}' : null,
                    badgeColor: AppColors.danger,
                    color: AppColors.danger,
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SystemAlertScreen())),
                  ),
                  _buildMenuCard(
                    icon: Icons.router_rounded,
                    label: 'OLT',
                    badge: '$totalOlts',
                    badgeColor: AppColors.secondary,
                    color: AppColors.secondary,
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OltListScreen())),
                  ),
                  _buildMenuCard(
                    icon: Icons.account_tree_rounded,
                    label: 'Data ODP, ODC, POP',
                    badge: '${overview['total_odp'] ?? 0}',
                    badgeColor: AppColors.warning,
                    color: AppColors.warning,
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NodesListScreen())),
                  ),
                  _buildMenuCard(
                    icon: Icons.map_rounded,
                    label: 'Peta Sebaran',
                    color: AppColors.accent,
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GisMapScreen())),
                  ),
                  _buildMenuCard(
                    icon: Icons.people_alt_rounded,
                    label: 'Pelanggan',
                    badge: '$totalCustomers',
                    badgeColor: AppColors.primary,
                    color: AppColors.primary,
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CustomerListScreen())),
                  ),
                  _buildMenuCard(
                    icon: Icons.confirmation_number_rounded,
                    label: 'Tickets',
                    badge: activeTickets > 0 ? '$activeTickets' : null,
                    badgeColor: AppColors.warning,
                    color: AppColors.warning,
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const TicketListScreen())),
                  ),
                  _buildMenuCard(
                    icon: Icons.speed_rounded,
                    label: 'Ukur ODP',
                    color: AppColors.primary,
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OdpFormScreen())),
                  ),
                  _buildMenuCard(
                    icon: Icons.qr_code_scanner_rounded,
                    label: 'Scan ONU',
                    color: AppColors.secondary,
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OntScanScreen())),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // ── 5. ALERT JARINGAN TERKINI ──
              _buildSectionHeader(
                title: 'Alert Jaringan Terkini',
                actionLabel: 'Semua (${dashboard.systemAlerts.length})',
                onAction: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SystemAlertScreen())),
              ),
              const SizedBox(height: 10),
              if (dashboard.systemAlerts.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.surfaceBorder),
                  ),
                  child: const Center(
                    child: Text(
                      'Tidak ada alert gangguan kritis saat ini.',
                      style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                    ),
                  ),
                )
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: dashboard.systemAlerts.take(4).length,
                  itemBuilder: (ctx, i) {
                    final alert = dashboard.systemAlerts[i];
                    final sev = alert['severity']?.toString().toUpperCase() ?? '';
                    final isCritical = sev == 'CRITICAL' || sev == 'HIGH' || sev == 'DANGER';
                    final title = alert['title'] ?? alert['message'] ?? alert['description'] ?? 'Alert Jaringan';
                    final time = alert['time'] ?? alert['created_at'] ?? '';

                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isCritical
                              ? AppColors.danger.withValues(alpha: 0.5)
                              : AppColors.surfaceBorder,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            isCritical ? Icons.error_outline : Icons.warning_amber_rounded,
                            color: isCritical ? AppColors.danger : AppColors.warning,
                            size: 20,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  title,
                                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                if (time.isNotEmpty)
                                  Text(
                                    time,
                                    style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader({
    required String title,
    required String actionLabel,
    required VoidCallback onAction,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 16),
        ),
        TextButton(
          style: TextButton.styleFrom(
            padding: EdgeInsets.zero,
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          onPressed: onAction,
          child: Text(
            actionLabel,
            style: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }

  Widget _buildTicketStatItem({
    required String title,
    required String value,
    required Color color,
    required IconData icon,
  }) {
    return Column(
      children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 17),
        ),
        Text(
          title,
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
        ),
      ],
    );
  }

  Widget _buildMenuCard({
    required IconData icon,
    required String label,
    required Color color,
    String? badge,
    Color? badgeColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.surfaceBorder),
        ),
        child: Stack(
          children: [
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(9),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, color: color, size: 24),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    label,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w600,
                      fontSize: 11,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (badge != null)
              Positioned(
                top: 0,
                right: 0,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(
                    color: badgeColor ?? color,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    badge,
                    style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
