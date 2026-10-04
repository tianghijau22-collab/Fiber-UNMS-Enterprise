import 'dart:async';
import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../network/dio_client.dart';
import '../../views/alerts/system_alert_screen.dart';
import '../../views/customers/customer_list_screen.dart';
import '../../views/gis/gis_map_screen.dart';
import '../../views/infrastructure/nodes_list_screen.dart';
import '../../views/notifications/notification_center_screen.dart';
import '../../views/tickets/ticket_list_screen.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (_) {}
  debugPrint('FCM Background message received: ${message.messageId} - ${message.notification?.title}');
}

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();
  bool _isInitialized = false;
  String? _fcmToken;

  GlobalKey<NavigatorState>? _navigatorKey;
  Map<String, dynamic>? _pendingNotificationData;

  String? get fcmToken => _fcmToken;

  void setNavigatorKey(GlobalKey<NavigatorState> key) {
    _navigatorKey = key;
    if (_pendingNotificationData != null) {
      final data = _pendingNotificationData!;
      _pendingNotificationData = null;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        handleNotificationRouting(data);
      });
    }
  }

  static const String channelId = 'fona_custom_alerts_v1';
  static const String channelName = 'FONA Global Alerts & Broadcast';
  static const String channelDescription = 'Pemberitahuan siaran global, pemeliharaan, dan alarm telemetri FONA Mobile';

  static const String globalTopic = 'fona_global_alerts';

  Future<void> init() async {
    if (_isInitialized) return;

    try {
      // 1. Initialize Firebase Core
      try {
        await Firebase.initializeApp();
        FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
      } catch (e) {
        debugPrint('Firebase.initializeApp warning/error: $e');
      }

      // 2. Initialize Local Notifications Plugin
      const AndroidInitializationSettings androidSettings =
          AndroidInitializationSettings('@mipmap/ic_launcher');

      const DarwinInitializationSettings iosSettings = DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );

      const InitializationSettings initSettings = InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      );

      await _localNotifications.initialize(
        initSettings,
        onDidReceiveNotificationResponse: (NotificationResponse response) {
          debugPrint('Local Notification tapped: payload=${response.payload}');
          if (response.payload != null && response.payload!.isNotEmpty) {
            try {
              final decoded = jsonDecode(response.payload!);
              if (decoded is Map<String, dynamic>) {
                handleNotificationRouting(decoded);
                return;
              }
            } catch (_) {}
            handleNotificationRouting({'url': response.payload});
          } else {
            handleNotificationRouting({'url': '/notifications'});
          }
        },
      );

      // 3. Create High Importance Android Notification Channel with Custom Sound
      final androidPlugin = _localNotifications.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      if (androidPlugin != null) {
        await androidPlugin.createNotificationChannel(
          const AndroidNotificationChannel(
            channelId,
            channelName,
            description: channelDescription,
            importance: Importance.max,
            playSound: true,
            enableVibration: true,
            sound: RawResourceAndroidNotificationSound('fona_alert'),
          ),
        );
        await androidPlugin.requestNotificationsPermission();
      }

      // 4. Request FCM Notification Permissions & Foreground Options
      try {
        final messaging = FirebaseMessaging.instance;
        await messaging.requestPermission(
          alert: true,
          announcement: false,
          badge: true,
          carPlay: false,
          criticalAlert: false,
          provisional: false,
          sound: true,
        );

        await messaging.setForegroundNotificationPresentationOptions(
          alert: true,
          badge: true,
          sound: true,
        );

        // 5. Subscribe to Global Broadcast Topic
        await messaging.subscribeToTopic(globalTopic);
        debugPrint('Subscribed to FCM topic: $globalTopic');

        // 6. Retrieve and register FCM token
        _fcmToken = await messaging.getToken();
        debugPrint('FCM Device Token: $_fcmToken');
        if (_fcmToken != null) {
          syncFcmTokenWithBackend(_fcmToken!);
        }

        messaging.onTokenRefresh.listen((newToken) {
          _fcmToken = newToken;
          syncFcmTokenWithBackend(newToken);
        });

        // 7. Handle Foreground Messages (Display local notification with full payload)
        FirebaseMessaging.onMessage.listen((RemoteMessage message) {
          debugPrint('FCM Foreground message: ${message.notification?.title}');
          final notification = message.notification;
          if (notification != null) {
            final Map<String, dynamic> combinedPayload = Map<String, dynamic>.from(message.data);
            if (!combinedPayload.containsKey('title')) {
              combinedPayload['title'] = notification.title;
            }
            if (!combinedPayload.containsKey('body')) {
              combinedPayload['body'] = notification.body;
            }

            showLocalNotification(
              id: message.hashCode,
              title: notification.title ?? 'Pemberitahuan Sistem',
              body: notification.body ?? '',
              payload: jsonEncode(combinedPayload),
            );
          }
        });

        // 8. Handle Notification Opened App when in Background
        FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
          debugPrint('FCM onMessageOpenedApp tapped: ${message.data}');
          final Map<String, dynamic> combinedPayload = Map<String, dynamic>.from(message.data);
          if (message.notification != null) {
            combinedPayload['title'] ??= message.notification!.title;
            combinedPayload['body'] ??= message.notification!.body;
          }
          handleNotificationRouting(combinedPayload);
        });

        // 9. Handle Notification Opened App when Terminated / Cold Start
        final initialMessage = await messaging.getInitialMessage();
        if (initialMessage != null) {
          debugPrint('FCM Initial Message (from terminated): ${initialMessage.data}');
          final Map<String, dynamic> combinedPayload = Map<String, dynamic>.from(initialMessage.data);
          if (initialMessage.notification != null) {
            combinedPayload['title'] ??= initialMessage.notification!.title;
            combinedPayload['body'] ??= initialMessage.notification!.body;
          }
          handleNotificationRouting(combinedPayload);
        }

        // 10. Check Local Notifications Launch Details
        final launchDetails = await _localNotifications.getNotificationAppLaunchDetails();
        if (launchDetails != null &&
            launchDetails.didNotificationLaunchApp &&
            launchDetails.notificationResponse?.payload != null) {
          final payloadStr = launchDetails.notificationResponse!.payload!;
          try {
            final decoded = jsonDecode(payloadStr);
            if (decoded is Map<String, dynamic>) {
              handleNotificationRouting(decoded);
            }
          } catch (_) {
            handleNotificationRouting({'url': payloadStr});
          }
        }
      } catch (fcmError) {
        debugPrint('FCM messaging setup error: $fcmError');
      }

      _isInitialized = true;
    } catch (e) {
      debugPrint('Error initializing NotificationService: $e');
    }
  }

  Future<void> syncFcmTokenWithBackend(String token) async {
    try {
      await DioClient().dio.post(
        '/notifications/push-subscribe',
        data: {
          'endpoint': 'fcm:$token',
          'auth_token': token,
          'device_name': 'Android Mobile FONA App',
        },
      );
      debugPrint('FCM Token successfully registered to backend UNMS');
    } catch (e) {
      debugPrint('Warning: Could not sync FCM token to backend yet: $e');
    }
  }

  Future<void> showLocalNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
    String? subText,
  }) async {
    try {
      const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
        channelId,
        channelName,
        channelDescription: channelDescription,
        importance: Importance.max,
        priority: Priority.high,
        showWhen: true,
        icon: '@mipmap/ic_launcher',
        enableVibration: true,
        playSound: true,
        sound: RawResourceAndroidNotificationSound('fona_alert'),
      );

      const DarwinNotificationDetails iosDetails = DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      );

      const NotificationDetails platformDetails = NotificationDetails(
        android: androidDetails,
        iOS: iosDetails,
      );

      await _localNotifications.show(
        id,
        title,
        body,
        platformDetails,
        payload: payload,
      );
    } catch (e) {
      debugPrint('Error showing local notification: $e');
    }
  }

  /// Routing terpadu saat notifikasi diklik
  void handleNotificationRouting(Map<String, dynamic> data) {
    debugPrint('🔔 [NotificationService] Routing click with data: $data');

    final navState = _navigatorKey?.currentState;
    if (navState == null) {
      debugPrint('Navigator state not ready yet, queuing notification routing.');
      _pendingNotificationData = data;
      return;
    }

    final String url = (data['url'] ?? '').toString().toLowerCase();
    final String type = (data['type'] ?? '').toString().toUpperCase();
    final dynamic rawNodeId = data['node_id'] ?? data['nodeId'] ?? data['highlightNodeId'];

    // 1. GIS / Topologi / Gangguan Jalur Optik
    if (url.contains('/gis') ||
        url.contains('topol') ||
        type == 'TOPOLOGY_FAULT' ||
        type == 'OUTAGE_INTERFACE' ||
        type == 'OUTAGE_ODP') {
      final int? nodeId = rawNodeId != null ? int.tryParse(rawNodeId.toString()) : null;
      navState.push(
        MaterialPageRoute(
          builder: (_) => GisMapScreen(highlightNodeId: nodeId),
        ),
      );
      return;
    }

    // 2. Data Node / ODP / ODC / POP
    if (url.contains('/infrastructure') ||
        url.contains('/nodes') ||
        url.contains('/odp') ||
        type == 'ODP' ||
        type == 'ODC' ||
        type == 'POP') {
      String initialType = 'ODP';
      if (type == 'ODC' || url.contains('odc')) initialType = 'ODC';
      if (type == 'POP' || url.contains('pop')) initialType = 'POP';

      navState.push(
        MaterialPageRoute(
          builder: (_) => NodesListScreen(initialType: initialType),
        ),
      );
      return;
    }

    // 3. Pelanggan (Customers) / Tagihan / Expiring / Isolir / Offline
    if (url.contains('/customers') ||
        url.contains('/pelanggan') ||
        type == 'CUSTOMER' ||
        type == 'EXPIRING' ||
        type == 'OFFLINE' ||
        type == 'ISOLIR') {
      navState.push(
        MaterialPageRoute(
          builder: (_) => const CustomerListScreen(),
        ),
      );
      return;
    }

    // 4. Tiket Gangguan / NOC Support
    if (url.contains('/tickets') || url.contains('/tiket') || type == 'TICKET') {
      navState.push(
        MaterialPageRoute(
          builder: (_) => const TicketListScreen(),
        ),
      );
      return;
    }

    // 5. System Alerts / Alarm Masal
    if (url.contains('/alerts') || url.contains('/alarm') || type == 'MASS_OUTAGE' || type == 'ALARM') {
      navState.push(
        MaterialPageRoute(
          builder: (_) => const SystemAlertScreen(),
        ),
      );
      return;
    }

    // 6. Default: Buka Pusat Notifikasi (Notification Center Screen)
    navState.push(
      MaterialPageRoute(
        builder: (_) => const NotificationCenterScreen(),
      ),
    );
  }

  /// Dipanggil saat shell utama aktif untuk mengecek antrian notifikasi
  void consumePendingNotification(BuildContext context) {
    if (_pendingNotificationData != null) {
      final data = _pendingNotificationData!;
      _pendingNotificationData = null;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        handleNotificationRouting(data);
      });
    }
  }
}
