import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/dio_client.dart';
import '../odp/odp_form_screen.dart';
import 'odp_port_monitoring_sheet.dart';

class NodesListScreen extends StatefulWidget {
  final String initialType;
  const NodesListScreen({super.key, this.initialType = 'ODP'});

  @override
  State<NodesListScreen> createState() => _NodesListScreenState();
}

class _NodesListScreenState extends State<NodesListScreen> {
  List<dynamic> _nodes = [];
  bool _isLoading = true;
  String? _errorMessage;
  late String _selectedType;
  String _selectedStatus = 'ALL';
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

  Future<void> _fetchNodes() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Ambil seluruh data node dari backend tanpa paginasi terpotong (per_page=10000 & all=true)
      final response = await DioClient().dio.get(
        ApiConstants.endpointNetworkNodes,
        queryParameters: {
          'per_page': 10000,
          'all': 'true',
        },
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
        setState(() {
          _nodes = rawData;
          _isLoading = false;
        });
      }
    } on DioException catch (e) {
      setState(() {
        _errorMessage = e.response?.data?['message'] ?? 'Gagal memuat data node infrastruktur.';
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Terjadi kesalahan: $e';
        _isLoading = false;
      });
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
        backgroundColor: const Color(0xFF0F172A),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _openPortMonitoring(Map<String, dynamic> node) {
    final rawId = node['id'];
    final nodeId = rawId is int ? rawId : int.tryParse(rawId?.toString() ?? '0') ?? 0;
    final name = (node['name'] ?? 'ODP').toString();
    final type = (node['node_type'] ?? 'ODP').toString().toUpperCase();

    // Total capacity
    final rawCap = node['capacity'] ?? node['total_ports'];
    final totalPorts = (rawCap is int ? rawCap : int.tryParse(rawCap?.toString() ?? '8')) ?? 8;

    // OLT & Interface
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

  void _showDetailModal(Map<String, dynamic> node) {
    final name = (node['name'] ?? 'Node Infrastruktur').toString();
    final code = (node['code'] ?? '-').toString();
    final type = (node['node_type'] ?? 'ODP').toString().toUpperCase();
    final status = (node['status'] ?? 'active').toString().toLowerCase();
    final isActive = status == 'active' || status == 'online';
    final isMaintenance = status == 'maintenance';
    final address = (node['address'] ?? '-').toString();
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
              // ── Top Drag Handle ──
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

              // ── Main Header Title ──
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF00AAE0).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFF00AAE0).withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        type,
                        style: const TextStyle(
                          color: Color(0xFF00AAE0),
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: const TextStyle(
                              color: Color(0xFF0F172A),
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.3,
                            ),
                          ),
                          Row(
                            children: [
                              Text(
                                code,
                                style: const TextStyle(
                                  color: Color(0xFF64748B),
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              IconButton(
                                constraints: const BoxConstraints(),
                                padding: const EdgeInsets.only(left: 6),
                                icon: const Icon(Icons.copy_rounded, size: 14, color: Color(0xFF94A3B8)),
                                onPressed: () => _copyToClipboard(code, 'Kode Node'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: isActive
                            ? const Color(0xFFECFDF5)
                            : (isMaintenance ? const Color(0xFFFFFBEB) : const Color(0xFFFEF2F2)),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isActive
                              ? const Color(0xFF6EE7B7)
                              : (isMaintenance ? const Color(0xFFFDE68A) : const Color(0xFFFCA5A5)),
                        ),
                      ),
                      child: Text(
                        isActive ? 'Aktif' : (isMaintenance ? 'Maintenance' : 'Non-Aktif'),
                        style: TextStyle(
                          color: isActive
                              ? const Color(0xFF059669)
                              : (isMaintenance ? const Color(0xFFD97706) : const Color(0xFFDC2626)),
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const Divider(color: Color(0xFFE2E8F0), height: 1),

              // ── Scrollable Body Sections ──
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
                            icon: const Icon(Icons.copy_rounded, size: 15, color: Color(0xFF00AAE0)),
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

                    // Section 3: Serat Optik & Telemetri
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
                            backgroundColor: const Color(0xFFE2E8F0),
                            valueColor: AlwaysStoppedAnimation<Color>(
                              percentage > 85 ? const Color(0xFFEF4444) : const Color(0xFF00AAE0),
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

                    // Section 5: Catatan & Keterangan
                    if (notes.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      _buildSectionHeader(Icons.notes_rounded, 'Catatan / Konfigurasi'),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Text(
                          notes,
                          style: const TextStyle(
                            color: Color(0xFF334155),
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

              // ── Bottom Persistent Action Buttons ──
              Container(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
                ),
                child: Row(
                  children: [
                    // Button: Buka Maps
                    Expanded(
                      flex: 1,
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF0284C7),
                          side: const BorderSide(color: Color(0xFFBAE6FD), width: 1.5),
                          backgroundColor: const Color(0xFFF0F9FF),
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: () {
                          Navigator.pop(ctx);
                          _openInMaps(lat, lng);
                        },
                        icon: const Icon(Icons.near_me_rounded, size: 17),
                        label: const Text(
                          'Buka Maps',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    // Button: Cek Port
                    Expanded(
                      flex: 1,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF00AAE0),
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: () {
                          Navigator.pop(ctx);
                          _openPortMonitoring(node);
                        },
                        icon: const Icon(Icons.speed_rounded, color: Colors.white, size: 17),
                        label: const Text(
                          'Cek Port',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
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
          Icon(icon, size: 16, color: const Color(0xFF00AAE0)),
          const SizedBox(width: 6),
          Text(
            title,
            style: const TextStyle(
              color: Color(0xFF0F172A),
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
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
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
            width: 130,
            child: Text(
              label,
              style: const TextStyle(
                color: Color(0xFF64748B),
                fontSize: 12.5,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                color: isAccent ? const Color(0xFF0284C7) : const Color(0xFF0F172A),
                fontSize: 13,
                fontWeight: isAccent ? FontWeight.w700 : FontWeight.w600,
              ),
            ),
          ),
          if (actionWidget != null) actionWidget,
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
            padding: const EdgeInsets.all(20),
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
                    decoration: BoxDecoration(
                      color: const Color(0xFFCBD5E1),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Filter Data Node',
                  style: TextStyle(
                    color: Color(0xFF0F172A),
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Tipe Node:', style: TextStyle(color: Color(0xFF475569), fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: ['ODP', 'ODC', 'POP', 'ALL'].map((t) {
                    final isSel = _selectedType == t;
                    final label = t == 'ALL' ? 'Semua Tipe' : t;
                    return ChoiceChip(
                      label: Text(label),
                      selected: isSel,
                      selectedColor: const Color(0xFF00AAE0).withValues(alpha: 0.15),
                      labelStyle: TextStyle(
                        color: isSel ? const Color(0xFF00AAE0) : const Color(0xFF475569),
                        fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                      ),
                      onSelected: (val) {
                        if (val) {
                          setModalState(() => _selectedType = t);
                          setState(() => _selectedType = t);
                        }
                      },
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),
                const Text('Status:', style: TextStyle(color: Color(0xFF475569), fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
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
                      selectedColor: const Color(0xFF00AAE0).withValues(alpha: 0.15),
                      labelStyle: TextStyle(
                        color: isSel ? const Color(0xFF00AAE0) : const Color(0xFF475569),
                        fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                      ),
                      onSelected: (val) {
                        if (val) {
                          setModalState(() => _selectedStatus = s['key']!);
                          setState(() => _selectedStatus = s['key']!);
                        }
                      },
                    );
                  }).toList(),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF00AAE0),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Terapkan Filter', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(height: 10),
              ],
            ),
          );
        },
      ),
    );
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

      // Smart fuzzy search matching (handles spaces, dashes, codes like "odp 201", "ODP-201", "201", etc.)
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

      // Multi-word token matching
      final tokens = queryLower.split(RegExp(r'\s+')).where((t) => t.isNotEmpty).toList();
      final combined = '$name $code $address $oltName $notes';
      return tokens.every((token) => combined.contains(token));
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        title: const Text(
          'Data Node',
          style: TextStyle(
            color: Color(0xFF0F172A),
            fontWeight: FontWeight.w800,
            fontSize: 18,
            letterSpacing: -0.3,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF475569)),
            tooltip: 'Refresh Data',
            onPressed: _fetchNodes,
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Search & Filter Bar Container ──
          Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: Row(
              children: [
                // Search Input Box
                Expanded(
                  child: Container(
                    height: 44,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFCBD5E1)),
                    ),
                    child: TextField(
                      controller: _searchCtrl,
                      onChanged: (val) => setState(() => _searchQuery = val.trim()),
                      style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'Cari nama, kode, atau alamat ODP...',
                        hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12.5),
                        prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF64748B), size: 19),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear_rounded, color: Color(0xFF64748B), size: 16),
                                onPressed: () {
                                  _searchCtrl.clear();
                                  setState(() => _searchQuery = '');
                                },
                              )
                            : null,
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(vertical: 11, horizontal: 8),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // Filter Button
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: _showFilterSheet,
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      height: 44,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: _selectedType != 'ALL' || _selectedStatus != 'ALL'
                            ? const Color(0xFFF0F9FF)
                            : Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: _selectedType != 'ALL' || _selectedStatus != 'ALL'
                              ? const Color(0xFF00AAE0)
                              : const Color(0xFFCBD5E1),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.filter_alt_outlined,
                            size: 17,
                            color: _selectedType != 'ALL' || _selectedStatus != 'ALL'
                                ? const Color(0xFF00AAE0)
                                : const Color(0xFF334155),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            'Filter',
                            style: TextStyle(
                              color: _selectedType != 'ALL' || _selectedStatus != 'ALL'
                                  ? const Color(0xFF00AAE0)
                                  : const Color(0xFF334155),
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
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

          // ── Node List View (Table-Card Style) ──
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF00AAE0)),
                    ),
                  )
                : _errorMessage != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24.0),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 48),
                              const SizedBox(height: 12),
                              Text(
                                _errorMessage!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(color: Color(0xFF64748B), fontSize: 14),
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF00AAE0),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                onPressed: _fetchNodes,
                                child: const Text('Coba Lagi', style: TextStyle(color: Colors.white)),
                              ),
                            ],
                          ),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _fetchNodes,
                        color: const Color(0xFF00AAE0),
                        backgroundColor: Colors.white,
                        child: filteredNodes.isEmpty
                            ? Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Icon(
                                      Icons.grid_view_rounded,
                                      size: 48,
                                      color: Color(0xFFCBD5E1),
                                    ),
                                    const SizedBox(height: 12),
                                    Text(
                                      'Tidak ada data ${_selectedType == 'ALL' ? 'Node' : _selectedType} ditemukan.',
                                      style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14, fontWeight: FontWeight.w500),
                                    ),
                                  ],
                                ),
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
                                itemCount: filteredNodes.length,
                                itemBuilder: (ctx, i) {
                                  final node = filteredNodes[i] as Map<String, dynamic>;
                                  return _buildStructuredNodeCard(node);
                                },
                              ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildStructuredNodeCard(Map<String, dynamic> node) {
    final name = (node['name'] ?? '-').toString();
    final address = (node['address'] ?? '-').toString().toUpperCase();
    final type = (node['node_type'] ?? 'ODP').toString().toUpperCase();

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
            '')
        .toString();

    // Tube & Core
    String rawTube = (node['tube_info'] ?? node['tube'] ?? '').toString();
    String tubeDisplay = rawTube.isNotEmpty
        ? (rawTube.toUpperCase().startsWith('TUBE') ? rawTube.toUpperCase() : 'TUBE ${rawTube.toUpperCase()}')
        : 'TUBE BIRU';

    String rawCore = (node['core_color'] ?? node['core'] ?? '').toString();
    String coreDisplay = rawCore.isNotEmpty
        ? (rawCore.toUpperCase().startsWith('CORE') ? rawCore : 'Core ${rawCore.toUpperCase()}')
        : 'Core BIRU';

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
    final portTerisiText = '$usedPorts/$totalPorts Port ($percentage%)';

    // Status
    final status = (node['status'] ?? 'active').toString().toLowerCase();
    final isActive = status == 'active' || status == 'online';
    final isMaintenance = status == 'maintenance';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFCBD5E1), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(7),
        child: Column(
          children: [
            // ── Row 1: Name ──
            _buildTableRow(
              label: 'Name',
              valueWidget: Text(
                name,
                style: const TextStyle(
                  color: Color(0xFF0F172A),
                  fontWeight: FontWeight.bold,
                  fontSize: 13.5,
                ),
              ),
            ),

            // ── Row 2: Address ──
            _buildTableRow(
              label: 'Address',
              valueWidget: Text(
                address,
                style: const TextStyle(
                  color: Color(0xFF334155),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),

            // ── Row 3: OLT & Interface ──
            _buildTableRow(
              label: 'OLT & Interface',
              valueWidget: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    oltName,
                    style: const TextStyle(
                      color: Color(0xFF0F172A),
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  if (interfaceRef.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      interfaceRef,
                      style: const TextStyle(
                        color: Color(0xFF0284C7),
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // ── Row 4: Tube & Core ──
            _buildTableRow(
              label: 'Tube & Core',
              valueWidget: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tubeDisplay,
                    style: const TextStyle(
                      color: Color(0xFF0F172A),
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    coreDisplay,
                    style: const TextStyle(
                      color: Color(0xFF64748B),
                      fontWeight: FontWeight.w500,
                      fontSize: 11.5,
                    ),
                  ),
                ],
              ),
            ),

            // ── Row 5: Port Terisi ──
            _buildTableRow(
              label: 'Port Terisi',
              valueWidget: Text(
                portTerisiText,
                style: const TextStyle(
                  color: Color(0xFF0F172A),
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
            ),

            // ── Row 6: Status ──
            _buildTableRow(
              label: 'Status',
              valueWidget: Align(
                alignment: Alignment.centerLeft,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: isActive
                        ? const Color(0xFFECFDF5)
                        : (isMaintenance ? const Color(0xFFFFFBEB) : const Color(0xFFFEF2F2)),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: isActive
                          ? const Color(0xFF6EE7B7)
                          : (isMaintenance ? const Color(0xFFFDE68A) : const Color(0xFFFCA5A5)),
                    ),
                  ),
                  child: Text(
                    isActive ? 'Aktif' : (isMaintenance ? 'Maintenance' : 'Non-Aktif'),
                    style: TextStyle(
                      color: isActive
                          ? const Color(0xFF059669)
                          : (isMaintenance ? const Color(0xFFD97706) : const Color(0xFFDC2626)),
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),

            // ── Row 7: Action Footer ──
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: const BoxDecoration(
                color: Color(0xFFF8FAFC),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  // Button: Port (Opens Port Monitoring Sheet)
                  if (type == 'ODP')
                    Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => _openPortMonitoring(node),
                        borderRadius: BorderRadius.circular(6),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFF059669),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'Port',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ),
                    ),

                  const SizedBox(width: 8),

                  // Button: Detail
                  Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => _showDetailModal(node),
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFF94A3B8)),
                        ),
                        child: const Text(
                          'Detail',
                          style: TextStyle(
                            color: Color(0xFF334155),
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(width: 8),

                  // Button: Maintenance
                  Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => OdpFormScreen(
                              prefilledOdpCode: node['code']?.toString(),
                              prefilledOdpName: name,
                              prefilledOdpNodeId: node['id'],
                            ),
                          ),
                        );
                      },
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFFBEB),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFFDE68A)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.settings_outlined, color: Color(0xFFD97706), size: 14),
                            SizedBox(width: 4),
                            Text(
                              'Maintenance',
                              style: TextStyle(
                                color: Color(0xFFD97706),
                                fontWeight: FontWeight.w700,
                                fontSize: 12,
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
          ],
        ),
      ),
    );
  }

  Widget _buildTableRow({
    required String label,
    required Widget valueWidget,
    bool isHeader = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      decoration: BoxDecoration(
        color: isHeader ? const Color(0xFFF1F5F9) : Colors.white,
        border: const Border(
          bottom: BorderSide(color: Color(0xFFE2E8F0), width: 1),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: TextStyle(
                color: isHeader ? const Color(0xFF475569) : const Color(0xFF64748B),
                fontSize: 12.5,
                fontWeight: isHeader ? FontWeight.bold : FontWeight.w500,
              ),
            ),
          ),
          Expanded(child: valueWidget),
        ],
      ),
    );
  }
}
