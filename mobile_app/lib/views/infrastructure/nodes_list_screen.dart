import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/api_constants.dart';
import '../../core/constants/app_colors.dart';
import '../../core/network/dio_client.dart';
import 'odp_port_monitoring_sheet.dart';

class NodesListScreen extends StatefulWidget {
  final String initialType;
  const NodesListScreen({super.key, this.initialType = 'ODP'});

  @override
  State<NodesListScreen> createState() => _NodesListScreenState();
}

class _NodesListScreenState extends State<NodesListScreen> {
  // Palet selaras dengan Login, Home, dan Data Pelanggan (FONA / BRImo navy)
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

  List<dynamic> _nodes = [];
  bool _isLoading = false;
  String? _errorMessage;
  late String _selectedType; // 'ALL', 'ODP', 'ODC', 'POP'
  String _selectedStatus = 'ALL'; // 'ALL', 'ACTIVE', 'MAINTENANCE', 'INACTIVE'
  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _selectedType = widget.initialType;
    _fetchNodes();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchNodes({bool force = false}) async {
    if (_isLoading) return;

    setState(() {
      _isLoading = true;
      if (_nodes.isEmpty) {
        _errorMessage = null;
      }
    });

    try {
      final Map<String, dynamic> params = {
        'per_page': 10000,
        'all': 'true',
      };
      if (force) {
        params['force'] = '1';
      }

      final response = await DioClient().dio.get(
        ApiConstants.endpointNetworkNodes,
        queryParameters: params,
      );

      if (response.data != null) {
        List<dynamic> rawData = [];
        if (response.data is List) {
          rawData = response.data;
        } else if (response.data is Map) {
          if (response.data['data'] is List) {
            rawData = response.data['data'];
          } else if (response.data['data'] is Map && response.data['data']['data'] is List) {
            rawData = response.data['data']['data'];
          }
        }

        if (!mounted) return;
        setState(() {
          _nodes = rawData;
          _isLoading = false;
          _errorMessage = null;
        });
      } else {
        if (!mounted) return;
        setState(() => _isLoading = false);
      }
    } on DioException catch (e) {
      if (!mounted) return;
      final msg = e.response?.data is Map
          ? (e.response?.data['message'] ?? 'Gagal memuat data node infrastruktur.')
          : (e.type == DioExceptionType.connectionTimeout || e.type == DioExceptionType.receiveTimeout
              ? 'Koneksi ke server timeout. Silakan coba lagi.'
              : 'Gagal terhubung ke server.');

      if (_nodes.isNotEmpty) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 3),
          ),
        );
      } else {
        setState(() {
          _errorMessage = msg;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      final msg = 'Terjadi kesalahan: $e';
      if (_nodes.isNotEmpty) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      } else {
        setState(() {
          _errorMessage = msg;
          _isLoading = false;
        });
      }
    }
  }

  void _openInMaps(dynamic lat, dynamic lng) async {
    if (lat == null || lng == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Koordinat GPS belum tercatat pada node ini.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    final url = 'https://www.google.com/maps/search/?api=1&query=$lat,$lng';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
            const SizedBox(width: 8),
            Text('$label berhasil disalin ke clipboard'),
          ],
        ),
        backgroundColor: _navyDeep,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _openPortMonitoring(Map<String, dynamic> node) {
    final rawId = node['id'];
    final nodeId = rawId is int ? rawId : int.tryParse(rawId?.toString() ?? '0') ?? 0;
    final name = (node['name'] ?? 'ODP').toString();
    final type = (node['node_type'] ?? 'ODP').toString().toUpperCase();

    final rawCap = node['capacity'] ?? node['total_ports'];
    final totalPorts = (rawCap is int ? rawCap : int.tryParse(rawCap?.toString() ?? '8')) ?? 8;

    final oltName = node['olt_name']?.toString() ??
        (node['olt_device'] is Map
            ? node['olt_device']['name']?.toString()
            : (node['olt'] is Map ? node['olt']['name']?.toString() : null));

    final interfaceRef = node['olt_port_ref']?.toString() ??
        node['interface_ref']?.toString() ??
        node['olt_interface']?.toString() ??
        node['interface']?.toString();

    final splitterRatio = node['splitter_ratio']?.toString() ??
        (node['splitter_type'] is Map ? node['splitter_type']['ratio']?.toString() : node['ratio']?.toString());

    OdpPortMonitoringSheet.show(
      context,
      nodeId: nodeId,
      nodeName: name,
      nodeType: type,
      totalPorts: totalPorts,
      oltName: oltName,
      interfaceRef: interfaceRef,
      splitterRatio: splitterRatio,
    );
  }

  IconData _getNodeIcon(String type) {
    switch (type.toUpperCase()) {
      case 'ODP':
        return Icons.hub_rounded;
      case 'ODC':
        return Icons.account_tree_rounded;
      case 'POP':
        return Icons.dns_rounded;
      default:
        return Icons.cable_rounded;
    }
  }

  Color _getStatusColor(String status) {
    final s = status.toLowerCase();
    if (s == 'active' || s == 'online' || s == 'aktif') {
      return AppColors.success;
    }
    if (s == 'maintenance' || s == 'perbaikan') {
      return AppColors.warning;
    }
    return AppColors.danger;
  }

  String _getStatusLabel(String status) {
    final s = status.toLowerCase();
    if (s == 'active' || s == 'online' || s == 'aktif') {
      return 'Aktif';
    }
    if (s == 'maintenance' || s == 'perbaikan') {
      return 'Maintenance';
    }
    return 'Non-Aktif';
  }

  @override
  Widget build(BuildContext context) {
    final filteredNodes = _nodes.where((node) {
      final type = (node['node_type'] ?? '').toString().toUpperCase();
      final status = (node['status'] ?? 'active').toString().toUpperCase();
      final name = (node['name'] ?? '').toString().toLowerCase();
      final code = (node['code'] ?? '').toString().toLowerCase();
      final address = (node['address'] ?? '').toString().toLowerCase();
      final oltName = (node['olt_name'] ??
              (node['olt_device'] is Map ? node['olt_device']['name'] : ''))
          .toString()
          .toLowerCase();
      final notes = (node['notes'] ?? '').toString().toLowerCase();

      final matchesType = _selectedType == 'ALL' || type == _selectedType;
      final matchesStatus = _selectedStatus == 'ALL' ||
          (_selectedStatus == 'ACTIVE' && (status == 'ACTIVE' || status == 'ONLINE')) ||
          (_selectedStatus == 'MAINTENANCE' && status == 'MAINTENANCE') ||
          (_selectedStatus == 'INACTIVE' && (status == 'INACTIVE' || status == 'OFFLINE'));

      if (!matchesType || !matchesStatus) return false;
      if (_searchQuery.isEmpty) return true;

      final queryLower = _searchQuery.toLowerCase().trim();
      final queryClean = queryLower.replaceAll(RegExp(r'[^a-z0-9]'), '');
      final nameClean = name.replaceAll(RegExp(r'[^a-z0-9]'), '');
      final codeClean = code.replaceAll(RegExp(r'[^a-z0-9]'), '');

      if (name.contains(queryLower) ||
          code.contains(queryLower) ||
          address.contains(queryLower) ||
          oltName.contains(queryLower) ||
          notes.contains(queryLower)) {
        return true;
      }

      if (queryClean.isNotEmpty && (nameClean.contains(queryClean) || codeClean.contains(queryClean))) {
        return true;
      }

      final tokens = queryLower.split(RegExp(r'\s+')).where((t) => t.isNotEmpty).toList();
      final combined = '$name $code $address $oltName $notes';
      return tokens.every((token) => combined.contains(token));
    }).toList();

    // Hitung ringkasan stats
    final odpCount = _nodes.where((n) => (n['node_type'] ?? '').toString().toUpperCase() == 'ODP').length;
    final odcCount = _nodes.where((n) => (n['node_type'] ?? '').toString().toUpperCase() == 'ODC').length;
    final activeCount = _nodes.where((n) {
      final s = (n['status'] ?? '').toString().toLowerCase();
      return s == 'active' || s == 'online' || s == 'aktif';
    }).length;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: _bg,
        body: RefreshIndicator(
          onRefresh: () => _fetchNodes(force: true),
          color: _brandBlue,
          backgroundColor: Colors.white,
          edgeOffset: 200,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
            slivers: [
              SliverToBoxAdapter(
                child: _buildHeader(odpCount, odcCount, activeCount),
              ),
              SliverToBoxAdapter(
                child: _buildFilterChipsBar(),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 14, 20, 10),
                  child: Row(
                    children: [
                      const Text(
                        'Daftar Node Infrastruktur',
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
                          '${filteredNodes.length}',
                          style: const TextStyle(color: _brandBlue, fontSize: 11.5, fontWeight: FontWeight.w800),
                        ),
                      ),
                      const Spacer(),
                      if (_selectedType != 'ALL' || _selectedStatus != 'ALL')
                        GestureDetector(
                          onTap: () => setState(() {
                            _selectedType = 'ALL';
                            _selectedStatus = 'ALL';
                          }),
                          child: const Row(
                            children: [
                              Icon(Icons.close_rounded, size: 14, color: _textMuted),
                              SizedBox(width: 2),
                              Text(
                                'Reset filter',
                                style: TextStyle(color: _textMuted, fontSize: 12, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              ..._buildBodySlivers(filteredNodes),
              const SliverToBoxAdapter(child: SizedBox(height: 110)),
            ],
          ),
        ),
      ),
    );
  }

  // ───────────────────────────── HEADER ─────────────────────────────
  Widget _buildHeader(int odpCount, int odcCount, int activeCount) {
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
                        child: Text(
                          'Data Node',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ),
                      _glassIconButton(
                        _isLoading ? Icons.hourglass_top_rounded : Icons.refresh_rounded,
                        () => _fetchNodes(force: true),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: _buildStatCard(
                          label: 'Total',
                          count: _nodes.length,
                          icon: Icons.grid_view_rounded,
                          accent: _neon,
                          isActive: _selectedType == 'ALL' && _selectedStatus == 'ALL',
                          onTap: () => setState(() {
                            _selectedType = 'ALL';
                            _selectedStatus = 'ALL';
                          }),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _buildStatCard(
                          label: 'ODP',
                          count: odpCount,
                          icon: Icons.hub_rounded,
                          accent: const Color(0xFF38BDF8),
                          isActive: _selectedType == 'ODP',
                          onTap: () => setState(() => _selectedType = _selectedType == 'ODP' ? 'ALL' : 'ODP'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _buildStatCard(
                          label: 'ODC',
                          count: odcCount,
                          icon: Icons.account_tree_rounded,
                          accent: const Color(0xFFA78BFA),
                          isActive: _selectedType == 'ODC',
                          onTap: () => setState(() => _selectedType = _selectedType == 'ODC' ? 'ALL' : 'ODC'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _buildStatCard(
                          label: 'Aktif',
                          count: activeCount,
                          icon: Icons.check_circle_outline_rounded,
                          accent: const Color(0xFF34D399),
                          isActive: _selectedStatus == 'ACTIVE',
                          onTap: () => setState(() => _selectedStatus = _selectedStatus == 'ACTIVE' ? 'ALL' : 'ACTIVE'),
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
          width: 38,
          height: 38,
          child: Icon(icon, color: Colors.white, size: 17),
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
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? Colors.white : Colors.white.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isActive ? Colors.white : Colors.white.withValues(alpha: 0.18),
            width: 1,
          ),
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.15),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    color: isActive ? accent.withValues(alpha: 0.15) : accent.withValues(alpha: 0.22),
                    borderRadius: BorderRadius.circular(5),
                  ),
                  child: Icon(icon, size: 10, color: accent),
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      color: isActive ? _textBody : Colors.white.withValues(alpha: 0.85),
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (isActive)
                  const Icon(Icons.check_circle_rounded, size: 10, color: _brandBlue),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '$count',
              style: TextStyle(
                color: isActive ? _textDark : Colors.white,
                fontSize: 14.5,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.2,
                height: 1.1,
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
        controller: _searchCtrl,
        textInputAction: TextInputAction.search,
        style: const TextStyle(color: _textDark, fontSize: 14, fontWeight: FontWeight.w500),
        onChanged: (v) => setState(() => _searchQuery = v.trim()),
        decoration: InputDecoration(
          hintText: 'Cari nama, kode, OLT, atau alamat node...',
          hintStyle: const TextStyle(color: _textMuted, fontSize: 13),
          prefixIcon: const Icon(Icons.search_rounded, color: _brandBlue, size: 22),
          suffixIcon: _searchQuery.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.cancel_rounded, color: _textMuted, size: 18),
                  onPressed: () {
                    _searchCtrl.clear();
                    setState(() => _searchQuery = '');
                  },
                )
              : null,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(vertical: 15),
        ),
      ),
    );
  }

  // ───────────────────────────── FILTER CHIPS ─────────────────────────────
  Widget _buildFilterChipsBar() {
    final types = [
      {'key': 'ALL', 'label': 'Semua'},
      {'key': 'ODP', 'label': 'ODP'},
      {'key': 'ODC', 'label': 'ODC'},
      {'key': 'POP', 'label': 'POP'},
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: [
          ...types.map((t) {
            final isSel = _selectedType == t['key'];
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(t['label']!),
                selected: isSel,
                onSelected: (val) {
                  if (val) setState(() => _selectedType = t['key']!);
                },
                selectedColor: _brandBlue,
                backgroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                  side: BorderSide(color: isSel ? _brandBlue : _border),
                ),
                labelStyle: TextStyle(
                  color: isSel ? Colors.white : _textBody,
                  fontSize: 12,
                  fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                ),
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                showCheckmark: false,
              ),
            );
          }),
          Container(width: 1, height: 20, color: _border, margin: const EdgeInsets.symmetric(horizontal: 4)),
          // Filter Status Button
          Padding(
            padding: const EdgeInsets.only(left: 4),
            child: ActionChip(
              avatar: Icon(
                Icons.filter_list_rounded,
                size: 15,
                color: _selectedStatus != 'ALL' ? _brandBlue : _textBody,
              ),
              label: Text(
                _selectedStatus == 'ALL' ? 'Status' : _getStatusLabel(_selectedStatus),
                style: TextStyle(
                  color: _selectedStatus != 'ALL' ? _brandBlue : _textBody,
                  fontSize: 12,
                  fontWeight: _selectedStatus != 'ALL' ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
              backgroundColor: _selectedStatus != 'ALL' ? _brandBlue.withValues(alpha: 0.1) : Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(color: _selectedStatus != 'ALL' ? _brandBlue : _border),
              ),
              onPressed: _showFilterSheet,
            ),
          ),
        ],
      ),
    );
  }

  void _showFilterSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          return Container(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
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
                    decoration: BoxDecoration(
                      color: const Color(0xFFCBD5E1),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Filter Status Node',
                  style: TextStyle(
                    color: _textDark,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    {'key': 'ALL', 'label': 'Semua Status'},
                    {'key': 'ACTIVE', 'label': 'Aktif'},
                    {'key': 'MAINTENANCE', 'label': 'Maintenance'},
                    {'key': 'INACTIVE', 'label': 'Non-Aktif'},
                  ].map((s) {
                    final isSel = _selectedStatus == s['key'];
                    return ChoiceChip(
                      label: Text(s['label']!),
                      selected: isSel,
                      selectedColor: _brandBlue,
                      backgroundColor: const Color(0xFFF1F5F9),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(color: isSel ? _brandBlue : _border),
                      ),
                      labelStyle: TextStyle(
                        color: isSel ? Colors.white : _textBody,
                        fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                        fontSize: 13,
                      ),
                      onSelected: (val) {
                        if (val) {
                          setModalState(() => _selectedStatus = s['key']!);
                          setState(() => _selectedStatus = s['key']!);
                        }
                      },
                      showCheckmark: false,
                    );
                  }).toList(),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _brandBlue,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Terapkan Filter', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  // ───────────────────────────── BODY ─────────────────────────────
  List<Widget> _buildBodySlivers(List<dynamic> list) {
    if (_isLoading && _nodes.isEmpty) {
      return [
        SliverList(
          delegate: SliverChildBuilderDelegate(
            (_, __) => _buildSkeletonCard(),
            childCount: 5,
          ),
        ),
      ];
    }

    if (_errorMessage != null && _nodes.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: _buildStateView(
            icon: Icons.cloud_off_rounded,
            color: AppColors.danger,
            title: 'Gagal memuat data',
            subtitle: _errorMessage!,
            actionLabel: 'Coba Lagi',
            onAction: () => _fetchNodes(force: true),
          ),
        ),
      ];
    }

    if (list.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: _buildStateView(
            icon: Icons.grid_view_rounded,
            color: _brandBlue,
            title: 'Node tidak ditemukan',
            subtitle: 'Coba ubah kata kunci pencarian atau filter tipe/status.',
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
            (ctx, i) {
              final node = list[i] as Map<String, dynamic>;
              return _buildNodeCard(node);
            },
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

  // ───────────────────────────── NODE CARD ─────────────────────────────
  Widget _buildNodeCard(Map<String, dynamic> node) {
    final name = (node['name'] ?? '-').toString();
    final address = (node['address'] ?? 'Alamat belum diisi').toString();
    final type = (node['node_type'] ?? 'ODP').toString().toUpperCase();
    final status = (node['status'] ?? 'active').toString();
    final statusColor = _getStatusColor(status);
    final statusLabel = _getStatusLabel(status);

    // OLT & Interface
    String oltName = '-';
    if (node['olt_name'] != null && node['olt_name'].toString().isNotEmpty) {
      oltName = node['olt_name'].toString();
    } else if (node['olt_device'] is Map && node['olt_device']['name'] != null) {
      oltName = node['olt_device']['name'].toString();
    } else if (node['olt'] is Map && node['olt']['name'] != null) {
      oltName = node['olt']['name'].toString();
    }

    final interfaceRef = (node['olt_port_ref'] ??
            node['interface_ref'] ??
            node['olt_interface'] ??
            node['interface'] ??
            '—')
        .toString();

    // Port Terisi
    final rawCap = node['total_ports'] ?? node['capacity'];
    final totalPorts = (rawCap is int ? rawCap : int.tryParse(rawCap?.toString() ?? '8')) ?? 8;

    int usedPorts = 0;
    if (node['used_ports'] is int) {
      usedPorts = node['used_ports'];
    } else if (node['ports_used'] is int) {
      usedPorts = node['ports_used'];
    } else if (node['active_ports'] is int) {
      usedPorts = node['active_ports'];
    } else if (node['ports'] is List) {
      usedPorts = (node['ports'] as List)
          .where((p) =>
              (p['status'] ?? '').toString().toLowerCase() == 'active' ||
              p['customer_name'] != null ||
              p['customer_id'] != null)
          .length;
    } else if (node['used_ports'] != null) {
      usedPorts = int.tryParse(node['used_ports'].toString()) ?? 0;
    }

    final percentage = totalPorts > 0 ? ((usedPorts / totalPorts) * 100).round() : 0;

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
          onTap: () => _showDetailModal(node),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildAvatar(type, statusColor),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: _textDark,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 14.5,
                                  ),
                                ),
                              ),
                              if (type != 'ODP') ...[
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: _navy.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    type,
                                    style: const TextStyle(color: _navy, fontSize: 9.5, fontWeight: FontWeight.w800),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              const Icon(Icons.location_on_outlined, size: 12, color: _textMuted),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  address,
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
                            statusLabel,
                            style: TextStyle(color: statusColor, fontSize: 10.5, fontWeight: FontWeight.w800),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // Info Teknis
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
                          icon: Icons.router_rounded,
                          label: 'OLT / Interface',
                          value: oltName != '-' ? '$oltName • $interfaceRef' : 'Belum terhubung OLT',
                          valueColor: oltName != '-' ? _textDark : _textMuted,
                        ),
                      ),
                      Container(width: 1, height: 30, color: _border),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.grid_view_rounded, size: 12, color: _textMuted),
                                const SizedBox(width: 4),
                                const Text('Utilisasi Port', style: TextStyle(color: _textMuted, fontSize: 10.5, fontWeight: FontWeight.w600)),
                                const Spacer(),
                                Text(
                                  '$usedPorts/$totalPorts',
                                  style: const TextStyle(color: _textDark, fontSize: 11.5, fontWeight: FontWeight.w800),
                                ),
                              ],
                            ),
                            const SizedBox(height: 5),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(3),
                              child: LinearProgressIndicator(
                                value: totalPorts > 0 ? (usedPorts / totalPorts).clamp(0.0, 1.0) : 0,
                                backgroundColor: _border,
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  percentage > 85 ? AppColors.danger : _brandBlue,
                                ),
                                minHeight: 4.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                // Aksi Button
                SizedBox(
                  width: double.infinity,
                  child: _buildActionButton(
                    icon: type == 'ODP' ? Icons.speed_rounded : Icons.info_outline_rounded,
                    label: type == 'ODP' ? 'Cek Port' : 'Lihat Detail',
                    color: _brandBlue,
                    filled: true,
                    onTap: () => type == 'ODP' ? _openPortMonitoring(node) : _showDetailModal(node),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAvatar(String type, Color statusColor) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: 46,
          height: 46,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [_navy, _brandBlue, _cyan],
            ),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(_getNodeIcon(type), color: Colors.white, size: 22),
        ),
        Positioned(
          right: -2,
          bottom: -2,
          child: Container(
            width: 14,
            height: 14,
            decoration: BoxDecoration(
              color: statusColor,
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
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: valueColor, fontSize: 11.5, fontWeight: FontWeight.w700),
        ),
      ],
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required Color color,
    required bool filled,
    required VoidCallback onTap,
  }) {
    return Material(
      color: filled ? color : color.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8.5),
          alignment: Alignment.center,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 14, color: filled ? Colors.white : color),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: filled ? Colors.white : color,
                  fontWeight: FontWeight.w800,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ───────────────────────────── DETAIL MODAL ─────────────────────────────
  void _showDetailModal(Map<String, dynamic> node) {
    final name = (node['name'] ?? 'Node Infrastruktur').toString();
    final type = (node['node_type'] ?? 'ODP').toString().toUpperCase();
    final status = (node['status'] ?? 'active').toString();
    final statusColor = _getStatusColor(status);
    final statusLabel = _getStatusLabel(status);
    final address = (node['address'] ?? 'Alamat belum diisi').toString();
    final lat = node['latitude'];
    final lng = node['longitude'];
    final notes = (node['notes'] ?? '').toString();

    // OLT & Interface
    String oltName = '-';
    if (node['olt_name'] != null && node['olt_name'].toString().isNotEmpty) {
      oltName = node['olt_name'].toString();
    } else if (node['olt_device'] is Map && node['olt_device']['name'] != null) {
      oltName = node['olt_device']['name'].toString();
    } else if (node['olt'] is Map && node['olt']['name'] != null) {
      oltName = node['olt']['name'].toString();
    }

    final interfaceRef = (node['olt_port_ref'] ??
            node['interface_ref'] ??
            node['olt_interface'] ??
            node['interface'] ??
            '-')
        .toString();

    // Splitter & Parent
    final splitterName = node['splitter_type'] is Map
        ? (node['splitter_type']['name'] ?? node['splitter_type']['ratio'] ?? '-')
        : (node['splitter_ratio'] ?? node['ratio'] ?? '-');
    final parentName = node['parent_node'] is Map
        ? (node['parent_node']['name'] ?? node['parent_node']['code'] ?? '-')
        : (node['parent'] is Map ? (node['parent']['name'] ?? '-') : null);

    // Tube & Core
    String rawTube = (node['tube_info'] ?? node['tube'] ?? '').toString();
    String tubeDisplay = rawTube.isNotEmpty
        ? (rawTube.toUpperCase().startsWith('TUBE') ? rawTube.toUpperCase() : 'TUBE ${rawTube.toUpperCase()}')
        : 'TUBE BIRU';

    String rawCore = (node['core_color'] ?? node['core'] ?? '').toString();
    String coreDisplay = rawCore.isNotEmpty
        ? (rawCore.toUpperCase().startsWith('CORE') ? rawCore : 'Core ${rawCore.toUpperCase()}')
        : 'Core BIRU';

    // Port & Clients
    final rawCap = node['total_ports'] ?? node['capacity'];
    final totalPorts = (rawCap is int ? rawCap : int.tryParse(rawCap?.toString() ?? '8')) ?? 8;

    int usedPorts = 0;
    if (node['used_ports'] is int) {
      usedPorts = node['used_ports'];
    } else if (node['ports_used'] is int) {
      usedPorts = node['ports_used'];
    } else if (node['active_ports'] is int) {
      usedPorts = node['active_ports'];
    } else if (node['ports'] is List) {
      usedPorts = (node['ports'] as List)
          .where((p) =>
              (p['status'] ?? '').toString().toLowerCase() == 'active' ||
              p['customer_name'] != null ||
              p['customer_id'] != null)
          .length;
    } else if (node['used_ports'] != null) {
      usedPorts = int.tryParse(node['used_ports'].toString()) ?? 0;
    }

    final percentage = totalPorts > 0 ? ((usedPorts / totalPorts) * 100).round() : 0;
    final corePower = node['core_power']?.toString();
    final rxRange = node['rx_power_range']?.toString();
    final totalClients = node['total_clients']?.toString();
    final onlineClients = node['online_clients']?.toString();

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (ctx, scrollController) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // Top Drag Handle
              Center(
                child: Container(
                  width: 44,
                  height: 4.5,
                  margin: const EdgeInsets.only(top: 12, bottom: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),

              // Header Title
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        color: _brandBlue.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        type,
                        style: const TextStyle(
                          color: _brandBlue,
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        name,
                        style: const TextStyle(
                          color: _textDark,
                          fontSize: 16.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.2,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
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
                            statusLabel,
                            style: TextStyle(
                              color: statusColor,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const Divider(color: _border, height: 1),

              // Scrollable Body
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                  children: [
                    // Section 1: Lokasi & Geotag
                    _buildSectionHeader(Icons.location_on_rounded, 'Lokasi & Alamat'),
                    _buildDetailCard([
                      _buildDetailRow('Alamat', address),
                      if (lat != null && lng != null)
                        _buildDetailRow(
                          'Koordinat GPS',
                          '$lat, $lng',
                          actionWidget: IconButton(
                            constraints: const BoxConstraints(),
                            padding: EdgeInsets.zero,
                            icon: const Icon(Icons.copy_rounded, size: 15, color: _brandBlue),
                            tooltip: 'Salin Koordinat',
                            onPressed: () => _copyToClipboard('$lat, $lng', 'Koordinat GPS'),
                          ),
                        ),
                    ]),

                    const SizedBox(height: 16),

                    // Section 2: OLT & Jalur Distribusi
                    _buildSectionHeader(Icons.router_rounded, 'Uplink & Distribusi OLT'),
                    _buildDetailCard([
                      _buildDetailRow('Perangkat OLT', oltName),
                      _buildDetailRow('Interface PON', interfaceRef, isAccent: true),
                      if (parentName != null) _buildDetailRow('Parent Node', parentName),
                      if (splitterName != '-' && splitterName != null)
                        _buildDetailRow('Splitter Ratio', splitterName.toString()),
                    ]),

                    const SizedBox(height: 16),

                    // Section 3: Serat Optik & Redaman
                    _buildSectionHeader(Icons.cable_rounded, 'Serat Optik & Redaman'),
                    _buildDetailCard([
                      _buildDetailRow('Tube & Core', '$tubeDisplay • $coreDisplay'),
                      if (corePower != null && corePower.isNotEmpty)
                        _buildDetailRow('Core Power (Input)', '$corePower dBm'),
                      if (rxRange != null && rxRange.isNotEmpty)
                        _buildDetailRow('Redaman Pelanggan', rxRange, isAccent: true),
                    ]),

                    const SizedBox(height: 16),

                    // Section 4: Kapasitas & Utilisasi Port
                    _buildSectionHeader(Icons.grid_view_rounded, 'Kapasitas & Utilisasi Port'),
                    _buildDetailCard([
                      _buildDetailRow('Port Terisi', '$usedPorts dari $totalPorts Port ($percentage%)'),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: totalPorts > 0 ? (usedPorts / totalPorts).clamp(0.0, 1.0) : 0,
                            backgroundColor: _border,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              percentage > 85 ? AppColors.danger : _brandBlue,
                            ),
                            minHeight: 6,
                          ),
                        ),
                      ),
                      if (totalClients != null && totalClients != '0')
                        _buildDetailRow(
                          'Pelanggan Terhubung',
                          '$onlineClients / $totalClients Online',
                        ),
                    ]),

                    if (notes.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      _buildSectionHeader(Icons.notes_rounded, 'Catatan / Konfigurasi'),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: _border),
                        ),
                        child: Text(
                          notes,
                          style: const TextStyle(
                            color: _textDark,
                            fontSize: 13,
                            height: 1.45,
                          ),
                        ),
                      ),
                    ],

                    const SizedBox(height: 24),
                  ],
                ),
              ),

              // Bottom Persistent Actions
              Container(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: _border)),
                ),
                child: Row(
                  children: [
                    if (lat != null && lng != null) ...[
                      Expanded(
                        flex: 1,
                        child: OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: _cyan,
                            side: const BorderSide(color: _cyan, width: 1.2),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: () {
                            Navigator.pop(ctx);
                            _openInMaps(lat, lng);
                          },
                          icon: const Icon(Icons.near_me_rounded, size: 16),
                          label: const Text(
                            'Maps',
                            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                    ],
                    if (type == 'ODP')
                      Expanded(
                        flex: 2,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _brandBlue,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: () {
                            Navigator.pop(ctx);
                            _openPortMonitoring(node);
                          },
                          icon: const Icon(Icons.speed_rounded, size: 16),
                          label: const Text(
                            'Cek Port',
                            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(IconData icon, String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Icon(icon, size: 15, color: _brandBlue),
          const SizedBox(width: 6),
          Text(
            title,
            style: const TextStyle(
              color: _textDark,
              fontWeight: FontWeight.w800,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailCard(List<Widget> children) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {bool isAccent = false, Widget? actionWidget}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 125,
            child: Text(
              label,
              style: const TextStyle(
                color: _textMuted,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                color: isAccent ? _brandBlue : _textDark,
                fontSize: 12.5,
                fontWeight: isAccent ? FontWeight.w700 : FontWeight.w600,
              ),
            ),
          ),
          if (actionWidget != null) actionWidget,
        ],
      ),
    );
  }
}
