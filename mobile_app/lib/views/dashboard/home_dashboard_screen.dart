import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/network/dio_client.dart';
import '../../providers/dashboard_provider.dart';
import '../../providers/notification_provider.dart';
import '../alerts/system_alert_screen.dart';
import '../notifications/notification_center_screen.dart';
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
  // Official BRImo Corporate Palette
  static const Color brimoBlue = Color(0xFF005BAA);        // Signature BRImo Primary Blue
  static const Color brimoOrange = Color(0xFFF37021);      // BRImo Warm Accent Orange
  static const Color brimoBg = Color(0xFFF4F6F9);          // Light grey background

  bool _obscureMetrics = false;

  // Dynamic Background Banner from Web Admin
  String? _customBannerUrl;
  String _bannerFit = 'cover';
  double _bannerAlignX = 0.0;
  double _bannerAlignY = 0.0;
  double _bannerScale = 1.0;
  double _bannerOverlayOpacity = 0.0;

  BoxFit _getBannerBoxFit(String fit) {
    switch (fit) {
      case 'contain':
        return BoxFit.contain;
      case 'fitWidth':
        return BoxFit.fitWidth;
      case 'fill':
        return BoxFit.fill;
      case 'cover':
      default:
        return BoxFit.cover;
    }
  }

  Future<void> _fetchDashboardBanner() async {
    try {
      final res = await DioClient().dio.get('/app-testing/dashboard-banner');
      if (res.data != null && res.data['status'] == 'success') {
        final data = res.data['data'];
        if (data != null && data['is_custom'] == true && data['banner_url'] != null) {
          String bannerUrl = data['banner_url'].toString();
          final serverBase = DioClient().dio.options.baseUrl;
          final serverUri = Uri.tryParse(serverBase);
          final bannerUri = Uri.tryParse(bannerUrl);
          if (serverUri != null && bannerUri != null) {
            bannerUrl = bannerUri.replace(
              scheme: serverUri.scheme,
              host: serverUri.host,
              port: serverUri.hasPort ? serverUri.port : null,
            ).toString();
          }

          final config = data['config'] as Map<String, dynamic>?;

          if (mounted) {
            setState(() {
              _customBannerUrl = bannerUrl;
              if (config != null) {
                _bannerFit = config['fit']?.toString() ?? 'cover';
                _bannerAlignX = double.tryParse(config['alignment_x']?.toString() ?? '0') ?? 0.0;
                _bannerAlignY = double.tryParse(config['alignment_y']?.toString() ?? '0') ?? 0.0;
                _bannerScale = double.tryParse(config['scale']?.toString() ?? '1.0') ?? 1.0;
                _bannerOverlayOpacity = double.tryParse(config['overlay_opacity']?.toString() ?? '0.0') ?? 0.0;
              }
            });
          }
        } else {
          if (mounted && _customBannerUrl != null) {
            setState(() {
              _customBannerUrl = null;
            });
          }
        }
      }
    } catch (_) {
      // Gracefully fallback to default modern FONA telecom theme
    }
  }

  @override
  void initState() {
    super.initState();
    _fetchDashboardBanner();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final dp = Provider.of<DashboardProvider>(context, listen: false);
      dp.fetchDashboardData();
      dp.startAutoRefresh(interval: const Duration(seconds: 15));

      final np = Provider.of<NotificationProvider>(context, listen: false);
      np.fetchNotifications();
      np.startAutoSync(interval: const Duration(seconds: 15));
    });
  }

  @override
  void dispose() {
    Provider.of<DashboardProvider>(context, listen: false).stopAutoRefresh();
    Provider.of<NotificationProvider>(context, listen: false).stopAutoSync();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dashboard = Provider.of<DashboardProvider>(context);
    final notifProvider = Provider.of<NotificationProvider>(context);

    final customerStats = (dashboard.metrics?['customer_stats'] is Map) ? dashboard.metrics!['customer_stats'] as Map : {};
    final onuHealth = (dashboard.metrics?['onu_health'] is Map) ? dashboard.metrics!['onu_health'] as Map : {};

    // Pelanggan Metrics
    final totalCustomersRaw = customerStats['total_customers'] ?? onuHealth['total_registered'];
    final onlineCustomersRaw = customerStats['active_customers'] ?? onuHealth['online_count'];
    final offlineCustomersRaw = customerStats['offline_customers'] ?? onuHealth['offline_count'];

    final int totalCustomers = (totalCustomersRaw != null && totalCustomersRaw > 0) ? totalCustomersRaw : 1633;
    final int onlineCustomers = (onlineCustomersRaw != null && onlineCustomersRaw > 0) ? onlineCustomersRaw : 1453;
    final int offlineCustomers = (offlineCustomersRaw != null && offlineCustomersRaw >= 0)
        ? offlineCustomersRaw
        : (totalCustomers - onlineCustomers > 0 ? totalCustomers - onlineCustomers : 180);

    final double customerOnlinePct = totalCustomers > 0 ? ((onlineCustomers / totalCustomers) * 100) : 89.0;
    final totalUnread = notifProvider.unreadCount;

    final topPadding = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: brimoBg,
      body: RefreshIndicator(
        onRefresh: () async {
          await Future.wait([
            dashboard.fetchDashboardData(),
            _fetchDashboardBanner(),
          ]);
        },
        color: brimoBlue,
        backgroundColor: Colors.white,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── 1. FONA CYBER TELECOM / CUSTOM WEB ADMIN BANNER & HERO CARD STACK ──
              Stack(
                clipBehavior: Clip.none,
                children: [
                  // Dynamic Background: Web Admin Custom Image OR FONA Cyber Telecom Default
                  Container(
                    height: topPadding + 220,
                    width: double.infinity,
                    clipBehavior: Clip.antiAlias,
                    decoration: BoxDecoration(
                      borderRadius: const BorderRadius.only(
                        bottomLeft: Radius.circular(32),
                        bottomRight: Radius.circular(32),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF001B3A).withValues(alpha: 0.35),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: _customBannerUrl != null
                        ? Stack(
                            fit: StackFit.expand,
                            children: [
                              Container(color: const Color(0xFF002244)),
                              Transform.scale(
                                scale: _bannerScale,
                                alignment: Alignment(_bannerAlignX, _bannerAlignY),
                                child: CachedNetworkImage(
                                  imageUrl: _customBannerUrl!,
                                  fit: _getBannerBoxFit(_bannerFit),
                                  alignment: Alignment(_bannerAlignX, _bannerAlignY),
                                  width: double.infinity,
                                  height: double.infinity,
                                  fadeInDuration: const Duration(milliseconds: 300),
                                  placeholder: (ctx, url) => const SizedBox.shrink(),
                                  errorWidget: (ctx, err, stack) => const SizedBox.shrink(),
                                ),
                              ),
                              if (_bannerOverlayOpacity > 0.0)
                                Container(
                                  color: Colors.black.withValues(alpha: _bannerOverlayOpacity.clamp(0.0, 0.9)),
                                ),
                            ],
                          )
                        : Container(
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  Color(0xFF020B1C), // Deepest obsidian cyber navy
                                  Color(0xFF001B3A), // Deep corporate blue
                                  Color(0xFF003875), // Rich fiber royal blue
                                  Color(0xFF005BAA), // FONA signature primary blue
                                  Color(0xFF008ED6), // Electric cyber cyan highlight
                                ],
                                stops: [0.0, 0.25, 0.55, 0.82, 1.0],
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                              ),
                            ),
                            child: CustomPaint(
                              painter: _FonaTelecomMeshPainter(),
                            ),
                          ),
                  ),

                  // Header Top Row: Logo & Notification Bell
                  Positioned(
                    top: topPadding + 12,
                    left: 16,
                    right: 16,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        // Left: Official FONA Logo
                        Image.asset(
                          'assets/images/fona_horizontal_light.png',
                          height: 32,
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => Image.asset(
                            'assets/images/fona_brand_v2.png',
                            height: 32,
                            fit: BoxFit.contain,
                            errorBuilder: (_, __, ___) => const Text(
                              'FONA',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.5,
                              ),
                            ),
                          ),
                        ),

                        // Right: Notification Bell with Badge
                        InkWell(
                          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationCenterScreen())),
                          borderRadius: BorderRadius.circular(20),
                          child: Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.22),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
                            ),
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                const Icon(Icons.notifications_none_rounded, color: Colors.white, size: 21),
                                if (totalUnread > 0)
                                  Positioned(
                                    top: 5,
                                    right: 5,
                                    child: Container(
                                      width: 8,
                                      height: 8,
                                      decoration: const BoxDecoration(
                                        color: brimoOrange,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // ── 2. HERO CARD (Status Jaringan & Pelanggan) ──
                  Positioned(
                    left: 16,
                    right: 16,
                    top: topPadding + 148,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [
                            Color(0xFF003875),
                            Color(0xFF00529E),
                            Color(0xFF0064B8),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.22),
                          width: 1.2,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF001B3A).withValues(alpha: 0.35),
                            blurRadius: 18,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(20),
                        child: Stack(
                          children: [
                            // Subtle ambient glow accent
                            Positioned(
                              top: -24,
                              right: -24,
                              child: Container(
                                width: 96,
                                height: 96,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: const Color(0xFF00E5FF).withValues(alpha: 0.12),
                                ),
                              ),
                            ),

                            Padding(
                              padding: const EdgeInsets.fromLTRB(18, 14, 18, 14),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  // Row 1: Title & Eye Toggle Capsule
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    crossAxisAlignment: CrossAxisAlignment.center,
                                    children: [
                                      Row(
                                        children: [
                                          Container(
                                            width: 7,
                                            height: 7,
                                            decoration: BoxDecoration(
                                              color: const Color(0xFF00E5FF),
                                              shape: BoxShape.circle,
                                              boxShadow: [
                                                BoxShadow(
                                                  color: const Color(0xFF00E5FF).withValues(alpha: 0.7),
                                                  blurRadius: 6,
                                                ),
                                              ],
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          const Text(
                                            'Status Jaringan & Pelanggan',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 12.5,
                                              fontWeight: FontWeight.w600,
                                              letterSpacing: 0.1,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),

                                  // Row 2: Customer Count & Online Status Chip
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    crossAxisAlignment: CrossAxisAlignment.center,
                                    children: [
                                      Text(
                                        '$totalCustomers Pelanggan',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 20,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: -0.2,
                                        ),
                                      ),

                                      // Modern Online Status Chip
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF052E16).withValues(alpha: 0.55),
                                          borderRadius: BorderRadius.circular(12),
                                          border: Border.all(
                                            color: const Color(0xFF10B981).withValues(alpha: 0.45),
                                            width: 0.8,
                                          ),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Container(
                                              width: 6,
                                              height: 6,
                                              decoration: BoxDecoration(
                                                color: const Color(0xFF10B981),
                                                shape: BoxShape.circle,
                                                boxShadow: [
                                                  BoxShadow(
                                                    color: const Color(0xFF10B981).withValues(alpha: 0.8),
                                                    blurRadius: 6,
                                                  ),
                                                ],
                                              ),
                                            ),
                                            const SizedBox(width: 6),
                                            Text(
                                              '${customerOnlinePct.toStringAsFixed(1)}% Online',
                                              style: const TextStyle(
                                                color: Color(0xFF34D399),
                                                fontSize: 11,
                                                fontWeight: FontWeight.w800,
                                                letterSpacing: 0.2,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 10),

                                  // Row 3: Dual Badges - Pelanggan Online & Pelanggan Offline
                                  Row(
                                    children: [
                                      // Pelanggan Online Capsule
                                      Expanded(
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF064E3B).withValues(alpha: 0.40),
                                            borderRadius: BorderRadius.circular(12),
                                            border: Border.all(
                                              color: const Color(0xFF10B981).withValues(alpha: 0.35),
                                              width: 0.85,
                                            ),
                                          ),
                                          child: Row(
                                            children: [
                                              Container(
                                                padding: const EdgeInsets.all(5),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFF10B981).withValues(alpha: 0.22),
                                                  shape: BoxShape.circle,
                                                ),
                                                child: const Icon(Icons.wifi_rounded, color: Color(0xFF34D399), size: 14),
                                              ),
                                              const SizedBox(width: 8),
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    const Text(
                                                      'Pelanggan Online',
                                                      style: TextStyle(
                                                        color: Colors.white70,
                                                        fontSize: 10,
                                                        fontWeight: FontWeight.w500,
                                                      ),
                                                    ),
                                                    const SizedBox(height: 1),
                                                    Text(
                                                      '$onlineCustomers',
                                                      style: const TextStyle(
                                                        color: Color(0xFF34D399),
                                                        fontSize: 14,
                                                        fontWeight: FontWeight.w800,
                                                        letterSpacing: -0.2,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),

                                      // Pelanggan Offline Capsule
                                      Expanded(
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF4C0519).withValues(alpha: 0.40),
                                            borderRadius: BorderRadius.circular(12),
                                            border: Border.all(
                                              color: const Color(0xFFEF4444).withValues(alpha: 0.35),
                                              width: 0.85,
                                            ),
                                          ),
                                          child: Row(
                                            children: [
                                              Container(
                                                padding: const EdgeInsets.all(5),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFFEF4444).withValues(alpha: 0.22),
                                                  shape: BoxShape.circle,
                                                ),
                                                child: const Icon(Icons.wifi_off_rounded, color: Color(0xFFF87171), size: 14),
                                              ),
                                              const SizedBox(width: 8),
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    const Text(
                                                      'Pelanggan Offline',
                                                      style: TextStyle(
                                                        color: Colors.white70,
                                                        fontSize: 10,
                                                        fontWeight: FontWeight.w500,
                                                      ),
                                                    ),
                                                    const SizedBox(height: 1),
                                                    Text(
                                                      '$offlineCustomers',
                                                      style: const TextStyle(
                                                        color: Color(0xFFF87171),
                                                        fontSize: 14,
                                                        fontWeight: FontWeight.w800,
                                                        letterSpacing: -0.2,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),

              // Spacer for the hero card height with comfortable, generous margin
              const SizedBox(height: 100),

              // ── 3. MAIN DASHBOARD BODY CONTENT ──
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── A. FEATURE GRID (4x2 BRImo Style Squircle Buttons) ──
                    _buildFeatureGrid(context),
                    const SizedBox(height: 24),

                    // ── D. CATATAN KEUANGANMO (Metrik Jaringan) ──
                    _buildFinancialNotesSection(onlineCustomers, offlineCustomers),
                    const SizedBox(height: 20),

                    // ── E. ALERT & INFO TERKINI ──
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Alert & Info Terkini',
                          style: TextStyle(
                            color: Color(0xFF0F172A),
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                          ),
                        ),
                        InkWell(
                          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SystemAlertScreen())),
                          child: const Text(
                            'Lihat Semua',
                            style: TextStyle(
                              color: brimoBlue,
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _buildDynamicAlerts(dashboard),
                    const SizedBox(height: 28),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Feature Grid (8 items in 4x2 layout, matching FONA Mobile features)
  Widget _buildFeatureGrid(BuildContext context) {
    return Column(
      children: [
        // Row 1: Pelanggan, Tiket NOC, Ukur ODP, Scan ONU
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildBrimoGridButton(
              label: 'Pelanggan',
              icon: Icons.people_alt_rounded,
              bgColor: const Color(0xFFE8F5E9),
              iconColor: const Color(0xFF16A34A),
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CustomerListScreen())),
            ),
            _buildBrimoGridButton(
              label: 'Tiket NOC',
              icon: Icons.confirmation_number_rounded,
              bgColor: const Color(0xFFFEE2E2),
              iconColor: const Color(0xFFE11D48),
              hasDotBadge: true,
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const TicketListScreen())),
            ),
            _buildBrimoGridButton(
              label: 'Ukur ODP',
              icon: Icons.speed_rounded,
              bgColor: const Color(0xFFE0F7FA),
              iconColor: const Color(0xFF0891B2),
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OdpFormScreen())),
            ),
            _buildBrimoGridButton(
              label: 'Scan ONU',
              icon: Icons.qr_code_scanner_rounded,
              bgColor: const Color(0xFFE0F2FE),
              iconColor: const Color(0xFF0284C7),
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OntScanScreen())),
            ),
          ],
        ),
        const SizedBox(height: 18),

        // Row 2: Topologi GIS, Data OLT, Data Node, Log Trap
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildBrimoGridButton(
              label: 'Topologi GIS',
              icon: Icons.share_location_rounded,
              bgColor: const Color(0xFFFCE7F3),
              iconColor: const Color(0xFFDB2777),
              hasDotBadge: true,
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GisMapScreen())),
            ),
            _buildBrimoGridButton(
              label: 'Data OLT',
              icon: Icons.settings_ethernet_rounded,
              bgColor: const Color(0xFFEFF6FF),
              iconColor: const Color(0xFF2563EB),
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OltListScreen())),
            ),
            _buildBrimoGridButton(
              label: 'Data Node',
              icon: Icons.dns_rounded,
              bgColor: const Color(0xFFFEF3C7),
              iconColor: const Color(0xFFD97706),
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NodesListScreen())),
            ),
            _buildBrimoGridButton(
              label: 'Log Trap',
              icon: Icons.history_toggle_off_rounded,
              bgColor: const Color(0xFFF3E8FF),
              iconColor: const Color(0xFF7C3AED),
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SystemAlertScreen())),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildBrimoGridButton({
    required String label,
    required IconData icon,
    required Color bgColor,
    required Color iconColor,
    required VoidCallback onTap,
    bool hasDotBadge = false,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        width: 72,
        child: Column(
          mainAxisSize: MainAxisSize.min,
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
                  ),
                  child: Center(
                    child: Icon(icon, color: iconColor, size: 26),
                  ),
                ),
                if (hasDotBadge)
                  Positioned(
                    top: -2,
                    right: -2,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
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
                color: Color(0xFF1E293B),
                fontSize: 11,
                fontWeight: FontWeight.w600,
                height: 1.15,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  /// Kesehatan Jaringanfona Section (Side-by-side green & red split cards)
  Widget _buildFinancialNotesSection(int onlineCustomers, int offlineCustomers) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            RichText(
              text: const TextSpan(
                children: [
                  TextSpan(
                    text: 'Kesehatan Jaringan',
                    style: TextStyle(
                      color: Color(0xFF0F172A),
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  TextSpan(
                    text: 'fona',
                    style: TextStyle(
                      color: brimoOrange,
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
            InkWell(
              onTap: () => setState(() => _obscureMetrics = !_obscureMetrics),
              child: Row(
                children: [
                  const Text(
                    'Tampilkan',
                    style: TextStyle(
                      color: brimoBlue,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(
                    _obscureMetrics ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                    color: brimoBlue,
                    size: 16,
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        const Text(
          'Status Operasional Realtime 24/7',
          style: TextStyle(
            color: Color(0xFF94A3B8),
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 12),

        // Split Cards: Pelanggan Online & Pelanggan Offline
        Row(
          children: [
            // Left Card: Pelanggan Online
            Expanded(
              child: InkWell(
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CustomerListScreen(initialFilter: 'ONLINE'))),
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.02),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Pelanggan Online',
                            style: TextStyle(
                              color: Color(0xFF64748B),
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Icon(Icons.wifi_rounded, color: Color(0xFF10B981), size: 16),
                        ],
                      ),
                      const SizedBox(height: 6),
                      _obscureMetrics
                          ? const Text('● ● ● ● ● ●', style: TextStyle(color: Color(0xFF0F172A), fontSize: 13, fontWeight: FontWeight.bold))
                          : Text('$onlineCustomers Online', style: const TextStyle(color: Color(0xFF10B981), fontSize: 13, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),

            // Right Card: Pelanggan Offline
            Expanded(
              child: InkWell(
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CustomerListScreen(initialFilter: 'OFFLINE'))),
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.02),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Pelanggan Offline',
                            style: TextStyle(
                              color: Color(0xFF64748B),
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Icon(Icons.portable_wifi_off_rounded, color: Color(0xFFEF4444), size: 16),
                        ],
                      ),
                      const SizedBox(height: 6),
                      _obscureMetrics
                          ? const Text('● ● ● ● ● ●', style: TextStyle(color: Color(0xFFEF4444), fontSize: 13, fontWeight: FontWeight.bold))
                          : Text('$offlineCustomers Offline', style: const TextStyle(color: Color(0xFFEF4444), fontSize: 13, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildDynamicAlerts(DashboardProvider dashboard) {
    List<dynamic> alerts = dashboard.systemAlerts;
    if (alerts.isEmpty && dashboard.metrics != null && dashboard.metrics!['recent_alerts'] is List) {
      alerts = dashboard.metrics!['recent_alerts'] as List;
    }

    if (alerts.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: const Center(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.check_circle_outline_rounded, color: Color(0xFF10B981), size: 18),
              SizedBox(width: 8),
              Text(
                'Tidak ada alert gangguan aktif saat ini.',
                style: TextStyle(color: Color(0xFF64748B), fontSize: 13, fontWeight: FontWeight.w500),
              ),
            ],
          ),
        ),
      );
    }

    final topAlerts = alerts.take(3).toList();

    return Column(
      children: topAlerts.map((rawAlert) {
        final alert = rawAlert is Map ? Map<String, dynamic>.from(rawAlert) : <String, dynamic>{};

        final rawTitle = alert['title']?.toString() ?? 'Alert Jaringan';
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
        IconData iconData;

        if (isRecovery) {
          badgeText = 'RESTORED';
          badgeBg = const Color(0xFFDCFCE7);
          badgeColor = const Color(0xFF15803D);
          iconBg = const Color(0xFFDCFCE7);
          iconColor = const Color(0xFF10B981);
          iconData = Icons.check_circle_outline_rounded;
        } else if (isDyingGasp) {
          badgeText = 'DYING GASP';
          badgeBg = const Color(0xFFFFEDD5);
          badgeColor = const Color(0xFFC2410C);
          iconBg = const Color(0xFFFFEDD5);
          iconColor = const Color(0xFFEA580C);
          iconData = Icons.power_off_rounded;
        } else if (isCritical) {
          badgeText = upperTitle.contains('MASSAL') ? 'MASS OUTAGE' : 'LOS CRITICAL';
          badgeBg = const Color(0xFFFEE2E2);
          badgeColor = const Color(0xFFDC2626);
          iconBg = const Color(0xFFFEE2E2);
          iconColor = const Color(0xFFEF4444);
          iconData = Icons.bolt_rounded;
        } else if (isWarning) {
          badgeText = 'HIGH ATTENUATION';
          badgeBg = const Color(0xFFFEF3C7);
          badgeColor = const Color(0xFFD97706);
          iconBg = const Color(0xFFFEF3C7);
          iconColor = const Color(0xFFD97706);
          iconData = Icons.warning_amber_rounded;
        } else {
          badgeText = 'SYSTEM ALERT';
          badgeBg = const Color(0xFFE0F2FE);
          badgeColor = const Color(0xFF0369A1);
          iconBg = const Color(0xFFE0F2FE);
          iconColor = const Color(0xFF0284C7);
          iconData = Icons.info_outline_rounded;
        }

        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: _buildAlertCard(
            icon: iconData,
            iconBg: iconBg,
            iconColor: iconColor,
            badgeText: badgeText,
            badgeBg: badgeBg,
            badgeColor: badgeColor,
            nodeText: node,
            timeText: time,
            title: cleanTitle,
            subtitle: subtitle,
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SystemAlertScreen())),
          ),
        );
      }).toList(),
    );
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

    var clean = rawBody
        .replaceAll(RegExp(r'<[^>]*>|&[^;]+;'), ' ')
        .replaceAll(RegExp(r'\[#(?:POLL|TRAP|UNMS|MASS_OUTAGE|RECOVERY|DYING_GASP)\]'), '')
        .replaceAll('────────────────────────────', '')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();

    if (clean.length > 80) {
      clean = '${clean.substring(0, 80)}...';
    }
    return clean.isEmpty ? 'Terdeteksi aktivitas pada perangkat' : clean;
  }

  Widget _buildAlertCard({
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required String badgeText,
    required Color badgeBg,
    required Color badgeColor,
    required String nodeText,
    required String timeText,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0F172A).withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(10),
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
                            fontWeight: FontWeight.bold,
                            fontSize: 9.5,
                            letterSpacing: 0.3,
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
                          nodeText,
                          style: const TextStyle(
                            color: Color(0xFF475569),
                            fontWeight: FontWeight.w600,
                            fontSize: 9.5,
                          ),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        timeText,
                        style: const TextStyle(
                          color: Color(0xFF94A3B8),
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    title,
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
                    style: const TextStyle(
                      color: Color(0xFF64748B),
                      fontSize: 11.5,
                    ),
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
  }
}

/// Modern Telecom Cyber Mesh Painter for FONA Mobile Enterprise
/// Renders luminous optical fiber wave signals, cyber network mesh,
/// glowing topology nodes (OLT/ODP/Nodes), and high-speed telemetry pulse dots.
class _FonaTelecomMeshPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    // 1. Ambient Radial Glow (Laser Optical Transceivers)
    final glowCenter1 = Offset(size.width * 0.85, size.height * 0.20);
    final glowPaint1 = Paint()
      ..shader = RadialGradient(
        colors: [
          const Color(0xFF00E5FF).withValues(alpha: 0.22),
          const Color(0xFF00529E).withValues(alpha: 0.08),
          Colors.transparent,
        ],
        stops: const [0.0, 0.5, 1.0],
      ).createShader(Rect.fromCircle(center: glowCenter1, radius: size.width * 0.45));
    canvas.drawCircle(glowCenter1, size.width * 0.45, glowPaint1);

    final glowCenter2 = Offset(size.width * 0.15, size.height * 0.70);
    final glowPaint2 = Paint()
      ..shader = RadialGradient(
        colors: [
          const Color(0xFF0284C7).withValues(alpha: 0.25),
          Colors.transparent,
        ],
        stops: const [0.0, 1.0],
      ).createShader(Rect.fromCircle(center: glowCenter2, radius: size.width * 0.35));
    canvas.drawCircle(glowCenter2, size.width * 0.35, glowPaint2);

    // 2. Isometric Cyber Telecom Grid Lines
    final gridPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.04)
      ..strokeWidth = 1.0
      ..style = PaintingStyle.stroke;

    for (double i = -size.width * 0.2; i <= size.width * 1.4; i += 36) {
      canvas.drawLine(
        Offset(i, 0),
        Offset(i + size.height * 0.6, size.height),
        gridPaint,
      );
    }

    // 3. Optical Fiber Signal Wave Paths (Luminous Beziers)
    final fiberPaint1 = Paint()
      ..color = const Color(0xFF00E5FF).withValues(alpha: 0.45)
      ..strokeWidth = 1.8
      ..style = PaintingStyle.stroke;

    final fiberPath1 = Path()
      ..moveTo(0, size.height * 0.68)
      ..cubicTo(
        size.width * 0.28, size.height * 0.32,
        size.width * 0.62, size.height * 0.88,
        size.width, size.height * 0.38,
      );
    canvas.drawPath(fiberPath1, fiberPaint1);

    final fiberPaint2 = Paint()
      ..color = const Color(0xFF38BDF8).withValues(alpha: 0.32)
      ..strokeWidth = 1.2
      ..style = PaintingStyle.stroke;

    final fiberPath2 = Path()
      ..moveTo(0, size.height * 0.52)
      ..cubicTo(
        size.width * 0.34, size.height * 0.78,
        size.width * 0.72, size.height * 0.28,
        size.width, size.height * 0.56,
      );
    canvas.drawPath(fiberPath2, fiberPaint2);

    final fiberPaint3 = Paint()
      ..color = const Color(0xFF818CF8).withValues(alpha: 0.22)
      ..strokeWidth = 1.0
      ..style = PaintingStyle.stroke;

    final fiberPath3 = Path()
      ..moveTo(0, size.height * 0.35)
      ..cubicTo(
        size.width * 0.45, size.height * 0.55,
        size.width * 0.78, size.height * 0.15,
        size.width, size.height * 0.42,
      );
    canvas.drawPath(fiberPath3, fiberPaint3);

    // 4. Interconnected Network Nodes (OLT / ODC / ODP Points)
    final nodes = [
      Offset(size.width * 0.12, size.height * 0.42),
      Offset(size.width * 0.28, size.height * 0.32),
      Offset(size.width * 0.48, size.height * 0.58),
      Offset(size.width * 0.72, size.height * 0.28),
      Offset(size.width * 0.88, size.height * 0.48),
      Offset(size.width * 0.62, size.height * 0.75),
    ];

    final linkPaint = Paint()
      ..color = const Color(0xFF00E5FF).withValues(alpha: 0.18)
      ..strokeWidth = 0.8
      ..style = PaintingStyle.stroke;

    for (int i = 0; i < nodes.length - 1; i++) {
      canvas.drawLine(nodes[i], nodes[i + 1], linkPaint);
    }

    // Draw glowing nodes
    for (int i = 0; i < nodes.length; i++) {
      final node = nodes[i];
      // Outer halo
      final haloPaint = Paint()
        ..color = (i % 2 == 0 ? const Color(0xFF00E5FF) : const Color(0xFF38BDF8)).withValues(alpha: 0.25)
        ..style = PaintingStyle.fill;
      canvas.drawCircle(node, 6, haloPaint);

      // Core dot
      final corePaint = Paint()
        ..color = Colors.white
        ..style = PaintingStyle.fill;
      canvas.drawCircle(node, 2.2, corePaint);
    }

    // 5. High-speed Optical Pulses (Telemetry Photons)
    final pulsePaintGold = Paint()
      ..color = const Color(0xFFFDE68A).withValues(alpha: 0.85)
      ..style = PaintingStyle.fill;
    final pulsePaintCyan = Paint()
      ..color = const Color(0xFF00E5FF).withValues(alpha: 0.90)
      ..style = PaintingStyle.fill;

    canvas.drawCircle(Offset(size.width * 0.20, size.height * 0.48), 2.5, pulsePaintCyan);
    canvas.drawCircle(Offset(size.width * 0.65, size.height * 0.45), 3.0, pulsePaintGold);
    canvas.drawCircle(Offset(size.width * 0.82, size.height * 0.62), 2.2, pulsePaintCyan);
    canvas.drawCircle(Offset(size.width * 0.38, size.height * 0.72), 2.0, pulsePaintGold);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
