import 'dart:async';
import 'package:flutter/material.dart';
import '../core/constants/api_constants.dart';
import '../core/network/dio_client.dart';
import '../core/services/notification_service.dart';
import '../models/notification_model.dart';

class NotificationProvider extends ChangeNotifier {
  List<NotificationModel> _notifications = [];
  int _unreadCount = 0;
  bool _isLoading = false;
  String? _errorMessage;
  String _selectedCategory = 'ALL';
  
  Timer? _syncTimer;
  int _highestKnownId = 0;
  bool _isFirstLoad = true;

  List<NotificationModel> get notifications => _notifications;
  int get unreadCount => _unreadCount;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  String get selectedCategory => _selectedCategory;

  List<NotificationModel> get filteredNotifications {
    if (_selectedCategory == 'ALL') {
      return _notifications;
    }
    return _notifications.where((n) {
      if (_selectedCategory == 'NOC') {
        return n.type == 'NOC' || n.type == 'ALARM' || n.type == 'OUTAGE';
      }
      if (_selectedCategory == 'MAINTENANCE') {
        return n.type == 'MAINTENANCE' || n.type == 'WARNING';
      }
      if (_selectedCategory == 'BROADCAST') {
        return n.type == 'BROADCAST' || n.type == 'INFO';
      }
      if (_selectedCategory == 'TICKET') {
        return n.type == 'TICKET' || n.type == 'PROVISIONING';
      }
      if (_selectedCategory == 'SECURITY') {
        return n.type == 'SECURITY';
      }
      return n.type == _selectedCategory;
    }).toList();
  }

  void setCategory(String category) {
    _selectedCategory = category;
    notifyListeners();
  }

  void startAutoSync({Duration interval = const Duration(seconds: 15)}) {
    _syncTimer?.cancel();
    fetchNotifications(silent: false);
    _syncTimer = Timer.periodic(interval, (_) {
      fetchNotifications(silent: true);
    });
  }

  void stopAutoSync() {
    _syncTimer?.cancel();
    _syncTimer = null;
  }

  Future<void> fetchNotifications({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
    }

    try {
      final response = await DioClient().dio.get(ApiConstants.endpointNotifications);
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        List<dynamic> rawList = [];

        if (data is Map<String, dynamic>) {
          rawList = data['notifications'] as List? ?? [];
        } else if (data is List) {
          rawList = data;
        }

        final parsed = rawList.map((item) => NotificationModel.fromJson(item as Map<String, dynamic>)).toList();
        
        // Filter out individual traps / individual modem alarms
        final validNotifications = parsed.where(isValidNotification).toList();
        
        // Trigger local notification for new unread notifications that arrived
        if (!_isFirstLoad && validNotifications.isNotEmpty) {
          for (final notif in validNotifications) {
            if (notif.id > _highestKnownId && !notif.isRead) {
              NotificationService().showLocalNotification(
                id: notif.id,
                title: notif.title,
                body: notif.body,
                payload: notif.url,
              );
            }
          }
        }

        if (validNotifications.isNotEmpty) {
          final maxId = validNotifications.map((e) => e.id).reduce((a, b) => a > b ? a : b);
          if (maxId > _highestKnownId) {
            _highestKnownId = maxId;
          }
        }

        _isFirstLoad = false;
        _notifications = validNotifications;
        _unreadCount = validNotifications.where((n) => !n.isRead).length;
        _errorMessage = null;
      }
    } catch (e) {
      _errorMessage = 'Gagal memuat notifikasi: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> markAsRead(int id) async {
    try {
      // Optimistic update
      final index = _notifications.indexWhere((n) => n.id == id);
      if (index != -1 && !_notifications[index].isRead) {
        final old = _notifications[index];
        _notifications[index] = NotificationModel(
          id: old.id,
          userId: old.userId,
          type: old.type,
          title: old.title,
          body: old.body,
          url: old.url,
          icon: old.icon,
          isRead: true,
          readAt: DateTime.now(),
          createdAt: old.createdAt,
        );
        if (_unreadCount > 0) _unreadCount--;
        notifyListeners();
      }

      final response = await DioClient().dio.post('/notifications/$id/read');
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('Error marking notification as read: $e');
      return false;
    }
  }

  Future<bool> markAllAsRead() async {
    try {
      // Optimistic update
      _notifications = _notifications.map((old) {
        return NotificationModel(
          id: old.id,
          userId: old.userId,
          type: old.type,
          title: old.title,
          body: old.body,
          url: old.url,
          icon: old.icon,
          isRead: true,
          readAt: DateTime.now(),
          createdAt: old.createdAt,
        );
      }).toList();
      _unreadCount = 0;
      notifyListeners();

      final response = await DioClient().dio.post('/notifications/mark-all-read');
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('Error marking all notifications as read: $e');
      return false;
    }
  }

  Future<bool> deleteNotification(int id) async {
    try {
      _notifications.removeWhere((n) => n.id == id);
      notifyListeners();

      final response = await DioClient().dio.delete('/notifications/$id');
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('Error deleting notification: $e');
      return false;
    }
  }

  Future<bool> clearAll() async {
    try {
      _notifications.clear();
      _unreadCount = 0;
      notifyListeners();

      final response = await DioClient().dio.delete('/notifications/clear-all');
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('Error clearing notifications: $e');
      return false;
    }
  }

  Future<Map<String, dynamic>> sendBroadcast({
    required String title,
    required String body,
    required String type,
    String targetRole = 'ALL',
    String? url,
    String? imageUrl,
  }) async {
    try {
      final response = await DioClient().dio.post(
        '/notifications/broadcast',
        data: {
          'title': title,
          'body': body,
          'type': type,
          'target_role': targetRole,
          'url': url ?? '/dashboard',
          if (imageUrl != null && imageUrl.trim().isNotEmpty) 'image_url': imageUrl.trim(),
        },
      );

      if (response.statusCode == 200) {
        await fetchNotifications(silent: true);
        return {
          'success': true,
          'message': response.data['message'] ?? 'Siaran global berhasil dikirim ke seluruh perangkat.',
          'target_recipients': response.data['target_recipients'] ?? 0,
        };
      }
      return {
        'success': false,
        'message': response.data['message'] ?? 'Gagal mengirim siaran.',
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Terjadi kesalahan saat menyiarkan notifikasi: $e',
      };
    }
  }

  static bool isValidNotification(NotificationModel n) {
    final typeUpper = n.type.toUpperCase();
    final titleUpper = n.title.toUpperCase();

    // 1. Blacklist noise telemetri individual & alarm modem individual
    if (typeUpper == 'TRAP_INDIVIDUAL' ||
        typeUpper == 'POLL' ||
        typeUpper == 'SNMP' ||
        typeUpper == 'ALARM' ||
        titleUpper.contains('SNMP TRAP') ||
        titleUpper.contains('MODEM ') ||
        titleUpper.contains('ONU ')) {
      return false;
    }

    // 2. Allowed notification types only:
    final isBroadcast = ['BROADCAST', 'MAINTENANCE', 'INFO', 'WARNING', 'SECURITY', 'ANNOUNCEMENT'].contains(typeUpper);
    final isTicket = ['TICKET', 'PROVISIONING'].contains(typeUpper);
    final isMassOutage = ['MASS_OUTAGE', 'OUTAGE_INTERFACE', 'OUTAGE_ODP'].contains(typeUpper) ||
        titleUpper.contains('GANGGUAN MASSAL') ||
        titleUpper.contains('GANGGUAN PORT') ||
        titleUpper.contains('GANGGUAN ODP') ||
        titleUpper.contains('PUTUS KABEL');
    final isMassRecovery = ['MASS_RECOVERY', 'RECOVERY_INTERFACE', 'RECOVERY_ODP'].contains(typeUpper) ||
        titleUpper.contains('PEMULIHAN MASSAL') ||
        titleUpper.contains('PEMULIHAN PORT') ||
        titleUpper.contains('PEMULIHAN ODP') ||
        titleUpper.contains('PULIH MASSAL');

    return isBroadcast || isTicket || isMassOutage || isMassRecovery;
  }

  @override
  void dispose() {
    _syncTimer?.cancel();
    super.dispose();
  }
}
