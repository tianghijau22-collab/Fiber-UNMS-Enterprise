import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../models/odp_measurement_model.dart';
import '../../providers/odp_provider.dart';
import 'odp_form_screen.dart';

class OdpCheckScreen extends StatefulWidget {
  const OdpCheckScreen({super.key});

  @override
  State<OdpCheckScreen> createState() => _OdpCheckScreenState();
}

class _OdpCheckScreenState extends State<OdpCheckScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<OdpProvider>(context, listen: false).fetchMeasurements();
    });
  }

  @override
  Widget build(BuildContext context) {
    final odpProvider = Provider.of<OdpProvider>(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: const Text(
          'Pengecekan Redaman ODP',
          style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: () => odpProvider.fetchMeasurements(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add_chart_rounded, color: Colors.white),
        label: const Text('Input Redaman', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const OdpFormScreen()),
          );
        },
      ),
      body: RefreshIndicator(
        onRefresh: () => odpProvider.fetchMeasurements(),
        color: AppColors.primary,
        backgroundColor: AppColors.surface,
        child: odpProvider.isLoading
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : odpProvider.measurements.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.speed_outlined, size: 54, color: AppColors.textMuted.withValues(alpha: 0.5)),
                        const SizedBox(height: 12),
                        const Text(
                          'Belum ada riwayat pengecekan ODP.',
                          style: TextStyle(color: AppColors.textMuted, fontSize: 14),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: odpProvider.measurements.length,
                    itemBuilder: (ctx, i) => _buildMeasurementCard(odpProvider.measurements[i]),
                  ),
      ),
    );
  }

  Widget _buildMeasurementCard(OdpMeasurementModel m) {
    Color statusColor = AppColors.getOpticalColor(m.powerMeasurementDbm);

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
                  m.odpCode,
                  style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: statusColor.withValues(alpha: 0.5)),
                  ),
                  child: Text(
                    '${m.powerMeasurementDbm} dBm',
                    style: TextStyle(color: statusColor, fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Port ${m.portNumber} • Kondisi: ${m.odpCondition}',
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.person_pin, color: AppColors.textMuted, size: 14),
                const SizedBox(width: 4),
                Text(
                  m.technicianName,
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                ),
                const Spacer(),
                if (m.createdAt != null)
                  Text(
                    m.createdAt!,
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
