import 'dart:io';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/odp_provider.dart';

class OdpFormScreen extends StatefulWidget {
  const OdpFormScreen({super.key});

  @override
  State<OdpFormScreen> createState() => _OdpFormScreenState();
}

class _OdpFormScreenState extends State<OdpFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _odpCodeController = TextEditingController();
  final _portController = TextEditingController(text: '1');
  final _powerController = TextEditingController();
  final _addressController = TextEditingController();
  final _notesController = TextEditingController();

  String _odpCondition = 'Bagus';
  Position? _currentPosition;
  bool _isGettingLocation = false;

  File? _odpPhoto;
  File? _opmPhoto;
  final ImagePicker _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _fetchCurrentGpsLocation();
  }

  void _fetchCurrentGpsLocation() async {
    setState(() => _isGettingLocation = true);
    final odpProvider = Provider.of<OdpProvider>(context, listen: false);
    final pos = await odpProvider.getCurrentLocation();
    if (mounted) {
      setState(() {
        _currentPosition = pos;
        _isGettingLocation = false;
      });
    }
  }

  void _pickPhoto(bool isOpm) async {
    final photo = await _picker.pickImage(source: ImageSource.camera, imageQuality: 70);
    if (photo != null && mounted) {
      setState(() {
        if (isOpm) {
          _opmPhoto = File(photo.path);
        } else {
          _odpPhoto = File(photo.path);
        }
      });
    }
  }

  void _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final odpProvider = Provider.of<OdpProvider>(context, listen: false);
    final success = await odpProvider.submitMeasurement(
      odpCode: _odpCodeController.text.trim(),
      powerMeasurementDbm: double.parse(_powerController.text),
      portNumber: _portController.text.trim(),
      odpCondition: _odpCondition,
      latitude: _currentPosition?.latitude,
      longitude: _currentPosition?.longitude,
      addressLocation: _addressController.text.trim(),
      notes: _notesController.text.trim(),
      odpPhoto: _odpPhoto,
      opmPhoto: _opmPhoto,
    );

    if (success && mounted) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Hasil ukur redaman ODP berhasil disimpan & tersinkronisasi!')),
      );
    }
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
          'Input Ukur Redaman ODP',
          style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(16),
        color: AppColors.surface,
        child: ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
          onPressed: odpProvider.isLoading ? null : _submit,
          child: odpProvider.isLoading
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                )
              : const Text(
                  'Simpan Pengukuran Lapangan',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // GPS Tagging Banner
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.surfaceBorder),
                ),
                child: Row(
                  children: [
                    Icon(
                      _currentPosition != null ? Icons.my_location : Icons.location_searching,
                      color: _currentPosition != null ? AppColors.success : AppColors.warning,
                      size: 24,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Koordinat GPS Saat Ini', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                          const SizedBox(height: 2),
                          _isGettingLocation
                              ? const Text('Mencari sinyal satelit GPS...', style: TextStyle(color: AppColors.warning, fontSize: 13))
                              : Text(
                                  _currentPosition != null
                                      ? '${_currentPosition!.latitude.toStringAsFixed(6)}, ${_currentPosition!.longitude.toStringAsFixed(6)}'
                                      : 'GPS belum aktif',
                                  style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.refresh, color: AppColors.primary),
                      onPressed: _fetchCurrentGpsLocation,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),

              // ODP Code
              TextFormField(
                controller: _odpCodeController,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: InputDecoration(
                  labelText: 'Kode / Nama ODP',
                  hintText: 'Misal: ODP-KRE-01/08',
                  labelStyle: const TextStyle(color: AppColors.textSecondary),
                  hintStyle: const TextStyle(color: AppColors.textMuted),
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Masukkan kode ODP' : null,
              ),
              const SizedBox(height: 14),

              // Redaman OPM dBm & Port
              Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: TextFormField(
                      controller: _powerController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold),
                      decoration: InputDecoration(
                        labelText: 'Redaman OPM (dBm)',
                        hintText: '-18.50',
                        labelStyle: const TextStyle(color: AppColors.textSecondary),
                        hintStyle: const TextStyle(color: AppColors.textMuted),
                        filled: true,
                        fillColor: AppColors.surface,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      validator: (v) => (v == null || double.tryParse(v) == null) ? 'Input angka valid' : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: TextFormField(
                      controller: _portController,
                      style: const TextStyle(color: AppColors.textPrimary),
                      decoration: InputDecoration(
                        labelText: 'Nomor Port',
                        hintText: '1 - 16',
                        labelStyle: const TextStyle(color: AppColors.textSecondary),
                        filled: true,
                        fillColor: AppColors.surface,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Kondisi Fisik ODP
              DropdownButtonFormField<String>(
                value: _odpCondition,
                dropdownColor: AppColors.surfaceLight,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: InputDecoration(
                  labelText: 'Kondisi Fisik ODP',
                  labelStyle: const TextStyle(color: AppColors.textSecondary),
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
                items: const [
                  DropdownMenuItem(value: 'Bagus', child: Text('Bagus / Standar')),
                  DropdownMenuItem(value: 'Tutup Rusak / Patah', child: Text('Tutup Rusak / Patah')),
                  DropdownMenuItem(value: 'Kotor / Sarang Serangga', child: Text('Kotor / Sarang Serangga')),
                  DropdownMenuItem(value: 'Port Longgar / Rusak', child: Text('Port Longgar / Rusak')),
                  DropdownMenuItem(value: 'Perlu Penggantian ODP', child: Text('Perlu Penggantian ODP')),
                ],
                onChanged: (v) {
                  if (v != null) setState(() => _odpCondition = v);
                },
              ),
              const SizedBox(height: 14),

              // Address / Lokasi Tiang
              TextFormField(
                controller: _addressController,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: InputDecoration(
                  labelText: 'Alamat / Patokan Tiang',
                  hintText: 'Depan rumah No. 45 / Tiang PLN...',
                  labelStyle: const TextStyle(color: AppColors.textSecondary),
                  hintStyle: const TextStyle(color: AppColors.textMuted),
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 14),

              // Catatan
              TextFormField(
                controller: _notesController,
                maxLines: 2,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: InputDecoration(
                  labelText: 'Catatan Tambahan',
                  labelStyle: const TextStyle(color: AppColors.textSecondary),
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 20),

              // Photo Pickers
              const Text('Dokumentasi Foto Lapangan', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14)),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _buildPhotoCard(
                      title: 'Foto Layar OPM',
                      photo: _opmPhoto,
                      onTap: () => _pickPhoto(true),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildPhotoCard(
                      title: 'Foto Fisik ODP',
                      photo: _odpPhoto,
                      onTap: () => _pickPhoto(false),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPhotoCard({
    required String title,
    required File? photo,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        height: 110,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: photo != null ? AppColors.primary : AppColors.surfaceBorder),
        ),
        child: photo != null
            ? ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.file(photo, fit: BoxFit.cover),
              )
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.camera_alt, color: AppColors.primary, size: 28),
                  const SizedBox(height: 6),
                  Text(title, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                ],
              ),
      ),
    );
  }
}
