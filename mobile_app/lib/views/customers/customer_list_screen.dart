import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
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
  final TextEditingController _searchController = TextEditingController();
  List<CustomerModel> _customers = [];
  bool _isLoading = false;
  String? _errorMessage;
  late String _statusFilter; // 'ALL', 'ONLINE', 'OFFLINE'

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

  void _fetchCustomers({String? query}) async {
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

        setState(() {
          _customers = (rawList as List).map((i) => CustomerModel.fromJson(i)).toList();
          _isLoading = false;
        });
      }
    } on DioException catch (e) {
      setState(() {
        _errorMessage = e.response?.data?['message'] ?? 'Gagal memuat data pelanggan.';
        _isLoading = false;
      });
    } catch (e) {
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

  @override
  Widget build(BuildContext context) {
    final filteredCustomers = _customers.where((c) {
      if (_statusFilter == 'ONLINE') return c.isOnline;
      if (_statusFilter == 'OFFLINE') return !c.isOnline;
      return true;
    }).toList();

    final onlineCount = _customers.where((c) => c.isOnline).length;
    final offlineCount = _customers.length - onlineCount;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: const Text(
          'Data Pelanggan',
          style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: () => _fetchCustomers(query: _searchController.text.trim()),
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Tabs (Online / Offline / Semua)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: AppColors.surface,
            child: Row(
              children: [
                Expanded(
                  child: _buildFilterTab(
                    label: 'Online',
                    count: onlineCount,
                    color: AppColors.success,
                    isActive: _statusFilter == 'ONLINE',
                    onTap: () => setState(() => _statusFilter = _statusFilter == 'ONLINE' ? 'ALL' : 'ONLINE'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildFilterTab(
                    label: 'Offline',
                    count: offlineCount,
                    color: AppColors.danger,
                    isActive: _statusFilter == 'OFFLINE',
                    onTap: () => setState(() => _statusFilter = _statusFilter == 'OFFLINE' ? 'ALL' : 'OFFLINE'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildFilterTab(
                    label: 'Semua',
                    count: _customers.length,
                    color: AppColors.primary,
                    isActive: _statusFilter == 'ALL',
                    onTap: () => setState(() => _statusFilter = 'ALL'),
                  ),
                ),
              ],
            ),
          ),

          // Search Bar
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _searchController,
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Cari Nama, No Pelanggan, atau No HP...',
                hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                prefixIcon: const Icon(Icons.search, color: AppColors.primary, size: 20),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.arrow_forward, color: AppColors.primary),
                  onPressed: () => _fetchCustomers(query: _searchController.text.trim()),
                ),
                filled: true,
                fillColor: AppColors.surface,
                isDense: true,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
              onSubmitted: (v) => _fetchCustomers(query: v.trim()),
            ),
          ),

          // Customer List
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => _fetchCustomers(query: _searchController.text.trim()),
              color: AppColors.primary,
              backgroundColor: AppColors.surface,
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                  : _errorMessage != null
                      ? Center(
                          child: Text(_errorMessage!, style: const TextStyle(color: AppColors.danger)),
                        )
                      : filteredCustomers.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.people_outline, size: 54, color: AppColors.textMuted.withValues(alpha: 0.5)),
                                  const SizedBox(height: 12),
                                  const Text('Tidak ada pelanggan ditemukan.', style: TextStyle(color: AppColors.textMuted, fontSize: 14)),
                                ],
                              ),
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: filteredCustomers.length,
                              itemBuilder: (ctx, i) => _buildCustomerCard(filteredCustomers[i]),
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

  Widget _buildCustomerCard(CustomerModel cust) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.surfaceBorder.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  cust.customerNumber,
                  style: const TextStyle(color: AppColors.primaryLight, fontWeight: FontWeight.bold, fontSize: 12),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: cust.isOnline
                        ? AppColors.success.withValues(alpha: 0.15)
                        : AppColors.danger.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 3,
                        backgroundColor: cust.isOnline ? AppColors.success : AppColors.danger,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        cust.status,
                        style: TextStyle(
                          color: cust.isOnline ? AppColors.success : AppColors.danger,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              cust.name,
              style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.location_on_outlined, color: AppColors.textMuted, size: 14),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    cust.address ?? '-',
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            const Divider(color: AppColors.surfaceBorder, height: 1),
            const SizedBox(height: 10),

            // ODP & ONT Info Row
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('ODP Port', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                      Text(
                        cust.odpName != null ? '${cust.odpName} (P-${cust.odpPort ?? 1})' : 'Belum Terpetakan',
                        style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Redaman (RX)', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                      Text(
                        cust.rxPower != null ? '${cust.rxPower} dBm' : '-',
                        style: TextStyle(
                          color: cust.rxPower != null && cust.rxPower! > -27
                              ? AppColors.success
                              : (cust.rxPower != null ? AppColors.danger : AppColors.textMuted),
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 12),
            // Action Buttons
            Row(
              children: [
                if (cust.phone != null && cust.phone!.isNotEmpty)
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.success,
                        side: const BorderSide(color: AppColors.success),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                      ),
                      onPressed: () => _callCustomer(cust.phone),
                      icon: const Icon(Icons.phone, size: 14),
                      label: const Text('Hubungi', style: TextStyle(fontSize: 12)),
                    ),
                  ),
                if (cust.phone != null && cust.phone!.isNotEmpty) const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.secondary,
                      side: const BorderSide(color: AppColors.secondary),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => OntPowerCheckScreen(
                          serialNumber: cust.onuSerial ?? cust.customerNumber,
                        ),
                      ),
                    ),
                    icon: const Icon(Icons.speed, size: 14),
                    label: const Text('Cek Redaman', style: TextStyle(fontSize: 12)),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                  ),
                  icon: const Icon(Icons.swap_horiz, color: AppColors.primary, size: 18),
                  tooltip: 'Swap ONU',
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => SwapOnuScreen(customer: cust),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
