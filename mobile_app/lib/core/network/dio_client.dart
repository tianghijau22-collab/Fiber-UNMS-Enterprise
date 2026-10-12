import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../constants/api_constants.dart';
import '../storage/secure_storage_service.dart';

class DioClient {
  static final DioClient _instance = DioClient._internal();
  factory DioClient() => _instance;
  DioClient._internal();

  late Dio _dio;
  final ValueNotifier<int> sessionExpired = ValueNotifier(0);

  Dio get dio => _dio;

  static String sanitizeUrl(String url) {
    var trimmed = url.trim();
    if (trimmed.isEmpty) return ApiConstants.defaultBaseUrl;

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      trimmed = 'https://$trimmed';
    }
    trimmed = trimmed.replaceFirst(RegExp(r'^http://'), 'https://');
    while (trimmed.endsWith('/')) {
      trimmed = trimmed.substring(0, trimmed.length - 1);
    }
    if (!trimmed.endsWith('/api')) {
      trimmed = '$trimmed/api';
    }
    return trimmed;
  }

  Future<void> init() async {
    final rawUrl = await StorageService().getServerUrl();
    final baseUrl = sanitizeUrl(rawUrl);

    _dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        sendTimeout: const Duration(seconds: 15),
        followRedirects: false,
        maxRedirects: 0,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (options.uri.scheme != 'https' ||
              options.uri.origin != Uri.parse(options.baseUrl).origin) {
            return handler.reject(DioException(
              requestOptions: options,
              type: DioExceptionType.badCertificate,
              error: 'Koneksi API wajib menggunakan HTTPS pada server yang dipilih.',
            ));
          }
          // Attach Bearer Token if available
          final token = await StorageService().getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          // Handle 401 Unauthorized globally if token expired
          final isLogin = e.requestOptions.path == ApiConstants.endpointLogin;
          final inactive = e.response?.statusCode == 403 &&
              e.response?.data is Map &&
              e.response?.data['code'] == 'ACCOUNT_INACTIVE';
          if (!isLogin && (e.response?.statusCode == 401 || inactive)) {
            // Ignore stale failures from a token replaced by a later login.
            final currentToken = await StorageService().getToken();
            if (currentToken != null &&
                e.requestOptions.headers['Authorization'] == 'Bearer $currentToken') {
              await StorageService().clearSession();
              sessionExpired.value++;
            }
          }
          return handler.next(e);
        },
      ),
    );
  }

  // Update base URL dynamically when user changes server settings
  void updateBaseUrl(String newUrl) {
    final sanitized = sanitizeUrl(newUrl);
    _dio.options.baseUrl = sanitized;
  }
}
