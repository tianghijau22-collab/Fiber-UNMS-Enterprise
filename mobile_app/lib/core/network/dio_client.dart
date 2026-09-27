import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../storage/secure_storage_service.dart';

class DioClient {
  static final DioClient _instance = DioClient._internal();
  factory DioClient() => _instance;
  DioClient._internal();

  late Dio _dio;

  Dio get dio => _dio;

  Future<void> init() async {
    final baseUrl = await StorageService().getServerUrl();

    _dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Attach Sanctum Bearer Token if available
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
    _dio.options.baseUrl = newUrl;
  }
}
