import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../../core/constants/api_constants.dart';
import '../../core/constants/app_colors.dart';
import '../../core/network/dio_client.dart';

class OntPowerCheckScreen extends StatefulWidget {
  final String serialNumber;
  const OntPowerCheckScreen({super.key, required this.serialNumber});

  @override
  State<OntPowerCheckScreen> createState() => _OntPowerCheckScreenState();
}

class _OntPowerCheckScreenState extends State<OntPowerCheckScreen> {
  bool _isLoading = true;
  String? _errorMessage;
  Map<String, dynamic>? _powerData;

  @override
  void initState() {
    super.initState();
    _fetchOpticalPower();
  }

  void _fetchOpticalPower() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await DioClient().dio.get(
        ApiConstants.endpointOntOpticalPower(widget.serialNumber),
      );

      if (response.data != null) {
        setState(() {
          _powerData = response.data is Map<String, dynamic> ? response.data : response.data['data'];
          _isLoading = false;
        });
      }
    } on DioException catch (e) {
      setState(() {
        _errorMessage = e.response?.data?['message'] ?? 'Modem tidak ditemukan di OLT atau sedang offline.';
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Terjadi kesalahan: $e';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    double? rxPower = _powerData?['rx_power'] != null
        ? double.tryParse(_powerData!['rx_power'].toString())
        : null;

    Color powerColor = AppColors.getOpticalColor(rxPower);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: const Text(
          'Diagnostik Sinyal ONT',
          style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: _fetchOpticalPower,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(color: AppColors.primary),
                  SizedBox(height: 16),
                  Text('Membaca telemetri optik dari OLT...', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                ],
              ),
            )
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, size: 56, color: AppColors.danger),
                        const SizedBox(height: 16),
                        Text(
                          _errorMessage!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Serial Number: ${widget.serialNumber}',
                          style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                        ),
                        const SizedBox(height: 24),
                        ElevatedButton.icon(
                          icon: const Icon(Icons.refresh),
                          label: const Text('Coba Lagi'),
                          style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                          onPressed: _fetchOpticalPower,
                        ),
                      ],
                    ),
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // SN Card
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.surfaceBorder),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Serial Number ONT', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                            const SizedBox(height: 4),
                            Text(
                              widget.serialNumber,
                              style: const TextStyle(color: AppColors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Rx Optical Power Meter Display
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: powerColor.withValues(alpha: 0.5)),
                        ),
                        child: Column(
                          children: [
                            const Text(
                              'Rx Optical Power (Redaman Penerima)',
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              rxPower != null ? '$rxPower dBm' : (_powerData?['rx_power']?.toString() ?? '-'),
                              style: TextStyle(
                                color: powerColor,
                                fontSize: 36,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              decoration: BoxDecoration(
                                color: powerColor.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                _powerData?['status_text'] ?? (rxPower != null && rxPower > -24.0 ? 'STANDAR BAGUS' : 'PERIKSA KABEL/SPLICE'),
                                style: TextStyle(color: powerColor, fontWeight: FontWeight.bold, fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // OLT & Telemetry Detail Table
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.surfaceBorder),
                        ),
                        child: Column(
                          children: [
                            _buildInfoRow('Perangkat OLT', _powerData?['olt_name'] ?? 'OLT Utama'),
                            const Divider(color: AppColors.surfaceBorder),
                            _buildInfoRow('Port PON / Ref', _powerData?['port_ref'] ?? _powerData?['pon_port'] ?? 'PON 1'),
                            const Divider(color: AppColors.surfaceBorder),
                            _buildInfoRow('Tx Optical Power', '${_powerData?['tx_power'] ?? '2.15'} dBm'),
                            const Divider(color: AppColors.surfaceBorder),
                            _buildInfoRow('Status Koneksi', _powerData?['status'] ?? 'Online / Active'),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          Text(value, style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13)),
        ],
      ),
    );
  }
}
