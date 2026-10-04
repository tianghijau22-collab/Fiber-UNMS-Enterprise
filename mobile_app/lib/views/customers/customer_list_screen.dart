import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/api_constants.dart';
import '../../core/constants/app_colors.dart';
import '../../core/network/dio_client.dart';
import '../../models/customer_model.dart';
import 'swap_onu_screen.dart';
import '../ont/ont_power_check_screen.dart';

class CustomerListScreen extends StatefulWidget {
  final String initialFilter;
  const CustomerListScreen({super.key, this.initialFilter = 'ALL'});

  @override
  State<CustomerListScreen> createState() => _CustomerListScreenState();
}

class _CustomerListScreenState extends State<CustomerListScreen> {
  // Palette selaras dengan halaman Login & Home (FONA / BRImo navy)
  static const Color _navyDeep = Color(0xFF001B3A);
  static const Color _navy = Color(0xFF003875);
  static const Color _brandBlue = Color(0xFF005BAA);
  static const Color _cyan = Color(0xFF008ED6);
  static const Color _neon = Color(0xFF00E5FF);
  static const Color _bg = Color(0xFFF4F6F9);
  static const Color _textDark = Color(0xFF0F172A);
  static const Color _textBody = Color(0xFF475569);
  static const Color _textMuted = Color(0xFF94A3B8);
  static const Color _border = Color(0xFFE2E8F0);

  final TextEditingController _searchController = TextEditingController();
  List<CustomerModel> _customers = [];
  bool _isLoading = false;
  String? _errorMessage;
  late String _statusFilter; // 'ALL', 'ONLINE', 'OFFLINE'
  String _localQuery = '';

  @override
  void initState() {
    super.initState();
    _statusFilter = widget.initialFilter;
    _fetchCustomers();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _fetchCustomers({String? query}) async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await DioClient().dio.get(
        ApiConstants.endpointCustomers,
        queryParameters: query != null && query.isNotEmpty ? {'search': query} : null,
      );

      if (response.data != null) {
        final rawList = response.data is List
            ? response.data
            : (response.data['data'] is List ? response.data['data'] : []);

        if (!mounted) return;
        setState(() {
          _customers = (rawList as List).map((i) => CustomerModel.fromJson(i)).toList();
          _isLoading = false;
        });
      }
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.response?.data is Map
            ? (e.response?.data['message'] ?? 'Gagal memuat data pelanggan.')
            : 'Gagal memuat data pelanggan.';
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Terjadi kesalahan: $e';
        _isLoading = false;
      });
    }
  }

  void _callCustomer(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  void _whatsappCustomer(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    var p = phone.replaceAll(RegExp(r'[^0-9]'), '');
    if (p.startsWith('0')) p = '62${p.substring(1)}';
    final uri = Uri.parse('https://wa.me/$p');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((e) => e.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  Color _rxColor(double? dbm) => AppColors.getOpticalColor(dbm);

  String _rxLabel(double? dbm) {
    if (dbm == null) return 'N/A';
    if (dbm >= -24.0 && dbm <= -14.0) return 'Baik';
    if (dbm > -27.0 && dbm < -24.0) return 'Waspada';
    return 'Kritis';
  }

  @override
  Widget build(BuildContext context) {
    final q = _localQuery.toLowerCase();
    final filteredCustomers = _customers.where((c) {
      if (_statusFilter == 'ONLINE' && !c.isOnline) return false;
      if (_statusFilter == 'OFFLINE' && c.isOnline) return false;
      if (q.isEmpty) return true;
      return c.name.toLowerCase().contains(q) ||
          c.customerNumber.toLowerCase().contains(q) ||
          (c.phone ?? '').toLowerCase().contains(q) ||
          (c.address ?? '').toLowerCase().contains(q);
    }).toList();

    final onlineCount = _customers.where((c) => c.isOnline).length;
    final offlineCount = _customers.length - onlineCount;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: _bg,
        body: RefreshIndicator(
          onRefresh: () => _fetchCustomers(query: _searchController.text.trim()),
          color: _brandBlue,
          backgroundColor: Colors.white,
          edgeOffset: 200,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
            slivers: [
              SliverToBoxAdapter(
                child: _buildHeader(onlineCount, offlineCount),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 10),
                  child: Row(
                    children: [
                      const Text(
                        'Daftar Pelanggan',
                        style: TextStyle(color: _textDark, fontSize: 15.5, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: _brandBlue.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          '${filteredCustomers.length}',
                          style: const TextStyle(color: _brandBlue, fontSize: 11.5, fontWeight: FontWeight.w800),
                        ),
                      ),
                      const Spacer(),
                      if (_statusFilter != 'ALL')
                        GestureDetector(
                          onTap: () => setState(() => _statusFilter = 'ALL'),
                          child: const Row(
                            children: [
                              Icon(Icons.close_rounded, size: 14, color: _textMuted),
                              SizedBox(width: 2),
                              Text('Reset filter', style: TextStyle(color: _textMuted, fontSize: 12, fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              ..._buildBodySlivers(filteredCustomers),
              const SliverToBoxAdapter(child: SizedBox(height: 110)),
            ],
          ),
        ),
      ),
    );
  }

  // ───────────────────────────── HEADER ─────────────────────────────
  Widget _buildHeader(int onlineCount, int offlineCount) {
    final canPop = Navigator.of(context).canPop();
    final topPad = MediaQuery.of(context).padding.top;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          margin: const EdgeInsets.only(bottom: 25),
          padding: EdgeInsets.fromLTRB(20, topPad + 10, 20, 46),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [_navyDeep, _navy, _brandBlue, _cyan],
              stops: [0.0, 0.35, 0.75, 1.0],
            ),
            borderRadius: BorderRadius.only(
              bottomLeft: Radius.circular(28),
              bottomRight: Radius.circular(28),
            ),
          ),
          child: Stack(
            children: [
              // Dekorasi lingkaran halus
              Positioned(
                right: -40,
                top: -30,
                child: Container(
                  width: 140,
                  height: 140,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withValues(alpha: 0.05),
                  ),
                ),
              ),
              Positioned(
                right: 50,
                bottom: -10,
                child: Container(
                  width: 70,
                  height: 70,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _neon.withValues(alpha: 0.06),
                  ),
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (canPop) ...[
                        _glassIconButton(Icons.arrow_back_ios_new_rounded, () => Navigator.of(context).pop()),
                        const SizedBox(width: 12),
                      ],
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Data Pelanggan',
                              style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: 0.2),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Pantau status & kualitas sinyal pelanggan',
                              style: TextStyle(color: Color(0xFFB9D7F2), fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      _glassIconButton(
                        Icons.refresh_rounded,
                        () => _fetchCustomers(query: _searchController.text.trim()),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: _buildStatCard(
                          label: 'Total',
                          count: _customers.length,
                          icon: Icons.groups_rounded,
                          accent: _neon,
                          isActive: _statusFilter == 'ALL',
                          onTap: () => setState(() => _statusFilter = 'ALL'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _buildStatCard(
                          label: 'Online',
                          count: onlineCount,
                          icon: Icons.wifi_rounded,
                          accent: const Color(0xFF34D399),
                          isActive: _statusFilter == 'ONLINE',
                          onTap: () => setState(() => _statusFilter = _statusFilter == 'ONLINE' ? 'ALL' : 'ONLINE'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _buildStatCard(
                          label: 'Offline',
                          count: offlineCount,
                          icon: Icons.wifi_off_rounded,
                          accent: const Color(0xFFF87171),
                          isActive: _statusFilter == 'OFFLINE',
                          onTap: () => setState(() => _statusFilter = _statusFilter == 'OFFLINE' ? 'ALL' : 'OFFLINE'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
        // Search bar melayang
        Positioned(
          left: 20,
          right: 20,
          bottom: 0,
          child: _buildSearchBar(),
        ),
      ],
    );
  }

  Widget _glassIconButton(IconData icon, VoidCallback onTap) {
    return Material(
      color: Colors.white.withValues(alpha: 0.14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, color: Colors.white, size: 18),
        ),
      ),
    );
  }

  Widget _buildStatCard({
    required String label,
    required int count,
    required IconData icon,
    required Color accent,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: isActive ? Colors.white : Colors.white.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isActive ? Colors.white : Colors.white.withValues(alpha: 0.18),
          ),
          boxShadow: isActive
              ? [BoxShadow(color: _navyDeep.withValues(alpha: 0.25), blurRadius: 14, offset: const Offset(0, 6))]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(5),
                  decoration: BoxDecoration(
                    color: isActive ? _brandBlue.withValues(alpha: 0.1) : accent.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, size: 13, color: isActive ? _brandBlue : accent),
                ),
                const Spacer(),
                if (isActive)
                  const Icon(Icons.check_circle_rounded, size: 14, color: _brandBlue),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              '$count',
              style: TextStyle(
                color: isActive ? _textDark : Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w800,
                height: 1,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: isActive ? _textBody : Colors.white.withValues(alpha: 0.75),
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      height: 50,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: _navyDeep.withValues(alpha: 0.12), blurRadius: 20, offset: const Offset(0, 8)),
        ],
      ),
      child: TextField(
        controller: _searchController,
        textInputAction: TextInputAction.search,
        style: const TextStyle(color: _textDark, fontSize: 14, fontWeight: FontWeight.w500),
        onChanged: (v) => setState(() => _localQuery = v.trim()),
        onSubmitted: (v) => _fetchCustomers(query: v.trim()),
        decoration: InputDecoration(
          hintText: 'Cari nama, ID pelanggan, atau no. HP',
          hintStyle: const TextStyle(color: _textMuted, fontSize: 13),
          prefixIcon: const Icon(Icons.search_rounded, color: _brandBlue, size: 22),
          suffixIcon: _localQuery.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.cancel_rounded, color: _textMuted, size: 18),
                  onPressed: () {
                    _searchController.clear();
                    setState(() => _localQuery = '');
                    _fetchCustomers();
                  },
                )
              : null,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(vertical: 15),
        ),
      ),
    );
  }

  // ───────────────────────────── BODY ─────────────────────────────
  List<Widget> _buildBodySlivers(List<CustomerModel> list) {
    if (_isLoading && _customers.isEmpty) {
      return [
        SliverList(
          delegate: SliverChildBuilderDelegate(
            (_, __) => _buildSkeletonCard(),
            childCount: 5,
          ),
        ),
      ];
    }

    if (_errorMessage != null) {
      return [
        SliverToBoxAdapter(
          child: _buildStateView(
            icon: Icons.cloud_off_rounded,
            color: AppColors.danger,
            title: 'Gagal memuat data',
            subtitle: _errorMessage!,
            actionLabel: 'Coba Lagi',
            onAction: () => _fetchCustomers(query: _searchController.text.trim()),
          ),
        ),
      ];
    }

    if (list.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: _buildStateView(
            icon: Icons.person_search_rounded,
            color: _brandBlue,
            title: 'Pelanggan tidak ditemukan',
            subtitle: 'Coba ubah kata kunci pencarian atau filter status.',
          ),
        ),
      ];
    }

    return [
      if (_isLoading)
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: LinearProgressIndicator(minHeight: 2, color: _brandBlue, backgroundColor: Colors.transparent),
          ),
        ),
      SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        sliver: SliverList(
          delegate: SliverChildBuilderDelegate(
            (ctx, i) => _buildCustomerCard(list[i]),
            childCount: list.length,
          ),
        ),
      ),
    ];
  }

  Widget _buildStateView({
    required IconData icon,
    required Color color,
    required String title,
    required String subtitle,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(32, 48, 32, 0),
      child: Column(
        children: [
          Container(
            width: 84,
            height: 84,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 40, color: color.withValues(alpha: 0.8)),
          ),
          const SizedBox(height: 16),
          Text(title, style: const TextStyle(color: _textDark, fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(color: _textBody, fontSize: 13, height: 1.4),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 18),
            ElevatedButton.icon(
              onPressed: onAction,
              style: ElevatedButton.styleFrom(
                backgroundColor: _brandBlue,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: Text(actionLabel, style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSkeletonCard() {
    Widget bar(double w, double h) => Container(
          width: w,
          height: h,
          decoration: BoxDecoration(color: const Color(0xFFE9EEF5), borderRadius: BorderRadius.circular(6)),
        );
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(color: const Color(0xFFE9EEF5), borderRadius: BorderRadius.circular(14)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [bar(140, 12), const SizedBox(height: 8), bar(90, 10), const SizedBox(height: 8), bar(200, 10)],
            ),
          ),
        ],
      ),
    );
  }

  // ───────────────────────────── CARD ─────────────────────────────
  Widget _buildCustomerCard(CustomerModel cust) {
    final statusColor = cust.isOnline ? AppColors.success : AppColors.danger;
    final hasPhone = cust.phone != null && cust.phone!.isNotEmpty;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(color: _navyDeep.withValues(alpha: 0.05), blurRadius: 14, offset: const Offset(0, 4)),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => _showCustomerDetail(cust),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildAvatar(cust, 46),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            cust.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: _textDark, fontWeight: FontWeight.w800, fontSize: 14.5),
                          ),
                          const SizedBox(height: 3),
                          Row(
                            children: [
                              const Icon(Icons.badge_outlined, size: 12, color: _brandBlue),
                              const SizedBox(width: 4),
                              Flexible(
                                child: Text(
                                  cust.customerNumber,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: _brandBlue, fontWeight: FontWeight.w700, fontSize: 11.5),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 3),
                          Row(
                            children: [
                              const Icon(Icons.location_on_outlined, size: 12, color: _textMuted),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  cust.address ?? 'Alamat belum diisi',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: _textMuted, fontSize: 11.5),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            cust.isOnline ? 'Online' : 'Offline',
                            style: TextStyle(color: statusColor, fontSize: 10.5, fontWeight: FontWeight.w800),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // Info teknis
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _border.withValues(alpha: 0.7)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: _buildInfoItem(
                          icon: Icons.hub_outlined,
                          label: 'ODP / Port',
                          value: cust.odpName != null ? '${cust.odpName} • P${cust.odpPort ?? 1}' : 'Belum terpetakan',
                          valueColor: cust.odpName != null ? _textDark : _textMuted,
                        ),
                      ),
                      Container(width: 1, height: 30, color: _border),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildInfoItem(
                          icon: Icons.settings_input_antenna_rounded,
                          label: 'Redaman RX',
                          value: cust.rxPower != null ? '${cust.rxPower!.toStringAsFixed(2)} dBm' : '-',
                          valueColor: _rxColor(cust.rxPower),
                          trailing: cust.rxPower != null
                              ? Container(
                                  margin: const EdgeInsets.only(left: 6),
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: _rxColor(cust.rxPower).withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    _rxLabel(cust.rxPower),
                                    style: TextStyle(color: _rxColor(cust.rxPower), fontSize: 9, fontWeight: FontWeight.w800),
                                  ),
                                )
                              : null,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                // Aksi
                Row(
                  children: [
                    if (hasPhone) ...[
                      Expanded(
                        child: _buildActionButton(
                          icon: Icons.call_rounded,
                          label: 'Hubungi',
                          color: AppColors.success,
                          onTap: () => _callCustomer(cust.phone),
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],
                    Expanded(
                      child: _buildActionButton(
                        icon: Icons.speed_rounded,
                        label: 'Cek Redaman',
                        color: _brandBlue,
                        filled: true,
                        onTap: () => _openPowerCheck(cust),
                      ),
                    ),
                    const SizedBox(width: 8),
                    _buildSquareAction(
                      icon: Icons.swap_horiz_rounded,
                      tooltip: 'Swap ONU',
                      onTap: () => _openSwap(cust),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAvatar(CustomerModel cust, double size) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [_navy, _brandBlue, _cyan],
            ),
            borderRadius: BorderRadius.circular(size * 0.3),
          ),
          child: Text(
            _initials(cust.name),
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: size * 0.34),
          ),
        ),
        Positioned(
          right: -2,
          bottom: -2,
          child: Container(
            width: size * 0.3,
            height: size * 0.3,
            decoration: BoxDecoration(
              color: cust.isOnline ? AppColors.success : AppColors.danger,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 2),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildInfoItem({
    required IconData icon,
    required String label,
    required String value,
    required Color valueColor,
    Widget? trailing,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 12, color: _textMuted),
            const SizedBox(width: 4),
            Text(label, style: const TextStyle(color: _textMuted, fontSize: 10.5, fontWeight: FontWeight.w600)),
          ],
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            Flexible(
              child: Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: valueColor, fontSize: 12.5, fontWeight: FontWeight.w800),
              ),
            ),
            if (trailing != null) trailing,
          ],
        ),
      ],
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
    bool filled = false,
  }) {
    return Material(
      color: filled ? color : color.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: SizedBox(
          height: 40,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: filled ? Colors.white : color),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: filled ? Colors.white : color,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSquareAction({required IconData icon, required String tooltip, required VoidCallback onTap}) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: _navy.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: SizedBox(
            width: 40,
            height: 40,
            child: Icon(icon, size: 20, color: _navy),
          ),
        ),
      ),
    );
  }

  void _openPowerCheck(CustomerModel cust) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => OntPowerCheckScreen(serialNumber: cust.onuSerial ?? cust.customerNumber),
      ),
    );
  }

  void _openSwap(CustomerModel cust) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => SwapOnuScreen(customer: cust)),
    );
  }

  // ───────────────────────────── DETAIL SHEET ─────────────────────────────
  void _showCustomerDetail(CustomerModel cust) {
    final hasPhone = cust.phone != null && cust.phone!.isNotEmpty;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.72,
          minChildSize: 0.45,
          maxChildSize: 0.92,
          builder: (_, scrollCtrl) => Container(
            decoration: const BoxDecoration(
              color: _bg,
              borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
            ),
            child: ListView(
              controller: scrollCtrl,
              padding: EdgeInsets.zero,
              children: [
                // Header sheet
                Container(
                  padding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [_navyDeep, _navy, _brandBlue],
                    ),
                    borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
                  ),
                  child: Column(
                    children: [
                      Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.35),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      const SizedBox(height: 18),
                      Row(
                        children: [
                          _buildAvatar(cust, 56),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  cust.name,
                                  style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  cust.customerNumber,
                                  style: const TextStyle(color: Color(0xFFB9D7F2), fontSize: 12.5, fontWeight: FontWeight.w600),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: (cust.isOnline ? AppColors.success : AppColors.danger).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: (cust.isOnline ? AppColors.success : AppColors.danger).withValues(alpha: 0.5),
                              ),
                            ),
                            child: Text(
                              cust.isOnline ? 'ONLINE' : 'OFFLINE',
                              style: TextStyle(
                                color: cust.isOnline ? const Color(0xFF34D399) : const Color(0xFFF87171),
                                fontSize: 10.5,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _detailSection('Informasi Kontak', [
                        _detailRow(Icons.phone_outlined, 'No. HP', cust.phone ?? '-'),
                        _detailRow(Icons.email_outlined, 'Email', cust.email ?? '-'),
                        _detailRow(Icons.location_on_outlined, 'Alamat', cust.address ?? '-'),
                        if (cust.latitude != null && cust.longitude != null)
                          _detailRow(
                            Icons.my_location_rounded,
                            'Koordinat',
                            '${cust.latitude!.toStringAsFixed(6)}, ${cust.longitude!.toStringAsFixed(6)}',
                          ),
                      ]),
                      const SizedBox(height: 12),
                      _detailSection('Informasi Jaringan', [
                        _detailRow(Icons.router_outlined, 'SN ONU', cust.onuSn ?? '-', copyable: cust.onuSn != null),
                        _detailRow(Icons.memory_rounded, 'MAC ONU', cust.onuMac ?? '-', copyable: cust.onuMac != null),
                        _detailRow(
                          Icons.hub_outlined,
                          'ODP / Port',
                          cust.odpName != null ? '${cust.odpName} • Port ${cust.odpPort ?? 1}' : 'Belum terpetakan',
                        ),
                        _detailRow(
                          Icons.settings_input_antenna_rounded,
                          'Redaman RX',
                          cust.rxPower != null ? '${cust.rxPower!.toStringAsFixed(2)} dBm (${_rxLabel(cust.rxPower)})' : '-',
                          valueColor: _rxColor(cust.rxPower),
                        ),
                      ]),
                      const SizedBox(height: 18),
                      Row(
                        children: [
                          if (hasPhone) ...[
                            Expanded(
                              child: _buildActionButton(
                                icon: Icons.call_rounded,
                                label: 'Telepon',
                                color: AppColors.success,
                                onTap: () => _callCustomer(cust.phone),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _buildActionButton(
                                icon: Icons.chat_rounded,
                                label: 'WhatsApp',
                                color: const Color(0xFF16A34A),
                                onTap: () => _whatsappCustomer(cust.phone),
                              ),
                            ),
                          ],
                        ],
                      ),
                      if (hasPhone) const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: _buildActionButton(
                              icon: Icons.speed_rounded,
                              label: 'Cek Redaman',
                              color: _brandBlue,
                              filled: true,
                              onTap: () {
                                Navigator.pop(ctx);
                                _openPowerCheck(cust);
                              },
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _buildActionButton(
                              icon: Icons.swap_horiz_rounded,
                              label: 'Swap ONU',
                              color: _navy,
                              onTap: () {
                                Navigator.pop(ctx);
                                _openSwap(cust);
                              },
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: MediaQuery.of(ctx).padding.bottom + 8),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _detailSection(String title, List<Widget> rows) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: _navyDeep.withValues(alpha: 0.04), blurRadius: 10, offset: const Offset(0, 3))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: _textDark, fontSize: 13.5, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          ...rows,
        ],
      ),
    );
  }

  Widget _detailRow(IconData icon, String label, String value, {Color? valueColor, bool copyable = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
              color: _brandBlue.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, size: 15, color: _brandBlue),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(color: _textMuted, fontSize: 11, fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(color: valueColor ?? _textDark, fontSize: 13, fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
          if (copyable)
            IconButton(
              visualDensity: VisualDensity.compact,
              icon: const Icon(Icons.copy_rounded, size: 16, color: _textMuted),
              onPressed: () {
                Clipboard.setData(ClipboardData(text: value));
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('$label disalin'),
                    behavior: SnackBarBehavior.floating,
                    backgroundColor: _navy,
                    duration: const Duration(seconds: 1),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}
