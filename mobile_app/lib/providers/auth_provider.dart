import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../core/constants/api_constants.dart';
import '../core/network/dio_client.dart';
import '../core/storage/secure_storage_service.dart';
import '../models/user_model.dart';

class AuthProvider extends ChangeNotifier {
  AuthProvider() {
    DioClient().sessionExpired.addListener(_handleSessionExpired);
  }

  void _handleSessionExpired() {
    _currentUser = null;
    _errorMessage = 'Sesi telah berakhir. Silakan login kembali.';
    notifyListeners();
  }

  @override
  void dispose() {
    DioClient().sessionExpired.removeListener(_handleSessionExpired);
    super.dispose();
  }

  UserModel? _currentUser;
  bool _isLoading = false;
  String? _errorMessage;

  UserModel? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _currentUser != null;

  // Initialize auth state on app launch
  Future<void> initAuth() async {
    _isLoading = true;
    notifyListeners();

    try {
      final token = await StorageService().getToken();
      if (token != null && token.isNotEmpty) {
        // Cached identity is displayed only after the server verifies its token.
        await fetchProfile();
      }
    } catch (_) {
      _currentUser = null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Login using Web Account Credentials (Username / Email / Phone + Password)
  Future<bool> login(String username, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await DioClient().dio.post(
        ApiConstants.endpointLogin,
        data: {
          'username': username.trim(),
          'password': password,
        },
      );

      final data = response.data;
      if (data['token'] != null && data['user'] != null) {
        final token = data['token'].toString();
        final user = UserModel.fromJson(data['user']);

        await StorageService().saveToken(token);
        await StorageService().saveUser(user);

        _currentUser = user;
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = data['message'] ?? 'Respon server tidak valid.';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } on DioException catch (e) {
      _isLoading = false;
      if (e.response != null && e.response?.data != null) {
        if (e.response?.data is Map && e.response?.data['message'] != null) {
          _errorMessage = e.response?.data['message'];
        } else {
          _errorMessage = 'Login gagal (${e.response?.statusCode}). Periksa kredensial Anda.';
        }
      } else {
        _errorMessage = 'Tidak dapat terhubung ke server (${e.type.name}). Periksa koneksi internet atau Server URL di tombol pengaturan kanan atas.';
      }
      notifyListeners();
      return false;
    } catch (e) {
      _isLoading = false;
      _errorMessage = 'Terjadi kesalahan sistem: $e';
      notifyListeners();
      return false;
    }
  }

  // Fetch / Refresh Profile
  Future<void> fetchProfile() async {
    try {
      final response = await DioClient().dio.get(ApiConstants.endpointMe);
      if (response.data != null && response.data['user'] != null) {
        final user = UserModel.fromJson(response.data['user']);
        _currentUser = user;
        await StorageService().saveUser(user);
        notifyListeners();
      }
    } on DioException catch (e) {
      if (_currentUser == null) {
        _errorMessage = e.response?.statusCode == 401
            ? 'Sesi telah berakhir. Silakan login kembali.'
            : 'Sesi belum dapat diverifikasi. Periksa koneksi server.';
        notifyListeners();
      }
    }
  }

  // Logout
  Future<void> logout() async {
    try {
      if (_currentUser != null) {
        await DioClient().dio.post(
          ApiConstants.endpointLogout,
          data: {'user_id': _currentUser!.id},
        );
      }
    } catch (_) {}

    await StorageService().clearSession();
    _currentUser = null;
    notifyListeners();
  }
}
