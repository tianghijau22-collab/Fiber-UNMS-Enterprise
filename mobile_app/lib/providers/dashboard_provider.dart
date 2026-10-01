import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../core/constants/api_constants.dart';
import '../core/network/dio_client.dart';

class DashboardProvider extends ChangeNotifier {
  Map<String, dynamic>? _metrics;
  List<dynamic> _systemAlerts = [];
  bool _isLoading = false;
  bool _isAutoRefreshing = false;
  String? _errorMessage;
  Timer? _autoRefreshTimer;
  DateTime? _lastUpdated;

  Map<String, dynamic>? get metrics => _metrics;
  List<dynamic> get systemAlerts => _systemAlerts;
  bool get isLoading => _isLoading;
  bool get isAutoRefreshing => _isAutoRefreshing;
  String? get errorMessage => _errorMessage;
  DateTime? get lastUpdated => _lastUpdated;

  Future<void> fetchDashboardData({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
    } else {
      _isAutoRefreshing = true;
    }

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
          if (alertRes['messages'] is List) {
            _systemAlerts = alertRes['messages'] as List;
          } else if (alertRes['data'] is List) {
            _systemAlerts = alertRes['data'] as List;
          } else if (alertRes['alerts'] is List) {
            _systemAlerts = alertRes['alerts'] as List;
          }
        }
      }

      // Fallback to recent_alerts from dashboard metrics if system alerts endpoint is empty
      if (_systemAlerts.isEmpty && _metrics != null && _metrics!['recent_alerts'] is List) {
        _systemAlerts = List<dynamic>.from(_metrics!['recent_alerts']);
      }

      _lastUpdated = DateTime.now();
      _errorMessage = null;
    } on DioException catch (e) {
      if (!silent) {
        _errorMessage = e.response?.data?['message'] ?? 'Gagal memuat ringkasan dashboard.';
      }
    } catch (e) {
      if (!silent) {
        _errorMessage = 'Terjadi kesalahan: $e';
      }
    } finally {
      _isLoading = false;
      _isAutoRefreshing = false;
      notifyListeners();
    }
  }

  void startAutoRefresh({Duration interval = const Duration(seconds: 15)}) {
    _autoRefreshTimer?.cancel();
    _autoRefreshTimer = Timer.periodic(interval, (_) {
      fetchDashboardData(silent: true);
    });
  }

  void stopAutoRefresh() {
    _autoRefreshTimer?.cancel();
    _autoRefreshTimer = null;
  }

  @override
  void dispose() {
    stopAutoRefresh();
    super.dispose();
  }
}
