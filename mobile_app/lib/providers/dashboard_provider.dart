import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../core/constants/api_constants.dart';
import '../core/network/dio_client.dart';

class DashboardProvider extends ChangeNotifier {
  Map<String, dynamic>? _metrics;
  List<dynamic> _systemAlerts = [];
  bool _isLoading = false;
  String? _errorMessage;

  Map<String, dynamic>? get metrics => _metrics;
  List<dynamic> get systemAlerts => _systemAlerts;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchDashboardData() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final futures = await Future.wait([
        DioClient().dio.get(ApiConstants.endpointDashboardMetrics),
        DioClient().dio.get(ApiConstants.endpointSystemAlerts),
      ]);

      if (futures[0].data != null) {
        _metrics = futures[0].data is Map<String, dynamic> ? futures[0].data : futures[0].data['data'];
      }

      if (futures[1].data != null) {
        _systemAlerts = futures[1].data is List ? futures[1].data : (futures[1].data['data'] ?? []);
      }
    } on DioException catch (e) {
      _errorMessage = e.response?.data?['message'] ?? 'Gagal memuat ringkasan dashboard.';
    } catch (e) {
      _errorMessage = 'Terjadi kesalahan: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
