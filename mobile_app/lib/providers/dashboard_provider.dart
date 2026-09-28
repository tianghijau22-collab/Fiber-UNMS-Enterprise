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
        final res = futures[0].data;
        if (res is Map<String, dynamic>) {
          _metrics = res['data'] is Map<String, dynamic> ? res['data'] : res;
        }
      }

      if (futures[1].data != null) {
        final alertRes = futures[1].data;
        if (alertRes is List) {
          _systemAlerts = alertRes;
        } else if (alertRes is Map<String, dynamic>) {
          _systemAlerts = alertRes['data'] is List ? alertRes['data'] : (alertRes['alerts'] ?? []);
        }
      }

      // Fallback to recent_alerts from dashboard metrics if system alerts endpoint is empty
      if (_systemAlerts.isEmpty && _metrics != null && _metrics!['recent_alerts'] is List) {
        _systemAlerts = List<dynamic>.from(_metrics!['recent_alerts']);
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
