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
    final customerOnlinePct = totalCustomers > 0 ? ((onlineCustomers / totalCustomers) * 100) : 100.0;

    // OLT Metrics
    final totalOlts = overview['total_olts'] ?? regionalInfra.length;

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
        titleSpacing: 16,
        title: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.surfaceBorder),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              child: ClipOval(
                child: Image.asset(
                  'assets/images/fona_logo.png',
                  fit: BoxFit.contain,
                  errorBuilder: (ctx, err, stack) => const Icon(
                    Icons.hub_rounded,
                    color: AppColors.primary,
                    size: 18,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    const Text(
                      'FONA',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'MOBILE',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.bold,
                          fontSize: 10,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ],
                ),
                const Text(
                  'Fiber Optic Network Analysis',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 9.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Stack(
              children: [
                const Icon(Icons.notifications_outlined, color: AppColors.textPrimary, size: 24),
                if (dashboard.systemAlerts.isNotEmpty)
                  Positioned(
                    top: 0,
                    right: 0,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: const BoxDecoration(
                        color: AppColors.danger,
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(minWidth: 8, minHeight: 8),
                    ),
                  ),
              ],
            ),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SystemAlertScreen())),
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppColors.textSecondary, size: 22),
            onPressed: () => dashboard.fetchDashboardData(),
          ),
          const SizedBox(width: 8),
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
              // ── HERO GREETING BANNER (PLN Mobile Style) ──
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF00A3C4), Color(0xFF0284C7)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: AppColors.elevatedShadow,
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 26,
                      backgroundColor: Colors.white,
                      child: Text(
                        (user?.name.isNotEmpty ?? false) ? user!.name[0].toUpperCase() : 'U',
                        style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 20),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                'Hai, ${user?.name ?? 'Sobat FONA'}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                              const SizedBox(width: 4),
                              const Text('👋', style: TextStyle(fontSize: 14)),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '${user?.role ?? 'Teknisi'} • ${user?.division ?? 'Operasional Fiber'}',
                              style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.25),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Row(
                        children: [
                          CircleAvatar(radius: 3.5, backgroundColor: Color(0xFF4ADE80)),
                          SizedBox(width: 5),
                          Text('Online', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // ── 1. STATUS PELANGGAN ──
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
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.surfaceBorder),
                  boxShadow: AppColors.cardShadow,
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
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: AppColors.successLight,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: AppColors.success.withValues(alpha: 0.2)),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: AppColors.success.withValues(alpha: 0.15),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(Icons.wifi_rounded, color: AppColors.success, size: 20),
                                  ),
                                  const SizedBox(width: 10),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '$onlineCustomers',
                                        style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w900, fontSize: 22),
                                      ),
                                      const Text('Online', style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w500)),
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
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: AppColors.dangerLight,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: AppColors.danger.withValues(alpha: 0.15),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(Icons.wifi_off_rounded, color: AppColors.danger, size: 20),
                                  ),
                                  const SizedBox(width: 10),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '$offlineCustomers',
                                        style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w900, fontSize: 22),
                                      ),
                                      const Text('Offline', style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w500)),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: LinearProgressIndicator(
                        value: totalCustomers > 0 ? (onlineCustomers / totalCustomers) : 1.0,
                        backgroundColor: AppColors.danger.withValues(alpha: 0.2),
                        color: AppColors.success,
                        minHeight: 6,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Total: $totalCustomers Pelanggan', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                        Text(
                          '${customerOnlinePct.toStringAsFixed(1)}% Terhubung',
                          style: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),

              // ── 2. TICKETS & GANGGUAN ──
              _buildSectionHeader(
                title: 'Tickets & Gangguan',
                actionLabel: 'Kelola Tiket',
                onAction: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const TicketListScreen())),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.surfaceBorder),
                  boxShadow: AppColors.cardShadow,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: _buildTicketStatPill(
                        title: 'Aktif',
                        value: '$activeTickets',
                        color: AppColors.warning,
                        icon: Icons.confirmation_number_outlined,
                      ),
                    ),
                    Container(height: 32, width: 1, color: AppColors.surfaceBorder),
                    Expanded(
                      child: _buildTicketStatPill(
                        title: 'Kritis',
                        value: '$criticalTickets',
                        color: AppColors.danger,
                        icon: Icons.warning_amber_rounded,
                      ),
                    ),
                    Container(height: 32, width: 1, color: AppColors.surfaceBorder),
                    Expanded(
                      child: _buildTicketStatPill(
                        title: 'In Progress',
                        value: '$inProgressTickets',
                        color: AppColors.secondary,
                        icon: Icons.pending_actions_rounded,
                      ),
                    ),
                    Container(height: 32, width: 1, color: AppColors.surfaceBorder),
                    Expanded(
                      child: _buildTicketStatPill(
                        title: 'Total',
                        value: '$totalTickets',
                        color: AppColors.primary,
                        icon: Icons.assignment_outlined,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // ── 4. PILIHAN MENU (Grid Fitur Populer ala PLN Mobile) ──
              const Text(
                'Pilihan Menu Fitur',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 4,
                crossAxisSpacing: 10,
                mainAxisSpacing: 14,
                childAspectRatio: 0.85,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _buildPlnMenuItem(
                    icon: Icons.notifications_active_rounded,
                    label: 'Alert Sistem',
                    badge: dashboard.systemAlerts.isNotEmpty ? '${dashboard.systemAlerts.length}' : null,
                    badgeColor: AppColors.danger,
                    iconColor: AppColors.danger,
                    bgColor: AppColors.dangerLight,
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SystemAlertScreen())),
                  ),
                  _buildPlnMenuItem(
                    icon: Icons.router_rounded,
                    label: 'OLT',
                    badge: '$totalOlts',
                    badgeColor: AppColors.secondary,
                    iconColor: AppColors.secondary,
                    bgColor: AppColors.secondaryLight,
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OltListScreen())),
                  ),
                  _buildPlnMenuItem(
                    icon: Icons.account_tree_rounded,
                    label: 'ODP, ODC, POP',
                    badge: '${overview['total_odp'] ?? 0}',
                    badgeColor: AppColors.warning,
                    iconColor: AppColors.warning,
                    bgColor: AppColors.warningLight,
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NodesListScreen())),
                  ),
                  _buildPlnMenuItem(
                    icon: Icons.map_rounded,
                    label: 'Peta Sebaran',
                    iconColor: AppColors.primary,
                    bgColor: AppColors.primaryLight,
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GisMapScreen())),
                  ),
                  _buildPlnMenuItem(
                    icon: Icons.people_alt_rounded,
                    label: 'Pelanggan',
                    badge: '$totalCustomers',
                    badgeColor: AppColors.primary,
                    iconColor: AppColors.primary,
                    bgColor: AppColors.primaryLight,
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CustomerListScreen())),
                  ),
                  _buildPlnMenuItem(
                    icon: Icons.confirmation_number_rounded,
                    label: 'Tickets',
                    badge: activeTickets > 0 ? '$activeTickets' : null,
                    badgeColor: AppColors.warning,
                    iconColor: AppColors.warning,
                    bgColor: AppColors.warningLight,
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const TicketListScreen())),
                  ),
                  _buildPlnMenuItem(
                    icon: Icons.speed_rounded,
                    label: 'Ukur ODP',
                    iconColor: AppColors.secondary,
                    bgColor: AppColors.secondaryLight,
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OdpFormScreen())),
                  ),
                  _buildPlnMenuItem(
                    icon: Icons.qr_code_scanner_rounded,
                    label: 'Scan ONU',
                    iconColor: AppColors.accent,
                    bgColor: AppColors.accentLight,
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OntScanScreen())),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // ── 5. ALERT JARINGAN TERKINI ──
              _buildSectionHeader(
                title: 'Alert & Info Terkini',
                actionLabel: 'Lihat Semua (${dashboard.systemAlerts.length})',
                onAction: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SystemAlertScreen())),
              ),
              const SizedBox(height: 10),
              if (dashboard.systemAlerts.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.surfaceBorder),
                    boxShadow: AppColors.cardShadow,
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
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isCritical
                              ? AppColors.danger.withValues(alpha: 0.3)
                              : AppColors.surfaceBorder,
                        ),
                        boxShadow: AppColors.cardShadow,
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: isCritical ? AppColors.dangerLight : AppColors.warningLight,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              isCritical ? Icons.error_outline : Icons.warning_amber_rounded,
                              color: isCritical ? AppColors.danger : AppColors.warning,
                              size: 18,
                            ),
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
            style: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.bold),
          ),
        ),
      ],
    );
  }

  Widget _buildTicketStatPill({
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
          style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 17),
        ),
        Text(
          title,
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.w500),
        ),
      ],
    );
  }

  Widget _buildPlnMenuItem({
    required IconData icon,
    required String label,
    required Color iconColor,
    required Color bgColor,
    String? badge,
    Color? badgeColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: bgColor,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: iconColor.withValues(alpha: 0.12),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Center(
                  child: Icon(icon, color: iconColor, size: 26),
                ),
              ),
              if (badge != null)
                Positioned(
                  top: -4,
                  right: -4,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(
                      color: badgeColor ?? iconColor,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.white, width: 1.5),
                    ),
                    child: Text(
                      badge,
                      style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w600,
              fontSize: 11,
              height: 1.2,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
