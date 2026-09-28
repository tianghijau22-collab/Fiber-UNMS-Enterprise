import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/api_constants.dart';
import '../../core/constants/app_colors.dart';
import '../../core/network/dio_client.dart';

class GisMapScreen extends StatefulWidget {
  const GisMapScreen({super.key});

  @override
  State<GisMapScreen> createState() => _GisMapScreenState();
}

class _GisMapScreenState extends State<GisMapScreen> {
  List<dynamic> _nodes = [];
  bool _isLoading = true;
  String? _errorMessage;
  String _selectedFilter = 'ALL'; // 'ALL', 'ODP', 'ODC', 'POP'
  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _fetchGisData();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchGisData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await DioClient().dio.get(ApiConstants.endpointGisMapData);
      if (response.data != null) {
        final rawNodes = response.data['nodes'] is List
            ? response.data['nodes']
            : (response.data['data']?['nodes'] is List ? response.data['data']['nodes'] : []);
        setState(() {
          _nodes = rawNodes;
          _isLoading = false;
        });
      }
    } on DioException catch (e) {
      setState(() {
        _errorMessage = e.response?.data?['message'] ?? 'Gagal memuat data sebaran peta GIS.';
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Terjadi kesalahan: $e';
        _isLoading = false;
      });
    }
  }

  void _openGoogleMaps(dynamic lat, dynamic lng, String label) async {
    if (lat == null || lng == null) return;
    final url = 'https://www.google.com/maps/search/?api=1&query=$lat,$lng';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filteredNodes = _nodes.where((n) {
      final type = (n['node_type'] ?? '').toString().toUpperCase();
      final name = (n['name'] ?? '').toString().toLowerCase();
      final code = (n['code'] ?? '').toString().toLowerCase();

      final matchesFilter = _selectedFilter == 'ALL' || type == _selectedFilter;
      final matchesSearch = _searchQuery.isEmpty ||
          name.contains(_searchQuery.toLowerCase()) ||
          code.contains(_searchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
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
          'Peta Sebaran GIS Node',
          style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: _fetchGisData,
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: AppColors.surface,
            child: Row(
              children: [
                _buildFilterChip('Semua (${_nodes.length})', 'ALL'),
                const SizedBox(width: 8),
                _buildFilterChip('ODP ($odpCount)', 'ODP'),
                const SizedBox(width: 8),
                _buildFilterChip('ODC ($odcCount)', 'ODC'),
                const SizedBox(width: 8),
                _buildFilterChip('POP ($popCount)', 'POP'),
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
                hintText: 'Cari titik koordinat, nama node...',
                hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                prefixIcon: const Icon(Icons.search, color: AppColors.textSecondary, size: 20),
                filled: true,
                fillColor: AppColors.surface,
                contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
            ),
          ),

          // List of Geospatial Nodes
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _errorMessage != null
                    ? Center(
                        child: Text(_errorMessage!, style: const TextStyle(color: AppColors.textSecondary)),
                      )
                    : RefreshIndicator(
                        onRefresh: _fetchGisData,
                        color: AppColors.primary,
                        backgroundColor: AppColors.surface,
                        child: filteredNodes.isEmpty
                            ? const Center(
                                child: Text('Tidak ada titik koordinat node ditemukan.', style: TextStyle(color: AppColors.textMuted)),
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.all(16),
                                itemCount: filteredNodes.length,
                                itemBuilder: (ctx, i) {
                                  final node = filteredNodes[i];
                                  final name = node['name'] ?? 'Titik Node';
                                  final code = node['code'] ?? '-';
                                  final type = (node['node_type'] ?? 'ODP').toString().toUpperCase();
                                  final lat = node['latitude'];
                                  final lng = node['longitude'];
                                  final status = (node['status'] ?? 'active').toString().toLowerCase();
                                  final isOnline = status == 'active' || status == 'online';

                                  Color typeColor = AppColors.secondary;
                                  IconData typeIcon = Icons.alt_route;
                                  if (type == 'POP') {
                                    typeColor = AppColors.accent;
                                    typeIcon = Icons.home_work_rounded;
                                  } else if (type == 'ODC') {
                                    typeColor = AppColors.warning;
                                    typeIcon = Icons.account_tree_rounded;
                                  }

                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 12),
                                    padding: const EdgeInsets.all(14),
                                    decoration: BoxDecoration(
                                      color: AppColors.surface,
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(color: AppColors.surfaceBorder),
                                    ),
                                    child: Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.all(10),
                                          decoration: BoxDecoration(
                                            color: typeColor.withValues(alpha: 0.15),
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                          child: Icon(typeIcon, color: typeColor, size: 24),
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
                                                      color: typeColor.withValues(alpha: 0.2),
                                                      borderRadius: BorderRadius.circular(4),
                                                    ),
                                                    child: Text(
                                                      type,
                                                      style: TextStyle(color: typeColor, fontSize: 10, fontWeight: FontWeight.bold),
                                                    ),
                                                  ),
                                                  const SizedBox(width: 6),
                                                  Text(
                                                    code,
                                                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                                                  ),
                                                  const Spacer(),
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                                    decoration: BoxDecoration(
                                                      color: (isOnline ? AppColors.success : AppColors.danger).withValues(alpha: 0.15),
                                                      borderRadius: BorderRadius.circular(4),
                                                    ),
                                                    child: Text(
                                                      isOnline ? 'Online' : 'Offline',
                                                      style: TextStyle(
                                                        color: isOnline ? AppColors.success : AppColors.danger,
                                                        fontSize: 9,
                                                        fontWeight: FontWeight.bold,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                name,
                                                style: const TextStyle(
                                                  color: AppColors.textPrimary,
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 14,
                                                ),
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                'Koordinat: $lat, $lng',
                                                style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                                              ),
                                            ],
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        IconButton(
                                          style: IconButton.styleFrom(
                                            backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                                          ),
                                          icon: const Icon(Icons.navigation_rounded, color: AppColors.primary, size: 20),
                                          tooltip: 'Navigasi Maps',
                                          onPressed: () => _openGoogleMaps(lat, lng, name),
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

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _selectedFilter == value;
    return InkWell(
      onTap: () => setState(() => _selectedFilter = value),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? AppColors.primary : AppColors.surfaceBorder),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : AppColors.textSecondary,
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }
}
