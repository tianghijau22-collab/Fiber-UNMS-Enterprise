import 'dart:io';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import '../constants/api_constants.dart';
import '../storage/secure_storage_service.dart';

class DioClient {
  static final DioClient _instance = DioClient._internal();
  factory DioClient() => _instance;
  DioClient._internal();

  late Dio _dio;

  Dio get dio => _dio;

  static String sanitizeUrl(String url) {
    var trimmed = url.trim();
    if (trimmed.isEmpty) return ApiConstants.defaultBaseUrl;

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      trimmed = 'http://$trimmed';
    }
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
        followRedirects: true,
        maxRedirects: 5,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      ),
    );

    // Allow connections to servers with self-signed SSL or raw IP addresses
    final adapter = _dio.httpClientAdapter;
    if (adapter is IOHttpClientAdapter) {
      adapter.createHttpClient = () {
        final client = HttpClient();
        client.badCertificateCallback = (X509Certificate cert, String host, int port) => true;
        return client;
      };
    }

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Attach Bearer Token if available
          final token = await StorageService().getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          // Handle 401 Unauthorized globally if token expired
          if (e.response?.statusCode == 401) {
            // Optional: trigger session clear or broadcast logout event
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
