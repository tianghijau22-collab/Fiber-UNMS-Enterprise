import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/app_colors.dart';
import '../../models/ticket_model.dart';
import '../../providers/ticket_provider.dart';

class TicketDetailScreen extends StatefulWidget {
  final TicketModel ticket;
  const TicketDetailScreen({super.key, required this.ticket});

  @override
  State<TicketDetailScreen> createState() => _TicketDetailScreenState();
}

class _TicketDetailScreenState extends State<TicketDetailScreen> {
  final ImagePicker _picker = ImagePicker();

  void _showUpdateProgressDialog() {
    final noteController = TextEditingController();
    final powerController = TextEditingController(
      text: widget.ticket.finalPowerDbm?.toString() ?? '',
    );
    String selectedStatus = widget.ticket.status;
    File? selectedImage;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          return Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 20,
              bottom: MediaQuery.of(context).viewInsets.bottom + 20,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Update Progress Tiket Lapangan',
                    style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),

                  // Status Selector
                  DropdownButtonFormField<String>(
                    value: selectedStatus,
                    dropdownColor: AppColors.surfaceLight,
                    style: const TextStyle(color: AppColors.textPrimary),
                    decoration: InputDecoration(
                      labelText: 'Status Tiket',
                      labelStyle: const TextStyle(color: AppColors.textSecondary),
                      filled: true,
                      fillColor: AppColors.surfaceLight,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'Open', child: Text('Open (Menunggu)')),
                      DropdownMenuItem(value: 'In Progress', child: Text('In Progress (Dikerjakan)')),
                      DropdownMenuItem(value: 'Resolved', child: Text('Resolved (Selesai/Normal)')),
                    ],
                    onChanged: (v) {
                      if (v != null) setModalState(() => selectedStatus = v);
                    },
                  ),
                  const SizedBox(height: 12),

                  // Power dBm
                  TextField(
                    controller: powerController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                    style: const TextStyle(color: AppColors.textPrimary),
                    decoration: InputDecoration(
                      labelText: 'Hasil Ukur Redaman Akhir (dBm)',
                      hintText: '-19.50',
                      labelStyle: const TextStyle(color: AppColors.textSecondary),
                      hintStyle: const TextStyle(color: AppColors.textMuted),
                      filled: true,
                      fillColor: AppColors.surfaceLight,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Progress Note
                  TextField(
                    controller: noteController,
                    maxLines: 3,
                    style: const TextStyle(color: AppColors.textPrimary),
                    decoration: InputDecoration(
                      labelText: 'Catatan Penanganan Lapangan',
                      hintText: 'Misal: Telah dilakukan splicing core nomor 2 ODP...',
                      labelStyle: const TextStyle(color: AppColors.textSecondary),
                      hintStyle: const TextStyle(color: AppColors.textMuted),
                      filled: true,
                      fillColor: AppColors.surfaceLight,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Take Photo (Camera / Gallery)
                  Row(
                    children: [
                      ElevatedButton.icon(
                        icon: const Icon(Icons.camera_alt, size: 18),
                        label: const Text('Foto Bukti (Kamera)'),
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.surfaceLight),
                        onPressed: () async {
                          final photo = await _picker.pickImage(source: ImageSource.camera, imageQuality: 70);
                          if (photo != null) {
                            setModalState(() => selectedImage = File(photo.path));
                          }
                        },
                      ),
                      if (selectedImage != null) ...[
                        const SizedBox(width: 10),
                        const Icon(Icons.check_circle, color: AppColors.success, size: 20),
                        const SizedBox(width: 4),
                        const Text('Foto terlampir', style: TextStyle(color: AppColors.success, fontSize: 12)),
                      ],
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Submit Button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: () async {
                        if (noteController.text.trim().isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Masukkan catatan penanganan terlebih dahulu.')),
                          );
                          return;
                        }

                        final provider = Provider.of<TicketProvider>(context, listen: false);
                        String? base64Img;
                        if (selectedImage != null) {
                          final bytes = await selectedImage!.readAsBytes();
                          base64Img = 'data:image/jpeg;base64,${base64Encode(bytes)}';
                        }

                        final ok = await provider.addProgress(
                          ticketId: widget.ticket.id,
                          progressNotes: noteController.text.trim(),
                          status: selectedStatus,
                          finalPowerDbm: double.tryParse(powerController.text),
                          photoBase64: base64Img,
                        );

                        if (context.mounted) {
                          Navigator.pop(ctx);
                          if (ok) {
                            Navigator.pop(context);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Progress tiket berhasil diperbarui!')),
                            );
                          }
                        }
                      },
                      child: const Text('Simpan & Sinkronkan', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
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
    final t = widget.ticket;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: Text(
          '#${t.ticketNumber}',
          style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 16),
        ),
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(16),
        color: AppColors.surface,
        child: ElevatedButton.icon(
          icon: const Icon(Icons.edit_note, color: Colors.white),
          label: const Text('Update Progress / Selesaikan', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
          onPressed: _showUpdateProgressDialog,
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Title & Priority Banner
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
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLight,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          t.category,
                          style: const TextStyle(color: AppColors.primaryLight, fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: t.priority == 'Critical'
                              ? AppColors.danger.withValues(alpha: 0.2)
                              : AppColors.warning.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          'Prioritas: ${t.priority}',
                          style: TextStyle(
                            color: t.priority == 'Critical' ? AppColors.danger : AppColors.warning,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    t.title,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  if (t.description != null && t.description!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      t.description!,
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Customer Contact Card
            if (t.customerName != null) ...[
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
                    const Text(
                      'Informasi Pelanggan',
                      style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        const Icon(Icons.person, color: AppColors.textSecondary, size: 18),
                        const SizedBox(width: 8),
                        Text(t.customerName!, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14)),
                      ],
                    ),
                    if (t.customerPhone != null) ...[
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Icon(Icons.phone, color: AppColors.textSecondary, size: 18),
                          const SizedBox(width: 8),
                          Text(t.customerPhone!, style: const TextStyle(color: AppColors.secondary, fontSize: 14)),
                          const Spacer(),
                          IconButton(
                            icon: const Icon(Icons.call, color: AppColors.success, size: 20),
                            onPressed: () => _callCustomer(t.customerPhone),
                          ),
                        ],
                      ),
                    ],
                    if (t.customerAddress != null) ...[
                      const SizedBox(height: 8),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.location_on, color: AppColors.textSecondary, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(t.customerAddress!, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Optical Power Comparison
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.surfaceBorder),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Redaman Awal', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                        const SizedBox(height: 4),
                        Text(
                          t.initialPowerDbm != null ? '${t.initialPowerDbm} dBm' : '-',
                          style: TextStyle(
                            color: AppColors.getOpticalColor(t.initialPowerDbm),
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(width: 1, height: 40, color: AppColors.surfaceBorder),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Redaman Akhir', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                        const SizedBox(height: 4),
                        Text(
                          t.finalPowerDbm != null ? '${t.finalPowerDbm} dBm' : '-',
                          style: TextStyle(
                            color: AppColors.getOpticalColor(t.finalPowerDbm),
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ],
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
}
