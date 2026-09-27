import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../core/constants/api_constants.dart';
import '../core/network/dio_client.dart';
import '../models/odp_measurement_model.dart';

class OdpProvider extends ChangeNotifier {
  List<OdpMeasurementModel> _measurements = [];
  List<Map<String, dynamic>> _odpOptions = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<OdpMeasurementModel> get measurements => _measurements;
  List<Map<String, dynamic>> get odpOptions => _odpOptions;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  // Fetch Measurements History
  Future<void> fetchMeasurements() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await DioClient().dio.get(ApiConstants.endpointOdpChecks);
      if (response.data != null) {
        final rawList = response.data['data'] is List 
            ? response.data['data'] 
            : (response.data is List ? response.data : []);
        
        _measurements = (rawList as List).map((item) => OdpMeasurementModel.fromJson(item)).toList();
      }
    } catch (e) {
      _errorMessage = 'Gagal memuat riwayat pengukuran ODP: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Fetch ODP Search Options
  Future<void> searchOdpOptions(String query) async {
    try {
      final response = await DioClient().dio.get(
        ApiConstants.endpointOdpOptions,
        queryParameters: {'search': query},
      );
      if (response.data != null && response.data['data'] is List) {
        _odpOptions = List<Map<String, dynamic>>.from(response.data['data']);
        notifyListeners();
      }
    } catch (_) {}
  }

  // Submit Odp Measurement from Mobile
  Future<bool> submitMeasurement({
    required String odpCode,
    String? odpName,
    int? odpNodeId,
    required double powerMeasurementDbm,
    required String portNumber,
    required String odpCondition,
    double? latitude,
    double? longitude,
    String? addressLocation,
    String? notes,
    File? odpPhoto,
    File? opmPhoto,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      String? odpPhotoBase64;
      String? opmPhotoBase64;

      if (odpPhoto != null && await odpPhoto.exists()) {
        final bytes = await odpPhoto.readAsBytes();
        odpPhotoBase64 = 'data:image/jpeg;base64,${base64Encode(bytes)}';
      }
      if (opmPhoto != null && await opmPhoto.exists()) {
        final bytes = await opmPhoto.readAsBytes();
        opmPhotoBase64 = 'data:image/jpeg;base64,${base64Encode(bytes)}';
      }

      final payload = {
        'odp_code': odpCode,
        'odp_name': odpName,
        'odp_node_id': odpNodeId,
        'power_measurement_dbm': powerMeasurementDbm,
        'port_number': portNumber,
        'odp_condition': odpCondition,
        'latitude': latitude,
        'longitude': longitude,
        'address_location': addressLocation,
        'notes': notes,
        if (odpPhotoBase64 != null) 'odp_photo': odpPhotoBase64,
        if (opmPhotoBase64 != null) 'opm_photo': opmPhotoBase64,
      };

      final response = await DioClient().dio.post(
        ApiConstants.endpointOdpChecks,
        data: payload,
      );

      _isLoading = false;
      if (response.statusCode == 200 || response.statusCode == 201) {
        await fetchMeasurements();
        return true;
      }
      return false;
    } on DioException catch (e) {
      _isLoading = false;
      _errorMessage = e.response?.data?['message'] ?? 'Gagal menyimpan data pengukuran.';
      notifyListeners();
      return false;
    } catch (e) {
      _isLoading = false;
      _errorMessage = 'Terjadi kesalahan: $e';
      notifyListeners();
      return false;
    }
  }

  // Helper to get device current GPS position
  Future<Position?> getCurrentLocation() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return null;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return null;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return null;
    }

    return await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
  }
}
