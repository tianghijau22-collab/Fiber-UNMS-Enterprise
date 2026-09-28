import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/api_constants.dart';
import '../../core/constants/app_colors.dart';
import '../../core/network/dio_client.dart';
import '../odp/odp_form_screen.dart';

class NodesListScreen extends StatefulWidget {
  final String initialType;
  const NodesListScreen({super.key, this.initialType = 'ALL'});

  @override
  State<NodesListScreen> createState() => _NodesListScreenState();
}

class _NodesListScreenState extends State<NodesListScreen> {
  List<dynamic> _nodes = [];
  bool _isLoading = true;
  String? _errorMessage;
  late String _selectedType;
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
      final response = await DioClient().dio.get(ApiConstants.endpointNetworkNodes);
      if (response.data != null) {
        final rawData = response.data is List
            ? response.data
            : (response.data['data'] is List ? response.data['data'] : []);
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
    if (lat == null || lng == null) return;
    final url = 'https://www.google.com/maps/search/?api=1&query=$lat,$lng';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filteredNodes = _nodes.where((node) {
      final type = (node['node_type'] ?? '').toString().toUpperCase();
      final name = (node['name'] ?? '').toString().toLowerCase();
      final code = (node['code'] ?? '').toString().toLowerCase();
      final address = (node['address'] ?? '').toString().toLowerCase();

      final matchesType = _selectedType == 'ALL' || type == _selectedType;
      final matchesSearch = _searchQuery.isEmpty ||
          name.contains(_searchQuery.toLowerCase()) ||
          code.contains(_searchQuery.toLowerCase()) ||
          address.contains(_searchQuery.toLowerCase());

      return matchesType && matchesSearch;
    }).toList();

    final popCount = _nodes.where((n) => (n['node_type'] ?? '').toString().toUpperCase() == 'POP').length;
    final odcCount = _nodes.where((n) => (n['node_type'] ?? '').toString().toUpperCase() == 'ODC').length;
    final odpCount = _nodes.where((n) => (n['node_type'] ?? '').toString().toUpperCase() == 'ODP').length;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: const Text(
          'Data ODP, ODC, & POP',
          style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: _fetchNodes,
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Tabs (Semua, ODP, ODC, POP)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            color: AppColors.surface,
            child: Row(
              children: [
                Expanded(
                  child: _buildNodeTypeTab(
                    label: 'Semua',
                    count: _nodes.length,
                    type: 'ALL',
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: _buildNodeTypeTab(
                    label: 'ODP',
                    count: odpCount,
                    type: 'ODP',
                    color: AppColors.secondary,
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: _buildNodeTypeTab(
                    label: 'ODC',
                    count: odcCount,
                    type: 'ODC',
                    color: AppColors.warning,
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: _buildNodeTypeTab(
                    label: 'POP',
                    count: popCount,
                    type: 'POP',
                    color: AppColors.accent,
                  ),
                ),
              ],
            ),
          ),

          // Search Box
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (val) => setState(() => _searchQuery = val.trim()),
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Cari Kode Node, Nama ODP/ODC, Wilayah...',
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

          // Node List View
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
                              onPressed: _fetchNodes,
                              child: const Text('Coba Lagi', style: TextStyle(color: Colors.white)),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _fetchNodes,
                        color: AppColors.primary,
                        backgroundColor: AppColors.surface,
                        child: filteredNodes.isEmpty
                            ? const Center(
                                child: Text('Tidak ada node ditemukan.', style: TextStyle(color: AppColors.textMuted)),
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.all(16),
                                itemCount: filteredNodes.length,
                                itemBuilder: (ctx, i) {
                                  final node = filteredNodes[i];
                                  final name = node['name'] ?? 'Node Infrastruktur';
                                  final code = node['code'] ?? '-';
                                  final type = (node['node_type'] ?? 'ODP').toString().toUpperCase();
                                  final status = (node['status'] ?? 'active').toString().toLowerCase();
                                  final isActive = status == 'active' || status == 'online';
                                  final lat = node['latitude'];
                                  final lng = node['longitude'];
                                  final address = node['address'] ?? '-';
                                  final corePower = node['core_power'];

                                  Color typeColor = AppColors.secondary;
                                  if (type == 'POP') typeColor = AppColors.accent;
                                  if (type == 'ODC') typeColor = AppColors.warning;

                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 12),
                                    padding: const EdgeInsets.all(14),
                                    decoration: BoxDecoration(
                                      color: AppColors.surface,
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(color: AppColors.surfaceBorder),
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
                                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                  decoration: BoxDecoration(
                                                    color: typeColor.withValues(alpha: 0.15),
                                                    borderRadius: BorderRadius.circular(6),
                                                    border: Border.all(color: typeColor.withValues(alpha: 0.4)),
                                                  ),
                                                  child: Text(
                                                    type,
                                                    style: TextStyle(
                                                      color: typeColor,
                                                      fontWeight: FontWeight.bold,
                                                      fontSize: 11,
                                                    ),
                                                  ),
                                                ),
                                                const SizedBox(width: 8),
                                                Text(
                                                  code,
                                                  style: const TextStyle(
                                                    color: AppColors.textSecondary,
                                                    fontWeight: FontWeight.w600,
                                                    fontSize: 12,
                                                  ),
                                                ),
                                              ],
                                            ),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: (isActive ? AppColors.success : AppColors.danger).withValues(alpha: 0.15),
                                                borderRadius: BorderRadius.circular(4),
                                              ),
                                              child: Text(
                                                isActive ? 'Aktif' : 'Non-Aktif',
                                                style: TextStyle(
                                                  color: isActive ? AppColors.success : AppColors.danger,
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        Text(
                                          name,
                                          style: const TextStyle(
                                            color: AppColors.textPrimary,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 15,
                                          ),
                                        ),
                                        if (address != '-' && address.isNotEmpty) ...[
                                          const SizedBox(height: 4),
                                          Row(
                                            children: [
                                              const Icon(Icons.location_on_outlined, color: AppColors.textMuted, size: 13),
                                              const SizedBox(width: 4),
                                              Expanded(
                                                child: Text(
                                                  address,
                                                  style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],
                                        const SizedBox(height: 12),
                                        const Divider(color: AppColors.surfaceBorder, height: 1),
                                        const SizedBox(height: 10),
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            if (corePower != null)
                                              Row(
                                                children: [
                                                  const Icon(Icons.speed, color: AppColors.warning, size: 14),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    '$corePower dBm',
                                                    style: const TextStyle(
                                                      color: AppColors.warning,
                                                      fontWeight: FontWeight.bold,
                                                      fontSize: 12,
                                                    ),
                                                  ),
                                                ],
                                              )
                                            else
                                              const SizedBox(),
                                            Row(
                                              children: [
                                                if (lat != null && lng != null)
                                                  OutlinedButton.icon(
                                                    style: OutlinedButton.styleFrom(
                                                      foregroundColor: AppColors.secondary,
                                                      side: const BorderSide(color: AppColors.secondary),
                                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                                      minimumSize: Size.zero,
                                                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                                    ),
                                                    onPressed: () => _openInMaps(lat, lng),
                                                    icon: const Icon(Icons.map_outlined, size: 14),
                                                    label: const Text('Maps', style: TextStyle(fontSize: 11)),
                                                  ),
                                                if (type == 'ODP') ...[
                                                  const SizedBox(width: 8),
                                                  ElevatedButton.icon(
                                                    style: ElevatedButton.styleFrom(
                                                      backgroundColor: AppColors.primary,
                                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                                      minimumSize: Size.zero,
                                                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                                    ),
                                                    onPressed: () => Navigator.push(
                                                      context,
                                                      MaterialPageRoute(
                                                        builder: (_) => OdpFormScreen(
                                                          prefilledOdpCode: code,
                                                          prefilledOdpName: name,
                                                          prefilledOdpNodeId: node['id'],
                                                        ),
                                                      ),
                                                    ),
                                                    icon: const Icon(Icons.add, size: 14, color: Colors.white),
                                                    label: const Text('Ukur', style: TextStyle(fontSize: 11, color: Colors.white)),
                                                  ),
                                                ],
                                              ],
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

  Widget _buildNodeTypeTab({
    required String label,
    required int count,
    required String type,
    required Color color,
  }) {
    final isActive = _selectedType == type;
    return InkWell(
      onTap: () => setState(() => _selectedType = type),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(
          color: isActive ? color.withValues(alpha: 0.2) : AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: isActive ? color : AppColors.surfaceBorder),
        ),
        child: Column(
          children: [
            Text(
              '$count',
              style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 14),
            ),
            Text(
              label,
              style: TextStyle(color: isActive ? AppColors.textPrimary : AppColors.textSecondary, fontSize: 10),
            ),
          ],
        ),
      ),
    );
  }
}
