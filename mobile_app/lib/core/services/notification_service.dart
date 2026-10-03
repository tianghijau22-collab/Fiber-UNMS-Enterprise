import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../network/dio_client.dart';

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

  String? get fcmToken => _fcmToken;

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
          debugPrint('Notification tapped: ${response.payload}');
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

        // 7. Handle Foreground Messages
        FirebaseMessaging.onMessage.listen((RemoteMessage message) {
          debugPrint('FCM Foreground message: ${message.notification?.title}');
          final notification = message.notification;
          if (notification != null) {
            showLocalNotification(
              id: message.hashCode,
              title: notification.title ?? 'Pemberitahuan Sistem',
              body: notification.body ?? '',
              payload: message.data['url']?.toString(),
            );
          }
        });

        // 8. Handle Notification Opened App
        FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
          debugPrint('FCM onMessageOpenedApp: ${message.data}');
        });
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
}
